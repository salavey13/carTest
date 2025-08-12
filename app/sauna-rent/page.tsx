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
import { useAppContext } from "@/contexts/AppContext";

// Server action wrapper for bookings
import { createSaunaBooking } from "@/app/sauna-rent/actions";

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
  weekdayHour: 1500,
  // weekend / special
  weekendHour: 2000,
  fridayToMondayHour: 2000,
  cinemaFlat: 3000,
  parilshikFlat: 1200,
  cleaningFlat: 500,
};

function isWeekend(date: Date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}
function isFridayToMondayWindow(date: Date) {
  // For pricing note: special window starts Fri 15:00 and continues until Mon 09:00.
  // We'll detect weekend/friday roughly by day; advanced detection requires times.
  const day = date.getDay();
  return day === 5 || day === 6 || day === 0 || day === 1;
}

export default function SaunaVolnaPage() {
  const { dbUser } = useAppContext();
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
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({
    cinema: false,
    parilshik: false,
    shop: false,
    cleaning: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");

  // Navigation sections (reworked)
  const sections = [
    { id: "hero", label: "Главная" },
    { id: "zones", label: "Зоны" },
    { id: "pricing", label: "Цены" },
    { id: "services", label: "Услуги" },
    { id: "work", label: "Работа" },
    { id: "other", label: "Прочее" },
  ];
  const [activeId, setActiveId] = useState("hero");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const opts = { root: null, rootMargin: "0px", threshold: 0.45 };
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && (e.target as HTMLElement).id) setActiveId((e.target as HTMLElement).id);
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
    const fridayToMon = isFridayToMondayWindow(d);
    const isEvening = startHour >= 18 || startHour < 6;
    let basePerHour = BASE_PRICING.weekdayHour;
    if (fridayToMon) basePerHour = BASE_PRICING.fridayToMondayHour;
    else if (isWeekend(d)) basePerHour = BASE_PRICING.weekendHour;
    let price = basePerHour * durationHours;
    if (selectedExtras.cinema) price += BASE_PRICING.cinemaFlat;
    if (selectedExtras.parilshik) price += BASE_PRICING.parilshikFlat;
    if (selectedExtras.cleaning) price += BASE_PRICING.cleaningFlat;
    // shop items are per-item — not added here by default
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

  function computeStartEndIso(selectedDate: string, hour: number, duration: number) {
    const start = new Date(selectedDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime());
    end.setHours(start.getHours() + duration);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  // Booking
  async function handleCreateBooking() {
    setIsSubmitting(true);

    const { startIso, endIso } = computeStartEndIso(date, startHour, durationHours);

    const payload = {
      saunaVehicleId: "sauna-001",
      startIso,
      endIso,
      price: totalPrice,
      extras: Object.keys(selectedExtras).filter((k) => (selectedExtras as any)[k]),
      starsUsed: Math.min(starsBalance, starsCost),
      userId: dbUser?.user_id ?? undefined,
      notes,
    };

    try {
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
      setNotes("");
      setIsSubmitting(false);
      alert("Бронь создана — счёт отправлен в Telegram (проверь бот).");
    } catch (err: any) {
      console.error("Booking error:", err);
      setIsSubmitting(false);
      alert("Ошибка при создании брони. Попробуй ещё раз.");
    }
  }

  // decorative bg (kept)
  const bg = (
    <svg className="absolute inset-0 w-full h-full opacity-6" preserveAspectRatio="none" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tg2" x1="0" x2="1">
          <stop offset="0" stopColor="#f8fafc" stopOpacity="0.02" />
          <stop offset="1" stopColor="#e6eef9" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill="url(#tg2)" />
    </svg>
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#071014] via-[#0f1412] to-[#0e0b08] text-[#f6f1ea] antialiased overflow-x-hidden">
      <div className="absolute inset-0 z-0 overflow-hidden">{bg}</div>

      {/* STICKY header with left title + center big booking button + right indicators */}
      <div className="sticky top-2 z-40 mx-auto container px-4">
        <div className="backdrop-blur-sm bg-[#00000066] border border-[#ffffff10] rounded-xl p-3 flex items-center justify-between gap-4">
          {/* Left: site / sauna name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00aaff] to-[#0055aa] flex items-center justify-center text-white font-bold">ВO</div>
            <div>
              <div className="text-xs text-[#cce7ff] font-mono">САУНА-ВОЛНА</div>
              <div className="text-sm font-semibold text-[#fff]">Финская парная — до 12 чел</div>
            </div>
          </div>

          {/* Center: big booking CTA */}
          <div className="hidden md:flex items-center justify-center">
            <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#ffd29b] text-[#241309] px-6 py-2 font-bold text-lg">
              БРОНИРОВАНИЕ
            </Button>
          </div>

          {/* Right: indicators */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block">
              <ActiveRentalsIndicator />
            </div>

            <div className="flex flex-col items-end">
              <div className="text-xs text-[#cce7ff]">Твой баланс</div>
              <div className="text-lg font-bold flex items-center gap-2 text-[#fff]">
                <VibeContentRenderer content="::FaStar::" className="w-5 h-5 text-yellow-400 inline" /> {starsBalance}★
              </div>
            </div>

            {/* Mobile quick booking */}
            <div className="sm:hidden">
              <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#ffd29b] text-[#241309] px-3 py-1">БРОНЬ</Button>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-12 relative z-10">
        {/* HERO */}
        <section id="hero" className="rounded-2xl overflow-hidden relative grid grid-cols-1 lg:grid-cols-2 gap-6 items-center bg-gradient-to-br from-[#071214]/40 to-[#0a0e0b]/20 p-8 min-h-[640px]">
          <div className="space-y-6 z-10 relative">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-orbitron leading-tight">
              <span className="block text-[#ffffff]">САУНА-ВОЛНА</span>
              <span className="block text-[#9be7ff] text-3xl">Финская парная · Релакс и вечеринка</span>
            </h1>

            <p className="text-sm text-[#dfe9e6] max-w-xl">
              Частная аренда до 12 человек — финская парная на 6, джакузи на 2, прохладный бассейн, гостиная со столом на 8. Кино, караоке, парильщик и магазин аксессуаров.
            </p>

            <div className="flex gap-3 mt-4 flex-wrap">
              <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#ffd29b] text-[#241309]">Забронировать</Button>
              <Button variant="ghost" onClick={() => document.getElementById("zones")?.scrollIntoView({ behavior: "smooth" })}>Наши зоны</Button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#233136]">
                <div className="text-xs text-[#9be7ff] font-semibold">Вместимость</div>
                <div className="text-lg font-bold text-[#fff]">До 12 человек</div>
              </div>
              <div className="p-3 bg-[#0b0b0b] rounded-lg border border-[#233136]">
                <div className="text-xs text-[#9be7ff] font-semibold">Парилка</div>
                <div className="text-lg font-bold text-[#fff]">6 чел</div>
              </div>
            </div>
          </div>

          <div className="relative h-80 md:h-[480px] rounded-lg overflow-hidden shadow-lg">
            <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/IMG_20250812_205713_766.jpg" alt="Сауна Волна" layout="fill" objectFit="cover" className="object-cover brightness-90" />
            <div className="absolute bottom-4 left-4 p-2 bg-[#00000066] rounded-lg text-xs text-[#fff]">Фото — пример интерьера</div>
          </div>
        </section>

        {/* ZONES */}
        <section id="zones" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Наши зоны</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Zone 1: Парилка */}
            <Card className="bg-[#071010] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fff]">
                  <VibeContentRenderer content="::FaHotTubPerson::" /> Парилка (Зона 1)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Финская парная — сухой жар, эфирные масла по желанию. Места: 6. Доп. опции: парильщик (услуга), веники, масла и аксессуары — всё можно докупить.</p>
                <ul className="text-sm mt-3 text-[#cfcfcf] list-inside list-disc">
                  <li>Парильщик — ведёт сессии, подает веник, контролирует пар.</li>
                  <li>Магазин: веники, эфирные масла, полотенца и аксессуары.</li>
                </ul>
              </CardContent>
              <div className="h-40 relative">
                <Image src="https://placehold.co/800x600?text=Parilka+1" alt="Парилка" layout="fill" objectFit="cover" className="rounded-b-lg" />
              </div>
            </Card>

            {/* Zone 2: Бассейн + джакузи + душевые */}
            <Card className="bg-[#071010] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fff]">
                  <VibeContentRenderer content="::FaWater::" /> Бассейн · Джакузи · Душ (Зона 2)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Прохладный бассейн (3×3), гидромассажное джакузи на 2 человека и душевые. В зоне предоставляются шампуни, тапочки и полотенца по запросу.</p>
                <ul className="text-sm mt-2 text-[#cfcfcf] list-inside list-disc">
                  <li>Джакузи — 1 шт, на 2 персоны.</li>
                  <li>Гигиена: шампуни, мыло, тапочки, полотенца (по запросу).</li>
                </ul>
              </CardContent>
              <div className="h-40 relative">
                <Image src="https://placehold.co/800x600?text=Pool+and+Jacuzzi" alt="Бассейн и джакузи" layout="fill" objectFit="cover" className="rounded-b-lg" />
              </div>
            </Card>

            {/* Zone 3: Гостиная (стол на 8) */}
            <Card className="bg-[#071010] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fff]">
                  <VibeContentRenderer content="::FaUsers::" /> Гостиная — стол на 8
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Гостиная с большим столом на 8 человек — место для общения и дегустаций. Игры: нарды, покер, дженга (Jenga) — по запросу.</p>
              </CardContent>
              <div className="h-40 relative">
                <Image src="https://placehold.co/800x600?text=Lounge+Table+8" alt="Гостиная" layout="fill" objectFit="cover" className="rounded-b-lg" />
              </div>
            </Card>

            {/* Zone 4: Кинотеатр и приставки */}
            <Card className="bg-[#071010] border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-[#fff]">
                  <VibeContentRenderer content="::FaFilm::" /> Кино / Приставки (Зона 4)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Зона кинозала с проектором и игровой приставкой — идеальна для вечерних сессий. Мы можем привезти контроллеры и подобрать фильм.</p>
              </CardContent>
              <div className="h-40 relative">
                <Image src="https://placehold.co/800x600?text=Cinema+Zone" alt="Кинотеатр" layout="fill" objectFit="cover" className="rounded-b-lg" />
              </div>
            </Card>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Цены и режимы</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-[#0a1614] border-border">
              <div className="text-xs text-[#9be7ff]">Будни (Пн—Пт)</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekdayHour} ₽ / час</div>
              <div className="text-sm text-[#cfdcdc] mt-2">09:00—15:00 • Минимум 2 часа</div>
            </div>

            <div className="p-4 rounded-lg bg-[#0a1614] border-border">
              <div className="text-xs text-[#9be7ff]">Вечер / Выходные</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekendHour} ₽ / час</div>
              <div className="text-sm text-[#cfdcdc] mt-2">Каждый день 18:00—02:00 (повышенный тариф в ПТ—ВС)</div>
            </div>

            <div className="p-4 rounded-lg bg-[#0a1614] border-border">
              <div className="text-xs text-[#9be7ff]">Пятница→Понедельник</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.fridayToMondayHour} ₽ / час</div>
              <div className="text-sm text-[#cfdcdc] mt-2">От Пятницы 15:00 до Понедельника 09:00 — повышенный тариф, минимум 2 часа</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#081211] rounded-lg border-border">
            <h4 className="font-semibold text-[#fff]">Особые правила</h4>
            <ul className="list-disc list-inside mt-2 text-sm text-[#cfdcdc]">
              <li>Минимальная аренда — 2 часа.</li>
              <li>Макс — 12 человек (включая детей).</li>
              <li>Джакузи — 1 шт, рассчитано на 2 человека.</li>
              <li>Парильщик и другие доп. услуги — по запросу и предварительному бронированию.</li>
            </ul>
          </div>
        </section>

        {/* SERVICES */}
        <section id="services" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Дополнительные услуги</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Cinema + console */}
            <Card className="bg-[#071010] border-border">
              <CardHeader><CardTitle className="text-[#fff]"><VibeContentRenderer content="::FaFilm::" /> Кинотеатр + приставка</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Проектор, экран, набор кабелей и контроллеры. Flat fee {BASE_PRICING.cinemaFlat} ₽.</p>
              </CardContent>
            </Card>

            {/* Parilshik */}
            <Card className="bg-[#071010] border-border">
              <CardHeader><CardTitle className="text-[#fff]"><VibeContentRenderer content="::FaSpa::" /> Услуга: парильщик</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Опытный парильщик ведёт сессию, использует веники, контролирует общую атмосферу. Рекомендуется бронировать заранее. Примерная стоимость {BASE_PRICING.parilshikFlat} ₽.</p>
              </CardContent>
            </Card>

            {/* Shop / допокупки */}
            <Card className="bg-[#071010] border-border">
              <CardHeader><CardTitle className="text-[#fff]"><VibeContentRenderer content="::FaShoppingCart::" /> Магазин: веник / масла / полотенца</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Веники, ароматические масла, одноразовые тапочки и платные полотенца — доступны как отдельные позиции. Пример: веник от 200 ₽.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* WORK (crew, motivation, cleaning, schedule & stars) */}
        <section id="work" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Работа — клининг и программа мотивации</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#071010] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Клин-тим и персонал</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Назначай клинеров: уборка между сменами, проверка оборудования, встреча гостей. За работу начисляются звёзды.</p>
                <ol className="list-decimal list-inside text-sm text-[#cfdcdc] mt-2">
                  <li>План уборок после каждой смены — опция для заказчика.</li>
                  <li>Клин-тим получает звезды за качественную уборку (геймификация).</li>
                </ol>
              </CardContent>
            </Card>

            <Card className="bg-[#071010] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Программа мотивации и график</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Система вознаграждений: Clean+, referral и сезонные кампании. Ниже — быстрый просмотр будущих бронирований (график).</p>

                {/* Mini schedule / booked slots (demo) */}
                <div className="mt-3 p-3 bg-[#061010] rounded border border-[#233136]">
                  <div className="text-xs text-[#9be7ff] mb-2">Ближайшие брони</div>
                  {bookings.length === 0 ? (
                    <div className="text-sm text-[#cfdcdc]">Пока нет бронирований.</div>
                  ) : (
                    <ul className="text-sm text-[#cfdcdc] list-inside list-disc">
                      {bookings.slice(0, 5).map((b) => (
                        <li key={b.id}>{b.date} • {formatHour(b.startHour)} • {b.durationHours}ч • {b.price} ₽</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-3">
                  <div className="text-xs text-[#9be7ff]">Система звёзд</div>
                  <div className="mt-2 flex items-center gap-3">
                    <VibeContentRenderer content="::FaStar::" className="w-7 h-7 text-yellow-400" />
                    <div className="text-sm text-[#cfdcdc]">Баланс: <strong className="text-[#ffd879]">{starsBalance}★</strong></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* OTHER (support, marketing, contacts) */}
        <section id="other" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Прочее — поддержка и контакты</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#071010] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Заявки / Саппорт</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Для комплексной организации мероприятия: администрирование, доп. персонал, кейтеринг — оставь заявку.</p>
                <div className="mt-3"><SupportForm /></div>
              </CardContent>
            </Card>

            <Card className="bg-[#071010] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Маркетинг / Контакты</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d6d6d6]">Партнёрства: байк-туры + сауна, промо-пакеты. Контакты: пр. Ленина 98, Н.Новгород • Тел/WhatsApp/Telegram: +7-920-016-91-01 • volnasauna@gmail.com</p>
                <p className="text-xs text-[#cfc6b8] mt-2">2025 © Сауна Волна</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* BOOKING FORM (moved a section but top CTA exists) */}
        <section id="booking" className="space-y-6">
          <h3 className="text-2xl font-orbitron text-[#fff]">Бронирование</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#071010] border-border">
                <CardHeader><CardTitle className="text-[#fff]">Форма брони</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-mono text-[#fff]">Дата
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-2 rounded bg-[#0c1111] border border-[#233136] text-sm text-[#fff]" />
                    </label>

                    <label className="text-xs font-mono text-[#fff]">Время начала
                      <select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#0c1111] border border-[#233136] text-sm text-[#fff]">
                        {Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}
                      </select>
                    </label>

                    <label className="text-xs font-mono text-[#fff]">Длительность (часы)
                      <input type="number" min={2} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#0c1111] border border-[#233136] text-sm text-[#fff]" />
                    </label>

                    <div className="text-xs font-mono text-[#fff]">Скидки и звезды
                      <div className="mt-1 text-sm text-[#fff]">Баланс: <strong className="text-[#ffd879]">{starsBalance}★</strong> • Стоимость в звёздах: <strong className="text-[#ffd879]">{starsCost}★</strong></div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-2">
                      <div className="flex gap-2 flex-wrap">
                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.cinema} onChange={() => toggleExtra('cinema' as any)} /> <span className="text-sm">Кинотеатр/Приставка</span>
                        </label>

                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.parilshik} onChange={() => toggleExtra('parilshik' as any)} /> <span className="text-sm">Парильщик</span>
                        </label>

                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.shop} onChange={() => toggleExtra('shop' as any)} /> <span className="text-sm">Магазин (веник/масло)</span>
                        </label>

                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.cleaning} onChange={() => toggleExtra('cleaning' as any)} /> <span className="text-sm">Проф. уборка</span>
                        </label>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-3">
                      <div className="p-3 rounded bg-[#061010] border border-[#233136]">
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-[#fff]">Итого</div>
                          <div className="text-lg font-bold text-[#fff]">{totalPrice} ₽</div>
                        </div>
                        <div className="text-xs text-[#cfdcdc] mt-1">Или ~ {starsCost}★. При оплате — начислим {starsEarned}★ cashback.</div>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-3">
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Доп. пожелания (обогрев, музыка, фильм, шампуни)" className="w-full p-3 rounded bg-[#0c1111] border border-[#233136] text-sm h-24 text-[#fff]" />
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-2">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={handleCreateBooking} disabled={isSubmitting} className="flex-1">
                          {isSubmitting ? "Обработка..." : "Создать бронь и получить счёт в Telegram"}
                        </Button>

                        <Button variant="ghost" onClick={() => {
                          setDate(new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10));
                          setNotes("");
                          setSelectedExtras({ cinema: false, parilshik: false, shop: false, cleaning: false });
                          setDurationHours(3);
                          setStartHour(18);
                        }} className="w-full sm:w-auto border border-[#ff6b6b] text-[#ffb6b6] hover:bg-[#2a0c0c]">
                          Сброс
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Booking history */}
              <Card className="mt-6 bg-[#061010] border-border">
                <CardHeader><CardTitle className="text-[#fff]">История броней</CardTitle></CardHeader>
                <CardContent>
                  {bookings.length === 0 ? <div className="text-sm text-[#cfdcdc]">Пока что пусто — твои брони появятся здесь.</div> : (
                    <ul className="space-y-2">
                      {bookings.map((b) => (
                        <li key={b.id} className="p-2 rounded bg-[#081010] border border-[#233136]">
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-[#fff]">{b.date} • {formatHour(b.startHour)} • {b.durationHours}ч</div>
                            <div className="text-sm font-semibold text-[#fff]">{b.price} ₽</div>
                          </div>
                          <div className="text-xs text-[#cfdcdc] mt-1">Экстры: {b.extras.join(", ") || "—"}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column: stars + quick shop */}
            <aside>
              <Card className="bg-[#071010] border-border md:sticky md:top-24">
                <CardHeader><CardTitle className="text-[#fff]">Система звёзд</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-[#d6d6d6] mb-2">Звезды — внутренняя валюта: используй для скидок или как зарплату для клин-тим.</p>
                  <div className="p-3 bg-[#061010] rounded border border-[#233136]">
                    <div className="text-xs text-[#9be7ff]">Баланс</div>
                    <div className="text-3xl font-bold flex items-center gap-2 text-[#fff]"><VibeContentRenderer content="::FaStar::" className="w-7 h-7 text-yellow-400" /> {starsBalance}★</div>
                    <div className="text-xs text-[#cfdcdc] mt-2">Начисления: аренда, уборка, рефералы.</div>

                    <div className="mt-3">
                      <div className="text-xs text-[#9be7ff]">Магазин скидок</div>
                      <ul className="mt-1 text-sm list-inside list-disc text-[#cfdcdc]">
                        <li>50★ — 500 ₽ скидка</li>
                        <li>100★ — 1200 ₽ скидка</li>
                        <li>200★ — 3000 ₽ скидка + VIP вечер</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-[#9be7ff] mb-2">Подпись на оповещения</div>
                    <p className="text-xs text-[#cfdcdc]">Подписаться на уведомления о клининге и сменах — оповещения в Telegram.</p>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={() => alert("TODO: send subscription to /api/notify-cleanup")}>Подписаться</Button>
                      <Button variant="ghost" onClick={() => alert("TODO: show cleaning schedule")} className="border border-[#233136] text-[#fff]">График</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#071010] border-border mt-6">
                <CardContent>
                  <h4 className="font-semibold mb-2 text-[#fff]">Быстрые ссылки</h4>
                  <ul className="text-sm list-inside space-y-2 text-[#cfdcdc]">
                    <li><Link href="/vipbikerental"><a className="text-[#fff] hover:underline">VIP Байк</a></Link></li>
                    <li><Link href="/selfdev"><a className="text-[#fff] hover:underline">SelfDev</a></Link></li>
                  </ul>
                </CardContent>
              </Card>
            </aside>
          </div>
        </section>

        {/* FOOTER CTA */}
        <section className="py-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h4 className="text-xl font-orbitron mb-2 text-[#fff]">Готов взять ВАЙБ на себя?</h4>
            <p className="text-sm text-[#cfdcdc] mb-4">Бронируй сейчас — счёт в Telegram. Плати звёздами. Мы увидим оплату и подтвердим вручную.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })}>Забронировать</Button>
              <Button variant="ghost" onClick={() => document.getElementById("other")?.scrollIntoView({ behavior: "smooth" })}>Прочее</Button>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile floating nav (uses new sections) */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[92%] sm:w-[640px] md:hidden">
        <div className="bg-[#071010] border border-[#233136] rounded-full p-2 flex justify-between items-center shadow-lg">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={cn("flex-1 text-center p-2 rounded-full text-xs", activeId === s.id ? "bg-[#9be7ff] text-[#071010]" : "text-[#fff]")}>{s.label}</a>
          ))}
        </div>
      </div>

      {/* Desktop steam nav */}
      <aside className="hidden md:block fixed right-6 top-1/3 z-40">
        <div className="bg-[#071010] border border-[#233136] rounded-xl p-2 w-44 shadow-xl">
          <div className="text-xs text-[#9be7ff] mb-2">Навигация</div>
          <div className="flex flex-col gap-2">
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={cn("p-2 rounded-md text-sm", activeId === s.id ? "bg-[#9be7ff] text-[#071010]" : "text-[#fff] hover:bg-[#ffffff10]")}>{s.label}</a>
            ))}
          </div>
        </div>
      </aside>

      <style jsx>{`
        .font-orbitron { font-family: 'Orbitron', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
      `}</style>
    </div>
  );
}