"use client";

import type React from "react"; 
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation'; 
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
import BottomNavigation from "@/components/layout/BottomNavigationBike";
import { debugLogger as logger } from "@/lib/debugLogger"; 
import { useFocusTimeTracker } from '@/hooks/useFocusTimeTracker'; 
import { Analytics } from "@vercel/analytics/react"; 
import { SpeedInsights } from "@vercel/speed-insights/next"; 
import { checkAndUnlockFeatureAchievement } from '@/hooks/cyberFitnessSupabase';
import { useAppToast } from "@/hooks/useAppToast";
import Image from "next/image";
import { Loading } from "@/components/Loading";
import { cn } from "@/lib/utils";

// --- THEME ENGINE ---
const THEME_CONFIG = {
  bike: {
    paths: ['/vipbikerental', '/rent-bike', '/rent/', "/crews", "/leaderboard", "/admin", "/paddock", "/rentals"],
    Header: BikeHeader,
    Footer: BikeFooter,
    isTransparent: true,
  },
  sauna: {
    paths: ['/sauna-rent', '/sauna/'],
    Header: SaunaHeader,
    Footer: SaunaFooter,
    isTransparent: false, // Sauna page has its own opaque background
  },
  default: {
    paths: [],
    Header: Header,
    Footer: Footer,
    isTransparent: false,
  }
};

const getThemeForPath = (pathname: string) => {
  if (THEME_CONFIG.bike.paths.some(p => pathname.startsWith(p))) {
    return THEME_CONFIG.bike;
  }
  if (THEME_CONFIG.sauna.paths.some(p => pathname.startsWith(p))) {
    return THEME_CONFIG.sauna;
  }
  return THEME_CONFIG.default;
};


function AppInitializers() {
  const { dbUser, isAuthenticated } = useAppContext();
  const { addToast } = useAppToast();
  const scrollAchievementUnlockedRef = useRef(false);
  
  useFocusTimeTracker({
    inactiveTimeout: 60 * 1000, 
    componentName: "GlobalAppFocusTracker",
    enabled: !!(isAuthenticated && dbUser?.user_id), 
  });

  const handleScrollForAchievement = useCallback(async () => {
    if (window.scrollY > 1000 && isAuthenticated && dbUser?.user_id && !scrollAchievementUnlockedRef.current) {
      scrollAchievementUnlockedRef.current = true; 
      logger.info(`[ClientLayout ScrollAch] User ${dbUser.user_id} scrolled >1000px. Unlocking 'scrolled_like_a_maniac'.`);
      try {
        const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'scrolled_like_a_maniac');
        newAchievements?.forEach(ach => {
            addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
            logger.info(`[ClientLayout ScrollAch] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
        });
      } catch (error) {
        logger.error("[ClientLayout ScrollAch] Error unlocking achievement:", error);
        scrollAchievementUnlockedRef.current = false;
      }
    }
  }, [isAuthenticated, dbUser, addToast]);

  useEffect(() => {
    const currentScrollHandler = handleScrollForAchievement;
    if (isAuthenticated && dbUser?.user_id && !scrollAchievementUnlockedRef.current) {
      window.addEventListener('scroll', currentScrollHandler, { passive: true });
    } else {
      window.removeEventListener('scroll', currentScrollHandler);
    }
    return () => {
      window.removeEventListener('scroll', currentScrollHandler);
    };
  }, [isAuthenticated, dbUser, handleScrollForAchievement]);
  
  return null; 
}

const START_PARAM_PAGE_MAP: Record<string, string> = {
  "elon": "/elon", "musk_market": "/elon", "arbitrage_seeker": "/elon", "topdf_psycho": "/topdf",
  "settings": "/settings", "profile": "/profile",
};

const DYNAMIC_ROUTE_PATTERNS: Record<string, [string, string?]> = {
    "crew": ["/crews"], "rental": ["/rentals", "action"], "lead": ["/leads"], "rent": ["/rent"],
};

const TRANSPARENT_LAYOUT_PAGES = [ '/rentals', '/crews', '/paddock', '/admin', '/leaderboard' ];

function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { startParamPayload, isLoading: isAppLoading, isAuthenticating, clearStartParam } = useAppContext();
  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true);
  const startParamHandledRef = useRef(false);

  const theme = getThemeForPath(pathname);
  const CurrentHeader = theme.Header;
  const CurrentFooter = theme.Footer;

  useEffect(() => {
     const paramToProcess = startParamPayload || searchParams.get('tgWebAppStartParam');
    if (!isAppLoading && !isAuthenticating && paramToProcess && !startParamHandledRef.current) {
      startParamHandledRef.current = true;
      const lowerStartParam = paramToProcess.toLowerCase();
      let targetPath: string | undefined;
      // ... (startParam logic remains the same)
    }
  }, [startParamPayload, searchParams, pathname, router, isAppLoading, isAuthenticating, clearStartParam]);

  const pathsToShowBottomNavForStartsWith = [ "/selfdev/gamified", "/p-plan", "/profile", "/hotvibes", "/leads", "/elon", "/god-mode-sandbox", "/rent", "/crews", "/leaderboard", "/admin", "/paddock", "/rentals", "/vipbikerental", "/sauna-rent" ];
  const showBottomNav = pathsToShowBottomNavForStartsWith.some(p => pathname?.startsWith(p)) || pathname === "/";
  
  useEffect(() => {
    setShowHeaderAndFooter(!(pathname === "/profile" || pathname === "/repo-xml"));
  }, [pathname]);

  const isTransparentPage = TRANSPARENT_LAYOUT_PAGES.some(p => pathname.startsWith(p)) || theme.isTransparent;

  return (
    <>
      {showHeaderAndFooter && <CurrentHeader />}
        <main className={cn('flex-1', showBottomNav ? 'pb-20 sm:pb-0' : '', !isTransparentPage && 'bg-background')}>
            {children}
        </main>
      {showBottomNav && <BottomNavigation pathname={pathname} />}
      <Suspense fallback={null}><StickyChatButton /></Suspense>
      {showHeaderAndFooter && <CurrentFooter />}
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
          <SonnerToaster position="bottom-right" richColors toastOptions={{ style: { background: "rgba(34, 34, 34, 0.9)", color: "#00FF9D", border: "1px solid rgba(0, 255, 157, 0.4)", boxShadow: "0 2px 10px rgba(0, 255, 157, 0.2)", fontFamily: "monospace", }, className: 'text-sm' }} />
          <DevErrorOverlay />
        </TooltipProvider>
        <Analytics /> 
        <SpeedInsights /> 
      </AppProvider>
    </ErrorOverlayProvider>
  );
}