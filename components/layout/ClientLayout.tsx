"use client";

import type React from "react";
import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BikeHeader from "@/components/BikeHeader";
import BikeFooter from "@/components/BikeFooter";
import SaunaHeader from "@/components/SaunaHeader";
import SaunaFooter from "@/components/SaunaFooter";
import StickyChatButton from "@/components/StickyChatButton";

import { AppProvider, useAppContext } from "@/contexts/AppContext";
import { ThemeProvider } from "@/components/theme-provider"; 
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay";
import BottomNavigationBike from "@/components/layout/BottomNavigationBike";
import BottomNavigationSauna from "@/components/layout/BottomNavigationSauna";
import { debugLogger as logger } from "@/lib/debugLogger";
import { useFocusTimeTracker } from "@/hooks/useFocusTimeTracker";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { checkAndUnlockFeatureAchievement } from "@/hooks/cyberFitnessSupabase";
import { useAppToast } from "@/hooks/useAppToast";
import { useTelegramBackButton } from "@/hooks/useTelegramBackButton";
import { Loading } from "@/components/Loading";
import { cn } from "@/lib/utils";

// Bio30 specific components
import Bio30Header from "@/app/bio30/components/Header";
import Bio30Footer from "@/app/bio30/components/Footer";
import { setReferrer } from "@/app/bio30/ref_actions"; 

// WB Syndicate Actions
import { applyReferralCode } from "@/app/wblanding/actions_view";

// --- THEME ENGINE ---
const THEME_CONFIG = {
  bike: {
    paths: ["/vipbikerental", "/rent-bike", "/rent/", "/crews", "/leaderboard", "/admin", "/paddock", "/rentals", "/strikeball"], // Added strikeball here for transparent feel if needed, or keep standard
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
    BottomNav: BottomNavigationBike,
    isTransparent: false,
  },
};

const getThemeForPath = (pathname: string) => {
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
      try {
        const { newAchievements } = await checkAndUnlockFeatureAchievement(
          dbUser.user_id,
          "scrolled_like_a_maniac"
        );
        newAchievements?.forEach((ach) => {
          addToast(`🏆 Ачивка: ${ach.name}!`, { description: ach.description });
        });
      } catch (error) {
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

const START_PARAM_PAGE_MAP: Record<string, string> = {
  elon: "/elon",
  musk_market: "/elon",
  arbitrage_seeker: "/elon",
  topdf_psycho: "/topdf",
  settings: "/settings",
  profile: "/profile",
  sauna: "/sauna-rent",
  streamer: "/streamer",
  demo: "/about_en",
  wb: "/wblanding", 
  wb_dashboard: "/wblanding",
  "audit-tool": "/wblanding",
  "create_crew": "/wblanding",
  reports: "/wblanding",
  crews: "/crews", 
  "repo-xml": "/repo-xml",
  "style-guide": "/style-guide",
  "start-training": "/selfdev/gamified",
  paddock: "/paddock",
  leaderboard: "/leaderboard",
  "rent-bike": "/rent-bike",
};

const BIO30_PRODUCT_PATHS: Record<string, string> = {
  'cordyceps': '/bio30/categories/cordyceps-sinensis',
  'spirulina': '/bio30/categories/spirulina-chlorella',
  'lions-mane': '/bio30/categories/lion-s-mane',
  'lion-s-mane': '/bio30/categories/lion-s-mane',
  'magnesium': '/bio30/categories/magnesium-pyridoxine',
  'cordyceps-sinensis': '/bio30/categories/cordyceps-sinensis',
  'spirulina-chlorella': '/bio30/categories/spirulina-chlorella',
  'magnesium-pyridoxine': '/bio30/categories/magnesium-pyridoxine'
};

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
            setTheme(dbWantsDark ? 'dark' : 'light');
        }
      }
      setHasSynced(true);
    }
  }, [dbUser, isLoading, hasSynced, resolvedTheme, setTheme]);
}

