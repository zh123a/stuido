import "./globals.css";

export const metadata = {
  title: "Stuido · 让文字穿越到影像的世界",
  description: "口播稿 → MG动画+视频素材短视频平台，复刻花生AI B模式",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#0a0a0a] text-white antialiased">{children}</body>
    </html>
  );
}
