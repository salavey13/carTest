"use client";
/**
 * ElectroEnduroShowcase.tsx
 * ==========================
 * Electro-Enduro carousel section with quick preview modal.
 * VIP Bike franchise feature — other franchises would have different product showcases.
 */

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import type { CatalogItemVM } from "@/app/franchize/actions";
import { DEFAULT_COLOR_OPTIONS, DEFAULT_CONFIG_OPTIONS, resolveBuyColorOptions, resolveBuyConfigOptions } from "@/app/franchize/lib/sale-config";
import type { ElectroPreviewItem } from "./shared/types";
import { isEnabled, getSalePriceLabel, getBikeGallery, fallbackElectroItems } from "./shared/constants";

function BikeCardSkeleton({ index }: { index: number }) {
  return (
    <article className="relative min-w-[280px] snap-start overflow-hidden rounded-2xl border border-border/70 bg-background/45 shadow-xl shadow-black/10 sm:min-w-[340px]" aria-hidden="true">
      <div className="relative h-52 overflow-hidden bg-black/40">
        <motion.div
          className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary/25 to-transparent"
          initial={{ x: "-120%" }}
          animate={{ x: "260%" }}
          transition={{ duration: 1.25, repeat: Infinity, delay: index * 0.12, ease: "easeInOut" }}
        />
        <div className="absolute bottom-3 left-3 h-6 w-28 rounded-full bg-white/15" />
      </div>
      <div className="space-y-3 p-4">
        <div className="h-5 w-2/3 rounded-full bg-muted/60" />
        <div className="h-4 w-full rounded-full bg-muted/35" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 rounded-xl bg-muted/35" />
          <div className="h-16 rounded-xl bg-muted/35" />
        </div>
        <div className="h-10 rounded-xl bg-primary/20" />
      </div>
    </article>
  );
}

