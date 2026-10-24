// /app/sly13/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SLY13 — личная витрина salavey13 (task 136, «crank it to 13»).
//
// Босс: «i want /sly13 landing be as cool as /moto-selection (interlink us as
// partners in respective sections;) Ditch project-level-default header and
// footer on /sly13 ... Polish adaptability, animations ... search for latest
// trends in web-design ... enhance sly 13 even further».
//
// Архитектура: этот RSC только тянет палитру экипажа (устойчиво к недоступности
// БД — фолбэк на sly13-палитру из crewDocs) и отдаёт её клиентскому
// Sly13LandingClient, где живут framer-motion-анимации, bento-сетки,
// счётчики, параллакс картинок и собственные nav+footer (chrome подавлен в
// ClientLayout THEME_CONFIG.sly13 — svarprofi/moto-selection паттерн).
//
// Данные витрины — те же проверенные цифры сезона-2026 (worklog tasks 111/113):
// 308 аренд май→октябрь, ≈2,0 млн ₽ аренда, 31 ДКП ≈13,0 млн ₽, оборот кассы
// ≈16,5 млн ₽, ретро-импорт архива ≈+188 000 ₽, пик сентября 109 аренд,
// аудит октября: 154 аренды разобраны / 32 находки / 18 депозитов восстановлено.
// Фотки услуг — обложки из каталога экипажа (public.cars, task 135).
// ─────────────────────────────────────────────────────────────────────────────

import { getCrewPaletteBySlug } from "@/app/franchize/actions";
import Sly13LandingClient from "./Sly13LandingClient";

export const metadata = {
  title: "SLY13 — платформа франшиз проката · salavey13",
  description:
    "Боевой экипаж VIP BIKE как первый клиент: сезон-2026 в живых цифрах, сверка и комиссии операторов, запуск экипажей под ключ. Витрина salavey13.",
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
