"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import SupportForm from "@/components/SupportForm";
import { cn } from "@/lib/utils";

// -----------------------------------------------------------------------------
// MEGA Sauna-Rent Page — "Tibetan Vibe" edition
// Single-file mega-component (client). Server actions / APIs are explained and
// commented where they should be wired. Drop this file at /app/sauna-rent/page.tsx
// and iterate. Uses VibeContentRenderer for icons (no direct Fa imports).
// -----------------------------------------------------------------------------

type Booking = {
  id: string;
  date: string; // ISO date
  startHour: number; // 0..23
  durationHours: number;
  price: number;
  starsUsed: number;
  extras: string[];
  createdAt: string;
};

const BASE_PRICING = {
  weekdayDay: 1500, // price per hour in RUB (example)
  weekdayEvening: 2000,
  weekendDay: 2200,
  weekendEvening: 2700,
  fridayExtendedMultiplier: 1.15, // Friday special longer hours
  cinemaFlat: 3000, // cinema extra flat
  jacuzziFlat: 800, // jacuzzi extra
  cleaningFlat: 500,
};

// Utility: check weekend
function isWeekend(date: Date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

// Utility: isFriday
function isFriday(date: Date) {
  return date.getDay() === 5;
}

// Demo mock server calls (comment with TODO to wire real endpoints)
async function mockCreateBookingOnServer(payload: any) {
  // TODO: replace this mock with real server action, e.g. POST /api/sauna/book
  // return await fetch('/api/sauna/book', { method: 'POST', body: JSON.stringify(payload) })
  await new Promise((r) => setTimeout(r, 700));
  return { success: true, id: 'bk_' + Date.now() };
}

export default function SaunaRentMegaPage() {
  // Local state: in real app pull from server via SWR or app router loaders
  const [starsBalance, setStarsBalance] = useState(120); // user's earned stars (XTR) — load from server!
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Booking form state
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default tomorrow
    return d.toISOString().slice(0, 10);
  });
  const [startHour, setStartHour] = useState(18);
  const [durationHours, setDurationHours] = useState(3);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({ cinema: false, jacuzzi: false, cleaning: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  // UI: sticky nav & active section
  const sections = [
    { id: 'hero', label: 'Главная' },
    { id: 'cabins', label: 'Парилки' },
    { id: 'pricing', label: 'Цены' },
    { id: 'extras', label: 'Услуги' },
    { id: 'staff', label: 'Crew & Cleaning' },
    { id: 'booking', label: 'Бронирование' },
    { id: 'support', label: 'Саппорт' },
  ];
  const [activeId, setActiveId] = useState('hero');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const opts = { root: null, rootMargin: '0px', threshold: 0.5 };
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setActiveId(e.target.id);
      });
    }, opts);

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Pricing calculation
  const totalPrice = useMemo(() => {
    const d = new Date(date + 'T00:00:00');
    const weekend = isWeekend(d);
    const friday = isFriday(d);
    const isEvening = startHour >= 18 || startHour < 6;
    const basePerHour = weekend ? (isEvening ? BASE_PRICING.weekendEvening : BASE_PRICING.weekendDay) : (isEvening ? BASE_PRICING.weekdayEvening : BASE_PRICING.weekdayDay);
    let price = basePerHour * durationHours;
    if (friday) price = Math.round(price * BASE_PRICING.fridayExtendedMultiplier);

    if (selectedExtras.cinema) price += BASE_PRICING.cinemaFlat;
    if (selectedExtras.jacuzzi) price += BASE_PRICING.jacuzziFlat;
    if (selectedExtras.cleaning) price += BASE_PRICING.cleaningFlat;

    return price;
  }, [date, startHour, durationHours, selectedExtras]);

  const starsCost = Math.round(totalPrice / 100); // simple conversion: 100 RUB = 1★ (example)

  // Earned stars after booking (10% cashback)
  const starsEarned = Math.max(0, Math.round(totalPrice * 0.1 / 100));

  // Helpers
  function toggleExtra(key: keyof typeof selectedExtras) {
    setSelectedExtras((s) => ({ ...s, [key]: !s[key] }));
  }

  async function handleCreateBooking() {
    setIsSubmitting(true);
    setMessage('');

    const payload = {
      date,
      startHour,
      durationHours,
      extras: Object.keys(selectedExtras).filter(k => selectedExtras[k as keyof typeof selectedExtras]),
      price: totalPrice,
      starsUsed: Math.min(starsBalance, starsCost),
    };

    try {
      // TODO: replace mockCreateBookingOnServer with real server action
      // const res = await fetch('/api/sauna/book', { method: 'POST', body: JSON.stringify(payload) })
      const res = await mockCreateBookingOnServer(payload);
      if (!res || !res.success) throw new Error('Server failed to create booking');

      const newBooking: Booking = {
        id: res.id,
        date,
        startHour,
        durationHours,
        price: totalPrice,
        starsUsed: payload.starsUsed,
        extras: payload.extras,
        createdAt: new Date().toISOString(),
      };

      setBookings((b) => [newBooking, ...b]);

      // Adjust stars balance: spend + earn
      setStarsBalance((prev) => Math.max(0, prev - payload.starsUsed + starsEarned));

      setMessage('Бронирование создано. Проверь Telegram — счёт отправлен.');

      // NOTE: Notify Telegram bot/server to send invoice. Example server steps (commented):
      // 1) server creates invoice via Telegram Bot API
      // 2) server stores booking + pending payment status
      // 3) on payment webhook trigger -> server marks booking confirmed

    } catch (err) {
      setMessage('Ошибка при создании брони. Попробуй ещё.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Quick UTILITY: format time
  function formatHour(h: number) {
    const s = (h % 24).toString().padStart(2, '0');
    return `${s}:00`;
  }

  // Fancy tibetan background SVG (subtle) — inlined to avoid external assets
  const tibetanBg = (
    <svg className="absolute inset-0 w-full h-full opacity-5" preserveAspectRatio="none" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tg" x1="0" x2="1">
          <stop offset="0" stopColor="#ffedd5" stopOpacity="0.05" />
          <stop offset="1" stopColor="#bde0fe" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#tg)" />
      <g fill="none" stroke="#fef3c7" strokeOpacity="0.03" strokeWidth="1">
        <circle cx="120" cy="100" r="120" />
        <circle cx="560" cy="420" r="220" />
      </g>
    </svg>
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#0b0a08] via-[#1a1208] to-[#281713] text-[#f6f1ea] antialiased">
      {/* subtle bg */}
      <div className="absolute inset-0 z-0 overflow-hidden">{tibetanBg}</div>

      {/* STICKY top bar inside page (not global header) */}
      <div className="sticky top-2 z-40 mx-auto container px-4">
        <div className="backdrop-blur-sm bg-[#00000040] border border-[#ffffff0d] rounded-xl p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ffd29b] to-[#ff8a00] flex items-center justify-center text-black font-bold">LÖ</div>
            <div>
              <div className="text-xs text-[#ffe9c7] font-mono">Löyly Vibe — Tibetan Edition</div>
              <div className="text-sm font-semibold">Резерв и управление</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <div className="text-xs text-[#ffd9b6]">Твой баланс</div>
              <div className="text-lg font-bold flex items-center gap-2">
                <VibeContentRenderer content="::FaStar::" className="w-5 h-5 text-yellow-400 inline" /> {starsBalance}★
              </div>
            </div>

            <nav className="hidden sm:flex items-center gap-3">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={cn('px-3 py-1 rounded-md text-sm font-mono', activeId === s.id ? 'bg-[#ffefdd] text-[#221b10]' : 'text-[#ffefddcc] hover:bg-[#ffffff10]')}>{s.label}</a>
              ))}
            </nav>

            <div className="sm:hidden">
              {/* Mobile quick actions */}
              <Link href="#booking"><a className="px-3 py-1 rounded-md bg-[#ffd29b] text-[#120800] font-semibold text-sm">Бронь</a></Link>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-12 relative z-10">
        {/* HERO */}
        <section id="hero" className="rounded-2xl overflow-hidden relative grid grid-cols-1 lg:grid-cols-2 gap-6 items-center bg-gradient-to-br from-[#2b1b12]/40 to-[#1d2b26]/20 p-6">
          <div className="space-y-4">
            <h2 className="text-3xl md:text-4xl font-orbitron leading-tight">Тибетская Löyly — Перезагрузка</h2>
            <p className="text-sm text-[#e7dfd1] max-w-xl">Комната на 15 человек, парилка на 6, бассейн 3x3 (глубина 1.5—2м), джакузи на 2, стол на 10. Ночная сессия — особенный режим: тёплый свет, кино и лаунж.</p>

            <div className="flex gap-3 mt-4 flex-wrap">
              <Button onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#ffd29b] text-[#241309]">Забронировать сейчас</Button>
              <Button variant="ghost" onClick={() => document.getElementById('extras')?.scrollIntoView({ behavior: 'smooth' })}>Услуги</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#2b1b12]">
                <div className="text-xs text-[#ffd29b] font-semibold">Вместимость</div>
                <div className="text-lg font-bold">До 15 человек</div>
              </div>
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#2b1b12]">
                <div className="text-xs text-[#ffd29b] font-semibold">Парилка</div>
                <div className="text-lg font-bold">6 чел</div>
              </div>
            </div>
          </div>

          <div className="relative h-64 md:h-96 rounded-lg overflow-hidden shadow-lg">
            <Image src="https://images.unsplash.com/photo-1532634896-26909d0d1f3b?q=80&w=2000&auto=format&fit=crop" alt="sauna" layout="fill" objectFit="cover" className="object-cover brightness-90" />
            <div className="absolute bottom-4 left-4 p-2 bg-[#00000066] rounded-lg text-xs">Кинотеатр — доп опция</div>
          </div>
        </section>

        {/* CABINS / features */}
        <section id="cabins" className="space-y-6">
          <h3 className="text-2xl font-orbitron">Наши зоны</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaHotTubPerson::" /> Парилка</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Каменная парилка — сухой жар, эфирные масла по желанию. Места: 6.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaSwimmingPool::" /> Бассейн</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">3m × 3m, глубина до 2м, опция охлаждения после парилки.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3"><VibeContentRenderer content="::FaPeopleArrows::" /> Зона на компанию</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Стол на 10 персон, лаунж, нарды, покер, джакузи на 2 — полный уют.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="space-y-6">
          <h3 className="text-2xl font-orbitron">Цены и режимы</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Дневной</div>
              <div className="text-xl font-bold">{BASE_PRICING.weekdayDay} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Пн—Чт 08:00—18:00</div>
            </div>
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Вечерний</div>
              <div className="text-xl font-bold">{BASE_PRICING.weekdayEvening} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Каждый день 18:00—02:00</div>
            </div>
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Выходные</div>
              <div className="text-xl font-bold">{BASE_PRICING.weekendDay}—{BASE_PRICING.weekendEvening} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Повышенный тариф в пт-вс</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#080707] rounded-lg border-border">
            <h4 className="font-semibold">Особые правила</h4>
            <ul className="list-disc list-inside mt-2 text-sm text-[#ddd]">
              <li>Минимальная аренда — 2 часа.</li>
              <li>Пятница — удлинённый режим, чаще люди остаются до утра.</li>
              <li>Максимум — 15 человек (одна сауна в локации).</li>
              <li>Кинотеатр и приставки — по запросу как доп. услуга.</li>
            </ul>
          </div>
        </section>

        {/* Extras */}
        <section id="extras" className="space-y-6">
          <h3 className="text-2xl font-orbitron">Дополнительные услуги</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle><VibeContentRenderer content="::FaFilm::" /> Кинотеатр + приставка</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Выбирай фильм/подключи свою приставку — можем привезти контроллеры. Flat fee {BASE_PRICING.cinemaFlat} ₽.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle><VibeContentRenderer content="::FaSpa::" /> Джакузи</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Две независимые камеры джакузи, идеальны для пар и релаксации. {BASE_PRICING.jacuzziFlat} ₽.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle><VibeContentRenderer content="::FaDice::" /> Игры: нарды, покер</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Комплекты нард, карты, стол, фишки — всё для вечеринки.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* STAFF / crew planning */}
        <section id="staff" className="space-y-6">
          <h3 className="text-2xl font-orbitron">Crew & Cleaning — как это работает</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle><VibeContentRenderer content="::FaPeopleCarry::" /> Клин-тим и персонал</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Владелец может назначать клинеров/пассажиров-байкеров для логистики: уборка между сменами, подвоз гостей, проверка оборудования.</p>
                <ol className="list-decimal list-inside text-sm text-[#ddd] mt-2">
                  <li>План уборок после каждой смены — опция для заказчика.</li>
                  <li>Клин-тим получает звезды за выполненную уборку (геймификация).</li>
                  <li>Можно синхронизировать байк-прохваты между саунами (crew mobility).</li>
                </ol>

                {/* TODO: team planning UI -> server action to assign shifts */}
                {/* Example: fetch('/api/crew/assign', { method: 'POST', body: JSON.stringify({ bookingId, crewId }) }) */}
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle><VibeContentRenderer content="::FaHandSparkles::" /> Программа мотивации</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">За каждую аренду, уборку или полезное действие начисляются звезды. Они конвертируются в скидки для следующей аренды.</p>
                <ul className="list-disc list-inside text-sm mt-2 text-[#ddd]">
                  <li>Clean+ — бонус 5★ за качественную уборку.</li>
                  <li>Referral — привёл друга — 2★.</li>
                  <li>Seasonal campaigns и промо для байкер-крузов.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* BOOKING FORM */}
        <section id="booking" className="space-y-6">
          <h3 className="text-2xl font-orbitron">Бронирование (Демо)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#0b0b0b] border-border">
                <CardHeader><CardTitle>Форма брони</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-mono">Дата
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm" />
                    </label>

                    <label className="text-xs font-mono">Время начала
                      <select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm">
                        {Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}
                      </select>
                    </label>

                    <label className="text-xs font-mono">Длительность (часы)
                      <input type="number" min={2} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm" />
                    </label>

                    <div className="text-xs font-mono">Скидки и звезды
                      <div className="mt-1 text-sm">Баланс: <strong>{starsBalance}★</strong> • Стоимость в звёздах: <strong>{starsCost}★</strong></div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-2">
                      <div className="flex gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={selectedExtras.cinema} onChange={() => toggleExtra('cinema' as any)} /> <span className="text-sm">Кинотеатр</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={selectedExtras.jacuzzi} onChange={() => toggleExtra('jacuzzi' as any)} /> <span className="text-sm">Джакузи</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" checked={selectedExtras.cleaning} onChange={() => toggleExtra('cleaning' as any)} /> <span className="text-sm">Проф. уборка</span>
                        </label>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-3">
                      <div className="p-3 rounded bg-[#080707] border border-[#2b1b12]">
                        <div className="flex justify-between items-center">
                          <div className="text-sm">Итого</div>
                          <div className="text-lg font-bold">{totalPrice} ₽</div>
                        </div>
                        <div className="text-xs text-[#d9d6cd] mt-1">Или ~ {starsCost}★ (примерный перевод). При оплате — начислим {starsEarned}★ cashback.</div>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-3">
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Доп. пожелания (обогрев, музыка, фильм)" className="w-full p-3 rounded bg-[#141212] border border-[#2b1b12] text-sm h-24" />
                    </div>

                    <div className="col-span-1 sm:col-span-2 flex gap-3 mt-2">
                      <Button onClick={handleCreateBooking} disabled={isSubmitting} className="w-full">{isSubmitting ? 'Обработка...' : 'Создать бронь и получить счёт в Telegram'}</Button>
                      <Button variant="ghost" onClick={() => { setDate(new Date(Date.now()+24*3600*1000).toISOString().slice(0,10)); setMessage(''); }}>Сброс</Button>
                    </div>

                  </div>
                </CardContent>
              </Card>

              {/* Booking history */}
              <Card className="mt-6 bg-[#080707] border-border">
                <CardHeader><CardTitle>История броней</CardTitle></CardHeader>
                <CardContent>
                  {bookings.length === 0 ? <div className="text-sm text-[#d9d6cd]">Пока что пусто — твои брони появятся здесь.</div> : (
                    <ul className="space-y-2">
                      {bookings.map(b => (
                        <li key={b.id} className="p-2 rounded bg-[#0b0b0b] border border-[#2b1b12]">
                          <div className="flex justify-between items-center">
                            <div className="text-sm">{b.date} • {formatHour(b.startHour)} • {b.durationHours}ч</div>
                            <div className="text-sm font-semibold">{b.price} ₽</div>
                          </div>
                          <div className="text-xs text-[#d9d6cd] mt-1">Экстры: {b.extras.join(', ') || '—'}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column - support / loyalty shop */}
            <aside>
              <Card className="bg-[#0b0b0b] border-border md:sticky md:top-24">
                <CardHeader><CardTitle>Система звёзд</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-[#d9d6cd] mb-2">Твои звёзды — внутренняя валюта. Трать их на скидки или копи для будущих броней.</p>
                  <div className="p-3 bg-[#060606] rounded border border-[#2b1b12]">
                    <div className="text-xs">Баланс</div>
                    <div className="text-3xl font-bold flex items-center gap-2"><VibeContentRenderer content="::FaStar::" className="w-7 h-7 text-yellow-400" /> {starsBalance}★</div>
                    <div className="text-xs text-[#d9d6cd] mt-2">Суммарно: начисления за предыдущие действия, рефералы, уборки.</div>

                    <div className="mt-3">
                      <div className="text-xs text-[#ffd29b]">Магазин скидок</div>
                      <ul className="mt-1 text-sm list-inside list-disc">
                        <li>50★ — 500 ₽ скидка</li>
                        <li>100★ — 1200 ₽ скидка</li>
                        <li>200★ — 3000 ₽ скидка + VIP вечер</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4"> 
                    <div className="text-xs text-[#ffd29b] mb-2">Подпишись на оповещения уборки</div>
                    <p className="text-xs text-[#d9d6cd]">После аренд можно подписаться на короткий shift уборки: люди получают задачу — чисто и получают звёзды за выполнение.</p>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => alert('TODO: send subscription to /api/notify-cleanup')}>Подписаться</Button>
                      <Button variant="ghost" onClick={() => alert('TODO: show cleaning schedule')}>График</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#070707] border-border mt-6">
                <CardContent>
                  <h4 className="font-semibold text-accent-text mb-2">Быстрые ссылки</h4>
                  <ul className="text-sm list-inside space-y-2 text-[#d9d6cd]">
                    <li><Link href="/vipbikerental"><a className="hover:underline">VIP Байк</a></Link></li>
                    <li><Link href="/repo-xml"><a className="hover:underline">/repo-xml Studio</a></Link></li>
                    <li><Link href="/selfdev"><a className="hover:underline">SelfDev</a></Link></li>
                  </ul>
                </CardContent>
              </Card>
            </aside>

          </div>
        </section>

        {/* SUPPORT */}
        <section id="support" className="space-y-6">
          <h3 className="text-2xl font-orbitron">Поддержка и заказ услуг</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle>Заявки / Саппорт</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d9d6cd]">Если хочешь заказать комплексную организацию мероприятия, напиши: администрирование, доп. персонал, закупки, кейтеринг.</p>
                <div className="mt-3"><SupportForm /></div>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle>Маркетинг и байк-креатив</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d9d6cd]">Идеи: комбинировать байк-тур + сауна (crew mobility). Промо: ночной пакет + кино + бар — лимитированные места.</p>
                <p className="text-xs text-[#cfc6b8] mt-2">TODO: expose API to schedule bike->sauna pickups, crew assignments and promo codes.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FOOTER CTA */}
        <section className="py-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h4 className="text-xl font-orbitron mb-2">Готов взять ВАЙБ на себя?</h4>
            <p className="text-sm text-[#d9d6cd] mb-4">Бронируй сейчас — счёт в Telegram. Плати звёздами. Я вижу оплату и подтверждаю вручную.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}>Забронировать</Button>
              <Button variant="ghost" onClick={() => document.getElementById('support')?.scrollIntoView({ behavior: 'smooth' })}>Саппорт</Button>
            </div>
          </div>
        </section>
      </main>

      {/* Floating steaming panel navigation (mobile-first bottom nav) */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[92%] sm:w-[640px] md:hidden">
        <div className="bg-[#0b0b0b] border border-[#2b1b12] rounded-full p-2 flex justify-between items-center shadow-lg">
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className={cn('flex-1 text-center p-2 rounded-full text-xs', activeId === s.id ? 'bg-[#ffd29b] text-[#120800]' : 'text-[#fff]')}>{s.label}</a>
          ))}
        </div>
      </div>

      {/* Desktop right-side steam nav */}
      <aside className="hidden md:block fixed right-6 top-1/3 z-40">
        <div className="bg-[#0b0b0b] border border-[#2b1b12] rounded-xl p-2 w-44 shadow-xl">
          <div className="text-xs text-[#ffd29b] mb-2">Навигация</div>
          <div className="flex flex-col gap-2">
            {sections.map(s => (
              <a key={s.id} href={`#${s.id}`} className={cn('p-2 rounded-md text-sm', activeId === s.id ? 'bg-[#ffd29b] text-[#120800]' : 'text-[#fff] hover:bg-[#ffffff10]')}>{s.label}</a>
            ))}
          </div>
        </div>
      </aside>

      <style jsx>{`
        /* small tweaks for tibetan vibe font/contrast */
        .font-orbitron { font-family: 'Orbitron', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
      `}</style>
    </div>
  );
}