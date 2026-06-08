/**
 * StepsProgress.tsx
 * ==================
 * 3-step newbie stepper section.
 * VIP Bike franchise feature — other franchises would have different onboarding flows.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import type { CatalogItemVM } from "@/app/franchize/actions";
import { getBikeGallery, fallbackElectroItems, getNewbieFlow } from "./shared/constants";

export function StepsProgress({ items, crewSlug = "vip-bike" }: { items: CatalogItemVM[]; crewSlug?: string }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const newbieFlow = getNewbieFlow(crewSlug);
  const previewItems = useMemo(() => {
    const realItems = items.filter((item) => item.imageUrl || item.mediaUrls?.length).slice(0, 3);
    return realItems.length > 0 ? realItems : fallbackElectroItems.slice(0, 3);
  }, [items]);
  const activeStep = newbieFlow[activeStepIndex] ?? newbieFlow[0];

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">Пошагово для новичка: от информации к заказу</h2>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
          Теперь путь новичка работает как степпер: можно переключать этапы, увидеть конкретную визуализацию и перейти
          дальше только когда сценарий понятен.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/50 p-4 backdrop-blur-sm sm:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3" role="tablist" aria-label="Пошаговый сценарий новичка">
          {newbieFlow.map((step, index) => {
            const isActive = index === activeStepIndex;
            return (
              <button
                key={step.title}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveStepIndex(index)}
                className={`rounded-2xl border p-4 text-left transition-all ${
                  isActive ? "border-primary bg-primary/15 shadow-lg shadow-primary/10" : "border-border/70 bg-background/35 hover:border-primary/50"
                }`}
              >
                <span className="text-xs uppercase tracking-[0.18em] text-primary">{step.step}</span>
                <span className="mt-1 block font-orbitron text-base">{step.title}</span>
                <span className="mt-2 block text-xs text-muted-foreground">{step.description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-background/60">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${((activeStepIndex + 1) / newbieFlow.length) * 100}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"
          >
            <div className="rounded-2xl border border-border/70 bg-background/45 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-primary">{activeStep.step}</p>
              <h3 className="mt-2 font-orbitron text-2xl">{activeStep.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{activeStep.description}</p>
              <Button asChild className="mt-5 w-full sm:w-fit" variant={activeStepIndex === 0 ? "default" : "outline"}>
                <Link href={activeStep.href}>{activeStep.cta}</Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              {activeStepIndex === 0 && (
                <div className="grid h-full gap-3 sm:grid-cols-3">
                  {["::FaMapLocationDot:: Локация", "::FaHelmetSafety:: Экип", "::FaShieldHeart:: Правила"].map((item) => (
                    <div key={item} className="flex min-h-[140px] items-center justify-center rounded-2xl border border-border/60 bg-card/60 p-4 text-center text-sm">
                      <VibeContentRenderer content={item} />
                    </div>
                  ))}
                </div>
              )}
              {activeStepIndex === 1 && (
                <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                  {previewItems.map((item) => {
                    const imageUrl = getBikeGallery(item)[0];
                    return (
                      <Link
                        key={item.id}
                        href={`/franchize/${crewSlug}?vehicle=${item.id}`}
                        className="min-w-[220px] snap-start overflow-hidden rounded-2xl border border-border/70 bg-card/60"
                      >
                        <div className="relative h-32 bg-black/30">
                          {imageUrl ? <Image src={imageUrl} alt={item.title} fill className="object-cover" /> : null}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                        </div>
                        <div className="p-3">
                          <p className="font-orbitron text-sm">{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.rentPriceLabel || `${item.pricePerDay.toLocaleString("ru-RU")} ₽ / день`}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              {activeStepIndex === 2 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Мини-корзина</p>
                    <p className="mt-2 font-orbitron text-lg">Байк, экипировка и слот уже сведены в один путь</p>
                    <p className="mt-2 text-sm text-muted-foreground">Перед отправкой заявки пользователь видит состав заказа и может добавить защиту.</p>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-4 text-sm">
                    <VibeContentRenderer content="::FaCircleCheck:: Контакты подтверждены" />
                    <VibeContentRenderer content="::FaCircleCheck:: Дата и слот выбраны" />
                    <VibeContentRenderer content="::FaCircleCheck:: Менеджер получает заявку" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}