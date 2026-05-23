/**
 * ConversionPilot.tsx
 * ====================
 * "Find your scenario in 30 seconds" decision router section.
 * VIP Bike franchise feature — other franchises would have different decision routes.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import type { CatalogItemVM } from "@/app/franchize/actions";
import type { MapRidersOverview } from "./shared/types";
import {
  isEnabled,
  getSalePriceLabel,
  formatCompactNumber,
  getRussianRiderLabel,
  fallbackElectroItems,
  fallbackMapLocations,
  conversionPilotChecks,
  decisionRoutes,
} from "./shared/constants";

export function ConversionPilot({
  items,
  overview,
  isCatalogLoading = false,
}: {
  items: CatalogItemVM[];
  overview: MapRidersOverview | null;
  isCatalogLoading?: boolean;
}) {
  const rentableItems = items.filter((item) => item.availabilityStatus === "available" && item.pricePerDay > 0);
  const pricedRentalItems = items.filter((item) => item.pricePerDay > 0);
  const availableItems = rentableItems.length > 0 ? rentableItems : pricedRentalItems;
  const saleItems = items.filter((item) => item.saleAvailable || isEnabled(item.rawSpecs?.sale));
  const dayPrices = availableItems.map((item) => item.pricePerDay).filter((price) => price > 0);
  const minDayPrice = dayPrices.length ? Math.min(...dayPrices) : fallbackElectroItems[0]?.pricePerDay ?? 4900;
  const activeRidersCount = Number(overview?.stats?.activeRiders ?? overview?.liveLocations?.length ?? fallbackMapLocations.length);
  const activeRiders = formatCompactNumber(activeRidersCount, fallbackMapLocations.length);
  const leadItem = availableItems[0] ?? saleItems[0] ?? items[0] ?? fallbackElectroItems[0];
  const leadHref = leadItem?.id ? `/franchize/vip-bike?vehicle=${leadItem.id}` : "/franchize/vip-bike";
  const score = Math.min(9.2, 8.4 + (availableItems.length > 0 ? 0.3 : 0) + (saleItems.length > 0 ? 0.25 : 0) + (overview ? 0.25 : 0));
  const scoreLabel = score.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  const riderLabel = getRussianRiderLabel(activeRidersCount);
  const scoreReasons = [
    `${availableItems.length || fallbackElectroItems.length} вариантов аренды`,
    saleItems.length > 0 ? "покупка доступна" : "тест-драйв перед покупкой",
    overview ? "карта подключена" : "карта готова",
  ];

  return (
    <section className="rounded-[2rem] border border-primary/30 bg-card/50 p-4 shadow-2xl shadow-black/10 backdrop-blur-sm sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">быстрый выбор</p>
          <h2 className="mt-2 font-orbitron text-3xl sm:text-4xl">Найдите правильный сценарий за 30 секунд</h2>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">готовность</span>
          <span className="ml-3 font-orbitron text-2xl text-primary">{scoreLabel}/10</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/70 p-6 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,179,71,0.25),transparent_38%),radial-gradient(circle_at_80%_70%,rgba(34,197,94,0.16),transparent_34%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-brand-yellow">следующий шаг</p>
              <h3 className="mt-3 font-orbitron text-3xl sm:text-4xl">{leadItem?.title || "VIP Bike"}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                {isCatalogLoading ? "Подтягиваем актуальные карточки..." : `От ${minDayPrice.toLocaleString("ru-RU")} ₽ / день · ${activeRiders} ${riderLabel}`}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {scoreReasons.map((reason) => (
                  <span key={reason} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {conversionPilotChecks.map((check) => (
                <div key={check.label} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <VibeContentRenderer content={check.icon} className="mx-auto text-lg text-brand-yellow" />
                  <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/45">{check.label}</p>
                  <p className="mt-1 font-orbitron text-xs text-white sm:text-sm">{check.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
          {decisionRoutes.map((route, index) => (
            <Link
              key={route.title}
              href={route.href}
              aria-label={`${route.cta}: ${route.title}`}
              className="group rounded-2xl border border-border/70 bg-card/60 p-4 transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="flex items-start justify-between gap-3">
                <VibeContentRenderer content={route.icon} className="text-2xl text-primary" />
                <span className="rounded-full border border-border/70 bg-background/45 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  0{index + 1}
                </span>
              </div>
              <h4 className="mt-3 font-orbitron text-lg">{route.title}</h4>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{route.text}</p>
              <span className="mt-4 inline-flex text-xs font-medium text-primary group-hover:underline">{route.cta}</span>
            </Link>
          ))}
          <Button asChild className="mt-1 w-full md:col-span-3 lg:col-span-1">
            <Link href={leadHref}>Начать с рекомендованного байка</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}