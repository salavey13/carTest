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
// /api/franchize/callback-lead со slug «djorudjov» (2026-10-27 босс:
// «link "leoris" to "djorudjov" crew properly» — экипаж LEORUS существует
// в БД; получатели: владелец + ростер djorudjov + ADMIN_CHAT_ID salavey13).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import LeorusLandingClient from "./LeorusLandingClient";
import { crewLandingMetadata } from "@/app/franchize/lib/landing-meta";

// task210 (2026-11-24): SEO/social parity — как task208/209 у остальных
// витрин: canonical + og:image + twitter + vk через crewLandingMetadata
// («reuse our existing mechanics»). og:image — hero-фон лендинга.
export const metadata: Metadata = crewLandingMetadata({
  slug: "leorus",
  siteName: "LEORUS",
  title: "LEORUS — Создание интригующих мероприятий · Ивент-агентство · Нижний Новгород",
  description:
    "LEORUS — агентство мероприятий Рустама Оруджова и Влада Иващенко. 20 лет, 300+ проектов: топовые корпоративы для крупных компаний, фестивали, шоу и продакшн под ключ. Нижний Новгород и вся Россия.",
  ogTitle: "LEORUS — Создание интригующих мероприятий",
  ogDescription:
    "Ивент-агентство Рустама Оруджова × Влада Иващенко: фестивали, шоу-программы, видео-продакшн и корпоративы под ключ. 20 лет, 300+ проектов, 1 000 000 зрителей.",
  ogImage: "/leorus/hero-bg.jpg",
  ogImageAlt: "LEORUS — ивент-агентство мероприятий",
});

export default function LeorusLanding() {
  return <LeorusLandingClient />;
}
