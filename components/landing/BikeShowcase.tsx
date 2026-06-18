/**
 * VIP Bike Landing - Bike Showcase (Server Component)
 *
 * Displays 6 hardcoded bikes with gold-on-black aesthetic
 * CSS-only hover effects, no JavaScript event handlers
 */

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
    make: "Regulmoto",
    model: "Nibbler 300 4V",
    dailyPrice: 6000,
    imageUrl:
      "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/nibbler-regumoto-4v/image_1.jpg",
    type: "ICE",
    specs: { power: "27 л.с.", engine: "300 см³", topSpeed: "150 км/ч" },
    specLabels: { power: "Мощность", engine: "Объём двигателя", topSpeed: "Макс. скорость" },
  },
];

function formatPrice(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price);
}

export function BikeShowcase() {
  return (
    <section id="catalog" className="py-20 px-4" style={{ backgroundColor: "#0A0A0A" }}>
      <div className="container mx-auto max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2
            className="text-4xl md:text-5xl font-bold mb-4"
            style={{ color: "#FFD700" }}
          >
            Наши байки
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Электрические и бензиновые мотоциклы для аренды и тест-драйва
          </p>
        </div>

        {/* Bike grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {FEATURED_BIKES.map((bike) => (
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
                        <span style={{ color: "#38BDF8" }}>ЭЛЕКТРО</span>
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
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 23c-3.5 0-6-2.5-6-5.5 0-2.5 1.5-4.5 3.5-5.5L12 2l2.5 10c2 1 3.5 3 3.5 5.5 0 3-2.5 5.5-6 5.5zm-1.5-6c0 1.5.5 3 1.5 4s1.5-2.5 1.5-4c0-1.5-.5-2.5-1.5-3.5S10.5 15.5 10.5 17z" />
                        </svg>
                        <span>БЕНЗИН</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 space-y-3">
                  <h3
                    className="text-lg font-bold"
                    style={{ color: "#FFFAF0" }}
                  >
                    {bike.make} {bike.model}
                  </h3>

                  {/* Specs */}
                  <div className="space-y-1 text-sm">
                    {Object.entries(bike.specs).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-400">{bike.specLabels[key]}:</span>
                        <span className="font-medium" style={{ color: "#D4AF37" }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Price */}
                  <div className="pt-3 border-t border-gray-700">
                    {bike.pricingType === "hourly" ? (
                      <>
                        <span
                          className="text-xl font-bold"
                          style={{ color: "#FFD700" }}
                        >
                          {formatPrice(bike.hourlyPrice)} ₽
                        </span>
                        <span className="text-gray-400 text-sm"> / час (от {bike.minHours} ч)</span>
                      </>
                    ) : (
                      <>
                        <span
                          className="text-xl font-bold"
                          style={{ color: "#FFD700" }}
                        >
                          {formatPrice(bike.dailyPrice)} ₽
                        </span>
                        <span className="text-gray-400 text-sm"> / сутки</span>
                      </>
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
            className="inline-block px-8 py-4 rounded-lg font-semibold text-lg transition-transform hover:scale-105"
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
