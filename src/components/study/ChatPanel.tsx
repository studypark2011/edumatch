"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MIN_USER_TURNS } from "@/lib/study-content";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPanel({
  participantId,
  theme,
  onComplete,
}: {
  participantId: string;
  theme: "theme1" | "theme2";
  onComplete: (turnCount: number, durationSec: number) => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [themeInfo, setThemeInfo] = useState<{ title: string; intro: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  const userTurns = messages.filter((m) => m.role === "user").length;
  const canProceed = userTurns >= MIN_USER_TURNS && !streaming;

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startTimeRef.current = Date.now();
    (async () => {
      try {
        const res = await fetch("/api/study/dialogue-start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId, theme }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "対話の開始に失敗しました");
        setConversationId(json.conversationId);
        setThemeInfo(json.theme);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [participantId, theme]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    if (!conversationId || !input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: userMsg }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "応答の取得に失敗しました");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);
          if (evt.type === "delta") {
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

  function finish() {
    const durationSec = Math.max(0, Math.floor((Date.now() - startTimeRef.current) / 1000));
    onComplete(userTurns, durationSec);
  }

  if (error) {
    return <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">エラー：{error}</p>;
  }
  if (!conversationId || !themeInfo) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">準備しています…</p>;
  }

  return (
    <div className="flex flex-col">
      <div className="mb-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded bg-[var(--primary)] px-2 py-0.5 text-xs font-bold text-white">
            ナビゲーターモード
          </span>
        </div>
        <h2 className="text-sm font-bold leading-6">{themeInfo.title}</h2>
        <p className="mt-1 text-xs leading-6 text-[var(--muted)]">{themeInfo.intro}</p>
        <p className="mt-2 border-t border-[var(--border)] pt-2 text-xs leading-5 text-[var(--muted)]">
          このテーマについて、いま考えていることや疑問を自由に書いてみてください。AIが論点を整理し、考えを深めるお手伝いをします。
        </p>
      </div>

      <div
        ref={scrollRef}
        className="h-[46vh] space-y-4 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-3"
      >
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            まずはメッセージを送ってみましょう。
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user" ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-[var(--card)]"
              }`}
            >
              {m.role === "assistant" ? (
                <div className="prose-chat">
                  {m.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  ) : (
                    <span className="text-[var(--muted)]">考え中…</span>
                  )}
                </div>
              ) : (
                m.content
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2">
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

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[var(--muted)]">
          {canProceed
            ? "十分に対話できました。次に進めます。"
            : `あと ${Math.max(0, MIN_USER_TURNS - userTurns)} 回ほどやりとりしてから次に進めます`}
        </span>
        <button
          type="button"
          onClick={finish}
          disabled={!canProceed}
          className="rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          対話を終えて次へ
        </button>
      </div>
    </div>
  );
}
