/**
 * VIP Bike Electro Landing Page
 * Brutalist, high-end fitness studio aesthetic
 *
 * Pure Black (#050505), Neon Orange (#FF4500), Metallic Silver (#E0E0E0)
 * No rounded corners, grayscale images, bold uppercase typography
 *
 * Components:
 * - Hero: DOMINATE THE STREETS tagline
 * - SocialBanner: VK, IG, BOT, TG links
 * - BikeShowcase: Filtered by adrenaline/cruising/enduro
 * - TheCrew: Team profiles
 * - Services: rent/sale/configurator/map
 * - MemberStories: Rider transformations
 * - HowItWorks: 4 steps
 * - FAQ: Q&A
 * - Footer: Contact info
 */

import {
  Hero,
  SocialBanner,
  BikeShowcase,
  TheCrew,
  Services,
  MemberStories,
  HowItWorks,
  FAQ,
  Footer,
} from "@/components/landing/vip-bike";

export const metadata = {
  title: "VIP BIKE ELECTRO — Dominate the Streets",
  description:
    "Premium electro bike rental in Nizhny Novgorod. Adrenaline, cruising, enduro. From 6,000 ₽/day. No bullshit. Just ride.",
  keywords:
    "electro bike rental, electric motorcycle Nizhny Novgorod, enduro rental, VIP Bike, moto rental",
  openGraph: {
    title: "VIP BIKE ELECTRO — Dominate the Streets",
    description:
      "Premium electro bike rental in Nizhny Novgorod. Adrenaline, cruising, enduro. From 6,000 ₽/day.",
    type: "website",
    locale: "ru_RU",
  },
};

export default function VipBikeElectroPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#050505" }}>
      <Hero />
      <SocialBanner />
      <BikeShowcase />
      <TheCrew />
      <Services />
      <MemberStories />
      <HowItWorks />
      <FAQ />
      <Footer />
    </main>
  );
}
