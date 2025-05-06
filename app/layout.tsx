"use client";

import type React from "react";
import Script from "next/script";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StickyChatButton from "@/components/StickyChatButton"; // Import the button
import { AppProvider } from "@/contexts/AppContext";
import { Toaster } from "sonner"; // Assuming sonner is used for toasts
import "./globals.css";
import { cn } from "@/lib/utils"; // Utility for class names

export const metadata = {
  title: "Fit10min PREMIUM", // Updated title
  description: "Твоя 10-минутная фитнес-революция. Тренировки, питание, прогресс.", // Updated description
  // Add viewport settings for responsiveness and disabling zoom
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full"> {/* Ensure html takes full height */}
      <head>
        {/* Prevent iOS auto-detection of phone numbers */}
        <meta name="format-detection" content="telephone=no" />
        {/* Hint for Android to treat as a web app */}
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Telegram WebApp script, loaded early */}
        <Script
          id="telegram-webapp-script" // Renamed ID for clarity
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive" // Load before Next.js hydrates
          // Optional: Add error handling if script fails to load
          // onError={(e) => console.error("Failed to load Telegram WebApp script:", e)}
        />
      </head>
      {/* Apply base styling to body, ensure flex column layout and min height */}
      <body className={cn(
          "flex min-h-screen flex-col bg-gray-900 text-white antialiased",
          // Add font definitions if needed, e.g., using next/font
          // inter.className
      )}>
        <AppProvider>
          {/* Header: Sticky or fixed positioning might be handled within the Header component itself */}
          <Header />

          {/* Main content area that grows to fill available space */}
          <main className="flex-1">
            {children}
          </main>

          {/* Sticky Chat Button - Placed outside main, might need specific positioning CSS */}
          <StickyChatButton />

          {/* Footer */}
          <Footer />

          {/* Toast notifications configuration */}
          <Toaster
            position="bottom-right" // Common position
            richColors // Use predefined color schemes if available
            toastOptions={{
              style: { // Custom styling for toasts
                background: "rgba(34, 34, 34, 0.9)", // Slightly transparent dark background
                color: "#00FF9D", // Neon green text
                border: "1px solid rgba(0, 255, 157, 0.4)", // Subtle neon border
                boxShadow: "0 2px 10px rgba(0, 255, 157, 0.2)", // Softer glow effect
                fontFamily: "monospace", // Monospace font for consistency
              },
              className: 'text-sm', // Adjust font size
            }}
          />
        </AppProvider>
      </body>
    </html>
  );
}