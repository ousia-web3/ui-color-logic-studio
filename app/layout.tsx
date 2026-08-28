import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UI 컬러 로직 스튜디오",
  description: "이미지에서 UI용 색상과 가독성 높은 텍스트 조합을 자동 추출·보정합니다.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
