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
"use client";

import {
  Hero,
  SocialBanner,
  BikeShowcase,
  Services,
  Pricing,
  MemberStories,
  HowItWorks,
  FAQ,
  Footer,
} from "@/components/landing/vip-bike";
import { RomanQuestCake } from "@/components/roman-gift/RomanQuestCake";

export default function VipBikeElectroPage() {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#050505" }}>
      <Hero />
      <SocialBanner />
      <BikeShowcase />
      <Services />
      <Pricing />
      <MemberStories />
      <HowItWorks />
      <FAQ />
      <Footer />

      {/* task154: secret birthday quest — stop 2/3 (Roman only, hidden corner cake) */}
      <RomanQuestCake
        stop={2}
        riddle="Отличный нюх! Второй след: табло, где день экипажа виден целиком — золото на тёмном, аренды, продажи и смены. Сегодняшний день."
        nextHref="/vip-bike-dashboard"
        nextLabel="К табло экипажа"
      />
    </main>
  );
}
