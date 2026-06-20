import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, getServiceRoleKey } from "@/lib/env";

let _client: SupabaseClient | null = null;

/**
 * サーバ専用の Supabase クライアント（service role）。
 * RLS をバイパスするため、必ずサーバ側コード（API route / server component）からのみ使用すること。
 */
export function supabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
