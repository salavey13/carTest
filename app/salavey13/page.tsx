// /app/salavey13/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SLY13 — личная витрина salavey13 (task 136; 2026-10-25 messaging overhaul;
// task167 2026-10-30: канонический маршрут /salavey13 — ник владельца;
// старый /sly13 редиректится в next.config, /public/salavey13.html слит сюда
// и удалён — секция «07 · автор», процесс работы и контакты в футере).
//
// task175 2026-11-11 (boss: «apply lessons, but properly» — по следам
// Businesses in ChatGPT): метаданные переписаны под possession+place («свой цифровой
// бизнес», место = твоя витрина/репозиторий, НЕ чужой чат) и на РЕАЛЬНУЮ
// архитектуру: витрина продаёт, бот-клерк ведёт бумаги (/doc), ИИ-агент
// строит и деплоит систему (Supabase/Vercel/GH). Бот — НЕ client-facing
// sales agent (как у OpenAI Business Agent) — это честное отличие.
//
// Босс 2026-10-25: «ditch "stats of vip-bike" — these numbers were not
// actually intended for publication … generalize "the message" — focus on
// variety of supported/tested features of my platform». Метаданные и контент
// больше не оперируют приватными цифрами сезона: лендинг рассказывает про
// платформу (каталог → CRM: 6 контуров, двойная книга денег, мультиарендность,
// AI-воркер) — детали в Sly13LandingClient. Слитый из статичного HTML блок
// «автор» тоже без приватных цифр (пины task138/167).
//
// task177 2026-11-12: в футере лендинга появилась пасхалка (boss: «creating
// crews is going mainstream») — скрин Cyberpunk TCG «BUILD YOUR CREW» в
// лайтбоксе; реализация в Sly13LandingClient (футер-триггер + AnimatePresence).
//
// Архитектура: этот RSC только тянет палитру экипажа (устойчиво к недоступности
// БД — фолбэк на sly13-палитру из crewDocs) и отдаёт её клиентскому
// Sly13LandingClient, где живут framer-motion-анимации, bento-сетки,
// параллакс картинок и собственные nav+footer (chrome подавлен в
// ClientLayout THEME_CONFIG.sly13 — svarprofi/moto-selection паттерн).
// ─────────────────────────────────────────────────────────────────────────────

import { getCrewPaletteBySlug } from "@/app/franchize/actions";
import { crewLandingMetadata } from "@/app/franchize/lib/landing-meta";
import { resolveFranchizeSiteUrl } from "@/app/franchize/[slug]/metadata";
import Sly13LandingClient from "./Sly13LandingClient";

// task209 (2026-11-25): SEO/social parity с экипажными лендингами (task208
// закрыл canonical+og:image+twitter+vk только для пяти /{slug} лендингов —
// /salavey13 и /moto-selection, две самые расшариваемые витрины, оставались
// без превью в Telegram/VK и без canonical при дублях хостов). Механика —
// та же, что у task208: crewLandingMetadata поверх resolveFranchizeSiteUrl
// («reuse our existing mechanics»), og:image — hero-фото витрины (carpix).
// Отличие от экипажных лендингов: сущность здесь — человек + платформа,
// поэтому JSON-LD — Person + WebSite (а не LocalBusiness).
const HERO_OG =
  "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/46f34997-2589-4ae7-9082-a374f19419a6-c899f118-1692-45b9-b6ef-d1066a607426.jpg";

export const metadata = crewLandingMetadata({
  slug: "salavey13",
  siteName: "SLY13",
  title: "SLY13 — свой цифровой бизнес под ключ · платформа проката и сервисов · salavey13",
  description:
    "Свой цифровой прокат или сервис: витрина с оплатой, договоры и залоги, двойная книга денег, бот-клерк для бумаг — а ИИ-агент строит и ведёт систему. Франшиза без пайка: филиалы на одной платформе — точка, сеть городов, федеральная сеть. Не «бизнес в чужом чате»: витрина, база и репозиторий остаются твоими. Обкатано на живом прокате.",
  ogTitle: "SLY13 — платформа франшиз проката и сервисов",
  ogDescription:
    "Витрина с корзиной и оплатой, заявки из Авито, договоры и залоги, двойная книга денег, бот-клерк. Старт за вечер, паёк 0 ₽ — витрина, база и репозиторий остаются твоими.",
  ogImage: HERO_OG,
  ogImageAlt: "SLY13 — платформа франшиз проката и сервисов",
});

export default async function Sly13Landing() {
  // Resilience: supabaseAdmin THROWS synchronously when Supabase is
  // unreachable/misconfigured (lib/supabase-server.ts proxy), which would take
  // the whole landing down with it. Landing must survive a DB hiccup — fall
  // back to the sly13 palette from docs/crewDocs/sly13-franchize-hydration.sql
  // ("SLY13 — Cyan on Graphite", dark), identical to what hydration would set.
  let p;
  try {
    p = (await getCrewPaletteBySlug("sly13")).palette;
  } catch {
    p = {
      bgBase: "#0F1419",
      bgCard: "#1A1F26",
      accentMain: "#06B6D4",
      accentMainHover: "#22D3EE",
      textPrimary: "#E5E7EB",
      textSecondary: "#9CA3AF",
      borderSoft: "#2A2F36",
    };
  }

  // task209: JSON-LD schema.org — витрина физлица-основателя: Person
  // (salavey13, контакты) + WebSite (сама витрина). Рендерится на сервере,
  // экранирование «<» — та же гигиена, что у CrewLandingClient (task208).
  const siteUrl = resolveFranchizeSiteUrl();
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/salavey13#website`,
        name: "SLY13",
        inLanguage: "ru-RU",
        url: `${siteUrl}/salavey13`,
        description:
          "Платформа франшиз проката и сервисов: витрина с оплатой, лиды и Авито, аренда с договорами и залогами, двойная книга денег, бот-клерк, ИИ-агент.",
        publisher: { "@id": `${siteUrl}/salavey13#person` },
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/salavey13#person`,
        name: "salavey13",
        alternateName: "SLY13",
        jobTitle: "Разработчик и основатель платформы SLY13",
        url: "https://t.me/SALAVEY13",
        email: "salavey13@gmail.com",
        knowsAbout: [
          "Next.js",
          "Supabase",
          "Telegram Mini App",
          "CRM для проката",
          "франшизы проката",
        ],
      },
    ],
  };
  const jsonLdHtml = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml }} />
      <Sly13LandingClient palette={p} />
    </>
  );
}
