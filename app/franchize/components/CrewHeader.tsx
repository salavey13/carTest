"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useState } from "react";
import type { FranchizeCrewVM } from "../actions";
import { HeaderMenu } from "../modals/HeaderMenu";
import { FranchizeProfileButton } from "./FranchizeProfileButton";

interface CrewHeaderProps {
  crew: FranchizeCrewVM;
  activePath: string;
}

export function CrewHeader({ crew, activePath }: CrewHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mainCatalogPath = `/franchize/${crew.slug}`;
  const quickLinks = crew.catalog.quickLinks.length > 0 ? crew.catalog.quickLinks : crew.catalog.categories;

  return (
    <header className="z-30 border-b border-border bg-background/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.55rem)] backdrop-blur">
      {crew.catalog.tickerItems.length > 0 && (
        <div className="-mx-4 mb-2 overflow-hidden border-b border-border/70 bg-card py-1.5">
          <div className="animate-ticker whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {[...crew.catalog.tickerItems, ...crew.catalog.tickerItems].map((item, index) => (
              <Link key={`${item.id}-${index}`} href={item.href} className="mx-4 inline-flex hover:text-foreground">
                {item.text}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl">
        <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 pb-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-card/20 text-foreground transition hover:bg-card/35"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative z-10 mx-auto -mb-6 flex flex-col items-center text-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border bg-card shadow-lg" style={{ borderColor: crew.theme.palette.accentMain }}>
              {crew.header.logoUrl ? (
                <Image src={crew.header.logoUrl} alt={`${crew.header.brandName} logo`} fill sizes="64px" className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: crew.theme.palette.accentMain }}>
                  {crew.header.brandName}
                </div>
              )}
            </div>
          </div>

          <FranchizeProfileButton />
        </div>

        <nav className="mt-3 flex gap-5 overflow-x-auto pb-1 text-sm text-muted-foreground">
          {quickLinks.map((linkLabel) => {
            const sectionHref = `${mainCatalogPath}#category-${linkLabel.toLowerCase().replace(/\s+/g, "-")}`;
            return (
              <Link key={linkLabel} href={sectionHref} className="shrink-0 transition-colors hover:text-foreground">
                {linkLabel}
              </Link>
            );
          })}
        </nav>
      </div>

      <HeaderMenu crew={crew} activePath={activePath} open={menuOpen} onOpenChange={setMenuOpen} />
    </header>
  );
}
