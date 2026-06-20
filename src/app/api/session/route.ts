import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveCondition, getTheme } from "@/lib/experiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  group: z.enum(["X", "Y"]),
  themeSlug: z.string().min(1),
  role: z.string().optional(),
  aiUsage: z.string().optional(),
  participantId: z.string().uuid().optional(),
});

/**
 * 対話セッションを開始する。
 * 群×テーマから実験条件を解決し、conversation を作成。
 * rag_enabled はサーバ側のみで保持し、クライアントには返さない（盲検維持）。
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const { group, themeSlug, role, aiUsage, participantId } = parsed.data;

  const db = supabaseAdmin();

  const [theme, condition] = await Promise.all([
    getTheme(themeSlug),
    resolveCondition(group, themeSlug),
  ]);
  if (!theme) return NextResponse.json({ error: "テーマが見つかりません" }, { status: 404 });
  if (!condition)
    return NextResponse.json({ error: "実験設定が見つかりません" }, { status: 404 });

  // 参加者（匿名）。既存があれば再利用、なければ作成。
  let pid = participantId ?? null;
  if (!pid) {
    const { data: p, error } = await db
      .from("participants")
      .insert({ group_label: group, role: role ?? null, ai_usage: aiUsage ?? null })
      .select("id")
      .single();
    if (error || !p)
      return NextResponse.json({ error: "参加者の作成に失敗しました" }, { status: 500 });
    pid = p.id as string;
  }

  const { data: conv, error: convErr } = await db
    .from("conversations")
    .insert({
      participant_id: pid,
      theme_slug: themeSlug,
      group_label: group,
      displayed_mode: condition.displayed_mode,
      dialogue_mode_key: condition.dialogue_mode_key,
      rag_enabled: condition.rag_enabled,
    })
    .select("id")
    .single();
  if (convErr || !conv)
    return NextResponse.json({ error: "会話の作成に失敗しました" }, { status: 500 });

  return NextResponse.json({
    conversationId: conv.id,
    participantId: pid,
    displayedMode: condition.displayed_mode, // 'A' | 'B'
    dialogueModeKey: condition.dialogue_mode_key,
    theme: { slug: theme.slug, title: theme.title, intro: theme.intro },
  });
}
