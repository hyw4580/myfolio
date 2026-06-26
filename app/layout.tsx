import type { Metadata } from "next";
import { Bodoni_Moda, Inter, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "myfolio",
  description: "모델을 위한 디지털 컴카드 플랫폼",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${cormorant.variable} ${inter.variable} ${notoSerifKR.variable}`}>
      <body>{children}</body>
    </html>
  );
}
