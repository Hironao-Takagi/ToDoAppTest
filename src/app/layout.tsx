import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ToDoリスト",
  description: "シンプルなToDoアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="bg-stone-100 min-h-screen">{children}</body>
    </html>
  );
}
