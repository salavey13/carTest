/**
 * VIP Bike Landing - Hero Section (Server Component)
 *
 * Gold-on-black aesthetic, instant load, no client-side JS
 */

import Link from "next/link";

const HERO_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg";
const CATALOG_HREF = "/franchize/vip-bike";
const BOT_HREF = "https://t.me/oneBikePlsBot";

export function Hero() {
  return (
    <section className="relative min-h-[92vh] flex items-center overflow-hidden pt-20">
      {/* Background image with overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-6 md:space-y-8">
          {/* Title */}
          <h1
            className="text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight leading-none"
            style={{
              color: "#FFD700",
              textShadow: "0 0 60px rgba(255, 215, 0, 0.5)",
            }}
          >
            VIP BIKE
          </h1>

          <p
            className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-wide"
            style={{ color: "#D4AF37" }}
          >
            ELECTRO
          </p>

          {/* Tagline */}
          <p className="text-base md:text-lg lg:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Аренда электробайков и эндуро в Нижнем Новгороде
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center pt-6 md:pt-8">
            <Link
              href={CATALOG_HREF}
              className="px-6 md:px-8 py-3 md:py-4 rounded-lg font-bold text-base md:text-lg transition-all hover:scale-105"
              style={{
                backgroundColor: "#FFD700",
                color: "#0A0A0A",
                boxShadow: "0 0 30px rgba(255, 215, 0, 0.4)",
              }}
            >
              Смотреть байки
            </Link>
            <Link
              href={BOT_HREF}
              className="px-6 md:px-8 py-3 md:py-4 rounded-lg font-bold text-base md:text-lg transition-all hover:scale-105"
              style={{
                backgroundColor: "transparent",
                color: "#FFD700",
                border: "2px solid #FFD700",
              }}
            >
              Забронировать в боте
            </Link>
          </div>

          {/* Pricing badge */}
          <div className="pt-4 md:pt-6">
            <span
              className="inline-block px-5 md:px-6 py-2 rounded-full text-sm md:text-base font-semibold"
              style={{
                backgroundColor: "rgba(255, 215, 0, 0.1)",
                color: "#FFD700",
                border: "1px solid rgba(255, 215, 0, 0.3)",
              }}
            >
              Аренда от 6 000 ₽/сутки
            </span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div
          className="w-6 h-10 rounded-full flex items-start justify-center p-2"
          style={{ border: "2px solid #FFD700" }}
        >
          <div
            className="w-1 h-3 rounded-full"
            style={{ backgroundColor: "#FFD700" }}
          />
        </div>
      </div>
    </section>
  );
}
