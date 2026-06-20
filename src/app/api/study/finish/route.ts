import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  participantId: z.string().uuid(),
  free1: z.string().max(4000).optional(),
  free2: z.string().max(4000).optional(),
  free3: z.string().max(4000).optional(),
});

/** 自由記述を保存し、セッションを完了（completed_at を記録） */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const { participantId, free1, free2, free3 } = parsed.data;

  const { error } = await supabaseAdmin()
    .from("participants")
    .update({
      free_1: free1 ?? null,
      free_2: free2 ?? null,
      free_3: free3 ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", participantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
