// /app/renta-flat/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// RENTA-FLAT — демо-витрина «Рента-Флэт НН» на верхнем уровне (task207,
// 2026-11-23; босс: «create demo crew with 5 item catalogue set for
// "аренда квартир" theme»).
//
// Назначение — вертикальное доказательство: платформа не привязана к
// технике; та же цепочка каталог → бронь → договор → касса работает на
// квартирах. Паттерн тот же, что у зелёных (task202): тонкая RSC-страница
// + подавление хрома в ClientLayout THEME_CONFIG.crewLandings; контент
// data-driven из crews.metadata (палитра/контакты/CTA/чеклист) + каталог
// public.cars через getFranchizeBySlug. Уникальное — только COPY.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import CrewLandingClient, {
  type CrewLandingCopy,
  type CrewLandingFallback,
} from "@/app/franchize/components/CrewLandingClient";

export const metadata: Metadata = {
  title: "Рента-Флэт НН — аренда квартир посуточно в Нижнем Новгороде · SLY13",
  description:
    "Аренда квартир в Нижнем Новгороде посуточно и на месяц: студии от 2 400 ₽, 1-2-комнатные, пентхаус-лофт. Онлайн-заявка, договор брони и заезд по QR — на витрине и в Telegram-боте.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Рента-Флэт НН · SLY13",
    title: "Рента-Флэт НН — аренда квартир посуточно",
    description:
      "Студии от 2 400 ₽, 1-2-комнатные, пентхаус-лофт. Бронь — на витрине или в Telegram, договор брони генерируется автоматически.",
  },
};

const COPY: CrewLandingCopy = {
  heroItemId: "renta-flat-2k-euro",
  hookLine:
    "Демо-витрина аренды квартир на платформе SLY13: каталог с фото и метражом, онлайн-бронь и договор — как в технике, но для жилого фонда.",
  features: [
    "Тарифные ступени: 1–3 дня, 4–7 дней и месячная ставка — без торга в переписке",
    "Фильтры по площади, числу спальных мест и району города",
    "Договор брони и залог — автогенерация docx, заезд и выезд по QR",
    "Фотоотчёт состояния квартиры при заселении и выселении",
    "Оплата — наличные, карта или СБП: форма платежа фиксируется в операции",
    "Заявки с сайта и из Авито — в единый поток Telegram-бота",
  ],
};

const FALLBACK: CrewLandingFallback = {
  slug: "renta-flat",
  name: "Рента-Флэт НН",
  city: "Нижний Новгород",
  phone: "+7 930 000-00-00",
  tagline: "Аренда квартир посуточно и на месяц — студии, 1-2-комнатные, лофт",
};

export default async function RentaFlatLanding() {
  const { crew, items } = await getFranchizeBySlug("renta-flat");
  return <CrewLandingClient crew={crew} items={items} copy={COPY} fallback={FALLBACK} />;
}
