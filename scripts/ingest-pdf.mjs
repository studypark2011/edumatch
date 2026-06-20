// ローカルPDFをRAG知識基盤に取り込む（テキスト抽出→チャンク化→埋め込み→Supabase保存）。
// 大きなPDFをHTTPタイムアウトなしで確実に投入するための専用スクリプト。
//   node scripts/ingest-pdf.mjs            （scripts/ingest.config.mjs を使用）
//   node scripts/ingest-pdf.mjs other.config.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 120;
const EMBED_DIM = 1024;
const EMBED_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function chunkText(raw) {
  const text = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let buf = "";
  const flush = () => { if (buf.trim()) chunks.push(buf.trim()); buf = ""; };
  for (const p of paragraphs) {
    if ((buf + "\n\n" + p).length <= CHUNK_SIZE) {
      buf = buf ? buf + "\n\n" + p : p;
    } else {
      flush();
      if (p.length <= CHUNK_SIZE) { buf = p; }
      else { for (let i = 0; i < p.length; i += CHUNK_SIZE - CHUNK_OVERLAP) chunks.push(p.slice(i, i + CHUNK_SIZE).trim()); }
    }
  }
  flush();
  return chunks.filter((c) => c.length > 0);
}

async function extractPdf(path) {
  const buf = readFileSync(path);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  try { return (await parser.getText()).text; }
  finally { await parser.destroy(); }
}

async function embedBatch(texts) {
  const res = await openai.embeddings.create({ model: EMBED_MODEL, input: texts, dimensions: EMBED_DIM });
  return res.data.map((d) => d.embedding);
}

async function ingest({ path, tag, title }) {
  console.log(`\n=== ${title} ===\n  file: ${path}`);
  const text = (await extractPdf(path)).trim();
  console.log(`  抽出: ${text.length} 文字 / 冒頭: ${text.slice(0, 160).replace(/\n/g, " ")}`);
  const chunks = chunkText(text);
  console.log(`  チャンク: ${chunks.length}`);
  if (chunks.length === 0) { console.log("  ⚠ スキップ（本文なし）"); return; }

  const { data: doc, error: e1 } = await supabase
    .from("documents")
    .insert({ title, source_type: "file", tags: [tag], status: "processing" })
    .select("id").single();
  if (e1) throw new Error(e1.message);
  const documentId = doc.id;

  try {
    const rows = [];
    for (let i = 0; i < chunks.length; i += 96) {
      const slice = chunks.slice(i, i + 96);
      const vectors = await embedBatch(slice);
      slice.forEach((content, j) => rows.push({
        document_id: documentId, chunk_index: i + j, content, tags: [tag], embedding: vectors[j],
      }));
      process.stdout.write(`\r  埋め込み: ${Math.min(i + 96, chunks.length)}/${chunks.length}`);
    }
    console.log("");
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from("document_chunks").insert(rows.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
    await supabase.from("documents").update({
      status: "ready", char_count: text.length, chunk_count: chunks.length, error: null,
    }).eq("id", documentId);
    console.log(`  ✅ 登録完了（${chunks.length} チャンク）`);
  } catch (e) {
    await supabase.from("documents").update({ status: "error", error: String(e.message ?? e) }).eq("id", documentId);
    throw e;
  }
}

const configArg = process.argv[2] ?? "scripts/ingest.config.mjs";
const configPath = isAbsolute(configArg) ? configArg : join(root, configArg);
const { docs } = await import(pathToFileURL(configPath).href);

for (const d of docs) {
  try { await ingest(d); }
  catch (e) { console.error(`  ❌ 失敗: ${d.title} -> ${e.message ?? e}`); }
}
console.log("\nすべて処理しました。");
