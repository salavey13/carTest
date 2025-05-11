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
import { debugLogger as logger } from "@/lib/debugLogger"; // Import logger

function LoadingChatButtonFallback() {
  return (
    <div
        className="fixed bottom-16 left-4 z-40 w-12 h-12 rounded-full bg-gray-700 animate-pulse sm:bottom-4" // Adjusted bottom for mobile due to nav bar
        aria-hidden="true"
    ></div>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  logger.debug(`[ClientLayout] Current pathname: ${pathname}`);

  // Paths where BottomNavigation should be visible
  const pathsToShowBottomNav = ["/", "/selfdev/gamified", "/repo-xml", "/p-plan", "/profile"];
  const showBottomNav = pathsToShowBottomNav.includes(pathname) || pathsToShowBottomNav.some(p => p !== "/" && pathname.startsWith(p + "/")); // Ensure subpaths are caught correctly
  logger.debug(`[ClientLayout] showBottomNav evaluated to: ${showBottomNav}`);


  return (
    <ErrorOverlayProvider>
      <AppProvider>
        <TooltipProvider>
          <ErrorBoundaryForOverlay>
            <Header />
            <main className={`flex-1 ${showBottomNav ? 'pb-20 sm:pb-0' : ''}`}> {/* Add padding-bottom if nav is shown */}
              {children}
            </main>
            {showBottomNav && <BottomNavigation pathname={pathname} />}
            {/* StickyChatButton is now rendered conditionally or with adjusted position by BottomNav */}
            {/* The Suspense and StickyChatButton might need review if BottomNav is always present */}
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