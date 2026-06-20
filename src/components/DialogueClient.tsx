"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Mode } from "@/lib/types";

type Cite = { title: string; source_url: string | null; snippet: string };
type Msg = { role: "user" | "assistant"; content: string; citations?: Cite[] };
type Session = {
  conversationId: string;
  displayedMode: string;
  dialogueModeKey: string;
  theme: { slug: string; title: string; intro: string };
};

export default function DialogueClient({
  group,
  themeSlug,
  modes,
}: {
  group: "X" | "Y";
  themeSlug: string;
  modes: Mode[];
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeMode, setActiveMode] = useState<string>("navigator");
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const [showPost, setShowPost] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [posted, setPosted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group, themeSlug }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "セッション作成に失敗しました");
        setSession(json);
        setActiveMode(json.dialogueModeKey ?? "navigator");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [group, themeSlug]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const assistantTurns = messages.filter((m) => m.role === "assistant").length;

  async function send() {
    if (!session || !input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: session.conversationId,
          message: userMsg,
          dialogueModeKey: activeMode,
        }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "応答の取得に失敗しました");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let citations: Cite[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "meta") {
            citations = evt.citations ?? [];
            if (citations.length > 0) {
              setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { ...copy[copy.length - 1], citations };
                return copy;
              });
            }
          } else if (evt.type === "delta") {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + evt.text };
              return copy;
            });
          } else if (evt.type === "error") {
            throw new Error(evt.error);
          }
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: `（エラー：${msg}）` };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  async function generateDraft() {
    if (!session) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: session.conversationId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "下書きの生成に失敗しました");
      setPostContent(json.draft ?? "");
      setAiAssisted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setDrafting(false);
    }
  }

  async function submitPost() {
    if (!session || !postContent.trim()) return;
    try {
      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: session.conversationId,
          content: postContent.trim(),
          aiAssisted,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "投稿に失敗しました");
      setPosted(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="mb-4 text-red-600">エラー：{error}</p>
        <Link href="/" className="text-[var(--primary)] underline">
          トップへ戻る
        </Link>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center text-[var(--muted)]">
        準備しています…
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-screen w-full max-w-3xl flex-col px-4 py-4">
      {/* ヘッダー */}
      <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="rounded bg-[var(--primary)] px-2 py-0.5 text-xs font-bold text-white">
            モード{session.displayedMode}
          </span>
          <span className="text-xs text-[var(--muted)]">グループ{group}</span>
        </div>
        <h1 className="text-sm font-bold leading-6">{session.theme.title}</h1>
        <p className="mt-1 text-xs leading-6 text-[var(--muted)]">{session.theme.intro}</p>

        {/* 対話スタイル切替（フルシステム機能） */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--muted)]">対話スタイル：</span>
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              title={m.description ?? ""}
              onClick={() => setActiveMode(m.key)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                activeMode === m.key
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-white hover:border-[var(--primary)]"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
        {/* 選択中スタイルの説明 */}
        {modes.find((m) => m.key === activeMode)?.description && (
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
            {modes.find((m) => m.key === activeMode)?.description}
          </p>
        )}
      </div>

      {/* メッセージ */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto rounded-xl px-1 py-2">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            このテーマについて、いま考えていることや疑問を自由に書いてみてください。
            <br />
            AIが論点を整理し、考えを深めるお手伝いをします。
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-[var(--primary)] text-white"
                  : "border border-[var(--border)] bg-[var(--card)]"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose-chat">
                  {m.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : (
                    <span className="text-[var(--muted)]">考え中…</span>
                  )}
                  {m.citations && m.citations.length > 0 && (
                    <details className="mt-2 rounded-lg bg-black/[0.03] p-2 text-xs">
                      <summary className="cursor-pointer text-[var(--muted)]">
                        参照した資料（{m.citations.length}件）
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {m.citations.map((c, j) => (
                          <li key={j}>
                            <span className="font-medium">{c.title}</span>
                            {c.source_url && (
                              <a
                                href={c.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 text-[var(--primary)] underline"
                              >
                                リンク
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 投稿の促し */}
      {assistantTurns >= 2 && !posted && !showPost && (
        <button
          type="button"
          onClick={() => setShowPost(true)}
          className="mb-2 rounded-lg border border-[var(--primary)] bg-[var(--primary)]/5 px-4 py-2 text-sm font-medium text-[var(--primary)]"
        >
          考えがまとまってきたら、意見を投稿してみませんか？
        </button>
      )}

      {/* 入力欄 */}
      {!posted && (
        <div className="flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder="メッセージを入力（Ctrl/⌘+Enterで送信）"
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            送信
          </button>
        </div>
      )}

      {/* 投稿パネル */}
      {showPost && !posted && (
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="mb-2 text-sm font-semibold">あなたの意見を投稿する</p>
          <p className="mb-2 text-xs text-[var(--muted)]">
            自分で書いても、AIに下書きを手伝ってもらっても構いません。投稿は任意です。
          </p>
          <textarea
            value={postContent}
            onChange={(e) => {
              setPostContent(e.target.value);
              setAiAssisted(false);
            }}
            rows={5}
            placeholder="このテーマについてのあなたの考えを書いてください。"
            className="w-full resize-y rounded-lg border border-[var(--border)] p-2 text-sm outline-none focus:border-[var(--primary)]"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={generateDraft}
              disabled={drafting}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40"
            >
              {drafting ? "生成中…" : "AIに下書きを手伝ってもらう"}
            </button>
            <button
              type="button"
              onClick={submitPost}
              disabled={!postContent.trim()}
              className="rounded-lg bg-[var(--primary)] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
            >
              投稿する
            </button>
            <button
              type="button"
              onClick={() => setShowPost(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-[var(--muted)]"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 投稿後 */}
      {posted && (
        <div className="mt-3 rounded-xl border border-green-300 bg-green-50 p-4 text-sm">
          <p className="font-semibold text-green-800">投稿しました。ありがとうございます。</p>
          <p className="mt-1 text-green-700">
            Googleフォームに戻り、続きの質問にお答えください。
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/board" className="text-[var(--primary)] underline">
              みんなの意見ボードを見る
            </Link>
            <Link href="/" className="text-[var(--primary)] underline">
              トップへ
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
