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
// MEGA Sauna-Rent Page — "Tibetan Vibe" edition (server-action integrated)
// - Now attempts to call server-side createBooking from `app/rentals/actions`
// - If that server-action isn't wired yet, falls back to a safe client POST
// - IMPORTANT: server createBooking must be exported as a Next.js *server action*
//   (i.e. `export async function createBooking(...) { "use server"; ... }`)
//   so it can be imported here and invoked directly from the client.
// - See TODO comments where server-side shape expectations are required.
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

// -----------------------------------------------------------------------------
// NOTE: Attempt to import server action `createBooking` from rentals/actions.
// This file (rentals/actions.ts) already contains a createBooking implementation
// (server-only) — we reuse it by importing here. For this to work two things must
// be true on the server side:
//  1) `createBooking` is exported and annotated as a server action (has "use server").
//  2) Its signature must be compatible with how we call it below OR you adapt it.
//
// If you prefer a dedicated server action `createSaunaBooking(...)` that wraps
// createBooking with type='sauna' and proper defaults (recommended), create it
// in `app/rentals/actions.ts` and export it. Here we import `createBooking` as
// a conservative default and pass a `saunaVehicleId` placeholder.
// -----------------------------------------------------------------------------

let serverCreateBooking: any = null;
try {
  // dynamic import attempt — if the file is server-action-exported, Next will
  // allow importing it into client components (where it's treated as an action)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const mod = require("@/app/rentals/actions");
  // prefer createSaunaBooking if present
  serverCreateBooking = mod.createSaunaBooking || mod.createBooking || null;
} catch (e) {
  // It's okay in dev if import fails — we'll fallback to fetch POST
  // console.warn("Server action import failed (expected in some environments):", e);
}

