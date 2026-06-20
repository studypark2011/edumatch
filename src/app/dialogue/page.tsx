import Link from "next/link";
import { listModes } from "@/lib/experiment";
import DialogueClient from "@/components/DialogueClient";

export const dynamic = "force-dynamic";

export default async function DialoguePage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; theme?: string }>;
}) {
  const { group, theme } = await searchParams;
  const modes = await listModes();

  if ((group !== "X" && group !== "Y") || !theme) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16 text-center">
        <p className="mb-4">リンクが正しくありません。トップから始めてください。</p>
        <Link href="/" className="text-[var(--primary)] underline">
          トップへ戻る
        </Link>
      </main>
    );
  }

  return <DialogueClient group={group} themeSlug={theme} modes={modes} />;
}
