// /components/layout/ClientLayout.tsx
"use client";

import type React from "react"; 
import { Suspense, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
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
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
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

  useEffect(() => {
    const handleScroll = async () => {
      if (isAuthenticated && dbUser?.user_id && window.scrollY > 1000 && !scrollAchievementUnlockedRef.current) {
        scrollAchievementUnlockedRef.current = true; // Prevent multiple triggers
        logger.info(`[ClientLayout ScrollAch] User ${dbUser.user_id} scrolled >1000px. Unlocking 'scrolled_like_a_maniac'.`);
        const { newAchievements } = await checkAndUnlockFeatureAchievement(dbUser.user_id, 'scrolled_like_a_maniac');
        newAchievements?.forEach(ach => {
            addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description });
            logger.info(`[ClientLayout ScrollAch] CyberFitness: Unlocked achievement '${ach.name}' for user ${dbUser.user_id}`);
        });
        window.removeEventListener('scroll', handleScroll); // Remove listener after unlocking
      }
    };

    if (isAuthenticated && dbUser?.user_id && !scrollAchievementUnlockedRef.current) {
      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isAuthenticated, dbUser, addToast]);
  
  return null; 
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const pathsToShowBottomNavForExactMatch = ["/", "/repo-xml"]; 
  const pathsToShowBottomNavForStartsWith = ["/selfdev/gamified", "/p-plan", "/profile"]; 

  const isExactMatch = pathsToShowBottomNavForExactMatch.includes(pathname);
  const isStartsWithMatch = pathsToShowBottomNavForStartsWith.some(p => pathname.startsWith(p));
  
  const showBottomNav = isExactMatch || isStartsWithMatch;
  logger.debug(`[ClientLayout] showBottomNav for "${pathname}" evaluated to: ${showBottomNav} (Exact: ${isExactMatch}, StartsWith: ${isStartsWithMatch})`);

  return (
    <ErrorOverlayProvider>
      <AppProvider> 
        <AppInitializers /> 
        <TooltipProvider>
          <ErrorBoundaryForOverlay>
            <Header />
            <main className={`flex-1 ${showBottomNav ? 'pb-20 sm:pb-0' : ''}`}> 
              {children}
            </main>
            {showBottomNav && <BottomNavigation pathname={pathname} />}
            <Suspense fallback={<LoadingChatButtonFallback />}>
              <StickyChatButton />
            </Suspense>
            <Footer />
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