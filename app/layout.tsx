import type React from "react";
import Script from "next/script";
import { Suspense } from 'react';
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyChatButton from "@/components/StickyChatButton";
import { AppProvider } from "@/contexts/AppContext";
import { Toaster } from "sonner"; // Corrected import if it's from sonner directly
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from 'next';
import { TooltipProvider } from "@/components/ui/tooltip";
import DevErrorOverlay from "@/components/DevErrorOverlay"; // <-- IMPORT THE NEW COMPONENT

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

// Define Metadata (WITHOUT viewport)
export const metadata: Metadata = {
  title: "V0 Car Test App",
  description: "Find your perfect V0 car.",
  // icons: { icon: '/favicon.ico' },
};

// Define Viewport separately
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
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
          // inter.className
      )}>
        {/* Wrap with TooltipProvider */}
        <TooltipProvider>
          {/* Wrap with AppProvider */}
          <AppProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            {/* StickyChatButton with Suspense */}
            <Suspense fallback={<LoadingChatButtonFallback />}>
              <StickyChatButton />
            </Suspense>
            <Footer />
            {/* Toaster for notifications */}
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
            {/* Development Error Overlay - Renders only in dev mode */}
            <DevErrorOverlay />
          </AppProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}