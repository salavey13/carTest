import type React from "react";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from 'next';
import ClientLayout from "@/components/layout/ClientLayout"; // Новый импорт

// Static metadata content to be used by generateMetadata
const pageMetadataContent = {
  title: "oneSitePls | CyberVibe Studio",
  description: "Твоя dev-платформа для мгновенной прокачки и создания Web/Telegram приложений. Управляй AI, собирай код, становись кибер-магом!",
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
    themeColor: [ // Add theme color for PWA consistency
      { media: '(prefers-color-scheme: light)', color: '#f5f5f5' }, // Example light theme color
      { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' }, // Example dark theme color (matches bg-gray-950)
    ],
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <head>
        <meta charSet="utf-8" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="/manifest.json" /> 
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png"></link>
        <meta name="msapplication-TileColor" content="#0A0A0A"></meta>
        <Script
          id="telegram-webapp-script"
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={cn(
          "flex min-h-screen flex-col bg-gray-950 text-white antialiased", // Changed to bg-gray-950
      )}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}