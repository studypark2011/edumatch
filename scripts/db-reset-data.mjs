// 研究データ（会話・メッセージ・参加者・投稿）だけを全削除するリセットスクリプト。
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
// 依存順に削除（messages/posts は参照先。truncate cascade で一括）
await client.query("truncate table messages, posts, conversations, participants restart identity cascade;");
console.log("研究データ（会話・メッセージ・参加者・投稿）を削除しました。テーマ/モード/実験設定/文書は保持。");
await client.end();
