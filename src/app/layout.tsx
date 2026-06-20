import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "教育AIツール 対話パート",
  description: "教育関係者の意見形成・言語化を支援する対話型メディア（研究用）",
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
