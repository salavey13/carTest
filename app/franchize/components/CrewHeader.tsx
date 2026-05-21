// /app/franchize/components/CrewHeader.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { FranchizeCrewVM } from "../actions";
import { HeaderMenu } from "../modals/HeaderMenu";
import { FranchizeProfileButton } from "./FranchizeProfileButton";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { toCategoryId } from "../lib/navigation";
import { FRANCHIZE_HEADER_CORNER_GUARD_STYLE, FRANCHIZE_HEADER_SAFE_AREA_STYLE } from "../lib/route-cta-policy";
import type { FranchizeSectionLink } from "../lib/section-links";
import { readablePaletteTextOnColor, withAlpha } from "../lib/theme";
import {
  ensureSpookyKeyframes,
  getFirstLetter,
  sanitizeAccentColor,
  SpookyLetter,
  SPOOKY_ACCENT_VAR,
} from "@/app/franchize/lib/spooky-avatar";

interface CrewHeaderProps {
  crew: FranchizeCrewVM;
  activePath: string;
  groupLinks?: string[];
  sectionLinks?: FranchizeSectionLink[];
}

export function CrewHeader({ crew, activePath, groupLinks = [], sectionLinks = [] }: CrewHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [catalogLinks, setCatalogLinks] = useState<string[]>([]);
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();
  const mainCatalogPath = `/franchize/${crew.slug}`;
  const headerLogoHref = crew.header.logoHref || mainCatalogPath;
  const railRef = useRef<HTMLDivElement | null>(null);
  const prevPathnameRef = useRef<string | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{ width: number; left: number; opacity: number }>({ width: 0, left: 0, opacity: 0 });
  const activePillText = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);
  const { itemCount } = useFranchizeCart(crew.slug);

  // ── Logo loading state machine ──
  //   loading → (onLoad) → dissolving → (animationEnd) → revealed
  //   loading → (onError) → broken (permanent spooky letter)
  const [brokenLogoUrls, setBrokenLogoUrls] = useState<Record<string, true>>({});
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoDissolved, setLogoDissolved] = useState(false);

  const logoUrl = crew.header.logoUrl;
  const accentMain = crew.theme.palette.accentMain;

  // Reset loading/dissolve state when logo URL changes
  useEffect(() => {
    setLogoLoaded(false);
    setLogoDissolved(false);
  }, [logoUrl]);

  // Inject spooky keyframes once
  useEffect(() => {
    ensureSpookyKeyframes();
  }, []);

  // Reset active category when navigating away from main catalog
  // Scheduling setState via setTimeout to satisfy linter
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (prev !== null && prev !== pathname && pathname !== mainCatalogPath) {
      const timer = setTimeout(() => setActiveCategory(null), 0);
      return () => clearTimeout(timer);
    }
  }, [pathname, mainCatalogPath]);

  const defaultGroupLinks = useMemo(
    () => Array.from(new Set([...crew.catalog.showcaseGroups.map((group) => group.label), ...crew.catalog.categories, ...groupLinks].filter(Boolean))),
    [crew.catalog.categories, crew.catalog.showcaseGroups, groupLinks],
  );

  const visibleRailLinks = useMemo(() => {
    if (pathname === mainCatalogPath && catalogLinks.length > 0) {
      return catalogLinks.map((label) => ({ label, href: `#${toCategoryId(label)}`, active: activeCategory === label, categoryLabel: label }));
    }

    if (pathname !== mainCatalogPath && sectionLinks.length > 0) {
      const normalizedSectionLinks = sectionLinks
        .filter((link) => link.label.trim() && link.href.trim())
        .map((link) => ({ ...link, categoryLabel: link.label }));

      if (normalizedSectionLinks.length > 0) return normalizedSectionLinks;
    }

    return defaultGroupLinks.map((label) => ({
      label,
      href: pathname === mainCatalogPath ? `#${toCategoryId(label)}` : `${mainCatalogPath}#${toCategoryId(label)}`,
      active: activeCategory === label,
      categoryLabel: label,
    }));
  }, [activeCategory, catalogLinks, defaultGroupLinks, mainCatalogPath, pathname, sectionLinks]);

  // --- FIXED: Hysteresis Scroll Listener ---
  useEffect(() => {
    const onScroll = () => {
      setIsCompact((prev) => {
        const scrollY = window.scrollY;
        // If the header is full-size, wait until we scroll well PAST the threshold (60px) to collapse it
        if (!prev && scrollY > 90) {
          return true;
        }
        // If the header is collapsed, wait until we scroll well ABOVE the threshold (20px) to expand it
        if (prev && scrollY < 13) {
          return false;
        }
        // If we are in the "dead zone" between 20 and 60, change nothing. (Breaks the loop!)
        return prev;
      });
    };
    
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // -----------------------------------------

  useEffect(() => {
    if (pathname !== mainCatalogPath) {
      setActiveCategory(null);
      return;
    }

    const hydrateSections = () => {
      const sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-category]"));
      const labels = sections.map((section) => section.getAttribute("data-category")?.trim() ?? "").filter(Boolean);
      setCatalogLinks(Array.from(new Set(labels)));
      return sections;
    };

    let sections = hydrateSections();
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;
        const mostVisible = visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const category = mostVisible?.target.getAttribute("data-category");
        if (category) setActiveCategory(category);
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
    if (catalogRoot) mutationObserver.observe(catalogRoot, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [mainCatalogPath, pathname]);

  // --- NEW: Плавный скролл активного бейджа (pill) в центр экрана ---
  useEffect(() => {
    const activeRailLink = visibleRailLinks.find(
      (link) => link.active || (!link.href.startsWith("#") && (pathname === link.href || activePath === link.href)),
    );
    if (!activeRailLink || !railRef.current) return;

    const activeEl = Array.from(railRef.current.querySelectorAll<HTMLElement>("[data-category-pill]")).find(
      (element) => element.dataset.categoryPill === activeRailLink.categoryLabel,
    );

    if (activeEl) {
      const container = railRef.current;
      // Вычисляем нужный сдвиг (позиция элемента относительно контейнера - половина контейнера + половина элемента)
      const scrollLeft = activeEl.offsetLeft - container.clientWidth / 2 + activeEl.clientWidth / 2;

      container.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });
    }
  }, [activePath, pathname, visibleRailLinks]);
  // ------------------------------------------------------------------
  useEffect(() => {
    const container = railRef.current;
    if (!container) return;
    const activeRailLink = visibleRailLinks.find(
      (link) => link.active || (!link.href.startsWith("#") && (pathname === link.href || activePath === link.href)),
    );
    if (!activeRailLink) {
      setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const activeEl = Array.from(container.querySelectorAll<HTMLElement>("[data-category-pill]")).find(
      (element) => element.dataset.categoryPill === activeRailLink.categoryLabel,
    );
    if (!activeEl) return;
    setIndicatorStyle({ width: activeEl.offsetWidth, left: activeEl.offsetLeft, opacity: 1 });
  }, [activePath, pathname, visibleRailLinks]);

  return (
    <header
      className="sticky top-0 z-50 border-b pb-2 pt-[max(env(safe-area-inset-top),0.15rem)] backdrop-blur-2xl"
      style={{
        ...FRANCHIZE_HEADER_SAFE_AREA_STYLE,
        borderColor: crew.theme.palette.borderSoft,
        backgroundColor: withAlpha(crew.theme.palette.bgCard, 0.94),
        color: crew.theme.palette.textPrimary,
        ["--crew-header-text" as string]: crew.theme.palette.textPrimary,
        ["--crew-header-card" as string]: crew.theme.palette.bgCard,
        ["--crew-header-base" as string]: crew.theme.palette.bgBase,
        ["--crew-header-border" as string]: crew.theme.palette.borderSoft,
        ["--crew-header-accent" as string]: crew.theme.palette.accentMain,
        ["--crew-header-accent-text" as string]: activePillText,
      }}
    >
      <div className="mx-auto w-full max-w-7xl overflow-hidden">
        <div
          style={{
            ...FRANCHIZE_HEADER_CORNER_GUARD_STYLE,
            display: "grid",
            gridTemplateColumns: "44px 1fr auto auto",
            alignItems: "center",
            gap: "0.75rem",
            maxHeight: isCompact ? 0 : 112,
            opacity: isCompact ? 0 : 1,
            paddingBottom: isCompact ? 0 : "0.5rem",
            transform: isCompact ? "scaleY(0.85) translateY(-6px)" : "scaleY(1) translateY(0.45rem)",
            transformOrigin: "top center",
            transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, padding 0.3s ease, max-height 0.32s ease",
            pointerEvents: "auto",
          }}
        >
          <button
            type="button"
            aria-label="Открыть меню экипажа"
            aria-expanded={menuOpen}
            aria-controls="franchize-header-menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: withAlpha(crew.theme.palette.bgBase, 0.8),
              color: crew.theme.palette.textPrimary,
              pointerEvents: "auto",
            }}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* HEADER LOGO — PURE SPA LINK */}
          <Link
            href={headerLogoHref}
            aria-label={`На главную страницу ${crew.header.brandName}`}
            className="relative z-10 mx-auto flex flex-col items-center text-center cursor-pointer hover:opacity-90 transition-opacity pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <div
              className="relative h-16 w-16 overflow-hidden rounded-full border shadow-lg"
              style={{
                borderColor: accentMain,
                backgroundColor: crew.theme.palette.bgBase,
              }}
            >
              {logoUrl && !brokenLogoUrls[logoUrl] ? (
                <>
                  {/* Image layer — always rendered so it loads in background */}
                  <Image
                    src={logoUrl}
                    alt={`${crew.header.brandName} logo`}
                    fill
                    sizes="64px"
                    className="object-cover"
                    onLoad={() => setLogoLoaded(true)}
                    onError={() => {
                      if (!logoUrl) return;
                      setBrokenLogoUrls((prev) => ({ ...prev, [logoUrl]: true }));
                    }}
                  />
                  {/* Spooky letter overlay — breathes while loading, dissolves on load */}
                  {!logoDissolved && (
                    <span
                      className="absolute inset-0 z-10 flex items-center justify-center text-2xl font-bold select-none"
                      style={{
                        color: accentMain,
                        [SPOOKY_ACCENT_VAR as string]: sanitizeAccentColor(accentMain),
                        animation: logoLoaded
                          ? "ghostDissolve 0.8s ease-out forwards"
                          : "spookyPulse 3s ease-in-out infinite, spookyFlicker 5s steps(1) infinite",
                      }}
                      onAnimationEnd={() => {
                        if (logoLoaded) setLogoDissolved(true);
                      }}
                    >
                      {getFirstLetter(crew.header.brandName)}
                    </span>
                  )}
                </>
              ) : logoUrl && brokenLogoUrls[logoUrl] ? (
                /* Broken URL — permanent spooky letter */
                <SpookyLetter letter={getFirstLetter(crew.header.brandName)} color={accentMain} sizeClass="text-2xl" />
              ) : (
                /* No logo URL at all — brand name text fallback */
                <div
                  className="flex h-full w-full items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: accentMain }}
                >
                  {crew.header.brandName}
                </div>
              )}
            </div>
          </Link>

          <FranchizeProfileButton
            bgColor={withAlpha(crew.theme.palette.bgBase, 0.8)}
            textColor={crew.theme.palette.textPrimary}
            borderColor={crew.theme.palette.borderSoft}
            currentSlug={crew.slug}
          />
          <Link
            href={`/franchize/${crew.slug}/cart`}
            aria-label={`Корзина, позиций: ${itemCount}`}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl border transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crew-header-accent)]"
            style={{ borderColor: crew.theme.palette.borderSoft, backgroundColor: withAlpha(crew.theme.palette.bgBase, 0.8), color: crew.theme.palette.textPrimary }}
          >
            <ShoppingCart className="h-4 w-4" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--crew-header-accent)] px-1.5 text-[10px] font-bold text-[var(--crew-header-accent-text)]">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {visibleRailLinks.length > 0 && (
        <div className="-mx-4 mt-1 border-t px-4 pt-2" style={{ borderColor: crew.theme.palette.borderSoft }}>
          {/* Добавлен класс 'relative' для корректного расчета offsetLeft дочерних элементов */}
          <div
            ref={railRef}
            className="relative mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto no-scrollbar pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-1 h-0.5 rounded-full bg-[var(--crew-header-accent)] transition-all duration-300 ease-out"
              style={{ width: `${indicatorStyle.width}px`, transform: `translateX(${indicatorStyle.left}px)`, opacity: indicatorStyle.opacity }}
            />
            {visibleRailLinks.map((link) => {
              const isActive = link.active || (!link.href.startsWith("#") && (pathname === link.href || activePath === link.href));
              return (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  data-category-pill={link.categoryLabel}
                  aria-current={isActive ? "location" : undefined}
                  aria-label={`Перейти к разделу ${link.label}`}
                  className="shrink-0 snap-start rounded-full bg-[var(--pill-bg)] px-4 py-2 text-xs font-medium tracking-wide text-[var(--pill-text)] transition-colors pointer-events-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    ["--pill-bg" as string]: isActive ? crew.theme.palette.accentMain : crew.theme.palette.bgCard,
                    ["--pill-text" as string]: isActive ? activePillText : crew.theme.palette.textPrimary,
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <HeaderMenu crew={crew} activePath={activePath} open={menuOpen} onOpenChange={setMenuOpen} />
    </header>
  );
}
