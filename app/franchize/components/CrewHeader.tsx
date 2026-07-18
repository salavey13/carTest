"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { localImageSrc } from "@/lib/image-fallback";
import { HeaderMenu } from "../modals/HeaderMenu";
import { FranchizeProfileButton, CrewButtonErrorBoundary } from "./FranchizeProfileButton";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";
import { useDisplayMode } from "./DisplayModeContext";
import { useAppContext } from "@/contexts/AppContext";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { useFranchizeTheme } from "../hooks/useFranchizeTheme";
import { FRANCHIZE_HEADER_CORNER_GUARD_STYLE, FRANCHIZE_HEADER_SAFE_AREA_STYLE } from "../lib/route-cta-policy";
import type { FranchizeSectionLink } from "../lib/section-links";
import { hasRentPrice, hasSalePrice, hasServicePrice } from "../lib/catalog-utils";
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
  const [isCompact, setIsCompact] = useState(false);
  const pathname = usePathname();
  const { displayMode, setDisplayMode, isTransitioning } = useDisplayMode();
  const { isInTelegramContext } = useAppContext();
  const router = useRouter();
  const mainCatalogPath = `/franchize/${crew.slug}`;
  const isOnCatalogPage = pathname === mainCatalogPath || pathname === `${mainCatalogPath}/`;
  const headerLogoHref = crew.header.logoHref || mainCatalogPath;
  const prevPathnameRef = useRef<string | null>(null);

  // Apply franchize theme CSS variables
  useFranchizeTheme(crew.theme);

  const activePillText = readablePaletteTextOnColor(crew.theme.palette.accentMain, crew.theme.palette);
  const { itemCount } = useFranchizeCart(crew.slug);

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

  // Reset state when navigating away from main catalog
  useEffect(() => {
    const prev = prevPathnameRef.current;
    prevPathnameRef.current = pathname;

    if (prev !== null && prev !== pathname && pathname !== mainCatalogPath) {
      // reserved for future cleanup
    }
  }, [pathname, mainCatalogPath]);

  // ── Close menu on route change (safety net) ──
  useEffect(() => {
    if (menuOpen) {
      setMenuOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  return (
    <header
      // FIX: Increased top padding to accommodate Telegram MiniApp native buttons
      // and camera cutouts on iPhone / Galaxy S25 Ultra. We now use 5.0rem (~80px)
      // minimum plus safe-area, with an extra 0.75rem buffer for devices like S25 Ultra
      // whose native bar is ~68px.
      className="sticky top-0 z-50 border-b pb-2 backdrop-blur-2xl"
      style={{
        ...FRANCHIZE_HEADER_SAFE_AREA_STYLE,
        paddingTop: isInTelegramContext
          ? "max(calc(env(safe-area-inset-top) + 4.2rem), 4.95rem)"
          : "calc(max(env(safe-area-inset-top), 0px) + 1.45rem)",
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
                telegramBotUsername={crew.contacts.telegramBotUsername}
              />
            </CrewButtonErrorBoundary>
            {SHOW_CART && isInTelegramContext && (
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

      {showRail && (
        <div
          className="-mx-4 mt-1 border-t px-4 pt-2"
          style={{ borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft }}
        >
          <div className="mx-auto flex w-full max-w-7xl gap-2 pb-1" role="tablist" aria-label="Режим отображения каталога">
            {([
              { key: "rent" as const, label: "Аренда", count: items?.filter(hasRentPrice).length ?? 0 },
              { key: "sale" as const, label: "Продажа", count: items?.filter(hasSalePrice).length ?? 0 },
              { key: "service" as const, label: "Сервис", count: items?.filter(hasServicePrice).length ?? 0 },
            ]).map((pill) => {
              const isActive = displayMode === pill.key;
              const handlePillClick = () => {
                if (isOnCatalogPage) {
                  setDisplayMode(pill.key);
                } else {
                  // On non-catalog pages — navigate to main catalog with mode
                  setDisplayMode(pill.key);
                  router.push(mainCatalogPath);
                }
              };
              return (
                <button
                  key={pill.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="catalog-sections"
                  onClick={handlePillClick}
                  disabled={isTransitioning}
                  className="shrink-0 rounded-full px-4 py-2 text-xs font-medium tracking-wide transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 select-none disabled:opacity-50 active:scale-95"
                  style={{
                    backgroundColor: isActive
                      ? (crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain)
                      : (crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard),
                    color: isActive
                      ? activePillText
                      : (crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary),
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {pill.label}
                  {pill.count > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold">
                      {pill.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <HeaderMenu crew={crew} activePath={activePath} open={menuOpen} onOpenChange={setMenuOpen} />
    </header>
  );
}