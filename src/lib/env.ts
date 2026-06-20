// 環境変数の集約。サーバ専用の値はクライアントに漏れないよう server modules からのみ参照する。

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。.env.local を確認してください。`);
  }
  return value;
}

// --- 公開（クライアントでも可） ---
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// --- サーバ専用 ---
export function getServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getAnthropicKey(): string {
  return required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY);
}

export const CHAT_MODEL = process.env.CHAT_MODEL ?? "claude-sonnet-4-6";

// 埋め込みプロバイダ: 'openai' | 'voyage'（次元は1024固定でスキーマと一致）
export const EMBEDDING_PROVIDER =
  (process.env.EMBEDDING_PROVIDER as "openai" | "voyage" | undefined) ?? "openai";
export const EMBEDDING_DIM = 1024;
export const OPENAI_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
export const VOYAGE_EMBEDDING_MODEL =
  process.env.VOYAGE_EMBEDDING_MODEL ?? "voyage-3.5-lite";

export function getOpenAIKey(): string {
  return required("OPENAI_API_KEY", process.env.OPENAI_API_KEY);
}
export function getVoyageKey(): string {
  return required("VOYAGE_API_KEY", process.env.VOYAGE_API_KEY);
}

// 管理画面パスワード（簡易ゲート）
export function getAdminPassword(): string {
  return required("ADMIN_PASSWORD", process.env.ADMIN_PASSWORD);
}
export const ADMIN_COOKIE = "mingaku_admin";
