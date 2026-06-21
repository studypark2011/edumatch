import type { Metadata } from "next";
import "./globals.css";

// リンクのプレビューやタブに研究の狙いが出ると参加者を方向づけてしまう（バイアス）ため、
// 研究調査であることだけ伝わる中立的な表示にする。
const TITLE = "教育に関する調査";
const DESCRIPTION = "教育関係者を対象とした研究調査です。回答は匿名で、研究目的にのみ使用します。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