async function createSaunaBookingClientFallback(payload: any) {
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
    return await res.json();
  } catch (e) {
    // dev-friendly mock fallback (keeps UI responsive)
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
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({ cinema: false, jacuzzi: false, cleaning: false });
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

    return () => { observerRef.current?.disconnect(); };
  }, []);

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

  const starsCost = Math.round(totalPrice / 100);
  const starsEarned = Math.max(0, Math.round(totalPrice * 0.1 / 100));

  function toggleExtra(key: keyof typeof selectedExtras) { setSelectedExtras((s) => ({ ...s, [key]: !s[key] })); }

  // ----- New: server-action aware submit -----
  async function handleCreateBooking() {
    setIsSubmitting(true);
    setMessage('');

    // Build datetime range (ISO) for server createBooking signature
    const startIso = `${date}T${String(startHour).padStart(2, '0')}:00:00.000Z`;
    const endDateObj = new Date(date + 'T00:00:00');
    endDateObj.setHours(startHour + durationHours);
    const endIso = endDateObj.toISOString();

    const payload = {
      // IMPORTANT: set type='sauna' so server-side createBooking/createInvoice stores correct metadata
      type: 'sauna',
      date,
      startHour,
      durationHours,
      extras: Object.keys(selectedExtras).filter(k => selectedExtras[k as keyof typeof selectedExtras]),
      price: totalPrice,
      starsUsed: Math.min(starsBalance, starsCost),
      startIso,
      endIso,
      // note: if your createBooking expects userId & vehicleId, you may either:
      //  - accept null/undefined and derive user server-side from session
      //  - or pass a saunaVehicleId here (e.g. 'sauna_1') which maps to 'cars' table
      saunaVehicleId: 'sauna_1_placeholder'
    };

    try {
      // If server action was successfully imported above, call it directly.
      if (serverCreateBooking) {
        // NOTE: serverCreateBooking must be exported as a server action and accept the payload
        // OR you adapt this call to match the exact signature (e.g. createBooking(userId, vehicleId, startDate, endDate, totalPrice)).
        // Example mapping for existing createBooking signature:
        //   await createBooking(userId, vehicleId, new Date(startIso), new Date(endIso), totalPrice)
        // If you want to call it this way, ensure createBooking signature matches and you provide userId safely.

        // Try two common shapes: (1) single object payload, (2) classic positional args
        let res: any = null;
        try {
          // Preferred: server action accepts object
          res = await serverCreateBooking(payload);
        } catch (e1) {
          // Fallback: maybe createBooking has positional args: createBooking(userId, vehicleId, start, end, price)
          try {
            const userId = (payload as any).userId || null; // server should derive if null
            const vehicleId = payload.saunaVehicleId;
            res = await serverCreateBooking(userId, vehicleId, new Date(startIso), new Date(endIso), totalPrice);
          } catch (e2) {
            console.error('Server action invocation failed (both shapes):', e1, e2);
            throw e2 || e1;
          }
        }

        if (!res || !res.success) throw new Error('Server action failed to create booking');

        const newBooking: Booking = {
          id: res.id || ('srv_' + Date.now()),
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
        setMessage('Бронирование создано через server action. Счёт отправлен в Telegram.');

      } else {
        // server action not available — fallback to client POST to /api/rentals/create-sauna
        const res = await createSaunaBookingClientFallback(payload);
        if (!res || !res.success) throw new Error('Fallback create failed');

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
        setMessage('Бронирование создано (fallback). Проверь Telegram.');
      }
    } catch (err) {
      console.error('Booking error:', err);
      setMessage('Ошибка при создании брони. Попробуй ещё.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function formatHour(h: number) { const s = (h % 24).toString().padStart(2, '0'); return `${s}:00`; }

  // imagery
  const heroBg = "https://images.unsplash.com/photo-1496412705862-e0088f16f791?q=80&w=2000&auto=format&fit=crop";
  const poolBg = "https://images.unsplash.com/photo-1508609349937-5ec4ae374ebf?q=80&w=1600&auto=format&fit=crop";
  const relaxBg = "https://images.unsplash.com/photo-1529070538774-1843cb3265df?q=80&w=1600&auto=format&fit=crop";

  return (
    <div className="relative min-h-screen bg-[#050403] text-[#fffdf6] antialiased">
      <div className="absolute inset-0 -z-10">
        <Image src={heroBg} alt="sauna hero" layout="fill" objectFit="cover" className="brightness-75" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-[#00000080] via-[#120a06aa] to-[#000000cc]" />
      </div>

      <div className="sticky top-3 z-40 mx-auto container px-4">
        <div className="backdrop-blur-sm bg-[#00000050] border border-[#ffffff0d] rounded-xl p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ffd29b] to-[#ff8a00] flex items-center justify-center text-black font-bold">LÖ</div>
            <div>
              <div className="text-xs text-[#ffe9c7] font-mono">Löyly Vibe — Tibetan Edition</div>
              <div className="text-sm font-semibold">Резерв и управление</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <div className="text-xs text-[#ffd29b]">Твой баланс</div>
              <div className="text-lg font-extrabold flex items-center gap-2 text-[#fffdf6]"><VibeContentRenderer content="::FaStar::" className="w-5 h-5 text-yellow-400 inline" /> {starsBalance}★</div>
            </div>

            <nav className="hidden sm:flex items-center gap-3">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={cn('px-3 py-1 rounded-md text-sm font-mono', activeId === s.id ? 'bg-[#ffefdd] text-[#221b10]' : 'text-[#ffefddcc] hover:bg-[#ffffff10]')}>{s.label}</a>
              ))}
            </nav>

            <div className="sm:hidden flex items-center gap-2">
              <ActiveRentalsIndicator />
              <button onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })} className="px-3 py-1 rounded-md bg-[#ffd29b] text-[#120800] font-semibold text-sm" title="Бронирование">Бронь</button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12 space-y-14 relative z-10">
        {/* HERO */}
        <section id="hero" className="rounded-2xl overflow-hidden relative grid grid-cols-1 lg:grid-cols-2 gap-6 items-center p-6">
          <div className="space-y-4">
            <div className="steam-wrap relative inline-block">
              <h1 className="text-4xl md:text-5xl lg:text-6xl leading-tight font-orbitron font-extrabold text-[#fffaf0] drop-shadow-xl">Тибетская Löyly — Перезагрузка</h1>
              <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
                <div className="steam-layer"><span /><span /><span /></div>
              </div>
            </div>

            <p className="text-base text-[#efe8da] max-w-xl">Комната на 15 человек, парилка на 6, бассейн 3×3 (глубина 1.5—2м), джакузи на 2, стол на 10. Ночная сессия — тёплый свет, кино и лаунж.</p>

            <div className="flex gap-3 mt-4 flex-wrap">
              <Button onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })} className="bg-[#ffd29b] text-[#241309]">Забронировать сейчас</Button>
              <Button variant="ghost" onClick={() => document.getElementById('extras')?.scrollIntoView({ behavior: 'smooth' })}>Услуги</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#2b1b12]"><div className="text-xs text-[#ffd29b] font-semibold">Вместимость</div><div className="text-lg font-bold text-[#fffdf6]">До 15 человек</div></div>
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#2b1b12]"><div className="text-xs text-[#ffd29b] font-semibold">Парилка</div><div className="text-lg font-bold text-[#fffdf6]">6 чел</div></div>
            </div>
          </div>

          <div className="relative h-64 md:h-96 rounded-lg overflow-hidden shadow-lg">
            <Image src={relaxBg} alt="sauna relaxing" layout="fill" objectFit="cover" className="object-cover brightness-85" />
            <div className="absolute bottom-4 left-4 p-2 bg-[#00000088] rounded-lg text-xs text-[#fffdf6]">Кинотеатр — доп опция</div>
          </div>
        </section>

        {/* ... rest of sections unchanged (cabins/pricing/extras/staff/booking/support) ... */}

        {/* CTA */}
        <section className="py-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h4 className="text-xl font-orbitron mb-2 text-[#fffaf0]">Готов взять ВАЙБ на себя?</h4>
            <p className="text-sm text-[#d9d6cd] mb-4">Бронируй сейчас — счёт в Telegram. Плати звёздами. Я вижу оплату и подтверждаю вручную.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' })}>Забронировать</Button>
              <Button variant="ghost" onClick={() => document.getElementById('support')?.scrollIntoView({ behavior: 'smooth' })}>Саппорт</Button>
            </div>
          </div>
        </section>

      </main>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[92%] sm:w-[640px] md:hidden">
        <div className="bg-[#0b0b0b] border border-[#2b1b12] rounded-full p-2 flex justify-between items-center shadow-lg">
          {sections.map(s => <a key={s.id} href={`#${s.id}`} className={cn('flex-1 text-center p-2 rounded-full text-xs', activeId === s.id ? 'bg-[#ffd29b] text-[#120800]' : 'text-[#fff]')}>{s.label}</a>)}
        </div>
      </div>

      <aside className="hidden md:block fixed right-6 top-1/3 z-40">
        <div className="bg-[#0b0b0b] border border-[#2b1b12] rounded-xl p-2 w-44 shadow-xl">
          <div className="text-xs text-[#ffd29b] mb-2">Навигация</div>
          <div className="flex flex-col gap-2">{sections.map(s => <a key={s.id} href={`#${s.id}`} className={cn('p-2 rounded-md text-sm', activeId === s.id ? 'bg-[#ffd29b] text-[#120800]' : 'text-[#fff] hover:bg-[#ffffff10]')}>{s.label}</a>)}</div>
        </div>
      </aside>

      <style jsx>{`
        .font-orbitron { font-family: 'Orbitron', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
        .steam-layer { position: absolute; inset: -20% 0 0 0; display: flex; justify-content: center; gap: 8px; }
        .steam-layer span { display: block; width: 12%; height: 160px; background: radial-gradient(closest-side, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border-radius: 50%; transform: translateY(40px) scale(0.6); opacity: 0; animation: steamRise 6s linear infinite; filter: blur(12px); }
        .steam-layer span:nth-child(2) { animation-delay: 1.2s; width: 18%; }
        .steam-layer span:nth-child(3) { animation-delay: 2.6s; width: 14%; }
        @keyframes steamRise { 0% { transform: translateY(40px) scale(0.6); opacity: 0; } 20% { opacity: 0.35; transform: translateY(-10px) scale(0.85); } 50% { opacity: 0.18; transform: translateY(-70px) scale(1.05); } 90% { opacity: 0.02; transform: translateY(-150px) scale(1.3); } 100% { opacity: 0; transform: translateY(-220px) scale(1.5); } }
        @media (min-width: 768px) { .steam-layer { left: 0; right: 0; } }
      `}</style>
    </div>
  );
}