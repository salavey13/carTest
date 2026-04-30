"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Gauge, Battery, Zap, Weight, Timer, ShoppingBag, PhoneCall, Tag, Sparkles, ShieldCheck } from "lucide-react";
import type { CatalogItemVM, FranchizeCrewVM } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";

export function SaleBikeLanding({ crew, item }: { crew: FranchizeCrewVM; item: CatalogItemVM }) {
  const surface = crewPaletteForSurface(crew.theme);
  const gallery = item.mediaUrls?.length ? item.mediaUrls : [item.imageUrl].filter(Boolean);
  const specs = item.rawSpecs || {};
  const buyPrice = Number(specs.price_rub || specs.sale_price || 0);

  const cards = [
    { label: "Тип", value: item.category, icon: Tag },
    { label: "Мощность", value: String(specs.power_kw || specs.motor_peak_kw || "—"), icon: Zap },
    { label: "Батарея", value: String(specs.battery || "—"), icon: Battery },
    { label: "Запас хода", value: `${specs.range_km || "—"} км`, icon: Gauge },
    { label: "Макс. скорость", value: `${specs.top_speed_kmh || "—"} км/ч`, icon: Gauge },
    { label: "Вес", value: `${specs.weight_kg || "—"} кг`, icon: Weight },
    { label: "Зарядка", value: `${specs.charge_time_h || "—"} ч`, icon: Timer },
    { label: "Привод", value: String(specs.drive || "—"), icon: ShoppingBag },
  ];

  return (
    <main className="min-h-screen p-3 pb-24 sm:p-6" style={surface.page}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/franchize/${crew.slug}?vehicle=${item.id}&flow=buy`} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm" style={surface.subtleCard}><ArrowLeft className="h-4 w-4"/>В маркет</Link>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={surface.subtleCard}>На продажу</span>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-3xl border" style={surface.card}>
          <div className="grid lg:grid-cols-[1.35fr_1fr]">
            <div className="space-y-2 p-2">
              <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black/30">
                <img src={gallery[0]} alt={item.title} className="h-full w-full object-cover" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {gallery.slice(0, 4).map((img, i) => <img key={`${img}-${i}`} src={img} alt={`${item.title}-${i}`} className="aspect-[9/16] w-full rounded-xl object-cover" />)}
              </div>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold" style={surface.subtleCard}><Sparkles className="h-3.5 w-3.5" />Premium eMoto</div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1>
              <p className="text-sm opacity-80">{item.description}</p>
              <div className="rounded-2xl border p-4" style={surface.subtleCard}>
                <p className="text-xs uppercase tracking-[0.16em] opacity-70">Цена продажи</p>
                <p className="text-3xl font-bold sm:text-4xl">{buyPrice > 0 ? `${buyPrice.toLocaleString("ru-RU")} ₽` : "по запросу"}</p>
                <p className="mt-2 inline-flex items-center gap-2 text-xs opacity-80"><ShieldCheck className="h-3.5 w-3.5" />Официальная сделка + документы</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Link href={`/franchize/${crew.slug}/cart?source=buy&bike=${item.id}`} className="rounded-xl px-4 py-3 text-center font-semibold" style={{ ...surface.subtleCard, background: crew.theme.palette.accentMain, color: "#101010" }}>Оставить заявку на покупку</Link>
                <Link href={`tel:${crew.contacts?.phone || "+79999005588"}`} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center font-semibold"><PhoneCall className="h-4 w-4"/>Позвонить</Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border p-3" style={surface.subtleCard}>
                <card.icon className="mb-2 h-4 w-4 opacity-80" />
                <p className="text-xs opacity-70">{card.label}</p>
                <p className="text-sm font-semibold">{card.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
