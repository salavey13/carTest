import type React from "react";
import Script from "next/script";
import { Suspense } from 'react'; // Removed useEffect
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyChatButton from "@/components/StickyChatButton";
import { AppProvider } from "@/contexts/AppContext";
import { Toaster as SonnerToaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip";
// Import ErrorOverlayProvider FIRST
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay";
// Removed logger import as useEffect is removed

// Fallback component remains the same
function LoadingChatButtonFallback() {
  return (
    <div
        className="fixed bottom-4 left-4 z-40 w-12 h-12 rounded-full bg-gray-700 animate-pulse"
        aria-hidden="true"
    ></div>
  );
}

// Static metadata and viewport exports are now safe again
export const metadata: Metadata = {
  title: "V0 Car Test App",
  description: "Find your perfect V0 car.",
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Removed logger call from here

  return (
    <html lang="en" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        {/* Wrap everything including AppProvider in ErrorOverlayProvider */}
        <ErrorOverlayProvider>
          <AppProvider>
            <TooltipProvider>
              <ErrorBoundaryForOverlay>
                <Header />
                <main className="flex-1">
                  {children}
                </main>
                {/* StickyChatButton now uses AppContext and ErrorOverlayContext */}
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
              {/* DevErrorOverlay uses ErrorOverlayContext */}
              <DevErrorOverlay />
            </TooltipProvider>
          </AppProvider>
        </ErrorOverlayProvider>
      </body>
    </html>
  );
}