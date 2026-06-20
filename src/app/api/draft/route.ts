import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";
import { CHAT_MODEL } from "@/lib/env";
import { getTheme } from "@/lib/experiment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ conversationId: z.string().uuid() });

/**
 * 対話を踏まえて、利用者本人の意見草案（一人称）を生成する。
 * 「考えはあるが言語化に自信がない」利用者の投稿を支援する導線（論文3.4）。
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: conv } = await db
    .from("conversations")
    .select("theme_slug")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: "会話が見つかりません" }, { status: 404 });

  const [{ data: msgs }, theme] = await Promise.all([
    db
      .from("messages")
      .select("role, content")
      .eq("conversation_id", parsed.data.conversationId)
      .order("created_at", { ascending: true }),
    conv.theme_slug ? getTheme(conv.theme_slug) : Promise.resolve(null),
  ]);

  const transcript = (msgs ?? [])
    .map((m) => `${m.role === "user" ? "利用者" : "AI"}: ${m.content}`)
    .join("\n");

  const res = await anthropic().messages.create({
    model: CHAT_MODEL,
    max_tokens: 600,
    system:
      "あなたは利用者の意見表明を支援するアシスタントです。以下のAIとの対話 log を読み、利用者本人が一人称（です・ます調）で書いた意見文の草案を作成してください。利用者がまだ述べていない立場を勝手に作り出さず、対話の中で利用者が示した考え・迷い・根拠だけを丁寧に言語化します。200〜400字程度。前置きや説明は不要で、意見文本体のみを出力してください。",
    messages: [
      {
        role: "user",
        content: `テーマ：${theme?.title ?? ""}\n\n--- 対話ログ ---\n${transcript}\n\n上記を踏まえ、利用者本人の意見文の草案を書いてください。`,
      },
    ],
  });

  const draft = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");

  return NextResponse.json({ draft });
}
