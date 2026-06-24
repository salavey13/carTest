/**
 * VIP Bike Landing - Bike Showcase (Client Component)
 *
 * Displays 6 hardcoded bikes with gold-on-black aesthetic
 * Filter buttons: All / Electric / Gasoline
 */

"use client";

import { useState } from "react";
import Link from "next/link";

const CATALOG_HREF = "/franchize/vip-bike";

// 6 hardcoded bikes from the CSV (mix of electric and ICE)
const FEATURED_BIKES = [
  {
    id: "falcon-gt-2025",
    make: "79BIKE",
    model: "Falcon GT 2025",
    dailyPrice: 12000,
    hourlyPrice: 5000,
    minHours: 3,
    price3h: 10000,
    imageUrl:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/falcon-gt-2025/image_1.jpg",
    type: "Electric",
    specs: { power: "17 кВт", range: "120 км", topSpeed: "100 км/ч" },
    specLabels: { power: "Мощность", range: "Запас хода", topSpeed: "Макс. скорость" },
    pricingType: "hourly",
  },
  {
    id: "y-volt-surge-v",
    make: "Y-VOLT",
    model: "Surge V",
    dailyPrice: 12000,
    hourlyPrice: 5000,
    minHours: 3,
    price3h: 10000,
    imageUrl:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/y-volt-surge-v/image_1.jpg",
    type: "Electric",
    specs: { power: "35 кВт", range: "150 км", topSpeed: "125 км/ч" },
    specLabels: { power: "Мощность", range: "Запас хода", topSpeed: "Макс. скорость" },
    pricingType: "hourly",
  },
  {
    id: "sequence-zero",
    make: "Sequence",
    model: "Zero",
    dailyPrice: 15000,
    imageUrl:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/sequence-zero/image_1.jpg",
    type: "Electric",
    specs: { power: "30 кВт", range: "300 км", topSpeed: "160 км/ч" },
    specLabels: { power: "Мощность", range: "Запас хода", topSpeed: "Макс. скорость" },
  },
  {
    id: "kawasaki-ex650k",
    make: "KAWASAKI",
    model: "EX650K Ninja 650",
    dailyPrice: 14000,
    imageUrl:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/kawasaki-ex650k/image_1.jpg",
    type: "ICE",
    specs: { power: "68 л.с.", engine: "649 см³", topSpeed: "210 км/ч" },
    specLabels: { power: "Мощность", engine: "Объём двигателя", topSpeed: "Макс. скорость" },
  },
  {
    id: "suzuki-gsx-s1000f",
    make: "Suzuki",
    model: "GSX-S1000F",
    dailyPrice: 14000,
    imageUrl:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/suzuki-gsx-s1000f/image_1.jpg",
    type: "ICE",
    specs: { power: "150 л.с.", engine: "999 см³", topSpeed: "255 км/ч" },
    specLabels: { power: "Мощность", engine: "Объём двигателя", topSpeed: "Макс. скорость" },
  },
  {
    id: "nibbler-regumoto-4v",
    make: "Regumoto",
    model: "Nibbler 300 4V",
    dailyPrice: 6000,
    imageUrl:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nibbler-regumoto-4v/image_1.jpg",
    type: "ICE",
    specs: { power: "27 л.с.", engine: "300 см³", topSpeed: "150 км/ч" },
    specLabels: { power: "Мощность", engine: "Объём двигателя", topSpeed: "Макс. скорость" },
  },
];

type FilterType = "all" | "electric" | "gasoline";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price);
}

export function BikeShowcase() {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredBikes = FEATURED_BIKES.filter((bike) => {
    if (filter === "all") return true;
    if (filter === "electric") return bike.type === "Electric";
    if (filter === "gasoline") return bike.type === "ICE";
    return true;
  });

  const filterButtons: { key: FilterType; label: string; color: string }[] = [
    { key: "all", label: "Все", color: "#FFD700" },
    { key: "electric", label: "Электро", color: "#38BDF8" },
    { key: "gasoline", label: "Бензин", color: "#FFD700" },
  ];

  return (
    <section id="catalog" className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="container mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-12 md:mb-16">
          <h2
            className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight"
            style={{ color: "#FFD700" }}
          >
            Наши байки
          </h2>
          {/* Filter buttons */}
          <div className="flex justify-center gap-2 md:gap-3 mb-4">
            {filterButtons.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="px-5 md:px-6 py-2 rounded-full font-bold text-sm transition-all hover:scale-105"
                style={{
                  backgroundColor: filter === key ? color : "transparent",
                  color: filter === key ? "#0A0A0A" : color,
                  border: `2px solid ${color}`,
                  opacity: filter === key ? 1 : 0.7,
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Электрические и бензиновые мотоциклы для аренды и тест-драйва
          </p>
        </div>

        {/* Bike grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12">
          {filteredBikes.map((bike) => (
            <Link
              key={bike.id}
              href={`${CATALOG_HREF}/${bike.id}`}
              className="group"
            >
              <article
                className="h-full rounded-xl overflow-hidden transition-all group-hover:scale-105"
                style={{
                  backgroundColor: "#1A1A1A",
                  border: "2px solid #2A2A2A",
                }}
              >
                {/* Image */}
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={bike.imageUrl}
                    alt={`${bike.make} ${bike.model}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  />
                  <div className="absolute top-3 left-3">
                    {bike.type === "Electric" ? (
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border-2"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.8)",
                          borderColor: "#38BDF8",
                          color: "#38BDF8",
                          boxShadow: "0 0 15px rgba(56, 189, 248, 0.4)",
                        }}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        <span>ЭЛЕКТРО</span>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border-2"
                        style={{
                          backgroundColor: "rgba(0, 0, 0, 0.8)",
                          borderColor: "#FFD700",
                          color: "#FFD700",
                          boxShadow: "0 0 15px rgba(255, 215, 0, 0.4)",
                        }}
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L7 12c-1 2-1 4 0 6 1 2 3 3 5 3s4-1 5-3c1-2 1-4 0-6L12 2z" />
                        </svg>
                        <span>БЕНЗИН</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 md:p-5 space-y-3">
                  <h3
                    className="text-base md:text-lg font-black tracking-tight leading-tight"
                    style={{ color: "#FFFAF0" }}
                  >
                    {bike.make} {bike.model}
                  </h3>

                  {/* Specs */}
                  <div className="space-y-1.5 text-sm">
                    {Object.entries(bike.specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-baseline">
                        <span className="text-gray-400 text-xs md:text-sm">{bike.specLabels[key]}:</span>
                        <span className="font-semibold" style={{ color: "#D4AF37" }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Price */}
                  <div className="pt-3 border-t border-gray-700">
                    {bike.pricingType === "hourly" ? (
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-lg md:text-xl font-black"
                          style={{ color: "#FFD700" }}
                        >
                          {formatPrice(bike.hourlyPrice)} ₽
                        </span>
                        <span className="text-gray-400 text-xs md:text-sm"> / час (от {bike.minHours} ч)</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-lg md:text-xl font-black"
                          style={{ color: "#FFD700" }}
                        >
                          {formatPrice(bike.dailyPrice)} ₽
                        </span>
                        <span className="text-gray-400 text-xs md:text-sm"> / сутки</span>
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
            className="inline-block px-6 md:px-8 py-3 md:py-4 rounded-lg font-bold text-base md:text-lg transition-transform hover:scale-105"
            style={{
              backgroundColor: "#FFD700",
              color: "#0A0A0A",
              boxShadow: "0 0 30px rgba(255, 215, 0, 0.4)",
            }}
          >
            Смотреть все байки
          </Link>
        </div>
      </div>
    </section>
  );
}
