import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/server";
import { listThemes } from "@/lib/experiment";

export const dynamic = "force-dynamic";

type Post = {
  id: string;
  theme_slug: string | null;
  content: string;
  ai_assisted: boolean;
  created_at: string;
};

export default async function BoardPage() {
  const [themes, { data: posts }] = await Promise.all([
    listThemes(),
    supabaseAdmin()
      .from("posts")
      .select("id, theme_slug, content, ai_assisted, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const byTheme: Record<string, Post[]> = {};
  for (const p of (posts ?? []) as Post[]) {
    const key = p.theme_slug ?? "other";
    (byTheme[key] ??= []).push(p);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">みんなの意見ボード</h1>
        <Link href="/" className="text-sm text-[var(--primary)] underline">
          トップへ
        </Link>
      </header>

      {themes.map((t) => {
        const items = byTheme[t.slug] ?? [];
        return (
          <section key={t.slug} className="mb-8">
            <h2 className="mb-3 border-b border-[var(--border)] pb-1 font-bold">{t.title}</h2>
            {items.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">まだ投稿はありません。</p>
            ) : (
              <ul className="space-y-3">
                {items.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm leading-7"
                  >
                    <p className="whitespace-pre-wrap">{p.content}</p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {new Date(p.created_at).toLocaleString("ja-JP")}
                      {p.ai_assisted && " ・AI下書きを利用"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </main>
  );
}
