"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONSENT_TEXT, ROLE_OPTIONS, EXPERIENCE_OPTIONS, AI_FREQ_OPTIONS, THEMES, FREE_QUESTIONS,
  ORIENTATION_STEPS, PRE_NOTE,
} from "@/lib/study-content";
import { LikertGroup, allAnswered } from "./Likert";
import ChatPanel from "./ChatPanel";

const STORAGE_KEY = "edumatch_study_v1";

type Step =
  | "consent" | "attrs" | "intro"
  | "t1_pre" | "t1_chat" | "t1_post"
  | "t2_pre" | "t2_chat" | "t2_post"
  | "free" | "done";

const ORDER: Step[] = ["consent", "attrs", "intro", "t1_pre", "t1_chat", "t1_post", "t2_pre", "t2_chat", "t2_post", "free", "done"];

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
  const [role, setRole] = useState<string[]>([]); // 立場（複数選択可）
  const [experience, setExperience] = useState(""); // 経験年数（単一）
  const [aiFreq, setAiFreq] = useState<number | null>(null);

  // 事前・事後（テーマごとに使い回し、遷移時にリセット）
  const [pre, setPre] = useState<(number | null)[]>([null, null, null, null]);
  const [post, setPost] = useState<(number | null)[]>([null, null, null, null]);
  const [resp, setResp] = useState<(number | null)[]>([null, null, null]);
  const [mode1, setMode1] = useState<(number | null)[]>([null]);

  // リロード復元用：各テーマの会話ID・対話開始時刻・対話結果（往復数/所要秒）
  const [conv, setConv] = useState<{ t1: string | null; t2: string | null }>({ t1: null, t2: null });
  const [dlgStart, setDlgStart] = useState<{ t1: number | null; t2: number | null }>({ t1: null, t2: null });
  const [dialogue, setDialogue] = useState<{ t1: { turn: number; dur: number }; t2: { turn: number; dur: number } }>({
    t1: { turn: 0, dur: 0 }, t2: { turn: 0, dur: 0 },
  });

  // 自由記述
  const [free, setFree] = useState(["", "", ""]);

  // ---- セッション永続化（リロードしても途中から再開） ----
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.participantId && s.step && s.step !== "done") {
        setParticipantId(s.participantId);
        setStep(s.step);
        if (s.conv) setConv(s.conv);
        if (s.dlgStart) setDlgStart(s.dlgStart);
        if (s.dialogue) setDialogue(s.dialogue);
      }
    } catch {
      /* 破損データは無視 */
    }
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    if (!participantId || step === "done") {
      if (step === "done") localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ participantId, step, conv, dlgStart, dialogue }));
  }, [participantId, step, conv, dlgStart, dialogue]);

  const onChatReady = useCallback(
    (theme: "t1" | "t2") => (conversationId: string, startMs: number) => {
      setConv((c) => ({ ...c, [theme]: conversationId }));
      setDlgStart((s) => ({ ...s, [theme]: startMs }));
    },
    [],
  );

  const resetAll = useCallback(() => {
    if (!confirm("最初からやり直しますか？ これまでの回答（このセッション）は破棄されます。")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }, []);

  const progress = Math.round((ORDER.indexOf(step) / (ORDER.length - 1)) * 100);

  function guard(fn: () => Promise<void>) {
    return async () => {
      setBusy(true); setErr(null);
      try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
      finally { setBusy(false); }
    };
  }

  const startSession = guard(async () => {
    const json = await postJSON("/api/study/start", { consent: true, role, experience, aiFreq });
    setParticipantId(json.participantId);
    setStep("intro");
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
    setDialogue((d) => ({ ...d, [theme]: { turn, dur } }));
    setPost([null, null, null, null]); setResp([null, null, null]); setMode1([null]);
    setStep(next);
  }

  // ---------- 共通ラッパ（useCallbackで識別子を安定させ、再レンダー時の再マウント＝入力フォーカス喪失を防ぐ） ----------
  const showReset = step !== "consent" && step !== "done";
  const Shell = useCallback(
    ({ title, children, footer }: { title?: string; children: React.ReactNode; footer?: React.ReactNode }) => (
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full bg-[var(--primary)] transition-all" style={{ width: `${progress}%` }} />
        </div>
        {title && <h1 className="mb-4 text-lg font-bold">{title}</h1>}
        {children}
        {err && <p className="mt-3 text-sm text-red-600">エラー：{err}</p>}
        {footer && <div className="mt-6">{footer}</div>}
        {showReset && (
          <div className="mt-8 text-center">
            <button type="button" onClick={resetAll} className="text-xs text-[var(--muted)] underline">
              最初からやり直す
            </button>
          </div>
        )}
      </main>
    ),
    [progress, err, showReset, resetAll],
  );

  const NextBtn = useCallback(
    ({ onClick, disabled, label = "次へ" }: { onClick: () => void; disabled?: boolean; label?: string }) => (
      <button type="button" onClick={onClick} disabled={disabled || busy}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 text-sm font-medium text-white disabled:opacity-40">
        {busy ? "送信中…" : label}
      </button>
    ),
    [busy],
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
            <legend className="px-1 text-sm font-medium">お立場（当てはまるものをすべてお選びください）</legend>
            <div className="mt-2 space-y-2">
              {ROLE_OPTIONS.map((r) => {
                const checked = role.includes(r);
                return (
                  <button key={r} type="button"
                    onClick={() => setRole((cur) => (checked ? cur.filter((x) => x !== r) : [...cur, r]))}
                    aria-pressed={checked}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                      checked ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] hover:border-[var(--primary)]"}`}>
                    <span className={`flex h-4 w-4 flex-none items-center justify-center rounded border text-[10px] ${
                      checked ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--muted)]"}`}>
                      {checked ? "✓" : ""}
                    </span>
                    {r}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <legend className="px-1 text-sm font-medium">教育に関わる仕事の経験年数（1つ選択）</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {EXPERIENCE_OPTIONS.map((e) => (
                <button key={e} type="button" onClick={() => setExperience(e)}
                  className={`rounded-lg border px-2 py-2 text-center text-sm transition ${
                    experience === e ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]" : "border-[var(--border)] hover:border-[var(--primary)]"}`}>
                  {e}
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
          <NextBtn onClick={startSession} disabled={role.length === 0 || !experience || aiFreq === null} />
        </div>
      </Shell>
    );
  }

  if (step === "intro") {
    return (
      <Shell title="これから始めます">
        <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm leading-7">
          <p>教育に関する2つのテーマについて考えていただきます。各テーマは次の順で進みます。</p>
          <ol className="space-y-1">
            {ORIENTATION_STEPS.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-bold text-[var(--primary)]">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="text-[var(--muted)]">
            所要時間は全体で20〜30分です。正解・不正解はありません。あなたご自身の率直なお考えをお聞かせください。
          </p>
          <p className="rounded-lg bg-[var(--primary)]/5 px-3 py-2 text-xs leading-6 text-[var(--foreground)]">
            ※ この調査は<strong>前の画面に戻れない一方向</strong>の流れです。各画面で「次へ」を押すと回答が確定し、前の回答は変更できません。ご回答を確認してからお進みください。
          </p>
        </div>
        <div className="mt-6">
          <NextBtn onClick={() => { setPre([null, null, null, null]); setStep("t1_pre"); }} label="始める" />
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
        <p className="mb-3 text-xs text-[var(--muted)]">{PRE_NOTE}</p>
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
          resumeConversationId={isT1 ? conv.t1 : conv.t2}
          resumeStartMs={isT1 ? dlgStart.t1 : dlgStart.t2}
          onReady={onChatReady(isT1 ? "t1" : "t2")}
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
