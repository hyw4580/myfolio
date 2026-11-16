import type { Metadata } from "next";
import { Bodoni_Moda, Inter, Noto_Serif_KR } from "next/font/google";
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

const notoSerifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-korean",
});

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
    <html lang={locale} className={`${cormorant.variable} ${inter.variable} ${notoSerifKR.variable}`}>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        <AppBridge />
        <PageViewTracker />
        <ErrorReporter />
      </body>
    </html>
  );
}
