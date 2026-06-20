// 研究データ（会話・メッセージ・参加者）だけを全削除するリセットスクリプト。
// テーマ・モード・実験設定・登録文書は残す。パイロット試行後のリセットにも使える。
//   node scripts/db-reset-data.mjs
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
await client.query("truncate table messages, conversations, participants restart identity cascade;");
// 参加者コード採番をP001から再開
await client.query("alter sequence if exists participant_seq restart with 1;");
console.log("研究データ（会話・メッセージ・参加者）を削除し、参加者コードをP001から再開します。テーマ/モード/実験設定/文書は保持。");
await client.end();
