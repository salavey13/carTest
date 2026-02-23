"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { FranchizeCrewVM } from "../actions";
import { HeaderMenu } from "../modals/HeaderMenu";
import { FranchizeProfileButton } from "./FranchizeProfileButton";
import { toCategoryId } from "../lib/navigation";

interface CrewHeaderProps {
  crew: FranchizeCrewVM;
  activePath: string;
  groupLinks?: string[];
}

export function CrewHeader({ crew, activePath, groupLinks = [] }: CrewHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogLinks, setCatalogLinks] = useState<string[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();
  const mainCatalogPath = `/franchize/${crew.slug}`;
  const railRef = useRef<HTMLDivElement | null>(null);

  const defaultGroupLinks = useMemo(
    () => Array.from(new Set([...crew.catalog.showcaseGroups.map((group) => group.label), ...crew.catalog.categories, ...groupLinks].filter(Boolean))),
    [crew.catalog.categories, crew.catalog.showcaseGroups, groupLinks],
  );

  const visibleRailLinks = useMemo(() => {
    if (pathname === mainCatalogPath && catalogLinks.length > 0) {
      return catalogLinks;
    }
    return defaultGroupLinks;
  }, [catalogLinks, defaultGroupLinks, mainCatalogPath, pathname]);

  useEffect(() => {
    const onScroll = () => {
      setIsCompact(window.scrollY > 36);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pathname !== mainCatalogPath) {
      setActiveCategory(null);
      return;
    }

    const hydrateSections = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-category]"));
      const labels = sections
        .map((section) => section.getAttribute("data-category")?.trim() ?? "")
        .filter(Boolean);
      setCatalogLinks(Array.from(new Set(labels)));
      return sections;
    };

    let sections = hydrateSections();
    if (sections.length === 0) {
      return;
    }

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
      { rootMargin: "-95px 0px -55% 0px", threshold: [0.2, 0.4, 0.65, 0.9] },
    );

    sections.forEach((section) => observer.observe(section));

    const mutationObserver = new MutationObserver(() => {
      observer.disconnect();
      sections = hydrateSections();
      sections.forEach((section) => observer.observe(section));
    });

    const catalogRoot = document.getElementById("catalog-sections");
    if (catalogRoot) {
      mutationObserver.observe(catalogRoot, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [mainCatalogPath, pathname]);

  useEffect(() => {
    if (pathname !== mainCatalogPath || typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash?.replace("#", "");
    if (!hash) {
      return;
    }

    const section = document.getElementById(hash);
    if (!section) {
      return;
    }

    const yOffset = 136;
    const y = section.getBoundingClientRect().top + window.scrollY - yOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [mainCatalogPath, pathname]);

  useEffect(() => {
    if (!activeCategory || !railRef.current) {
      return;
    }

    const activePill = railRef.current.querySelector<HTMLButtonElement>(`button[data-category-pill="${CSS.escape(activeCategory)}"]`);
    activePill?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeCategory]);

  const scrollToCategory = (categoryLabel: string) => {
    const targetId = toCategoryId(categoryLabel);

    if (pathname !== mainCatalogPath) {
      if (typeof window !== "undefined") {
        window.location.assign(`${mainCatalogPath}#${targetId}`);
      }
      return;
    }

    const section = document.getElementById(targetId);
    if (!section) {
      return;
    }

    const yOffset = 136;
    const y = section.getBoundingClientRect().top + window.scrollY - yOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    setActiveCategory(categoryLabel);
  };

  return (
    <header
      className="sticky top-0 z-40 border-b px-4 pb-2 pt-[max(env(safe-area-inset-top),0.2rem)] backdrop-blur-xl"
      style={{
        borderColor: crew.theme.palette.borderSoft,
        backgroundColor: `${crew.theme.palette.bgCard}E8`,
        color: crew.theme.palette.textPrimary,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-[24px] h-[24px] backdrop-blur-xl" style={{ backgroundColor: `${crew.theme.palette.bgCard}EB` }} />

      <div className="mx-auto w-full max-w-4xl">
        <div className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 overflow-hidden transition-all duration-300 ${isCompact ? "max-h-0 opacity-0 pb-0" : "max-h-32 opacity-100 pb-2"}`}>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition"
            style={{ backgroundColor: `${crew.theme.palette.bgBase}CC`, color: crew.theme.palette.textPrimary }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative z-10 mx-auto flex flex-col items-center text-center">
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
            borderColor={crew.theme.palette.borderSoft}
          />
        </div>
      </div>

      {visibleRailLinks.length > 0 ? (
        <div className="-mx-4 mt-1 border-t px-4 pt-2" style={{ borderColor: crew.theme.palette.borderSoft }}>
          <div
            ref={railRef}
            className="mx-auto flex w-full max-w-4xl gap-2 overflow-x-auto no-scrollbar pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          >
            {visibleRailLinks.map((linkLabel) => {
              const isActive = activeCategory === linkLabel;
              return (
                <button
                  key={linkLabel}
                  type="button"
                  data-category-pill={linkLabel}
                  onClick={() => scrollToCategory(linkLabel)}
                  className="shrink-0 snap-start rounded-full border px-3 py-1.5 text-xs font-medium tracking-wide transition-colors"
                  style={{
                    borderColor: isActive ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                    backgroundColor: isActive ? `${crew.theme.palette.accentMain}20` : "transparent",
                    color: isActive ? crew.theme.palette.accentMain : crew.theme.palette.textSecondary,
                  }}
                >
                  {linkLabel}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <HeaderMenu crew={crew} activePath={activePath} open={menuOpen} onOpenChange={setMenuOpen} />
    </header>
  );
}
