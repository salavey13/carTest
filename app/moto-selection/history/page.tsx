// /app/moto-selection/history/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// MOTO.SELECTION — подстраница «История создания проекта» (task 136).
//
// Босс: «try to align even more with original moto-selection.ru, including
// subpages - but link to crew's respective pages». На оригинале кнопка
// «ЧИТАТЬ НАШУ ИСТОРИЮ» ведёт на https://moto-selection.ru/history — Tilda-
// страницу «История создания проекта» (200 OK, title «История создания
// проекта»). Эта страница — её платформенное зеркало: тот же заголовок, автор
// (Роман Лосев), подпись «Мотоподбор Нижний Новгород», четыре оригинальных
// фото из архива страницы (static.tildacdn, hotlink — босс просил сохранять
// оригинальные URL). Контакты — по гранд-труфу страницы /history, где вместе с
// основным телефоном указан второй: +7 (910) 149-68-68.
//
// Тексты истории на оригинале свёрстаны картинками/стилями T396 и в HTML не
// извлекаются — поэтому здесь только факты, которые реально читаются на
// оригинале (заголовок, имя, подпись), плюс подписи «из архива проекта» без
// выдуманных фактов. Chrome: THEME_CONFIG.motoSelection покрывает /moto-
// selection* (pathname.startsWith) — собственная навигация, глобальный
// Header/Footer подавлены.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronRight, Instagram, Phone, Send } from "lucide-react";

export const metadata: Metadata = {
  title: "История создания проекта — Moto.selection | Нижний Новгород",
  description:
    "Как создавался Moto.selection: путь от мечты до мотосервиса, подбора, хранения и детейлинга мотоциклов. Роман Лосев, мотоподбор Нижний Новгород.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "article",
    locale: "ru_RU",
    siteName: "Moto.selection",
    title: "История создания проекта — Moto.selection",
    description:
      "Путь Moto.selection: от первых мотоциклов до сервиса, подбора, хранения и детейлинга в Нижнем Новгороде.",
  },
};

const BRAND = "#ff7522";

const T = "https://static.tildacdn.com";
// Гранд-труф страницы /history (ms-history.html): она состоит из фирменного
// логотипа (__.png), дымки-декора (1-20220209_004453.png — фон героя здесь)
// и ссылок на соцсети — YouTube (иконка z.png) и Instagram (zz.png).
// Никаких «архивных фото» на оригинале нет — подписаны честно.
const IMG_LOGO = `${T}/tild6364-6537-4439-b533-656638326631/__.png`;
const IMG_SMOKE = `${T}/tild6131-6233-4862-b732-323433396136/1-20220209_004453.png`;

const PHONE_HREF = "tel:+79875570444";
const PHONE_TEXT = "+7 (987) 557-04-44";
const PHONE_EXTRA_HREF = "tel:+79101496868";
const PHONE_EXTRA_TEXT = "+7 (910) 149-68-68";
const EMAIL = "moto-selection@yandex.ru";
const TELEGRAM_HREF = "https://t.me/romani14";
const SOCIAL_INSTAGRAM = "https://instagram.com/moto.selection";
const SOCIAL_YOUTUBE = "https://www.youtube.com/channel/UCS6_8H7BjW3AC-VHfUV0sYw";

