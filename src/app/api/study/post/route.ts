import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const likert = z.number().int().min(1).max(4);
const Body = z.object({
  participantId: z.string().uuid(),
  theme: z.enum(["theme1", "theme2"]),
  post: z.array(likert).length(4), // post_1..4
  resp: z.array(likert).length(3), // resp_1..3
  mode1: likert, // mode_1
  turnCount: z.number().int().min(0).optional(),
  durationSec: z.number().int().min(0).optional(),
});

/** テーマ事後アンケート（自己効力感4＋応答評価3＋モード1。すべて整数1〜4で保存） */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "回答が不正です" }, { status: 400 });
  }
  const { participantId, theme, post, resp, mode1, turnCount, durationSec } = parsed.data;
  const p = theme === "theme1" ? "t1" : "t2";

  const update: Record<string, number> = {};
  post.forEach((v, i) => (update[`${p}_post_${i + 1}`] = v));
  resp.forEach((v, i) => (update[`${p}_resp_${i + 1}`] = v));
  update[`${p}_mode_1`] = mode1;
  if (turnCount !== undefined) update[`${p}_turn_count`] = turnCount;
  if (durationSec !== undefined) update[`${p}_duration_sec`] = durationSec;

  const { error } = await supabaseAdmin()
    .from("participants")
    .update(update)
    .eq("id", participantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
