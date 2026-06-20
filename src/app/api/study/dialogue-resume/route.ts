import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getTheme } from "@/lib/experiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ conversationId: z.string().uuid() });

/** リロード時に対話を復元する：テーマ情報と過去メッセージを返す。 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { data: conv } = await db
    .from("conversations")
    .select("theme_slug")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "会話が見つかりません" }, { status: 404 });

  const [themeRow, { data: msgs }] = await Promise.all([
    conv.theme_slug ? getTheme(conv.theme_slug) : Promise.resolve(null),
    db
      .from("messages")
      .select("role, content")
      .eq("conversation_id", parsed.data.conversationId)
      .order("created_at", { ascending: true }),
  ]);
  if (!themeRow) return NextResponse.json({ error: "テーマが見つかりません" }, { status: 404 });

  return NextResponse.json({
    theme: { slug: themeRow.slug, title: themeRow.title, intro: themeRow.intro },
    messages: (msgs ?? []).map((m) => ({ role: m.role, content: m.content })),
  });
}
