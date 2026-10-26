// /app/leorus/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// LEORUS — агентство мероприятий (Оруджов × Влад), маршрут-порт по запросу
// босса 2026-10-26: «find a repo with a landing page for djorudjov and port
// it to our cartest repo as a landing like /moto-selection and sly13».
//
// Источник: VPS 212.67.11.25 → /var/www/orudjov-x-vlad/index.html (2.3 МБ
// самодостаточный HTML: 90 КБ разметки+CSS, 11 фото в base64 → public/leorus/).
// Вся вёрстка/CSS перенесены 1:1 (leorus.css, скоуп .leorus-root), интерактив
// (sticky nav, бургер, форма) переписан на React в LeorusLandingClient.
//
// Хром платформы подавлен в ClientLayout THEME_CONFIG.leorus — паттерн
// svarprofi/nnvolt/motoSelection/sly13. Лид-форма POST-ит в существующий
// /api/franchize/callback-lead со slug «vip-bike» (djorudjov — vip-bike
// админ; получатели: ростер vip-bike + ADMIN_CHAT_ID salavey13).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import LeorusLandingClient from "./LeorusLandingClient";

export const metadata: Metadata = {
  title: "LEORUS — Создание интригующих мероприятий · Ивент-агентство · Нижний Новгород",
  description:
    "LEORUS — агентство мероприятий Рустама Оруджова и Влада Иващенко. 20 лет, 300+ проектов: топовые корпоративы для крупных компаний, фестивали, шоу и продакшн под ключ. Нижний Новгород и вся Россия.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "LEORUS",
    title: "LEORUS — Создание интригующих мероприятий",
    description:
      "Ивент-агентство Рустама Оруджова × Влада Иващенко: фестивали, шоу-программы, видео-продакшн и корпоративы под ключ. 20 лет, 300+ проектов, 1 000 000 зрителей.",
  },
};

export default function LeorusLanding() {
  return <LeorusLandingClient />;
}
