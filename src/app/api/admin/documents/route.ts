import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ingestDocument } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PostBody = z.object({
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
  sourceType: z.enum(["url", "file", "text"]),
  sourceUrl: z.string().url().optional().nullable(),
  content: z.string().optional().nullable(),
});

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabaseAdmin()
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });

  try {
    const id = await ingestDocument({
      title: parsed.data.title,
      tags: parsed.data.tags,
      sourceType: parsed.data.sourceType,
      sourceUrl: parsed.data.sourceUrl,
      content: parsed.data.content,
    });
    return NextResponse.json({ id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  const { error } = await supabaseAdmin().from("documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
