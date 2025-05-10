"use client"; // Making RootLayout a client component to use usePathname

import type React from "react";
import Script from "next/script";
import { Suspense } from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyChatButton from "@/components/StickyChatButton";
import { AppProvider } from "@/contexts/AppContext";
import { Toaster as SonnerToaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay";
import { usePathname } from 'next/navigation';
import BottomNavigation from "@/components/layout/BottomNavigation";

function LoadingChatButtonFallback() {
  return (
    <div
        className="fixed bottom-4 left-4 z-40 w-12 h-12 rounded-full bg-gray-700 animate-pulse"
        aria-hidden="true"
    ></div>
  );
}

// Static metadata content to be used by generateMetadata
const pageMetadataContent = {
  title: "Fix13min PREMIUM",
  description: "Твоя 13-минутная фитнес-революция. Level UP",
};

// Server-only function to generate metadata
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: pageMetadataContent.title,
    description: pageMetadataContent.description,
    // Add other metadata like openGraph, icons etc. here if needed
    // e.g., openGraph: { title: pageMetadataContent.title, description: pageMetadataContent.description, ... }
  };
}

// Server-only function to generate viewport
export async function generateViewport(): Promise<Viewport> {
  return {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pathsToShowBottomNav = ["/", "/selfdev/gamified", "/repo-xml", "/p-plan", "/profile"];
  const showBottomNav = pathsToShowBottomNav.includes(pathname) || pathsToShowBottomNav.some(p => p !== "/" && pathname.startsWith(p));

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <Script
          id="telegram-webapp-script"
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={cn(
          "flex min-h-screen flex-col bg-gray-900 text-white antialiased",
      )}>
        <ErrorOverlayProvider>
          <AppProvider>
            <TooltipProvider>
              <ErrorBoundaryForOverlay>
                <Header />
                <main className="flex-1">
                  {children}
                </main>
                {showBottomNav && <BottomNavigation pathname={pathname} />} {/* Conditionally render BottomNavigation */}
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
      </body>
    </html>
  );
}