// /app/motoprokat1/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// МОТОПРОКАТ №1 СПб — лендинг экипажа на верхнем уровне (task202, 2026-11-23;
// босс: «create landings … like /salavey13 or /renta-car»).
// Паттерн и механика — в шапке app/franchize/components/CrewLandingClient.tsx.
// Уникальное здесь — только COPY (пич task200 v2: «бронь без денег» = заявка
// фиксируется в боте; без ограничения по пробегу; ремонт — в каталоге).
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { getFranchizeBySlug } from "@/app/franchize/actions";
import CrewLandingClient, {
  type CrewLandingCopy,
  type CrewLandingFallback,
} from "@/app/franchize/components/CrewLandingClient";

export const metadata: Metadata = {
  title: "МотоПрокат №1 СПб — прокат мотоциклов без ограничения по пробегу · SLY13",
  description:
    "Аренда и прокат мотоциклов в Санкт-Петербурге: нейкеды, спортбайки, туреры и нео-ретро (BMW, Yamaha, Kawasaki, Ducati). Без ограничения по пробегу, полный бак и чистый байк на выдаче. Каталог и бронирование — на витрине и в Telegram-боте.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "МотоПрокат №1 СПб · SLY13",
    title: "МотоПрокат №1 СПб — прокат мотоциклов",
    description:
      "Без ограничения по пробегу. BMW, Yamaha, Kawasaki, Ducati — выбор модели, дата и бронирование в один поток.",
  },
};

const COPY: CrewLandingCopy = {
  hookLine:
    "Витрина МотоПроката №1 на платформе SLY13: выбор модели, дата и бронирование — в один поток, заявка фиксируется в Telegram-боте вместо переписки.",
  features: [
    "Аренда мотоциклов без ограничения по пробегу — параметр тарифа",
    "Байк на выдаче — с полным баком и чистым",
    "Парк: нейкеды, спортбайки, туреры и нео-ретро (BMW, Yamaha, Kawasaki, Ducati)",
    "Договор и залоговые документы — автогенерация docx за минуту",
    "Оплата — наличные или банковский перевод: форма платежа фиксируется флагом в каждой операции",
    "Ремонт мототехники и продажа — отдельными позициями того же каталога",
  ],
};

const FALLBACK: CrewLandingFallback = {
  slug: "motoprokat1",
  name: "МотоПрокат №1 СПб",
  city: "Санкт-Петербург",
  phone: "+7 (921) 884-66-60",
  tagline: "Прокат мотоциклов в СПб без ограничения по пробегу",
};

export default async function Motoprokat1Landing() {
  const { crew, items } = await getFranchizeBySlug("motoprokat1");
  return <CrewLandingClient crew={crew} items={items} copy={COPY} fallback={FALLBACK} />;
}
