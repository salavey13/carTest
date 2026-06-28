"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { localImageSrc } from "@/lib/image-fallback";
import { HeaderMenu } from "../modals/HeaderMenu";
import { FranchizeProfileButton, CrewButtonErrorBoundary } from "./FranchizeProfileButton";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { useFranchizeTheme } from "../hooks/useFranchizeTheme";
import { toCategoryId } from "../lib/navigation";
import { FRANCHIZE_HEADER_CORNER_GUARD_STYLE, FRANCHIZE_HEADER_SAFE_AREA_STYLE } from "../lib/route-cta-policy";
import type { FranchizeSectionLink } from "../lib/section-links";
import { readablePaletteTextOnColor, withAlpha } from "../lib/theme";
import { SHOW_CART } from "@/lib/feature-flags";
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
  items?: CatalogItemVM[];
  showRail?: boolean;
}

export function CrewHeader({ crew, activePath, groupLinks = [], sectionLinks = [], items, showRail = true }: CrewHeaderProps) {
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

  // Apply franchize theme CSS variables
  useFranchizeTheme(crew.theme);

  const activePillText = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);
  const { itemCount } = useFranchizeCart(crew.slug);

  // Track whether user is manually scrolling the rail (to prevent auto-scroll from fighting it)
  const isUserScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Logo loading state machine ──
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
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (prev !== null && prev !== pathname && pathname !== mainCatalogPath) {
      const timer = setTimeout(() => setActiveCategory(null), 0);
      return () => clearTimeout(timer);
    }
  }, [pathname, mainCatalogPath]);

  // ── Close menu on route change (safety net) ──
  useEffect(() => {
    if (menuOpen) {
      setMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const defaultGroupLinks = useMemo(
    () => Array.from(new Set([...crew.catalog.showcaseGroups.map((group) => group.label), ...crew.catalog.categories, ...groupLinks].filter(Boolean))),
    [crew.catalog.categories, crew.catalog.showcaseGroups, groupLinks],
  );

  const visibleRailLinks = useMemo(() => {
    if (pathname === mainCatalogPath && catalogLinks.length > 0) {
      return catalogLinks.map((label) => ({
        label,
        href: `${mainCatalogPath}#${toCategoryId(label)}`,
        active: activeCategory === label,
        categoryLabel: label,
      }));
    }

    if (pathname !== mainCatalogPath && sectionLinks.length > 0) {
      const normalizedSectionLinks = sectionLinks
        .filter((link) => link.label.trim() && link.href.trim())
        .filter((link) => SHOW_CART || link.label.toLowerCase() !== "корзина")
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
        if (!prev && scrollY > 90) {
          return true;
        }
        if (prev && scrollY < 13) {
          return false;
        }
        return prev;
      });
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

  // --- Плавный скролл активного бейджа (pill) в центр экрана ---
  useEffect(() => {
    if (isUserScrollingRef.current) return;

    const activeRailLink = visibleRailLinks.find(
      (link) => link.active || (!link.href.startsWith("#") && (pathname === link.href || activePath === link.href)),
    );
    if (!activeRailLink || !railRef.current) return;

    const activeEl = Array.from(railRef.current.querySelectorAll<HTMLElement>("[data-category-pill]")).find(
      (element) => element.dataset.categoryPill === activeRailLink.categoryLabel,
    );

    if (activeEl) {
      const container = railRef.current;
      const scrollLeft = activeEl.offsetLeft - container.clientWidth / 2 + activeEl.clientWidth / 2;

      container.scrollTo({
        left: scrollLeft,
        behavior: "smooth",
      });
    }
  }, [activePath, pathname, activeCategory, visibleRailLinks]);

  return (
    <header
      // FIX: Increased top padding to accommodate Telegram MiniApp native buttons
      // (back/settings button bar ~44px). The old 0.15rem minimum was too thin.
      // calc(env(safe-area-inset-top) + 2.25rem) adds 36px on top of safe-area,
      // with a minimum of 2.75rem (~44px) when safe-area is 0.
      className="sticky top-0 z-50 border-b pb-2 backdrop-blur-2xl"
      style={{
        ...FRANCHIZE_HEADER_SAFE_AREA_STYLE,
        paddingTop: "max(calc(env(safe-area-inset-top) + 2.25rem), 2.75rem)",
        // FIX 6: isolation creates a proper stacking context for the entire header.
        isolation: "isolate",
        borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
        backgroundColor: crew.theme.isAuto
          ? "var(--franchize-bg-card)"
          : withAlpha(crew.theme.palette.bgCard, 0.94),
        color: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
        ["--crew-header-text" as string]: crew.theme.isAuto
          ? "var(--franchize-text-primary)"
          : crew.theme.palette.textPrimary,
        ["--crew-header-card" as string]: crew.theme.isAuto
          ? "var(--franchize-bg-card)"
          : crew.theme.palette.bgCard,
        ["--crew-header-base" as string]: crew.theme.isAuto
          ? "var(--franchize-bg-base)"
          : crew.theme.palette.bgBase,
        ["--crew-header-border" as string]: crew.theme.isAuto
          ? "var(--franchize-border-soft)"
          : crew.theme.palette.borderSoft,
        ["--crew-header-accent" as string]: crew.theme.isAuto
          ? "var(--franchize-accent-main)"
          : crew.theme.palette.accentMain,
        ["--crew-header-accent-text" as string]: activePillText,
      }}
    >
      {/*
        FIX 2: Removed overflow-hidden from this wrapper.
        The old overflow-hidden + translateY created a hit-testing boundary.
      */}
      <div className="mx-auto w-full max-w-7xl">
        {/*
          FIX 1: Grid layout "44px 1fr auto" (3 cols, 3 children).
          FIX 3: Removed translateY(0.45rem) from non-compact transform.
        */}
        <div
          style={{
            ...FRANCHIZE_HEADER_CORNER_GUARD_STYLE,
            display: "grid",
            gridTemplateColumns: "44px 1fr auto",
            alignItems: "center",
            gap: "0.75rem",
            maxHeight: isCompact ? 0 : 112,
            opacity: isCompact ? 0 : 1,
            paddingBottom: isCompact ? 0 : "0.5rem",
            transform: isCompact ? "scaleY(0.85) translateY(-6px)" : "scaleY(1) translateY(0)",
            transformOrigin: "top center",
            transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, padding 0.3s ease, max-height 0.32s ease",
            pointerEvents: isCompact ? "none" : "auto",
          }}
        >
          <button
            type="button"
            aria-label="Открыть меню экипажа"
            aria-expanded={menuOpen}
            aria-controls="franchize-header-menu"
            onClick={() => setMenuOpen(true)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 pointer-events-auto"
            style={{
              backgroundColor: crew.theme.isAuto
                ? "var(--franchize-bg-base)"
                : withAlpha(crew.theme.palette.bgBase, 0.8),
              color: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
            }}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* HEADER LOGO — PURE SPA LINK */}
          {/*
            FIX 4: Removed z-10 from logo Link className.
            FIX 5: Added justify-self-center to constrain clickable area.
          */}
          <Link
            href={headerLogoHref}
            aria-label={`На главную страницу ${crew.header.brandName}`}
            className="relative mx-auto flex flex-col items-center text-center cursor-pointer hover:opacity-90 transition-opacity justify-self-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <div
              className="relative h-12 w-12 min-h-12 min-w-12 overflow-hidden rounded-full border shadow-lg"
              style={{
                borderColor: accentMain,
                backgroundColor: crew.theme.isAuto ? "var(--franchize-bg-base)" : crew.theme.palette.bgBase,
              }}
            >
              {logoUrl ? (
                !brokenLogoUrls[localImageSrc(logoUrl)] ? (
                  <>
                    <Image
                      src={localImageSrc(logoUrl)}
                      alt={`${crew.header.brandName} logo`}
                      fill
                      sizes="48px"
                      className="object-cover"
                      onLoad={() => setLogoLoaded(true)}
                      onError={() => {
                        const localSrc = localImageSrc(logoUrl);
                        setBrokenLogoUrls((prev) => ({ ...prev, [localSrc]: true }));
                      }}
                    />
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
                ) : (
                  <SpookyLetter letter={getFirstLetter(crew.header.brandName)} color={accentMain} sizeClass="text-2xl" />
                )
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center px-2 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: accentMain }}
                >
                  {crew.header.brandName}
                </div>
              )}
            </div>
          </Link>

          {/*
            FIX: Wrap FranchizeProfileButton in CrewButtonErrorBoundary
            at the CALL SITE with resetKey=pathname for recovery.
            v4 of FranchizeProfileButton always renders DropdownMenu
            (no more !hasUser early return), so this boundary is just
            a safety net for unexpected runtime errors.

            FIX: pointerEvents conditional on isCompact.
            When compact, the entire grid row is hidden (opacity 0, maxHeight 0)
            and pointerEvents: "none" on the parent. But this child div
            previously had pointerEvents: "auto" which overrode the parent's
            "none" — causing rail pills that overlap the profile icon area
            to click through to the invisible profile button.
            Now it respects the compact state.
          */}
          <div className="flex items-center gap-2 justify-self-end relative z-[2] pointer-events-auto" style={{ pointerEvents: isCompact ? "none" : "auto" }}>
            <CrewButtonErrorBoundary
              bgColor={crew.theme.isAuto ? "var(--franchize-bg-base)" : withAlpha(crew.theme.palette.bgBase, 0.8)}
              textColor={crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary}
              borderColor={crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft}
              resetKey={pathname}
            >
              <FranchizeProfileButton
                bgColor={crew.theme.isAuto ? "var(--franchize-bg-base)" : withAlpha(crew.theme.palette.bgBase, 0.8)}
                textColor={crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary}
                borderColor={crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft}
                currentSlug={crew.slug}
              />
            </CrewButtonErrorBoundary>
            {SHOW_CART && (
              <FloatingCartIconLinkBySlug
                slug={crew.slug}
                href={`/franchize/${crew.slug}/cart`}
                items={items}
                accentColor={crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain}
                textColor={crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary}
                borderColor={crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft}
                theme={crew.theme}
                mode="inline-icon"
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl no-underline"
              />
            )}
          </div>
        </div>
      </div>

      {showRail && visibleRailLinks.length > 0 && (
        <div
          className="-mx-4 mt-1 border-t px-4 pt-2"
          style={{ borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft }}
        >
          <div
            ref={railRef}
            className="relative mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto no-scrollbar pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
            onScroll={() => {
              isUserScrollingRef.current = true;
              if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
              userScrollTimerRef.current = setTimeout(() => {
                isUserScrollingRef.current = false;
              }, 1500);
            }}
          >
            {visibleRailLinks.map((link) => {
              const isActive = link.active || (!link.href.startsWith("#") && (pathname === link.href || activePath === link.href));
              return (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  data-category-pill={link.categoryLabel}
                  aria-current={isActive ? "location" : undefined}
                  aria-label={`Перейти к разделу ${link.label}`}
                  className="shrink-0 snap-start rounded-full bg-[var(--pill-bg)] px-3 py-2 text-xs font-medium tracking-wide text-[var(--pill-text)] no-underline transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 select-none"
                  style={{
                    ["--pill-bg" as string]: isActive
                      ? (crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain)
                      : (crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard),
                    ["--pill-text" as string]: isActive
                      ? activePillText
                      : (crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary),
                    textDecoration: "none",
                  }}
                  onClick={(event) => {
                    setActiveCategory(link.categoryLabel);
                    if (link.href.includes("#")) {
                      const hash = link.href.split("#")[1];
                      if (hash) {
                        const target = document.getElementById(hash);
                        if (target) {
                          event.preventDefault();
                          target.scrollIntoView({ behavior: "smooth", block: "start" });
                          window.history.replaceState(null, "", `#${hash}`);
                        }
                      }
                    }
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