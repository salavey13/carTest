"use client";

// /gift/roman — Roman's birthday surprise (task154)
// ──────────────────────────────────────────────────────────────────────────
// The end of the hidden quest (vipbikerental → vip-bike-electro →
// vip-bike-dashboard → here). Deliberately NOT cybervibe: warm premium
// dark + champagne gold, serif typography, REAL achievements from the
// crew's season data (co-ownership since 19.03.2026, 50/50, Sequence Zero
// ride 12–13.07, real franchize explorer badges, the record season P&L).
// Confetti is a tiny zero-dependency canvas burst.

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { readRomanQuestProgress } from "@/components/roman-gift/RomanQuestCake";

const ACHIEVEMENTS: Array<{ icon: string; title: string; sub: string }> = [
  { icon: "👑", title: "Со-владелец года", sub: "Половина империи — и ни одного спора за весь сезон" },
  { icon: "⚡", title: "Электро-первопроходец", sub: "Поверил в розетку раньше, чем остальные в бензин. Ник обязывает" },
  { icon: "🤫", title: "Тихая мощность", sub: "Ноль выхлопа. Самый громкий звук его байка — улыбка" },
  { icon: "📈", title: "Инвестор парка", sub: "Личный вклад в закупку — каждый байк сезона отчасти его" },
  { icon: "🏍️", title: "Zero-райдер", sub: "Sequence Zero, 12–13 июля: два дня чистой тишины и кайфа" },
  { icon: "🧭", title: "Глаз аналитика", sub: "explorer_analytics + explorer_map_riders — открыл то, что другие не нашли" },
];

const CREW_SIGNATURE = "ИЛЬЯ · SALAVEY13 · DJORUDJOV · LANA · LЁХА";

function daysWithCrew(): number {
  const joined = new Date("2026-03-19T00:00:00+03:00").getTime();
  return Math.max(0, Math.floor((Date.now() - joined) / 86_400_000));
}

// ── zero-dependency confetti ──────────────────────────────────────────────
function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; r: number; c: string; rot: number; vr: number }>>([]);

  const burst = useCallback((count = 160) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = (canvas.width = window.innerWidth);
    const colors = ["#d4af37", "#f3e5c0", "#e8c66b", "#b8860b", "#fff8e7", "#ff9a3c"];
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: w * (0.2 + Math.random() * 0.6),
        y: -20 - Math.random() * 120,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 2 + Math.random() * 3.4,
        r: 3 + Math.random() * 5,
        c: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.22,
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ps = particlesRef.current;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.035;
        p.rot += p.vr;
        if (p.y > canvas.height + 30) {
          ps.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = 0.92;
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.7);
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { canvasRef, burst };
}