export default function MotoSelectionHistoryPage() {
  return (
    <div className="ms-history-root min-h-screen bg-black text-white" style={{ ["--ms-accent" as string]: BRAND }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
        html { scroll-behavior: smooth; }
        .ms-history-root { font-family: 'Montserrat', 'Segoe UI', sans-serif; }
        .ms-history-root h1, .ms-history-root h2, .ms-history-root h3 {
          font-family: 'Montserrat', sans-serif;
        }
        @keyframes ms-kenburns { 0% { transform: scale(1) translateY(0); } 100% { transform: scale(1.12) translateY(-1.5%); } }
        @media (prefers-reduced-motion: reduce) {
          .ms-kenburns { animation: none !important; }
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/moto-selection"
            className="flex items-center gap-1.5 whitespace-nowrap text-sm font-black uppercase tracking-[0.18em] text-white"
          >
            Moto<span className="text-[var(--ms-accent)]">.</span>selection
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={PHONE_HREF}
              className="hidden text-sm font-bold text-white transition hover:text-[var(--ms-accent)] sm:inline-flex sm:items-center sm:gap-1.5"
            >
              <Phone className="h-4 w-4 text-[var(--ms-accent)]" aria-hidden />
              {PHONE_TEXT}
            </a>
            <Link
              href="/moto-selection"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/20 px-4 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              На главную
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ИСТОРИИ ────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[52svh] items-end overflow-hidden border-b border-white/10">
        <div className="absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0 will-change-transform"
            style={{ animation: "ms-kenburns 24s ease-in-out infinite alternate" }}
          >
            <Image
              src={IMG_SMOKE}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center opacity-60"
            />
          </div>
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(100deg, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.82) 40%, rgba(0,0,0,0.35) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(58% 68% at 80% 25%, rgba(255,117,34,0.16) 0%, rgba(255,117,34,0) 70%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-black" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-14 pt-24 sm:px-6">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">история</p>
          <h1 className="max-w-3xl text-3xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-5xl">
            История создания проекта
          </h1>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.14em] text-white/70">
            Роман Лосев · Мотоподбор Нижний Новгород
          </p>
        </div>
      </section>

      {/* ── ТЕКСТ + АРХИВ ───────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">о нас</p>
            <h2 className="mt-3 text-2xl font-black uppercase leading-tight tracking-tight text-white sm:text-3xl">
              Мы прошли все этапы этого увлекательного пути
            </h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed text-white/65 sm:text-base">
              <p>
                Мотоцикл — один из самых популярных транспортных средств во всем мире, и с каждым
                годом он набирает свою популярность. Но не каждый знает, сколько нюансов стоит за
                выбором и приобретением мотоцикла, в его обслуживании, хранении. Так же мотоцикл
                требует постоянного совершенствования навыков вождения, понимание физики движения
                и многое другое.
              </p>
              <p>
                Мы прошли все этапы этого увлекательного пути, совершая ошибки, постоянно пробуя
                что-то новое и совершенствуясь в своих навыках и знаниях. И теперь мы готовы
                поделиться своим многолетним опытом.
              </p>
            </div>

            {/* Контакты — по гранд-труфу страницы /history: основной телефон и
                второй номер +7 (910) 149-68-68, почта, Telegram */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">контакты</p>
              <div className="mt-4 space-y-3">
                <a href={PHONE_HREF} className="flex items-center gap-3 text-sm font-bold text-white transition hover:text-[var(--ms-accent)]">
                  <Phone className="h-4 w-4 text-[var(--ms-accent)]" aria-hidden />
                  {PHONE_TEXT}
                  <span className="text-xs font-medium text-white/40">основной</span>
                </a>
                <a href={PHONE_EXTRA_HREF} className="flex items-center gap-3 text-sm font-bold text-white transition hover:text-[var(--ms-accent)]">
                  <Phone className="h-4 w-4 text-[var(--ms-accent)]" aria-hidden />
                  {PHONE_EXTRA_TEXT}
                  <span className="text-xs font-medium text-white/40">мотоподбор</span>
                </a>
                <a href={`mailto:${EMAIL}`} className="flex items-center gap-3 text-sm text-white/70 transition hover:text-[var(--ms-accent)]">
                  <span className="inline-flex h-4 w-4 items-center justify-center text-[10px] font-black text-[var(--ms-accent)]">@</span>
                  {EMAIL}
                </a>
                <a
                  href={TELEGRAM_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-white/70 transition hover:text-[var(--ms-accent)]"
                >
                  <Send className="h-4 w-4 text-[var(--ms-accent)]" aria-hidden />
                  Telegram · @romani14
                </a>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/franchize/moto-selection?mode=service"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--ms-accent)] px-7 text-sm font-bold uppercase tracking-[0.08em] text-black transition hover:brightness-110 active:scale-95"
              >
                Каталог услуг на платформе
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
              <a
                href="https://moto-selection.ru/history"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-bold uppercase tracking-[0.08em] text-white transition hover:border-[var(--ms-accent)] hover:text-[var(--ms-accent)] active:scale-95"
              >
                Оригинал страницы
              </a>
            </div>
          </div>

          {/* Фирменный блок: логотип + соцсети оригинала (YouTube / Instagram) */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--ms-accent)]">эмблема проекта</p>
            <figure className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-8">
              <Image
                src={IMG_LOGO}
                alt="Moto.selection — эмблема проекта"
                width={1680}
                height={527}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="h-auto w-full object-contain"
              />
            </figure>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <a
                href={SOCIAL_YOUTUBE}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center transition hover:border-[var(--ms-accent)]/60"
              >
                <span className="inline-flex h-12 w-16 items-center justify-center rounded-xl bg-white/95 transition group-hover:scale-105">
                  <span className="ml-1 inline-block border-y-[9px] border-l-[15px] border-y-transparent border-l-black" aria-hidden />
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">Мы на YouTube</span>
              </a>
              <a
                href={SOCIAL_INSTAGRAM}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center transition hover:border-[var(--ms-accent)]/60"
              >
                <span className="inline-flex h-12 w-16 items-center justify-center rounded-xl border border-white/25 text-white transition group-hover:scale-105">
                  <Instagram className="h-6 w-6" aria-hidden />
                </span>
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/80">Мы в Instagram</span>
              </a>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-white/40">
              Оригинальная страница истории — логотип, дымка и ссылки на соцсети проекта. Полный
              разворот — по кнопке «Оригинал страницы».
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-black">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-white">
            Moto<span className="text-[var(--ms-accent)]">.</span>selection
          </p>
          <p className="text-xs leading-relaxed text-white/40">
            © Moto.selection, 2022. Копия официального сайта{" "}
            <a
              href="https://moto-selection.ru"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dotted underline-offset-4 hover:text-white/70"
            >
              moto-selection.ru
            </a>{" "}
            на платформе франшиз.
          </p>
          <Link
            href="/moto-selection"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--ms-accent)] transition hover:brightness-110"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Вернуться на главную
          </Link>
        </div>
      </footer>
    </div>
  );
}
