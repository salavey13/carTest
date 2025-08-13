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
import RockstarHeroSection from "@/app/tutorials/RockstarHeroSection";

// Server action
import { createSaunaBooking } from "@/app/sauna-rent/actions";

// ----------------------------- types -----------------------------
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

// ----------------------------- pricing constants -----------------------------
const BASE_PRICING = {
  weekdayMorningPerHour: 1500, // 09:00-15:00
  weekdayEveningPerHour: 2000, // 15:00-02:00
  weekendDayPerHour: 2000,     // 09:00-15:00
  weekendNightPerHour: 2500,   // 15:00-05:00
  fridayExtendedMultiplier: 1.15,
  cinemaFlat: 3000,
  parilshchikFlat: 1200,
  cleaningFlat: 500,
};

// helpers
function isWeekend(date: Date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}
function isFriday(date: Date) {
  return date.getDay() === 5;
}

// ----------------------------- page -----------------------------
export default function SaunaRentMegaPage() {
  const { dbUser } = useAppContext();
  const [starsBalance, setStarsBalance] = useState<number>(120);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Form state
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [startHour, setStartHour] = useState(18);
  const [durationHours, setDurationHours] = useState(3);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, boolean>>({ cinema: false, parilshchik: false, shop: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  // Navigation sections (bottom nav)
  const sections = [
    { id: "hero", label: "Главная" },
    { id: "zones", label: "Зоны" },
    { id: "pricing", label: "Цены" },
    { id: "extras", label: "Услуги" },
    { id: "work", label: "Работа" },
    { id: "other", label: "Прочее" },
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
    const isEvening = startHour >= 15 || startHour < 6; // after 15:00 => evening/night pricing
    let basePerHour = BASE_PRICING.weekdayMorningPerHour;
    if (weekend) {
      basePerHour = isEvening ? BASE_PRICING.weekendNightPerHour : BASE_PRICING.weekendDayPerHour;
    } else {
      basePerHour = isEvening ? BASE_PRICING.weekdayEveningPerHour : BASE_PRICING.weekdayMorningPerHour;
    }
    let price = basePerHour * durationHours;
    if (friday) price = Math.round(price * BASE_PRICING.fridayExtendedMultiplier);
    if (selectedExtras.cinema) price += BASE_PRICING.cinemaFlat;
    if (selectedExtras.parilshchik) price += BASE_PRICING.parilshchikFlat;
    if (selectedExtras.shop) price += 0; // shop purchases are ad-hoc
    return price;
  }, [date, startHour, durationHours, selectedExtras]);

  const starsCost = Math.round(totalPrice / 100);
  const starsEarned = Math.max(0, Math.round((totalPrice * 0.1) / 100));

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

  async function handleCreateBooking() {
    setIsSubmitting(true);
    setMessage("");
    const { startIso, endIso } = computeStartEndIso(date, startHour, durationHours);

    const payload = {
      saunaVehicleId: "sauna-001",
      startIso,
      endIso,
      price: totalPrice,
      extras: Object.keys(selectedExtras).filter((k) => (selectedExtras as any)[k]),
      starsUsed: Math.min(starsBalance, starsCost),
      userId: dbUser?.user_id ?? undefined,
      notes: message || undefined,
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
      setMessage("Бронь создана — счёт отправлен в Telegram (проверь бота).");
    } catch (err: any) {
      console.error("Booking error:", err);
      setMessage("Ошибка при создании брони. Попробуй ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Hero images
  const heroImage = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/boardGamesPokerJenga.jpg";
  const objectImage = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/map3d.jpg";

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#030203] via-[#101217] to-[#1b1512] text-[#f6f1ea] antialiased overflow-x-hidden">
      {/* Fixed hero (using RockstarHeroSection). Note: triggerElementSelector intentionally invalid to keep hero static (no scroll transform). */}
      <RockstarHeroSection
        title="САУНА-ВОЛНА"
        subtitle="Финская сауна • до 12 человек • парилка 6 • джакузи 1 (2 чел) • стол 8"
        mainBackgroundImageUrl={heroImage}
        backgroundImageObjectUrl={objectImage}
        triggerElementSelector="#no-trigger"
      >
        {/* center CTA inside hero */}
        <div className="flex gap-3 justify-center">
          <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#ffd29b] text-[#241309] px-6 py-3 font-bold">
            БРОНИРОВАНИЕ
          </Button>
          <Button variant="ghost" onClick={() => document.getElementById("extras")?.scrollIntoView({ behavior: "smooth" })}>УСЛУГИ</Button>
        </div>
      </RockstarHeroSection>

      {/* Page content container (starts after hero) */}
      <main className="container mx-auto px-4 pt-screen relative z-20">
        <div style={{ height: "100vh" }} aria-hidden /> {/* spacer so hero does not overlap content (hero is fixed) */}

        {/* Sticky header (top center booking moved into hero) */}
        <div className="sticky top-4 z-40 mx-auto container px-4">
          <div className="backdrop-blur-sm bg-[#00000066] border border-[#ffffff0d] rounded-xl p-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-10 rounded-md bg-gradient-to-br from-[#ffd29b] to-[#ff8a00] flex items-center justify-center text-black font-bold text-sm">САУНА</div>
              <div>
                <div className="text-xs text-[#ffe9c7] font-mono">САУНА-ВОЛНА</div>
                <div className="text-sm font-semibold text-[#fff]">Резерв и управление</div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-4">
                <ActiveRentalsIndicator />
              </div>

              <div className="flex flex-col items-end">
                <div className="text-xs text-[#ffe9c7]">Твой баланс</div>
                <div className="text-lg font-bold flex items-center gap-2 text-[#fff]">
                  <VibeContentRenderer content="::FaStar::" className="w-5 h-5 text-yellow-400 inline" /> {starsBalance}★
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT SECTIONS */}
        <section id="zones" className="py-10 space-y-8">
          <h2 className="text-3xl font-orbitron">Наши зоны</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Парилка */}
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Парилка</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3">
                  <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/saunaInside.jpg" alt="парилка" layout="fill" objectFit="cover" />
                </div>
                <p className="text-sm text-[#ddd]">Жаркая финская парная. Места: 6. Доп. услуги парильщика — индивидуальные сессии, веник, ароматерапия.</p>
                <ul className="text-sm text-[#d9d6cd] mt-3 list-inside list-disc">
                  <li>Парильщик — от {BASE_PRICING.parilshchikFlat} ₽ (за сессию).</li>
                  <li>Веники и масла можно добрать на стойке в прихожей.</li>
                </ul>
              </CardContent>
            </Card>

            {/* 2. Бассейн / Джакузи / Душевые */}
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Бассейн / Джакузи / Душ</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3">
                  <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/poolSpace.jpg" alt="бассейн" layout="fill" objectFit="cover" />
                </div>
                <p className="text-sm text-[#ddd]">Прохладный бассейн 3×3, джакузи на 2 человека, отдельные душевые кабины.</p>
                <div className="text-sm text-[#d9d6cd] mt-3">В зоне предоставляются: шампуни, одноразовые тапочки, полотенца (по запросу) — удобно для гостей.</div>
              </CardContent>
            </Card>

            {/* 3. Гостиная (was 'зона на компанию') */}
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Гостиная — стол на 8</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3">
                  <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/sofaAndTable.jpg" alt="гостиная" layout="fill" objectFit="cover" />
                </div>
                <p className="text-sm text-[#ddd]">Уютная гостиная с столом на 8, лаунж-зона. Игры: нарды, покер, дженга — по желанию.</p>
              </CardContent>
            </Card>
          </div>

          {/* Прихожая (shop) */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border md:col-span-1">
              <CardHeader><CardTitle className="text-[#fff]">Прихожая — магазин</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3">
                  <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/map3d.jpg" alt="прилавок" layout="fill" objectFit="cover" />
                </div>
                <p className="text-sm text-[#ddd]">Прилавок с аксессуарами: веники, тапочки, полотенца, халаты, эфирные масла, свечи — всё для комфортного сеанса и приятных покупок.</p>
                <ul className="text-sm text-[#d9d6cd] mt-3 list-disc list-inside">
                  <li>Веники — 300 ₽</li>
                  <li>Тапочки — 400 ₽</li>
                  <li>Полотенца — 700 ₽</li>
                  <li>Халаты — 1500 ₽</li>
                </ul>
              </CardContent>
            </Card>

            {/* Кинотеатр / приставки */}
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Кинотеатр & приставки</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3">
                  <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/projector.jpg" alt="кино" layout="fill" objectFit="cover" />
                </div>
                <p className="text-sm text-[#ddd]">Большой экран, проектор, приставки — можно подключать свои аккаунты и контроллеры. Идеально для вечеринок и просмотра матчей.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="py-10 space-y-6">
          <h2 className="text-3xl font-orbitron">Цены и режимы</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Будни — утро</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekdayMorningPerHour} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Пн—Пт 09:00—15:00 • Мин. аренда 2 ч</div>
            </div>

            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Будни — вечер / ночь</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekdayEveningPerHour} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Пн—Пт 15:00—02:00 • Часто удлинённая пятница</div>
            </div>

            <div className="p-4 rounded-lg bg-[#0b0b0b] border-border">
              <div className="text-xs text-[#ffd29b]">Выходные</div>
              <div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekendDayPerHour}—{BASE_PRICING.weekendNightPerHour} ₽ / час</div>
              <div className="text-sm text-[#ddd] mt-2">Сб—Вс 09:00—05:00 (ночной тариф выше)</div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-[#080707] rounded-lg border-border">
            <h4 className="font-semibold text-[#fff]">Особые правила</h4>
            <ul className="list-disc list-inside mt-2 text-sm text-[#ddd]">
              <li>Минимальная аренда — 2 часа.</li>
              <li>Максимум — 12 человек.</li>
              <li>Гостям отеля «Волна» — скидки 20–30% (в зависимости от частоты посещений и загрузки).</li>
            </ul>
          </div>
        </section>

        {/* EXTRAS / SERVICES */}
        <section id="extras" className="py-10 space-y-6">
          <h2 className="text-3xl font-orbitron">Дополнительные услуги</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Караоке</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Караоке-система в гостиной для ваших вечеринок — запрос при брони.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Кино + приставка</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Flat fee {BASE_PRICING.cinemaFlat} ₽ — проектор, звук, контроллеры.</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Парильщик</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Опытный парильщик проведёт индивидуальную сессию, веник и ароматерапия — от {BASE_PRICING.parilshchikFlat} ₽.</p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 text-sm text-[#d9d6cd]">Также в наличии — магазин аксессуаров (веники, тапочки, полотенца и т.д.).</div>
        </section>

        {/* WORK (crew / cleaners / motivation / stars) */}
        <section id="work" className="py-10 space-y-6">
          <h2 className="text-3xl font-orbitron">Работа — клининг, мотивация, график</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Клин-тим и персонал</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">Назначай клинеров: уборка между сменами, проверка оборудования, прием гостей.</p>
                <ol className="list-decimal list-inside text-sm text-[#ddd] mt-2">
                  <li>План уборок после каждой смены — опция для админов.</li>
                  <li>Клин-тим получает звёзды за выполненную работу.</li>
                  <li>График и подписка — интерфейс для участников.</li>
                </ol>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Программа мотивации</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#ddd]">За уборку, приводы гостей и полезные действия начисляются звёзды.</p>
                <ul className="list-disc list-inside text-sm mt-2 text-[#ddd]">
                  <li>Clean+ — бонус 5★ за качественную уборку.</li>
                  <li>Referral — 2★ за привлечение друга.</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Stars system + schedule / bookings timeline */}
          <Card className="mt-4 bg-[#080707] border-border">
            <CardHeader><CardTitle className="text-[#fff]">Система звёзд и график</CardTitle></CardHeader>
            <CardContent>
              <div className="text-sm text-[#d9d6cd]">Твои звёзды — внутренняя валюта: трать на скидки или копи для бонусов.</div>
              <div className="mt-3 p-3 bg-[#060606] rounded border border-[#2b1b12]">
                <div className="text-xs text-[#ffd29b]">Баланс</div>
                <div className="text-2xl font-bold flex items-center gap-2 text-[#fff]"><VibeContentRenderer content="::FaStar::" className="w-6 h-6" /> {starsBalance}★</div>
              </div>

              <div className="mt-4">
                <div className="text-sm text-[#fff]">График бронирований</div>
                <div className="mt-2 text-sm text-[#d9d6cd]">(placeholder — здесь можно встроить календарь / timeline с забронированными слотами и датами)</div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* BOOKING */}
        <section id="booking" className="py-10 space-y-6">
          <h2 className="text-2xl font-orbitron">Бронирование</h2>

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
                          <input type="checkbox" checked={selectedExtras.cinema} onChange={() => toggleExtra('cinema' as any)} /> <span className="text-sm">Кино + приставка</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.parilshchik} onChange={() => toggleExtra('parilshchik' as any)} /> <span className="text-sm">Парильщик</span>
                        </label>
                        <label className="inline-flex items-center gap-2 text-[#fff]">
                          <input type="checkbox" checked={selectedExtras.shop} onChange={() => toggleExtra('shop' as any)} /> <span className="text-sm">Покупки на стойке</span>
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
                      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Доп. пожелания (обогрев, музыка, фильм, просьба для парильщика)" className="w-full p-3 rounded bg-[#141212] border border-[#2b1b12] text-sm h-24 text-[#fff]" />
                    </div>

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
                            setSelectedExtras({ cinema: false, parilshchik: false, shop: false });
                            setDurationHours(3);
                            setStartHour(18);
                          }}
                          className="w-full sm:w-auto border border-[#ff6b6b] text-[#ffb6b6] hover:bg-[#2a0c0c]"
                        >
                          Сброс
                        </Button>
                      </div>
                    </div>

                    <div className="col-span-1 sm:col-span-2 mt-1">
                      <div className="flex gap-3 items-center">
                        <Button variant="ghost" onClick={() => setShowHistory((s) => !s)} className="border border-[#2b1b12]">
                          {showHistory ? "Скрыть историю" : "Показать историю броней"}
                        </Button>
                        <div className="text-sm text-[#d9d6cd]">{bookings.length} броней в истории</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {showHistory && (
                <Card className="mt-4 bg-[#080707] border-border">
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
              )}
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

        {/* OTHER / SUPPORT */}
        <section id="other" className="py-10 space-y-6">
          <h2 className="text-3xl font-orbitron">Прочее / Поддержка</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Заявки / Саппорт</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d9d6cd]">Если нужно организовать мероприятие, доп. персонал, кейтеринг — оставь заявку.</p>
                <div className="mt-3"><SupportForm /></div>
              </CardContent>
            </Card>

            <Card className="bg-[#0b0b0b] border-border">
              <CardHeader><CardTitle className="text-[#fff]">Отель «Волна» — скидки</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-[#d9d6cd]">Гостям отеля предоставляем скидки 20–30% в зависимости от частоты посещений и загрузки. Рекомендуем интеграцию с ресепшеном отеля для подтверждений и штрих-кодов.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="py-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h4 className="text-xl font-orbitron mb-2 text-[#fff]">Готов взять ВАЙБ на себя?</h4>
            <p className="text-sm text-[#d9d6cd] mb-4">Бронируй сейчас — счёт в Telegram. Плати звёздами. Я вижу оплату и подтверждаю вручную.</p>
            <div className="flex justify-center gap-3">
              <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })}>Забронировать</Button>
              <Button variant="ghost" onClick={() => document.getElementById("other")?.scrollIntoView({ behavior: "smooth" })}>Саппорт</Button>
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
        @media (max-width: 640px) {
          main { padding-bottom: 140px; }
        }
      `}</style>
    </div>
  );
}
