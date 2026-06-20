import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { anthropic } from "@/lib/anthropic";
import { CHAT_MODEL } from "@/lib/env";
import { retrieve, buildContextBlock } from "@/lib/rag";
import { getMode, getTheme } from "@/lib/experiment";
import type { Citation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  conversationId: z.string().uuid(),
  message: z.string().min(1),
  dialogueModeKey: z.string().optional(), // フルシステム：ユーザーによるモード切替
});

const BASE_PREAMBLE = `あなたは日本語で応答します。1回の応答は簡潔に（目安4〜8文）。必要に応じてMarkdownを使ってよいですが、箇条書きを乱用しません。利用者が自分で考え、自分の言葉で意見を言語化できるよう支援することが最優先です。答えや結論を一方的に押し付けないでください。`;

type Json = Record<string, unknown>;

function sse(encoder: TextEncoder, obj: Json): Uint8Array {
  return encoder.encode(JSON.stringify(obj) + "\n");
}

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "リクエストが不正です" }), { status: 400 });
  }
  const { conversationId, message, dialogueModeKey } = parsed.data;
  const db = supabaseAdmin();

  // 会話と条件をサーバ側で取得（rag_enabled はクライアントに依存しない）
  const { data: conv, error: convErr } = await db
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();
  if (convErr || !conv) {
    return new Response(JSON.stringify({ error: "会話が見つかりません" }), { status: 404 });
  }

  const activeModeKey = dialogueModeKey ?? conv.dialogue_mode_key ?? "navigator";
  const [mode, theme] = await Promise.all([
    getMode(activeModeKey),
    conv.theme_slug ? getTheme(conv.theme_slug) : Promise.resolve(null),
  ]);
  if (!mode) {
    return new Response(JSON.stringify({ error: "対話モードが見つかりません" }), { status: 404 });
  }

  // 直近の履歴を取得
  const { data: history } = await db
    .from("messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  // RAG（条件ON時のみ）
  let citations: Citation[] = [];
  if (conv.rag_enabled && theme) {
    try {
      citations = await retrieve(message, theme.rag_tag, 6);
    } catch (e) {
      console.error("RAG retrieve failed:", e);
    }
  }

  const themeContext = theme
    ? `\n\n【今回のテーマ】${theme.title}\n${theme.intro}`
    : "";
  const systemPrompt =
    BASE_PREAMBLE +
    themeContext +
    "\n\n--- モード指示 ---\n" +
    mode.system_prompt +
    (citations.length > 0 ? buildContextBlock(citations) : "");

  const apiMessages = [
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    })),
    { role: "user" as const, content: message },
  ];

  // ユーザー発言を保存
  await db.from("messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
    dialogue_mode_key: activeModeKey,
  });

  const encoder = new TextEncoder();
  let assistantText = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 引用は先に送る（RAGありの体験：根拠の明示）
        controller.enqueue(
          sse(encoder, {
            type: "meta",
            citations: citations.map((c) => ({
              title: c.title,
              source_url: c.source_url,
              snippet: c.snippet.slice(0, 160),
            })),
            dialogueModeKey: activeModeKey,
          }),
        );

        const llm = anthropic().messages.stream({
          model: CHAT_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: apiMessages,
        });

        llm.on("text", (delta) => {
          assistantText += delta;
          controller.enqueue(sse(encoder, { type: "delta", text: delta }));
        });

        await llm.finalMessage();

        // アシスタント発言を保存（引用付き）
        await db.from("messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantText,
          dialogue_mode_key: activeModeKey,
          citations: citations.length > 0 ? citations : null,
        });

        controller.enqueue(sse(encoder, { type: "done" }));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("chat error:", msg);
        controller.enqueue(sse(encoder, { type: "error", error: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
