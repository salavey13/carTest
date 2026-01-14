"use client";

import React, { useEffect, useMemo, useRef, useState, useId, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import VibeContentRenderer from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import SaunaOccupancyChart from "@/components/SaunaOccupancyChart";
import { toast } from "sonner";
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ServiceCard } from "@/components/ServiceCard";
import { FaFacebook, FaInstagram, FaTwitter } from 'react-icons/fa';

// Server actions
import { createSaunaBooking, getMassageMasters } from "@/app/sauna-rent/actions";
import { updateUserSettings } from "@/app/actions";

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
  massageType?: string;
  masterId?: string;
};

type MassageMaster = {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  imageUrl: string;
  rating: number;
};

// ----------------------------- pricing constants -----------------------------
const BASE_PRICING = {
  weekdayMorningPerHour: 1800, // 09:00-15:00
  weekdayEveningPerHour: 2300, // 15:00-02:00
  weekendDayPerHour: 2000,     // 09:00-15:00
  weekendNightPerHour: 2500,   // 15:00-05:00
  fridayExtendedMultiplier: 1.15,
  cinemaFlat: 3000,
  parilshchikFlat: 1200,
  cleaningFlat: 500,
  classicPerHour: 2000,
  deepTissuePerHour: 2500,
  aromatherapyPerHour: 2200,
  hotStoneFlat: 500,
  extras: {
    oils: 300,
    music: 200,
  },
};

// helpers
function isWeekend(date: Date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}
function isFriday(date: Date) {
  return date.getDay() === 5;
}

// Local helper components
const StepItem: React.FC<{ num: string, title: string, icon: string, children: React.ReactNode }> = ({ num, title, icon, children }) => (
  <div className="text-center p-4">
    <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-emerald-500/10 border-2 border-amber-600 text-emerald-500">
      <VibeContentRenderer content={icon} className="w-8 h-8" />
      <span className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center rounded-full bg-amber-600 text-white font-bold">{num}</span>
    </div>
    <h3 className="font-orbitron text-lg mb-2">{title}</h3>
    <p className="text-sm text-stone-600">{children}</p>
  </div>
);