function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    startParamPayload,
    dbUser,
    userCrewInfo,
    refreshDbUser,
    isLoading: isAppLoading,
    isAuthenticating,
    clearStartParam,
  } = useAppContext();
  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true);
  const startParamHandledRef = useRef(false);
  const { success: showToast } = useAppToast();

  const theme = getThemeForPath(pathname);
  const CurrentHeader = theme.Header;
  const CurrentFooter = theme.Footer;
  const CurrentBottomNav = theme.BottomNav;

  useBio30ThemeFix();
  useThemeSync(); 

  useEffect(() => {
    const handleBio30Referral = async (referrerId: string, paramToProcess: string) => {
      if (dbUser && dbUser.user_id && !dbUser.metadata?.referrer_id) {
        try {
          const result = await setReferrer({ userId: dbUser.user_id, referrerId, referrerCode: paramToProcess });
          if (result.success) await refreshDbUser();
        } catch (error) { logger.error(`[ClientLayout] Error setting referrer:`, error); }
      }
    };

    const handleSyndicateReferral = async (refCode: string) => {
        if (!dbUser?.user_id) return;
        if (!dbUser.metadata?.referrer) {
            const res = await applyReferralCode(dbUser.user_id, refCode);
            if (res.success) {
                await refreshDbUser(); 
                showToast("🎁 Реферальный код принят! Скидка 1000₽ активирована.");
            }
        }
    };

    const paramToProcess = startParamPayload || searchParams.get("tgWebAppStartParam");
    
    if (!isAppLoading && !isAuthenticating && paramToProcess && !startParamHandledRef.current) {
      startParamHandledRef.current = true;
      let targetPath: string | undefined;

      logger.info(`[ClientLayout] Processing Start Param: ${paramToProcess}`);

      if (paramToProcess === "wb_dashboard") {
         if (userCrewInfo?.slug) targetPath = `/wb/${userCrewInfo.slug}`;
         else targetPath = "/wblanding";
      }
      else if (START_PARAM_PAGE_MAP[paramToProcess]) {
        targetPath = START_PARAM_PAGE_MAP[paramToProcess];
      } 
      else if (paramToProcess.startsWith("crew_")) {
        const content = paramToProcess.substring(5); 
        if (content.endsWith("_join_crew")) {
             const slug = content.substring(0, content.length - 10); 
             targetPath = `/wb/${slug}?join_crew=true`;
        } else {
             targetPath = `/wb/${content}`;
        }
      }
      else if (paramToProcess.startsWith("viz_")) {
        const simId = paramToProcess.substring(4);
        targetPath = `/god-mode-sandbox?simId=${simId}`;
      }
      else if (paramToProcess.startsWith("bio30_")) {
        const parts = paramToProcess.split("_");
        let productId: string | undefined;
        let referrerId: string | undefined;
        if (parts.length > 1 && parts[1] !== 'ref') productId = parts[1];
        const refIndex = parts.indexOf('ref');
        if (refIndex !== -1 && refIndex + 1 < parts.length) referrerId = parts[refIndex + 1];
        
        if (referrerId) handleBio30Referral(referrerId, paramToProcess);
        targetPath = (productId && BIO30_PRODUCT_PATHS[productId]) ? BIO30_PRODUCT_PATHS[productId] : '/bio30';
      }
      // === STRIKEBALL STARTAPP HANDLER ===
      else if (paramToProcess.startsWith("lobby_")) {
          const lobbyId = paramToProcess.substring(6); 
          if (lobbyId) targetPath = `/strikeball/lobbies/${lobbyId}`;
      }
      // ===================================
      else if (paramToProcess.startsWith("rental_") || paramToProcess.startsWith("rentals_")) {
          const parts = paramToProcess.split("_");
          if (parts.length === 2) targetPath = `/rentals/${parts[1]}`;
      }
      else if (paramToProcess.startsWith("ref_")) {
          const refCode = paramToProcess.substring(4); 
          handleSyndicateReferral(refCode);
          if (pathname === '/') targetPath = '/wblanding';
          else targetPath = pathname; 
      }
      else {
        targetPath = `/${paramToProcess}`;
      }

      if (targetPath && targetPath !== pathname) {
        logger.info(`[ClientLayout] Redirecting to ${targetPath}`);
        router.replace(targetPath);
      }
      
      clearStartParam?.();
    }
  }, [startParamPayload, searchParams, pathname, router, isAppLoading, isAuthenticating, dbUser, userCrewInfo, refreshDbUser, clearStartParam, showToast]);

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
    "/vipbikerental",
    "/strikeball", // ADDED: Show bottom nav in Strikeball module
  ];
  const showBottomNav = pathsToShowBottomNavForStartsWith.some((p) =>
    pathname?.startsWith(p)
  ) || pathname === "/";

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
        pathname === "/blogger" ||
        pathname?.startsWith("/optimapipe") ||
        pathname?.startsWith("/rules") ||
        pathname === "/"
      )
    );
  }, [pathname]);

  const TRANSPARENT_LAYOUT_PAGES = ["/rentals", "/crews", "/paddock", "/admin", "/leaderboard", "/wb", "/wblanding", "/strikeball"];
  const isTransparentPage =
    TRANSPARENT_LAYOUT_PAGES.some((p) => pathname.startsWith(p)) || theme.isTransparent;

  return (
    <>
      {showHeaderAndFooter && CurrentHeader && <CurrentHeader />}
      <main className={cn("flex-1", showBottomNav ? "pb-20 sm:pb-0" : "", !isTransparentPage && "bg-background")}>
        {children}
      </main>
      {showBottomNav && CurrentBottomNav && <CurrentBottomNav pathname={pathname} />}
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