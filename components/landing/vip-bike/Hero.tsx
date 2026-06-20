/**
 * VIP Bike Electro Landing - Hero Section
 * Brutalist, high-end fitness studio aesthetic
 */

import Link from "next/link";

const HERO_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg";
const CATALOG_HREF = "/franchize/vip-bike";
const BOT_HREF = "https://t.me/oneBikePlsBot";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image with brutalist overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${HERO_IMAGE})`,
          filter: "grayscale(100%) contrast(120%)",
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(5,5,5,0.7), rgba(5,5,5,0.95))",
          }}
        />
      </div>

      {/* Neon orange overlay accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "rgba(255, 69, 0, 0.08)",
          mixBlendMode: "multiply",
        }}
      />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          {/* Location badge */}
          <div className="mb-6">
            <span
              className="inline-block px-4 py-2 text-xs font-black uppercase tracking-widest"
              style={{
                backgroundColor: "rgba(255, 69, 0, 0.15)",
                color: "#FF4500",
                border: "1px solid #FF4500",
              }}
            >
              Нижний Новгород // пл. Комсомольская 2
            </span>
          </div>

          {/* Title - BRUTALIST */}
          <h1
            className="text-6xl md:text-8xl lg:text-9xl font-black uppercase tracking-tighter mb-4"
            style={{ color: "#E0E0E0", lineHeight: "0.85" }}
          >
            ЭЛЕКТРО
            <br />
            <span style={{ color: "#FF4500" }}>И БЕНЗИНОВЫЕ БАЙКИ</span>
          </h1>

          {/* Tagline */}
          <p
            className="text-xl md:text-2xl uppercase tracking-widest mb-12 max-w-2xl"
            style={{ color: "#E0E0E0", fontWeight: "600" }}
          >
            Премиальный прокат электробайков и бензиновых мотоциклов
            <br />
            Нижний Новгород
          </p>

          {/* CTA Buttons - Sharp edges */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <Link
              href={CATALOG_HREF}
              className="px-8 py-4 font-black uppercase tracking-wider text-lg transition-all hover:bg-[#E0E0E0]"
              style={{
                backgroundColor: "#FF4500",
                color: "#050505",
                border: "none",
              }}
            >
              Смотреть каталог
            </Link>
            <Link
              href={BOT_HREF}
              className="px-8 py-4 font-black uppercase tracking-wider text-lg transition-all hover:bg-[#FF4500] hover:text-[#050505]"
              style={{
                backgroundColor: "transparent",
                color: "#E0E0E0",
                border: "2px solid #FF4500",
              }}
            >
              Забронировать
            </Link>
          </div>

          {/* Pricing examples - Sharp edges */}
          <div className="flex flex-wrap gap-3">
            <span
              className="inline-block px-6 py-3 text-sm font-black uppercase tracking-wider"
              style={{
                backgroundColor: "#FF4500",
                color: "#050505",
              }}
            >
              От 6 000 ₽/сутки
            </span>
            <span
              className="inline-block px-6 py-3 text-sm font-black uppercase tracking-wider"
              style={{
                backgroundColor: "transparent",
                color: "#E0E0E0",
                border: "2px solid #333",
              }}
            >
              Ducati 10 000 ₽
            </span>
            <span
              className="inline-block px-6 py-3 text-sm font-black uppercase tracking-wider"
              style={{
                backgroundColor: "transparent",
                color: "#E0E0E0",
                border: "2px solid #333",
              }}
            >
              Kawasaki 16 000 ₽
            </span>
            <span
              className="inline-block px-6 py-3 text-sm font-black uppercase tracking-wider"
              style={{
                backgroundColor: "transparent",
                color: "#E0E0E0",
                border: "2px solid #333",
              }}
            >
              Экипировка включена
            </span>
          </div>
        </div>
      </div>

      {/* Scroll indicator - Brutalist style */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <div
          className="flex flex-col items-center gap-2"
          style={{ color: "#FF4500" }}
        >
          <span className="text-xs font-black uppercase tracking-widest">
            Листай вниз
          </span>
          <div className="w-px h-12 bg-[#FF4500]" />
        </div>
      </div>
    </section>
  );
}
