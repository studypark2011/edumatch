import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import LogoutButton from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

async function count(table: string): Promise<number> {
  const { count } = await supabaseAdmin().from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function AdminHome() {
  await requireAdmin();
  const [docs, convs, msgs, posts, parts] = await Promise.all([
    count("documents"),
    count("conversations"),
    count("messages"),
    count("posts"),
    count("participants"),
  ]);

  const stats = [
    { label: "登録文書", value: docs },
    { label: "参加者", value: parts },
    { label: "会話", value: convs },
    { label: "メッセージ", value: msgs },
    { label: "投稿", value: posts },
  ];

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">管理ダッシュボード</h1>
        <LogoutButton />
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-center">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-[var(--muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      <nav className="mb-8 grid gap-3 sm:grid-cols-3">
        <Link href="/admin/documents" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]">
          <div className="font-semibold">📚 文書管理（RAG）</div>
          <div className="mt-1 text-xs text-[var(--muted)]">公的文書の登録・削除</div>
        </Link>
        <Link href="/admin/modes" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]">
          <div className="font-semibold">🧭 対話モード管理</div>
          <div className="mt-1 text-xs text-[var(--muted)]">システムプロンプト編集</div>
        </Link>
        <Link href="/admin/experiment" className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--primary)]">
          <div className="font-semibold">🧪 実験設定</div>
          <div className="mt-1 text-xs text-[var(--muted)]">群×テーマ＝RAG有無</div>
        </Link>
      </nav>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-3 font-bold">データ書き出し（CSV）</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <a href="/api/admin/export?type=messages" className="rounded-lg bg-[var(--primary)] px-4 py-2 font-medium text-white">
            メッセージ（条件付き）
          </a>
          <a href="/api/admin/export?type=conversations" className="rounded-lg border border-[var(--border)] px-4 py-2">
            会話
          </a>
          <a href="/api/admin/export?type=posts" className="rounded-lg border border-[var(--border)] px-4 py-2">
            投稿
          </a>
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          「メッセージ」CSV には群・テーマ・RAG有無の列が付くため、RAGあり/なしの集計に使えます。
        </p>
      </section>
    </main>
  );
}
