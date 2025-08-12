"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion"; // <-- ВОССТАНОВЛЕН ИМПОРТ
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // <-- ДОБАВЛЕН CardDescription
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import { createSaunaBooking } from "./actions"; // <-- Убедимся, что путь правильный
import { toast } from "sonner";

// -----------------------------------------------------------------------------
// MEGA Sauna-Rent Page — "САУНА-ВОЛНА" (Финальная версия)
// -----------------------------------------------------------------------------

// --- КОНФИГУРАЦИЯ ---
const SAUNA_NAME = "САУНА-ВОЛНА";
const PRICING = {
  weekday: 1500, // Пн-Пт 09:00-15:00
  weekend: 2000, // Пт 15:00 - Пн 09:00
  minHours: 2,
};
const CONTACTS = {
  address: "Проспект Ленина 98, Нижний Новгород, Гостиница Волна",
  phone: "+7 (920) 016-91-01",
  email: "volnasauna@gmail.com",
  whatsapp: "+7-920-016-91-01",
  telegram: "https://t.me/your_telegram_contact", // ЗАМЕНИТЬ НА РЕАЛЬНЫЙ КОНТАКТ
};

// --- ТИПЫ ДАННЫХ ---
type Booking = {
  id: string; date: string; startHour: number; durationHours: number; price: number;
};

// --- КОМПОНЕНТЫ СТРАНИЦЫ ---

