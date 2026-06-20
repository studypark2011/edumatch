import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import ModesManager from "@/components/admin/ModesManager";

export const dynamic = "force-dynamic";

export default async function AdminModes() {
  await requireAdmin();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">対話モード管理</h1>
        <Link href="/admin" className="text-sm text-[var(--primary)] underline">
          ← ダッシュボード
        </Link>
      </header>
      <ModesManager />
    </main>
  );
}
