// すべての研究データを一括でCSVに書き出す。
//   node scripts/export-all.mjs            （./export に出力）
//   node scripts/export-all.mjs C:/path/out
// 出力対象: participants, conversations, messages, documents, themes, modes, experiment_config
// （document_chunks は埋め込みベクトルが巨大なため対象外）
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, isAbsolute } from "node:path";
import dotenv from "dotenv";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });

const TABLES = [
  "participants",
  "conversations",
  "messages",
  "documents",
  "themes",
  "modes",
  "experiment_config",
];

function cell(v) {
  if (v === null || v === undefined) return '""';
  if (typeof v === "boolean") return `"${v ? 1 : 0}"`;
  if (Array.isArray(v)) return `"${v.join(";").replace(/"/g, '""')}"`;
  if (typeof v === "object") return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
  return `"${String(v).replace(/"/g, '""')}"`;
}

const outArg = process.argv[2] ?? "export";
const outDir = isAbsolute(outArg) ? outArg : join(root, outArg);
mkdirSync(outDir, { recursive: true });

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

for (const t of TABLES) {
  const res = await client.query(`select * from ${t}`);
  const headers = res.fields.map((f) => f.name);
  const head = headers.map(cell).join(",");
  const body = res.rows.map((r) => headers.map((h) => cell(r[h])).join(",")).join("\n");
  const csv = "﻿" + head + "\n" + body + "\n"; // BOM付き（Excel文字化け防止）
  const path = join(outDir, `${t}.csv`);
  writeFileSync(path, csv, "utf8");
  console.log(`✅ ${t}: ${res.rows.length} 行 → ${path}`);
}

await client.end();
console.log(`\n完了。出力先: ${outDir}`);
