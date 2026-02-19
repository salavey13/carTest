"use client";

import Image from "next/image";
import Link from "next/link";
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

  const scrollToCatalog = () => {
    document.getElementById("catalog-sections")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 px-4 pb-3 pt-2 backdrop-blur">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium tracking-[0.16em] uppercase">{crew.slug}</span>
          <span>operator storefront</span>
        </div>

        <div className="grid grid-cols-[44px_1fr_88px] items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-foreground transition"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="mx-auto flex flex-col items-center text-center">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border bg-card" style={{ borderColor: crew.theme.palette.accentMain }}>
              {crew.header.logoUrl ? (
                <Image src={crew.header.logoUrl} alt={`${crew.header.brandName} logo`} fill sizes="80px" className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: crew.theme.palette.accentMain }}>
                  {crew.header.brandName}
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{crew.header.tagline}</p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              aria-label="Scroll to category filters"
              onClick={scrollToCatalog}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground"
            >
              <Search className="h-5 w-5" />
            </button>
            <Link href="/profile" aria-label="Open profile" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground">
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {categoryRail.map((category) => (
            <a
              key={category}
              href={`#category-${category.toLowerCase().replace(/\s+/g, "-")}`}
              className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
              style={{ boxShadow: `inset 0 0 0 1px ${crew.theme.palette.accentMain}33` }}
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
