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
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { Loading } from "@/components/Loading";
import { cn } from "@/lib/utils";
import { useStartParamRouter } from "@/hooks/useStartParamRouter";

// --- THEME ENGINE ---
const THEME_CONFIG = {
  strikeball: {
    paths: ["/strikeball"],
    Header: StrikeballHeader,
    Footer: null, // No footer for immersive view
    BottomNav: StrikeballBottomNav, // Custom tactical nav
    isTransparent: true, // Allows background component to be visible
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
  default: {
    paths: [],
    Header: Header,
    Footer: Footer,
    BottomNav: BottomNavigationBike, // Default fallback
    isTransparent: false,
  },
};

const getThemeForPath = (pathname: string) => {
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

function AppInitializers() {
    const { dbUser, isAuthenticated } = useAppContext();
    const { success: addToast } = useAppToast();
    const scrollAchievementUnlockedRef = useRef(false);

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

    return null;
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
  const { activeLobby } = useStrikeballLobbyContext(); // GHOST-VIS: Global Active Combat State
  
  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true);
  const theme = useMemo(() => getThemeForPath(pathname), [pathname]);
  const CurrentHeader = theme.Header;
  const CurrentFooter = theme.Footer;
  const CurrentBottomNav = theme.BottomNav;

  // --- GHOST-VIS PREDICTIVE LOGIC ---
  const isStrikeballTheme = theme === THEME_CONFIG.strikeball;
  // Activate Tactical Blackout if:
  // 1. We are in the Strikeball module AND
  // 2. A game is confirmed active OR we are currently parsing a lobby joining link
  const isTacticalMode = isStrikeballTheme && (!!activeLobby || startParamPayload?.startsWith('lobby_'));

  useBio30ThemeFix();
  useThemeSync(); 
  useStartParamRouter();

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
    //"/vipbikerental",
    "/strikeball", 
  ];
  const showBottomNav = pathsToShowBottomNavForStartsWith.some((p) =>
    pathname?.startsWith(p)
  );

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

      {showHeaderAndFooter && !pathname?.startsWith("/franchize") && CurrentHeader && <CurrentHeader />}
      
      <main className={cn(
        "flex-1", 
        showBottomNav ? "pb-20 sm:pb-0" : "", 
        // GHOST-VIS: Apply hard high-contrast blackout style during active operations
        isTacticalMode ? "bg-[#000000] text-white selection:bg-red-900" : (!isTransparentPage && "bg-background")
      )}>
        {children}
      </main>
      
      {(showBottomNav || isStrikeballTheme) && CurrentBottomNav && <CurrentBottomNav pathname={pathname} />}
      
      <Suspense fallback={null}>
        <StickyChatButton />
      </Suspense>
      {showHeaderAndFooter && CurrentFooter && <CurrentFooter />}
    </>
  );
}

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorOverlayProvider>
      <AppProvider>
        <AppInitializers />
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
