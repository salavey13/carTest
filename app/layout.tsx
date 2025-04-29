import type React from "react";
import Script from "next/script";
import { Suspense } from 'react'; // Keep Suspense import
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyChatButton from "@/components/StickyChatButton";
import { AppProvider } from "@/contexts/AppContext";
import { Toaster } from "sonner"; // Ensure this path is correct for your setup
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip";

// --- NEW IMPORTS for Error Handling ---
import { ErrorOverlayProvider } from "@/contexts/ErrorOverlayContext";
import ErrorBoundaryForOverlay from "@/components/ErrorBoundaryForOverlay";
import DevErrorOverlay from "@/components/DevErrorOverlay";
// ------------------------------------

// --- Fallback component for StickyChatButton ---
// Displayed while the client-side hook useSearchParams resolves
function LoadingChatButtonFallback() {
  // Basic visual placeholder matching the FAB's likely position and size
  return (
    <div
        className="fixed bottom-4 left-4 z-40 w-12 h-12 rounded-full bg-gray-700 animate-pulse"
        aria-hidden="true"
    ></div>
  );
}
// ------------------------------------------

// Define Metadata (WITHOUT viewport)
export const metadata: Metadata = {
  title: "V0 Car Test App", // Update if necessary
  description: "Find your perfect V0 car.", // Update if necessary
  // Add other metadata like icons, openGraph, etc. if needed
  // icons: { icon: '/favicon.ico' },
};

// Define Viewport separately
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // Disable zoom
  userScalable: false, // Disable zoom
  // themeColor: '#000000', // Optional: Set theme color
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Basic meta tags */}
        <meta charSet="utf-8" />
        {/* Viewport is handled by the export above, but can keep for older browsers */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />

        {/* PWA / Mobile specific tags */}
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Add more head tags if needed: favicons, theme-color, etc. */}

        {/* Telegram Script */}
        <Script
          id="telegram-webapp-script"
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive" // Load early
        />
      </head>
      <body className={cn(
          "flex min-h-screen flex-col bg-gray-900 text-white antialiased",
          // Add font class here if you have one, e.g., inter.className
      )}>
        {/* --- WRAP WITH ERROR OVERLAY PROVIDER (OUTSIDE EVERYTHING) --- */}
        <ErrorOverlayProvider>
          {/* Wrap with TooltipProvider */}
          <TooltipProvider>
            {/* Wrap with AppProvider */}
            <AppProvider>

              {/* --- WRAP MAIN APP CONTENT WITH ERROR BOUNDARY --- */}
              {/* This catches errors within Header, children, Footer etc. */}
              <ErrorBoundaryForOverlay>
                <Header />
                <main className="flex-1">
                  {children} {/* Your page content goes here */}
                </main>
                {/* Wrap StickyChatButton in Suspense */}
                <Suspense fallback={<LoadingChatButtonFallback />}>
                  <StickyChatButton />
                </Suspense>
                <Footer />
              </ErrorBoundaryForOverlay>
              {/* ---------------------------------------------------- */}

              {/* Toaster remains outside the main ErrorBoundaryForOverlay */}
              {/* but inside AppProvider if it needs context (it doesn't usually) */}
              <Toaster
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

              {/* DevErrorOverlay Component */}
              {/* Renders based on context state from ErrorOverlayProvider */}
              {/* MUST be outside ErrorBoundaryForOverlay to render when boundary catches */}
              {/* but INSIDE ErrorOverlayProvider to access the context */}
              <DevErrorOverlay />

            </AppProvider>
          </TooltipProvider>
        </ErrorOverlayProvider> {/* --- CLOSE ERROR OVERLAY PROVIDER --- */}
      </body>
    </html>
  );
}