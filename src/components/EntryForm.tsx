"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Theme } from "@/lib/types";

export default function EntryForm({
  themes,
  modeByTheme,
}: {
  themes: Theme[];
  modeByTheme: Record<string, string>;
}) {
  const router = useRouter();
  const [group, setGroup] = useState<"X" | "Y" | "">("");

  return (
    <section>
      <div className="mb-6">
        <p className="mb-2 font-semibold">あなたのグループ</p>
        <div className="flex gap-3">
          {(["X", "Y"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`rounded-lg border px-6 py-2 text-sm font-medium transition ${
                group === g
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]"
              }`}
            >
              グループ{g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {themes.map((t) => {
          const mode = modeByTheme[t.slug];
          return (
            <div
              key={t.slug}
              className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-5"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-[var(--primary)]/10 px-2 py-0.5 text-xs font-bold text-[var(--primary)]">
                  {t.slug === "theme1" ? "テーマ1" : "テーマ2"}
                </span>
                {mode && (
                  <span className="rounded border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    モード{mode}
                  </span>
                )}
              </div>
              <h3 className="mb-3 font-bold leading-6">{t.title}</h3>
              <p className="mb-4 flex-1 text-xs leading-6 text-[var(--muted)]">{t.intro}</p>
              <button
                type="button"
                disabled={!group}
                onClick={() => router.push(`/dialogue?group=${group}&theme=${t.slug}`)}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {group ? "このテーマで対話を始める" : "先にグループを選んでください"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
