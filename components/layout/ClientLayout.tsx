"use client";

import type React from "react"; 
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation'; 
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BikeHeader from "@/components/BikeHeader";
import BikeFooter from "@/components/BikeFooter";
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
        scrollAchievementUnlockedRef.current = false; // Allow retry if error
      }
    }
  }, [isAuthenticated, dbUser, addToast]);

  useEffect(() => {
    const currentScrollHandler = handleScrollForAchievement;

    if (isAuthenticated && dbUser?.user_id && !scrollAchievementUnlockedRef.current) {
      window.addEventListener('scroll', currentScrollHandler, { passive: true });
      logger.debug(`[ClientLayout ScrollAch] Added scroll listener for user ${dbUser.user_id}.`);
    } else {
      window.removeEventListener('scroll', currentScrollHandler);
      logger.debug(`[ClientLayout ScrollAch] Conditions not met or achievement unlocked. Ensured scroll listener is removed for user ${dbUser?.user_id}.`);
    }

    return () => {
      window.removeEventListener('scroll', currentScrollHandler);
      logger.debug(`[ClientLayout ScrollAch] Cleaned up scroll listener for user ${dbUser?.user_id}.`);
    };
  }, [isAuthenticated, dbUser, handleScrollForAchievement]);
  
  return null; 
}

const START_PARAM_PAGE_MAP: Record<string, string> = {
  "elon": "/elon",
  "musk_market": "/elon",
  "arbitrage_seeker": "/elon",
  "topdf_psycho": "/topdf",
  "settings": "/settings",
  "profile": "/profile",
};

const DYNAMIC_ROUTE_PATTERNS: Record<string, [string, string?]> = {
    "crew": ["/crews"],
    "rental": ["/rentals", "action"], // [basePath, queryParamNameForAction]
    "lead": ["/leads"],
    "rent": ["/rent"],
};

const TRANSPARENT_LAYOUT_PAGES = [
    '/rentals', 
    '/crews',
    '/paddock',
    '/admin',
    '/leaderboard'
];

const BIKE_THEME_PAGES = [
    '/vipbikerental',
    '/rent-bike',
    '/rent/', // Using '/rent/' ensures it matches /rent/some-id
    "/crews",
    "/leaderboard",
    "/admin",
    "/paddock",
    "/rentals/"
];

function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { startParamPayload, isLoading: isAppLoading, isAuthenticating, clearStartParam } = useAppContext();

  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true);
  const startParamHandledRef = useRef(false);

  useEffect(() => {
     const paramFromUrl = searchParams.get('tgWebAppStartParam');
     const paramToProcess = startParamPayload || paramFromUrl;

    if (!isAppLoading && !isAuthenticating && paramToProcess && !startParamHandledRef.current) {
      startParamHandledRef.current = true;
      const lowerStartParam = paramToProcess.toLowerCase();
      let targetPath: string | undefined;

      if (START_PARAM_PAGE_MAP[lowerStartParam]) {
        targetPath = START_PARAM_PAGE_MAP[lowerStartParam];
      } else if (lowerStartParam.includes('_')) {
        const [prefix, ...parts] = lowerStartParam.split('_');
        
        if (DYNAMIC_ROUTE_PATTERNS[prefix]) {
            const [basePath, actionParamName] = DYNAMIC_ROUTE_PATTERNS[prefix];
            if (actionParamName && parts.length > 1) {
                const action = parts[0];
                const id = parts.slice(1).join('_');
                targetPath = `${basePath}/${id}?${actionParamName}=${action}`;
            } else {
                const slug = parts.join('-');
                targetPath = `${basePath}/${slug}`;
            }
        }
      } else if (lowerStartParam.startsWith('viz_')) {
        const simId = paramToProcess.substring(4);
        targetPath = `/god-mode-sandbox?simId=${simId}`;
      } else {
        targetPath = `/${lowerStartParam}`;
      }

      if (targetPath) {
        logger.info(`[ClientLayout Logic] startParam '${paramToProcess}' => '${targetPath}'. Redirecting from '${pathname}'.`);
        router.replace(targetPath);
        clearStartParam?.(); 
      } else {
        logger.info(`[ClientLayout Logic] Unmapped startParam '${paramToProcess}' on page '${pathname}'. No redirect.`);
      }
    }
  }, [startParamPayload, searchParams, pathname, router, isAppLoading, isAuthenticating, clearStartParam]);

  const pathsToShowBottomNavForExactMatch = ["/", "/repo-xml"]; 
  const pathsToShowBottomNavForStartsWith = [ "/selfdev/gamified", "/p-plan", "/profile", "/hotvibes", "/leads", "/elon", "/god-mode-sandbox", "/rent", "/crews", "/leaderboard", "/admin", "/paddock", "/rentals", "/vipbikerental" ];
  if (pathname && pathname.match(/^\/[^/]+(?:\/)?$/) && !pathsToShowBottomNavForStartsWith.some(p => pathname.startsWith(p)) && !pathsToShowBottomNavForExactMatch.includes(pathname)) {
    pathsToShowBottomNavForStartsWith.push(pathname); 
  }

  const isExactMatch = pathsToShowBottomNavForExactMatch.includes(pathname ?? ''); 
  const isStartsWithMatch = pathsToShowBottomNavForStartsWith.some(p => pathname?.startsWith(p)); 
  
  const showBottomNav = isExactMatch || isStartsWithMatch;
  
  useEffect(() => {
    if (pathname === "/profile" || pathname === "/repo-xml") setShowHeaderAndFooter(false);
   else setShowHeaderAndFooter(true);
  }, [pathname]);

  const isBikeThemePage = BIKE_THEME_PAGES.some(p => pathname.startsWith(p));
  const isTransparentPage = TRANSPARENT_LAYOUT_PAGES.some(p => pathname.startsWith(p)) || isBikeThemePage;

  return (
    <>
      {showHeaderAndFooter && (isBikeThemePage ? <BikeHeader /> : <Header />)}
        <main className={cn( 'flex-1', showBottomNav ? 'pb-20 sm:pb-0' : '', !isTransparentPage && 'bg-background' )}>
            {children}
        </main>
      {showBottomNav && <BottomNavigation pathname={pathname} />}
      <Suspense fallback={null}><StickyChatButton /></Suspense>
      {showHeaderAndFooter && (isBikeThemePage ? <BikeFooter /> : <Footer />)}
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