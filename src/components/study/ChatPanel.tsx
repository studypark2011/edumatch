"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MIN_USER_TURNS, DIALOGUE_GUIDE, OPENING_MESSAGE } from "@/lib/study-content";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPanel({
  participantId,
  theme,
  resumeConversationId,
  resumeStartMs,
  onReady,
  onComplete,
}: {
  participantId: string;
  theme: "theme1" | "theme2";
  resumeConversationId?: string | null;
  resumeStartMs?: number | null;
  onReady?: (conversationId: string, startMs: number) => void;
  onComplete: (turnCount: number, durationSec: number) => void;
}) {
  const [conversationId, setConversationId] = useState<string | null>(resumeConversationId ?? null);
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

  // 新規に会話を作成（メッセージは変更しない）。会話ID/テーマ/開始時刻を確定し、親に通知。
  const createConversation = useCallback(async (): Promise<string> => {
    const res = await fetch("/api/study/dialogue-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, theme }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "対話の開始に失敗しました");
    if (!startTimeRef.current) startTimeRef.current = Date.now();
    setConversationId(json.conversationId);
    setThemeInfo((t) => t ?? json.theme);
    onReady?.(json.conversationId, startTimeRef.current);
    return json.conversationId;
  }, [participantId, theme, onReady]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        if (resumeConversationId) {
          // リロード復元：既存の会話とメッセージを読み込む
          startTimeRef.current = resumeStartMs ?? Date.now();
          const res = await fetch("/api/study/dialogue-resume", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: resumeConversationId }),
          });
          if (res.ok) {
            const json = await res.json();
            setConversationId(resumeConversationId);
            setThemeInfo(json.theme);
            setMessages([{ role: "assistant", content: OPENING_MESSAGE }, ...(json.messages ?? [])]);
            return;
          }
          // 復元先の会話が見つからない（古い保存データ等）→ 新規に作り直す
        } else {
          startTimeRef.current = Date.now();
        }
        await createConversation();
        // AIの最初のメッセージ（呼び水）。クライアント表示のみで、LLM履歴やログには含めない。
        setMessages([{ role: "assistant", content: OPENING_MESSAGE }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [resumeConversationId, resumeStartMs, createConversation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function send() {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const chat = (cid: string) =>
        fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: cid, message: userMsg }),
        });

      let cid = conversationId ?? (await createConversation());
      let res = await chat(cid);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        // 会話が見つからない（古いID等）→ 会話を作り直して一度だけ再送
        if (typeof j.error === "string" && j.error.includes("会話が見つかりません")) {
          cid = await createConversation();
          res = await chat(cid);
          if (!res.ok) {
            const j2 = await res.json().catch(() => ({}));
            throw new Error(j2.error ?? "応答の取得に失敗しました");
          }
        } else {
          throw new Error(j.error ?? "応答の取得に失敗しました");
        }
      }
      if (!res.body) throw new Error("応答の取得に失敗しました");
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
        <p className="mt-2 text-xs font-medium leading-6 text-[var(--foreground)]">{DIALOGUE_GUIDE}</p>
      </div>

      <div
        ref={scrollRef}
        className="h-[34vh] space-y-4 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 sm:h-[46vh]"
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

      {/* 入力＋次へ：画面下に固定して、スマホでも常に見えるように */}
      <div className="sticky bottom-0 z-10 mt-2 bg-[var(--background)] pb-2 pt-2">
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
            placeholder="メッセージを入力…"
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

        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-[var(--muted)]">
            {canProceed
              ? "十分に対話できました。納得いくまで続けても、次に進んでも構いません。"
              : `あと ${Math.max(0, MIN_USER_TURNS - userTurns)} 回ほどやりとりしてから次に進めます`}
          </span>
          <button
            type="button"
            onClick={finish}
            disabled={!canProceed}
            className="w-full shrink-0 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-white disabled:opacity-40 sm:w-auto"
          >
            対話を終えて次へ
          </button>
        </div>
      </div>
    </div>
  );
}
