/**
 * HeroSection.tsx
 * ================
 * Extracted hero section — the main hero with video bg + vibeProfile card.
 *
 * WHY EXTRACTED:
 *   - 80+ lines of inline JSX in sectionMap useMemo was too much
 *   - Own memoization boundary — hero only re-renders when its props change
 *   - Testable in isolation
 *   - Follows the franchise feature extraction pattern
 *   - Cleaner sectionMap in VipBikeRentalClient
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import type { HeroDisplayMode } from "@/app/franchize/lib/onboarding/experience-types";
import type { HeroPanel } from "./shared/types";
import { heroMetrics } from "./shared/constants";

interface HeroVibeProfile {
  badge: string;
  title: string;
  note: string;
  startCommandHref?: string;
  ctaHref: string;
  ctaLabel: string;
  hasSurvey: boolean;
  promoCode: string;
  isExternal: boolean;
}

interface HeroSectionProps {
  vibeProfile: HeroVibeProfile;
  heroPanels: Record<string, HeroPanel>;
  activeHeroPanel: HeroPanel;
  heroMode: HeroDisplayMode;
  onHeroModeChange: (mode: HeroDisplayMode) => void;
}

export function HeroSection({
  vibeProfile,
  heroPanels,
  activeHeroPanel,
  heroMode,
  onHeroModeChange,
}: HeroSectionProps) {
  return (
    <section className="relative flex min-h-[760px] items-center justify-center overflow-hidden px-4 pb-14 pt-28 text-white sm:pt-32">
      <div className="absolute inset-0 z-0">
        <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover brightness-[0.5] saturate-125">
          <source src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/2_5219998213838247718.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_23%,rgba(255,106,0,0.25),transparent_42%)]" />
      </div>
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/45 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
          <VibeContentRenderer content="::FaBolt::" className="text-brand-yellow" />
          <span>VIP BIKE · ПРЕМИАЛЬНЫЙ ПРОКАТ И МАРШРУТЫ</span>
        </div>
        <div className="mb-5 w-full max-w-2xl rounded-2xl border border-white/20 bg-black/40 p-4 text-left text-sm text-white/90 backdrop-blur-sm">
          <div className="mb-1 font-medium text-brand-yellow"><VibeContentRenderer content={vibeProfile.badge} /></div>
          <p className="font-orbitron text-lg text-white">{vibeProfile.title}</p>
          <p className="mt-1 text-white/80">{vibeProfile.note}</p>
          {vibeProfile.startCommandHref ? (
            <a
              href={vibeProfile.startCommandHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex text-sm font-semibold text-brand-yellow underline underline-offset-4 hover:text-yellow-300"
            >
              /start в Telegram
            </a>
          ) : null}
        </div>
        <h1 className="font-orbitron text-5xl font-black uppercase leading-[0.9] tracking-tight text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.75)] sm:text-6xl md:text-7xl lg:text-8xl">
          <span className="block">Скорость. Контроль.</span>
          <span className="block text-brand-yellow">Ваш выезд организован заранее.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base font-light text-white/90 sm:text-lg md:text-xl">
          Премиальный прокат в Нижнем Новгороде: от выбора модели до возврата — единый управляемый поток, где клиент понимает цену, слот, защиту и следующий шаг.
        </p>
        <div className="mt-9 w-full max-w-5xl rounded-3xl border border-white/20 bg-black/45 p-3 text-left shadow-2xl shadow-black/40 backdrop-blur-md sm:p-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="VIP Bike quick scenario selector">
            {(Object.values(heroPanels) as HeroPanel[]).map((panel) => {
              const isActive = heroMode === panel.mode;
              return (
                <button key={panel.mode} type="button" role="tab" aria-selected={isActive} onClick={() => onHeroModeChange(panel.mode as HeroDisplayMode)} className={cn("rounded-2xl border px-3 py-3 text-left transition-all duration-300", isActive ? "border-brand-yellow bg-brand-yellow/20 text-white shadow-lg shadow-brand-yellow/25 ring-1 ring-brand-yellow/40" : "border-white/15 bg-white/5 text-white/75 hover:border-white/40 hover:bg-white/10 hover:text-white")}>
                  <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.22em]"><VibeContentRenderer content={panel.icon} />{panel.label}</span>
                  <span className="block font-orbitron text-sm sm:text-base">{panel.cta}</span>
                </button>
              );
            })}
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={activeHeroPanel.mode} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.24 }} className="mt-4 grid gap-4 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-4 sm:grid-cols-[1.1fr_0.9fr] sm:p-5">
              <div className="flex min-h-[260px] flex-col justify-between gap-5">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.22em] text-brand-yellow"><VibeContentRenderer content={activeHeroPanel.icon} />{activeHeroPanel.eyebrow}</div>
                  <h2 className="font-orbitron text-2xl font-bold text-white sm:text-3xl">{activeHeroPanel.title}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/78 sm:text-base">{activeHeroPanel.description}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {activeHeroPanel.meta.map((item) => (
                    <div key={`${activeHeroPanel.mode}-${item.label}`} className="rounded-xl border border-white/15 bg-black/25 p-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">{item.label}</p>
                      <p className="mt-1 font-orbitron text-sm text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
                <Button asChild size="lg" variant={activeHeroPanel.mode === "rent" ? "accent" : "outline"} className="w-full font-orbitron sm:w-fit">
                  <Link href={activeHeroPanel.href} className="inline-flex items-center gap-2"><VibeContentRenderer content={activeHeroPanel.icon} />{activeHeroPanel.cta}</Link>
                </Button>
              </div>
              <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-white/15 bg-black/35">
                {activeHeroPanel.imageUrl ? <Image src={activeHeroPanel.imageUrl} alt={activeHeroPanel.title} fill className="object-cover opacity-80" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,210,80,0.30),transparent_32%),radial-gradient(circle_at_70%_65%,rgba(64,255,190,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))]" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/15 bg-black/50 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3 text-sm text-white/80">
                    <span>Интерактивный режим</span>
                    <span className="rounded-full border border-brand-yellow/40 bg-black/55 px-3 py-1 font-orbitron text-xs text-brand-yellow">{activeHeroPanel.label}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
          {heroMetrics.map((chip) => (
            <div key={chip} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white/90 backdrop-blur-sm"><VibeContentRenderer content={chip} /></div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
