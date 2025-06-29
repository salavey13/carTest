"use client";

import type React from "react"; 
import { Suspense, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation'; 
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyChatButton from "@/components/StickyChatButton";
import { AppProvider, useAppContext } from "@/contexts/AppContext"; 
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay";
import BottomNavigation from "@/components/layout/BottomNavigation";
import { debugLogger as logger } from "@/lib/debugLogger"; 
import { useFocusTimeTracker } from '@/hooks/useFocusTimeTracker'; 
import { Analytics } from "@vercel/analytics/react"; 
import { SpeedInsights } from "@vercel/speed-insights/next"; 
import { checkAndUnlockFeatureAchievement } from '@/hooks/cyberFitnessSupabase';
import { useAppToast } from "@/hooks/useAppToast";

function LoadingChatButtonFallback() {
  return (
    <div
        className="fixed bottom-16 left-4 z-40 w-12 h-12 rounded-full bg-gray-700 animate-pulse sm:bottom-4" 
        aria-hidden="true"
    ></div>
  );
}

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

// Карта для сопоставления startapp параметров с путями в приложении
const START_PARAM_PAGE_MAP: Record<string, string> = {
  "elon": "/elon",
  "musk_market": "/elon", // Альтернативный ключ для той же страницы
  "arbitrage_seeker": "/elon", // Может также вести на вкладку арбитража внутри /elon
  "topdf_psycho": "/topdf", // Ваш рабочий пример
  "settings": "/settings",
  "profile": "/profile",
  // Добавляйте другие страницы по мере необходимости
  // "some_other_feature": "/some-other-feature-path"
};

function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { startParamPayload, isLoading: isAppLoading, isAuthenticating } = useAppContext();
  const [showHeaderAndFooter, setShowHeaderAndFooter] = useState(true); // New state

  
  useEffect(() => {
    if (!isAppLoading && !isAuthenticating && startParamPayload) {
      const lowerStartParam = startParamPayload.toLowerCase();
      const targetPathFromMap = START_PARAM_PAGE_MAP[lowerStartParam];

      if (targetPathFromMap) {
        // Если ключ найден в карте, и мы еще не на этой странице
        if (pathname !== targetPathFromMap) {
          logger.info(`[ClientLayout Logic] startParamPayload '${startParamPayload}' mapped to '${targetPathFromMap}'. Redirecting from '${pathname}'.`);
          router.replace(targetPathFromMap);
        } else {
          logger.info(`[ClientLayout Logic] startParamPayload '${startParamPayload}' matched, already on target path '${targetPathFromMap}'. No redirect needed.`);
        }
      } else if (pathname === '/') { 
        // Если ключ не в карте, но мы на главной, используем старую логику (предполагая, что это никнейм)
        const nicknamePath = `/${lowerStartParam}`;
        logger.info(`[ClientLayout Logic] Root path ('/') detected with unmapped startParamPayload '${startParamPayload}'. Assuming nickname and redirecting to '${nicknamePath}'.`);
        router.replace(nicknamePath);
      } else {
        // Ключ не в карте и мы не на главной - ничего не делаем
        logger.info(`[ClientLayout Logic] startParamPayload '${startParamPayload}' not specifically mapped and not on root. No redirect for page mapping from current path '${pathname}'.`);
      }
    }
  }, [startParamPayload, pathname, router, isAppLoading, isAuthenticating]);

  const pathsToShowBottomNavForExactMatch = ["/", "/repo-xml"]; 
  const pathsToShowBottomNavForStartsWith = [
    "/selfdev/gamified", 
    "/p-plan", 
    "/profile",
    "/hotvibes",
    "/leads",
    "/elon", // Добавим /elon сюда, так как это важная страница
  ];
  // Динамическое добавление путей типа /[nickname]
  if (pathname && pathname.match(/^\/[^/]+(?:\/)?$/) && !pathsToShowBottomNavForStartsWith.some(p => pathname.startsWith(p)) && !pathsToShowBottomNavForExactMatch.includes(pathname)) {
    pathsToShowBottomNavForStartsWith.push(pathname); 
  }

  const isExactMatch = pathsToShowBottomNavForExactMatch.includes(pathname ?? ''); 
  const isStartsWithMatch = pathsToShowBottomNavForStartsWith.some(p => pathname?.startsWith(p)); 
  
  const showBottomNav = isExactMatch || isStartsWithMatch;
  logger.debug(`[ClientLayout Logic] showBottomNav for "${pathname}" evaluated to: ${showBottomNav} (Exact: ${isExactMatch}, StartsWith: ${isStartsWithMatch})`);

  
  useEffect(() => {
    if (pathname === "/profile" || pathname === "/repo-xml") { // Check if the current route is '/profile'
      setShowHeaderAndFooter(false); // Disable header and footer
    } else {
      setShowHeaderAndFooter(true); // Enable for all other paths
    }
  }, [pathname]); // Update state whenever pathname changes






  return (
    <>
      {showHeaderAndFooter && <Header />}
      <main className={`flex-1 ${showBottomNav ? 'pb-20 sm:pb-0' : ''}`}> 
        {children}
      </main>
      {showBottomNav && <BottomNavigation pathname={pathname} />}
      <Suspense fallback={<LoadingChatButtonFallback />}>
        <StickyChatButton />
      </Suspense>
      {showHeaderAndFooter && <Footer />}
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
            <LayoutLogicController>{children}</LayoutLogicController>
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
              className: 'text-sm',
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
