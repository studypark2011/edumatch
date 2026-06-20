"use client";

import { useEffect, useState } from "react";
import type { ExperimentConfig, Mode } from "@/lib/types";

export default function ExperimentManager() {
  const [rows, setRows] = useState<ExperimentConfig[]>([]);
  const [modes, setModes] = useState<Mode[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [c, m] = await Promise.all([
        fetch("/api/admin/experiment").then((r) => r.json()),
        fetch("/api/admin/modes").then((r) => r.json()),
      ]);
      setRows(c.config ?? []);
      setModes(m.modes ?? []);
      setLoading(false);
    })();
  }, []);

  function update(id: string, field: keyof ExperimentConfig, value: string | boolean) {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function save(r: ExperimentConfig) {
    setSavingId(r.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/experiment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: r.id,
          displayed_mode: r.displayed_mode,
          dialogue_mode_key: r.dialogue_mode_key,
          rag_enabled: r.rag_enabled,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      setMsg("保存しました。");
    } catch (e) {
      setMsg(`エラー：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">読み込み中…</p>;

  return (
    <div className="space-y-3">
      {msg && <p className="text-sm">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--muted)]">
              <th className="py-2 pr-3">テーマ</th>
              <th className="py-2 pr-3">群</th>
              <th className="py-2 pr-3">表示モード</th>
              <th className="py-2 pr-3">対話スタイル</th>
              <th className="py-2 pr-3">RAG</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--border)]">
                <td className="py-2 pr-3">{r.theme_slug}</td>
                <td className="py-2 pr-3">{r.group_label}</td>
                <td className="py-2 pr-3">
                  <select
                    value={r.displayed_mode}
                    onChange={(e) => update(r.id, "displayed_mode", e.target.value)}
                    className="rounded border border-[var(--border)] px-2 py-1"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <select
                    value={r.dialogue_mode_key}
                    onChange={(e) => update(r.id, "dialogue_mode_key", e.target.value)}
                    className="rounded border border-[var(--border)] px-2 py-1"
                  >
                    {modes.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-3">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={r.rag_enabled}
                      onChange={(e) => update(r.id, "rag_enabled", e.target.checked)}
                    />
                    {r.rag_enabled ? "あり" : "なし"}
                  </label>
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => save(r)}
                    disabled={savingId === r.id}
                    className="rounded-lg bg-[var(--primary)] px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {savingId === r.id ? "保存中…" : "保存"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
