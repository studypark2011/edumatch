import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  aiAssisted: z.boolean().optional(),
});

/** 形成した意見を「表明」として保存（対話→公開ボードへの橋渡し） */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: conv } = await db
    .from("conversations")
    .select("theme_slug, participant_id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "会話が見つかりません" }, { status: 404 });

  const { data: post, error } = await db
    .from("posts")
    .insert({
      conversation_id: parsed.data.conversationId,
      theme_slug: conv.theme_slug,
      participant_id: conv.participant_id,
      content: parsed.data.content,
      ai_assisted: parsed.data.aiAssisted ?? false,
    })
    .select("id")
    .single();
  if (error || !post)
    return NextResponse.json({ error: "投稿に失敗しました" }, { status: 500 });

  return NextResponse.json({ id: post.id });
}
