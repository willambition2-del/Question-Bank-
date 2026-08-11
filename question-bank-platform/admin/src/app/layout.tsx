import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "الخدمات الذكية | لوحة الإدارة",
  description: "لوحة تحكم الخدمات الذكية لنظام بنك الأسئلة",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
