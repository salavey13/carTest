import type { Metadata } from "next"
import Script from "next/script"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "ChinaCarRent - Аренда Китайских Кибер-Каров в России",
  description: "Арендуйте китайские автомобили в России с помощью Telegram. Надежность, скорость и доступность в одном месте. Подпишитесь на премиум-функции!",
  generator: "v0.dev",
  applicationName: "ChinaCarRent",
  keywords: ["аренда автомобилей", "китайские автомобили", "Telegram аренда", "кибер-кары", "Россия", "премиум подписка"],
  authors: [{ name: "Your Name", url: "https://v0.dev/chat/cartest-tupabase-template-hdQdrfzkTFA" }],
  creator: "v0.dev",
  publisher: "v0.dev",
  robots: "index, follow",
  openGraph: {
    type: "website",
    url: "https://v0.dev/chat/cartest-tupabase-template-hdQdrfzkTFA",
    title: "ChinaCarRent - Кибер-Аренда Автомобилей",
    description: "Аренда китайских кибер-каров в России через Telegram. Быстро, надежно, стильно.",
    siteName: "ChinaCarRent",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ChinaCarRent - Кибер-Аренда",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@YourTwitterHandle",
    creator: "@YourTwitterHandle",
    title: "ChinaCarRent - Аренда Кибер-Каров",
    description: "Аренда китайских автомобилей через Telegram в России.",
    image: "/og-image.jpg",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <Script
          id="telegram-webapp"
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="afterInteractive"
          onLoad={() => {
            if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
              (window as any).Telegram.WebApp.ready()
            }
          }}
        />
      </head>
      <body className="bg-gray-900 text-white min-h-screen flex flex-col">
        <Header />
        {children}
        <Footer />
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
      </body>
    </html>
  )
}
