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
  title: "VIP BIKE ELECTRO — Аренда электробайков в Нижнем Новгороде",
  description:
    "Хардкорная аренда электробайков и эндуро. От 6 000 ₽/сутки. Электро без категории А, шлем в комплекте, забронируй в боте за 2 минуты.",
  keywords:
    "аренда электробайка, электробайк Нижний Новгород, аренда эндуро, VIP Bike, мотоцикл аренда",
  openGraph: {
    title: "VIP BIKE ELECTRO — Аренда электробайков в Нижнем Новгороде",
    description:
      "Хардкорная аренда электробайков и эндуро. От 6 000 ₽/сутки. Электро без категории А, шлем в комплекте.",
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
