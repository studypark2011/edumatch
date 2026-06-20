import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import ExperimentManager from "@/components/admin/ExperimentManager";

export const dynamic = "force-dynamic";

export default async function AdminExperiment() {
  await requireAdmin();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">実験設定（カウンターバランス）</h1>
        <Link href="/admin" className="text-sm text-[var(--primary)] underline">
          ← ダッシュボード
        </Link>
      </header>
      <p className="mb-5 text-sm text-[var(--muted)]">
        群×テーマごとに、回答者に見せる呼称（モードA/B）・対話スタイル・RAGの有無を設定します。
        回答者にはRAGの有無は見えません。
      </p>
      <ExperimentManager />
    </main>
  );
}
