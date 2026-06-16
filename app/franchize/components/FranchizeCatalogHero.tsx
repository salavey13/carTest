"use client";

import Image from "next/image";
import Link from "next/link";
import type { FranchizeCrewVM, FranchizeTheme } from "../actions";

interface FranchizeCatalogHeroProps {
  crew: FranchizeCrewVM;
  slug: string;
  variant?: "main" | "electro-enduro";
}

const HERO_BG_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg";

export function FranchizeCatalogHero({ crew, slug, variant = "main" }: FranchizeCatalogHeroProps) {
  const resolvedSlug = crew.slug || slug;
  const brandName = crew.header.brandName || crew.name || "VIP BIKE";

  // Determine button text and href based on variant
  const buttonText = variant === "electro-enduro" ? "Смотреть весь каталог" : "Смотреть электро каталог";
  const buttonHref = variant === "electro-enduro" ? `/franchize/${resolvedSlug}` : `#catalog-sections`;

  return (
    <section className="relative mb-6 w-full md:mx-auto md:max-w-7xl md:overflow-hidden md:rounded-3xl md:px-4 md:pt-8 md:mb-8 2xl:mx-auto 2xl:max-w-[1600px]">
      {/* Background Image with Overlay */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gray-900 md:aspect-[3/1] md:rounded-2xl">
        <Image
          src={HERO_BG_IMAGE}
          alt={`${brandName} - мотоциклы в Нижнем Новгороде`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1536px) 90vw, 1600px"
          className="object-cover"
          priority
        />
        {/* Gradient Overlay for readability - stronger on mobile */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent md:from-black/80 md:via-black/50" />

        {/* Content - Aligned Left */}
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-4 py-6 sm:px-6 md:px-12 md:py-0 lg:px-16">
          <div className="max-w-2xl">
            {/* Eyebrow */}
            <p className="mb-2 inline-flex rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur-sm sm:mb-3 sm:px-3 sm:py-1 sm:text-[11px]">
              Мотоаренда Нижний Новгород
            </p>

            {/* Title */}
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white sm:mb-3 sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">
              {brandName}
            </h1>

            {/* Subcopy */}
            <p className="mb-4 max-w-xl text-xs leading-relaxed text-gray-200 sm:mb-6 sm:text-sm sm:leading-relaxed md:text-base lg:text-lg">
              Электробайки и эндуро для городских заездов и приключений на
              природе. Готовая техника, простое бронирование, гибкие условия.
            </p>

            {/* CTAs */}
            <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:gap-4">
              <Link
                href={buttonHref}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 sm:min-h-11 sm:px-6 sm:py-3"
              >
                {buttonText}
              </Link>
              <Link
                href={`/franchize/${resolvedSlug}/map-riders`}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm sm:min-h-11 sm:px-6 sm:py-3"
              >
                Карта райдеров
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats/Features Row - add padding on desktop only */}
      <div className="mt-3 grid grid-cols-3 gap-2 px-0 sm:mt-4 sm:gap-3 md:px-4 md:gap-4">
        <div className="rounded-xl bg-[var(--franchize-bg-card)] p-2.5 text-center sm:p-3 md:p-4">
          <p className="text-xl font-bold text-[var(--franchize-accent-main)] sm:text-2xl md:text-3xl">24/7</p>
          <p className="mt-0.5 text-[10px] text-[var(--franchize-text-secondary)] sm:mt-1 sm:text-xs md:text-sm">Поддержка</p>
        </div>
        <div className="rounded-xl bg-[var(--franchize-bg-card)] p-2.5 text-center sm:p-3 md:p-4">
          <p className="text-xl font-bold text-[var(--franchize-accent-main)] sm:text-2xl md:text-3xl">30+</p>
          <p className="mt-0.5 text-[10px] text-[var(--franchize-text-secondary)] sm:mt-1 sm:text-xs md:text-sm">Байков в парке</p>
        </div>
        <div className="rounded-xl bg-[var(--franchize-bg-card)] p-2.5 text-center sm:p-3 md:p-4">
          <p className="text-xl font-bold text-[var(--franchize-accent-main)] sm:text-2xl md:text-3xl">5 мин</p>
          <p className="mt-0.5 text-[10px] text-[var(--franchize-text-secondary)] sm:mt-1 sm:text-xs md:text-sm">До старта</p>
        </div>
      </div>
    </section>
  );
}
