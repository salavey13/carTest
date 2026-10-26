"use client";

// app/vipbikerental/features/PartnersCrewsSection.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Партнёрский блок + лид-CTA для витрины /vipbikerental (2026-10-27, босс:
// «make sure all landings have consistent feedback forms … doublecheck
// proper interlinking trough partners sections consistently on all
// landings — showing only logos at first, reveal title on longtap/hover»).
//
// До этого блока витрина флагмана была единственной без партнёрской сетки
// и без формы заявки. Теперь:
//   · сетка логотипов — тот же сквозной PartnerLogoGrid, что на
//     /moto-selection, /sly13, /leorus, /georg-electro (в покое только
//     логотипы, название/подводка — по hover или долгому тапу ≥380 мс);
//   · кнопка «Оставить заявку» открывает общий FeedbackModal
//     (app/moto-selection/FeedbackModal) — POST в существующий
//     /api/franchize/callback-lead со slug «vip-bike»: получатели лидов
//     резолвит resolveLeadNotifyRecipients("vip-bike") — владелец экипажа
//     + ростер + ADMIN_CHAT_ID (salavey13). Никакого нового серверного кода.
// Стили — в духе флагманской витрины: тёмная подложка, amber-gold акценты,
// font-orbitron для заголовков.
// ─────────────────────────────────────────────────────────────────────────────

import PartnerLogoGrid from "@/components/landing/PartnerLogoGrid";
import { Handshake, PhoneCall } from "lucide-react";

const ACCENT = "#d99a00";

// Те же четыре витрины экипажей, что в партнёрских сетках остальных
// лендингов (4/4: каждая витрина ссылается на каждую). Логотипы и подложки
// совпадают 1:1 с сетками на других лендингах.
const CREW_TILES = [
  {
    href: "/moto-selection",
    title: "Moto.Selection",
    tagline: "мотосервис — обучение, подбор мото, ТО, детейлинг, хранение 24/7",
    logoSrc: "https://static.tildacdn.com/tild6335-3266-4164-b461-363834666561/__.png",
    logoAlt: "Moto.Selection",
    backing: "#f2efea",
    lightBacking: true,
  },
  {
    href: "/sly13",
    title: "SLY13",
    tagline: "платформа франшиз проката — каталог, CRM, договоры, лиды",
    logoSrc: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sly13_logo.jpg",
    logoAlt: "SLY13",
    backing: "#030303",
  },
  {
    href: "/leorus",
    title: "LEORUS · djorudjov",
    tagline: "ивент-агентство — фестивали, DJ и шоу-программы, видео, корпоративы",
    logoSrc: "/logos/leorus-logo.png",
    logoAlt: "LEORUS",
    backing: "#0A0612",
  },
  {
    href: "/georg-electro",
    title: "Georg.Electro",
    tagline: "электрик электробайков — диагностика, контроллеры, проводка, свет",
    logoSrc: "/logos/georg-electro-logo.png",
    logoAlt: "Georg.Electro",
    backing: "#140f06",
  },
];

export function PartnersCrewsSection() {
  return (
    <section
      id="partners"
      className="relative scroll-mt-24 overflow-hidden rounded-[2rem] border border-amber-400/20 bg-black/50 p-5 shadow-2xl shadow-black/30 backdrop-blur-sm sm:p-8"
    >
      {/* тёплое свечение в духе hero-блока флагмана */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 18% 0%, rgba(217,154,0,0.10) 0%, transparent 60%), radial-gradient(45% 40% at 85% 100%, rgba(255,106,0,0.08) 0%, transparent 55%)",
        }}
      />

      <div className="relative z-10">
        <p className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-amber-400">
          <Handshake className="h-4 w-4" aria-hidden />
          экипажи платформы
        </p>
        <h2 className="mt-3 font-orbitron text-2xl font-black uppercase leading-tight text-white sm:text-3xl">
          Один софт — <span className="text-amber-400">четыре витрины</span>
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-base">
          VIP BIKE работает на той же платформе, что и партнёрские экипажи:
          каталог с тарифами, CRM лидов, договоры, карта райдеров и витрина под
          своим именем. Наведите (или удерживайте палец) на логотипе — откроется
          название и описание, повторный тап ведёт на витрину.
        </p>

        <div className="mt-8">
          <PartnerLogoGrid
            accent={ACCENT}
            columns={4}
            ariaLabel="Витрины экипажей платформы — партнёры VIP BIKE"
            partners={CREW_TILES}
          />
        </div>

        {/* Лид-CTA: та же механика, что на остальных лендингах —
            data-lead-modal-open открывает общий FeedbackModal. */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-amber-400/20 bg-black/50 p-5 sm:flex-row sm:p-6">
          <div>
            <p className="font-orbitron text-base font-bold uppercase text-white sm:text-lg">
              Нужен такой же экипаж или премиальный прокат?
            </p>
            <p className="mt-1.5 text-sm text-white/60">
              Оставьте телефон — перезвоним в течение дня: бронь, франшиза или
              вопрос по платформе.
            </p>
          </div>
          <button
            type="button"
            data-lead-modal-open
            className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 px-7 py-3.5 text-sm font-black uppercase tracking-[0.1em] text-black shadow-[0_0_25px_rgba(217,154,0,0.35)] transition hover:brightness-110 active:scale-[0.98]"
          >
            <PhoneCall className="h-4 w-4" aria-hidden />
            Оставить заявку
          </button>
        </div>
      </div>
    </section>
  );
}
