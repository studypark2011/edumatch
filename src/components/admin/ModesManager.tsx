"use client";

import { useEffect, useState } from "react";
import type { Mode } from "@/lib/types";

export default function ModesManager() {
  const [modes, setModes] = useState<Mode[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/modes");
      const json = await res.json();
      setModes(json.modes ?? []);
      setLoading(false);
    })();
  }, []);

  function update(key: string, field: keyof Mode, value: string) {
    setModes((cur) => cur.map((m) => (m.key === key ? { ...m, [field]: value } : m)));
  }

  async function save(m: Mode) {
    setSavingKey(m.key);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/modes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: m.key,
          name: m.name,
          description: m.description,
          system_prompt: m.system_prompt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗しました");
      setMsg(`「${m.name}」を保存しました。`);
    } catch (e) {
      setMsg(`エラー：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <p className="text-sm text-[var(--muted)]">読み込み中…</p>;

  return (
    <div className="space-y-6">
      {msg && <p className="text-sm">{msg}</p>}
      {modes.map((m) => (
        <div key={m.key} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <input
              value={m.name}
              onChange={(e) => update(m.key, "name", e.target.value)}
              className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm font-bold outline-none focus:border-[var(--primary)]"
            />
            <span className="text-xs text-[var(--muted)]">key: {m.key}</span>
          </div>
          <label className="mb-1 block text-xs text-[var(--muted)]">説明</label>
          <input
            value={m.description ?? ""}
            onChange={(e) => update(m.key, "description", e.target.value)}
            className="mb-3 w-full rounded-lg border border-[var(--border)] p-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <label className="mb-1 block text-xs text-[var(--muted)]">システムプロンプト</label>
          <textarea
            value={m.system_prompt}
            onChange={(e) => update(m.key, "system_prompt", e.target.value)}
            rows={10}
            className="mb-3 w-full resize-y rounded-lg border border-[var(--border)] p-2 font-mono text-xs leading-5 outline-none focus:border-[var(--primary)]"
          />
          <button
            type="button"
            onClick={() => save(m)}
            disabled={savingKey === m.key}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {savingKey === m.key ? "保存中…" : "保存"}
          </button>
        </div>
      ))}
    </div>
  );
}