export function ElectroEnduroShowcase({ items, isCatalogLoading = false }: { items: CatalogItemVM[]; isCatalogLoading?: boolean }) {
  const [selectedItem, setSelectedItem] = useState<ElectroPreviewItem | null>(null);
  const [selectedColorId, setSelectedColorId] = useState(DEFAULT_COLOR_OPTIONS[2]?.id ?? DEFAULT_COLOR_OPTIONS[0]?.id ?? "black");
  const [selectedConfigId, setSelectedConfigId] = useState(DEFAULT_CONFIG_OPTIONS[0]?.id ?? "standard");

  const electroItems = useMemo<ElectroPreviewItem[]>(() => {
    const realItems = items
      .filter((item) => {
        const haystack = `${item.title} ${item.subtitle} ${item.description} ${item.category}`.toLowerCase();
        return item.saleAvailable || isEnabled(item.rawSpecs?.sale) || /electro|электро|enduro|эндуро|e-moto|emoto/.test(haystack);
      })
      .slice(0, 8);
    return realItems.length > 0 ? realItems : fallbackElectroItems;
  }, [items]);

  const activePreview = selectedItem ?? electroItems[0];
  const colorOptions = useMemo(() => resolveBuyColorOptions(activePreview?.rawSpecs), [activePreview?.rawSpecs]);
  const configOptions = useMemo(() => resolveBuyConfigOptions(activePreview?.rawSpecs), [activePreview?.rawSpecs]);
  const selectedColor = colorOptions.find((color) => color.id === selectedColorId) ?? colorOptions[0];
  const selectedConfig = configOptions.find((option) => option.id === selectedConfigId) ?? configOptions[0];
  const configuredPrice = activePreview?.salePrice ? activePreview.salePrice + (selectedConfig?.priceDelta ?? 0) : null;

  useEffect(() => {
    if (!colorOptions.some((color) => color.id === selectedColorId)) {
      setSelectedColorId(colorOptions[0]?.id ?? DEFAULT_COLOR_OPTIONS[0]?.id ?? "black");
    }
  }, [colorOptions, selectedColorId]);

  useEffect(() => {
    if (!configOptions.some((option) => option.id === selectedConfigId)) {
      setSelectedConfigId(configOptions[0]?.id ?? DEFAULT_CONFIG_OPTIONS[0]?.id ?? "standard");
    }
  }, [configOptions, selectedConfigId]);

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">Electro-Enduro: аренда и покупка</h2>
      </div>
      <div className="overflow-hidden rounded-3xl border border-primary/30 bg-card/50 p-4 backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">гараж на витрине</p>
            <h3 className="mt-1 font-orbitron text-2xl">Свободные модели и быстрый конфиг</h3>
          </div>
          <Button asChild variant="outline" className="sm:w-fit">
            <Link href="/franchize/vip-bike/electro-enduro">Полный раздел Electro-Enduro</Link>
          </Button>
        </div>
        <div className="flex snap-x gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
          {isCatalogLoading && items.length === 0 && [0, 1, 2].map((index) => <BikeCardSkeleton key={index} index={index} />)}
          {(!isCatalogLoading || items.length > 0) && electroItems.map((item) => {
            const imageUrl = getBikeGallery(item)[0];
            return (
              <article key={item.id} className="group relative min-w-[280px] snap-start overflow-hidden rounded-2xl border border-border/70 bg-background/50 shadow-xl shadow-black/10 sm:min-w-[340px]">
                <div className="relative aspect-[9/16] max-h-[380px] bg-black/40">
                  {imageUrl ? <Image src={imageUrl} alt={item.title} fill className="object-cover opacity-85 transition duration-300 group-hover:scale-105 group-hover:opacity-100" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,170,80,0.25),transparent_55%)]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 rounded-full border border-white/25 bg-black/45 px-3 py-1 text-xs text-white backdrop-blur-sm">{item.category || "Electro-Enduro"}</div>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h4 className="font-orbitron text-lg text-foreground">{item.title}</h4>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.subtitle || item.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border/60 bg-card/50 p-3"><p className="text-muted-foreground">Аренда</p><p className="mt-1 font-orbitron text-sm text-foreground">{item.rentPriceLabel || `${item.pricePerDay.toLocaleString("ru-RU")} ₽ / день`}</p></div>
                    <div className="rounded-xl border border-border/60 bg-card/50 p-3"><p className="text-muted-foreground">Покупка</p><p className="mt-1 font-orbitron text-sm text-foreground">{item.saleAvailable ? getSalePriceLabel(item) : "тест-драйв"}</p></div>
                  </div>
                  <Button type="button" className="w-full" onClick={() => setSelectedItem(item)}>Быстрый просмотр</Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedItem && activePreview && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-labelledby="electro-preview-title" onClick={() => setSelectedItem(null)}>
            <motion.div className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/15 bg-background p-4 shadow-2xl sm:p-6" initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onClick={(event) => event.stopPropagation()}>
              <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="relative min-h-[300px] overflow-hidden rounded-2xl border border-border/70 bg-black/40">
                  {getBikeGallery(activePreview)[0] ? <Image src={getBikeGallery(activePreview)[0]} alt={activePreview.title} fill className="object-cover" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,170,80,0.28),transparent_58%)]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 rounded-full bg-brand-yellow px-3 py-1 font-orbitron text-xs text-black">{selectedColor?.label ?? "Цвет"}</div>
                </div>
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-primary">быстрый просмотр</p>
                      <h3 id="electro-preview-title" className="mt-1 font-orbitron text-2xl">{activePreview.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{activePreview.description}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedItem(null)} className="rounded-full border border-border/70 px-3 py-1 text-sm hover:bg-card" aria-label="Закрыть быстрый просмотр">×</button>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Цвет</p>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button key={color.id} type="button" onClick={() => setSelectedColorId(color.id)} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition", selectedColor?.id === color.id ? "border-primary bg-primary text-primary-foreground" : "border-border/70 hover:bg-card")}>
                          <span className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: color.hex }} />{color.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Пакет</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {configOptions.map((option) => (
                        <button key={option.id} type="button" onClick={() => setSelectedConfigId(option.id)} className={cn("rounded-xl border p-3 text-left text-xs transition", selectedConfig?.id === option.id ? "border-primary bg-primary/15" : "border-border/70 hover:bg-card")}>
                          <span className="block font-orbitron text-sm">{option.label}</span>
                          <span className="mt-1 block text-muted-foreground">{option.priceDelta > 0 ? `+${option.priceDelta.toLocaleString("ru-RU")} ₽` : option.subtitle || "база"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(activePreview.specs.length > 0 ? activePreview.specs.slice(0, 3) : [
                      { label: "Категория", value: activePreview.category },
                      { label: "Аренда", value: activePreview.rentPriceLabel },
                      { label: "Покупка", value: getSalePriceLabel(activePreview) },
                    ]).map((spec) => (
                      <div key={`${spec.label}-${spec.value}`} className="rounded-xl border border-border/70 bg-card/50 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{spec.label}</p>
                        <p className="mt-1 text-sm font-medium">{spec.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ваша конфигурация</p>
                    <p className="mt-1 font-orbitron text-lg">{activePreview.title} · {selectedColor?.label ?? "Цвет"} · {selectedConfig?.label ?? "Пакет"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{configuredPrice ? `${configuredPrice.toLocaleString("ru-RU")} ₽ ориентир покупки` : `${activePreview.rentPriceLabel} для тест-драйва`}</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="flex-1"><Link href={`/franchize/vip-bike/market/${activePreview.id}/buy`}>Открыть полный конфигуратор</Link></Button>
                    <Button asChild variant="outline" className="flex-1"><Link href={`/franchize/vip-bike?vehicle=${activePreview.id}`}>Перейти к аренде</Link></Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}