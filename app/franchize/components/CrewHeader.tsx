"use client";

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

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border transition"
            style={{ borderColor: crew.theme.palette.borderSoft, color: crew.theme.palette.textPrimary }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1 text-center">
            <p className="text-lg font-semibold uppercase tracking-[0.16em]" style={{ color: crew.theme.palette.textPrimary }}>
              {crew.header.brandName}
            </p>
            <p className="text-xs" style={{ color: crew.theme.palette.textSecondary }}>
              {crew.header.tagline}
            </p>
          </div>

          <div className="flex items-center gap-2">
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
