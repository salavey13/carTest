// /app/readme/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// README · ТЕХНИЧЕСКИЙ ВЫПУСК (task187, 2026-11-14) — README репозитория,
// начитанный как выпуск комикса на движке CB CINE (тот же движок, что у
// трилогии /comic-book; босс: «create README in comics style using comics
// engine we created ;) /readme»). Три главы: платформа, кухня денег и
// бумаг, франшиза (клон → деплой). Все факты — из README.MD; 9 новых
// AI-панелей r*.webp + cameo pdj.webp и final.webp из выпуска №1.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import ReadmeComicClient from "./ReadmeComicClient";

export const metadata: Metadata = {
  title: "README · технический выпуск — комикс платформы",
  description:
    "README репозитория VIP Bike как выпуск комикса на движке CB CINE: Telegram-first платформа (мини-апп @oneBikePlsBot), витрины экипажей из crews.metadata, бот закрывает операционку, честная кухня денег (computePartnerSplit, отменённые аренды — не доход), DOCX-документы, аналитика со сверками, шесть витрин с общей ДНК и клон → Supabase → Vercel за вечер.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "VibeRider Platform",
    title: "README · технический выпуск — комикс платформы",
    description:
      "Три главы о том, как устроен репозиторий: платформа, кухня денег и франшиза. Тот же движок, что у комикс-трилогии; панели AI, текст и терминалы наложены кодом.",
  },
};

export default function ReadmeComicPage() {
  return <ReadmeComicClient />;
}
