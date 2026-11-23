// /app/snegoprokat-nn/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// SNEGOPROKAT NN — лендинг экипажа на верхнем уровне (task202, 2026-11-23;
// босс: «create landings … like /salavey13 or /renta-car»).
// Паттерн и механика — в шапке app/franchize/components/CrewLandingClient.tsx.
// Уникальное здесь — только COPY (пич task200 v2: одиночные и на 2-х,
// сертификаты, при масштабировании каждая точка — отдельный экипаж).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import CrewLandingClient, {
  type CrewLandingCopy,
  type CrewLandingFallback,
} from "@/app/franchize/components/CrewLandingClient";

export const metadata: Metadata = {
  title: "Snegoprokat NN — прокат снегоходов в Нижнем Новгороде · SLY13",
  description:
    "Прокат снегоходов в Нижнем Новгороде: одиночные катания и на 2-х снегоходах. Бронирование сеансов онлайн без переписки, договор и залоговые документы автогенерацией, подарочные сертификаты.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Snegoprokat NN · SLY13",
    title: "Snegoprokat NN — прокат снегоходов",
    description:
      "Одиночные катания и на 2-х снегоходах. Бронь онлайн без переписки, документы — за минуту.",
  },
};

const COPY: CrewLandingCopy = {
  hookLine:
    "Витрина Snegoprokat NN на платформе SLY13: бронирование сеансов онлайн и конфигурация аренды без переписки, расчёт инструкторов сводится автоматически.",
  features: [
    "Одиночные катания и катания на 2-х снегоходах — позиции в каталоге",
    "Бронирование сеансов онлайн — без звонков и переписки",
    "Договор и залоговые документы — автогенерация docx за минуту",
    "Подарочные сертификаты — как промокоды: подарок оформляется в несколько шагов",
    "Оплата — наличные или банковский перевод: флаг в каждой операции",
    "При масштабировании: каждая точка — отдельный экипаж со своим каталогом, сверху панель сети",
  ],
};

const FALLBACK: CrewLandingFallback = {
  slug: "snegoprokat-nn",
  name: "Snegoprokat NN",
  city: "Нижний Новгород",
  phone: "+7 923 433-07-40",
  tagline: "Прокат снегоходов в Нижнем Новгороде — одиночные и на 2-х",
};

export default async function SnegoprokatNnLanding() {
  const { crew, items } = await getFranchizeBySlug("snegoprokat-nn");
  return <CrewLandingClient crew={crew} items={items} copy={COPY} fallback={FALLBACK} />;
}