const ZoneCard = ({ id, title, icon, description, images }: { id: string; title: string; icon: string; description: string; images: string[] }) => (
  <section id={id} className="scroll-mt-24">
    <Card className="bg-card/70 backdrop-blur-md border-border overflow-hidden h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-2xl font-orbitron text-primary">
          <VibeContentRenderer content={icon} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col">
        <p className="text-muted-foreground mb-4 flex-grow">{description}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((src, idx) => (
            <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border/50">
              <Image src={src} alt={`${title} фото ${idx + 1}`} layout="fill" objectFit="cover" className="hover:scale-105 transition-transform duration-300" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </section>
);

const ServiceItem = ({ icon, title, description }: { icon: string; title: string; description: string }) => (
  <div className="flex items-start gap-4 p-4 rounded-lg bg-card/50 border border-border">
    <VibeContentRenderer content={icon} className="text-3xl text-primary mt-1" />
    <div>
      <h4 className="font-semibold">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  </div>
);

// --- ОСНОВНОЙ КОМПОНЕНТ ---

export default function SaunaRentPage() {
  const { dbUser } = useAppContext();
  const [activeId, setActiveId] = useState("hero");
  const observerRef = useRef<IntersectionObserver | null>(null);

  // *** ВОССТАНОВЛЕНА ЛОГИКА БРОНИРОВАНИЯ ***
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [startHour, setStartHour] = useState(18);
  const [durationHours, setDurationHours] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const sections = [
    { id: "hero", label: "Главная" },
    { id: "zones", label: "Зоны" },
    { id: "pricing", label: "Цены" },
    { id: "services", label: "Услуги" },
    { id: "staff", label: "Работа" },
    { id: "stars", label: "Звёзды" },
    { id: "booking", label: "Бронь" },
    { id: "support", label: "Прочее" },
  ];

  useEffect(() => {
    const opts = { root: null, rootMargin: "-20% 0px -60% 0px", threshold: 0.1 };
    observerRef.current = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting && e.target.id) setActiveId(e.target.id); }); }, opts);
    sections.forEach((s) => { const el = document.getElementById(s.id); if (el) observerRef.current?.observe(el); });
    return () => observerRef.current?.disconnect();
  }, []);

  const totalPrice = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const isWeekendOrFridayEvening = d.getDay() === 5 && startHour >= 15 || d.getDay() === 6 || d.getDay() === 0 || (d.getDay() === 1 && startHour < 9);
    const basePerHour = isWeekendOrFridayEvening ? PRICING.weekend : PRICING.weekday;
    return basePerHour * durationHours;
  }, [date, startHour, durationHours]);

  const handleBookingClick = () => { document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" }); };
  
  function formatHour(h: number) { return `${(h % 24).toString().padStart(2, "0")}:00`; }

  async function handleCreateBooking() {
    if (!dbUser?.user_id) { toast.error("Для бронирования необходимо авторизоваться."); return; }
    setIsSubmitting(true); setMessage("");
    const start = new Date(date); start.setHours(startHour, 0, 0, 0);
    const end = new Date(start.getTime() + durationHours * 3600 * 1000);
    
    try {
      const res = await createSaunaBooking({
        saunaVehicleId: "sauna-volna-01",
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        price: totalPrice,
        userId: dbUser.user_id,
        extras: [],
      });
      if (!res.success) throw new Error(res.error || "Ошибка на сервере");

      const newBooking = { id: res.data?.rental_id || `bk_${Date.now()}`, date, startHour, durationHours, price: totalPrice };
      setBookings(b => [newBooking, ...b]);
      toast.success("Бронь создана! Счет отправлен в ваш Telegram.");
      setMessage("Бронь создана — счёт отправлен в Telegram. Проверьте бота.");
    } catch (err: any) {
      toast.error(`Ошибка бронирования: ${err.message}`);
      setMessage("Ошибка при создании брони. Попробуйте ещё раз.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased overflow-x-hidden dark">
      <div className="absolute inset-0 z-0 bg-grid-pattern opacity-10" />

      {/* STICKY ХЕДЕР */}
      <div className="sticky top-4 z-40 mx-auto container px-4">
         <div className="backdrop-blur-xl bg-card/80 border border-border rounded-xl p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
              <VibeContentRenderer content="::FaWater::" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{SAUNA_NAME}</div>
              <div className="text-xs text-muted-foreground font-mono">Гостиница Волна</div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {sections.filter(s => ['zones', 'pricing', 'services', 'staff', 'support'].includes(s.id)).map(s => (
              <Button key={s.id} variant="ghost" size="sm" asChild className={cn(activeId === s.id && "bg-muted text-primary")}>
                <Link href={`#${s.id}`}>{s.label}</Link>
              </Button>
            ))}
          </div>
          <Button onClick={handleBookingClick} className="hidden md:flex bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
            <VibeContentRenderer content="::FaCalendarCheck::" className="mr-2" /> БРОНЬ
          </Button>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8 space-y-20 relative z-10">
        {/* HERO */}
        <section id="hero" className="text-center pt-16 pb-8 scroll-mt-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-5xl md:text-7xl font-orbitron font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 text-shadow-cyber">{SAUNA_NAME}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mt-4">Финская сауна для компании до 12 человек. Идеальное место для отдыха и перезагрузки в самом сердце города.</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <MetricItem icon="::FaUsers::" value="до 12" label="Человек" />
            <MetricItem icon="::FaHotTubPerson::" value="на 6" label="Парилка" />
            <MetricItem icon="::FaWater::" value="1" label="Джакузи" />
            <MetricItem icon="::FaUsers::" value="на 8" label="Гостиная" />
          </motion.div>
        </section>

        {/* ЗОНЫ */}
        <section id="zones" className="scroll-mt-24">
          <h2 className="text-4xl font-orbitron text-center mb-10">Наши Зоны</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ZoneCard id="zone-steam" title="Зона 1: Парилка" icon="::FaTemperatureHigh::" description="Жаркая финская парная для полного расслабления. Дополнительно можно заказать услуги парильщика, веники и ароматические масла." images={["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/sauna-1.jpg", "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/sauna-2.jpg", "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/sauna-3.jpg"]} />
            <ZoneCard id="zone-aqua" title="Зона 2: Аква-зона" icon="::FaWater::" description="Освежающий бассейн, джакузи с гидромассажем на двоих и душевые. Предоставляются полотенца, тапочки и шампуни." images={["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/pool-1.jpg", "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/jacuzzi-1.jpg", "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/shower-1.jpg"]} />
            <ZoneCard id="zone-lounge" title="Зона 3: Гостиная" icon="::FaDice::" description="Просторная гостиная со столом на 8 человек. Идеально для отдыха компанией. Доступны настольные игры: нарды, покер, дженга." images={["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/lounge-1.jpg", "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/lounge-2.jpg", "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/lounge-3.jpg"]} />
            <ZoneCard id="zone-media" title="Зона 4: Медиа-зона" icon="::FaGamepad::" description="Современный кинотеатр с большим экраном и удобными диванами. Игровая приставка с последними хитами для полного погружения." images={["https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/cinema-1.jpg", "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/cinema-2.jpg", "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/sauna-images/console-1.jpg"]} />
          </div>
        </section>
        
        {/* ЦЕНЫ */}
        <section id="pricing" className="text-center scroll-mt-24">
          <h2 className="text-4xl font-orbitron mb-10">Цены и Правила</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <Card className="bg-card/70 backdrop-blur-md border-border"><CardHeader><CardTitle>Будние Дни</CardTitle><CardDescription>Пн-Пт с 09:00 до 15:00</CardDescription></CardHeader><CardContent><p className="text-4xl font-bold text-primary">{PRICING.weekday} ₽ <span className="text-lg font-normal text-muted-foreground">/ час</span></p></CardContent></Card>
            <Card className="bg-card/70 backdrop-blur-md border-border"><CardHeader><CardTitle>Вечер и Выходные</CardTitle><CardDescription>Пт 15:00 - Пн 09:00</CardDescription></CardHeader><CardContent><p className="text-4xl font-bold text-primary">{PRICING.weekend} ₽ <span className="text-lg font-normal text-muted-foreground">/ час</span></p></CardContent></Card>
          </div>
          <div className="mt-6 p-4 bg-card/50 rounded-lg border-border max-w-3xl mx-auto"><h4 className="font-semibold">Особые правила</h4><ul className="list-disc list-inside mt-2 text-sm text-muted-foreground"><li>Минимальная аренда — {PRICING.minHours} часа.</li><li>Вместимость до 12 человек.</li><li>Все дополнительные услуги и их стоимость уточняйте у администратора.</li></ul></div>
        </section>

        {/* УСЛУГИ */}
        <section id="services" className="scroll-mt-24">
          <h2 className="text-4xl font-orbitron text-center mb-10">Дополнительные Услуги</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <ServiceItem icon="::FaFilm::" title="Кинотеатр и Приставка" description="Аренда медиа-зоны с доступом к библиотеке фильмов и игровой консоли." />
            <ServiceItem icon="::FaHotTubPerson::" title="Услуги Парильщика" description="Профессиональный парильщик проведет для вас ритуал парения." />
            <ServiceItem icon="::FaGift::" title="Аксессуары и Дополнения" description="В продаже имеются веники, ароматические масла, тапочки, полотенца и напитки." />
          </div>
        </section>

        {/* *** ВОССТАНОВЛЕНА СЕКЦИЯ БРОНИРОВАНИЯ *** */}
        <section id="booking" className="scroll-mt-24">
          <h2 className="text-4xl font-orbitron text-center mb-10">Бронирование</h2>
          <Card className="max-w-3xl mx-auto bg-card/70 backdrop-blur-md border-border">
            <CardHeader>
              <CardTitle>Форма бронирования</CardTitle>
              <CardDescription>Выберите дату, время и длительность. Минимально {PRICING.minHours} часа.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="text-sm font-mono text-muted-foreground block mb-1">Дата</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 rounded bg-input border border-input-border text-sm" /></div>
                <div><label className="text-sm font-mono text-muted-foreground block mb-1">Время</label><select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full p-2 rounded bg-input border border-input-border text-sm">{Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}</select></div>
                <div><label className="text-sm font-mono text-muted-foreground block mb-1">Часы</label><input type="number" min={PRICING.minHours} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full p-2 rounded bg-input border border-input-border text-sm" /></div>
              </div>
              <div className="p-4 rounded-lg bg-background/50 border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground">ИТОГО К ОПЛАТЕ</p>
                <p className="text-3xl font-orbitron font-bold text-primary">{totalPrice} ₽</p>
              </div>
              <Button onClick={handleCreateBooking} disabled={isSubmitting || durationHours < PRICING.minHours} className="w-full text-lg">
                {isSubmitting ? "Обработка..." : "Забронировать и получить счёт"}
              </Button>
              {message && <p className="text-center text-sm text-accent-text font-mono mt-2">{message}</p>}
            </CardContent>
          </Card>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <section id="staff" className="scroll-mt-24"><h3 className="text-2xl font-orbitron mb-4">Работа и Клининг</h3><p className="text-sm text-muted-foreground">Информация о вакансиях для персонала, клининг-команд и график работы. Управление сменами и задачами.</p></section>
            <section id="stars" className="scroll-mt-24"><h3 className="text-2xl font-orbitron mb-4">Система Звёзд</h3><p className="text-sm text-muted-foreground">Наша программа мотивации. Зарабатывайте звёзды за бронирования и активность, обменивайте их на скидки. Здесь же будет отображаться график занятости сауны.</p></section>
            <section id="support" className="scroll-mt-24"><h3 className="text-2xl font-orbitron mb-4">Прочее</h3><p className="text-sm text-muted-foreground">Подписка на новости, служба поддержки, контакты и информация о нас.</p></section>
        </div>
      </main>

      {/* НИЖНЯЯ НАВИГАЦИЯ */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] sm:max-w-lg md:hidden">
        <div className="bg-card/90 backdrop-blur-xl border border-border rounded-full p-1.5 flex justify-around items-center shadow-lg">
          <Link href="#hero" className={cn("px-3 py-2 rounded-full text-xs font-semibold", activeId === "hero" ? "text-primary" : "text-muted-foreground")}>Главная</Link>
          <Link href="#zones" className={cn("px-3 py-2 rounded-full text-xs font-semibold", activeId === "zones" ? "text-primary" : "text-muted-foreground")}>Зоны</Link>
          <Button onClick={handleBookingClick} size="sm" className="rounded-full font-bold text-sm bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/40">БРОНЬ</Button>
          <Link href="#pricing" className={cn("px-3 py-2 rounded-full text-xs font-semibold", activeId === "pricing" ? "text-primary" : "text-muted-foreground")}>Цены</Link>
          <Link href="#services" className={cn("px-3 py-2 rounded-full text-xs font-semibold", activeId === "services" ? "text-primary" : "text-muted-foreground")}>Услуги</Link>
        </div>
      </div>
    </div>
  );
}

const MetricItem = ({ icon, value, label }: { icon: string; value: string | number; label: string }) => (
    <div className='text-center p-3 rounded-lg bg-card/50 border border-border/50'>
        <VibeContentRenderer content={icon} className="mb-1 mx-auto text-2xl text-primary" />
        <p className="font-mono">
            <strong className="block text-xl font-orbitron text-foreground">{value}</strong>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        </p>
    </div>
);