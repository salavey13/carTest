/**
 * VIP Bike Landing Page - Server Component
 *
 * Gold-on-black aesthetic, instant load, no client-side JS
 * Uses hardcoded bike data (6 bikes) with fixed pricing (от 6 000 ₽)
 *
 * Components:
 * - Hero: Main hero section with CTA
 * - SocialBanner: Social media links (VK, Instagram, Telegram)
 * - BikeShowcase: 6 featured bikes (Electric + ICE)
 * - Services: Rents, Sale, Configurator, Map
 * - HowItWorks: 4-step process (preserved from Max's design)
 * - FAQ: Frequently asked questions (preserved from Max's design)
 */

import { Hero } from "@/components/landing/Hero";
import { SocialBanner } from "@/components/landing/SocialBanner";
import { BikeShowcase } from "@/components/landing/BikeShowcase";
import { Services } from "@/components/landing/Services";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";

export const metadata = {
  title: "VIP BIKE ELECTRO — Аренда электробайков в Нижнем Новгороде",
  description:
    "Аренда электробайков и эндуро в Нижнем Новгороде. От 6 000 ₽/сутки. Электро без категории А, шлем в комплекте, забронируй в боте за 2 минуты.",
  keywords:
    "аренда электробайка, электробайк Нижний Новгород, аренда эндуро, VIP Bike, мотоцикл аренда",
  openGraph: {
    title: "VIP BIKE ELECTRO — Аренда электробайков",
    description:
      "Аренда электробайков и эндуро в Нижнем Новгороде. От 6 000 ₽/сутки.",
    url: "https://vipbikerental.ru",
    siteName: "VIP BIKE ELECTRO",
    images: [
      {
        url: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg",
        width: 1200,
        height: 630,
        alt: "VIP BIKE ELECTRO",
      },
    ],
    locale: "ru_RU",
    type: "website",
  },
};

export default function HomePage() {
  return (
    <>
      {/* Hero section */}
      <Hero />

      {/* Social banner (after hero, per design spec) */}
      <SocialBanner />

      {/* Services section */}
      <Services />

      {/* Bike showcase - 6 hardcoded bikes */}
      <BikeShowcase />

      {/* How it works - preserved from Max's design */}
      <HowItWorks />

      {/* FAQ - preserved from Max's design */}
      <FAQ />

      {/* Footer */}
      <Footer />
    </>
  );
}
