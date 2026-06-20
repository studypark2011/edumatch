import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import DocumentsManager from "@/components/admin/DocumentsManager";

export const dynamic = "force-dynamic";

export default async function AdminDocuments() {
  await requireAdmin();
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">文書管理（RAG知識基盤）</h1>
        <Link href="/admin" className="text-sm text-[var(--primary)] underline">
          ← ダッシュボード
        </Link>
      </header>
      <DocumentsManager />
    </main>
  );
}
