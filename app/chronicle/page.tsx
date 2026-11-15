// /app/chronicle/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// ХРОНИКА ОДНОЙ АРЕНДЫ (task189, 2026-11-15) — выпуск №3 комикс-вселенной
// (/chronicle, брат /comic-book и /readme; босс: «think what else can be
// described as comics and create it ;)»). Сутки жизни одной аренды по
// таймкодам на движке CB CINE: тап в мини-аппе → карточка → договор →
// депозит → дорога → возврат → отзыв → сплит → зарплата. Все факты — из
// README.MD и worklog; интерактивный флип-телефон для курсора-актёра.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import ChronicleComicClient from "./ChronicleComicClient";

export const metadata: Metadata = {
  title: "Хроника одной аренды · выпуск №3 — комикс платформы",
  description:
    "Сутки жизни одной аренды как выпуск комикса на движке CB CINE: тап в мини-аппе @oneBikePlsBot (09:41), карточка аренды по QR, договор DOCX из карточки, депозит в deposit_entries, статус riding, возврат по чек-листу, отзыв, сплит computePartnerSplit (отменённые — не доход), /salary и сверка. Таймкоды, сквозные герои и камео кадров из выпусков №1–2.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "VibeRider Platform",
    title: "Хроника одной аренды · выпуск №3 — комикс платформы",
    description:
      "Один тап в Telegram — и сутки жизни аренды по таймкодам: документы, депозит, дорога, возврат и деньги. Тот же движок CB CINE, что у трилогии и README-выпуска.",
  },
};

export default function ChronicleComicPage() {
  return <ChronicleComicClient />;
}
