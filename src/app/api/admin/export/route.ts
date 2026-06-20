import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '""';
  if (typeof v === "boolean") return `"${v ? 1 : 0}"`; // フラグは 0/1 で出力
  if (Array.isArray(v)) return `"${v.join(";").replace(/"/g, '""')}"`; // 複数選択は ; 区切り
  return `"${String(v).replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const head = headers.map(csvCell).join(",");
  const body = rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")).join("\n");
  return "﻿" + head + "\n" + body + "\n"; // BOM付き（Excel文字化け防止）
}

// responses.csv：1参加者=1行（選択式回答はすべて整数1〜4、群・RAGフラグ付き）
const RESPONSE_COLS = [
  "participant_code", "group_label", "consent", "role", "experience", "ai_freq",
  "t1_rag", "t2_rag", "started_at", "completed_at",
  "t1_pre_1", "t1_pre_2", "t1_pre_3", "t1_pre_4",
  "t1_post_1", "t1_post_2", "t1_post_3", "t1_post_4",
  "t1_resp_1", "t1_resp_2", "t1_resp_3", "t1_mode_1",
  "t1_turn_count", "t1_duration_sec",
  "t2_pre_1", "t2_pre_2", "t2_pre_3", "t2_pre_4",
  "t2_post_1", "t2_post_2", "t2_post_3", "t2_post_4",
  "t2_resp_1", "t2_resp_2", "t2_resp_3", "t2_mode_1",
  "t2_turn_count", "t2_duration_sec",
  "free_1", "free_2", "free_3",
];

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const type = new URL(req.url).searchParams.get("type") ?? "responses";
  const db = supabaseAdmin();

  let csv = "";
  let filename = "responses.csv";

  if (type === "responses") {
    const { data } = await db
      .from("participants")
      .select(RESPONSE_COLS.join(","))
      .order("participant_code");
    csv = toCsv((data ?? []) as unknown as Record<string, unknown>[], RESPONSE_COLS);
    filename = "responses.csv";
  } else if (type === "dialogues") {
    const { data: convs } = await db
      .from("conversations")
      .select("id, participant_id, theme_slug, group_label, rag_enabled");
    const { data: parts } = await db.from("participants").select("id, participant_code");
    const codeById = new Map((parts ?? []).map((p) => [p.id, p.participant_code]));
    const convById = new Map((convs ?? []).map((c) => [c.id, c]));
    const { data: msgs } = await db
      .from("messages")
      .select("conversation_id, role, content, created_at")
      .order("conversation_id")
      .order("created_at");
    const rows = (msgs ?? []).map((m) => {
      const c = convById.get(m.conversation_id) as
        | { participant_id: string; theme_slug: string; group_label: string; rag_enabled: boolean }
        | undefined;
      return {
        participant_code: c ? codeById.get(c.participant_id) : "",
        group: c?.group_label,
        theme_slug: c?.theme_slug,
        rag_enabled: c?.rag_enabled,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      };
    });
    csv = toCsv(rows, ["participant_code", "group", "theme_slug", "rag_enabled", "role", "content", "created_at"]);
    filename = "dialogues.csv";
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
