import type { Metadata } from "next";
import { GeistSans, GeistMono } from "next/font/google";
import "./styles.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = GeistSans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = GeistMono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NN VOLT — Профессиональный электромонтаж любой сложности",
  description: "Электромонтаж под ключ в новостройках, школах, больницах и на промышленных объектах. Бригада из 5 сертифицированных специалистов. Гарантия 3 года.",
  keywords: ["электромонтаж", "электрик", "высокое напряжение", "электрощит", "проводка", "новостройки", "NN VOLT"],
  authors: [{ name: "NN VOLT" }],
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
