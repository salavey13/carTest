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
import BottomNavigationBike from "@/components/layout/BottomNavigationBike";
import BottomNavigationSauna from "@/components/layout/BottomNavigationSauna";
import { debugLogger as logger } from "@/lib/debugLogger"; 
import { useFocusTimeTracker } from '@/hooks/useFocusTimeTracker'; 
import { Analytics } from "@vercel/analytics/react"; 
import { SpeedInsights } from "@vercel/speed-insights/next"; 
import { checkAndUnlockFeatureAchievement } from '@/hooks/cyberFitnessSupabase';
import { useAppToast } from "@/hooks/useAppToast";
import Image from "next/image";
import { Loading } from "@/components/Loading";
import { cn } from "@/lib/utils";

const THEME_CONFIG = {
  bike: {
    paths: ['/vipbikerental', '/rent-bike', '/rent/', "/crews", "/leaderboard", "/admin", "/paddock", "/rentals"],
    Header: BikeHeader,
    Footer: BikeFooter,
    BottomNav: BottomNavigationBike,
    isTransparent: true,
  },
  sauna: {
    paths: ['/sauna-rent', '/sauna/'],
    Header: SaunaHeader,
    Footer: SaunaFooter,
    BottomNav: BottomNavigationSauna,
    isTransparent: false,
  },
  default: {
    paths: [],
    Header: Header,
    Footer: Footer,
    BottomNav: BottomNavigationBike, // Defaulting to Bike nav for now
    isTransparent: false,
  }
};

const getThemeForPath = (pathname: string) => {
  if (THEME_CONFIG.bike.paths.some(p => pathname.startsWith(p))) return THEME_CONFIG.bike;
  if (THEME_CONFIG.sauna.paths.some(p => pathname.startsWith(p))) return THEME_CONFIG.sauna;
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
      try {
        const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'scrolled_like_a_maniac');
        newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
      } catch (error) {
        logger.error("[ClientLayout] Error unlocking achievement:", error);
        scrollAchievementUnlockedRef.current = false;
      }
    }
  }, [isAuthenticated, dbUser, addToast]);

  useEffect(() => {
    window.addEventListener('scroll', handleScrollForAchievement, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollForAchievement);
  }, [handleScrollForAchievement]);
  
  return null; 
}

function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const theme = getThemeForPath(pathname);
  const CurrentHeader = theme.Header;
  const CurrentFooter = theme.Footer;
  const CurrentBottomNav = theme.BottomNav;

  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true);
  
  const pathsToShowBottomNavForStartsWith = [ "/selfdev/gamified", "/p-plan", "/profile", "/hotvibes", "/leads", "/elon", "/god-mode-sandbox", "/rent", "/crews", "/leaderboard", "/admin", "/paddock", "/rentals", "/vipbikerental", "/sauna-rent" ];
  const showBottomNav = pathsToShowBottomNavForStartsWith.some(p => pathname?.startsWith(p)) || pathname === "/";
  
  useEffect(() => {
    setShowHeaderAndFooter(!(pathname === "/profile" || pathname === "/repo-xml"));
  }, [pathname]);

  const isTransparentPage = theme.isTransparent || [ '/rentals', '/crews', '/paddock', '/admin', '/leaderboard' ].some(p => pathname.startsWith(p));

  return (
    <>
      {showHeaderAndFooter && <CurrentHeader />}
        <main className={cn('flex-1', showBottomNav ? 'pb-20 sm:pb-0' : '', !isTransparentPage && 'bg-background')}>
            {children}
        </main>
      {showBottomNav && <CurrentBottomNav pathname={pathname} />}
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