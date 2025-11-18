"use client";

import type React from "react";
import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BikeHeader from "@/components/BikeHeader";
import BikeFooter from "@/components/BikeFooter";
import SaunaHeader from "@/components/SaunaHeader";
import SaunaFooter from "@/components/SaunaFooter";
import StickyChatButton from "@/components/StickyChatButton";

import { AppProvider, useAppContext } from "@/contexts/AppContext";
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

// --- THEME ENGINE ---
const THEME_CONFIG = {
  bike: {
    paths: ["/vipbikerental", "/rent-bike", "/rent/", "/crews", "/leaderboard", "/admin", "/paddock", "/rentals"],
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
          logger.info(
            `[ClientLayout ScrollAch] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`
          );
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

const START_PARAM_PAGE_MAP: Record<string, string> = {
  // Legacy / Standard
  elon: "/elon",
  musk_market: "/elon",
  arbitrage_seeker: "/elon",
  topdf_psycho: "/topdf",
  settings: "/settings",
  profile: "/profile",
  sauna: "/sauna-rent",
  streamer: "/streamer",
  demo: "/about_en",
  
  // Warehouse / Pirate Code Ops
  // FIXED: Pointing generic terms to landing page since /wb root doesn't exist
  wb: "/wblanding", 
  wb_dashboard: "/wblanding", // Dynamic logic handles override below
  "audit-tool": "/wblanding",
  "create_crew": "/wblanding",
  reports: "/wblanding",
  crews: "/crews", 
  
  // Developer / CyberDev Ops
  "repo-xml": "/repo-xml",
  "style-guide": "/style-guide",
  "start-training": "/selfdev/gamified",
  
  // Racing / Legacy
  paddock: "/paddock",
  leaderboard: "/leaderboard",
  "rent-bike": "/rent-bike",
};

// BIO30 Product mapping for startapp parameters
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

function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    startParamPayload,
    dbUser,
    userCrewInfo, // Access crew info for smart redirects
    refreshDbUser,
    isLoading: isAppLoading,
    isAuthenticating,
    clearStartParam,
  } = useAppContext();
  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true);
  const startParamHandledRef = useRef(false);

  const theme = getThemeForPath(pathname);
  const CurrentHeader = theme.Header;
  const CurrentFooter = theme.Footer;
  const CurrentBottomNav = theme.BottomNav;

  useBio30ThemeFix();

  useEffect(() => {
    const handleBio30Referral = async (referrerId: string, paramToProcess: string) => {
      if (dbUser && dbUser.user_id && !dbUser.metadata?.referrer_id) {
        try {
          const result = await setReferrer({
            userId: dbUser.user_id,
            referrerId,
            referrerCode: paramToProcess,
          });
          if (result.success) {
            logger.info(
              `[ClientLayout] Referral set for user ${dbUser.user_id} to referrer ${referrerId}`
            );
            await refreshDbUser();
          } else {
            logger.error(
              `[ClientLayout] Failed to set referrer for user ${dbUser.user_id}: ${result.error}`
            );
          }
        } catch (error) {
          logger.error(`[ClientLayout] Error setting referrer:`, error);
        }
      }
    };

    const paramToProcess = startParamPayload || searchParams.get("tgWebAppStartParam");
    
    // Ensure we wait for authentication before making decisions about "userCrewInfo" dependent routes
    if (!isAppLoading && !isAuthenticating && paramToProcess && !startParamHandledRef.current) {
      startParamHandledRef.current = true;
      let targetPath: string | undefined;

      const parts = paramToProcess.split("_");
      const prefix = parts[0];

      // 1. Check Smart Dashboard Redirect (wb_dashboard)
      // If user wants dashboard and HAS a crew -> go directly to slug
      // Else -> map will send them to landing
      if (paramToProcess === "wb_dashboard" && userCrewInfo?.slug) {
        targetPath = `/wb/${userCrewInfo.slug}`;
      }
      // 2. Standard Map Lookup
      else if (START_PARAM_PAGE_MAP[paramToProcess]) {
        targetPath = START_PARAM_PAGE_MAP[paramToProcess];
      } 
      // 3. Dynamic Prefixes
      else if (prefix === "rental" || prefix === "rentals") {
        if (parts.length === 2) {
          const rentalId = parts[1];
          targetPath = `/rentals/${rentalId}`;
        } else if (parts.length > 2) {
          const action = parts[1];
          const rentalId = parts.slice(2).join("_");
          targetPath = `/rentals/${rentalId}?action=${action}`;
        }
      } else if (prefix === "crew") {
        // Updated logic to support new Warehouse /wb/ paths
        if (parts.length === 2) {
            // Case: crew_<slug> -> Direct Dashboard Access
            const slug = parts[1];
            targetPath = `/wb/${slug}`;
        } else if (parts.length > 2) {
            // Case: crew_<slug>_<action>...
            const actionIndex = parts.findIndex((p) => p === "join" || p === "confirm");
            if (actionIndex > 1) {
                const slug = parts.slice(1, actionIndex).join("-");
                const action = parts[actionIndex];
                const actionVerb = parts[actionIndex + 1];

                if (action === "join" && actionVerb === "crew") {
                    targetPath = `/wb/${slug}?join_crew=true`;
                } else if (
                    action === "confirm" &&
                    actionVerb === "member" &&
                    parts.length > actionIndex + 2
                ) {
                    const id = parts.slice(actionIndex + 2).join("_");
                    targetPath = `/wb/${slug}?confirm_member=${id}`;
                }
            }
        }
      } else if (paramToProcess.startsWith("viz_")) {
        const simId = paramToProcess.substring(4);
        targetPath = `/god-mode-sandbox?simId=${simId}`;
      } else if (prefix === "bio30") {
        // Handle BIO30 startapp parameters
        let productId: string | undefined;
        let referrerId: string | undefined;
        
        if (parts.length > 1 && parts[1] !== 'ref') {
          productId = parts[1];
        }
        
        const refIndex = parts.indexOf('ref');
        if (refIndex !== -1 && refIndex + 1 < parts.length) {
          referrerId = parts[refIndex + 1];
        }
        
        if (referrerId && dbUser?.user_id && !dbUser.metadata?.referrer_id) {
          handleBio30Referral(referrerId, paramToProcess).catch((error) => {
            logger.error(`[ClientLayout] Error in bio30 referral processing:`, error);
          });
        }
        
        if (productId && BIO30_PRODUCT_PATHS[productId]) {
          targetPath = BIO30_PRODUCT_PATHS[productId];
        } else {
          targetPath = '/bio30';
        }
      } else if (
        paramToProcess.startsWith("ref_") &&
        parts.length === 2 &&
        pathname.startsWith("/bio30")
      ) {
        const referrerId = parts[1];
        handleBio30Referral(referrerId, paramToProcess).catch((error) => {
          logger.error(`[ClientLayout] Error in bio30 referral processing:`, error);
        });
        targetPath = undefined; 
      } else {
        // Fallback to raw param as path
        targetPath = `/${paramToProcess}`;
      }

      if (targetPath && targetPath !== pathname) {
        logger.info(
          `[ClientLayout Logic] startParam '${paramToProcess}' => '${targetPath}'. Redirecting.`
        );
        router.replace(targetPath);
        clearStartParam?.();
      } else {
        clearStartParam?.();
      }
    }
  }, [
    startParamPayload,
    searchParams,
    pathname,
    router,
    isAppLoading,
    isAuthenticating,
    dbUser,
    userCrewInfo,
    refreshDbUser,
    clearStartParam,
  ]);

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
    // "/wb" -- Removed from bottom nav logic to keep it clean/standalone as requested by Pirate aesthetic
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
        pathname?.startsWith("/wb") || // Hides standard header/footer for Warehouse pages
        pathname === "/wblanding" || 
        pathname === "/csv-compare" ||
        pathname === "/streamer" ||
        pathname === "/blogger" ||
        pathname?.startsWith("/optimapipe") ||
        pathname?.startsWith("/rules") ||
        pathname === "/"
      )
    );
  }, [pathname]);

  const TRANSPARENT_LAYOUT_PAGES = ["/rentals", "/crews", "/paddock", "/admin", "/leaderboard", "/wb", "/wblanding"];
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
        <TooltipProvider>
          <ErrorBoundaryForOverlay>
            <Suspense fallback={<Loading variant="bike" text="🕶️" />}>
              <LayoutLogicController>{children}</LayoutLogicController>
            </Suspense>
          </ErrorBoundaryForOverlay>
          <SonnerToaster
            position="bottom-right"
            richColors
            toastOptions={{
              style: {
                background: "rgba(34, 34, 34, 0.9)",
                color: "#00FF9D",
                border: "1px solid rgba(0, 255, 157, 0.4)",
                boxShadow: "0 2px 10px rgba(0, 255, 157, 0.2)",
                fontFamily: "monospace",
              },
              className: "text-sm",
            }}
          />
          <DevErrorOverlay />
        </TooltipProvider>
        <Analytics />
        <SpeedInsights />
      </AppProvider>
    </ErrorOverlayProvider>
  );
}