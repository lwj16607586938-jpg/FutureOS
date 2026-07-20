import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "FutureOS · 认知操作系统",
  description: "AI 驱动的认知操作系统：每日一次 Mission，训练观察/理解/连接/推理/预测/修正六项能力。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">
        <Providers>
          <SiteNav />
          <main className="page-container py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
