// /app/sauna-rent/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
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
import SaunaOccupancyChart from "@/components/SaunaOccupancyChart";
import { toast } from "sonner";

// Server actions
import { createSaunaBooking } from "@/app/sauna-rent/actions";
import { updateUserSettings } from "@/app/actions"; // Используем существующий центральный экшен

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
  // Поля для совместимости с графиком
  start_at?: string;
  end_at?: string;
  metadata?: Record<string, any>;
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
  const { dbUser, refreshDbUser } = useAppContext();
  const [showHistory, setShowHistory] = useState(false);
  const heroTriggerId = useId().replace(/:/g, "-") + "-hero-trigger";
  
  const [bookings, setBookings] = useState<Booking[]>([]);

  // State для баланса звезд, синхронизированный с dbUser.metadata
  const [starsBalance, setStarsBalance] = useState<number>(() => Number(dbUser?.metadata?.starsBalance ?? 120));
  
  useEffect(() => {
    const metaVal = Number(dbUser?.metadata?.starsBalance ?? 120);
    setStarsBalance(metaVal);
  }, [dbUser?.metadata]);
  
  // Функция для сохранения баланса звезд на сервере
  const persistStarsBalance = useCallback(async (nextVal: number) => {
    if (!dbUser?.user_id) {
      toast.error("Пользователь не найден для сохранения баланса.");
      return;
    }
    try {
      const result = await updateUserSettings(dbUser.user_id, { starsBalance: nextVal });
      if (!result.success) {
        throw new Error(result.error || "Failed to update settings");
      }
      await refreshDbUser();
      toast.success("Баланс сохранен!");
    } catch (err: any) {
      console.error("Failed to persist stars balance:", err);
      toast.error(`Ошибка сохранения баланса: ${err.message}`);
    }
  }, [dbUser?.user_id, refreshDbUser]);

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
    { id: "home", label: "Главная" },
    { id: "zones", label: "Зоны" },
    { id: "pricing", label: "Цены" },
    { id: "extras", label: "Услуги" },
    { id: "work", label: "Работа" },
    { id: "other", label: "Прочее" },
  ];
  const [activeId, setActiveId] = useState("home");
  const observerRef = useRef<IntersectionObserver | null>(null);
  
  useEffect(() => {
    const opts = { root: null, rootMargin: "0px 0px -50% 0px", threshold: 0 };
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.target.id) {
            setActiveId(e.target.id);
        }
      });
    }, opts);

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observerRef.current?.observe(el);
    });

    const handleScroll = () => {
        if (window.scrollY < 300) {
            setActiveId('home');
        }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
        observerRef.current?.disconnect();
        window.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Pricing calc
  const totalPrice = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const weekend = isWeekend(d);
    const friday = isFriday(d);
    const isEvening = startHour >= 15 || startHour < 6;
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
        id, date, startHour, durationHours, price: totalPrice,
        starsUsed: payload.starsUsed || 0,
        extras: payload.extras || [],
        createdAt: new Date().toISOString(),
        start_at: startIso,
        end_at: endIso,
      };

      setBookings((b) => [newBooking, ...b]);
      
      const newBalance = Math.max(0, starsBalance - (payload.starsUsed || 0) + starsEarned);
      setStarsBalance(newBalance);
      await persistStarsBalance(newBalance);

      setMessage("Бронь создана — счёт отправлен в Telegram (проверь бота).");
    } catch (err: any) {
      console.error("Booking error:", err);
      setMessage("Ошибка при создании брони. Попробуй ещё раз.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const heroImage = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/her2-31adfe54-e81d-4e65-becf-e85e689af170.jpg";
  const objectImage = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/appStore/oneSitePls_transparent_icon.png";
  
  const cleaningOpportunities = useMemo(() => {
    return bookings.filter(b => {
      const extras = Array.isArray(b.extras) ? b.extras : [];
      const meta = b.metadata || {};
      return extras.includes('cleaning') || extras.includes('cleaning_paid') || meta.cleaning_paid === true;
    });
  }, [bookings]);

  return (
    <div className="relative min-h-[80vh] bg-[#030203] antialiased overflow-x-hidden">
      <RockstarHeroSection
        title=""
        subtitle="Проспект Ленина 98, Нижний Новгород Гостиница Волна"
        mainBackgroundImageUrl={heroImage}
        backgroundImageObjectUrl={objectImage}
        triggerElementSelector={`#${heroTriggerId}`}
      >
        <div className="flex gap-4 justify-center relative z-20">
          <Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#ffd29b] text-[#241309] px-6 py-3 font-bold transition-transform transform hover:scale-105">
            БРОНИРОВАНИЕ
          </Button>
        </div>
      </RockstarHeroSection>

      <div id={heroTriggerId} style={{ height: '110vh' }} aria-hidden="true" />

      <main className="container mx-auto px-4 relative z-10 bg-gradient-to-b from-transparent via-[#101217] to-[#030203]">
        <div id="home" className="absolute -top-[110vh]" aria-hidden="true" />
        
        <div className="fixed top-20 w-32 z-40 mx-auto right-4 container px-4 -mt-16 mb-16">
          <div className="backdrop-blur-sm bg-[#00000066] border border-[#ffffff0d] rounded-xl p-3 flex items-center justify-between gap-4">
            
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

        <section id="zones" className="py-10 space-y-8 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Наши зоны</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border">
              <CardHeader><CardTitle className="text-[#fff]">Парилка</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3"><Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/parilka2-61257e59-971c-4b21-bb32-650ba72e4ae3.jpg" alt="парилка" layout="fill" objectFit="cover" /></div>
                <p className="text-sm text-[#ddd]">Жаркая финская парная. Места: 6. Доп. услуги парильщика — индивидуальные сессии, веник, ароматерапия.</p>
                <ul className="text-sm text-[#d9d6cd] mt-3 list-inside list-disc"><li>Парильщик — от {BASE_PRICING.parilshchikFlat} ₽ (за сессию).</li><li>Веники и масла можно добрать на стойке в прихожей.</li></ul>
              </CardContent>
            </Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border">
              <CardHeader><CardTitle className="text-[#fff]">Бассейн / Джакузи / Душ</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3"><Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/pool4girls-5ae07070-499e-4a17-98da-9072298652ef.jpg" alt="бассейн" layout="fill" objectFit="cover" /></div>
                 <div className="relative h-44 rounded overflow-hidden mb-3"><Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/dzhacuzy2-96f492d4-498f-4973-bb38-6ad827f237cb.jpg" alt="джакузи" layout="fill" objectFit="cover" /></div>
                <p className="text-sm text-[#ddd]">Прохладный бассейн 3×3, джакузи на 2 человека, отдельные душевые кабины.</p>
                <div className="text-sm text-[#d9d6cd] mt-3">В зоне предоставляются: шампуни, одноразовые тапочки, полотенца (по запросу) — удобно для гостей.</div>
              </CardContent>
            </Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border">
              <CardHeader><CardTitle className="text-[#fff]">Гостиная — стол на 6</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3"><Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/sofaAndTable.jpg" alt="гостиная" layout="fill" objectFit="cover" /></div>
                <p className="text-sm text-[#ddd]">Уютная гостиная с столом на 8, лаунж-зона. Игры: нарды, покер, дженга — по желанию.</p>
              </CardContent>
            </Card>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border md:col-span-1">
              <CardHeader><CardTitle className="text-[#fff]">Прихожая — магазин</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3"><Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/map3d.jpg" alt="прилавок" layout="fill" objectFit="cover" /></div>
                <p className="text-sm text-[#ddd]">Прилавок с аксессуарами: веники, тапочки, полотенца, халаты, эфирные масла, свечи — всё для комфортного сеанса и приятных покупок.</p>
                <ul className="text-sm text-[#d9d6cd] mt-3 list-disc list-inside"><li>Веники — 300 ₽</li><li>Тапочки — 400 ₽</li><li>Полотенца — 700 ₽</li><li>Халаты — 1500 ₽</li></ul>
              </CardContent>
            </Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border">
              <CardHeader><CardTitle className="text-[#fff]">Кинотеатр & приставки</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3"><Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250814_230533_963-d86832d1-60d3-4380-9518-a5e6bb2fd98b.jpg" alt="кино" layout="fill" objectFit="cover" /></div>
                <p className="text-sm text-[#ddd]">Большой экран, проектор, приставки — можно подключать свои аккаунты и контроллеры. Идеально для вечеринок и просмотра матчей.</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="pricing" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Цены и режимы</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><div className="text-xs text-[#ffd29b]">Будни — утро</div><div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekdayMorningPerHour} ₽ / час</div><div className="text-sm text-[#ddd] mt-2">Пн—Пт 09:00—15:00 • Мин. аренда 2 ч</div></div>
            <div className="p-4 rounded-lg bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><div className="text-xs text-[#ffd29b]">Будни — вечер / ночь</div><div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekdayEveningPerHour} ₽ / час</div><div className="text-sm text-[#ddd] mt-2">Пн—Пт 15:00—02:00 • Часто удлинённая пятница</div></div>
            <div className="p-4 rounded-lg bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><div className="text-xs text-[#ffd29b]">Выходные</div><div className="text-xl font-bold text-[#fff]">{BASE_PRICING.weekendDayPerHour}—{BASE_PRICING.weekendNightPerHour} ₽ / час</div><div className="text-sm text-[#ddd] mt-2">Сб—Вс 09:00—05:00 (ночной тариф выше)</div></div>
          </div>
          <div className="mt-6 p-4 bg-[#080707]/60 backdrop-blur-sm rounded-lg border-border"><h4 className="font-semibold text-[#fff]">Особые правила</h4><ul className="list-disc list-inside mt-2 text-sm text-[#ddd]"><li>Минимальная аренда — 2 часа.</li><li>Максимум — 12 человек.</li><li>Гостям отеля «Волна» — скидки 20–30% (в зависимости от частоты посещений и загрузки).</li></ul></div>
        </section>

        <section id="extras" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Дополнительные услуги</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Караоке</CardTitle></CardHeader><CardContent><p className="text-sm text-[#ddd]">Караоке-система в гостиной для ваших вечеринок — запрос при брони.</p></CardContent></Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Кино + приставка</CardTitle></CardHeader><CardContent><p className="text-sm text-[#ddd]">Flat fee {BASE_PRICING.cinemaFlat} ₽ — проектор, звук, контроллеры.</p></CardContent></Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Парильщик</CardTitle></CardHeader><CardContent><p className="text-sm text-[#ddd]">Опытный парильщик проведёт индивидуальную сессию, веник и ароматерапия — от {BASE_PRICING.parilshchikFlat} ₽.</p></CardContent></Card>
          </div>
          <div className="mt-4 text-sm text-[#d9d6cd]">Также в наличии — магазин аксессуаров (веники, тапочки, полотенца и т.д.).</div>
        </section>

        <section id="work" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Работа — клининг, мотивация, график</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Клин-тим и персонал</CardTitle></CardHeader><CardContent><p className="text-sm text-[#ddd]">Назначай клинеров: уборка между сменами, проверка оборудования, прием гостей.</p><ol className="list-decimal list-inside text-sm text-[#ddd] mt-2"><li>План уборок после каждой смены — опция для админов.</li><li>Клин-тим получает звёзды за выполненную работу.</li><li>График и подписка — интерфейс для участников.</li></ol></CardContent></Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Программа мотивации</CardTitle></CardHeader><CardContent><p className="text-sm text-[#ddd]">За уборку, приводы гостей и полезные действия начисляются звёзды.</p><ul className="list-disc list-inside text-sm mt-2 text-[#ddd]"><li>Clean+ — бонус 5★ за качественную уборку.</li><li>Referral — 2★ за привлечение друга.</li></ul></CardContent></Card>
          </div>
        </section>

        <section id="booking" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Бронирование</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Форма брони</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs font-mono text-[#fff]">Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]" /></label><label className="text-xs font-mono text-[#fff]">Время начала<select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]">{Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}</select></label><label className="text-xs font-mono text-[#fff]">Длительность (часы)<input type="number" min={2} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]" /></label><div className="text-xs font-mono text-[#fff]">Скидки и звезды<div className="mt-1 text-sm text-[#fff]">Баланс: <strong className="text-[#ffd879]">{starsBalance}★</strong> • Стоимость в звёздах: <strong className="text-[#ffd879]">{starsCost}★</strong></div></div><div className="col-span-1 sm:col-span-2 mt-2"><div className="flex gap-2 flex-wrap"><label className="inline-flex items-center gap-2 text-[#fff]"><input type="checkbox" checked={selectedExtras.cinema} onChange={() => toggleExtra('cinema' as any)} /> <span className="text-sm">Кино + приставка</span></label><label className="inline-flex items-center gap-2 text-[#fff]"><input type="checkbox" checked={selectedExtras.parilshchik} onChange={() => toggleExtra('parilshchik' as any)} /> <span className="text-sm">Парильщик</span></label><label className="inline-flex items-center gap-2 text-[#fff]"><input type="checkbox" checked={selectedExtras.shop} onChange={() => toggleExtra('shop' as any)} /> <span className="text-sm">Покупки на стойке</span></label></div></div><div className="col-span-1 sm:col-span-2 mt-3"><div className="p-3 rounded bg-[#080707] border border-[#2b1b12]"><div className="flex justify-between items-center"><div className="text-sm text-[#fff]">Итого</div><div className="text-lg font-bold text-[#fff]">{totalPrice} ₽</div></div><div className="text-xs text-[#d9d6cd] mt-1">Или ~ {starsCost}★ (прибл.). При оплате — начислим {starsEarned}★ cashback.</div></div></div><div className="col-span-1 sm:col-span-2 mt-3"><div className="mt-4"><SaunaOccupancyChart bookings={bookings} date={date} title="График занятости — выбранная дата" /></div></div><div className="col-span-1 sm:col-span-2 mt-3"><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Доп. пожелания (обогрев, музыка, фильм, просьба для парильщика)" className="w-full p-3 rounded bg-[#141212] border border-[#2b1b12] text-sm h-24 text-[#fff]" /></div><div className="col-span-1 sm:col-span-2 mt-2"><div className="flex flex-col sm:flex-row gap-3"><Button onClick={handleCreateBooking} disabled={isSubmitting} className="flex-1 bg-[#ffd29b] text-[#241309] hover:bg-white">{isSubmitting ? "Обработка..." : "Создать бронь и получить счёт в Telegram"}</Button><Button variant="ghost" onClick={() => { setDate(new Date(Date.now() + 864e5).toISOString().slice(0, 10)); setMessage(""); setSelectedExtras({ cinema: false, parilshchik: false, shop: false }); setDurationHours(3); setStartHour(18); }} className="w-full sm:w-auto border border-[#ff6b6b] text-[#ffb6b6] hover:bg-[#2a0c0c]">Сброс</Button></div></div><div className="col-span-1 sm:col-span-2 mt-1"><div className="flex gap-3 items-center"><Button variant="ghost" onClick={() => setShowHistory((s) => !s)} className="border border-[#2b1b12]">{showHistory ? "Скрыть историю" : "Показать историю броней"}</Button><div className="text-sm text-[#d9d6cd]">{bookings.length} броней в истории</div></div></div></div></CardContent></Card>
              {showHistory && (<Card className="mt-4 bg-[#080707]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">История броней</CardTitle></CardHeader><CardContent>{bookings.length === 0 ? <div className="text-sm text-[#d9d6cd]">Пока что пусто — твои брони появятся здесь.</div> : (<ul className="space-y-2">{bookings.map((b) => (<li key={b.id} className="p-2 rounded bg-[#0b0b0b] border border-[#2b1b12]"><div className="flex justify-between items-center"><div className="text-sm text-[#fff]">{b.date} • {formatHour(b.startHour)} • {b.durationHours}ч</div><div className="text-sm font-semibold text-[#fff]">{b.price} ₽</div></div><div className="text-xs text-[#d9d6cd] mt-1">Экстры: {b.extras.join(", ") || "—"}</div></li>))}</ul>)}</CardContent></Card>)}
            </div>
            <aside><Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border md:sticky md:top-24"><CardHeader><CardTitle className="text-[#fff]">Система звёзд</CardTitle></CardHeader><CardContent><p className="text-sm text-[#d9d6cd] mb-2">Твои звезды — внутренняя валюта. Трать их на скидки или копи для будущих броней.</p><div className="p-3 bg-[#060606] rounded border border-[#2b1b12]"><div className="text-xs text-[#ffd29b]">Баланс</div><div className="text-3xl font-bold flex items-center gap-2 text-[#fff]"><VibeContentRenderer content="::FaStar::" className="w-7 h-7 text-yellow-400" /> {starsBalance}★</div><div className="text-xs text-[#d9d6cd] mt-2">Суммарно: начисления за действия, рефералы, уборки.</div></div><div className="mt-4"><div className="text-xs text-[#ffd29b] mb-2">Подпишись на оповещения уборки</div><p className="text-xs text-[#d9d6cd]">После аренды можно подписаться на короткий shift уборки: за работу платят звёздами.</p><div className="mt-2 flex gap-2"><Button onClick={() => alert("TODO: send subscription to /api/notify-cleanup")} className="bg-[#ffd29b] text-[#241309] hover:bg-white">Подписаться</Button><SaunaOccupancyChart bookings={cleaningOpportunities} title="График доступных уборок" /></div></div></CardContent></Card><Card className="bg-[#070707]/60 backdrop-blur-sm border-border mt-6"><CardContent className="py-4"><h4 className="font-semibold mb-2 text-[#fff]">Быстрые ссылки</h4><ul className="text-sm list-inside space-y-2 text-[#d9d6cd]"><li><Link href="/vipbikerental" className="text-[#fff] hover:underline">VIP Байк</Link></li><li><Link href="/repo-xml" className="text-[#fff] hover:underline">/repo-xml Studio</Link></li><li><Link href="/selfdev" className="text-[#fff] hover:underline">SelfDev</Link></li></ul></CardContent></Card></aside>
          </div>
        </section>

        <section id="other" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Прочее / Поддержка</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Заявки / Саппорт</CardTitle></CardHeader><CardContent><p className="text-sm text-[#d9d6cd]">Если нужно организовать мероприятие, доп. персонал, кейтеринг — оставь заявку.</p><div className="mt-3"><SupportForm /></div></CardContent></Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Отель «Волна» — скидки</CardTitle></CardHeader><CardContent><p className="text-sm text-[#d9d6cd]">Гостям отеля предоставляем скидки 20–30% в зависимости от частоты посещений и загрузки. Рекомендуем интеграцию с ресепшеном отеля для подтверждений и штрих-кодов.</p></CardContent></Card>
          </div>
        </section>

        <section className="py-8 text-center">
          <div className="max-w-2xl mx-auto"><h4 className="text-xl font-orbitron mb-2 text-[#fff]">Готов взять ВАЙБ на себя?</h4><p className="text-sm text-[#d9d6cd] mb-4">Бронируй сейчас — счёт в Telegram. Плати звёздами. Я вижу оплату и подтверждаю вручную.</p><div className="flex justify-center gap-3"><Button onClick={() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })} className="bg-[#ffd29b] text-[#241309] hover:bg-white">Забронировать</Button><Button variant="ghost" onClick={() => document.getElementById("other")?.scrollIntoView({ behavior: "smooth" })} className="border border-white/50 text-white hover:bg-white/10">Саппорт</Button></div></div>
        </section>
      </main>

      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 w-[92%] sm:w-[640px] md:hidden">
        <div className="bg-[#0b0b0b]/80 backdrop-blur-md border border-[#2b1b12] rounded-full p-2 flex justify-between items-center shadow-lg">
          {sections.map((s) => (<a key={s.id} href={`#${s.id}`} className={cn("flex-1 text-center p-2 rounded-full text-xs font-semibold transition-colors duration-300", activeId === s.id ? "bg-[#ffd29b] text-[#120800]" : "text-[#fff]")}>{s.label}</a>))}
        </div>
      </div>

      <aside className="hidden md:block fixed right-6 top-1/2 -translate-y-1/2 z-40">
        <div className="bg-[#0b0b0b]/60 backdrop-blur-md border border-[#2b1b12] rounded-xl p-2 w-44 shadow-xl">
          <div className="text-xs text-[#ffd29b] mb-2 px-2">Навигация</div>
          <div className="flex flex-col gap-1">
            {sections.map((s) => (<a key={s.id} href={`#${s.id}`} className={cn("block p-2 rounded-md text-sm font-semibold transition-colors duration-300", activeId === s.id ? "bg-[#ffd29b] text-[#120800]" : "text-[#fff] hover:bg-[#ffffff10]")}>{s.label}</a>))}
          </div>
        </div>
      </aside>

      <style jsx>{`
        html { scroll-behavior: smooth; }
        .font-orbitron { font-family: 'Orbitron', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; }
        @media (max-width: 640px) {
          main { padding-bottom: 140px; }
        }
      `}</style>
    </div>
  );
}