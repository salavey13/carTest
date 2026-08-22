import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NN VOLT — Заявка на расчёт сметы",
  description:
    "Интерактивная заявка на расчёт сметы электромонтажных работ от NN VOLT. Заполните форму, скачайте готовый файл и отправьте его бригадиру.",
  keywords: ["заявка", "смета", "электромонтаж", "NN VOLT", "электрик", "расчёт"],
  authors: [{ name: "NN VOLT" }],
  // Icons inherited from root layout (favicon.svg)
};

export default function ZaprosSmetiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
