"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import SupportForm from "@/components/SupportForm";
import { cn } from "@/lib/utils";
import { ActiveRentalsIndicator } from "@/components/ActiveRentalsIndicator";

// -----------------------------------------------------------------------------
// MEGA Sauna-Rent Page — "Tibetan Vibe" edition (final polish)
// - WCAG contrast fixes applied for reported elements
// - Steam animation for main hero title
// - Aggressive client -> server attempt: POST /api/rentals/create-sauna (see TODOs)
// - More images (Unsplash placeholders)
// - All icons via VibeContentRenderer
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
  weekdayDay: 1500,
  weekdayEvening: 2000,
  weekendDay: 2200,
  weekendEvening: 2700,
  fridayExtendedMultiplier: 1.15,
  cinemaFlat: 3000,
  jacuzziFlat: 800,
  cleaningFlat: 500,
};

function isWeekend(date: Date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}
function isFriday(date: Date) {
  return date.getDay() === 5;
}

/**
 * Aggressive booking sender:
 * - Attempts to POST to /api/rentals/create-sauna with payload { type: 'sauna', ... }
 * - Server should reuse `createBooking`/`createInvoice` flow from rentals/actions,
 *   but set invoice metadata.type = 'sauna' (instead of 'car_rental').
 *
 * TODO (server): add API handler that:
 *  - validates payload
 *  - creates booking in rentals table with type='sauna' (or car.type='sauna' if you store saunas in cars)
 *  - creates invoice via createInvoice(...) and sends Telegram invoice via sendTelegramInvoice
 *  - returns { success: true, id: rental_id }
 *
 * For now: if fetch fails, we fall back to a mock response.
 */
async function createSaunaBookingClient(payload: any) {
  try {
    const res = await fetch("/api/rentals/create-sauna", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("create-sauna failed:", res.status, text);
      throw new Error("Server returned non-ok");
    }
    const json = await res.json();
    return json;
  } catch (e) {
    // Fallback mock — keeps UX responsive during dev
    await new Promise((r) => setTimeout(r, 700));
    return { success: true, id: "mock_sauna_" + Date.now() };
  }
}