// ----------------------------- page -----------------------------
export default function ForestSPAPage() {
  const { dbUser, refreshDbUser } = useAppContext();
  const [showHistory, setShowHistory] = useState(false);
  
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
  const [currentStep, setCurrentStep] = useState(1);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [startHour, setStartHour] = useState(18);
  const [durationHours, setDurationHours] = useState(3);
  const [selectedSaunaExtras, setSelectedSaunaExtras] = useState<Record<string, boolean>>({ cinema: false, parilshchik: false, shop: false });
  const [massageType, setMassageType] = useState<string>('none');
  const [selectedMassageExtras, setSelectedMassageExtras] = useState<Record<string, boolean>>({ oils: false, music: false, hotStone: false });
  const [selectedMaster, setSelectedMaster] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [masters, setMasters] = useState<MassageMaster[]>([]);

  // Fetch masters using server action
  useEffect(() => {
    const fetchMasters = async () => {
      const result = await getMassageMasters();
      if (result.success) {
        setMasters(result.data);
      } else {
        toast.error(result.error || "Не удалось загрузить список мастеров.");
      }
    };
    fetchMasters();
  }, []);

  // Pricing calc
  const totalPrice = useMemo(() => {
    const d = new Date(date + "T00:00:00");
    const weekend = isWeekend(d);
    const friday = isFriday(d);
    const isEvening = startHour >= 15 || startHour < 6;
    let saunaPerHour = BASE_PRICING.weekdayMorningPerHour;
    if (weekend) {
      saunaPerHour = isEvening ? BASE_PRICING.weekendNightPerHour : BASE_PRICING.weekendDayPerHour;
    } else {
      saunaPerHour = isEvening ? BASE_PRICING.weekdayEveningPerHour : BASE_PRICING.weekdayMorningPerHour;
    }
    let price = saunaPerHour * durationHours;
    if (friday) price = Math.round(price * BASE_PRICING.fridayExtendedMultiplier);
    if (selectedSaunaExtras.cinema) price += BASE_PRICING.cinemaFlat;
    if (selectedSaunaExtras.parilshchik) price += BASE_PRICING.parilshchikFlat;
    if (selectedSaunaExtras.shop) price += 500; // Assume shop flat
    
    // Massage
    if (massageType !== 'none') {
      let massagePerHour = BASE_PRICING.classicPerHour;
      if (massageType === 'deepTissue') massagePerHour = BASE_PRICING.deepTissuePerHour;
      if (massageType === 'aromatherapy') massagePerHour = BASE_PRICING.aromatherapyPerHour;
      price += massagePerHour * durationHours;
      if (selectedMassageExtras.hotStone) price += BASE_PRICING.hotStoneFlat;
      if (selectedMassageExtras.oils) price += BASE_PRICING.extras.oils;
      if (selectedMassageExtras.music) price += BASE_PRICING.extras.music;
      if (selectedMaster) {
        const master = masters.find(m => m.id === selectedMaster);
        if (master) price *= (1 + (5 - master.rating) * 0.05); // Adjust price based on rating
      }
    }

    return Math.round(price);
  }, [date, startHour, durationHours, selectedSaunaExtras, massageType, selectedMassageExtras, selectedMaster, masters]);

  const starsCost = Math.round(totalPrice / 100);
  const starsEarned = Math.max(0, Math.round((totalPrice * 0.1) / 100));

  function toggleSaunaExtra(key: string) {
    setSelectedSaunaExtras((s) => ({ ...s, [key]: !s[key] }));
  }

  function toggleMassageExtra(key: string) {
    setSelectedMassageExtras((s) => ({ ...s, [key]: !s[key] }));
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
      extras: [...Object.keys(selectedSaunaExtras).filter(k => selectedSaunaExtras[k]), ...Object.keys(selectedMassageExtras).filter(k => selectedMassageExtras[k])],
      starsUsed: Math.min(starsBalance, starsCost),
      userId: dbUser?.user_id ?? undefined,
      notes: message || undefined,
      massageType: massageType !== 'none' ? massageType : undefined,
      masterId: selectedMaster || undefined,
    };

    try {
      const res = await createSaunaBooking(payload as any);
      if (!res || !res.success) {
        throw new Error(res?.error || "Сервер не смог создать бронь сауны");
      }
      toast.success("Бронь создана! Проверьте Telegram для подтверждения.");

      const id = res?.data?.rental_id || res?.data?.id || `bk_${Date.now()}`;
      const newBooking: Booking = {
        id, date, startHour, durationHours, price: totalPrice,
        starsUsed: payload.starsUsed || 0,
        extras: payload.extras || [],
        createdAt: new Date().toISOString(),
        start_at: startIso,
        end_at: endIso,
        massageType: payload.massageType,
        masterId: payload.masterId,
      };

      setBookings((b) => [newBooking, ...b]);
      
      const newBalance = Math.max(0, starsBalance - (payload.starsUsed || 0) + starsEarned);
      setStarsBalance(newBalance);
      await persistStarsBalance(newBalance);

      setMessage("Бронь создана — счёт отправлен в Telegram (проверь бота).");
      setCurrentStep(1); // Reset to start
    } catch (err: any) {
      console.error("Booking error:", err);
      setMessage(`Ошибка при создании брони: ${err.message}`);
      toast.error(`Ошибка бронирования: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const heroImage = "https://example.com/emerald-pool-waterfall-hero.jpg"; // Замените на реальное изображение бассейна с водопадом
  
  const cleaningOpportunities = useMemo(() => {
    return bookings.filter(b => {
      const extras = Array.isArray(b.extras) ? b.extras : [];
      const meta = b.metadata || {};
      return extras.includes('cleaning') || extras.includes('cleaning_paid') || meta.cleaning_paid === true;
    });
  }, [bookings]);

  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]); // For parallax

  const steps = [
    'Детали сауны',
    'Тип массажа',
    'Выберите массажиста',
    'Просмотр и подтверждение'
  ];

  return (
    <div className="relative min-h-screen bg-stone-100 overflow-hidden text-stone-900 dark:bg-stone-900 dark:text-stone-100">
        <section className="relative h-screen min-h-[600px] flex items-center justify-center text-center text-white p-4">
            <div className="absolute inset-0 z-0">
                <Image 
                  src={heroImage} 
                  alt="Бассейн с водопадом" 
                  layout="fill" 
                  objectFit="cover" 
                  className="brightness-75" 
                  priority 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 via-emerald-500/20 to-transparent"></div>
            </div>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 flex flex-col items-center"
            >
                <h1 className="font-orbitron font-black uppercase text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tighter leading-none">
                    <span className="block drop-shadow-lg">Forest SPA</span>
                    <span className="block text-emerald-300 drop-shadow-lg">Водный оазис</span>
                </h1>
                <p className="max-w-2xl mx-auto mt-6 text-lg md:text-xl text-stone-200 font-light">
                    Расслабление в изумрудных тонах: сауна, массаж и водные элементы в Нижнем Новгороде.
                </p>
                <div className="mt-8">
                    <Button asChild size="lg" variant="default" className="font-orbitron text-lg shadow-lg shadow-amber-600/30 hover:shadow-amber-600/50 transition-all duration-300 transform hover:scale-105 bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-amber-600">
                        <Link href="#booking">
                          <VibeContentRenderer content="::FaWater className='mr-2':: НАЧАТЬ ВОДНЫЙ ОПЫТ" />
                        </Link>
                    </Button>
                </div>
            </motion.div>
        </section>

        <motion.section style={{ y }} className="relative">
          {/* Showcase с водной тематикой */}
          <div className="h-[80vh] w-full overflow-hidden relative">
            <Image src="https://example.com/pool-waterfall-showcase.jpg" alt="Витрина бассейна с водопадом" layout="fill" objectFit="cover" className="brightness-75" />
            <div className="absolute inset-0 bg-emerald-500/10"></div>
          </div>
        </motion.section>

        {/* Новая секция: Live водопад */}
        <section className="py-16 bg-white/50 backdrop-blur-sm">
          <div className="container mx-auto max-w-7xl px-4">
            <h2 className="text-4xl font-orbitron text-center mb-10 text-emerald-700">Водопад в реальном времени</h2>
            <div className="relative max-w-4xl mx-auto rounded-lg overflow-hidden border-4 border-amber-600 shadow-2xl shadow-emerald-500/50">
              {/* Placeholder для live video; замените на реальный URL live stream, напр. YouTube live или RTSP */}
              <iframe 
                width="100%" 
                height="500" 
                src="https://www.youtube.com/embed/live_stream?channel=EXAMPLE_CHANNEL_ID" // Замените на реальный live stream водопада/бассейна
                title="Live Водопад в бассейне"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
            <p className="text-center mt-4 text-stone-700">Наслаждайтесь видом нашего бассейна с водопадом в реальном времени!</p>
          </div>
        </section>

        <div className="container mx-auto max-w-7xl px-4 py-16 sm:py-24 space-y-20 sm:space-y-28 bg-beige-50">
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-8 items-stretch">
                <ServiceCard 
                    title="Требования"
                    icon="::FaClipboardList::"
                    borderColorClass="border-amber-600 text-emerald-600"
                    items={[
                        { icon: "::FaUserClock::", text: "Возраст 18+" },
                        { icon: "::FaIdCard::", text: "Нет противопоказаний" },
                        { icon: "::FaAward::", text: "Залог от 5000 ₽" },
                        { icon: "::FaCreditCard::", text: "Оплата картой или наличными" }
                    ]}
                />
                 <ServiceCard 
                    title="Что вы получаете"
                    icon="::FaGift::"
                    borderColorClass="border-amber-600 text-emerald-600"
                    imageUrl="https://example.com/water-gift-pool.jpg" // Изображение с водной тематикой
                    items={[
                        { icon: "::FaCircleCheck::", text: "Полностью обслуживаемые помещения с водными элементами" },
                        { icon: "::FaUserShield::", text: "Профессиональное оборудование и персонал" },
                        { icon: "::FaTag::", text: "10% скидка с 'WATER2025'" }
                    ]}
                />
                <ServiceCard 
                    title="Услуги"
                    icon="::FaHands::"
                    borderColorClass="border-amber-600 text-emerald-600"
                    imageUrl="https://example.com/water-spa-services.jpg" // Изображение с бассейном/водопадом
                    items={[
                        { icon: "::FaWater::", text: "Сессии сауны с водопадом" },
                        { icon: "::FaOilWell::", text: "Типы массажа у бассейна" },
                        { icon: "::FaFire::", text: "Дополнение горячими камнями" },
                        { icon: "::FaHandsHelping::", text: "Индивидуальные водные опыты" }
                    ]}
                />
            </section>

            <section>
                <h2 className="text-4xl font-orbitron text-center mb-10 text-emerald-700">Наши массажисты</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {masters.map(master => (
                        <Card key={master.id} className="bg-white/50 p-4 rounded-lg border-2 border-amber-600 text-center relative h-full backdrop-blur-sm">
                            <Image src={master.imageUrl} alt={master.name} width={300} height={300} className="rounded-full mx-auto mb-4 object-cover aspect-square" />
                            <h4 className="font-orbitron text-lg mb-2 text-emerald-800">{master.name}</h4>
                            <p className="text-sm text-stone-600">{master.specialty}</p>
                            <p className="text-sm text-stone-700">{master.bio}</p>
                            <div className="mt-2 text-emerald-600">Рейтинг: {master.rating} ★</div>
                        </Card>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-4xl font-orbitron text-center mb-10 text-emerald-700">Как это работает</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StepItem num="1" title="Настройка сауны" icon="::FaCalendarCheck::">Выберите дату, время, дополнения.</StepItem>
                    <StepItem num="2" title="Тип массажа" icon="::FaHands::">Выберите массаж, если желаете.</StepItem>
                    <StepItem num="3" title="Массажист" icon="::FaUser::">Выберите вашего эксперта.</StepItem>
                    <StepItem num="4" title="Подтверждение" icon="::FaKey::">Просмотрите и забронируйте.</StepItem>
                </div>
            </section>
            
            <section className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-orbitron text-center mb-10 text-emerald-700">Часто задаваемые вопросы</h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-emerald-600">Можно ли забронировать сауну и массаж вместе?</AccordionTrigger>
                        <AccordionContent className="text-stone-700">Да, это интегрировано как один опыт с водными элементами.</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger className="text-emerald-600">Как выбрать массажиста?</AccordionTrigger>
                        <AccordionContent className="text-stone-700">На основе специализации, рейтинга и доступности у бассейна.</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                        <AccordionTrigger className="text-emerald-600">Что если массажист недоступен?</AccordionTrigger>
                        <AccordionContent className="text-stone-700">Система проверяет и предлагает альтернативы с видом на водопад.</AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>

            {/* Дополнительная секция с фото бассейна */}
            <section className="py-16">
              <h2 className="text-4xl font-orbitron text-center mb-10 text-emerald-700">Галерея бассейна и водопада</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Image src="https://example.com/pool-waterfall-1.jpg" alt="Бассейн с водопадом 1" width={600} height={400} className="rounded-lg border-2 border-amber-600" />
                <Image src="https://example.com/pool-waterfall-2.jpg" alt="Бассейн с водопадом 2" width={600} height={400} className="rounded-lg border-2 border-amber-600" />
                <Image src="https://example.com/pool-waterfall-3.jpg" alt="Бассейн с водопадом 3" width={600} height={400} className="rounded-lg border-2 border-amber-600" />
              </div>
            </section>

            <section id="booking" className="py-10 space-y-6 scroll-mt-24">
              <h2 className="text-3xl font-orbitron text-emerald-300 [text-shadow:0_0_12px_#047857b0]">Создайте свой водный опыт</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card className="bg-white/60 backdrop-blur-sm border-2 border-amber-600">
                    <CardHeader>
                      <CardTitle className="text-emerald-800">Мастер бронирования - Шаг {currentStep}/4</CardTitle>
                      <div className="flex justify-between mt-2">
                        {steps.map((step, idx) => (
                          <div key={idx} className={`text-sm ${idx + 1 === currentStep ? 'text-emerald-500' : 'text-stone-500'}`}>
                            {step}
                          </div>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <AnimatePresence mode="wait">
                        {currentStep === 1 && (
                          <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3 }}
                          >
                            {/* Step 1: Sauna */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <label className="text-xs font-mono text-emerald-800">Дата<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-2 rounded bg-white border-2 border-amber-600 text-sm text-stone-900" /></label>
                              <label className="text-xs font-mono text-emerald-800">Время начала<select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-white border-2 border-amber-600 text-sm text-stone-900">{Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}</select></label>
                              <label className="text-xs font-mono text-emerald-800">Продолжительность (часы)<input type="number" min={2} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-white border-2 border-amber-600 text-sm text-stone-900" /></label>
                              <div className="col-span-1 sm:col-span-2 mt-2">
                                <div className="flex gap-2 flex-wrap">
                                  <label className="inline-flex items-center gap-2 text-emerald-800"><input type="checkbox" checked={selectedSaunaExtras.cinema} onChange={() => toggleSaunaExtra('cinema')} /> <span className="text-sm">Кино + консоль</span></label>
                                  <label className="inline-flex items-center gap-2 text-emerald-800"><input type="checkbox" checked={selectedSaunaExtras.parilshchik} onChange={() => toggleSaunaExtra('parilshchik')} /> <span className="text-sm">Парильщик</span></label>
                                  <label className="inline-flex items-center gap-2 text-emerald-800"><input type="checkbox" checked={selectedSaunaExtras.shop} onChange={() => toggleSaunaExtra('shop')} /> <span className="text-sm">Товары из магазина</span></label>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                        {currentStep === 2 && (
                          <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3 }}
                          >
                            {/* Step 2: Massage Type */}
                            <div className="grid grid-cols-1 gap-3">
                              <label className="text-xs font-mono text-emerald-800">Тип массажа<select value={massageType} onChange={(e) => setMassageType(e.target.value)} className="w-full mt-1 p-2 rounded bg-white border-2 border-amber-600 text-sm text-stone-900">
                                <option value="none">Без массажа</option>
                                <option value="classic">Классический ({BASE_PRICING.classicPerHour} ₽/ч)</option>
                                <option value="deepTissue">Глубокотканный ({BASE_PRICING.deepTissuePerHour} ₽/ч)</option>
                                <option value="aromatherapy">Ароматерапия ({BASE_PRICING.aromatherapyPerHour} ₽/ч)</option>
                              </select></label>
                              {massageType !== 'none' && (
                                <div className="mt-2">
                                  <div className="flex gap-2 flex-wrap">
                                    <label className="inline-flex items-center gap-2 text-emerald-800"><input type="checkbox" checked={selectedMassageExtras.oils} onChange={() => toggleMassageExtra('oils')} /> <span className="text-sm">Масла (+{BASE_PRICING.extras.oils} ₽)</span></label>
                                    <label className="inline-flex items-center gap-2 text-emerald-800"><input type="checkbox" checked={selectedMassageExtras.music} onChange={() => toggleMassageExtra('music')} /> <span className="text-sm">Музыка (+{BASE_PRICING.extras.music} ₽)</span></label>
                                    <label className="inline-flex items-center gap-2 text-emerald-800"><input type="checkbox" checked={selectedMassageExtras.hotStone} onChange={() => toggleMassageExtra('hotStone')} /> <span className="text-sm">Горячие камни (+{BASE_PRICING.hotStoneFlat} ₽)</span></label>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                        {currentStep === 3 && (
                          <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3 }}
                          >
                            {/* Step 3: Choose Massagist */}
                            <div className="grid grid-cols-1 gap-3">
                              <label className="text-xs font-mono text-emerald-800">Выберите массажиста<select value={selectedMaster} onChange={(e) => setSelectedMaster(e.target.value)} className="w-full mt-1 p-2 rounded bg-white border-2 border-amber-600 text-sm text-stone-900">
                                <option value="">Любой доступный</option>
                                {masters.filter(m => massageType === 'none' || m.specialty.toLowerCase().includes(massageType.toLowerCase())).map(m => <option key={m.id} value={m.id}>{m.name} ({m.rating}★)</option>)}
                              </select></label>
                              {selectedMaster && (
                                <div className="mt-2 p-2 bg-stone-50 rounded border-2 border-amber-600">
                                  <div className="text-sm text-emerald-800">Выбрано: {masters.find(m => m.id === selectedMaster)?.name}</div>
                                  <div className="text-xs text-stone-600">Био: {masters.find(m => m.id === selectedMaster)?.bio}</div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                        {currentStep === 4 && (
                          <motion.div
                            key="step4"
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -50 }}
                            transition={{ duration: 0.3 }}
                          >
                            {/* Step 4: Review & Confirm */}
                            <div className="space-y-2">
                              <div className="text-sm text-emerald-800">Дата: {date}</div>
                              <div className="text-sm text-emerald-800">Время: {formatHour(startHour)} на {durationHours} часов</div>
                              <div className="text-sm text-emerald-800">Дополнения сауны: {Object.keys(selectedSaunaExtras).filter(k => selectedSaunaExtras[k]).join(", ") || "Нет"}</div>
                              <div className="text-sm text-emerald-800">Тип массажа: {massageType || "Нет"}</div>
                              <div className="text-sm text-emerald-800">Дополнения массажа: {Object.keys(selectedMassageExtras).filter(k => selectedMassageExtras[k]).join(", ") || "Нет"}</div>
                              <div className="text-sm text-emerald-800">Массажист: {selectedMaster ? masters.find(m => m.id === selectedMaster)?.name : "Любой"}</div>
                              <div className="text-lg font-bold text-emerald-800">Итого: {totalPrice} ₽ (Стоимость в звездах: {starsCost}★, Заработать: {starsEarned}★)</div>
                              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Дополнительные заметки" className="w-full p-3 rounded bg-white border-2 border-amber-600 text-sm h-24 text-stone-900" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="flex justify-between mt-4">
                        <Button disabled={currentStep === 1 || isSubmitting} onClick={() => setCurrentStep(prev => prev - 1)} variant="ghost" className="text-emerald-600 hover:text-emerald-500">Назад</Button>
                        {currentStep < 4 ? (
                          <Button disabled={isSubmitting} onClick={() => setCurrentStep(prev => prev + 1)} className="bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-amber-600">Далее</Button>
                        ) : (
                          <Button disabled={isSubmitting} onClick={handleCreateBooking} className="bg-emerald-600 hover:bg-emerald-500 text-white border-2 border-amber-600">{isSubmitting ? "Бронирование..." : "Подтвердить и забронировать"}</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  {/* History */}
                  <Button variant="ghost" onClick={() => setShowHistory(s => !s)} className="mt-4 text-emerald-600">{showHistory ? "Скрыть историю" : "Показать историю"}</Button>
                  {showHistory && (
                    <Card className="mt-4 bg-white/60 backdrop-blur-sm border-2 border-amber-600">
                      <CardHeader><CardTitle className="text-emerald-800">История бронирований</CardTitle></CardHeader>
                      <CardContent>
                        {bookings.length === 0 ? <div className="text-sm text-stone-600">Пока нет бронирований.</div> : (
                          <ul className="space-y-2">
                            {bookings.map((b) => (
                              <li key={b.id} className="p-2 rounded bg-white border-2 border-amber-600">
                                <div className="flex justify-between items-center">
                                  <div className="text-sm text-emerald-800">{b.date} • {formatHour(b.startHour)} • {b.durationHours}ч {b.massageType ? `(${b.massageType})` : ''}</div>
                                  <div className="text-sm font-semibold text-emerald-800">{b.price} ₽</div>
                                </div>
                                <div className="text-xs text-stone-600 mt-1">Дополнения: {b.extras.join(", ") || "—"} • Мастер: {b.masterId ? masters.find(m => m.id === b.masterId)?.name : "Нет"}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
                {/* Aside with stars, chart, links */}
                <aside><Card className="bg-white/60 backdrop-blur-sm border-2 border-amber-600 md:sticky md:top-24"><CardHeader><CardTitle className="text-emerald-800">Система звезд</CardTitle></CardHeader><CardContent><p className="text-sm text-stone-600 mb-2">Ваши звезды — внутренняя валюта. Тратьте на скидки или копите для будущих бронирований.</p><div className="p-3 bg-stone-50 rounded border-2 border-amber-600"><div className="text-xs text-emerald-500">Баланс</div><div className="text-3xl font-bold flex items-center gap-2 text-emerald-800"><VibeContentRenderer content="::FaStar::" className="w-7 h-7 text-amber-500" /> {starsBalance}★</div><div className="text-xs text-stone-600 mt-2">Итого: начисления за действия, рефералы, уборки.</div></div><div className="mt-4"><div className="text-xs text-emerald-500 mb-2">Подписаться на оповещения об уборках</div><p className="text-xs text-stone-600">После аренды подпишитесь на короткую смену уборки: оплачивается в звездах.</p><div className="mt-2 flex gap-2"><Button onClick={() => alert("TODO: send subscription to /api/notify-cleanup")} className="bg-emerald-600 text-white hover:bg-emerald-500 border-2 border-amber-600">Подписаться</Button><SaunaOccupancyChart bookings={cleaningOpportunities} title="Расписание доступных уборок" /></div></div></CardContent></Card><Card className="bg-white/60 backdrop-blur-sm border-2 border-amber-600 mt-6"><CardContent className="py-4"><h4 className="font-semibold mb-2 text-emerald-800">Быстрые ссылки</h4><ul className="text-sm list-inside space-y-2 text-stone-600"><li><Link href="/vipbikerental" className="text-emerald-600 hover:underline">VIP байк</Link></li><li><Link href="/repo-xml" className="text-emerald-600 hover:underline">/repo-xml Студия</Link></li><li><Link href="/selfdev" className="text-emerald-600 hover:underline">Саморазвитие</Link></li></ul></CardContent></Card></aside>
              </div>
            </section>
        </div>

        <footer className="bg-emerald-900/50 py-12 px-4">
          <div className="container mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-orbitron text-xl mb-4 text-white">Forest SPA</h3>
              <p className="text-stone-300">Идеальная сауна и массаж с водной тематикой в Нижнем Новгороде.</p>
            </div>
            <div>
              <h3 className="font-orbitron text-xl mb-4 text-white">Ссылки</h3>
              <ul className="space-y-2">
                <li><Link href="#zones" className="text-emerald-300 hover:underline">Зоны</Link></li>
                <li><Link href="#pricing" className="text-emerald-300 hover:underline">Цены</Link></li>
                <li><Link href="#extras" className="text-emerald-300 hover:underline">Дополнения</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-orbitron text-xl mb-4 text-white">Контакты</h3>
              <p className="text-stone-300">Проспект Ленина 98, Гостиница Волна</p>
              <p className="text-stone-300">Тел: +7 (XXX) XXX-XX-XX</p>
              <p className="text-stone-300">Email: info@forestspa.ru</p>
            </div>
            <div>
              <h3 className="font-orbitron text-xl mb-4 text-white">Социальные сети</h3>
              <div className="flex space-x-4">
                <a href="#" className="text-emerald-300 hover:text-emerald-500"><FaFacebook size={24} /></a>
                <a href="#" className="text-emerald-300 hover:text-emerald-500"><FaInstagram size={24} /></a>
                <a href="#" className="text-emerald-300 hover:text-emerald-500"><FaTwitter size={24} /></a>
              </div>
            </div>
          </div>
          <div className="container mx-auto max-w-7xl mt-8 text-center text-stone-300">
            © 2025 Forest SPA. Все права защищены.
          </div>
        </footer>
    </div>
  );
}