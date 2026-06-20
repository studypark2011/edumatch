import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getTheme } from "@/lib/experiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  participantId: z.string().uuid(),
  theme: z.enum(["theme1", "theme2"]),
});

/**
 * テーマの対話を開始する。参加者に記録済みの t{n}_rag に基づき会話を作成。
 * 対話モードは navigator 固定。RAG有無はクライアントに返さない（盲検維持）。
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const { participantId, theme } = parsed.data;
  const db = supabaseAdmin();

  const { data: p } = await db
    .from("participants")
    .select("group_label, t1_rag, t2_rag")
    .eq("id", participantId)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: "参加者が見つかりません" }, { status: 404 });

  const ragEnabled = theme === "theme1" ? p.t1_rag : p.t2_rag;
  const themeRow = await getTheme(theme);
  if (!themeRow) return NextResponse.json({ error: "テーマが見つかりません" }, { status: 404 });

  const { data: conv, error } = await db
    .from("conversations")
    .insert({
      participant_id: participantId,
      theme_slug: theme,
      group_label: p.group_label,
      displayed_mode: null,
      dialogue_mode_key: "navigator",
      rag_enabled: ragEnabled,
    })
    .select("id")
    .single();
  if (error || !conv) {
    return NextResponse.json({ error: "会話の作成に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({
    conversationId: conv.id,
    theme: { slug: themeRow.slug, title: themeRow.title, intro: themeRow.intro },
  });
}
