"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import SupportForm from "@/components/SupportForm";
import { cn } from "@/lib/utils";
import { ActiveRentalsIndicator } from "@/components/ActiveRentalsIndicator"; // restore indicator (named export)
import { useAppContext } from "@/contexts/AppContext";

// Server action - MUST be exported as a server action wrapper in app/sauna-rent/actions.ts
// Example wrapper signature expected:
// export async function createSaunaBooking(payload: { saunaVehicleId: string; startIso: string; endIso: string; price: number; extras?: string[]; starsUsed?: number; userId?: string; }) { "use server"; ... }
import { createSaunaBooking } from "@/app/sauna-rent/actions"; // <-- NEW FILE exists and is a server action

// -----------------------------------------------------------------------------
// MEGA Sauna-Rent Page — "Tibetan Vibe" edition
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

export default function SaunaRentMegaPage() {
  const { dbUser } = useAppContext(); // for server action / debug (if needed)
  const [starsBalance, setStarsBalance] = useState<number>(120);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Form state
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [startHour, setStartHour] = useState(18);
  const [durationHours, setDurationHours] = useState(3);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({ cinema: false, jacuzzi: false, cleaning: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  // Sticky nav & active section
  const sections = [
    { id: "hero", label: "Главная" },
    { id: "cabins", label: "Парилки" },
    { id: "pricing", label: "Цены" },
    { id: "extras", label: "Услуги" },
    { id: "staff", label: "Crew" },
    { id: "booking", label: "Бронирование" },
    { id: "support", label: "Саппорт" },
  ];
  const [activeId, setActiveId] = useState("hero");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const opts = { root: null, rootMargin: "0px", threshold: 0.45 };
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.target.id) setActiveId(e.target.id);
      });
    }, opts);

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  // Pricing calc
  const totalPrice = useMemo(() => {
    const d = new Date(date + "T00:00:00");
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

  const starsCost = Math.round(totalPrice / 100);
  const starsEarned = Math.max(0, Math.round(totalPrice * 0.1 / 100));

  function toggleExtra(key: keyof typeof selectedExtras) {
    setSelectedExtras((s) => ({ ...s, [key]: !s[key] }));
  }

  function formatHour(h: number) {
    const s = (h % 24).toString().padStart(2, "0");
    return `${s}:00`;
  }

  // compute start/end ISO with local timezone corrected to ISO
  function computeStartEndIso(selectedDate: string, hour: number, duration: number) {
    const start = new Date(selectedDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime());
    end.setHours(start.getHours() + duration);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  // Create booking via server action
  async function handleCreateBooking() {
    setIsSubmitting(true);
    setMessage("");

    const { startIso, endIso } = computeStartEndIso(date, startHour, durationHours);

    const payload = {
      saunaVehicleId: "sauna_1", // single sauna id
      startIso,
      endIso,
      price: totalPrice,
      extras: Object.keys(selectedExtras).filter((k) => (selectedExtras as any)[k]),
      starsUsed: Math.min(starsBalance, starsCost),
      // optionally include user id if needed by server action:
      userId: dbUser?.user_id ?? undefined,
    };

    try {
      // IMPORTANT: createSaunaBooking is expected to be a server action (use server) that
      // creates a rental row in `rentals` table with metadata.type = 'sauna' OR uses car_rental flow.
      // If it doesn't exist yet, implement it as a wrapper over createBooking/createInvoice on server.
      const res = await createSaunaBooking(payload as any);
      if (!res || !res.success) {
        throw new Error(res?.error || "Server failed to create sauna booking");
      }

      const id = res?.data?.rental_id || res?.data?.id || `bk_${Date.now()}`;

      const newBooking: Booking = {
        id,
        date,
        startHour,
        durationHours,
        price: totalPrice,
        starsUsed: payload.starsUsed || 0,
        extras: payload.extras || [],
        createdAt: new Date().toISOString(),
      };

      setBookings((b) => [newBooking, ...b]);
      setStarsBalance((prev) => Math.max(0, prev - (payload.starsUsed || 0) + starsEarned));

      setMessage("Бронь создана — счёт отправлен в Telegram (проверь бота).");
    } catch (err: any) {
      console.error("Booking error:", err);
      setMessage("Ошибка при создании брони. Попробуй ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Decorative tibetan background (SVG)
  const tibetanBg = (
    <svg className="absolute inset-0 w-full h-full opacity-6" preserveAspectRatio="none" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tg" x1="0" x2="1">
          <stop offset="0" stopColor="#ffedd5" stopOpacity="0.03" />
          <stop offset="1" stopColor="#bde0fe" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#tg)" />
      <g fill="none" stroke="#fef3c7" strokeOpacity="0.02" strokeWidth="1">
        <circle cx="120" cy="100" r="120" />
        <circle cx="560" cy="420" r="220" />
      </g>
    </svg>
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#030203] via-[#101217] to-[#1b1512] text-[#f6f1ea] antialiased overflow-x-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden">{tibetanBg}</div>

      {/* STICKY top bar (inline header for this page) */}
      <div className="sticky top-2 z-40 mx-auto container px-4">
        <div className="backdrop-blur-sm bg-[#00000066] border border-[#ffffff0d] rounded-xl p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ffd29b] to-[#ff8a00] flex items-center justify-center text-black font-bold">LÖ</div>
            <div>
              <div className="text-xs text-[#ffe9c7] font-mono">Löyly Vibe — Tibetan Edition</div>
              <div className="text-sm font-semibold text-[#fff]">Резерв и управление</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Active rentals indicator restored - this is clickable and shows minimal indicator UI */}
            <div className="flex items-center gap-3">
              

              {/* Indicator (clicks to /rentals) */}
              <div className="hidden sm:block">
                <ActiveRentalsIndicator />
              </div>
            </div>

            {/* Balance - make contrast strong */}
            <div className="flex flex-col items-end">
              <div className="text-xs text-[#ffe9c7]">Твой баланс</div>
              <div className="text-lg font-bold flex items-center gap-2 text-[#fff]">
                <VibeContentRenderer content="::FaStar::" className="w-5 h-5 text-yellow-400 inline" /> {starsBalance}★
              </div>
            </div>

            {/* mobile quick booking */}
            <div className="sm:hidden">
              <Link href="#booking"><a className="px-3 py-1 rounded-md bg-[#ffd29b] text-[#120800] font-semibold text-sm">Бронь</a></Link>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-12 relative z-10">
        {/* HERO (taller) */}
        <section id="hero" className="rounded-2xl overflow-hidden relative grid grid-cols-1 lg:grid-cols-2 gap-6 items-center bg-gradient-to-br from-[#22180f]/40 to-[#0f1a16]/20 p-8 min-h-[740px]">
          <div className="space-y-6 z-10 relative">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-orbitron leading-tight relative">
              <span className="block text-[#ffffff]">Тибетская Löyly</span>
              <span className="block text-[#ffd29b]">Перезагрузка тела и ума</span>

              {/* steam wisps — presentational only */}
              <span className="steam top-0 left-0 -translate-y-6" aria-hidden />
              <span className="steam-delay top-0 left-0 -translate-y-6" aria-hidden />
            </h1>

            <p className="text-sm text-[#e7dfd1] max-w-xl">Комната до 15 человек, парилка на 6, бассейн 3×3 (1.5—2 м), джакузи на 2, стол на 10 — ночные сессии с кино и лаунжем.</p>

            <div className="flex gap-3 mt-4 flex-wrap">
              <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#ffd29b] text-[#241309]">Забронировать сейчас</Button>
              <Button variant="ghost" onClick={() => document.getElementById("extras")?.scrollIntoView({ behavior: "smooth" })}>Услуги</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#2b1b12]">
                <div className="text-xs text-[#ffd29b] font-semibold">Вместимость</div>
                <div className="text-lg font-bold text-[#fff]">До 15 человек</div>
              </div>
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#2b1b12]">
                <div className="text-xs text-[#ffd29b] font-semibold">Парилка</div>
                <div className="text-lg font-bold text-[#fff]">6 чел</div>
              </div>
            </div>
          </div>

          <div className="relative h-96 md:h-[520px] rounded-lg overflow-hidden shadow-lg">
            <Image src="https://images.unsplash.com/photo-1556020685-8e4d2f4e6e8b?q=80&w=2000&auto=format&fit=crop" alt="sauna" layout="fill" objectFit="cover" className="object-cover brightness-90" />
            <div className="absolute bottom-4 left-4 p-2 bg-[#00000066] rounded-lg text-xs text-[#fff]">Кинотеатр — доп. опция</div>
          </div>
        </section>

        {/* CABINS */}
        <section id="cabins" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Наши зоны</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fff]"><VibeContentRenderer content="::FaHotTubPerson::" /> Парилка</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Каменная парилка — сухой жар, эфирные масла по желанию. Места: 6.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fff]"><VibeContentRenderer content="::FaWater::" /> Бассейн</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">3m × 3m, глубина до 2m, опция охлаждения после парилки.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fff]"><VibeContentRenderer content="::FaUsers::" /> Зона на компанию</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Стол на 10, лаунж, нарды, покер, джакузи — всё для вечеринки.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Цены и режимы</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Дневной</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekdayDay} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Пн—Чт 08:00—18:00</div>
            </div>
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Вечерний</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekdayEvening} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Каждый день 18:00—02:00</div>
            </div>
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Выходные</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekendDay}—{BASE_PRICING.weekendEvening} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Повышенный тариф в пт-вс</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#080707] rounded-lg border-border">
            <h4 className="font-semibold text-[#fff]">Особые правила</h4>
            <ul className="list-disc list-inside mt-2 text-sm text-[#ddd]">
              <li>Минимальная аренда — 2 часа.</li>
              <li>Пятница — удлинённый режим, люди часто остаются до утра.</li>
              <li>Максимум — 15 человек (одна сауна в локации).</li>
              <li>Кинотеатр и приставки — по запросу как доп. услуга.</li>
            </ul>
          </div>
        </section>

        {/* Extras */}
        <section id="extras" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Дополнительные услуги</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]"><VibeContentRenderer content="::FaFilm::" /> Кинотеатр + приставка</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Выбирай фильм/подключай приставку — можем привезти контроллеры. Flat fee {BASE_PRICING.cinemaFlat} ₽.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]"><VibeContentRenderer content="::FaSpa::" /> Джакузи</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Две камеры джакузи, идеальны для пар и релаксации. {BASE_PRICING.jacuzziFlat} ₽.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]"><VibeContentRenderer content="::FaDice::" /> Игры: нарды, покер</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Комплекты нард, карты, фишки — всё для вечеринки.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* STAFF */}
        <section id="staff" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Crew & Cleaning — как это работает</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]"><VibeContentRenderer content="::FaUsers::" /> Клин-тим и персонал</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Назначай клинеров/байкер-курьеров: уборка между сменами, подвоз гостей, проверка оборудования.</p>
                <ol className="list-decimal list-inside text-sm text-[#ddd] mt-2">
                  <li>План уборок после каждой смены — опция для заказчика.</li>
                  <li>Клин-тим получает звезды за выполненную уборку (геймификация).</li>
                  <li>Синхронизировать байк-прохваты между локациями (crew mobility).</li>
                </ol>
                <p className="text-xs text-[#cfc6b8] mt-3">TODO: API to assign shifts, Telegram notifications and stars accounting.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]"><VibeContentRenderer content="::FaHandSparkles::" /> Программа мотивации</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">За аренду, уборку или полезные действия начисляем звезды. Используй их как скидку при будущих бронированиях.</p>
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
          <h3 className="text-2xl font-orbitron text-[#fff]">Бронирование (Демо)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#0b0b0b] border-border">
                <CardHeader><CardTitle className="text-[#fff]">Форма брони</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-mono text-[#fff]">Дата
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]" />
                    </label>

                    <label className="text-xs font-mono text-[#fff]">Время начала
                      <select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]">
                        {Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}
                      </select>
                    </label>

                    <label className="text-xs font-mono text-[#fff]">Длительность (часы)
                      <input type="number" min={2} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]" />
                    </label>

                    <div className="text-xs font-mono text-[#fff]">Скидки и звезды
                      <div className="mt-1 text-sm text-[#fff]">Баланс: <strong className="text-[#ffd879]">{starsBalance}★</strong> • Стоимость в звёздах: <strong className="text-[#ffd879]">{starsCost}★</strong></div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-2">
                      <div className="flex gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.cinema} onChange={() => toggleExtra('cinema' as any)} /> <span className="text-sm">Кинотеатр</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.jacuzzi} onChange={() => toggleExtra('jacuzzi' as any)} /> <span className="text-sm">Джакузи</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.cleaning} onChange={() => toggleExtra('cleaning' as any)} /> <span className="text-sm">Проф. уборка</span>
                        </label>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-3">
                      <div className="p-3 rounded bg-[#080707] border border-[#2b1b12]">
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-[#fff]">Итого</div>
                          <div className="text-lg font-bold text-[#fff]">{totalPrice} ₽</div>
                        </div>
                        <div className="text-xs text-[#d9d6cd] mt-1">Или ~ {starsCost}★ (прибл.). При оплате — начислим {starsEarned}★ cashback.</div>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-3">
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Доп. пожелания (обогрев, музыка, фильм)" className="w-full p-3 rounded bg-[#141212] border border-[#2b1b12] text-sm h-24 text-[#fff]" />
                    </div>

                    {/* Buttons — stacked on mobile, row on desktop */}
                    <div className="col-span-1 sm:col-span-2 mt-2">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={handleCreateBooking} disabled={isSubmitting} className="flex-1">
                          {isSubmitting ? "Обработка..." : "Создать бронь и получить счёт в Telegram"}
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={() => {
                            setDate(new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10));
                            setMessage("");
                            setSelectedExtras({ cinema: false, jacuzzi: false, cleaning: false });
                            setDurationHours(3);
                            setStartHour(18);
                          }}
                          className="w-full sm:w-auto border border-[#ff6b6b] text-[#ffb6b6] hover:bg-[#2a0c0c]"
                        >
                          Сброс
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Booking history */}
              <Card className="mt-6 bg-[#080707] border-border">
                <CardHeader><CardTitle className="text-[#fff]">История броней</CardTitle></CardHeader>
                <CardContent>
                  {bookings.length === 0 ? <div className="text-sm text-[#d9d6cd]">Пока что пусто — твои брони появятся здесь.</div> : (
                    <ul className="space-y-2">
                      {bookings.map((b) => (
                        <li key={b.id} className="p-2 rounded bg-[#0b0b0b] border border-[#2b1b12]">
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-[#fff]">{b.date} • {formatHour(b.startHour)} • {b.durationHours}ч</div>
                            <div className="text-sm font-semibold text-[#fff]">{b.price} ₽</div>
                          </div>
                          <div className="text-xs text-[#d9d6cd] mt-1">Экстры: {b.extras.join(", ") || "—"}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column */}
            <aside>
              <Card className="bg-[#0b0b0b] border-border md:sticky md:top-24">
                <CardHeader><CardTitle className="text-[#fff]">Система звёзд</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-[#d9d6cd] mb-2">Твои звезды — внутренняя валюта. Трать их на скидки или копи для будущих броней.</p>
                  <div className="p-3 bg-[#060606] rounded border border-[#2b1b12]">
                    <div className="text-xs text-[#ffd29b]">Баланс</div>
                    <div className="text-3xl font-bold flex items-center gap-2 text-[#fff]"><VibeContentRenderer content="::FaStar::" className="w-7 h-7 text-yellow-400" /> {starsBalance}★</div>
                    <div className="text-xs text-[#d9d6cd] mt-2">Суммарно: начисления за действия, рефералы, уборки.</div>

                    <div className="mt-3">
                      <div className="text-xs text-[#ffd29b]">Магазин скидок</div>
                      <ul className="mt-1 text-sm list-inside list-disc text-[#d9d6cd]">
                        <li>50★ — 500 ₽ скидка</li>
                        <li>100★ — 1200 ₽ скидка</li>
                        <li>200★ — 3000 ₽ скидка + VIP вечер</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-[#ffd29b] mb-2">Подпишись на оповещения уборки</div>
                    <p className="text-xs text-[#d9d6cd]">После аренды можно подписаться на короткий shift уборки: за работу платят звёздами.</p>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => alert("TODO: send subscription to /api/notify-cleanup")}>Подписаться</Button>
                      <Button variant="ghost" onClick={() => alert("TODO: show cleaning schedule")} className="border border-[#2b1b12] text-[#fff]">График</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#070707] border-border mt-6">
                <CardContent>
                  <h4 className="font-semibold mb-2 text-[#fff]">Быстрые ссылки</h4>
                  <ul className="text-sm list-inside space-y-2 text-[#d9d6cd]">
                    <li><Link href="/vipbikerental"><a className="text-[#fff] hover:underline">VIP Байк</a></Link></li>
                    <li><Link href="/repo-xml"><a className="text-[#fff] hover:underline">/repo-xml Studio</a></Link></li>
                    <li><Link href="/selfdev"><a className="text-[#fff] hover:underline">SelfDev</a></Link></li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </div>
        </section>

        {/* SUPPORT */}
        <section id="support" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Поддержка и заказ услуг</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Заявки / Саппорт</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d9d6cd]">Если хочешь заказать комплексную организацию мероприятия: администрирование, доп. персонал, закупки, кейтеринг — оставь заявку.</p>
                <div className="mt-3"><SupportForm /></div>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Маркетинг и байк-креатив</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d9d6cd]">Идеи: комбинировать байк-тур + сауна (crew mobility). Промо: ночной пакет + кино + бар — лимитированные места.</p>
                <p className="text-xs text-[#cfc6b8] mt-2">TODO: expose API to schedule bike→sauna pickups, crew assignments and promo codes.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FOOTER CTA */}
        <section className="py-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h4 className="text-xl font-orbitron mb-2 text-[#fff]">Готов взять ВАЙБ на себя?</h4>
            <p className="text-sm text-[#d9d6cd] mb-4">Бронируй сейчас — счёт в Telegram. Плати звёздами. Я вижу оплату и подтверждаю вручную.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })}>Забронировать</Button>
              <Button variant="ghost" onClick={() => document.getElementById("support")?.scrollIntoView({ behavior: "smooth" })}>Саппорт</Button>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile floating nav */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[92%] sm:w-[640px] md:hidden">
        <div className="bg-[#0b0b0b] border border-[#2b1b12] rounded-full p-2 flex justify-between items-center shadow-lg">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={cn("flex-1 text-center p-2 rounded-full text-xs", activeId === s.id ? "bg-[#ffd29b] text-[#120800]" : "text-[#fff]")}>{s.label}</a>
          ))}
        </div>
      </div>

      {/* Desktop steam nav */}
      <aside className="hidden md:block fixed right-6 top-1/3 z-40">
        <div className="bg-[#0b0b0b] border border-[#2b1b12] rounded-xl p-2 w-44 shadow-xl">
          <div className="text-xs text-[#ffd29b] mb-2">Навигация</div>
          <div className="flex flex-col gap-2">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={cn("p-2 rounded-md text-sm", activeId === s.id ? "bg-[#ffd29b] text-[#120800]" : "text-[#fff] hover:bg-[#ffffff10]")}>{s.label}</a>
            ))}
          </div>
        </div>
      </aside>

      <style jsx>{`
        .font-orbitron { font-family: 'Orbitron', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }

        /* Steam wisps */
        .steam, .steam-delay {
          position: absolute;
          display: block;
          width: 120%;
          height: 18%;
          left: -10%;
          top: 8%;
          pointer-events: none;
        }
        .steam::before, .steam-delay::before {
          content: "";
          position: absolute;
          left: 10%;
          right: 10%;
          top: 0;
          height: 100%;
          background: radial-gradient(closest-side, rgba(255,255,255,0.06), rgba(255,255,255,0) 60%);
          transform: translateY(0) scaleX(1.05);
          filter: blur(10px);
          opacity: 0.65;
          animation: rise 6s linear infinite;
        }
        .steam-delay::before { animation-delay: 1.2s; opacity: 0.45; filter: blur(12px); }

        @keyframes rise {
          0% { transform: translateY(12px) scaleX(1.02); opacity: 0.55; }
          50% { transform: translateY(-24px) scaleX(1.08); opacity: 0.18; }
          100% { transform: translateY(-60px) scaleX(1.12); opacity: 0; }
        }

        @media (max-width: 640px) {
          main { padding-bottom: 140px; }
        }
      `}</style>
    </div>
  );
}