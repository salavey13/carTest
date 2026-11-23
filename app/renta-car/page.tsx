// /app/renta-car/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// RENTA-CAR — лендинг экипажа «Рента-Кар НН» на верхнем уровне (task202,
// 2026-11-23; босс: «create landings … like v0-car-test.vercel.app/salavey13
// or v0-car-test.vercel.app/renta-car»).
//
// Паттерн svarprofi/sly13/leorus: тонкая RSC-страница + подавление хрома
// платформы в ClientLayout THEME_CONFIG.rentaCar. Контент data-driven из
// crews.metadata (палитра/контакты/CTA/чеклист) + каталог public.cars через
// getFranchizeBySlug (memoized, emptyCrew при сбое БД → фолбэк-карточка).
// Уникальное здесь — только COPY (платформенные пункты из пича task200 v2:
// формальный тон, оплата = нал/перевод флагом, без «онлайн-оплаты при брони»).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import CrewLandingClient, {
  type CrewLandingCopy,
  type CrewLandingFallback,
} from "@/app/franchize/components/CrewLandingClient";

export const metadata: Metadata = {
  title: "Рента-Кар НН — аренда авто без водителя в Нижнем Новгороде · SLY13",
  description:
    "Аренда автомобилей в Нижнем Новгороде без водителя: эконом и комфорт класс, посуточно и на месяц. Подача по адресу бесплатно, круглосуточно. Каталог, тарифные ступени и бронирование — на витрине и в Telegram-боте.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Рента-Кар НН · SLY13",
    title: "Рента-Кар НН — аренда авто без водителя",
    description:
      "Подача по адресу бесплатно, круглосуточно. Тарифы 1–3 дня, 4–7 дней, 8–30 дней, уикэнд. Бронь — на витрине или в Telegram.",
  },
};

const COPY: CrewLandingCopy = {
  hookLine:
    "Витрина Рента-Кар НН на платформе SLY13: каталог, тарифные ступени и оформление заявки — в одном интерфейсе, без телефонных согласований.",
  features: [
    "Тарифные ступени: 1–3 дня, 4–7 дней, 8–30 дней и отдельный тариф «Уикэнд»",
    "Подача автомобиля по адресу в Нижнем Новгороде — бесплатно",
    "Договор и залоговые документы — автогенерация docx за минуту",
    "Выдача и приёмка по QR-коду с фотоотчётом состояния автомобиля",
    "Оплата — наличные или банковский перевод: форма платежа фиксируется флагом в каждой операции",
    "Заявки с сайта и из Авито — в единый поток Telegram-бота",
  ],
};

const FALLBACK: CrewLandingFallback = {
  slug: "renta-car",
  name: "Рента-Кар НН",
  city: "Нижний Новгород",
  phone: "+7 903 053-60-00",
  tagline: "Аренда авто в Нижнем без водителя — подача бесплатно, круглосуточно",
};

export default async function RentaCarLanding() {
  const { crew, items } = await getFranchizeBySlug("renta-car");
  return <CrewLandingClient crew={crew} items={items} copy={COPY} fallback={FALLBACK} />;
}
