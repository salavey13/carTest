// /components/layout/ClientLayout.tsx
"use client";

import type React from "react";
import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

// --- Standard Components ---
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNavigation from "@/components/layout/BottomNavigation";

// --- Theme: Bike Rental ---
import BikeHeader from "@/components/BikeHeader";
import BikeFooter from "@/components/BikeFooter";
import BottomNavigationBike from "@/components/layout/BottomNavigationBike";

// --- Theme: Sauna ---
import SaunaHeader from "@/components/SaunaHeader";
import SaunaFooter from "@/components/SaunaFooter";
import BottomNavigationSauna from "@/components/layout/BottomNavigationSauna";

// --- Theme: Bio30 ---
import Bio30Header from "@/app/bio30/components/Header";
import Bio30Footer from "@/app/bio30/components/Footer";

// --- Theme: Strikeball (Tactical OS) ---
import StrikeballHeader from "@/app/strikeball/components/StrikeballHeader";
import StrikeballBottomNav from "@/app/strikeball/components/StrikeballBottomNav";
import { StrikeballBackground } from "@/app/strikeball/components/StrikeballBackground";

// --- Theme: Franchize ---
import FranchizeMapBottomNav from "@/components/layout/FranchizeMapBottomNav";

import StickyChatButton from "@/components/StickyChatButton";
import { AppProvider, useAppContext, useStrikeballLobbyContext } from "@/contexts/AppContext";
import { ThemeProvider } from "@/components/theme-provider"; 
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useFocusTimeTracker } from "@/hooks/useFocusTimeTracker";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { checkAndUnlockFeatureAchievement } from "@/lib/cyberFitnessSupabase-server";
import { useAppToast } from "@/hooks/useAppToast";
import { useTelegramBackButton } from "@/hooks/telegram/useTelegramBackButton";
import { TelegramNavigationTracker } from "@/components/telegram/TelegramNavigationTracker";
import { Loading } from "@/components/Loading";
import { cn } from "@/lib/utils";
import { useStartParamRouter } from "@/hooks/useStartParamRouter";

// --- THEME ENGINE ---
// Franchize routes are their own product: CrewHeader + CrewFooter + optional
// FranchizeMapBottomNav. They must NOT inherit the legacy BikeHeader/BikeFooter
// or BottomNavigationBike — those belong to the global bike platform.
//
// SvarProfi is a standalone landing at /svarprofi with its own Header/Footer.
// It renders its own SvarProfiHeader + SvarProfiFooter, so global ones
// must be suppressed — same pattern as /vipbikerental.
const THEME_CONFIG = {
  strikeball: {
    paths: ["/strikeball"],
    Header: StrikeballHeader,
    Footer: null,
    BottomNav: StrikeballBottomNav,
    isTransparent: true,
  },
  bike: {
    paths: ["/rent/", "/crews", "/leaderboard", "/admin", "/paddock", "/rentals"],
    Header: BikeHeader,
    Footer: BikeFooter,
    BottomNav: BottomNavigationBike,
    isTransparent: true,
  },
  sauna: {
    paths: ["/sauna-rent", "/sauna/"],
    Header: SaunaHeader,
    Footer: SaunaFooter,
    BottomNav: BottomNavigationSauna,
    isTransparent: false,
  },
  bio30: {
    paths: ["/bio30"],
    Header: Bio30Header,
    Footer: Bio30Footer,
    BottomNav: null,
    isTransparent: false,
  },
  nnvolt: {
    paths: ["/nnvolt"],
    Header: null,           // NNvolt page has its own layout
    Footer: null,           // NNvolt page has its own layout
    BottomNav: null,
    isTransparent: false,
  },
  // PATCH: svarprofi theme — standalone landing at /svarprofi
  // Renders its own SvarProfiHeader + SvarProfiFooter internally.
  svarprofi: {
    paths: ["/svarprofi"],
    Header: null,           // SvarProfi renders its own header
    Footer: null,           // SvarProfi renders its own footer
    BottomNav: null,        // No bottom nav for metal_stuff landing
    isTransparent: true,
  },
  franchize: {
    paths: ["/franchize/"],
    Header: null,           // Franchize pages render their own CrewHeader
    Footer: null,           // Franchize pages render their own CrewFooter
    BottomNav: null,        // Handled separately via FranchizeMapBottomNav (map-riders & leaderboard)
    isTransparent: false,
  },
  default: {
    paths: [],
    Header: Header,
    Footer: Footer,
    BottomNav: BottomNavigation,
    isTransparent: false,
  },
};

const getThemeForPath = (pathname: string) => {
  // PATCH: svarprofi — check BEFORE franchize (more specific)
  if (pathname.startsWith("/svarprofi")) {
    return THEME_CONFIG.svarprofi;
  }
  if (pathname.startsWith("/nnvolt")) {
    return THEME_CONFIG.nnvolt;
  }
  if (pathname.startsWith("/franchize/")) {
    return THEME_CONFIG.franchize;
  }
  if (THEME_CONFIG.strikeball.paths.some((p) => pathname.startsWith(p))) {
    return THEME_CONFIG.strikeball;
  }
  if (THEME_CONFIG.bike.paths.some((p) => pathname.startsWith(p))) {
    return THEME_CONFIG.bike;
  }
  if (THEME_CONFIG.sauna.paths.some((p) => pathname.startsWith(p))) {
    return THEME_CONFIG.sauna;
  }
  if (pathname.startsWith("/bio30")) {
    return THEME_CONFIG.bio30;
  }
  return THEME_CONFIG.default;
};

