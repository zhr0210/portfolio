import type { Metadata } from "next";
import "../src/index.css";
import "../assets/css/style.css";

const siteUrl = "https://editorial-vanguard-portfolio.kilianzhou.chatgpt.site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Editorial Vanguard | 视觉设计作品集",
  description: "聚焦品牌视觉、数字内容与 AI 创意实验的设计作品集。",
  openGraph: {
    type: "website",
    title: "Editorial Vanguard | 视觉设计作品集",
    description: "品牌视觉、数字内容与 AI 创意实验。",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Editorial Vanguard | 视觉设计作品集",
    description: "品牌视觉、数字内容与 AI 创意实验。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="dark">
      <body>{children}</body>
    </html>
  );
}
