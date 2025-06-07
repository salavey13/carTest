"use client";

import type React from "react"; 
import { Suspense, useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
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
import { Analytics } from "@vercel/analytics/react"; // <--- Импорт Vercel Analytics
import { SpeedInsights } from "@vercel/speed-insights/next"; // <--- Импорт Vercel Speed Insights
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

// This is the component that will consume context and handle routing
function LayoutLogicController({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { startParamPayload, isLoading: isAppLoading, isAuthenticating } = useAppContext();

  useEffect(() => {
    // Wait for app context to be fully loaded and not authenticating
    if (!isAppLoading && !isAuthenticating) {
      if (startParamPayload && pathname === '/') {
        // If there's a startParam (nickname) and we are on the exact root path,
        // redirect to /<nickname_lowercase>
        // This assumes you have a dynamic route like app/[nickname]/page.tsx
        const targetPath = `/${startParamPayload.toLowerCase()}`;
        logger.info(`[ClientLayout Logic] Root path ('/') detected with startParamPayload '${startParamPayload}'. Redirecting to '${targetPath}'.`);
        router.replace(targetPath); // Use replace to avoid adding "/" to history
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
    // Add dynamic paths like /[nickname] if they should also have bottom nav
    // This regex checks if the path is a single segment (likely a nickname)
    // or if it's a nickname followed by / (e.g. /pavel/)
    // Note: This simple regex might need adjustment if your nickname patterns are more complex
    // or if you have other top-level routes that could be confused with nicknames.
  ];
  if (pathname && pathname.match(/^\/[^/]+(?:\/)?$/) && !pathsToShowBottomNavForStartsWith.some(p => pathname.startsWith(p)) && !pathsToShowBottomNavForExactMatch.includes(pathname)) {
    pathsToShowBottomNavForStartsWith.push(pathname); // Dynamically add nickname paths
  }

  const isExactMatch = pathsToShowBottomNavForExactMatch.includes(pathname ?? ''); // Handle null pathname
  const isStartsWithMatch = pathsToShowBottomNavForStartsWith.some(p => pathname?.startsWith(p)); // Handle null pathname
  
  const showBottomNav = isExactMatch || isStartsWithMatch;
  logger.debug(`[ClientLayout Logic] showBottomNav for "${pathname}" evaluated to: ${showBottomNav} (Exact: ${isExactMatch}, StartsWith: ${isStartsWithMatch})`);

  return (
    <>
      <Header />
      <main className={`flex-1 ${showBottomNav ? 'pb-20 sm:pb-0' : ''}`}> 
        {children}
      </main>
      {showBottomNav && <BottomNavigation pathname={pathname} />}
      <Suspense fallback={<LoadingChatButtonFallback />}>
        <StickyChatButton />
      </Suspense>
      <Footer />
    </>
  );
}

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  // The AppProvider should wrap any component that needs its context,
  // including the LayoutLogicController which uses useAppContext.
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
        <Analytics /> {/* <--- Vercel Analytics */}
        <SpeedInsights /> {/* <--- Vercel Speed Insights */}
      </AppProvider>
    </ErrorOverlayProvider>
  );
}