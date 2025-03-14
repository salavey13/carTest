import type React from "react";
import Script from "next/script";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AppProvider } from "@/contexts/AppContext";
import { Toaster } from "sonner";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <Script
          id="telegram-webapp"
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </head>
      <body className="bg-gray-900 text-white min-h-screen flex flex-col">
        <AppProvider>
          {/* Fixed Header */}
          <header className="fixed top-0 left-0 w-full z-50 bg-gray-900">
            <Header />
          </header>
          {/* Main content area with padding */}
          <main className="flex-grow pt-16 pb-16 overflow-y-auto">
            {children}
          </main>
          {/* Fixed Footer */}
          <footer className="fixed bottom-0 left-0 w-full z-50 bg-gray-900">
            <Footer />
          </footer>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: "rgba(34, 34, 34, 0.8)",
                color: "#00ff9d",
                border: "1px solid rgba(0, 255, 157, 0.4)",
                boxShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
                fontFamily: "monospace",
              },
            }}
          />
        </AppProvider>
      </body>
    </html>
  );
}

export const metadata = {
  generator: "v0.dev",
};
