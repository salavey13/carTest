import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./styles.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NN VOLT — Профессиональный электромонтаж любой сложности",
  description: "Электромонтаж под ключ в новостройках, школах, больницах и на промышленных объектах. Бригада из 5 сертифицированных специалистов. Гарантия 3 года.",
  keywords: ["электромонтаж", "электрик", "высокое напряжение", "электрощит", "проводка", "новостройки", "NN VOLT"],
  authors: [{ name: "NN VOLT" }],
  // Icons inherited from root layout (favicon.svg)
};

export default function NNVoltLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
      {children}
    </div>
  );
}
