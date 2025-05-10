import type React from "react";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from 'next';
import ClientLayout from "@/components/layout/ClientLayout"; // Новый импорт

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
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}