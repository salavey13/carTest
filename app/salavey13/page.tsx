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
// Архитектура: этот RSC только тянет палитру экипажа (устойчиво к недоступности
// БД — фолбэк на sly13-палитру из crewDocs) и отдаёт её клиентскому
// Sly13LandingClient, где живут framer-motion-анимации, bento-сетки,
// параллакс картинок и собственные nav+footer (chrome подавлен в
// ClientLayout THEME_CONFIG.sly13 — svarprofi/moto-selection паттерн).
// ─────────────────────────────────────────────────────────────────────────────

import { getCrewPaletteBySlug } from "@/app/franchize/actions";
import Sly13LandingClient from "./Sly13LandingClient";

export const metadata = {
  title: "SLY13 — свой цифровой бизнес под ключ · платформа проката и сервисов · salavey13",
  description:
    "Свой цифровой прокат или сервис: витрина с оплатой, договоры и залоги, двойная книга денег, бот-клерк для бумаг — а ИИ-агент строит и ведёт систему. Не «бизнес в чужом чате»: витрина, база и репозиторий остаются твоими. Обкатано на живом прокате.",
};

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

  return <Sly13LandingClient palette={p} />;
}
