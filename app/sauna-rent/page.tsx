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
    <div className="relative w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-600">
      <VibeContentRenderer content={icon} className="w-8 h-8" />
      <span className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center rounded-full bg-copper-300 text-white font-bold">{num}</span>
    </div>
    <h3 className="font-orbitron text-lg mb-2 text-emerald-700">{title}</h3>
    <p className="text-sm text-gray-600">{children}</p>
  </div>
);

// ----------------------------- page -----------------------------
export default function LesSPAPage() {
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
        toast.error(result.error || "Could not fetch masters list.");
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
        throw new Error(res?.error || "Server failed to create sauna booking");
      }
      toast.success("Booking created! Check Telegram for confirmation.");

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
      toast.error(`Booking Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  const heroImage = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/her2-31adfe54-e81d-4e65-becf-e85e689af170.jpg";
  
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
    'Sauna Details',
    'Massage Type',
    'Choose Massagist',
    'Review & Confirm'
  ];

  return (
    <div 
      className="relative min-h-screen overflow-hidden text-gray-800"
      style={{
        backgroundColor: '#F5F5F5',
        backgroundImage: 'linear-gradient(to bottom, #F5F5F5, #EDEDED)',
      }}
    >
        <section className="relative h-screen min-h-[600px] flex items-center justify-center text-center text-white p-4">
            <div className="absolute inset-0 z-0">
                <Image 
                  src={heroImage} 
                  alt="Лес SPA" 
                  layout="fill" 
                  objectFit="cover" 
                  className="brightness-50" 
                  priority 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 via-emerald-700/30 to-transparent"></div>
            </div>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="relative z-10 flex flex-col items-center"
            >
                <h1 className="font-orbitron font-black uppercase text-5xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tighter leading-none">
                    <span className="block drop-shadow-lg">Лес SPA</span>
                    <span className="block text-emerald-300 drop-shadow-lg">Sauna & Massage</span>
                </h1>
                <p className="max-w-2xl mx-auto mt-6 text-lg md:text-xl text-gray-200 font-light">
                    Ultimate relaxation in Нижний Новгород: Sauna sessions with optional professional massage.
                </p>
                <div className="mt-8">
                    <Button asChild size="lg" className="font-orbitron text-lg bg-emerald-600 text-white shadow-lg shadow-emerald-400/50 hover:bg-emerald-700 hover:shadow-emerald-500/50 transition-all duration-300 transform hover:scale-105">
                        <Link href="#booking">
                          <VibeContentRenderer content="::FaSpa className='mr-2':: START EXPERIENCE" />
                        </Link>
                    </Button>
                </div>
            </motion.div>
        </section>

        <motion.section style={{ y }} className="relative">
          {/* Showcase */}
          <div className="h-[80vh] w-full overflow-hidden relative">
            <Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/spa-showcase.jpg" alt="Showcase" layout="fill" objectFit="cover" className="brightness-75" />
          </div>
        </motion.section>

        <div className="container mx-auto max-w-7xl px-4 py-16 sm:py-24 space-y-20 sm:space-y-28 bg-white/50 backdrop-blur-sm">
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-8 items-stretch">
                <ServiceCard 
                    title="Requirements"
                    icon="::FaClipboardList::"
                    borderColorClass="border-emerald-500 text-emerald-600"
                    items={[
                        { icon: "::FaUserClock::", text: "Age 18+" },
                        { icon: "::FaIdCard::", text: "No contraindications" },
                        { icon: "::FaAward::", text: "Deposit from 5000 ₽" },
                        { icon: "::FaCreditCard::", text: "Payment by card or cash" }
                    ]}
                />
                 <ServiceCard 
                    title="What you get"
                    icon="::FaGift::"
                    borderColorClass="border-copper-400 text-copper-600"
                    imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/spa-gift.jpg"
                    items={[
                        { icon: "::FaCircleCheck::", text: "Fully serviced facilities" },
                        { icon: "::FaUserShield::", text: "Professional equipment and staff" },
                        { icon: "::FaTag::", text: "10% discount with 'SPA2025'" }
                    ]}
                />
                <ServiceCard 
                    title="Services"
                    icon="::FaHands::"
                    borderColorClass="border-emerald-500 text-emerald-600"
                    imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/spa-services.jpg"
                    items={[
                        { icon: "::FaSpa::", text: "Sauna sessions" },
                        { icon: "::FaOilWell::", text: "Massage types" },
                        { icon: "::FaFire::", text: "Hot stones add-on" },
                        { icon: "::FaHandsHelping::", text: "Custom experiences" }
                    ]}
                />
            </section>

            <section>
                <h2 className="text-4xl font-orbitron text-center mb-10 text-emerald-700">Our Massagists</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {masters.map(master => (
                        <Card key={master.id} className="bg-white p-4 rounded-lg border border-copper-300 text-center relative h-full shadow-md" style={{ boxShadow: '0 4px 8px rgba(168, 94, 42, 0.2)' }}>
                            <Image src={master.imageUrl} alt={master.name} width={300} height={300} className="rounded-full mx-auto mb-4 object-cover aspect-square" />
                            <h4 className="font-orbitron text-lg mb-2 text-emerald-600">{master.name}</h4>
                            <p className="text-sm text-gray-600">{master.specialty}</p>
                            <p className="text-sm text-gray-500">{master.bio}</p>
                            <div className="mt-2 text-copper-600">Rating: {master.rating} ★</div>
                        </Card>
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-4xl font-orbitron text-center mb-10 text-emerald-700">How it works</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    <StepItem num="1" title="Sauna Setup" icon="::FaCalendarCheck::">Choose date, time, extras.</StepItem>
                    <StepItem num="2" title="Massage Type" icon="::FaHands::">Select massage if desired.</StepItem>
                    <StepItem num="3" title="Massagist" icon="::FaUser::">Pick your expert.</StepItem>
                    <StepItem num="4" title="Confirm" icon="::FaKey::">Review and book.</StepItem>
                </div>
            </section>
            
            <section className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-orbitron text-center mb-10 text-emerald-700">FAQ</h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-emerald-600">Can I book sauna and massage together?</AccordionTrigger>
                        <AccordionContent className="text-gray-600">Yes, it's integrated as one experience.</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger className="text-emerald-600">How to choose massagist?</AccordionTrigger>
                        <AccordionContent className="text-gray-600">Based on specialty, rating, and availability.</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-3">
                        <AccordionTrigger className="text-emerald-600">What if massagist is unavailable?</AccordionTrigger>
                        <AccordionContent className="text-gray-600">System checks and suggests alternatives.</AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>

            <section id="booking" className="py-10 space-y-6 scroll-mt-24">
              <h2 className="text-3xl font-orbitron text-emerald-600 [text-shadow:0_0_12px_#04785740]">Create Your Experience</h2>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card className="bg-white/80 backdrop-blur-sm border-copper-300" style={{ borderImage: 'linear-gradient(to right, #B87333, #A55E2A) 1' }}>
                    <CardHeader>
                      <CardTitle className="text-emerald-700">Booking Wizard - Step {currentStep}/4</CardTitle>
                      <div className="flex justify-between mt-2">
                        {steps.map((step, idx) => (
                          <div key={idx} className={`text-sm ${idx + 1 === currentStep ? 'text-emerald-600' : 'text-gray-500'}`}>
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
                              <label className="text-xs font-mono text-gray-700">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full mt-1 p-2 rounded bg-gray-100 border border-copper-200 text-sm text-gray-800" /></label>
                              <label className="text-xs font-mono text-gray-700">Start Time<select value={String(startHour)} onChange={(e) => setStartHour(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-gray-100 border border-copper-200 text-sm text-gray-800">{Array.from({ length: 24 }).map((_, i) => <option key={i} value={i}>{formatHour(i)}</option>)}</select></label>
                              <label className="text-xs font-mono text-gray-700">Duration (hours)<input type="number" min={2} max={12} value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))} className="w-full mt-1 p-2 rounded bg-gray-100 border border-copper-200 text-sm text-gray-800" /></label>
                              <div className="col-span-1 sm:col-span-2 mt-2">
                                <div className="flex gap-2 flex-wrap">
                                  <label className="inline-flex items-center gap-2 text-gray-700"><input type="checkbox" checked={selectedSaunaExtras.cinema} onChange={() => toggleSaunaExtra('cinema')} /> <span className="text-sm">Cinema + Console</span></label>
                                  <label className="inline-flex items-center gap-2 text-gray-700"><input type="checkbox" checked={selectedSaunaExtras.parilshchik} onChange={() => toggleSaunaExtra('parilshchik')} /> <span className="text-sm">Parilshchik</span></label>
                                  <label className="inline-flex items-center gap-2 text-gray-700"><input type="checkbox" checked={selectedSaunaExtras.shop} onChange={() => toggleSaunaExtra('shop')} /> <span className="text-sm">Shop Items</span></label>
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
                              <label className="text-xs font-mono text-gray-700">Massage Type<select value={massageType} onChange={(e) => setMassageType(e.target.value)} className="w-full mt-1 p-2 rounded bg-gray-100 border border-copper-200 text-sm text-gray-800">
                                <option value="none">No Massage</option>
                                <option value="classic">Classic ({BASE_PRICING.classicPerHour} ₽/hr)</option>
                                <option value="deepTissue">Deep Tissue ({BASE_PRICING.deepTissuePerHour} ₽/hr)</option>
                                <option value="aromatherapy">Aromatherapy ({BASE_PRICING.aromatherapyPerHour} ₽/hr)</option>
                              </select></label>
                              {massageType !== 'none' && (
                                <div className="mt-2">
                                  <div className="flex gap-2 flex-wrap">
                                    <label className="inline-flex items-center gap-2 text-gray-700"><input type="checkbox" checked={selectedMassageExtras.oils} onChange={() => toggleMassageExtra('oils')} /> <span className="text-sm">Oils (+{BASE_PRICING.extras.oils} ₽)</span></label>
                                    <label className="inline-flex items-center gap-2 text-gray-700"><input type="checkbox" checked={selectedMassageExtras.music} onChange={() => toggleMassageExtra('music')} /> <span className="text-sm">Music (+{BASE_PRICING.extras.music} ₽)</span></label>
                                    <label className="inline-flex items-center gap-2 text-gray-700"><input type="checkbox" checked={selectedMassageExtras.hotStone} onChange={() => toggleMassageExtra('hotStone')} /> <span className="text-sm">Hot Stones (+{BASE_PRICING.hotStoneFlat} ₽)</span></label>
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
                              <label className="text-xs font-mono text-gray-700">Select Massagist<select value={selectedMaster} onChange={(e) => setSelectedMaster(e.target.value)} className="w-full mt-1 p-2 rounded bg-gray-100 border border-copper-200 text-sm text-gray-800">
                                <option value="">Any available</option>
                                {masters.filter(m => massageType === 'none' || m.specialty.toLowerCase().includes(massageType.toLowerCase())).map(m => <option key={m.id} value={m.id}>{m.name} ({m.rating}★)</option>)}
                              </select></label>
                              {selectedMaster && (
                                <div className="mt-2 p-2 bg-gray-50 rounded border border-copper-200">
                                  <div className="text-sm text-gray-800">Selected: {masters.find(m => m.id === selectedMaster)?.name}</div>
                                  <div className="text-xs text-gray-600">Bio: {masters.find(m => m.id === selectedMaster)?.bio}</div>
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
                              <div className="text-sm text-gray-800">Date: {date}</div>
                              <div className="text-sm text-gray-800">Time: {formatHour(startHour)} for {durationHours} hours</div>
                              <div className="text-sm text-gray-800">Sauna Extras: {Object.keys(selectedSaunaExtras).filter(k => selectedSaunaExtras[k]).join(", ") || "None"}</div>
                              <div className="text-sm text-gray-800">Massage Type: {massageType || "None"}</div>
                              <div className="text-sm text-gray-800">Massage Extras: {Object.keys(selectedMassageExtras).filter(k => selectedMassageExtras[k]).join(", ") || "None"}</div>
                              <div className="text-sm text-gray-800">Massagist: {selectedMaster ? masters.find(m => m.id === selectedMaster)?.name : "Any"}</div>
                              <div className="text-lg font-bold text-emerald-700">Total: {totalPrice} ₽ (Stars cost: {starsCost}★, Earn: {starsEarned}★)</div>
                              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Additional notes" className="w-full p-3 rounded bg-gray-100 border border-copper-200 text-sm h-24 text-gray-800" />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="flex justify-between mt-4">
                        <Button disabled={currentStep === 1 || isSubmitting} onClick={() => setCurrentStep(prev => prev - 1)} variant="ghost" className="text-gray-600 hover:text-emerald-600">Back</Button>
                        {currentStep < 4 ? (
                          <Button disabled={isSubmitting} onClick={() => setCurrentStep(prev => prev + 1)} className="bg-emerald-600 text-white hover:bg-emerald-700">Next</Button>
                        ) : (
                          <Button disabled={isSubmitting} onClick={handleCreateBooking} className="bg-emerald-600 text-white hover:bg-emerald-700">{isSubmitting ? "Booking..." : "Confirm & Book"}</Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  {/* History */}
                  <Button variant="ghost" onClick={() => setShowHistory(s => !s)} className="mt-4 text-gray-600 hover:text-emerald-600">{showHistory ? "Hide History" : "Show History"}</Button>
                  {showHistory && (
                    <Card className="mt-4 bg-white/80 backdrop-blur-sm border-copper-300">
                      <CardHeader><CardTitle className="text-emerald-700">Booking History</CardTitle></CardHeader>
                      <CardContent>
                        {bookings.length === 0 ? <div className="text-sm text-gray-600">No bookings yet.</div> : (
                          <ul className="space-y-2">
                            {bookings.map((b) => (
                              <li key={b.id} className="p-2 rounded bg-gray-50 border border-copper-200">
                                <div className="flex justify-between items-center">
                                  <div className="text-sm text-gray-800">{b.date} • {formatHour(b.startHour)} • {b.durationHours}ч {b.massageType ? `(${b.massageType})` : ''}</div>
                                  <div className="text-sm font-semibold text-emerald-700">{b.price} ₽</div>
                                </div>
                                <div className="text-xs text-gray-600 mt-1">Extras: {b.extras.join(", ") || "—"} • Master: {b.masterId ? masters.find(m => m.id === b.masterId)?.name : "None"}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
                {/* Aside with stars, chart, links */}
                <aside><Card className="bg-white/80 backdrop-blur-sm border-copper-300 md:sticky md:top-24"><CardHeader><CardTitle className="text-emerald-700">Star System</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-600 mb-2">Your stars — internal currency. Spend on discounts or save for future bookings.</p><div className="p-3 bg-gray-50 rounded border border-copper-200"><div className="text-xs text-emerald-600">Balance</div><div className="text-3xl font-bold flex items-center gap-2 text-emerald-700"><VibeContentRenderer content="::FaStar::" className="w-7 h-7 text-copper-500" /> {starsBalance}★</div><div className="text-xs text-gray-600 mt-2">Total: accruals for actions, referrals, cleanings.</div></div><div className="mt-4"><div className="text-xs text-emerald-600 mb-2">Subscribe to cleaning alerts</div><p className="text-xs text-gray-600">After rental, subscribe to short cleaning shift: paid in stars.</p><div className="mt-2 flex gap-2"><Button onClick={() => alert("TODO: send subscription to /api/notify-cleanup")} className="bg-emerald-600 text-white hover:bg-emerald-700">Subscribe</Button><SaunaOccupancyChart bookings={cleaningOpportunities} title="Available Cleanings Schedule" /></div></div></CardContent></Card><Card className="bg-white/80 backdrop-blur-sm border-copper-300 mt-6"><CardContent className="py-4"><h4 className="font-semibold mb-2 text-emerald-700">Quick Links</h4><ul className="text-sm list-inside space-y-2 text-gray-600"><li><Link href="/vipbikerental" className="text-emerald-600 hover:underline">VIP Bike</Link></li><li><Link href="/repo-xml" className="text-emerald-600 hover:underline">/repo-xml Studio</Link></li><li><Link href="/selfdev" className="text-emerald-600 hover:underline">SelfDev</Link></li></ul></CardContent></Card></aside>
              </div>
            </section>
        </div>

        <footer className="bg-gray-100 py-12 px-4">
          <div className="container mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-orbitron text-xl mb-4 text-emerald-700">Лес SPA</h3>
              <p className="text-gray-600">Ultimate sauna and massage in Нижний Новгород.</p>
            </div>
            <div>
              <h3 className="font-orbitron text-xl mb-4 text-emerald-700">Links</h3>
              <ul className="space-y-2">
                <li><Link href="#zones" className="text-copper-600 hover:underline">Zones</Link></li>
                <li><Link href="#pricing" className="text-copper-600 hover:underline">Pricing</Link></li>
                <li><Link href="#extras" className="text-copper-600 hover:underline">Extras</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-orbitron text-xl mb-4 text-emerald-700">Contacts</h3>
              <p className="text-gray-600">Проспект Ленина 98, Гостиница Волна</p>
              <p className="text-gray-600">Tel: +7 (XXX) XXX-XX-XX</p>
              <p className="text-gray-600">Email: info@forestspa.ru</p>
            </div>
            <div>
              <h3 className="font-orbitron text-xl mb-4 text-emerald-700">Social</h3>
              <div className="flex space-x-4">
                <a href="#" className="text-copper-600 hover:text-emerald-600"><FaFacebook size={24} /></a>
                <a href="#" className="text-copper-600 hover:text-emerald-600"><FaInstagram size={24} /></a>
                <a href="#" className="text-copper-600 hover:text-emerald-600"><FaTwitter size={24} /></a>
              </div>
            </div>
          </div>
          <div className="container mx-auto max-w-7xl mt-8 text-center text-gray-500">
            © 2025 Лес SPA. All rights reserved.
          </div>
        </footer>
    </div>
  );
}