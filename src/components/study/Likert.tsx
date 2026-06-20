"use client";

import { LIKERT_LABELS } from "@/lib/study-content";

export function LikertGroup({
  questions,
  values,
  onChange,
}: {
  questions: string[];
  values: (number | null)[];
  onChange: (index: number, value: number) => void;
}) {
  return (
    <div className="space-y-5">
      {questions.map((q, qi) => (
        <fieldset key={qi} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <legend className="px-1 text-sm font-medium leading-6">{q}</legend>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {LIKERT_LABELS.map((label, li) => {
              const v = li + 1; // 1〜4 の整数
              const selected = values[qi] === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(qi, v)}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition ${
                    selected
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]"
                      : "border-[var(--border)] hover:border-[var(--primary)]"
                  }`}
                >
                  <span className="text-base font-bold text-[var(--primary)]">{v}</span>
                  <span className="text-[10px] leading-3 text-[var(--muted)]">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export function allAnswered(values: (number | null)[]): boolean {
  return values.every((v) => v !== null);
}
