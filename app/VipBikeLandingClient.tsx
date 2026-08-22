"use client";

/**
 * VipBikeLandingClient.tsx
 * ========================
 * VIP BIKE ELECTRO Landing Page - Dynamic
 *
 * Premium landing page with data loaded from Supabase:
 * - Hero tabs with real pricing from catalog
 * - Featured bikes dynamically loaded
 * - Feature pills from crew metadata
 * - Clean, simple UX without excessive animations
 */

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM, FranchizeTheme, FranchizeCrewVM } from "@/app/franchize/actions";
import { crewPaletteWithCssVars, withAlpha } from "@/app/franchize/lib/theme";
import { FranchizeCatalogHero } from "@/app/franchize/components/FranchizeCatalogHero";

// Reuse existing feature components from vipbikerental
import { ConversionPilot } from "@/app/vipbikerental/features/ConversionPilot";
import { ElectroEnduroShowcase } from "@/app/vipbikerental/features/ElectroEnduroShowcase";
import { MapRidersLivePreview } from "@/app/vipbikerental/features/MapRidersLivePreview";
import { HowItWorksSection } from "@/app/vipbikerental/features/HowItWorksSection";
import { InvestSection } from "@/app/vipbikerental/features/InvestSection";
import { FaqSection } from "@/app/vipbikerental/features/FaqSection";
import { VipBikeCompanyServiceHub } from "@/app/vipbikerental/features/VipBikeCompanyServiceHub";

import { getSalePriceLabel } from "@/app/vipbikerental/features/shared/constants";

// Default feature pills (can be overridden by crew metadata)
const DEFAULT_FEATURE_PILLS = [
  { icon: "::FaBolt::", text: "Быстро", detail: "мощно, тихо, экологично" },
  { icon: "::FaClock::", text: "10 дней", detail: "на тест-драйв, деньги обратно" },
  { icon: "::FaCircleDollarToSlot::", text: "0 ₽", detail: "первичный взнос, рассрочка" },
];

const BARRIER_CARDS = [
  {
    id: "prohodimost",
    number: "01",
    icon: "::FaBolt::",
    title: "Поле, лес, грязь, лестницы",
    description:
      "Кочки, корни, песок, снег, подъёмы и спуски. Куда сам доберёшься — туда и заедешь. В обзорах «корни съел как нефиг нафиг», едет по кроссовой трассе наравне с бензином.",
    image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b1-prohodimost.jpeg",
  },
  {
    id: "razgon",
    number: "02",
    icon: "::FaBolt::",
    title: "Выстреливает из рогатки",
    description:
      "Электро-тяга бьёт мгновенно — без сцепления и передач. Проваливаешься в кресло как в суперкаре. Открутил ручку — и поехал, на максимум сразу.",
    image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b2-razgon.jpeg",
  },
  {
    id: "voda",
    number: "03",
    icon: "::FaShieldHalved::",
    title: "Топили в озере — едет",
    description:
      "Влагозащита по классу IP67. На тесте погружали в ледяное озеро — завёлся, год катается. Лужи, дождь, мокрая трава — без последствий.",
    image: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/b3-voda.jpeg",
  },
];

