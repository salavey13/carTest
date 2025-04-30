import type React from "react";
import Script from "next/script";
import { Suspense } from 'react'; // Keep Suspense import
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyChatButton from "@/components/StickyChatButton";
import { AppProvider } from "@/contexts/AppContext";
import { Toaster as SonnerToaster } from "sonner"; // Renamed import to avoid naming conflict
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip";

// --- NEW IMPORTS for Error Handling ---
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay"; // Import the new overlay component
// ------------------------------------

// --- Fallback component for StickyChatButton ---
function LoadingChatButtonFallback() {
  return (
    <div
        className="fixed bottom-4 left-4 z-40 w-12 h-12 rounded-full bg-gray-700 animate-pulse"
        aria-hidden="true"
    ></div>
  );
}
// ------------------------------------------

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
        {/* --- Wrap everything with ErrorOverlayProvider --- */}
        <ErrorOverlayProvider>
          <TooltipProvider>
            <AppProvider>

              {/* --- ErrorBoundaryForOverlay Wraps main app content --- */}
              {/* It catches errors and sends them to the ErrorOverlayContext */}
              <ErrorBoundaryForOverlay>
                <Header />
                <main className="flex-1">
                  {children}
                </main>
                <Suspense fallback={<LoadingChatButtonFallback />}>
                  <StickyChatButton />
                </Suspense>
                <Footer />
              </ErrorBoundaryForOverlay>
              {/* --- End of ErrorBoundaryForOverlay Wrap --- */}

              {/* Sonner Toaster remains outside the boundary */}
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

              {/* --- DevErrorOverlay is placed here --- */}
              {/* It's INSIDE ErrorOverlayProvider to get context */}
              {/* It's OUTSIDE ErrorBoundaryForOverlay so it renders even if the boundary caught an error */}
              <DevErrorOverlay />

            </AppProvider>
          </TooltipProvider>
        </ErrorOverlayProvider> {/* --- Close ErrorOverlayProvider --- */}
      </body>
    </html>
  );
}