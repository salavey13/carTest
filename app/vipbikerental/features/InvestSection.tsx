/**
 * InvestSection.tsx
 * ==================
 * VIP Invest V2 section — investor-focused monetization block.
 * VIP Bike franchise feature — СварПрофи-НН would have different monetization.
 *
 * FIX: onDwellTime now actually fires — tracks viewport enter/exit and
 * reports dwell time. Previously the prop was accepted but never called.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";

const roiItems = [
  { title: "Инвестиция", value: "500 000 ₽", icon: "::FaCoins::" },
  { title: "Доход / месяц", value: "60 000 – 90 000 ₽", icon: "::FaMoneyBillTrendUp::" },
  { title: "Окупаемость", value: "6–10 месяцев", icon: "::FaStopwatch::" },
];

const howItWorksItems = [
  "::FaMotorcycle:: Байк добавляется в парк",
  "::FaUsers:: Используется райдерами ежедневно",
  "::FaMoneyBillWave:: Работает в арендной модели с понятной загрузкой",
  "::FaRepeat:: Вы получаете регулярные выплаты по согласованной модели",
];

const trustItems = [
  "::FaFileSignature:: Договор и прозрачные условия",
  "::FaCalendar:: Выплаты каждый месяц",
  "::FaRightLeft:: Выход из проекта (30 дней)",
];

export function InvestSection({ onDwellTime }: { onDwellTime?: (seconds: number) => void }) {
  const enterTimeRef = useRef<number | null>(null);

  const handleViewportEnter = useCallback(() => {
    enterTimeRef.current = Date.now();
  }, []);

  const handleViewportLeave = useCallback(() => {
    if (enterTimeRef.current != null && onDwellTime) {
      const dwellSeconds = (Date.now() - enterTimeRef.current) / 1000;
      onDwellTime(dwellSeconds);
      enterTimeRef.current = null;
    }
  }, [onDwellTime]);

  return (
    <motion.section
      onViewportEnter={handleViewportEnter}
      onViewportLeave={handleViewportLeave}
      className="relative mt-24 overflow-hidden rounded-3xl border border-primary/30 bg-black/70 backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,120,0,0.25),transparent_55%)]" />
      <div className="relative z-10 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 text-brand-yellow"><VibeContentRenderer content="::FaChartLine:: INVEST MODE ACTIVATED" /></div>
          <h2 className="font-orbitron text-4xl md:text-5xl font-bold text-white">Включайте байки в доходную сеть,<br />пока другие катаются</h2>
          <p className="mt-4 text-white/80 text-lg">Ты уже внутри экосистемы. Следующий шаг — зарабатывать на спросе.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {roiItems.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20">
              <VibeContentRenderer content={item.icon} className="text-3xl text-primary mb-3" />
              <p className="text-sm text-muted-foreground">{item.title}</p>
              <p className="mt-1 text-xl font-bold text-white">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 mx-auto max-w-3xl rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-sm">
          <h3 className="font-orbitron text-xl mb-4 text-white">Как это работает</h3>
          <div className="space-y-3 text-sm text-white/80">
            {howItWorksItems.map((item) => <div key={item}><VibeContentRenderer content={item} /></div>)}
          </div>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {trustItems.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/90">
              <VibeContentRenderer content={item} />
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="font-orbitron text-base shadow-lg shadow-primary/40 transition hover:scale-105">
            <Link href="https://t.me/salavey13" target="_blank"><VibeContentRenderer content="::FaTelegram:: Обсудить инвестиции" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-white/30 bg-black/20 text-white backdrop-blur-sm hover:bg-white hover:text-black">
            <Link href="/moto-investments"><VibeContentRenderer content="::FaCircleInfo:: Подробнее об условиях" /></Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-white/50 text-center">Сначала изучи условия или сразу обсуди — как удобнее</p>
      </div>
    </motion.section>
  );
}