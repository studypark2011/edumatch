"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentRow } from "@/lib/types";

const TAG_OPTIONS = [
  { key: "theme1", label: "テーマ1（生成AIの年齢）" },
  { key: "theme2", label: "テーマ2（校則）" },
  { key: "common", label: "共通" },
];

export default function DocumentsManager() {
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>(["theme1"]);
  const [sourceType, setSourceType] = useState<"url" | "text">("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/documents");
    const json = await res.json();
    setDocs(json.documents ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleTag(t: string) {
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          tags,
          sourceType,
          sourceUrl: sourceType === "url" ? sourceUrl : null,
          content: sourceType === "text" ? content : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "登録に失敗しました");
      setTitle("");
      setSourceUrl("");
      setContent("");
      setMsg("登録しました。");
      await load();
    } catch (e) {
      setMsg(`エラー：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("この文書を削除しますか？（チャンクも削除されます）")) return;
    await fetch(`/api/admin/documents?id=${id}`, { method: "DELETE" });
    await load();
  }

  const statusLabel: Record<string, string> = {
    pending: "待機",
    processing: "処理中",
    ready: "✅ 利用可",
    error: "⚠️ エラー",
  };

  return (
    <div className="space-y-8">
      {/* 追加フォーム */}
      <form onSubmit={add} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-3 font-bold">文書を追加</h2>
        <label className="mb-1 block text-xs text-[var(--muted)]">タイトル</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="例：小学校学習指導要領（総則）"
          className="mb-3 w-full rounded-lg border border-[var(--border)] p-2 text-sm outline-none focus:border-[var(--primary)]"
        />

        <label className="mb-1 block text-xs text-[var(--muted)]">タグ（どのテーマで参照するか）</label>
        <div className="mb-3 flex flex-wrap gap-2">
          {TAG_OPTIONS.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => toggleTag(t.key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                tags.includes(t.key)
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-3 flex gap-2 text-sm">
          {(["url", "text"] as const).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setSourceType(s)}
              className={`rounded-lg border px-3 py-1.5 ${
                sourceType === s ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)]"
              }`}
            >
              {s === "url" ? "URLから取得" : "テキスト貼り付け"}
            </button>
          ))}
        </div>

        {sourceType === "url" ? (
          <input
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://… （PDF / HTML）"
            className="mb-3 w-full rounded-lg border border-[var(--border)] p-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="文書の本文を貼り付け"
            className="mb-3 w-full resize-y rounded-lg border border-[var(--border)] p-2 text-sm outline-none focus:border-[var(--primary)]"
          />
        )}

        <button
          type="submit"
          disabled={busy || tags.length === 0}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "登録中（埋め込み生成）…" : "登録する"}
        </button>
        {msg && <p className="mt-2 text-xs">{msg}</p>}
      </form>

      {/* 一覧 */}
      <div>
        <h2 className="mb-3 font-bold">登録済み文書（図1相当）</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">読み込み中…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">まだ文書がありません。</p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{d.title}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <span>{statusLabel[d.status] ?? d.status}</span>
                    <span>・{d.chunk_count} チャンク</span>
                    {d.tags.map((t) => (
                      <span key={t} className="rounded bg-black/5 px-1.5">
                        {t}
                      </span>
                    ))}
                  </div>
                  {d.error && <div className="mt-1 text-xs text-red-600">{d.error}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-red-600"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
