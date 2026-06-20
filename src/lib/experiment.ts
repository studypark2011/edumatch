import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ExperimentConfig, Mode, Theme } from "@/lib/types";

/**
 * 群×テーマから実験条件（表示モードA/B・対話モード・RAG有無）を解決する。
 * これが研究のA/B制御の中核。回答者には displayed_mode（A/B）しか見せない。
 */
export async function resolveCondition(
  groupLabel: string,
  themeSlug: string,
): Promise<ExperimentConfig | null> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("experiment_config")
    .select("*")
    .eq("group_label", groupLabel)
    .eq("theme_slug", themeSlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ExperimentConfig) ?? null;
}

export async function getTheme(slug: string): Promise<Theme | null> {
  const db = supabaseAdmin();
  const { data } = await db.from("themes").select("*").eq("slug", slug).maybeSingle();
  return (data as Theme) ?? null;
}

export async function listThemes(): Promise<Theme[]> {
  const db = supabaseAdmin();
  const { data } = await db.from("themes").select("*").order("sort_order");
  return (data as Theme[]) ?? [];
}

export async function getMode(key: string): Promise<Mode | null> {
  const db = supabaseAdmin();
  const { data } = await db.from("modes").select("*").eq("key", key).maybeSingle();
  return (data as Mode) ?? null;
}

export async function listModes(): Promise<Mode[]> {
  const db = supabaseAdmin();
  const { data } = await db.from("modes").select("*").order("sort_order");
  return (data as Mode[]) ?? [];
}
