import { listThemes } from "@/lib/experiment";
import { supabaseAdmin } from "@/lib/supabase/server";
import EntryForm from "@/components/EntryForm";
import type { ExperimentConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Home() {
  const themes = await listThemes();
  const { data: cfg } = await supabaseAdmin()
    .from("experiment_config")
    .select("theme_slug, displayed_mode");
  const modeByTheme: Record<string, string> = {};
  for (const c of (cfg ?? []) as Pick<ExperimentConfig, "theme_slug" | "displayed_mode">[]) {
    modeByTheme[c.theme_slug] = c.displayed_mode;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">教育AIツール 対話パート</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          このページは、アンケート（Googleフォーム）の途中で行う「AIとの対話」のためのものです。
          フォームの案内に従って、指定されたテーマで対話してください。
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-sm leading-7">
        <p className="font-semibold">進め方</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>フォームでお伝えした「あなたのグループ（X または Y）」を選びます。</li>
          <li>フォームで指定されたテーマのカードから対話を始めます。</li>
          <li>5〜7分ほど対話したら、考えを整理してフォームに戻ってください。</li>
        </ol>
        <p className="mt-3 text-[var(--muted)]">
          ※ 回答は匿名で、研究目的にのみ使用します。氏名・メールアドレスは収集しません。
        </p>
      </section>

      <EntryForm themes={themes} modeByTheme={modeByTheme} />
    </main>
  );
}
