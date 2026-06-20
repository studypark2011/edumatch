"use client";

import { useState } from "react";
import {
  CONSENT_TEXT, ROLE_OPTIONS, AI_FREQ_OPTIONS, THEMES, FREE_QUESTIONS,
} from "@/lib/study-content";
import { LikertGroup, allAnswered } from "./Likert";
import ChatPanel from "./ChatPanel";

type Step =
  | "consent" | "attrs"
  | "t1_pre" | "t1_chat" | "t1_post"
  | "t2_pre" | "t2_chat" | "t2_post"
  | "free" | "done";

const ORDER: Step[] = ["consent", "attrs", "t1_pre", "t1_chat", "t1_post", "t2_pre", "t2_chat", "t2_post", "free", "done"];

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "送信に失敗しました");
  return json;
}

export default function StudyFlow() {
  const [step, setStep] = useState<Step>("consent");
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 属性
  const [role, setRole] = useState("");
  const [aiFreq, setAiFreq] = useState<number | null>(null);

  // 事前・事後（テーマごとに使い回し、遷移時にリセット）
  const [pre, setPre] = useState<(number | null)[]>([null, null, null, null]);
  const [post, setPost] = useState<(number | null)[]>([null, null, null, null]);
  const [resp, setResp] = useState<(number | null)[]>([null, null, null]);
  const [mode1, setMode1] = useState<(number | null)[]>([null]);
  const dlg = { t1: { turn: 0, dur: 0 }, t2: { turn: 0, dur: 0 } };
  const [dialogue] = useState(dlg);

  // 自由記述
  const [free, setFree] = useState(["", "", ""]);

  const progress = Math.round((ORDER.indexOf(step) / (ORDER.length - 1)) * 100);

  function guard(fn: () => Promise<void>) {
    return async () => {
      setBusy(true); setErr(null);
      try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
      finally { setBusy(false); }
    };
  }

  const startSession = guard(async () => {
    const json = await postJSON("/api/study/start", { consent: true, role, aiFreq });
    setParticipantId(json.participantId);
    setPre([null, null, null, null]);
    setStep("t1_pre");
  });

  const submitPre = (theme: "theme1" | "theme2", next: Step) => guard(async () => {
    await postJSON("/api/study/pre", { participantId, theme, answers: pre });
    setStep(next);
  });

  const submitPost = (theme: "theme1" | "theme2", next: Step) => guard(async () => {
    const d = theme === "theme1" ? dialogue.t1 : dialogue.t2;
    await postJSON("/api/study/post", {
      participantId, theme,
      post, resp, mode1: mode1[0],
      turnCount: d.turn, durationSec: d.dur,
    });
    setPre([null, null, null, null]);
    setStep(next);
  });

  const finish = guard(async () => {
    await postJSON("/api/study/finish", {
      participantId, free1: free[0], free2: free[1], free3: free[2],
    });
    setStep("done");
  });

  function onDialogueDone(theme: "t1" | "t2", turn: number, dur: number, next: Step) {
    dialogue[theme] = { turn, dur };
    setPost([null, null, null, null]); setResp([null, null, null]); setMode1([null]);
    setStep(next);
  }

  // ---------- 共通ラッパ ----------
  const Shell = ({ title, children, footer }: { title?: string; children: React.ReactNode; footer?: React.ReactNode }) => (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${progress}%` }} />
      </div>
      {title && <h1 className="mb-4 text-lg font-bold">{title}</h1>}
      {children}
      {err && <p className="mt-3 text-sm text-red-600">エラー：{err}</p>}
      {footer && <div className="mt-6">{footer}</div>}
    </main>
  );

  const NextBtn = ({ onClick, disabled, label = "次へ" }: { onClick: () => void; disabled?: boolean; label?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled || busy}
      className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-40">
      {busy ? "送信中…" : label}
    </button>
  );

  // ---------- 各ステップ ----------
  if (step === "consent") {
    return (
      <Shell title="調査へのご協力のお願い">
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm leading-7">
          {CONSENT_TEXT.map((t, i) => <p key={i}>{t}</p>)}
        </div>
        <div className="mt-6">
          <NextBtn onClick={() => setStep("attrs")} label="同意して始める" />
        </div>
      </Shell>
    );
  }

  if (step === "attrs") {
    return (
      <Shell title="あなたについて">
        <div className="space-y-5">
          <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <legend className="px-1 text-sm font-medium">お立場（1つ選択）</legend>
            <div className="mt-2 space-y-2">
              {ROLE_OPTIONS.map((r) => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    role === r ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] hover:border-[var(--primary)]"}`}>
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <legend className="px-1 text-sm font-medium">AIツール（ChatGPT等）の利用頻度</legend>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {AI_FREQ_OPTIONS.map((label, i) => {
                const v = i + 1;
                return (
                  <button key={v} type="button" onClick={() => setAiFreq(v)}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition ${
                      aiFreq === v ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]" : "border-[var(--border)] hover:border-[var(--primary)]"}`}>
                    <span className="text-base font-bold text-[var(--primary)]">{v}</span>
                    <span className="text-[10px] leading-3 text-[var(--muted)]">{label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
        <div className="mt-6">
          <NextBtn onClick={startSession} disabled={!role || aiFreq === null} />
        </div>
      </Shell>
    );
  }

  if (step === "t1_pre" || step === "t2_pre") {
    const t = step === "t1_pre" ? THEMES[0] : THEMES[1];
    const next: Step = step === "t1_pre" ? "t1_chat" : "t2_chat";
    return (
      <Shell title={`${t.label}　対話の前に`}>
        <div className="mb-5 space-y-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-7">
          <p className="font-bold">{t.title}</p>
          {t.intro.map((p, i) => <p key={i} className="text-[var(--muted)]">{p}</p>)}
        </div>
        <LikertGroup questions={t.pre} values={pre} onChange={(i, v) => setPre((a) => a.map((x, j) => (j === i ? v : x)))} />
        <div className="mt-6">
          <NextBtn onClick={submitPre(t.slug, next)} disabled={!allAnswered(pre)} label="回答して対話へ進む" />
        </div>
      </Shell>
    );
  }

  if (step === "t1_chat" || step === "t2_chat") {
    const isT1 = step === "t1_chat";
    const t = isT1 ? THEMES[0] : THEMES[1];
    return (
      <Shell title={`${t.label}　AIとの対話`}>
        <ChatPanel
          participantId={participantId!}
          theme={t.slug}
          onComplete={(turn, dur) => onDialogueDone(isT1 ? "t1" : "t2", turn, dur, isT1 ? "t1_post" : "t2_post")}
        />
      </Shell>
    );
  }

  if (step === "t1_post" || step === "t2_post") {
    const isT1 = step === "t1_post";
    const t = isT1 ? THEMES[0] : THEMES[1];
    const next: Step = isT1 ? "t2_pre" : "free";
    const ready = allAnswered(post) && allAnswered(resp) && allAnswered(mode1);
    return (
      <Shell title={`${t.label}　対話のあとに`}>
        <p className="mb-3 text-sm text-[var(--muted)]">AIと対話したうえで、いまのお気持ちをお答えください。</p>
        <LikertGroup questions={t.post} values={post} onChange={(i, v) => setPost((a) => a.map((x, j) => (j === i ? v : x)))} />
        <p className="mb-2 mt-6 text-sm font-medium">いま使ったAIについて</p>
        <LikertGroup questions={t.resp} values={resp} onChange={(i, v) => setResp((a) => a.map((x, j) => (j === i ? v : x)))} />
        <div className="mt-5">
          <LikertGroup questions={[t.mode]} values={mode1} onChange={(_, v) => setMode1([v])} />
        </div>
        <div className="mt-6">
          <NextBtn onClick={submitPost(t.slug, next)} disabled={!ready} label={isT1 ? "回答して次のテーマへ" : "回答して最後の質問へ"} />
        </div>
      </Shell>
    );
  }

  if (step === "free") {
    return (
      <Shell title="全体のふりかえり（任意）">
        <p className="mb-3 text-sm text-[var(--muted)]">最後に、全体をふりかえってお聞かせください。空欄のままでも構いません。</p>
        <div className="space-y-4">
          {FREE_QUESTIONS.map((q, i) => (
            <div key={i}>
              <label className="mb-1 block text-sm font-medium leading-6">{q}</label>
              <textarea rows={3} value={free[i]}
                onChange={(e) => setFree((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                className="w-full resize-y rounded-lg border border-[var(--border)] p-2 text-sm outline-none focus:border-[var(--primary)]" />
            </div>
          ))}
        </div>
        <div className="mt-6">
          <NextBtn onClick={finish} label="回答を送信して完了" />
        </div>
      </Shell>
    );
  }

  // done
  return (
    <Shell title="完了">
      <div className="rounded-xl border border-green-300 bg-green-50 p-6 text-center text-sm leading-7">
        <p className="text-base font-bold text-green-800">ご協力いただき、ありがとうございました。</p>
        <p className="mt-2 text-green-700">回答は記録されました。このタブは閉じていただいて構いません。</p>
      </div>
    </Shell>
  );
}
