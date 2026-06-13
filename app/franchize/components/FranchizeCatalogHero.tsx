"use client";

import Image from "next/image";
import Link from "next/link";
import type { FranchizeCrewVM, FranchizeTheme } from "../actions";

interface FranchizeCatalogHeroProps {
  crew: FranchizeCrewVM;
  slug: string;
}

const HERO_BG_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg";

export function FranchizeCatalogHero({ crew, slug }: FranchizeCatalogHeroProps) {
  const resolvedSlug = crew.slug || slug;
  const brandName = crew.header.brandName || crew.name || "VIP BIKE";

  return (
    <section className="relative mx-auto mb-6 w-full max-w-7xl overflow-hidden rounded-3xl px-4 pt-8 md:mb-8 2xl:max-w-[1600px]">
      {/* Background Image with Overlay */}
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-2xl bg-gray-900 md:aspect-[3/1]">
        <Image
          src={HERO_BG_IMAGE}
          alt={`${brandName} - мотоциклы в Нижнем Новгороде`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1536px) 90vw, 1600px"
          className="object-cover"
          priority
        />
        {/* Gradient Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

        {/* Content - Aligned Left */}
        <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-6 md:px-12 lg:px-16">
          <div className="max-w-2xl">
            {/* Eyebrow */}
            <p className="mb-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/90 backdrop-blur-sm">
              Мотоаренда Нижний Новгород
            </p>

            {/* Title */}
            <h1 className="mb-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
              {brandName}
            </h1>

            {/* Subcopy */}
            <p className="mb-6 max-w-xl text-sm leading-relaxed text-gray-200 sm:text-base lg:text-lg">
              Электробайки и эндуро для городских заездов и приключений наnature.
              Готовая техника, простое бронирование, гибкие условия.
            </p>

            {/* CTAs */}
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Link
                href="#catalog-sections"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                Смотреть каталог
              </Link>
              <Link
                href={`/franchize/${resolvedSlug}/map-riders`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
              >
                Карта райдеров
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats/Features Row */}
      <div className="mt-4 grid grid-cols-3 gap-2 md:gap-4">
        <div className="rounded-xl bg-[var(--franchize-bg-card)] p-3 text-center md:p-4">
          <p className="text-2xl font-bold text-[var(--franchize-accent-main)] md:text-3xl">24/7</p>
          <p className="mt-1 text-xs text-[var(--franchize-text-secondary)] md:text-sm">Поддержка</p>
        </div>
        <div className="rounded-xl bg-[var(--franchize-bg-card)] p-3 text-center md:p-4">
          <p className="text-2xl font-bold text-[var(--franchize-accent-main)] md:text-3xl">30+</p>
          <p className="mt-1 text-xs text-[var(--franchize-text-secondary)] md:text-sm">Байков в парке</p>
        </div>
        <div className="rounded-xl bg-[var(--franchize-bg-card)] p-3 text-center md:p-4">
          <p className="text-2xl font-bold text-[var(--franchize-accent-main)] md:text-3xl">5 мин</p>
          <p className="mt-1 text-xs text-[var(--franchize-text-secondary)] md:text-sm">До старта</p>
        </div>
      </div>
    </section>
  );
}