// FranchizeMapBottomNav shows on map-riders routes (and sub-routes like /leaderboard)
const FRANCHIZE_MAP_BOTTOM_NAV_RE = /^\/franchize\/[^/]+\/(map-riders|leaderboard)(?:\/.*)?$/;

/**
 * AppInitializers
 *
 * Mounts the Telegram BackButton hook and the navigation tracker.
 *
 * NOTE: useTelegramBackButton no longer depends on `tg` from React context.
 * It reads `window.Telegram.WebApp` directly, which is injected by the
 * Telegram client BEFORE any JavaScript runs. This means the hook works
 * correctly even on first mount, without waiting for async auth validation.
 */
function AppInitializers() {
    const { dbUser, isAuthenticated } = useAppContext();
    const { success: addToast } = useAppToast();
    const scrollAchievementUnlockedRef = useRef(false);

    // ─── Telegram BackButton management ────────────────────────────
    useTelegramBackButton();

    useFocusTimeTracker({
        inactiveTimeout: 60 * 1000,
        componentName: "GlobalAppFocusTracker",
        enabled: !!(isAuthenticated && dbUser?.user_id),
    });

    const handleScrollForAchievement = useCallback(async () => {
      if (
        window.scrollY > 1000 &&
        isAuthenticated &&
        dbUser?.user_id &&
        !scrollAchievementUnlockedRef.current
        ) {
        scrollAchievementUnlockedRef.current = true;
        logger.info(
            `[ClientLayout ScrollAch] User ${dbUser.user_id} scrolled >1000px. Unlocking 'scrolled_like_a_maniac'.`
        );
        try {
            const { newAchievements } = await checkAndUnlockFeatureAchievement(
            dbUser.user_id,
            "scrolled_like_a_maniac"
            );
            newAchievements?.forEach((ach) => {
            addToast(`🏆 Ачивка: ${ach.name}!`, { description: ach.description });
            });
        } catch (error) {
            logger.error("[ClientLayout] Error unlocking achievement:", error);
            scrollAchievementUnlockedRef.current = false;
        }
        }
    }, [isAuthenticated, dbUser, addToast]);

    useEffect(() => {
        const currentScrollHandler = handleScrollForAchievement;
        if (isAuthenticated && dbUser?.user_id && !scrollAchievementUnlockedRef.current) {
        window.addEventListener("scroll", currentScrollHandler, { passive: true });
        } else {
        window.removeEventListener("scroll", currentScrollHandler);
        }
        return () => {
        window.removeEventListener("scroll", currentScrollHandler);
        };
    }, [isAuthenticated, dbUser, handleScrollForAchievement]);

    return <TelegramNavigationTracker />;
}

function useBio30ThemeFix() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname.startsWith("/bio30")) return;
    const root = document.documentElement;
    const prevBg = root.style.getPropertyValue("--background");
    const prevFg = root.style.getPropertyValue("--foreground");

    root.style.setProperty("--background", "hsl(0 0% 6%)");
    root.style.setProperty("--foreground", "hsl(0 0% 100%)");
    document.body.style.backgroundColor = "hsl(0 0% 6%)";
    document.body.style.color = "hsl(0 0% 100%)";

    return () => {
      root.style.setProperty("--background", prevBg || "");
      root.style.setProperty("--foreground", prevFg || "");
      document.body.style.backgroundColor = "";
      document.body.style.color = "";
    };
  }, [pathname]);
}

function useThemeSync() {
  const { dbUser, isLoading } = useAppContext();
  const { setTheme, resolvedTheme } = useTheme();
  const [hasSynced, setHasSynced] = useState(false);

  useEffect(() => {
    if (!isLoading && dbUser && !hasSynced) {
      const settings = dbUser.metadata?.settings_profile as Record<string, any> | undefined;
      if (settings && typeof settings.dark_mode_enabled === 'boolean') {
        const dbWantsDark = settings.dark_mode_enabled;
        const currentIsDark = resolvedTheme === 'dark';
        
        if (dbWantsDark !== currentIsDark) {
            logger.info(`[ThemeSync] Syncing theme from DB. User wants: ${dbWantsDark ? 'DARK' : 'LIGHT'}`);
            setTheme(dbWantsDark ? 'dark' : 'light');
        }
      }
      setHasSynced(true);
    }
  }, [dbUser, isLoading, hasSynced, resolvedTheme, setTheme]);
}