export function VipBikeLandingClient({
  crew,
  items,
  theme,
}: {
  crew: FranchizeCrewVM;
  items: CatalogItemVM[];
  theme: FranchizeTheme;
}) {
  const { dbUser } = useAppContext();
  const crewSlug = crew.slug || "vip-bike";
  const surface = crewPaletteWithCssVars(theme);

  // Extract feature pills from crew metadata or use defaults
  const featurePills = useMemo(() => {
    const pills = crew?.metadata?.franchize?.landing?.featurePills;
    return pills?.length ? pills : DEFAULT_FEATURE_PILLS;
  }, [crew?.metadata]);

  const electroItems = useMemo(() =>
    items.filter(item =>
      item.category?.toLowerCase().includes("electro") ||
      item.category?.toLowerCase().includes("electric") ||
      item.title?.toLowerCase().includes("79bike") ||
      item.title?.toLowerCase().includes("falcon")
    ),
    [items]
  );

  return (
    <div className="relative min-h-screen" style={surface.page}>
      {/* FranchizeCatalogHero - Replaces video hero */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <FranchizeCatalogHero crew={crew} slug={crewSlug} />
      </div>

      {/* Main Content */}
      <main className="relative z-10">
        {/* Barrier Cards Section */}
        <section
          className="py-24 px-4"
          style={{
            background: theme.isAuto
              ? "var(--franchize-bg-base)"
              : surface.page.backgroundColor,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <Badge
                variant="outline"
                className="mb-4"
                style={{
                  borderColor: theme.isAuto
                    ? "var(--franchize-accent-main)"
                    : theme.palette.accentMain,
                  color: theme.isAuto
                    ? "var(--franchize-accent-main)"
                    : theme.palette.accentMain,
                  backgroundColor: theme.isAuto
                    ? withAlpha("var(--franchize-accent-main)", 0.1)
                    : withAlpha(theme.palette.accentMain, 0.1),
                }}
              >
                Почему VIP BIKE ELECTRO
              </Badge>
              <h2
                className="font-orbitron text-3xl md:text-5xl font-bold mb-4"
                style={{ color: theme.isAuto ? "var(--franchize-text-primary)" : theme.palette.textPrimary }}
              >
                Три барьера,{" "}
                <span
                  style={{ color: theme.isAuto ? "var(--franchize-accent-main)" : theme.palette.accentMain }}
                >
                  которые мы преодолели
                </span>
              </h2>
              <p
                className="text-lg max-w-2xl mx-auto"
                style={{ color: theme.isAuto ? "var(--franchize-text-secondary)" : theme.palette.textSecondary }}
              >
                Мы тестировали 79bike Falcon PRO в реальных условиях. Город, traffic, проселок, снег, грязь, лёд —
                где угодно. Без пинков, без failures.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {BARRIER_CARDS.map((card, idx) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: idx * 0.2 }}
                >
                  <Card
                    className="border backdrop-blur-sm overflow-hidden group transition-all duration-500"
                    style={{
                      borderColor: theme.isAuto ? "var(--franchize-border-soft)" : theme.palette.borderSoft,
                      backgroundColor: theme.isAuto
                        ? withAlpha("var(--franchize-bg-card)", 0.4)
                        : withAlpha(theme.palette.bgCard, 0.4),
                    }}
                  >
                    <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900">
                      <Image
                        src={card.image}
                        alt={card.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div
                          className="w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center border"
                          style={{
                            backgroundColor: theme.isAuto
                              ? withAlpha("var(--franchize-accent-main)", 0.2)
                              : withAlpha(theme.palette.accentMain, 0.2),
                            borderColor: theme.isAuto
                              ? withAlpha("var(--franchize-accent-main)", 0.3)
                              : withAlpha(theme.palette.accentMain, 0.3),
                          }}
                        >
                          <VibeContentRenderer
                            content={card.icon}
                            className="w-5 h-5"
                            style={{ color: theme.isAuto ? "var(--franchize-accent-main)" : theme.palette.accentMain }}
                          />
                        </div>
                        <span
                          className="text-2xl font-orbitron font-bold"
                          style={{ color: theme.isAuto ? "var(--franchize-text-primary)" : "white" }}
                        >
                          {card.number}
                        </span>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <h3
                        className="font-orbitron text-xl font-bold mb-3"
                        style={{ color: theme.isAuto ? "var(--franchize-text-primary)" : "white" }}
                      >
                        {card.title}
                      </h3>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: theme.isAuto ? "var(--franchize-text-secondary)" : "rgba(255,255,255,0.7)" }}
                      >
                        {card.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Electro Showcase Section */}
        <section
          className="py-24 px-4"
          style={{
            background: theme.isAuto
              ? "var(--franchize-bg-card)"
              : theme.palette.bgCard,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <ElectroEnduroShowcase items={electroItems} crewSlug={crewSlug} />
          </div>
        </section>

        {/* Conversion Pilot Section */}
        <section
          className="py-24 px-4"
          style={{
            background: theme.isAuto
              ? "var(--franchize-bg-base)"
              : theme.palette.bgBase,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <ConversionPilot
              items={items}
              overview={null}
              isCatalogLoading={false}
              crewSlug={crewSlug}
            />
          </div>
        </section>

        {/* Map Riders Preview */}
        <section
          className="py-24 px-4"
          style={{
            background: theme.isAuto
              ? "var(--franchize-bg-card)"
              : theme.palette.bgCard,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <MapRidersLivePreview crewSlug={crewSlug} />
          </div>
        </section>

        {/* Service Features */}
        <section
          className="py-24 px-4"
          style={{
            background: theme.isAuto
              ? "var(--franchize-bg-base)"
              : theme.palette.bgBase,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <VipBikeCompanyServiceHub crewSlug={crewSlug} />
          </div>
        </section>

        {/* How It Works */}
        <section
          className="py-24 px-4"
          style={{
            background: theme.isAuto
              ? "var(--franchize-bg-card)"
              : theme.palette.bgCard,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <HowItWorksSection items={items} crewSlug={crewSlug} />
          </div>
        </section>

        {/* Invest Section */}
        <section
          className="py-24 px-4"
          style={{
            background: theme.isAuto
              ? "var(--franchize-bg-base)"
              : theme.palette.bgBase,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <InvestSection crewSlug={crewSlug} />
          </div>
        </section>

        {/* FAQ Section */}
        <section
          className="py-24 px-4"
          style={{
            background: theme.isAuto
              ? "var(--franchize-bg-card)"
              : theme.palette.bgCard,
          }}
        >
          <div className="max-w-4xl mx-auto">
            <FaqSection crewSlug={crewSlug} />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-4 relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${withAlpha(theme.isAuto ? "var(--franchize-accent-main)" : theme.palette.accentMain, 0.1)}, transparent 70%)`,
            }}
          />
          <div
            className="max-w-4xl mx-auto text-center relative z-10"
            style={{
              background: theme.isAuto
                ? "var(--franchize-bg-base)"
                : "linear-gradient(to bottom, #0f172a, black)",
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge
                variant="outline"
                className="mb-6"
                style={{
                  borderColor: theme.isAuto
                    ? "var(--franchize-accent-main)"
                    : "rgba(217, 154, 0, 0.5)",
                  color: theme.isAuto
                    ? "var(--franchize-accent-main)"
                    : "rgb(217, 154, 0)",
                  backgroundColor: theme.isAuto
                    ? withAlpha("var(--franchize-accent-main)", 0.1)
                    : "rgba(217, 154, 0, 0.1)",
                }}
              >
                Готовы к выезду?
              </Badge>
              <h2
                className="font-orbitron text-4xl md:text-6xl font-bold mb-6"
                style={{ color: theme.isAuto ? "var(--franchize-text-primary)" : "white" }}
              >
                Начни свой{" "}
                <span
                  className="bg-gradient-to-r from-amber-400 via-amber-400 to-amber-400 bg-clip-text text-transparent"
                  style={{ color: theme.isAuto ? "var(--franchize-accent-main)" : "rgb(217, 154, 0)" }}
                >
                  электро-путь
                </span>
                {" "}сегодня
              </h2>
              <p
                className="text-xl mb-10 max-w-2xl mx-auto"
                style={{ color: theme.isAuto ? "var(--franchize-text-secondary)" : "rgba(255,255,255,0.7)" }}
              >
                Выберите свой электромотоцикл, забронируйте слот и получите незабываемые впечатления.
                Законно, безопасно, экологично.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  asChild
                  size="lg"
                  className="font-orbitron font-semibold text-lg px-10 py-6 rounded-full transition-all hover:scale-105"
                  style={{
                    backgroundColor: theme.isAuto
                      ? "var(--franchize-accent-main)"
                      : "rgb(217, 154, 0)",
                    color: theme.isAuto
                      ? "var(--franchize-accent-text)"
                      : "rgb(2, 6, 23)",
                    boxShadow: `0 10px 15px -3px ${withAlpha(theme.isAuto ? "var(--franchize-accent-main)" : "rgb(217, 154, 0)", 0.3)}`,
                  }}
                >
                  <Link href="/vipbikerental" className="flex items-center gap-2">
                    Выбрать байк
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="font-orbitron font-semibold text-lg px-10 py-6 rounded-full transition-all"
                  style={{
                    borderColor: theme.isAuto
                      ? "var(--franchize-accent-main)"
                      : "rgba(217, 154, 0, 0.5)",
                    color: theme.isAuto
                      ? "var(--franchize-accent-main)"
                      : "rgb(217, 154, 0)",
                  }}
                >
                  <Link href="/franchize/vip-bike/configurator" className="flex items-center gap-2">
                    Конфигуратор
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
