"use client";

import type React from "react";
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyChatButton from "@/components/StickyChatButton";
import { AppProvider } from "@/contexts/AppContext";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay";
import BottomNavigation from "@/components/layout/BottomNavigation";
import { debugLogger as logger } from "@/lib/debugLogger"; 

function LoadingChatButtonFallback() {
  return (
    <div
        className="fixed bottom-16 left-4 z-40 w-12 h-12 rounded-full bg-gray-700 animate-pulse sm:bottom-4" 
        aria-hidden="true"
    ></div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // logger.debug(`[ClientLayout] Current pathname: ${pathname}`);

  // Paths where BottomNavigation should be visible
  const pathsToShowBottomNavForExactMatch = ["/", "/repo-xml"]; // Exact matches
  const pathsToShowBottomNavForStartsWith = ["/selfdev/gamified", "/p-plan", "/profile"]; // StartsWith matches

  const isExactMatch = pathsToShowBottomNavForExactMatch.includes(pathname);
  const isStartsWithMatch = pathsToShowBottomNavForStartsWith.some(p => pathname.startsWith(p));
  
  const showBottomNav = isExactMatch || isStartsWithMatch;
  logger.debug(`[ClientLayout] showBottomNav for "${pathname}" evaluated to: ${showBottomNav} (Exact: ${isExactMatch}, StartsWith: ${isStartsWithMatch})`);


  return (
    <ErrorOverlayProvider>
      <AppProvider>
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
      </AppProvider>
    </ErrorOverlayProvider>
  );
}