function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    startParamPayload,
  } = useAppContext();
  const { activeLobby } = useStrikeballLobbyContext();
  
  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true);
  const theme = useMemo(() => getThemeForPath(pathname), [pathname]);
  const CurrentHeader = theme.Header;
  const CurrentFooter = theme.Footer;
  const CurrentBottomNav = theme.BottomNav;

  // --- GHOST-VIS PREDICTIVE LOGIC ---
  const isStrikeballTheme = theme === THEME_CONFIG.strikeball;
  const isTacticalMode = isStrikeballTheme && (!!activeLobby || startParamPayload?.startsWith('lobby_'));

  // --- Franchize-specific bottom nav ---
  const isFranchizeMapBottomNavRoute = FRANCHIZE_MAP_BOTTOM_NAV_RE.test(pathname || "");

  useBio30ThemeFix();
  useThemeSync(); 
  useStartParamRouter();

  // These paths show the legacy bottom nav (NOT franchize — franchize handles its own)
  const pathsToShowBottomNavForStartsWith = [
    "/selfdev/gamified",
    "/p-plan",
    "/profile",
    "/hotvibes",
    "/leads",
    "/elon",
    "/god-mode-sandbox",
    "/rent",
    "/crews",
    "/leaderboard",
    "/admin",
    "/paddock",
    "/rentals",
    "/strikeball",
  ];
  // NOTE: /franchize/ is NOT here. Franchize pages use CrewHeader for
  // navigation and optionally FranchizeMapBottomNav on map-riders routes.
  // NOTE: /svarprofi is NOT here. SvarProfi landing handles its own navigation.

  const showBottomNav =
    pathsToShowBottomNavForStartsWith.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    setShowHeaderAndFooter(
      !(
        pathname === "/profile" ||
        pathname === "/repo-xml" ||
        pathname === "/sauna-rent" ||
        pathname?.startsWith("/wb") || 
        pathname === "/wblanding" || 
        pathname === "/wblanding/referral" ||
        pathname === "/csv-compare" ||
        pathname === "/streamer" ||
        pathname === "/vipbikerental" ||
        pathname === "/blogger" ||
        pathname?.startsWith("/optimapipe") ||
        pathname?.startsWith("/rules") ||
        pathname?.startsWith("/svarprofi") ||   // PATCH: svarprofi has own header/footer
        pathname === "/" ||
        pathname === "/admin/map-routes"
      )
    );
  }, [pathname]);

  const TRANSPARENT_LAYOUT_PAGES = ["/rentals", "/crews", "/paddock", "/admin", "/leaderboard", "/wb", "/wblanding", "/strikeball"];
  const isTransparentPage =
    TRANSPARENT_LAYOUT_PAGES.some((p) => pathname.startsWith(p)) || theme.isTransparent;

  return (
    <>
      {/* 
          GHOST-VIS: 
          If Tactical Mode is active (Combat or Incoming Invite), we suppress the background 
          completely to save battery and reduce screen illumination (Night Vision compatibility).
      */}
      {isStrikeballTheme && !isTacticalMode && <StrikeballBackground />}

      {showHeaderAndFooter && CurrentHeader && <CurrentHeader />}
      
      <main className={cn(
        "flex-1", 
        showBottomNav || isFranchizeMapBottomNavRoute ? "pb-20 sm:pb-0" : "", 
        isTacticalMode ? "bg-[#000000] text-white selection:bg-red-900" : (!isTransparentPage && "bg-background")
      )}>
        {children}
      </main>
      
      {/* Legacy theme bottom navs (bike, sauna, strikeball) */}
      {(showBottomNav || isStrikeballTheme) && CurrentBottomNav && <CurrentBottomNav pathname={pathname} />}

      {/* Franchize-scoped bottom nav — only on map-riders / leaderboard routes */}
      {isFranchizeMapBottomNavRoute && <FranchizeMapBottomNav pathname={pathname || ""} />}
      
      <Suspense fallback={null}>
        {!pathname?.startsWith("/nnvolt") && <StickyChatButton />}
      </Suspense>
      {showHeaderAndFooter && CurrentFooter && <CurrentFooter />}
    </>
  );
}

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorOverlayProvider>
      <AppProvider>
        {/*
          AppInitializers is inside AppProvider so it has access to tg context.
          The Suspense boundary is fine — the hooks inside will re-initialize
          when the Suspense resolves and the component remounts.
        */}
        <Suspense fallback={null}>
          <AppInitializers />
        </Suspense>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>
            <ErrorBoundaryForOverlay>
              <Suspense fallback={<Loading variant="bike" text="🏴‍☠️ LOADING VIBE..." />}>
                <LayoutLogicController>{children}</LayoutLogicController>
              </Suspense>
            </ErrorBoundaryForOverlay>
            <SonnerToaster
              position="bottom-right"
              richColors
              toastOptions={{
                style: {
                  background: "rgba(10, 10, 10, 0.95)",
                  color: "#00FF9D",
                  border: "1px solid rgba(0, 255, 157, 0.3)",
                  fontFamily: "monospace",
                },
              }}
            />
            <DevErrorOverlay />
          </TooltipProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </AppProvider>
    </ErrorOverlayProvider>
  );
}