// /app/snowmobile-nn/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SNOWMOBILE-NN — лендинг экипажа на верхнем уровне (task202, 2026-11-23;
// босс: «create landings … like /salavey13 or /renta-car»).
// Паттерн и механика — в шапке app/franchize/components/CrewLandingClient.tsx.
// Уникальное здесь — только COPY (пич task200 v2: сеансы 1/1,5/2 часа,
// сезон короткий, сертификаты как промокоды).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import CrewLandingClient, {
  type CrewLandingCopy,
  type CrewLandingFallback,
} from "@/app/franchize/components/CrewLandingClient";

export const metadata: Metadata = {
  title: "Snowmobile-NN — катания на снегоходах в Нижнем Новгороде · SLY13",
  description:
    "Катания на снегоходах в Нижнем Новгороде: сеансы по длительности — 1 час, 1,5 часа и 2 часа. Бронь онлайн 24/7, договор и залоговые документы автогенерацией, выдача по QR-коду с фотоотчётом.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Snowmobile-NN · SLY13",
    title: "Snowmobile-NN — катания на снегоходах",
    description:
      "Сеансы 1, 1,5 и 2 часа. Бронь фиксируется в Telegram-боте, документы — за минуту.",
  },
};

const COPY: CrewLandingCopy = {
  hookLine:
    "Витрина Snowmobile-NN на платформе SLY13: выбор сеанса и конфигурация аренды на витрине, приём брони 24/7 — сезон короткий, платформа закрывает его без потерь.",
  features: [
    "Сеансы по длительности: 1 час, 1,5 часа и 2 часа — выбор на витрине",
    "Бронь онлайн 24/7 — фиксируется в Telegram-боте экипажа",
    "Договор и залоговые документы — автогенерация docx за минуту",
    "Выдача по QR-коду с фотоотчётом",
    "Подарочные сертификаты — как промокоды в корзине",
    "Оплата — наличные или банковский перевод: двойная книга денег без ручных таблиц",
  ],
};

const FALLBACK: CrewLandingFallback = {
  slug: "snowmobile-nn",
  name: "Snowmobile-NN",
  city: "Нижний Новгород",
  phone: "+7 910 876-28-58",
  tagline: "Катания на снегоходах в Нижнем Новгороде — сеансы 1, 1,5 и 2 часа",
};

export default async function SnowmobileNnLanding() {
  const { crew, items } = await getFranchizeBySlug("snowmobile-nn");
  return <CrewLandingClient crew={crew} items={items} copy={COPY} fallback={FALLBACK} />;
}
