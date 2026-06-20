// Supabase の Postgres にマイグレーションとseedを適用するスクリプト。
// 接続文字列は .env.local の SUPABASE_DB_URL、または第1引数で渡す。
//
// 使い方:
//   node scripts/db-setup.mjs
//   node scripts/db-setup.mjs "postgresql://postgres:....@db.xxxx.supabase.co:5432/postgres"

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import "dotenv/config";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const connectionString = process.argv[2] || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error(
    "接続文字列がありません。.env.local に SUPABASE_DB_URL を設定するか、引数で渡してください。",
  );
  process.exit(1);
}

const files = [
  join(root, "supabase", "migrations", "0001_init.sql"),
  join(root, "supabase", "seed.sql"),
];

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("接続しました。");
  for (const file of files) {
    const sql = readFileSync(file, "utf8");
    console.log(`\n▶ 適用中: ${file}`);
    await client.query(sql);
    console.log("  ✅ 完了");
  }
  console.log("\nすべて適用しました。");
} catch (e) {
  console.error("\n❌ エラー:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
