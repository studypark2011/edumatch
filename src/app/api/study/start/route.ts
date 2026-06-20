import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveCondition } from "@/lib/experiment";
import { ROLE_OPTIONS, EXPERIENCE_OPTIONS } from "@/lib/study-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  consent: z.literal(true),
  role: z.array(z.enum(ROLE_OPTIONS as [string, ...string[]])).min(1), // 立場（複数選択可）
  experience: z.enum(EXPERIENCE_OPTIONS as [string, ...string[]]), // 経験年数（単一）
  aiFreq: z.number().int().min(1).max(4),
});

/**
 * 同意＋属性入力でセッション（参加者）を開始する。
 * 群は採番シーケンスの偶奇で X/Y を交互に自動割当（カウンターバランス）。
 * 群×テーマから各テーマのRAG有無を導出し、t1_rag / t2_rag に必ず記録する。
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "同意と属性の入力が必要です" }, { status: 400 });
  }
  const db = supabaseAdmin();

  const { data: seqVal, error: seqErr } = await db.rpc("next_participant_seq");
  if (seqErr) return NextResponse.json({ error: seqErr.message }, { status: 500 });
  const seq = Number(seqVal);
  const code = "P" + String(seq).padStart(3, "0");
  const group: "X" | "Y" = seq % 2 === 1 ? "X" : "Y";

  const [t1, t2] = await Promise.all([
    resolveCondition(group, "theme1"),
    resolveCondition(group, "theme2"),
  ]);
  if (!t1 || !t2) {
    return NextResponse.json({ error: "実験設定が見つかりません" }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: p, error } = await db
    .from("participants")
    .insert({
      participant_code: code,
      group_label: group,
      consent: true,
      consent_at: now,
      started_at: now,
      role: parsed.data.role,
      experience: parsed.data.experience,
      ai_freq: parsed.data.aiFreq,
      t1_rag: t1.rag_enabled,
      t2_rag: t2.rag_enabled,
    })
    .select("id")
    .single();
  if (error || !p) {
    return NextResponse.json({ error: "セッション作成に失敗しました" }, { status: 500 });
  }

  // group / rag フラグはクライアントに返さない（盲検維持）
  return NextResponse.json({ participantId: p.id, code });
}
