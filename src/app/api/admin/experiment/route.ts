import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PutBody = z.object({
  id: z.string().uuid(),
  displayed_mode: z.string().min(1),
  dialogue_mode_key: z.string().min(1),
  rag_enabled: z.boolean(),
});

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin()
    .from("experiment_config")
    .select("*")
    .order("theme_slug")
    .order("group_label");
  return NextResponse.json({ config: data ?? [] });
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = PutBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  const { id, ...rest } = parsed.data;
  const { error } = await supabaseAdmin().from("experiment_config").update(rest).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
