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
import { updateUserSettings } from "@/app/actions"; // Используем существующий экшен

// ----------------------------- types -----------------------------
// Приводим тип Booking в соответствие с обоими источниками
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
  
  // -- ИНТЕГРАЦИЯ НОВОЙ ЛОГИКИ --
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
  }, [sections]);

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
        
        {/* Адаптивная панель баланса, справа */}
        <div className="fixed top-6 right-6 z-40">
          <div className="max-w-[320px] w-auto min-w-[160px] backdrop-blur-sm bg-[#00000066] border border-[#ffffff0d] rounded-xl p-3 flex items-center justify-end gap-4">
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

        <section id="zones" className="py-10 space-y-8 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Наши зоны</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Парилка (новая фотка) */}
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border">
              <CardHeader><CardTitle className="text-[#fff]">Парилка</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3">
                  <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/parilka2girls-41b9b5e0-ecf6-4f60-957e-8d7e5bd0c815.jpg" alt="парилка" layout="fill" objectFit="cover" />
                </div>
                <p className="text-sm text-[#ddd]">Жаркая финская парная. Места: 6. Доп. услуги парильщика — индивидуальные сессии, веник, ароматерапия.</p>
              </CardContent>
            </Card>
            {/* Бассейн */}
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border">
              <CardHeader><CardTitle className="text-[#fff]">Бассейн</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3">
                  <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/pool4girls-5ae07070-499e-4a17-98da-9072298652ef.jpg" alt="бассейн" layout="fill" objectFit="cover" />
                </div>
                <p className="text-sm text-[#ddd]">Прохладный бассейн 3×3, душевые кабины — отлично освежиться после парилки.</p>
              </CardContent>
            </Card>
            {/* Джакузи — новая карточка */}
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border">
              <CardHeader><CardTitle className="text-[#fff]">Джакузи</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-44 rounded overflow-hidden mb-3">
                  <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/dzhakuzy-1b917147-8c92-43c9-955d-6630c32f22d2.jpg" alt="джакузи" layout="fill" objectFit="cover" />
                </div>
                <p className="text-sm text-[#ddd]">Джакузи на 2 человека — небольшая зона релакса с гидромассажем.</p>
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
        </section>

        <section id="extras" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Дополнительные услуги</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Караоке</CardTitle></CardHeader><CardContent><p className="text-sm text-[#ddd]">Караоке-система в гостиной для ваших вечеринок — запрос при брони.</p></CardContent></Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Кино + приставка</CardTitle></CardHeader><CardContent><p className="text-sm text-[#ddd]">Flat fee {BASE_PRICING.cinemaFlat} ₽ — проектор, звук, контроллеры.</p></CardContent></Card>
            <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border"><CardHeader><CardTitle className="text-[#fff]">Парильщик</CardTitle></CardHeader><CardContent><p className="text-sm text-[#ddd]">Опытный парильщик проведёт индивидуальную сессию, веник и ароматерапия — от {BASE_PRICING.parilshchikFlat} ₽.</p></CardContent></Card>
          </div>
        </section>

        <section id="work" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Работа — клининг, мотивация, график</h2>
          <div className="mt-3">
            <div className="text-sm text-[#fff]">Открытые уборки (оплачено):</div>
            <div className="mt-2">
              <SaunaOccupancyChart bookings={cleaningOpportunities} title="Cleaning opportunities" />
            </div>
          </div>
        </section>

        <section id="booking" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Бронирование</h2>
          <Card className="bg-[#0b0b0b]/60 backdrop-blur-sm border-border">
            <CardHeader><CardTitle className="text-[#fff]">Форма брони</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs font-mono text-[#fff]">Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]" /></label>
                <label className="text-xs font-mono text-[#fff]">Время начала<select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]">{Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}</select></label>
                <label className="text-xs font-mono text-[#fff]">Длительность (часы)<input type="number" min={2} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-[#141212] border border-[#2b1b12] text-sm text-[#fff]" /></label>
                <div className="text-xs font-mono text-[#fff]">Скидки и звезды<div className="mt-1 text-sm text-[#fff]">Баланс: <strong className="text-[#ffd879]">{starsBalance}★</strong> • Стоимость в звёздах: <strong className="text-[#ffd879]">{starsCost}★</strong></div></div>
                <div className="col-span-1 sm:col-span-2 mt-2"><div className="flex gap-2 flex-wrap"><label className="inline-flex items-center gap-2 text-[#fff]"><input type="checkbox" checked={selectedExtras.cinema} onChange={() => toggleExtra('cinema' as any)} /> <span className="text-sm">Кино + приставка</span></label><label className="inline-flex items-center gap-2 text-[#fff]"><input type="checkbox" checked={selectedExtras.parilshchik} onChange={() => toggleExtra('parilshchik' as any)} /> <span className="text-sm">Парильщик</span></label><label className="inline-flex items-center gap-2 text-[#fff]"><input type="checkbox" checked={selectedExtras.shop} onChange={() => toggleExtra('shop' as any)} /> <span className="text-sm">Покупки на стойке</span></label></div></div>
                <div className="col-span-1 sm:col-span-2 mt-3"><div className="p-3 rounded bg-[#080707] border border-[#2b1b12]"><div className="flex justify-between items-center"><div className="text-sm text-[#fff]">Итого</div><div className="text-lg font-bold text-[#fff]">{totalPrice} ₽</div></div><div className="text-xs text-[#d9d6cd] mt-1">Или ~ {starsCost}★ (прибл.). При оплате — начислим {starsEarned}★ cashback.</div></div></div>
                {/* График — быстрый просмотр занятости для выбранной даты (Форма брони) */}
                <div className="mt-4 col-span-1 sm:col-span-2">
                  <SaunaOccupancyChart bookings={bookings} date={date} title="График занятости — выбранная дата" />
                </div>
                <div className="col-span-1 sm:col-span-2 mt-3"><textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Доп. пожелания (обогрев, музыка, фильм, просьба для парильщика)" className="w-full p-3 rounded bg-[#141212] border border-[#2b1b12] text-sm h-24 text-[#fff]" /></div>
                <div className="col-span-1 sm:col-span-2 mt-2"><div className="flex flex-col sm:flex-row gap-3"><Button onClick={handleCreateBooking} disabled={isSubmitting} className="flex-1 bg-[#ffd29b] text-[#241309] hover:bg-white">{isSubmitting ? "Обработка..." : "Создать бронь и получить счёт в Telegram"}</Button><Button variant="ghost" onClick={() => { setDate(new Date(Date.now() + 864e5).toISOString().slice(0, 10)); setMessage(""); setSelectedExtras({ cinema: false, parilshchik: false, shop: false }); setDurationHours(3); setStartHour(18); }} className="w-full sm:w-auto border border-[#ff6b6b] text-[#ffb6b6] hover:bg-[#2a0c0c]">Сброс</Button></div></div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="other" className="py-10 space-y-6 scroll-mt-24">
          <h2 className="text-3xl font-orbitron text-[#ffd29b] [text-shadow:0_0_12px_#ff8a00b0]">Прочее / Поддержка</h2>
          <SupportForm />
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