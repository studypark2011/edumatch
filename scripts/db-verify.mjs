// 初期データの投入確認用。node scripts/db-verify.mjs
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
for (const [label, q] of [
  ["themes", "select slug, title from themes order by sort_order"],
  ["modes", "select key, name from modes order by sort_order"],
  ["experiment_config", "select theme_slug, group_label, displayed_mode, rag_enabled from experiment_config order by theme_slug, group_label"],
]) {
  const { rows } = await client.query(q);
  console.log(`\n=== ${label} (${rows.length}) ===`);
  console.table(rows);
}
await client.end();