export default function SaunaRentMegaPage() {
  const [starsBalance, setStarsBalance] = useState(120);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [startHour, setStartHour] = useState(18);
  const [durationHours, setDurationHours] = useState(3);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({
    cinema: false,
    jacuzzi: false,
    cleaning: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const sections = [
    { id: "hero", label: "Главная" },
    { id: "cabins", label: "Парилки" },
    { id: "pricing", label: "Цены" },
    { id: "extras", label: "Услуги" },
    { id: "staff", label: "Crew & Cleaning" },
    { id: "booking", label: "Бронирование" },
    { id: "support", label: "Саппорт" },
  ];
  const [activeId, setActiveId] = useState("hero");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const opts = { root: null, rootMargin: "0px", threshold: 0.5 };
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setActiveId(e.target.id);
      });
    }, opts);

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPrice = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const weekend = isWeekend(d);
    const friday = isFriday(d);
    const isEvening = startHour >= 18 || startHour < 6;
    const basePerHour = weekend
      ? isEvening
        ? BASE_PRICING.weekendEvening
        : BASE_PRICING.weekendDay
      : isEvening
      ? BASE_PRICING.weekdayEvening
      : BASE_PRICING.weekdayDay;
    let price = basePerHour * durationHours;
    if (friday) price = Math.round(price * BASE_PRICING.fridayExtendedMultiplier);

    if (selectedExtras.cinema) price += BASE_PRICING.cinemaFlat;
    if (selectedExtras.jacuzzi) price += BASE_PRICING.jacuzziFlat;
    if (selectedExtras.cleaning) price += BASE_PRICING.cleaningFlat;

    return price;
  }, [date, startHour, durationHours, selectedExtras]);

  const starsCost = Math.round(totalPrice / 100);
  const starsEarned = Math.max(0, Math.round((totalPrice * 0.1) / 100));

  function toggleExtra(key: keyof typeof selectedExtras) {
    setSelectedExtras((s) => ({ ...s, [key]: !s[key] }));
  }

  async function handleCreateBooking() {
    setIsSubmitting(true);
    setMessage("");

    const payload = {
      type: "sauna", // << IMPORTANT: server should interpret this type and use sauna flow
      date,
      startHour,
      durationHours,
      extras: Object.keys(selectedExtras).filter((k) => selectedExtras[k as keyof typeof selectedExtras]),
      price: totalPrice,
      starsUsed: Math.min(starsBalance, starsCost),
      // additional metadata for server: owner, location, images etc can be added
    };

    try {
      // Try real server endpoint first (see createSaunaBookingClient)
      const res = await createSaunaBookingClient(payload);

      if (!res || !res.success) throw new Error("Server error creating sauna booking");

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
      setStarsBalance((prev) => Math.max(0, prev - payload.starsUsed + starsEarned));
      setMessage("Бронирование создано. Проверь Telegram — счёт отправлен (или mock).");
    } catch (err) {
      console.error("Booking error:", err);
      setMessage("Ошибка при создании брони. Попробуй ещё.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatHour(h: number) {
    const s = (h % 24).toString().padStart(2, "0");
    return `${s}:00`;
  }

  // background imagery (more visuals)
  const heroBg = "https://images.unsplash.com/photo-1496412705862-e0088f16f791?q=80&w=2000&auto=format&fit=crop";
  const poolBg = "https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?q=80&w=1600&auto=format&fit=crop";
  const relaxBg = "https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1600&auto=format&fit=crop";

  return (
    <div className="relative min-h-screen bg-[#050403] text-[#fffdf6] antialiased">
      {/* hero steam svg/visual layer */}
      <div className="absolute inset-0 -z-10">
        <Image src={heroBg} alt="sauna hero" layout="fill" objectFit="cover" className="brightness-75" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-[#00000080] via-[#120a06aa] to-[#000000cc]" />
      </div>

      {/* inline sticky top bar */}
      <div className="sticky top-3 z-40 mx-auto container px-4">
        <div className="backdrop-blur-sm bg-[#00000050] border border-[#ffffff0d] rounded-xl p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ffd29b] to-[#ff8a00] flex items-center justify-center text-black font-bold">
              LÖ
            </div>
            <div>
              <div className="text-xs text-[#ffe9c7] font-mono">Löyly Vibe — Tibetan Edition</div>
              <div className="text-sm font-semibold">Резерв и управление</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <div className="text-xs text-[#ffd29b]">Твой баланс</div>
              <div className="text-lg font-extrabold flex items-center gap-2 text-[#fffdf6]">
                <VibeContentRenderer content="::FaStar::" className="w-5 h-5 text-yellow-400 inline" /> {starsBalance}★
              </div>
            </div>

            <nav className="hidden sm:flex items-center gap-3">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={cn(
                    "px-3 py-1 rounded-md text-sm font-mono",
                    activeId === s.id ? "bg-[#ffefdd] text-[#221b10]" : "text-[#ffefddcc] hover:bg-[#ffffff10]"
                  )}
                >
                  {s.label}
                </a>
              ))}
            </nav>

            <div className="sm:hidden flex items-center gap-2">
              <ActiveRentalsIndicator />
              <button
                onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })}
                className="px-3 py-1 rounded-md bg-[#ffd29b] text-[#120800] font-semibold text-sm"
                title="Бронирование"
              >
                Бронь
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12 space-y-14 relative z-10">
        {/* HERO */}
        <section id="hero" className="rounded-2xl overflow-hidden relative grid grid-cols-1 lg:grid-cols-2 gap-6 items-center p-6">
          <div className="space-y-4">
            {/* steam-wrap contains animated steam over the title */}
            <div className="steam-wrap relative inline-block">
              <h1 className="text-4xl md:text-5xl lg:text-6xl leading-tight font-orbitron font-extrabold text-[#fffaf0] drop-shadow-xl">
                Тибетская Löyly — Перезагрузка
              </h1>

              {/* Steam animation: decorative only (aria-hidden) */}
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="steam-layer">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>

            <p className="text-base text-[#efe8da] max-w-xl">
              Комната на 15 человек, парилка на 6, бассейн 3×3 (глубина 1.5—2м), джакузи на 2, стол на 10.
              Ночная сессия — тёплый свет, кино и лаунж.
            </p>

            <div className="flex gap-3 mt-4 flex-wrap">
              <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#ffd29b] text-[#241309]">
                Забронировать сейчас
              </Button>
              <Button variant="ghost" onClick={() => document.getElementById("extras")?.scrollIntoView({ behavior: "smooth" })}>
                Услуги
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#2b1b12]">
                <div className="text-xs text-[#ffd29b] font-semibold">Вместимость</div>
                <div className="text-lg font-bold text-[#fffdf6]">До 15 человек</div>
              </div>
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#2b1b12]">
                <div className="text-xs text-[#ffd29b] font-semibold">Парилка</div>
                <div className="text-lg font-bold text-[#fffdf6]">6 чел</div>
              </div>
            </div>
          </div>

          <div className="relative h-64 md:h-96 rounded-lg overflow-hidden shadow-lg">
            <Image src={relaxBg} alt="sauna relaxing" layout="fill" objectFit="cover" className="object-cover brightness-85" />
            <div className="absolute bottom-4 left-4 p-2 bg-[#00000088] rounded-lg text-xs text-[#fffdf6]">Кинотеатр — доп опция</div>
          </div>
        </section>

        {/* CABINS */}
        <section id="cabins" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fffaf0]">Наши зоны</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fffaf0]"><VibeContentRenderer content="::FaHotTubPerson::" /> Парилка</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative h-36 rounded overflow-hidden">
                  <Image src="https://images.unsplash.com/photo-1506629082955-511b1e1d9c2a?q=80&w=1200&auto=format&fit=crop" alt="parilka" layout="fill" objectFit="cover" className="opacity-80" />
                </div>
                <p className="text-sm text-[#e6dfd1] mt-3">Каменная парилка — сухой жар, эфирные масла по желанию. Места: 6.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fffaf0]"><VibeContentRenderer content="::FaWater::" /> Бассейн</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative h-36 rounded overflow-hidden">
                  <Image src={poolBg} alt="pool" layout="fill" objectFit="cover" className="opacity-85" />
                </div>
                <p className="text-sm text-[#e6dfd1] mt-3">3×3, глубина до 2м, опция охлаждения после парилки.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fffaf0]"><VibeContentRenderer content="::FaUsers::" /> Зона на компанию</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#e6dfd1]">Стол на 10 персон, лаунж, нарды, покер, джакузи на 2 — полный уют.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fffaf0]">Цены и режимы</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Дневной</div>
              <div className="text-xl font-bold text-[#fffaf0]">{BASE_PRICING.weekdayDay} ₽ / час</div>
              <div className="text-sm text-[#e6dfd1] mt-2">Пн—Чт 08:00—18:00</div>
            </div>
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Вечерний</div>
              <div className="text-xl font-bold text-[#fffaf0]">{BASE_PRICING.weekdayEvening} ₽ / час</div>
              <div className="text-sm text-[#e6dfd1] mt-2">Каждый день 18:00—02:00</div>
            </div>
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Выходные</div>
              <div className="text-xl font-bold text-[#fffaf0]">{BASE_PRICING.weekendDay}—{BASE_PRICING.weekendEvening} ₽ / час</div>
              <div className="text-sm text-[#e6dfd1] mt-2">Повышенный тариф в пт-вс</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#080707] rounded-lg border-border">
            <h4 className="font-semibold text-[#fffaf0]">Особые правила</h4>
            <ul className="list-disc list-inside mt-2 text-sm text-[#e6dfd1]">
              <li>Минимальная аренда — 2 часа.</li>
              <li>Пятница — удлинённый режим, люди часто остаются до утра.</li>
              <li>Максимум — 15 человек (одна сауна в локации).</li>
              <li>Кинотеатр и приставки — по запросу как доп. услуга.</li>
            </ul>
          </div>
        </section>

        {/* Extras */}
        <section id="extras" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fffaf0]">Дополнительные услуги</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="text-[#fffaf0]"><VibeContentRenderer content="::FaFilm::" /> Кинотеатр + приставка</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#e6dfd1]">Выбирай фильм/подключи приставку — контроллеры по запросу. Flat fee {BASE_PRICING.cinemaFlat} ₽.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="text-[#fffaf0]"><VibeContentRenderer content="::FaSpa::" /> Джакузи</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#e6dfd1]">Две камеры джакузи, идеально для релакса. {BASE_PRICING.jacuzziFlat} ₽.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="text-[#fffaf0]"><VibeContentRenderer content="::FaDice::" /> Игры: нарды, покер</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#e6dfd1]">Наборы нард, карты, фишки, стол — всё для вечеринки.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* STAFF */}
        <section id="staff" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fffaf0]">Crew & Cleaning — как это работает</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="text-[#fffaf0]"><VibeContentRenderer content="::FaUsers::" /> Клин-тим и персонал</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#e6dfd1]">Назначай клинеров/байк-корре для логистики: уборка между сменами, подвоз гостей и проч.</p>
                <ol className="list-decimal list-inside text-sm text-[#e6dfd1] mt-2">
                  <li>План уборок после смен — опция.</li>
                  <li>Клин-тим получает звезды за выполнение — геймификация.</li>
                  <li>Можно синхронизировать байк-прохваты между саунами.</li>
                </ol>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="text-[#fffaf0]"><VibeContentRenderer content="::FaHandSparkles::" /> Программа мотивации</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#e6dfd1]">За аренды, уборки и полезные дела начисляются звёзды — скидки на будущие брони.</p>
                <ul className="list-disc list-inside text-sm mt-2 text-[#e6dfd1]">
                  <li>Clean+ — бонус 5★ за качественную уборку.</li>
                  <li>Referral — привёл друга — 2★.</li>
                  <li>Сезонные кампании и промо для байк-крузов.</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* BOOKING FORM */}
        <section id="booking" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fffaf0]">Бронирование (Демо)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#0b0b0b] border-border">
                <CardHeader>
                  <CardTitle className="text-[#fffaf0]">Форма брони</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-mono">
                      Дата
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                        className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#efe8da]" />
                    </label>

                    <label className="text-xs font-mono">
                      Время начала
                      <select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))}
                        className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#efe8da]">
                        {Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}
                      </select>
                    </label>

                    <label className="text-xs font-mono">
                      Длительность (часы)
                      <input type="number" min={2} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))}
                        className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#efe8da]" />
                    </label>

                    <div className="text-xs font-mono">
                      Скидки и звезды
                      <div className="mt-1 text-sm text-[#efe8da]">Баланс: <strong>{starsBalance}★</strong> • Стоимость в звёздах: <strong>{starsCost}★</strong></div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-2">
                      <div className="flex gap-2 flex-wrap text-[#efe8da]">
                        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedExtras.cinema} onChange={() => toggleExtra("cinema" as any)} /> <span className="text-sm">Кинотеатр</span></label>
                        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedExtras.jacuzzi} onChange={() => toggleExtra("jacuzzi" as any)} /> <span className="text-sm">Джакузи</span></label>
                        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={selectedExtras.cleaning} onChange={() => toggleExtra("cleaning" as any)} /> <span className="text-sm">Проф. уборка</span></label>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-3">
                      <div className="p-3 rounded bg-[#080707] border border-[#2b1b12]">
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-[#efe8da]">Итого</div>
                          <div className="text-lg font-bold text-[#fffaf0]">{totalPrice} ₽</div>
                        </div>
                        <div className="text-xs text-[#d9d6cd] mt-1">Или ~ {starsCost}★. При оплате — начислим {starsEarned}★ cashback.</div>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-3">
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Доп. пожелания (обогрев, музыка, фильм)"
                        className="w-full p-3 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#efe8da] h-24" />
                    </div>

                    <div className="col-span-1 sm:col-span-2 flex gap-3 mt-2">
                      <Button onClick={handleCreateBooking} disabled={isSubmitting} className="w-full">{isSubmitting ? "Обработка..." : "Создать бронь и получить счёт в Telegram"}</Button>
                      <Button variant="ghost" onClick={() => { setDate(new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10)); setMessage(""); }}>Сброс</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-6 bg-[#080707] border-border">
                <CardHeader><CardTitle className="text-[#fffaf0]">История броней</CardTitle></CardHeader>
                <CardContent>
                  {bookings.length === 0 ? <div className="text-sm text-[#d9d6cd]">Пока что пусто — твои брони появятся здесь.</div> : (
                    <ul className="space-y-2">
                      {bookings.map(b => (
                        <li key={b.id} className="p-2 rounded bg-[#0b0b0b] border border-[#2b1b12]">
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-[#efe8da]">{b.date} • {formatHour(b.startHour)} • {b.durationHours}ч</div>
                            <div className="text-sm font-semibold text-[#fffaf0]">{b.price} ₽</div>
                          </div>
                          <div className="text-xs text-[#d9d6cd] mt-1">Экстры: {b.extras.join(', ') || '—'}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            <aside>
              <Card className="bg-[#0b0b0b] border-border md:sticky md:top-24">
                <CardHeader><CardTitle className="text-[#fffaf0]">Система звёзд</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-[#d9d6cd] mb-2">Твои звёзды — внутренняя валюта. Трать их на скидки или копи для будущих броней.</p>
                  <div className="p-3 bg-[#060606] rounded border border-[#2b1b12]">
                    <div className="text-xs text-[#efe8da]">Баланс</div>
                    <div className="text-3xl font-bold flex items-center gap-2 text-[#fffaf0]"><VibeContentRenderer content="::FaStar::" className="w-7 h-7 text-yellow-400" /> {starsBalance}★</div>
                    <div className="text-xs text-[#d9d6cd] mt-2">Начисления за предыдущие действия, рефералы, уборки.</div>

                    <div className="mt-3">
                      <div className="text-xs text-[#ffd29b]">Магазин скидок</div>
                      <ul className="mt-1 text-sm list-inside list-disc text-[#efe8da]">
                        <li>50★ — 500 ₽ скидка</li>
                        <li>100★ — 1200 ₽ скидка</li>
                        <li>200★ — 3000 ₽ скидка + VIP вечер</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-[#ffd29b] mb-2">Подпишись на оповещения уборки</div>
                    <p className="text-xs text-[#d9d6cd]">После аренд можешь подписаться на короткий shift уборки: люди получают задачу — чисто и получают звёзды.</p>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => alert("TODO: send subscription to /api/notify-cleanup")}>Подписаться</Button>
                      <Button variant="ghost" onClick={() => alert("TODO: show cleaning schedule")} className="text-[#fffaf0]">График</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#070707] border-border mt-6">
                <CardContent>
                  <h4 className="font-semibold text-[#fffaf0] mb-2">Быстрые ссылки</h4>
                  <ul className="text-sm list-inside space-y-2 text-[#e6dfd1]">
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
          <h3 className="text-2xl font-orbitron text-[#fffaf0]">Поддержка и заказ услуг</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fffaf0]">Заявки / Саппорт</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d9d6cd]">Заказ мероприятия: администрирование, доп. персонал, кейтеринг.</p>
                <div className="mt-3"><SupportForm /></div>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fffaf0]">Маркетинг и байк-креатив</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d9d6cd]">Комбинируй байк-тур + сауна. Ночной пакет + кино — лимитированные места.</p>
                <p className="text-xs text-[#cfc6b8] mt-2">TODO: API для bike->sauna pickups, crew assignments, promo codes.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="py-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h4 className="text-xl font-orbitron mb-2 text-[#fffaf0]">Готов взять ВАЙБ на себя?</h4>
            <p className="text-sm text-[#d9d6cd] mb-4">Бронируй сейчас — счёт в Telegram. Плати звёздами. Я вижу оплату и подтверждаю вручную.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })}>Забронировать</Button>
              <Button variant="ghost" onClick={() => document.getElementById("support")?.scrollIntoView({ behavior: "smooth" })}>Саппорт</Button>
            </div>
          </div>
        </section>
      </main>

      {/* mobile bottom steaming nav */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[92%] sm:w-[640px] md:hidden">
        <div className="bg-[#0b0b0b] border border-[#2b1b12] rounded-full p-2 flex justify-between items-center shadow-lg">
          {sections.map(s => <a key={s.id} href={`#${s.id}`} className={cn("flex-1 text-center p-2 rounded-full text-xs", activeId === s.id ? "bg-[#ffd29b] text-[#120800]" : "text-[#fff]")}>{s.label}</a>)}
        </div>
      </div>

      <aside className="hidden md:block fixed right-6 top-1/3 z-40">
        <div className="bg-[#0b0b0b] border border-[#2b1b12] rounded-xl p-2 w-44 shadow-xl">
          <div className="text-xs text-[#ffd29b] mb-2">Навигация</div>
          <div className="flex flex-col gap-2">
            {sections.map(s => <a key={s.id} href={`#${s.id}`} className={cn("p-2 rounded-md text-sm", activeId === s.id ? "bg-[#ffd29b] text-[#120800]" : "text-[#fff] hover:bg-[#ffffff10]")}>{s.label}</a>)}
          </div>
        </div>
      </aside>

      <style jsx>{`
        .font-orbitron { font-family: 'Orbitron', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }

        /* Steam animation styles */
        .steam-layer { position: absolute; inset: -20% 0 0 0; display: flex; justify-content: center; gap: 8px; }
        .steam-layer span {
          display: block; width: 12%; height: 160px; background: radial-gradient(closest-side, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border-radius: 50%;
          transform: translateY(40px) scale(0.6); opacity: 0;
          animation: steamRise 6s linear infinite;
          filter: blur(12px);
        }
        .steam-layer span:nth-child(2) { animation-delay: 1.2s; width: 18%; }
        .steam-layer span:nth-child(3) { animation-delay: 2.6s; width: 14%; }

        @keyframes steamRise {
          0% { transform: translateY(40px) scale(0.6); opacity: 0; }
          20% { opacity: 0.35; transform: translateY(-10px) scale(0.85); }
          50% { opacity: 0.18; transform: translateY(-70px) scale(1.05); }
          90% { opacity: 0.02; transform: translateY(-150px) scale(1.3); }
          100% { opacity: 0; transform: translateY(-220px) scale(1.5); }
        }

        /* Responsive adjustments */
        @media (min-width: 768px) {
          .steam-layer { left: 0; right: 0; }
        }
      `}</style>
    </div>
  );
}