import type React from "react";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from 'next';
import { headers } from "next/headers";
import ClientLayout from "@/components/layout/ClientLayout";
import { Loading } from "@/components/Loading"; 
import { YandexMetrika } from "@/components/YandexMetrika";

// Static metadata content to be used by generateMetadata
const pageMetadataContent = {
  title: "oneSitePls | CyberVibe Studio",
  description: "Твоя dev-платформа для мгновенной прокачки и создания Web/Telegram приложений. Управляй AI, собирай код, становись кибер-магом!",
};

// Server-only function to generate metadata
export async function generateMetadata(): Promise<Metadata> {
  const hostname = (headers().get("host") || "").split(":")[0].toLowerCase();
  if (hostname === "rental.vip-bike.ru" || hostname === "www.rental.vip-bike.ru") {
    return {
      metadataBase: new URL("https://rental.vip-bike.ru"),
      title: "Аренда мотоциклов в Нижнем Новгороде | VIP BIKE",
      description:
        "Электромотоциклы и мотоциклы в аренду в Нижнем Новгороде. Выберите байк, даты и оставьте заявку менеджеру VIP BIKE.",
      alternates: {
        canonical: "/",
      },
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        type: "website",
        locale: "ru_RU",
        siteName: "VIP BIKE",
        title: "Аренда мотоциклов в Нижнем Новгороде | VIP BIKE",
        description:
          "Каталог электромотоциклов и мотоциклов в аренду. Бронирование через VIP BIKE.",
        url: "https://rental.vip-bike.ru/",
      },
    };
  }
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
    themeColor: [ 
      { media: '(prefers-color-scheme: light)', color: 'hsl(220 25% 98%)' }, 
      { media: '(prefers-color-scheme: dark)', color: 'hsl(263 80% 6%)' }, 
    ],
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const hostname = (headers().get("host") || "").split(":")[0].toLowerCase();
  const isVipBikeRentalHost =
    hostname === "rental.vip-bike.ru" || hostname === "www.rental.vip-bike.ru";
  return (
    <html lang="ru" className="h-full" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" type="image/png" />
        <link rel="manifest" href={isVipBikeRentalHost ? "/manifest.webmanifest" : "/manifest.json"} />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png"></link>
        {/* Updated msapplication-TileColor to match light theme background by default */}
        <meta name="msapplication-TileColor" content="hsl(220 25% 98%)"></meta>
        <Script
          id="theme-bootstrap-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var stored=localStorage.getItem("theme");var resolved=stored&&stored!=="system"?stored:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");d.classList.remove("light","dark");d.classList.add(resolved);d.style.colorScheme=resolved;}catch(e){}})();`,
          }}
        />
        <Script
          id="telegram-webapp-script"
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={cn(
          "flex min-h-screen flex-col bg-background text-foreground antialiased",
      )}>
        <Suspense fallback={null}>
          <YandexMetrika />
        </Suspense>
        <ClientLayout>
          <Suspense fallback={<Loading text="Загружаем..." />}>
            {children}
          </Suspense>
        </ClientLayout>
      </body>
    </html>
  );
}
