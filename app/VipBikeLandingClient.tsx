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
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";

// Reuse existing feature components from vipbikerental
import { ConversionPilot } from "@/app/vipbikerental/features/ConversionPilot";
import { ElectroEnduroShowcase } from "@/app/vipbikerental/features/ElectroEnduroShowcase";
import { MapRidersLivePreview } from "@/app/vipbikerental/features/MapRidersLivePreview";
import { HowItWorksSection } from "@/app/vipbikerental/features/HowItWorksSection";
import { InvestSection } from "@/app/vipbikerental/features/InvestSection";
import { FaqSection } from "@/app/vipbikerental/features/FaqSection";
import { VipBikeCompanyServiceHub } from "@/app/vipbikerental/features/VipBikeCompanyServiceHub";

import { getSalePriceLabel } from "@/app/vipbikerental/features/shared/constants";

// Video background URL
const HERO_VIDEO_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/2_5219998213838247718.mp4";

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

type HeroTabId = "rent" | "buy" | "map" | "electro";

interface HeroTab {
  id: HeroTabId;
  label: string;
  description: string;
  cta: string;
  href: string;
  priceLabel: string;
  priceNote: string;
  status: string;
  features: string[];
  icon: string;
}

// Canvas bolts animation component (can be re-enabled if needed)
function HeroBoltsCanvas() {
  return null; // Simplified - can be re-enabled if desired
}

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
  const [activeTab, setActiveTab] = useState<HeroTabId>("rent");
  const [videoLoaded, setVideoLoaded] = useState(false);

  const crewSlug = crew.slug || "vip-bike";
  const surface = crewPaletteForSurface(theme);

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

  // Calculate dynamic pricing from items
  const heroTabs = useMemo(() => {
    // Find rental items for pricing
    const rentalItems = items.filter(item => !item.category?.toLowerCase().includes("продажа") && !item.category?.toLowerCase().includes("sale"));
    
    const saleItems = items.filter(item =>
      item.category?.toLowerCase().includes("продажа") ||
      item.category?.toLowerCase().includes("sale") ||
      item.specs?.sale_price
    );

    // Calculate min rental price
    const minRentalPrice = rentalItems.length > 0
      ? Math.min(...rentalItems.map(item => Number(item.specs?.daily_price) || Number(item.price) || 0))
      : 4900;

    // Calculate min sale price
    const minSalePrice = saleItems.length > 0
      ? Math.min(...saleItems.map(item => Number(item.specs?.sale_price) || 0))
      : null;

    // Count active riders (mock for now, can be fetched from API)
    const activeRidersCount = "12+"; // Could be fetched from map-riders API

    return [
      {
        id: "rent",
        label: "Аренда",
        description: rentalItems.length > 0
          ? `${rentalItems.length} ${rentalItems.length === 1 ? 'байк' : rentalItems.length < 5 ? 'байка' : 'байков'} доступно`
          : "Премиальный прокат мотоциклов",
        cta: "Выбрать байк",
        href: `/franchize/${crewSlug}/arenda`,
        priceLabel: `от ${minRentalPrice.toLocaleString('ru-RU')} ₽`,
        priceNote: "в день",
        status: rentalItems.length > 0 ? "Свободен" : "Доступен",
        features: ["Экип включен", "ОСАГО включено"],
        icon: "::FaMotorcycle::",
      },
      ...(minSalePrice ? [{
        id: "buy" as HeroTabId,
        label: "Покупка",
        description: electroItems.length > 0 ? electroItems[0]?.title || "Электромотоциклы" : "79bike Falcon PRO",
        cta: "Конфигуратор",
        href: `/franchize/${crewSlug}/catalog`,
        priceLabel: getSalePriceLabel(minSalePrice),
        priceNote: saleItems.length > 1 ? "несколько моделей" : "в наличии",
        status: "В наличии",
        features: ["рассрочка", "доставка", "гарантия"],
        icon: "::FaShoppingCart::",
      }] : []),
      {
        id: "map" as HeroTabId,
        label: "Карта",
        description: "Живые маршруты и встречи",
        cta: "Открыть карту",
        href: `/franchize/${crewSlug}/map-riders`,
        priceLabel: activeRidersCount,
        priceNote: "райдеров сейчас",
        status: "Активно",
        features: ["маршруты", "встречи"],
        icon: "::FaMapLocationDot::",
      },
      {
        id: "electro" as HeroTabId,
        label: "Электро",
        description: "Без категории А",
        cta: "Изучить электро",
        href: `/franchize/${crewSlug}/electro-enduro`,
        priceLabel: "без ОСАГО",
        priceNote: "по правам B",
        status: "Законно",
        features: ["тип", "запас хода", "разгон"],
        icon: "::FaBolt::",
      },
    ];
  }, [items, crewSlug]);

  // Current tab data
  const currentTab = useMemo(() => {
    return heroTabs.find((tab) => tab.id === activeTab) || heroTabs[0];
  }, [activeTab, heroTabs]);

  // Find featured electro bike for the visual side
  const featuredBike = useMemo(() => {
    const electroItems = items.filter(item =>
      item.category?.toLowerCase().includes("electro") ||
      item.category?.toLowerCase().includes("electric") ||
      item.title?.toLowerCase().includes("79bike") ||
      item.title?.toLowerCase().includes("falcon")
    );
    return electroItems.find((item) =>
      item.title?.toLowerCase().includes("falcon")
    ) || electroItems[0] || null;
  }, [items]);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-200">
      {/* Simplified Video Background */}
      <div className="fixed inset-0 z-0 opacity-40">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          onLoadedData={() => setVideoLoaded(true)}
        >
          <source src={HERO_VIDEO_URL} type="video/mp4" />
        </video>
      </div>
      <div className="fixed inset-0 z-0 bg-gradient-to-br from-slate-950 via-slate-950 to-black" />

      {/* Main Content */}
      <main className="relative z-10">
        {/* Hero Section - Clean and Simple */}
        <section className="min-h-screen flex items-center justify-center px-4 py-20">
          <div className="max-w-6xl mx-auto w-full">
            {/* Brand Badge */}
            <div className="flex justify-center mb-8">
              <Badge
                variant="outline"
                className="px-4 py-2 text-sm font-semibold border-amber-400/50 bg-black/50 text-amber-400 backdrop-blur-md uppercase tracking-wider"
              >
                VIP BIKE · Электромотоциклы в Нижнем Новгороде
              </Badge>
            </div>

            {/* Main Heading */}
            <div className="text-center mb-12">
              <h1 className="font-archivo text-5xl md:text-7xl lg:text-8xl font-black uppercase text-white mb-6 leading-tight tracking-tight">
                Твой байк.
                <span className="block bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  {" "}С мощью{" "}
                </span>
                <span className="block text-3xl md:text-4xl lg:text-5xl font-semibold text-slate-300">
                  и тишиной.
                </span>
              </h1>
              <p className="font-onest text-lg md:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                Электромотоцикл без категории А. Законно по правам категории B. Без ОСАГО и ПТС.
                {" "}79bike: мощно, быстро, экологично — в любой точке города.
              </p>
            </div>

            {/* Hero Tabs - Static, no auto-cycle */}
            <div className="mb-12">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
                {heroTabs.map((tab) => (
                  <Link key={tab.id} href={tab.href}>
                    <div
                      className={cn(
                        "p-4 rounded-xl border transition-all cursor-pointer",
                        activeTab === tab.id
                          ? "border-amber-400/60 bg-amber-400/15"
                          : "border-white/10 bg-black/50 hover:border-amber-400/30"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <VibeContentRenderer content={currentTab.icon} className={cn(
                          "w-4 h-4",
                          activeTab === tab.id ? "text-amber-400" : "text-slate-400"
                      )} />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">{tab.label}</span>
                    </div>
                    <div className="text-lg md:text-xl font-bold text-white mb-1">{tab.priceLabel}</div>
                    <div className="text-xs text-slate-400">{tab.priceNote}</div>
                  </div>
                </Link>
                ))}
              </div>
            </div>

            {/* Active Tab Content - Simplified */}
            <div className="max-w-4xl mx-auto">
              <Card className="border border-white/10 bg-black/70 backdrop-blur-xl overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <div className="grid md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={cn(
                          "px-3 py-1 text-xs font-bold uppercase tracking-wider",
                          activeTab === "electro" ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-amber-400/50 text-amber-400 bg-amber-400/10"
                        )}>
                          {currentTab.status}
                        </Badge>
                        <span className="text-sm text-slate-400">{currentTab.description}</span>
                      </div>

                      {/* Price */}
                      <div>
                        <div className="text-3xl md:text-4xl font-bold text-white mb-1">
                          {currentTab.priceLabel}
                        </div>
                        <div className="text-sm text-slate-400">{currentTab.priceNote}</div>
                      </div>

                      {/* Features */}
                      <div className="flex flex-wrap gap-2">
                        {currentTab.features.map((feature) => (
                          <span
                            key={feature}
                            className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/10 text-white border border-white/20"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>

                      {/* CTA Button */}
                      <Button
                        asChild
                        size="lg"
                        className={cn(
                          "w-full font-semibold px-6 py-5 rounded-full",
                          "bg-amber-400 hover:bg-amber-300 text-slate-950",
                          "transition-all duration-300"
                        )}
                      >
                        <Link href={currentTab.href.replace("{slug}", crewSlug)} className="flex items-center gap-2">
                          {currentTab.cta}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </Button>
                    </div>

                    {/* Visual Side - Simplified */}
                    <div className="flex items-center justify-center">
                      {featuredBike && activeTab === "electro" ? (
                        <div className="relative w-full aspect-square max-w-sm">
                          <Image
                            src={featuredBike.imageUrl || "/placeholder-bike.png"}
                            alt={featuredBike.title || "79bike Falcon PRO"}
                            fill
                            className="object-contain drop-shadow-xl"
                          />
                        </div>
                      ) : (
                        <VibeContentRenderer content={currentTab.icon} className="w-24 h-24 text-amber-400" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Feature Pills - Simplified */}
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              {featurePills.map((pill) => (
                <div
                  key={pill.text}
                  className="flex items-center gap-3 px-5 py-3 rounded-full bg-black/40 border border-white/10 hover:bg-amber-400/10 hover:border-amber-400/30 transition-all duration-300"
                >
                  <VibeContentRenderer content={pill.icon} className="w-5 h-5 text-amber-400" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">{pill.text}</span>
                    <span className="text-xs text-slate-400">{pill.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Barrier Cards Section */}
        <section className="py-24 px-4 bg-gradient-to-b from-slate-950 to-slate-900">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 border-amber-400/50 text-amber-400 bg-amber-400/10">
                Почему VIP BIKE ELECTRO
              </Badge>
              <h2 className="font-orbitron text-3xl md:text-5xl font-bold text-white mb-4">
                Три барьера,{" "}
                <span className="text-amber-400">которые мы преодолели</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
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
                  <Card className="border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden group hover:border-amber-400/30 transition-all duration-500">
                    <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900">
                      <Image
                        src={card.image}
                        alt={card.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-amber-400/20 backdrop-blur-sm flex items-center justify-center border border-amber-400/30">
                          <VibeContentRenderer content={card.icon} className="w-5 h-5 text-amber-400" />
                        </div>
                        <span className="text-2xl font-orbitron font-bold text-white">{card.number}</span>
                      </div>
                    </div>
                    <CardContent className="p-6">
                      <h3 className="font-orbitron text-xl font-bold text-white mb-3">{card.title}</h3>
                      <p className="text-slate-400 text-sm leading-relaxed">{card.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Electro Showcase Section */}
        <section className="py-24 px-4 bg-slate-900">
          <div className="max-w-7xl mx-auto">
            <ElectroEnduroShowcase items={electroItems} crewSlug={crewSlug} />
          </div>
        </section>

        {/* Conversion Pilot Section */}
        <section className="py-24 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
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
        <section className="py-24 px-4 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            <MapRidersLivePreview crewSlug={crewSlug} />
          </div>
        </section>

        {/* Service Features */}
        <section className="py-24 px-4 bg-gradient-to-b from-slate-950 to-slate-900">
          <div className="max-w-7xl mx-auto">
            <VipBikeCompanyServiceHub crewSlug={crewSlug} />
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 px-4 bg-slate-900">
          <div className="max-w-7xl mx-auto">
            <HowItWorksSection items={items} crewSlug={crewSlug} />
          </div>
        </section>

        {/* Invest Section */}
        <section className="py-24 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
          <div className="max-w-7xl mx-auto">
            <InvestSection crewSlug={crewSlug} />
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 px-4 bg-slate-950">
          <div className="max-w-4xl mx-auto">
            <FaqSection crewSlug={crewSlug} />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-4 bg-gradient-to-b from-slate-950 to-black relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(217,154,0,0.1),transparent_70%)]" />
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <Badge variant="outline" className="mb-6 border-amber-400/50 text-amber-400 bg-amber-400/10">
                Готовы к выезду?
              </Badge>
              <h2 className="font-orbitron text-4xl md:text-6xl font-bold text-white mb-6">
                Начни свой{" "}
                <span className="bg-gradient-to-r from-amber-400 via-amber-400 to-amber-400 bg-clip-text text-transparent">
                  электро-путь
                </span>
                {" "}сегодня
              </h2>
              <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
                Выберите свой электромотоцикл, забронируйте слот и получите незабываемые впечатления.
                Законно, безопасно, экологично.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  asChild
                  size="lg"
                  className="font-orbitron font-semibold text-lg px-10 py-6 rounded-full bg-amber-400 text-slate-950 hover:bg-amber-400/90 shadow-lg shadow-amber-400/30 transition-all hover:scale-105"
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
                  className="font-orbitron font-semibold text-lg px-10 py-6 rounded-full border-amber-400/50 text-amber-400 hover:bg-amber-400/10 transition-all"
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
