import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const head = headers.map(csvCell).join(",");
  const body = rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")).join("\n");
  // BOM 付きで Excel の文字化けを防ぐ
  return "﻿" + head + "\n" + body + "\n";
}

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "messages";
  const db = supabaseAdmin();

  let csv = "";
  let filename = "export.csv";

  if (type === "messages") {
    const { data: convs } = await db.from("conversations").select("*");
    const convMap = new Map((convs ?? []).map((c) => [c.id, c]));
    const { data: msgs } = await db
      .from("messages")
      .select("*")
      .order("conversation_id")
      .order("created_at");
    const rows = (msgs ?? []).map((m) => {
      const c = convMap.get(m.conversation_id) ?? {};
      return {
        conversation_id: m.conversation_id,
        participant_id: c.participant_id,
        group: c.group_label,
        theme_slug: c.theme_slug,
        displayed_mode: c.displayed_mode,
        rag_enabled: c.rag_enabled,
        msg_role: m.role,
        msg_dialogue_mode: m.dialogue_mode_key,
        content: m.content,
        has_citations: m.citations ? "yes" : "no",
        created_at: m.created_at,
      };
    });
    csv = toCsv(rows, [
      "conversation_id",
      "participant_id",
      "group",
      "theme_slug",
      "displayed_mode",
      "rag_enabled",
      "msg_role",
      "msg_dialogue_mode",
      "content",
      "has_citations",
      "created_at",
    ]);
    filename = "messages.csv";
  } else if (type === "conversations") {
    const { data } = await db.from("conversations").select("*").order("created_at");
    csv = toCsv((data ?? []) as Record<string, unknown>[], [
      "id",
      "participant_id",
      "group_label",
      "theme_slug",
      "displayed_mode",
      "dialogue_mode_key",
      "rag_enabled",
      "created_at",
    ]);
    filename = "conversations.csv";
  } else if (type === "posts") {
    const { data } = await db.from("posts").select("*").order("created_at");
    csv = toCsv((data ?? []) as Record<string, unknown>[], [
      "id",
      "conversation_id",
      "theme_slug",
      "participant_id",
      "content",
      "ai_assisted",
      "created_at",
    ]);
    filename = "posts.csv";
  } else {
    return NextResponse.json({ error: "type が不正です" }, { status: 400 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
