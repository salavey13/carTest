/**
 * RentalQuickActionHub.tsx
 * =========================
 * Quick actions hub with tabs: status, riders, chooser.
 * VIP Bike franchise feature — СварПрофи-НН would have different action hub.
 *
 * FIX: Removed unnecessary `as any` type casts on rawSpecs access.
 * Both CatalogItemVM and ElectroPreviewItem have rawSpecs?: Record<string, unknown>,
 * so item.rawSpecs?.sale works directly with isEnabled(unknown).
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import type { CatalogItemVM } from "@/app/franchize/actions";
import type { MapRidersOverview } from "./shared/types";
import { isEnabled, getSalePriceLabel, getBikeGallery, formatCompactNumber, fallbackElectroItems, fallbackMapLocations, fallbackMeetups, rentalStatusSteps, quickChooserFilters } from "./shared/constants";

export function RentalQuickActionHub({ items, overview, isCatalogLoading = false, crewSlug = "vip-bike" }: { items: CatalogItemVM[]; overview: MapRidersOverview | null; isCatalogLoading?: boolean; crewSlug?: string }) {
  const [selectedAction, setSelectedAction] = useState<"status" | "riders" | "chooser">("status");
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<(typeof quickChooserFilters)[number]["id"]>("first");

  const chooserItems = useMemo(() => {
    const availableItems = items.filter((item) => item.availabilityStatus === "available" || item.pricePerDay > 0);
    const saleItems = items.filter((item) => item.saleAvailable || isEnabled(item.rawSpecs?.sale));
    const source = activeFilter === "buy" && saleItems.length > 0 ? saleItems : availableItems.length > 0 ? availableItems : items;
    return (source.length > 0 ? source : fallbackElectroItems).slice(0, 3);
  }, [activeFilter, items]);

  const leadItem = chooserItems[0];
  const activeRiders = formatCompactNumber(overview?.stats?.activeRiders, overview?.liveLocations?.length || fallbackMapLocations.length);
  const meetupCount = formatCompactNumber(overview?.stats?.meetupCount, overview?.meetups?.length || fallbackMeetups.length);
  const weeklyDistance = formatCompactNumber(overview?.stats?.totalWeeklyDistanceKm, 127);

  const actionCards = [
    { id: "status" as const, title: "Статус аренды", icon: "::FaTicket::", metric: "3 шага", text: "Байк, экип и слот выдачи — в одном личном разделе.", cta: "Открыть сделки", href: `/franchize/${crewSlug}/rentals` },
    { id: "riders" as const, title: "Райдеры рядом", icon: "::FaMapLocationDot::", metric: `${activeRiders} онлайн`, text: `Неделя: ${weeklyDistance} км · встречи: ${meetupCount}.`, cta: "Открыть карту", href: `/franchize/${crewSlug}/map-riders` },
    { id: "chooser" as const, title: "Быстрый подбор", icon: "::FaBolt::", metric: leadItem?.title || "VIP Bike", text: isCatalogLoading ? "Готовим актуальные карточки..." : "Подборка по цели поездки и доступности.", cta: "Подобрать байк", href: `/franchize/${crewSlug}` },
  ];
  const selectedCard = actionCards.find((card) => card.id === selectedAction) ?? actionCards[0];

  return (
    <section>
      <div className="mb-8 text-center"><h2 className="font-orbitron text-3xl sm:text-4xl">Быстрые действия VIP Bike</h2></div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-3" role="tablist" aria-label="Быстрые действия VIP Bike">
          {actionCards.map((card) => {
            const isActive = selectedAction === card.id;
            return (
              <button key={card.id} type="button" role="tab" aria-selected={isActive} onClick={() => setSelectedAction(card.id)} className={cn("rounded-2xl border p-4 text-left transition-all", isActive ? "border-primary bg-primary/15 shadow-lg shadow-primary/10" : "border-border/70 bg-card/55 hover:-translate-y-0.5 hover:border-primary/50")}>
                <span className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-orbitron text-lg"><VibeContentRenderer content={card.icon} className="text-primary" />{card.title}</span><span className="rounded-full border border-border/70 bg-background/55 px-3 py-1 text-xs text-muted-foreground">{card.metric}</span></span>
                <span className="mt-2 block text-sm text-muted-foreground">{card.text}</span>
              </button>
            );
          })}
        </div>
        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/55 p-4 backdrop-blur-sm sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div key={selectedCard.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.22 }} className="min-h-[320px]">
              {selectedCard.id === "status" && (
                <div className="space-y-5">
                  <div><p className="text-xs uppercase tracking-[0.22em] text-primary">latest rental status</p><h3 className="mt-2 font-orbitron text-2xl">Готовность к выезду за один взгляд</h3><p className="mt-2 text-sm text-muted-foreground">Если активной сделки ещё нет — блок работает как чеклист перед бронированием.</p></div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {rentalStatusSteps.map((step, index) => (
                      <div key={step.label} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                        <div className="flex items-center justify-between gap-2"><VibeContentRenderer content={step.icon} className="text-primary" /><span className="text-xs text-muted-foreground">0{index + 1}</span></div>
                        <p className="mt-4 font-orbitron text-lg">{step.label}</p><p className="mt-1 text-sm text-muted-foreground">{step.value}</p>
                      </div>
                    ))}
                  </div>
                  <Button asChild className="w-full sm:w-fit"><Link href={`/franchize/${crewSlug}/rentals?my=true`}>Проверить мои аренды</Link></Button>
                </div>
              )}
              {selectedCard.id === "riders" && (
                <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
                  <div><p className="text-xs uppercase tracking-[0.22em] text-primary">райдеры сейчас</p><h3 className="mt-2 font-orbitron text-2xl">{activeRiders} райдера онлайн</h3><p className="mt-2 text-sm text-muted-foreground">Смотри активность перед стартом и решай: ехать соло или присоединиться к группе.</p><Button asChild variant="outline" className="mt-5 w-full sm:w-fit"><Link href={`/franchize/${crewSlug}/map-riders`}>Открыть MapRiders</Link></Button></div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ label: "онлайн", value: activeRiders }, { label: "встречи", value: meetupCount }, { label: "за неделю", value: `${weeklyDistance} км` }, { label: "формат", value: "группа" }].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p><p className="mt-2 font-orbitron text-xl">{stat.value}</p></div>
                    ))}
                  </div>
                </div>
              )}
              {selectedCard.id === "chooser" && (
                <div className="space-y-5">
                  <div><p className="text-xs uppercase tracking-[0.22em] text-primary">quick bike chooser</p><h3 className="mt-2 font-orbitron text-2xl">Мини-подбор без ухода со страницы</h3><p className="mt-2 text-sm text-muted-foreground">Выбери цель, посмотри 3 релевантные карточки и открой полную аренду или покупку.</p></div>
                  <div className="flex flex-wrap gap-2">
                    {quickChooserFilters.map((filter) => (
                      <button key={filter.id} type="button" onClick={() => setActiveFilter(filter.id)} className={cn("rounded-full border px-3 py-2 text-xs transition", activeFilter === filter.id ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background/45 hover:border-primary/50")}>
                        {filter.label} · {filter.hint}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" className="flex-1" onClick={() => setIsChooserOpen(true)}>Открыть мини-подбор</Button>
                    <Button asChild variant="outline" className="flex-1"><Link href={`/franchize/${crewSlug}`}>Весь каталог</Link></Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isChooserOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="quick-bike-chooser-title" onClick={() => setIsChooserOpen(false)}>
            <motion.div className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/15 bg-background p-4 shadow-2xl sm:p-6" initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(event) => event.stopPropagation()}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div><p className="text-xs uppercase tracking-[0.22em] text-primary">мини-подбор</p><h3 id="quick-bike-chooser-title" className="mt-1 font-orbitron text-2xl">Быстрый выбор VIP Bike</h3><p className="mt-2 text-sm text-muted-foreground">Подборка использует реальные карточки каталога, а при пустых данных — безопасные демо-карточки.</p></div>
                <button type="button" onClick={() => setIsChooserOpen(false)} className="rounded-full border border-border/70 px-3 py-1 text-sm hover:bg-card" aria-label="Закрыть мини-подбор">×</button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {chooserItems.map((item) => {
                  const imageUrl = getBikeGallery(item)[0];
                  const buyHref = item.saleAvailable || isEnabled(item.rawSpecs?.sale) ? `/franchize/${crewSlug}/market/${item.id}/buy` : `/franchize/${crewSlug}?vehicle=${item.id}`;
                  return (
                    <article key={item.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card/55">
                      <div className="relative h-44 bg-black/35">
                        {imageUrl ? <Image src={imageUrl} alt={item.title} fill className="object-cover" /> : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      </div>
                      <div className="space-y-3 p-4">
                        <div><h4 className="font-orbitron text-lg">{item.title}</h4><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.subtitle || item.description}</p></div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-border/60 bg-background/45 p-3"><p className="text-muted-foreground">Аренда</p><p className="mt-1 font-medium">{item.rentPriceLabel || `${item.pricePerDay.toLocaleString("ru-RU")} ₽ / день`}</p></div>
                          <div className="rounded-xl border border-border/60 bg-background/45 p-3"><p className="text-muted-foreground">Покупка</p><p className="mt-1 font-medium">{item.saleAvailable || isEnabled(item.rawSpecs?.sale) ? getSalePriceLabel(item) : "тест-драйв"}</p></div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button asChild size="sm"><Link href={`/franchize/${crewSlug}?vehicle=${item.id}`}>Арендовать</Link></Button>
                          <Button asChild size="sm" variant="outline"><Link href={buyHref}>Подробнее</Link></Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}