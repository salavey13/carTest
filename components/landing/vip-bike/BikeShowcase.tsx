/**
 * VIP Bike Electro Landing - Bike Showcase
 * Brutalist, high-end fitness studio aesthetic
 * Filters: adrenaline / cruising / enduro
 */

"use client";

import { useState } from "react";
import Link from "next/link";

const CATALOG_HREF = "/franchize/vip-bike";

const FEATURED_BIKES = [
  {
    id: "falcon-gt-2025",
    make: "79BIKE",
    model: "Falcon GT 2025",
    goal: "adrenaline",
    goalLabel: "Адреналин",
    dailyPrice: 12000,
    hourlyPrice: 5000,
    minHours: 3,
    price3h: 10000,
    pricingType: "hourly",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/falcon-gt-2025/image_1.jpg",
    specs: { power: "17 кВт", range: "120 км", topSpeed: "100 км/ч" },
  },
  {
    id: "y-volt-surge-v",
    make: "Y-VOLT",
    model: "Surge V",
    goal: "adrenaline",
    goalLabel: "Адреналин",
    dailyPrice: 12000,
    hourlyPrice: 5000,
    minHours: 3,
    price3h: 10000,
    pricingType: "hourly",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/y-volt-surge-v/image_1.jpg",
    specs: { power: "35 кВт", range: "150 км", topSpeed: "125 км/ч" },
  },
  {
    id: "sequence-zero",
    make: "Sequence",
    model: "Zero",
    goal: "cruising",
    goalLabel: "Круизинг",
    dailyPrice: 15000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sequence-zero/image_1.jpg",
    specs: { power: "30 кВт", range: "300 км", topSpeed: "160 км/ч" },
  },
  {
    id: "kawasaki-ex650k",
    make: "KAWASAKI",
    model: "EX650K Ninja 650",
    goal: "cruising",
    goalLabel: "Круизинг",
    dailyPrice: 14000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/kawasaki-ex650k/image_1.jpg",
    specs: { power: "68 л.с.", engine: "649 см³", topSpeed: "210 км/ч" },
  },
  {
    id: "suzuki-gsx-s1000f",
    make: "Suzuki",
    model: "GSX-S1000F",
    goal: "adrenaline",
    goalLabel: "Адреналин",
    dailyPrice: 14000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/suzuki-gsx-s1000f/image_1.jpg",
    specs: { power: "150 л.с.", engine: "999 см³", topSpeed: "255 км/ч" },
  },
  {
    id: "nibbler-regumoto-4v",
    make: "Regulmoto",
    model: "Nibbler 300 4V",
    goal: "enduro",
    goalLabel: "Эндуро",
    dailyPrice: 6000,
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nibbler-regumoto-4v/image_1.jpg",
    specs: { power: "27 л.с.", engine: "300 см³", topSpeed: "150 км/ч" },
  },
];

type FilterType = "all" | "adrenaline" | "cruising" | "enduro";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price);
}

const SPEC_LABELS: Record<string, string> = {
  power: "Мощность",
  range: "Запас хода",
  topSpeed: "Макс. скорость",
  engine: "Объём",
};

export function BikeShowcase() {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredBikes = FEATURED_BIKES.filter((bike) => {
    if (filter === "all") return true;
    return bike.goal === filter;
  });

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: "all", label: "Весь арсенал" },
    { key: "adrenaline", label: "Адреналин" },
    { key: "cruising", label: "Круизинг" },
    { key: "enduro", label: "Эндуро" },
  ];

  return (
    <section
      id="catalog"
      className="py-20 px-4 relative overflow-hidden"
      style={{ backgroundColor: "#0A0A0A" }}
    >
      {/* Neon orange overlay accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(255, 69, 0, 0.05)",
          mixBlendMode: "multiply",
        }}
      />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter mb-4"
            style={{ color: "#E0E0E0" }}
          >
            Флот
          </h2>
          <p
            className="text-sm uppercase tracking-widest mb-8"
            style={{ color: "#FF4500" }}
          >
            Выбери свою дисциплину
          </p>

          {/* Filter buttons */}
          <div className="flex flex-wrap justify-center gap-0">
            {filterButtons.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="px-6 py-3 font-black uppercase tracking-wider text-sm transition-all border-2"
                style={{
                  backgroundColor: filter === key ? "#FF4500" : "#050505",
                  color: filter === key ? "#050505" : "#E0E0E0",
                  borderColor: filter === key ? "#FF4500" : "#111",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bike grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 mb-12">
          {filteredBikes.map((bike) => (
            <Link
              key={bike.id}
              href={`${CATALOG_HREF}/${bike.id}`}
              className="group"
            >
              <article
                className="h-full border-2 transition-all overflow-hidden"
                style={{
                  backgroundColor: "#050505",
                  borderColor: "#111",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#FF4500";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#111";
                }}
              >
                {/* Image */}
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={bike.imageUrl}
                    alt={`${bike.make} ${bike.model}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    style={{ filter: "grayscale(100%) contrast(120%)" }}
                  />
                  <div className="absolute top-0 left-0">
                    <div
                      className="px-3 py-1 text-xs font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: "#FF4500",
                        color: "#050505",
                      }}
                    >
                      {bike.goalLabel}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <div>
                    <p
                      className="text-xs font-black uppercase tracking-widest mb-1"
                      style={{ color: "#FF4500" }}
                    >
                      {bike.make}
                    </p>
                    <h3
                      className="text-xl font-black uppercase tracking-tighter"
                      style={{ color: "#E0E0E0" }}
                    >
                      {bike.model}
                    </h3>
                  </div>

                  {/* Specs */}
                  <div className="space-y-1 text-sm border-t-2 border-b-2 py-3" style={{ borderColor: "#111" }}>
                    {Object.entries(bike.specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wider" style={{ color: "#666" }}>
                          {SPEC_LABELS[key] || key.toUpperCase()}
                        </span>
                        <span className="font-bold" style={{ color: "#E0E0E0" }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Price */}
                  <div className="pt-2">
                    {bike.pricingType === "hourly" ? (
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-2xl font-black"
                          style={{ color: "#FF4500" }}
                        >
                          {formatPrice(bike.hourlyPrice)} ₽
                        </span>
                        <span className="text-xs uppercase tracking-wider" style={{ color: "#666" }}>
                          / час (от {bike.minHours} ч)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-2xl font-black"
                          style={{ color: "#FF4500" }}
                        >
                          {formatPrice(bike.dailyPrice)} ₽
                        </span>
                        <span className="text-xs uppercase tracking-wider" style={{ color: "#666" }}>
                          / сутки
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href={CATALOG_HREF}
            className="inline-block px-8 py-4 font-black uppercase tracking-wider text-lg transition-all"
            style={{
              backgroundColor: "#FF4500",
              color: "#050505",
            }}
          >
            Смотреть весь флот
          </Link>
        </div>
      </div>
    </section>
  );
}
