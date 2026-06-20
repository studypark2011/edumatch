import "server-only";
import * as cheerio from "cheerio";
import { supabaseAdmin } from "@/lib/supabase/server";
import { embedDocuments, embedQuery } from "@/lib/embeddings";
import type { Citation, MatchChunkRow } from "@/lib/types";

const CHUNK_SIZE = 800; // 文字
const CHUNK_OVERLAP = 120;

/** テキストを段落境界を尊重しつつ ~CHUNK_SIZE 文字に分割 */
export function chunkText(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  // まず段落で粗く分割
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";
  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim());
    buf = "";
  };
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length <= CHUNK_SIZE) {
      buf = buf ? buf + "\n\n" + p : p;
    } else {
      flush();
      if (p.length <= CHUNK_SIZE) {
        buf = p;
      } else {
        // 長い段落はスライディングウィンドウで分割
        for (let i = 0; i < p.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
          chunks.push(p.slice(i, i + CHUNK_SIZE).trim());
        }
      }
    }
  }
  flush();
  return chunks.filter((c) => c.length > 0);
}

/** URL からテキストを抽出（PDF は pdf-parse、HTML は cheerio で本文抽出） */
export async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MingakuRAG/1.0)" },
  });
  if (!res.ok) throw new Error(`URL取得失敗: ${res.status} ${url}`);
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")) {
    const buf = Buffer.from(await res.arrayBuffer());
    return extractPdf(buf);
  }

  const html = await res.text();
  return extractHtml(html);
}

export async function extractPdf(buf: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export function extractHtml(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer, noscript, iframe, svg").remove();
  const main = $("main").text() || $("article").text() || $("body").text();
  return main.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

type IngestInput = {
  title: string;
  tags: string[];
  sourceType: "url" | "file" | "text";
  sourceUrl?: string | null;
  content?: string | null; // text/file の場合は抽出済みテキスト
};

/**
 * 文書を取り込む：documents 行を作成 → 本文取得 → チャンク化 → 埋め込み → document_chunks 保存。
 * 戻り値は documents.id。
 */
export async function ingestDocument(input: IngestInput): Promise<string> {
  const db = supabaseAdmin();
  const { data: doc, error: insErr } = await db
    .from("documents")
    .insert({
      title: input.title,
      source_type: input.sourceType,
      source_url: input.sourceUrl ?? null,
      tags: input.tags,
      status: "processing",
    })
    .select("id")
    .single();
  if (insErr || !doc) throw new Error(insErr?.message ?? "文書の作成に失敗しました");

  const documentId = doc.id as string;
  try {
    let text = input.content ?? "";
    if (input.sourceType === "url") {
      if (!input.sourceUrl) throw new Error("URLが指定されていません");
      text = await fetchUrlText(input.sourceUrl);
    }
    text = (text ?? "").trim();
    if (!text) throw new Error("本文を抽出できませんでした");

    const chunks = chunkText(text);
    if (chunks.length === 0) throw new Error("チャンクを生成できませんでした");

    // 埋め込みはバッチで（API上限を考慮し96件ずつ）
    const BATCH = 96;
    const rows: { document_id: string; chunk_index: number; content: string; tags: string[]; embedding: number[] }[] = [];
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vectors = await embedDocuments(slice);
      slice.forEach((content, j) => {
        rows.push({
          document_id: documentId,
          chunk_index: i + j,
          content,
          tags: input.tags,
          embedding: vectors[j],
        });
      });
    }

    const { error: chunkErr } = await db.from("document_chunks").insert(rows);
    if (chunkErr) throw new Error(chunkErr.message);

    await db
      .from("documents")
      .update({
        status: "ready",
        char_count: text.length,
        chunk_count: chunks.length,
        error: null,
      })
      .eq("id", documentId);

    return documentId;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("documents").update({ status: "error", error: message }).eq("id", documentId);
    throw e;
  }
}

/** クエリに関連するチャンクを検索し、引用として返す */
export async function retrieve(
  query: string,
  filterTag: string | null,
  matchCount = 6,
): Promise<Citation[]> {
  const db = supabaseAdmin();
  const queryEmbedding = await embedQuery(query);
  const { data, error } = await db.rpc("match_chunks", {
    query_embedding: queryEmbedding,
    filter_tag: filterTag,
    match_count: matchCount,
  });
  if (error) throw new Error(`検索失敗: ${error.message}`);
  const rows = (data ?? []) as MatchChunkRow[];
  return rows.map((r) => ({
    document_id: r.document_id,
    title: r.title,
    source_url: r.source_url,
    chunk_index: r.chunk_index,
    snippet: r.content,
    similarity: r.similarity,
  }));
}

/** 引用群を、システムプロンプトに差し込む【参考資料】ブロックに整形 */
export function buildContextBlock(citations: Citation[]): string {
  if (citations.length === 0) return "";
  const blocks = citations
    .map(
      (c, i) =>
        `[資料${i + 1}] ${c.title}${c.source_url ? `（${c.source_url}）` : ""}\n${c.snippet}`,
    )
    .join("\n\n");
  return `\n\n--- 【参考資料】（以下の範囲で根拠を示すこと。資料にない事柄は断定しない） ---\n${blocks}\n--- 参考資料ここまで ---`;
}
