"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { FranchizeCrewVM } from "../actions";
import { HeaderMenu } from "../modals/HeaderMenu";
import { FranchizeProfileButton, CrewButtonErrorBoundary } from "./FranchizeProfileButton";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";
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

  // Track whether user is manually scrolling the rail (to prevent auto-scroll from fighting it)
  const isUserScrollingRef = useRef(false);
  const userScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ── FIX: Close menu on route change (safety net for HeaderMenu navigation) ──
  // When the user clicks a menu item in HeaderMenu, the menu closes via
  // onOpenChange(false) and navigation starts via router.push() in a
  // setTimeout. If the menu somehow stays open (e.g., router.push fails
  // or the user navigates via browser back/forward), this effect closes
  // the menu when the pathname changes. This is a safety net, not the
  // primary close mechanism.
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

  // --- Плавный скролл активного бейджа (pill) в центр экрана ---
  // Auto-scroll on navigation + activeCategory changes (pill clicks, IntersectionObserver).
  // The isUserScrollingRef guard prevents snap-back when the user is manually scrolling the rail.
  // Pill click → isUserScrollingRef=false → auto-scroll centers the pill ✅
  // Page scroll → IntersectionObserver fires → isUserScrollingRef=false → auto-scroll ✅
  // Manual rail scroll → isUserScrollingRef=true → auto-scroll blocked ✅
  useEffect(() => {
    // Don't auto-scroll while user is manually scrolling the rail
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
  }, [activePath, pathname, activeCategory, visibleRailLinks]); // re-added activeCategory + visibleRailLinks; isUserScrollingRef guard prevents snap-back
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
        // FIX 6: isolation creates a proper stacking context for the entire header.
        // Without this, backdrop-blur-2xl + position:sticky creates a compositing
        // layer that can interfere with pointer-event hit-testing in Chromium/mobile
        // WebViews. isolation:isolate ensures the header's stacking context is
        // well-defined and doesn't leak to parent layers.
        isolation: "isolate",
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
      {/*
        FIX 2: Removed overflow-hidden from this wrapper.
        The old overflow-hidden + translateY(0.45rem) on the grid child created a
        Chromium/mobile-WebView hit-testing boundary: pointer events stopped
        propagating correctly to the transformed child. The grid's visual content
        was shifted down 7.2px by the transform, but overflow-hidden clipped the
        wrapper at the un-shifted boundary — so the bottom 7.2px of interactive
        elements (profile button, cart icon) were both visually clipped AND
        removed from the hit-testing region. The 3-column grid layout already
        constrains horizontal overflow, so overflow-hidden was unnecessary.
      */}
      <div className="mx-auto w-full max-w-7xl">
        {/*
          FIX 1: Grid layout changed from "auto auto minmax(0,1fr) auto" (4 cols, 3 children)
          to "44px 1fr auto" (3 cols, 3 children). The old layout put the profile+cart div
          in the minmax(0,1fr) column, which consumed ALL remaining space and created an
          invisible overlay that intercepted pointer events on everything below it.
        */}
        {/*
          FIX 3: Removed translateY(0.45rem) from non-compact transform.
          The old translateY(0.45rem) shifted the grid's visual content down by 7.2px,
          causing it to overflow the wrapper div. Combined with overflow-hidden on the
          wrapper, this clipped the bottom portion of the header and created hit-testing
          boundary issues in mobile WebViews. Set to translateY(0) instead.
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
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              backgroundColor: withAlpha(crew.theme.palette.bgBase, 0.8),
              color: crew.theme.palette.textPrimary,
            }}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* HEADER LOGO — PURE SPA LINK */}
          {/*
            FIX 4: Removed z-10 from logo Link className.
            The old z-10 created an elevated stacking context within the grid
            that could interfere with pointer events on the profile+cart div
            in column 3. The inner spooky letter span still has z-10 within
            the logo's own stacking context (provided by `relative`), so the
            overlay animation continues to work correctly.

            FIX 5: Added justify-self-center to constrain the Link's clickable
            area to the logo itself. Without this, the Link (a flex container)
            stretches to fill the entire 1fr grid cell, creating a wide invisible
            clickable area spanning hundreds of pixels. While this didn't block
            clicks on adjacent cells (grid items don't overlap by default), it
            caused accidental navigations when users clicked near the logo.
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
                    sizes="48px"
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

          {/*
            FIX 5 (companion): Added relative z-[2] to ensure the profile+cart
            div is above the logo Link in the grid's stacking order. Even though
            grid items in different cells don't overlap by default, this guarantees
            correct z-ordering if any edge case causes visual overlap (e.g., during
            CSS transitions or on unusual viewports).
          */}
          {/* FIX v3: Wrap FranchizeProfileButton in CrewButtonErrorBoundary
              at the CALL SITE. The boundary inside FranchizeProfileButton only
              wraps the JSX return (DropdownMenu), NOT the hooks. If a hook
              throws (e.g., useAppContext during SPA transition), the inner
              boundary cannot catch it, and the error reaches the page-level
              error.tsx → fullscreen "Экипаж временно недоступен". Wrapping
              at the call site catches ALL errors (hooks + JSX) and renders
              a small Telegram link fallback instead of crashing the page. */}
          <div className="flex items-center gap-2 justify-self-end relative z-[2]">
            <CrewButtonErrorBoundary
              bgColor={withAlpha(crew.theme.palette.bgBase, 0.8)}
              textColor={crew.theme.palette.textPrimary}
              borderColor={crew.theme.palette.borderSoft}
            >
              <FranchizeProfileButton
                bgColor={withAlpha(crew.theme.palette.bgBase, 0.8)}
                textColor={crew.theme.palette.textPrimary}
                borderColor={crew.theme.palette.borderSoft}
                currentSlug={crew.slug}
              />
            </CrewButtonErrorBoundary>
            <FloatingCartIconLinkBySlug
              slug={crew.slug}
              href={`/franchize/${crew.slug}/cart`}
              items={undefined}
              accentColor={crew.theme.palette.accentMain}
              textColor={crew.theme.palette.textPrimary}
              borderColor={crew.theme.palette.borderSoft}
              theme={crew.theme}
              mode="inline-icon"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl"
            />
          </div>
        </div>
      </div>

      {visibleRailLinks.length > 0 && (
        <div
          className="-mx-4 mt-1 border-t px-4 pt-2"
          style={{ borderColor: crew.theme.palette.borderSoft }}
        >
          <div
            ref={railRef}
            className="relative mx-auto flex w-full max-w-7xl gap-2 overflow-x-auto no-scrollbar pb-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
            onScroll={() => {
              // Mark that user is scrolling the rail — prevents auto-scroll override
              isUserScrollingRef.current = true;
              if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
              userScrollTimerRef.current = setTimeout(() => {
                isUserScrollingRef.current = false;
              }, 1500);
            }}
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
                  className="shrink-0 snap-start rounded-full bg-[var(--pill-bg)] px-3 py-2 text-xs font-medium tracking-wide text-[var(--pill-text)] !no-underline transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    ["--pill-bg" as string]: isActive ? crew.theme.palette.accentMain : crew.theme.palette.bgCard,
                    ["--pill-text" as string]: isActive ? activePillText : crew.theme.palette.textPrimary,
                    transform: isActive ? "translateY(0) scale(1.02)" : "translateY(0)",
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
                          // Keep URL hash in sync without adding history entry
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