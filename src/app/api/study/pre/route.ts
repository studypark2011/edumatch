import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const likert = z.number().int().min(1).max(4);
const Body = z.object({
  participantId: z.string().uuid(),
  theme: z.enum(["theme1", "theme2"]),
  answers: z.array(likert).length(4), // pre_1..4（1〜4の整数）
});

/** テーマ事前アンケート（4件法・整数1〜4で保存） */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "回答が不正です（1〜4の整数4問）" }, { status: 400 });
  }
  const { participantId, theme, answers } = parsed.data;
  const p = theme === "theme1" ? "t1" : "t2";
  const update: Record<string, number> = {};
  answers.forEach((v, i) => (update[`${p}_pre_${i + 1}`] = v));

  const { error } = await supabaseAdmin()
    .from("participants")
    .update(update)
    .eq("id", participantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