export default function RomanGiftPage() {
  const { canvasRef, burst } = useConfetti();
  const [questProgress, setQuestProgress] = useState(0);
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    setQuestProgress(readRomanQuestProgress());
    setDays(daysWithCrew());
    const t = setTimeout(() => burst(200), 450);
    return () => clearTimeout(t);
  }, [burst]);

  const questDone = questProgress >= 3;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0c0b09] text-amber-50">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[90]" />

      {/* warm vignette background */}
      <div
        className="pointer-events-none absolute inset-0 z-[-1]"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(212,175,55,0.16), transparent 60%), radial-gradient(ellipse 50% 40% at 85% 30%, rgba(255,154,60,0.07), transparent 60%), radial-gradient(ellipse 60% 50% at 10% 70%, rgba(212,175,55,0.06), transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-3xl px-5 pb-24 pt-16 sm:pt-20">
        {/* ── header ── */}
        <div className="text-center">
          <p className="font-serif text-[11px] uppercase tracking-[0.45em] text-amber-400/85">
            VIP BIKE · секретная страница · октябрь 2026
          </p>
          <h1 className="mt-5 font-serif text-4xl font-bold leading-tight sm:text-6xl">
            С Днём Рождения,
            <span className="mt-2 block bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent">
              Роман!
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-stone-300 sm:text-base">
            Экипаж спрятал для тебя подарок и устроил квест, чтобы было не так просто. Раз ты читаешь это —
            он твой.
          </p>

          {/* quest stamp */}
          <div className="mx-auto mt-6 inline-flex items-center gap-3 rounded-full border border-amber-400/40 bg-amber-400/10 px-5 py-2">
            <span className="text-lg">{questDone ? "🏅" : "🎂"}</span>
            <span className="text-sm tracking-wide text-amber-200">
              {questDone ? "Квест пройден: 3 из 3 — респект" : `Найдено подсказок: ${questProgress} из 3 — загляни ещё`}
            </span>
          </div>
        </div>

        {/* ── hero picture ── */}
        <div className="relative mx-auto mt-10 overflow-hidden rounded-2xl border border-amber-400/30 shadow-[0_0_80px_rgba(212,175,55,0.12)]">
          <Image
            src="/gift/roman-hero.png"
            alt="Электробайк без выхлопа с праздничным тортом на сиденье"
            width={1344}
            height={768}
            priority
            className="h-auto w-full object-cover"
          />
          <div className="absolute bottom-3 left-3 rounded-lg border border-amber-400/40 bg-black/75 px-3 py-2 text-[11px] uppercase tracking-[0.25em] text-amber-300">
            ноль выхлопа · максимум повода праздновать
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => burst(240)}
            className="rounded-xl border border-amber-400/60 bg-gradient-to-b from-amber-400/15 to-amber-600/10 px-8 py-3 font-serif text-base text-amber-200 transition-all duration-300 hover:from-amber-400/25 hover:text-amber-100"
          >
            🎉 Ещё салют
          </button>
        </div>

        {/* ── achievements ── */}
        <section className="mt-16">
          <h2 className="text-center font-serif text-2xl font-semibold tracking-wide text-amber-100 sm:text-3xl">
            Достижения года
          </h2>
          <p className="mt-2 text-center text-sm text-stone-400">
            не киловайбы и не уровни — настоящее, по данным экипажа
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {ACHIEVEMENTS.map((a, i) => (
              <div
                key={a.title}
                className="group rounded-2xl border border-stone-800 bg-[#14120e]/80 p-5 transition-all duration-300 hover:border-amber-400/45 hover:bg-[#1a1712]"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl transition-transform duration-300 group-hover:scale-110">{a.icon}</span>
                  <div>
                    <h3 className="font-serif text-lg font-medium text-amber-200">{a.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone-400">{a.sub}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── season stats ── */}
        <section className="mt-14 rounded-2xl border border-amber-400/25 bg-gradient-to-b from-[#161310] to-[#100e0b] p-7">
          <h2 className="text-center font-serif text-xl font-semibold tracking-wide text-amber-100">
            Твой сезон в цифрах
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-6 text-center sm:grid-cols-4">
            <div>
              <div className="font-serif text-3xl font-bold text-amber-300">{days ?? "…"}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-stone-500">дней в экипаже с 19.03</div>
            </div>
            <div>
              <div className="font-serif text-3xl font-bold text-amber-300">50/50</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-stone-500">и ни одного спора</div>
            </div>
            <div>
              <div className="font-serif text-3xl font-bold text-amber-300">243</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-stone-500">аренды рекордного сезона</div>
            </div>
            <div>
              <div className="font-serif text-3xl font-bold text-amber-300">0</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-stone-500">выхлопных труб</div>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-stone-400">
            сезон 2026 закрыт в <span className="text-amber-300">+4 353 547 ₽</span> — и это общими усилиями
          </p>
        </section>

        {/* ── letter ── */}
        <section className="mt-14 rounded-2xl border border-stone-800 bg-[#12100d]/80 p-7 sm:p-9">
          <p className="font-serif text-[11px] uppercase tracking-[0.4em] text-amber-400/80">Письмо от экипажа</p>
          <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-stone-300">
            <p>
              Роман, привет. В этом году ты сделал то, на что мало кто решается: не «зашёл посмотреть», а
              вложился, доверился и вытащил общий бизнес на рекорд. Половина парка, половина рисков — и,
              что честнее всего, половина побед.
            </p>
            <p>
              Мы помним июльский Zero, который проехал два дня и ни разу не рыгнул выхлопом. Помним, что
              именно ты раньше всех сказал «электричество — это серьёзно». И знаем, что ты редко открываешь
              эту панель — поэтому подарок спрятан тут, чтобы было повод зайти.
            </p>
            <p className="font-serif text-lg text-amber-200">
              Здоровья, тишины в моторе и полного заряда — во всех смыслах. Обнимает весь экипаж.
            </p>
          </div>
          <div className="mt-7 flex flex-col gap-1 border-t border-stone-800 pt-5 text-sm text-stone-500">
            <span className="text-amber-200/90">Экипаж VIP BIKE</span>
            <span className="tracking-[0.18em]">{CREW_SIGNATURE}</span>
          </div>
        </section>

        {/* ── printable certificate ── */}
        <section className="mt-12 text-center">
          <a
            href="/gift/roman-poster.png"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 rounded-xl border border-amber-400/50 bg-amber-400/10 px-7 py-3 font-serif text-amber-200 transition-all duration-300 hover:bg-amber-400/20 hover:text-amber-100"
          >
            🖨️ Грамота для печати (A4)
          </a>
          <p className="mt-3 text-xs text-stone-600">распечатай и повесь рядом с зарядкой</p>
        </section>

        {/* ── footer ── */}
        <footer className="mt-16 border-t border-stone-900 pt-8 text-center">
          <div className="font-serif text-2xl font-bold tracking-[0.3em] text-amber-100">
            VIP<span className="text-amber-400">BIKE</span>
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.3em] text-stone-600">
            спрятано экипажем · найдено тобой · 2026
          </p>
        </footer>
      </div>
    </main>
  );
}
