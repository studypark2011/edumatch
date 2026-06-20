import "server-only";
import OpenAI from "openai";
import {
  EMBEDDING_PROVIDER,
  EMBEDDING_DIM,
  OPENAI_EMBEDDING_MODEL,
  VOYAGE_EMBEDDING_MODEL,
  getOpenAIKey,
  getVoyageKey,
} from "@/lib/env";

/**
 * 埋め込みプロバイダ抽象。出力次元は 1024 に統一（スキーマ vector(1024) と一致）。
 *  - openai: text-embedding-3-small に dimensions:1024 を指定
 *  - voyage: voyage-3.5-lite（既定 1024 次元）
 */

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: getOpenAIKey() });
  return _openai;
}

async function embedOpenAI(texts: string[]): Promise<number[][]> {
  const res = await openai().embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIM,
  });
  return res.data.map((d) => d.embedding as number[]);
}

async function embedVoyage(
  texts: string[],
  inputType: "query" | "document",
): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getVoyageKey()}`,
    },
    body: JSON.stringify({
      model: VOYAGE_EMBEDDING_MODEL,
      input: texts,
      input_type: inputType,
      output_dimension: EMBEDDING_DIM,
    }),
  });
  if (!res.ok) {
    throw new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data.map((d) => d.embedding);
}

/** 複数テキストをまとめて埋め込む（文書取り込み用） */
export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return EMBEDDING_PROVIDER === "voyage"
    ? embedVoyage(texts, "document")
    : embedOpenAI(texts);
}

/** 1件のクエリを埋め込む（検索用） */
export async function embedQuery(text: string): Promise<number[]> {
  const out =
    EMBEDDING_PROVIDER === "voyage"
      ? await embedVoyage([text], "query")
      : await embedOpenAI([text]);
  return out[0];
}
