"use client";

import Image from "next/image";
import { Menu, Search, User } from "lucide-react";
import { useMemo, useState } from "react";
import type { FranchizeCrewVM } from "../actions";
import { HeaderMenu } from "../modals/HeaderMenu";

interface CrewHeaderProps {
  crew: FranchizeCrewVM;
  activePath: string;
}

export function CrewHeader({ crew, activePath }: CrewHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const categoryRail = useMemo(() => {
    if (crew.catalog.categories.length > 0) {
      return crew.catalog.categories;
    }
    return ["Naked", "Touring", "Supersport", "Neo-retro"];
  }, [crew.catalog.categories]);

  return (
    <header
      className="sticky top-0 z-30 border-b px-4 pb-3 pt-2 backdrop-blur"
      style={{
        backgroundColor: `${crew.theme.palette.bgBase}E6`,
        borderColor: crew.theme.palette.borderSoft,
      }}
    >
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-3 flex items-center justify-between text-xs" style={{ color: crew.theme.palette.textSecondary }}>
          <span className="font-medium tracking-[0.16em] uppercase">{crew.slug}</span>
          <span>operator storefront</span>
        </div>

        <div className="grid grid-cols-[44px_1fr_88px] items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border transition"
            style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textPrimary }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="mx-auto flex flex-col items-center text-center">
            <div
              className="relative h-20 w-20 overflow-hidden rounded-full border"
              style={{ borderColor: crew.theme.palette.accentMain, backgroundColor: crew.theme.palette.bgCard }}
            >
              {crew.header.logoUrl ? (
                <Image
                  src={crew.header.logoUrl}
                  alt={`${crew.header.brandName} logo`}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: crew.theme.palette.accentMain }}>
                  {crew.header.brandName}
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px]" style={{ color: crew.theme.palette.textSecondary }}>
              {crew.header.tagline}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
              style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textSecondary }}
            >
              <Search className="h-5 w-5" />
            </span>
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border"
              style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textSecondary }}
            >
              <User className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {categoryRail.map((category) => (
            <a
              key={category}
              href={`#category-${category.toLowerCase().replace(/\s+/g, "-")}`}
              className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium"
              style={{
                borderColor: crew.theme.palette.borderSoft,
                color: crew.theme.palette.textPrimary,
                backgroundColor: crew.theme.palette.bgCard,
              }}
            >
              {category}
            </a>
          ))}
        </div>
      </div>

      <HeaderMenu crew={crew} activePath={activePath} open={menuOpen} onOpenChange={setMenuOpen} />
    </header>
  );
}
