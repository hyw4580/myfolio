import type { Metadata } from "next";
import { Bodoni_Moda, Inter } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n";
import { LocaleProvider } from "./components/LocaleProvider";
import AppBridge from "./components/AppBridge";
import PageViewTracker from "./components/PageViewTracker";
import ErrorReporter from "./components/ErrorReporter";

const cormorant = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// 한글 세리프(Noto Serif KR)는 파일이 수백 개라 빌드 때 받으면 가끔 실패해서, 방문자 브라우저에서 불러옴 (globals.css의 --font-korean)

/** 공유 링크 미리보기 이미지가 절대 주소를 쓰도록 사이트 주소 지정 (도메인 연결 후 NEXT_PUBLIC_SITE_URL 설정) */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "myfolio",
  description: "모델을 위한 디지털 컴카드 플랫폼",
  openGraph: { siteName: "myfolio", locale: "ko_KR", type: "website" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={`${cormorant.variable} ${inter.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        <AppBridge />
        <PageViewTracker />
        <ErrorReporter />
      </body>
    </html>
  );
}
