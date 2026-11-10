import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "线条成像 · Lineform Lab",
  description: "用螺旋、波纹、点阵和短线重绘图像。导入图片，让实时图形随鼠标推开、聚拢和自然复位。",
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
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
