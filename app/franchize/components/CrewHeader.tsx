"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { FranchizeCrewVM } from "../actions";
import { HeaderMenu } from "../modals/HeaderMenu";
import { FranchizeProfileButton } from "./FranchizeProfileButton";

interface CrewHeaderProps {
  crew: FranchizeCrewVM;
  activePath: string;
}

export function CrewHeader({ crew, activePath }: CrewHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const pathname = usePathname();
  const mainCatalogPath = `/franchize/${crew.slug}`;
  const quickLinks = useMemo(
    () =>
      Array.from(
        new Set([
          ...(crew.catalog.quickLinks.length > 0 ? crew.catalog.quickLinks : []),
          ...crew.catalog.showcaseGroups.map((group) => group.label),
          ...crew.catalog.categories,
        ]),
      ),
    [crew.catalog.categories, crew.catalog.quickLinks, crew.catalog.showcaseGroups],
  );

  useEffect(() => {
    if (pathname !== mainCatalogPath) {
      setActiveCategory(null);
      return;
    }

    const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-category]"));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const mostVisible = visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const category = mostVisible?.target.getAttribute("data-category");
        if (category) {
          setActiveCategory(category);
        }
      },
      { rootMargin: "-140px 0px -45% 0px", threshold: [0.15, 0.35, 0.65, 0.9] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [mainCatalogPath, pathname]);

  return (
    <header
      className="sticky top-0 z-40 border-b px-4 pb-2 pt-[max(env(safe-area-inset-top),0.55rem)] backdrop-blur-xl"
      style={{
        borderColor: crew.theme.palette.borderSoft,
        backgroundColor: `${crew.theme.palette.bgCard}E0`,
        color: crew.theme.palette.textPrimary,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-[42px] h-[42px] backdrop-blur-xl" style={{ backgroundColor: `${crew.theme.palette.bgCard}EB` }} />
      {crew.catalog.tickerItems.length > 0 && (
        <div className="-mx-4 mb-2 overflow-hidden border-b py-1.5" style={{ borderColor: crew.theme.palette.borderSoft, backgroundColor: `${crew.theme.palette.bgBase}F0` }}>
          <div className="animate-ticker whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: crew.theme.palette.textSecondary }}>
            {[...crew.catalog.tickerItems, ...crew.catalog.tickerItems].map((item, index) => (
              <Link key={`${item.id}-${index}`} href={item.href} className="mx-4 inline-flex transition-opacity hover:opacity-90" style={{ color: crew.theme.palette.textSecondary }}>
                {item.text}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl">
        <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3 pb-2">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition"
            style={{ backgroundColor: `${crew.theme.palette.bgBase}CC`, color: crew.theme.palette.textPrimary }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative z-10 mx-auto -mb-6 flex flex-col items-center text-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border shadow-lg" style={{ borderColor: crew.theme.palette.accentMain, backgroundColor: crew.theme.palette.bgBase }}>
              {crew.header.logoUrl ? (
                <Image src={crew.header.logoUrl} alt={`${crew.header.brandName} logo`} fill sizes="64px" className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: crew.theme.palette.accentMain }}>
                  {crew.header.brandName}
                </div>
              )}
            </div>
          </div>

          <FranchizeProfileButton
            bgColor={`${crew.theme.palette.bgBase}CC`}
            textColor={crew.theme.palette.textPrimary}
          />
        </div>

        <nav className="mt-1 flex gap-2 overflow-x-auto no-scrollbar pb-1 text-sm [scrollbar-width:none] snap-x snap-mandatory">
          {quickLinks.map((linkLabel) => {
            const sectionHref = `${mainCatalogPath}#category-${linkLabel.toLowerCase().replace(/\s+/g, "-")}`;
            const isActive = activeCategory === linkLabel;
            return (
              <Link
                key={linkLabel}
                href={sectionHref}
                className="shrink-0 snap-start rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors"
                style={{
                  borderColor: isActive ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                  backgroundColor: isActive ? `${crew.theme.palette.accentMain}20` : "transparent",
                  color: isActive ? crew.theme.palette.accentMain : crew.theme.palette.textSecondary,
                }}
              >
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
