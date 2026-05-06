"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { BikeShowcase } from "@/components/BikeShowcase";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM } from "@/app/franchize/actions";
import {
  DEFAULT_COLOR_OPTIONS,
  DEFAULT_CONFIG_OPTIONS,
  resolveBuyColorOptions,
  resolveBuyConfigOptions,
} from "@/app/franchize/lib/sale-config";

type ServiceItem = { icon: string; text: string };

type HeroMode = "rent" | "buy" | "map" | "rentals";

type MapRidersOverview = {
  stats?: {
    activeRiders?: number;
    meetupCount?: number;
    totalWeeklyDistanceKm?: number;
  };
  liveLocations?: Array<{
    lat?: number;
    lng?: number;
    speed_kmh?: number;
    updated_at?: string;
    user_id?: string;
  }>;
  meetups?: Array<{
    lat?: number;
    lng?: number;
    title?: string;
    comment?: string;
    scheduled_at?: string;
  }>;
  latestCompleted?: Array<{
    rider_name?: string;
    total_distance_km?: number;
    duration_seconds?: number;
    avg_speed_kmh?: number;
    max_speed_kmh?: number;
  }>;
};

type HeroPanel = {
  mode: HeroMode;
  label: string;
  icon: string;
  eyebrow: string;
  title: string;
  description: string;
  imageUrl?: string;
  href: string;
  cta: string;
  meta: Array<{ label: string; value: string }>;
};

const formatCompactNumber = (value: number | undefined, fallback: number) =>
  Number(value ?? fallback).toLocaleString("ru-RU", { maximumFractionDigits: 1 });

const fallbackHeroPanels: Record<HeroMode, HeroPanel> = {
  rent: {
    mode: "rent",
    label: "Аренда",
    icon: "::FaMotorcycle::",
    eyebrow: "Горячий слот сегодня",
    title: "VIP Bike Electro-Enduro S1",
    description: "Лучший старт для первого выезда: обслуженный байк, экип и поддержка на маршруте.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg",
    href: "/franchize/vip-bike",
    cta: "Выбрать байк",
    meta: [
      { label: "от", value: "4 900 ₽ / день" },
      { label: "статус", value: "Свободен" },
      { label: "включено", value: "Экип + ОСАГО" },
    ],
  },
  buy: {
    mode: "buy",
    label: "Покупка",
    icon: "::FaCartShopping::",
    eyebrow: "Мини-конфигуратор",
    title: "Собери свой электроэндуро",
    description: "Модель, батарея, цвет и допы — собери конфиг, а потом заверши заказ в franchize-корзине.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg",
    href: "/franchize/vip-bike/configurator",
    cta: "Конфигуратор",
    meta: [
      { label: "пакеты", value: "Standard / Long Range" },
      { label: "цвет", value: "Black / Lime" },
      { label: "финал", value: "Корзина" },
    ],
  },
  map: {
    mode: "map",
    label: "Карта",
    icon: "::FaMapLocationDot::",
    eyebrow: "MapRiders live",
    title: "Райдеры, маршруты и встречи",
    description: "Смотри активность комьюнити, ближайшие точки сбора и недельный прогресс прямо перед выездом.",
    href: "/franchize/vip-bike/map-riders",
    cta: "Открыть карту",
    meta: [
      { label: "онлайн", value: "3 райдера" },
      { label: "маршруты", value: "речные точки" },
      { label: "встречи", value: "2 meetup" },
    ],
  },
  rentals: {
    mode: "rentals",
    label: "Мои аренды",
    icon: "::FaTicket::",
    eyebrow: "Личный контроль",
    title: "Проверь активные сделки",
    description: "Статусы, подтверждения, фото до/после и возврат — всё собрано в контрольном центре аренды.",
    href: "/rentals",
    cta: "Мои аренды",
    meta: [
      { label: "сценарий", value: "бронь → возврат" },
      { label: "документы", value: "в одном месте" },
      { label: "поддержка", value: "онлайн" },
    ],
  },
};

const InfoItem = ({ icon, children }: { icon: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3">
    <VibeContentRenderer content={icon} className="mt-1 flex-shrink-0 text-xl text-accent-text" />
    <p className="text-white/90">{children}</p>
  </div>
);

const StepItem = ({ num, title, icon, children }: { num: string; title: string; icon: string; children: React.ReactNode }) => (
  <div className="relative h-full w-full min-w-0 rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/20">
    <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-primary font-orbitron font-bold text-primary-foreground">
      {num}
    </div>
    <VibeContentRenderer content={icon} className="mx-auto my-4 text-4xl text-primary" />
    <h4 className="mb-2 font-orbitron text-lg">{title}</h4>
    <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
  </div>
);

const ServiceCard = ({
  title,
  icon,
  items,
  imageUrl,
  borderColorClass,
}: {
  title: string;
  icon: string;
  items: ServiceItem[];
  imageUrl?: string;
  borderColorClass?: string;
}) => (
  <Card className={cn("group relative overflow-hidden border bg-neutral-950/80 shadow-xl shadow-black/20", borderColorClass || "border-border/70")}>
    {imageUrl && (
      <Image
        src={imageUrl}
        alt={title}
        fill
        className="absolute inset-0 object-cover opacity-55 transition-opacity duration-300 group-hover:opacity-70"
      />
    )}
    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/10" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,170,90,0.18),transparent_52%)]" />
    <div className="relative flex h-full flex-col p-6">
      <CardHeader className="mb-4 p-0">
        <CardTitle className={cn("flex items-center gap-3 text-2xl text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.55)]", borderColorClass?.replace("border-", "text-"))}>
          <VibeContentRenderer content={icon} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4 p-0">
        {items.map((item, index) => (
          <InfoItem key={index} icon={item.icon}>
            {item.text}
          </InfoItem>
        ))}
      </CardContent>
    </div>
  </Card>
);

const rentalStatusSteps = [
  { label: "Выбор", value: "открыт", icon: "::FaMotorcycle::" },
  { label: "Экип", value: "готов", icon: "::FaHelmetSafety::" },
  { label: "Слот", value: "сегодня", icon: "::FaStopwatch::" },
];

const quickChooserFilters = [
  { id: "first", label: "Первый выезд", hint: "мягкая тяга" },
  { id: "range", label: "Дальше ехать", hint: "батарея +" },
  { id: "buy", label: "Купить", hint: "sale-ready" },
] as const;

const heroMetrics = [
  "::FaStopwatch:: Быстрая онлайн-бронь",
  "::FaShieldHeart:: ОСАГО + экип",
  "::FaMapLocationDot:: Центр выдачи в городе",
  "::FaHeadset:: Поддержка на маршруте",
];


const partnerLinks = [
  {
    name: "Каталог аренды VIP Bike",
    href: "/franchize/vip-bike",
    note: "Подбор электроэндуро по уровню, трассе и формату аренды.",
  },
  {
    name: "Конфигуратор электричек и заказ",
    href: "/franchize/vip-bike/configurator",
    note: "Актуальная конфигурация: модель → батарея → допы → корзина.",
  },
  {
    name: "MapRiders",
    href: "/franchize/vip-bike/map-riders",
    note: "Карта райдеров, маршруты и точки встречи.",
  },
  {
    name: "Личный раздел аренды",
    href: "/franchize/vip-bike/rentals",
    note: "Активные заказы, подтверждения, управление поездками.",
  },
];

const newbieFlow = [
  {
    step: "Шаг 1",
    title: "Старт с раздела и вводного гида",
    description: "Открой страницу заказа, прочитай вводный блок про локацию, маршруты и правила безопасности.",
    href: "/vipbikerental",
    cta: "Открыть вводный блок",
  },
  {
    step: "Шаг 2",
    title: "Выбор байка и конфигурации",
    description: "Перейди в конфигуратор: выбери модель, батарею, режим мощности и нужные допы.",
    href: "/franchize/vip-bike/electro-enduro",
    cta: "Подобрать конфиг",
  },
  {
    step: "Шаг 3",
    title: "Корзина и оформление",
    description: "Проверь заказ в корзине, добавь экип, подтверди данные и отправь заявку менеджеру.",
    href: "/franchize/vip-bike/profile",
    cta: "Проверить оформление",
  },
];

function StepsProgress({ items }: { items: CatalogItemVM[] }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const previewItems = useMemo(() => {
    const realItems = items.filter((item) => item.imageUrl || item.mediaUrls?.length).slice(0, 3);
    return realItems.length > 0 ? realItems : fallbackElectroItems.slice(0, 3);
  }, [items]);
  const activeStep = newbieFlow[activeStepIndex] ?? newbieFlow[0];

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">Пошагово для новичка: от информации к заказу</h2>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
          Теперь путь новичка работает как степпер: можно переключать этапы, увидеть конкретную визуализацию и перейти
          дальше только когда сценарий понятен.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/50 p-4 backdrop-blur-sm sm:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3" role="tablist" aria-label="Пошаговый сценарий новичка">
          {newbieFlow.map((step, index) => {
            const isActive = index === activeStepIndex;
            return (
              <button
                key={step.title}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveStepIndex(index)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all",
                  isActive ? "border-primary bg-primary/15 shadow-lg shadow-primary/10" : "border-border/70 bg-background/35 hover:border-primary/50",
                )}
              >
                <span className="text-xs uppercase tracking-[0.18em] text-primary">{step.step}</span>
                <span className="mt-1 block font-orbitron text-base">{step.title}</span>
                <span className="mt-2 block text-xs text-muted-foreground">{step.description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-background/60">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${((activeStepIndex + 1) / newbieFlow.length) * 100}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
            className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]"
          >
            <div className="rounded-2xl border border-border/70 bg-background/45 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-primary">{activeStep.step}</p>
              <h3 className="mt-2 font-orbitron text-2xl">{activeStep.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{activeStep.description}</p>
              <Button asChild className="mt-5 w-full sm:w-fit" variant={activeStepIndex === 0 ? "default" : "outline"}>
                <Link href={activeStep.href}>{activeStep.cta}</Link>
              </Button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              {activeStepIndex === 0 && (
                <div className="grid h-full gap-3 sm:grid-cols-3">
                  {["::FaMapLocationDot:: Локация", "::FaHelmetSafety:: Экип", "::FaShieldHeart:: Правила"].map((item) => (
                    <div key={item} className="flex min-h-[140px] items-center justify-center rounded-2xl border border-border/60 bg-card/60 p-4 text-center text-sm">
                      <VibeContentRenderer content={item} />
                    </div>
                  ))}
                </div>
              )}

              {activeStepIndex === 1 && (
                <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                  {previewItems.map((item) => {
                    const imageUrl = getBikeGallery(item)[0];
                    return (
                      <Link
                        key={item.id}
                        href={`/franchize/vip-bike?vehicle=${item.id}`}
                        className="min-w-[220px] snap-start overflow-hidden rounded-2xl border border-border/70 bg-card/60"
                      >
                        <div className="relative h-32 bg-black/30">
                          {imageUrl ? <Image src={imageUrl} alt={item.title} fill className="object-cover" /> : null}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
                        </div>
                        <div className="p-3">
                          <p className="font-orbitron text-sm">{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.rentPriceLabel || `${item.pricePerDay.toLocaleString("ru-RU")} ₽ / день`}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {activeStepIndex === 2 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Мини-корзина</p>
                    <p className="mt-2 font-orbitron text-lg">Байк + экип + слот</p>
                    <p className="mt-2 text-sm text-muted-foreground">Перед отправкой заявки пользователь видит состав заказа и может добавить защиту.</p>
                  </div>
                  <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-4 text-sm">
                    <VibeContentRenderer content="::FaCircleCheck:: Контакты подтверждены" />
                    <VibeContentRenderer content="::FaCircleCheck:: Дата и слот выбраны" />
                    <VibeContentRenderer content="::FaCircleCheck:: Менеджер получает заявку" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}


function RentalQuickActionHub({ items, overview }: { items: CatalogItemVM[]; overview: MapRidersOverview | null }) {
  const [selectedAction, setSelectedAction] = useState<"status" | "riders" | "chooser">("status");
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<(typeof quickChooserFilters)[number]["id"]>("first");

  const chooserItems = useMemo(() => {
    const availableItems = items.filter((item) => item.availabilityStatus === "available" || item.pricePerDay > 0);
    const saleItems = items.filter((item) => item.saleAvailable || isEnabled(item.rawSpecs?.sale));
    const source = activeFilter === "buy" && saleItems.length > 0 ? saleItems : availableItems.length > 0 ? availableItems : items;
    return (source.length > 0 ? source : fallbackElectroItems).slice(0, 3);
  }, [activeFilter, items]);

  const leadItem = chooserItems[0];
  const activeRiders = formatCompactNumber(overview?.stats?.activeRiders, overview?.liveLocations?.length || fallbackMapLocations.length);
  const meetupCount = formatCompactNumber(overview?.stats?.meetupCount, overview?.meetups?.length || fallbackMeetups.length);
  const weeklyDistance = formatCompactNumber(overview?.stats?.totalWeeklyDistanceKm, 127);

  const actionCards = [
    {
      id: "status" as const,
      title: "Статус аренды",
      icon: "::FaTicket::",
      metric: "3 шага",
      text: "Проверь, что уже закрыто перед поездкой: байк, экип и слот выдачи.",
      cta: "Открыть сделки",
      href: "/franchize/vip-bike/rentals",
    },
    {
      id: "riders" as const,
      title: "Райдеры рядом",
      icon: "::FaMapLocationDot::",
      metric: `${activeRiders} онлайн`,
      text: `За неделю комьюнити проехало ${weeklyDistance} км, активных встреч: ${meetupCount}.`,
      cta: "Открыть карту",
      href: "/franchize/vip-bike/map-riders",
    },
    {
      id: "chooser" as const,
      title: "Быстрый подбор",
      icon: "::FaBolt::",
      metric: leadItem?.title || "VIP Bike",
      text: "Открой мини-подбор прямо здесь: цель поездки → карточки байков → следующий шаг.",
      cta: "Подобрать байк",
      href: "/franchize/vip-bike",
    },
  ];

  const selectedCard = actionCards.find((card) => card.id === selectedAction) ?? actionCards[0];

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">Rental-флоу — живые действия вместо ссылок</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Быстрые карточки теперь не просто уводят в разделы: они показывают статус аренды, live-счётчик райдеров и мини-подбор байка прямо на лендинге.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-3" role="tablist" aria-label="Быстрые действия VIP Bike">
          {actionCards.map((card) => {
            const isActive = selectedAction === card.id;
            return (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedAction(card.id)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all",
                  isActive ? "border-primary bg-primary/15 shadow-lg shadow-primary/10" : "border-border/70 bg-card/55 hover:-translate-y-0.5 hover:border-primary/50",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-orbitron text-lg">
                    <VibeContentRenderer content={card.icon} className="text-primary" />
                    {card.title}
                  </span>
                  <span className="rounded-full border border-border/70 bg-background/55 px-3 py-1 text-xs text-muted-foreground">{card.metric}</span>
                </span>
                <span className="mt-2 block text-sm text-muted-foreground">{card.text}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-3xl border border-border/70 bg-card/55 p-4 backdrop-blur-sm sm:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedCard.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              className="min-h-[320px]"
            >
              {selectedCard.id === "status" && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">latest rental status</p>
                    <h3 className="mt-2 font-orbitron text-2xl">Готовность к выезду за один взгляд</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Если активной сделки ещё нет — блок работает как чеклист перед бронированием.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {rentalStatusSteps.map((step, index) => (
                      <div key={step.label} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <VibeContentRenderer content={step.icon} className="text-primary" />
                          <span className="text-xs text-muted-foreground">0{index + 1}</span>
                        </div>
                        <p className="mt-4 font-orbitron text-lg">{step.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{step.value}</p>
                      </div>
                    ))}
                  </div>
                  <Button asChild className="w-full sm:w-fit">
                    <Link href="/franchize/vip-bike/rentals">Проверить мои аренды</Link>
                  </Button>
                </div>
              )}

              {selectedCard.id === "riders" && (
                <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">live rider counter</p>
                    <h3 className="mt-2 font-orbitron text-2xl">{activeRiders} райдера онлайн</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Смотри активность перед стартом и решай: ехать соло или присоединиться к группе.</p>
                    <Button asChild variant="outline" className="mt-5 w-full sm:w-fit">
                      <Link href="/franchize/vip-bike/map-riders">Открыть MapRiders</Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "онлайн", value: activeRiders },
                      { label: "meetup", value: meetupCount },
                      { label: "за неделю", value: `${weeklyDistance} км` },
                      { label: "формат", value: "group ride" },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                        <p className="mt-2 font-orbitron text-xl">{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCard.id === "chooser" && (
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">quick bike chooser</p>
                    <h3 className="mt-2 font-orbitron text-2xl">Мини-подбор без ухода со страницы</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Выбери цель, посмотри 3 релевантные карточки и открой полную аренду или покупку.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickChooserFilters.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => setActiveFilter(filter.id)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-xs transition",
                          activeFilter === filter.id ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background/45 hover:border-primary/50",
                        )}
                      >
                        {filter.label} · {filter.hint}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button type="button" className="flex-1" onClick={() => setIsChooserOpen(true)}>
                      Открыть мини-подбор
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link href="/franchize/vip-bike">Весь каталог</Link>
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isChooserOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-bike-chooser-title"
            onClick={() => setIsChooserOpen(false)}
          >
            <motion.div
              className="max-h-[92dvh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/15 bg-background p-4 shadow-2xl sm:p-6"
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-primary">мини-подбор</p>
                  <h3 id="quick-bike-chooser-title" className="mt-1 font-orbitron text-2xl">Быстрый выбор VIP Bike</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Подборка использует реальные карточки каталога, а при пустых данных — безопасные демо-карточки.</p>
                </div>
                <button type="button" onClick={() => setIsChooserOpen(false)} className="rounded-full border border-border/70 px-3 py-1 text-sm hover:bg-card" aria-label="Закрыть мини-подбор">
                  ×
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {chooserItems.map((item) => {
                  const imageUrl = getBikeGallery(item)[0];
                  const buyHref = item.saleAvailable || isEnabled(item.rawSpecs?.sale) ? `/franchize/vip-bike/market/${item.id}/buy` : `/franchize/vip-bike?vehicle=${item.id}`;
                  return (
                    <article key={item.id} className="overflow-hidden rounded-2xl border border-border/70 bg-card/55">
                      <div className="relative h-44 bg-black/35">
                        {imageUrl ? <Image src={imageUrl} alt={item.title} fill className="object-cover" /> : null}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      </div>
                      <div className="space-y-3 p-4">
                        <div>
                          <h4 className="font-orbitron text-lg">{item.title}</h4>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.subtitle || item.description}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                            <p className="text-muted-foreground">Аренда</p>
                            <p className="mt-1 font-medium">{item.rentPriceLabel || `${item.pricePerDay.toLocaleString("ru-RU")} ₽ / день`}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-background/45 p-3">
                            <p className="text-muted-foreground">Покупка</p>
                            <p className="mt-1 font-medium">{item.saleAvailable || isEnabled(item.rawSpecs?.sale) ? getSalePriceLabel(item) : "тест-драйв"}</p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button asChild size="sm">
                            <Link href={`/franchize/vip-bike?vehicle=${item.id}`}>Арендовать</Link>
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link href={buyHref}>Подробнее</Link>
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

const mapRidersJourney = [
  {
    title: "Шаг 1: Найди точку старта",
    text: "Открой карту и выбери ближайшую точку сбора по времени и уровню сложности.",
  },
  {
    title: "Шаг 2: Проверь экип и маршрут",
    text: "Перед выездом отметь экип и дистанцию — так проще выбрать комфортную сессию.",
  },
  {
    title: "Шаг 3: Поехали с группой",
    text: "Присоединяйся к активной группе, отслеживай прогресс и отмечай пройденные участки.",
  },
];

const fallbackMapLocations = [
  { lat: 56.274, lng: 43.936, speed_kmh: 22, user_id: "fallback-rider-1" },
  { lat: 56.281, lng: 43.952, speed_kmh: 31, user_id: "fallback-rider-2" },
  { lat: 56.268, lng: 43.964, speed_kmh: 18, user_id: "fallback-rider-3" },
];

const fallbackMeetups = [
  { lat: 56.272, lng: 43.948, title: "Старт у речной точки", comment: "легкий темп" },
];

const clampPercent = (value: number) => Math.min(86, Math.max(10, value));

const normalizeMapPoint = (lat: number | undefined, lng: number | undefined, index: number) => {
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { left: 18 + index * 24, top: 28 + (index % 2) * 26 };
  }

  return {
    left: clampPercent(((lng - 43.91) / 0.09) * 100),
    top: clampPercent(100 - ((lat - 56.245) / 0.07) * 100),
  };
};

const formatRideDuration = (seconds: number | undefined) => {
  const safeSeconds = Math.max(0, Number(seconds || 0));
  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes || 18} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
};

function MapRidersLivePreview({ overview }: { overview: MapRidersOverview | null }) {
  const liveLocations = (overview?.liveLocations?.length ? overview.liveLocations : fallbackMapLocations).slice(0, 3);
  const meetups = (overview?.meetups?.length ? overview.meetups : fallbackMeetups).slice(0, 2);
  const latestRide = overview?.latestCompleted?.[0];
  const activeRiders = formatCompactNumber(overview?.stats?.activeRiders, liveLocations.length);
  const meetupCount = formatCompactNumber(overview?.stats?.meetupCount, meetups.length);
  const weeklyDistance = formatCompactNumber(overview?.stats?.totalWeeklyDistanceKm, 127);
  const speedPath = "M4 42 C18 34 24 18 38 28 C50 36 58 12 70 22 C82 30 88 18 96 10";

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">MapRiders — карта, которой реально хочется пользоваться</h2>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
          Мини-превью теперь показывает живой слой без тяжелой Leaflet-карты: райдеры, встреча, недельный прогресс и последняя поездка
          видны прямо на лендинге, а полный режим открывается одним кликом.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Link
          href="/franchize/vip-bike/map-riders"
          className="group relative min-h-[360px] overflow-hidden rounded-3xl border border-primary/30 bg-[#07100d] p-5 shadow-2xl shadow-black/25"
          aria-label="Открыть полную карту MapRiders"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,179,71,0.22),transparent_28%),radial-gradient(circle_at_72%_60%,rgba(34,197,94,0.20),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.06),transparent)]" />
          <div className="absolute inset-x-6 top-1/2 h-px rotate-[-12deg] bg-primary/60 shadow-[0_0_24px_rgba(255,170,80,0.75)]" />
          <div className="absolute left-10 right-8 top-[38%] h-px rotate-[8deg] bg-emerald-300/45 shadow-[0_0_18px_rgba(74,222,128,0.45)]" />
          <div className="absolute bottom-10 left-8 right-14 h-px rotate-[-4deg] bg-cyan-300/30 shadow-[0_0_18px_rgba(103,232,249,0.35)]" />

          {liveLocations.map((location, index) => {
            const point = normalizeMapPoint(location.lat, location.lng, index);
            return (
              <div
                key={location.user_id || `${location.lat}-${location.lng}-${index}`}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
                style={{ left: `${point.left}%`, top: `${point.top}%` }}
              >
                <span className="relative flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-black bg-primary" />
                </span>
                <span className="rounded-full border border-white/15 bg-black/55 px-2 py-1 text-[10px] text-white backdrop-blur-sm">
                  {Math.round(Number(location.speed_kmh || 0)) || 18} км/ч
                </span>
              </div>
            );
          })}

          {meetups.map((meetup, index) => {
            const point = normalizeMapPoint(meetup.lat, meetup.lng, index + 4);
            return (
              <div
                key={`${meetup.title || "meetup"}-${index}`}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brand-yellow/45 bg-black/60 px-3 py-2 text-xs text-white backdrop-blur-sm"
                style={{ left: `${point.left}%`, top: `${point.top}%` }}
              >
                <VibeContentRenderer content="::FaLocationDot::" className="mr-1 inline text-brand-yellow" />
                {meetup.title || "Точка встречи"}
              </div>
            );
          })}

          <div className="relative z-10 flex h-full min-h-[320px] flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-brand-yellow">live preview</p>
              <h3 className="mt-2 font-orbitron text-2xl text-white">Райдеры на карте прямо сейчас</h3>
              <p className="mt-2 max-w-md text-sm text-white/70">Клик по превью открывает полный MapRiders с GPS, meetup и лидербордом.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "онлайн", value: activeRiders },
                { label: "за неделю", value: `${weeklyDistance} км` },
                { label: "meetup", value: meetupCount },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/15 bg-black/45 p-3 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">{stat.label}</p>
                  <p className="mt-1 font-orbitron text-lg text-white">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </Link>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/60">
            <CardHeader>
              <CardTitle className="text-xl"><VibeContentRenderer content="::FaFlagCheckered:: Последняя поездка" /></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Райдер</p>
                  <p className="mt-1 font-medium">{latestRide?.rider_name || "VIP rider"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Дистанция</p>
                  <p className="mt-1 font-medium">{formatCompactNumber(latestRide?.total_distance_km, 24)} км</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Время</p>
                  <p className="mt-1 font-medium">{formatRideDuration(latestRide?.duration_seconds)}</p>
                </div>
              </div>
              <svg viewBox="0 0 100 48" className="h-24 w-full rounded-2xl border border-border/60 bg-background/40 p-3" role="img" aria-label="Мини график скорости последней поездки">
                <path d={speedPath} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary drop-shadow-[0_0_8px_rgba(255,170,80,0.65)]" />
                <path d="M4 42 L96 42" stroke="currentColor" strokeWidth="1" className="text-muted-foreground/40" />
              </svg>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {mapRidersJourney.map((item) => (
              <Card key={item.title} className="border-border/70 bg-card/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{item.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const isEnabled = (value: unknown) => value === 1 || value === true || String(value).toLowerCase() === "1" || String(value).toLowerCase() === "true";

const getSalePriceLabel = (item: Pick<CatalogItemVM, "salePrice">) =>
  item.salePrice ? `${item.salePrice.toLocaleString("ru-RU")} ₽` : "по запросу";

const getBikeGallery = (item: Pick<CatalogItemVM, "imageUrl" | "mediaUrls">) => {
  const urls = [item.imageUrl, ...(item.mediaUrls ?? [])].filter(Boolean);
  return Array.from(new Set(urls));
};

type ElectroPreviewItem = Pick<
  CatalogItemVM,
  "id" | "title" | "subtitle" | "description" | "imageUrl" | "mediaUrls" | "pricePerDay" | "rentPriceLabel" | "category" | "saleAvailable" | "salePrice" | "specs" | "rawSpecs"
>;

const fallbackElectroItems: ElectroPreviewItem[] = [
  {
    id: "vip-s1-fallback",
    title: "VIP Bike Electro-Enduro S1",
    subtitle: "Test-ride friendly",
    description: "Универсальный электроэндуро для первого проката, речных маршрутов и быстрого знакомства с электрической тягой.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg",
    mediaUrls: [],
    pricePerDay: 4900,
    rentPriceLabel: "4 900 ₽ / день",
    category: "Electro-Enduro",
    saleAvailable: true,
    salePrice: 285000,
    specs: [
      { label: "Запас хода", value: "до 90 км" },
      { label: "Заряд", value: "3–4 часа" },
      { label: "Режим", value: "Eco / Sport" },
    ],
    rawSpecs: {},
  },
  {
    id: "vip-lr-fallback",
    title: "VIP Bike Long Range",
    subtitle: "Больше маршрута",
    description: "Версия для длинной прогулки: больше батареи, спокойный контроль и комфортный запас по дистанции.",
    imageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg",
    mediaUrls: [],
    pricePerDay: 6500,
    rentPriceLabel: "6 500 ₽ / день",
    category: "Electro-Enduro",
    saleAvailable: true,
    salePrice: 340000,
    specs: [
      { label: "Запас хода", value: "до 130 км" },
      { label: "Пакет", value: "Long Range" },
      { label: "Фокус", value: "туринг" },
    ],
    rawSpecs: {},
  },
];

function ElectroEnduroShowcase({ items }: { items: CatalogItemVM[] }) {
  const [selectedItem, setSelectedItem] = useState<ElectroPreviewItem | null>(null);
  const [selectedColorId, setSelectedColorId] = useState(DEFAULT_COLOR_OPTIONS[2]?.id ?? DEFAULT_COLOR_OPTIONS[0]?.id ?? "black");
  const [selectedConfigId, setSelectedConfigId] = useState(DEFAULT_CONFIG_OPTIONS[0]?.id ?? "standard");

  const electroItems = useMemo<ElectroPreviewItem[]>(() => {
    const realItems = items
      .filter((item) => {
        const haystack = `${item.title} ${item.subtitle} ${item.description} ${item.category}`.toLowerCase();
        return item.saleAvailable || isEnabled(item.rawSpecs?.sale) || /electro|электро|enduro|эндуро|e-moto|emoto/.test(haystack);
      })
      .slice(0, 8);

    return realItems.length > 0 ? realItems : fallbackElectroItems;
  }, [items]);

  const activePreview = selectedItem ?? electroItems[0];
  const colorOptions = useMemo(() => resolveBuyColorOptions(activePreview?.rawSpecs), [activePreview?.rawSpecs]);
  const configOptions = useMemo(() => resolveBuyConfigOptions(activePreview?.rawSpecs), [activePreview?.rawSpecs]);
  const selectedColor = colorOptions.find((color) => color.id === selectedColorId) ?? colorOptions[0];
  const selectedConfig = configOptions.find((option) => option.id === selectedConfigId) ?? configOptions[0];
  const configuredPrice = activePreview?.salePrice ? activePreview.salePrice + (selectedConfig?.priceDelta ?? 0) : null;

  useEffect(() => {
    if (!colorOptions.some((color) => color.id === selectedColorId)) {
      setSelectedColorId(colorOptions[0]?.id ?? DEFAULT_COLOR_OPTIONS[0]?.id ?? "black");
    }
  }, [colorOptions, selectedColorId]);

  useEffect(() => {
    if (!configOptions.some((option) => option.id === selectedConfigId)) {
      setSelectedConfigId(configOptions[0]?.id ?? DEFAULT_CONFIG_OPTIONS[0]?.id ?? "standard");
    }
  }, [configOptions, selectedConfigId]);

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">Electro-Enduro: аренда + продажа в одном потоке</h2>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
          Реальные карточки из каталога теперь можно пролистать прямо здесь: увидеть фото, тариф, сценарий аренды/покупки
          и открыть быстрый просмотр с мини-конфигурацией без ухода со страницы.
        </p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-primary/30 bg-card/50 p-4 backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">живой горизонтальный слайдер</p>
            <h3 className="mt-1 font-orbitron text-2xl">Выбери электроэндуро и открой быстрый конфиг</h3>
          </div>
          <Button asChild variant="outline" className="sm:w-fit">
            <Link href="/franchize/vip-bike/electro-enduro">Полный раздел Electro-Enduro</Link>
          </Button>
        </div>

        <div className="flex snap-x gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
          {electroItems.map((item) => {
            const imageUrl = getBikeGallery(item)[0];

            return (
              <article
                key={item.id}
                className="group relative min-w-[280px] snap-start overflow-hidden rounded-2xl border border-border/70 bg-background/50 shadow-xl shadow-black/10 sm:min-w-[340px]"
              >
                <div className="relative h-52 bg-black/40">
                  {imageUrl ? (
                    <Image src={imageUrl} alt={item.title} fill className="object-cover opacity-85 transition duration-300 group-hover:scale-105 group-hover:opacity-100" />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,170,80,0.25),transparent_55%)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <div className="absolute bottom-3 left-3 rounded-full border border-white/25 bg-black/45 px-3 py-1 text-xs text-white backdrop-blur-sm">
                    {item.category || "Electro-Enduro"}
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <div>
                    <h4 className="font-orbitron text-lg text-foreground">{item.title}</h4>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.subtitle || item.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
                      <p className="text-muted-foreground">Аренда</p>
                      <p className="mt-1 font-orbitron text-sm text-foreground">{item.rentPriceLabel || `${item.pricePerDay.toLocaleString("ru-RU")} ₽ / день`}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
                      <p className="text-muted-foreground">Покупка</p>
                      <p className="mt-1 font-orbitron text-sm text-foreground">{item.saleAvailable ? getSalePriceLabel(item) : "тест-драйв"}</p>
                    </div>
                  </div>

                  <Button type="button" className="w-full" onClick={() => setSelectedItem(item)}>
                    Быстрый просмотр
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedItem && activePreview && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="electro-preview-title"
            onClick={() => setSelectedItem(null)}
          >
            <motion.div
              className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/15 bg-background p-4 shadow-2xl sm:p-6"
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="relative min-h-[300px] overflow-hidden rounded-2xl border border-border/70 bg-black/40">
                  {getBikeGallery(activePreview)[0] ? (
                    <Image src={getBikeGallery(activePreview)[0]} alt={activePreview.title} fill className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,170,80,0.28),transparent_58%)]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 rounded-full bg-brand-yellow px-3 py-1 font-orbitron text-xs text-black">{selectedColor?.label ?? "Цвет"}</div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-primary">быстрый просмотр</p>
                      <h3 id="electro-preview-title" className="mt-1 font-orbitron text-2xl">{activePreview.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{activePreview.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(null)}
                      className="rounded-full border border-border/70 px-3 py-1 text-sm hover:bg-card"
                      aria-label="Закрыть быстрый просмотр"
                    >
                      ×
                    </button>
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Цвет</p>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          onClick={() => setSelectedColorId(color.id)}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition",
                            selectedColor?.id === color.id ? "border-primary bg-primary text-primary-foreground" : "border-border/70 hover:bg-card",
                          )}
                        >
                          <span className="h-3 w-3 rounded-full border border-white/30" style={{ backgroundColor: color.hex }} />
                          {color.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Пакет</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {configOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedConfigId(option.id)}
                          className={cn(
                            "rounded-xl border p-3 text-left text-xs transition",
                            selectedConfig?.id === option.id ? "border-primary bg-primary/15" : "border-border/70 hover:bg-card",
                          )}
                        >
                          <span className="block font-orbitron text-sm">{option.label}</span>
                          <span className="mt-1 block text-muted-foreground">{option.priceDelta > 0 ? `+${option.priceDelta.toLocaleString("ru-RU")} ₽` : option.subtitle || "база"}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(activePreview.specs.length > 0 ? activePreview.specs.slice(0, 3) : [
                      { label: "Категория", value: activePreview.category },
                      { label: "Аренда", value: activePreview.rentPriceLabel },
                      { label: "Покупка", value: getSalePriceLabel(activePreview) },
                    ]).map((spec) => (
                      <div key={`${spec.label}-${spec.value}`} className="rounded-xl border border-border/70 bg-card/50 p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{spec.label}</p>
                        <p className="mt-1 text-sm font-medium">{spec.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Ваша конфигурация</p>
                    <p className="mt-1 font-orbitron text-lg">{activePreview.title} · {selectedColor?.label ?? "Цвет"} · {selectedConfig?.label ?? "Пакет"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {configuredPrice ? `${configuredPrice.toLocaleString("ru-RU")} ₽ ориентир покупки` : `${activePreview.rentPriceLabel} для тест-драйва`}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="flex-1">
                      <Link href={`/franchize/vip-bike/market/${activePreview.id}/buy`}>Открыть полный конфигуратор</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link href={`/franchize/vip-bike?vehicle=${activePreview.id}`}>Перейти к аренде</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function VipBikeRentalClient({ items }: { items: CatalogItemVM[] }) {
  const { dbUser } = useAppContext();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const [heroMode, setHeroMode] = useState<HeroMode>("rent");
  const [mapOverview, setMapOverview] = useState<MapRidersOverview | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/map-riders/overview?slug=vip-bike")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (isMounted && payload?.success) {
          setMapOverview(payload.data as MapRidersOverview);
        }
      })
      .catch(() => {
        if (isMounted) {
          setMapOverview(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const heroPanels = useMemo<Record<HeroMode, HeroPanel>>(() => {
    const rentItem = items.find((item) => item.availabilityStatus === "available" && item.pricePerDay > 0) ?? items.find((item) => item.pricePerDay > 0);
    const saleItem = items.find((item) => item.saleAvailable || isEnabled(item.rawSpecs?.sale));

    return {
      ...fallbackHeroPanels,
      rent: rentItem
        ? {
            ...fallbackHeroPanels.rent,
            title: rentItem.title,
            description: rentItem.description || fallbackHeroPanels.rent.description,
            imageUrl: getBikeGallery(rentItem)[0] || fallbackHeroPanels.rent.imageUrl,
            href: `/franchize/vip-bike?vehicle=${rentItem.id}`,
            meta: [
              { label: "аренда", value: rentItem.rentPriceLabel || `${rentItem.pricePerDay.toLocaleString("ru-RU")} ₽ / день` },
              { label: "статус", value: rentItem.availabilityLabel },
              { label: "категория", value: rentItem.category || "Electro-Enduro" },
            ],
          }
        : fallbackHeroPanels.rent,
      buy: saleItem
        ? {
            ...fallbackHeroPanels.buy,
            title: saleItem.title,
            description: saleItem.description || fallbackHeroPanels.buy.description,
            imageUrl: getBikeGallery(saleItem)[0] || fallbackHeroPanels.buy.imageUrl,
            href: `/franchize/vip-bike/market/${saleItem.id}/buy`,
            meta: [
              { label: "покупка", value: getSalePriceLabel(saleItem) },
              { label: "аренда", value: saleItem.rentPriceLabel || `${saleItem.pricePerDay.toLocaleString("ru-RU")} ₽ / день` },
              { label: "категория", value: saleItem.category || "Electro-Enduro" },
            ],
          }
        : fallbackHeroPanels.buy,
      map: {
        ...fallbackHeroPanels.map,
        meta: [
          { label: "онлайн", value: `${formatCompactNumber(mapOverview?.stats?.activeRiders, 3)} райдера` },
          { label: "за неделю", value: `${formatCompactNumber(mapOverview?.stats?.totalWeeklyDistanceKm, 127)} км` },
          { label: "встречи", value: `${formatCompactNumber(mapOverview?.stats?.meetupCount, 2)} meetup` },
        ],
      },
    };
  }, [items, mapOverview]);

  const activeHeroPanel = heroPanels[heroMode];

  const vibeProfile = useMemo(() => {
    const surveyResults = (dbUser?.metadata?.survey_results || {}) as Record<string, string>;
    const bikeStyle = surveyResults.bike_style || surveyResults.style || surveyResults.riding_style;

    if (!bikeStyle) {
      return {
        badge: "::FaCompass:: Универсальный подбор",
        title: "Подберем байк под ваш вайб за 2 минуты",
        note: "Пройди /start в Telegram, чтобы открыть персональные рекомендации на этой странице.",
      };
    }

    if (bikeStyle.toLowerCase().includes("спорт")) {
      return {
        badge: "::FaBolt:: Sport Vibe Detected",
        title: "Твой вайб: скорость и адреналин",
        note: "Рекомендуем начать с Supersport и быстрых слотов выдачи.",
      };
    }

    if (bikeStyle.toLowerCase().includes("ретро") || bikeStyle.toLowerCase().includes("neo")) {
      return {
        badge: "::FaWandSparkles:: Neo-Retro Mode",
        title: "Твой вайб: стиль и харизма",
        note: "Для тебя выделили neo-retro подборку с фото-ready маршрутами.",
      };
    }

    return {
      badge: "::FaRoute:: Rider Profile Active",
      title: `Твой вайб: ${bikeStyle}`,
      note: "Используй персональный фильтр в каталоге, чтобы быстрее выбрать байк.",
    };
  }, [dbUser?.metadata]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.14),transparent_35%),radial-gradient(circle_at_80%_20%,rgba(119,0,255,0.10),transparent_42%)]" />
      <div className="pointer-events-none fixed inset-0 z-[-3] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45),transparent_35%)]" />

      <section className="relative flex min-h-[760px] items-center justify-center overflow-hidden px-4 pb-14 pt-28 text-white sm:pt-32">
        <div className="absolute inset-0 z-0">
          <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover brightness-[0.5] saturate-125">
            <source
              src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/2_5219998213838247718.mp4"
              type="video/mp4"
            />
            Your browser does not support the video tag.
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-black/55" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_23%,rgba(255,106,0,0.25),transparent_42%)]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/45 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <VibeContentRenderer content="::FaBolt::" className="text-brand-yellow" />
            <span>VIPBIKE RENTAL ECOSYSTEM</span>
          </div>
          <div className="mb-5 w-full max-w-2xl rounded-2xl border border-white/20 bg-black/40 p-4 text-left text-sm text-white/90 backdrop-blur-sm">
            <div className="mb-1 font-medium text-brand-yellow"><VibeContentRenderer content={vibeProfile.badge} /></div>
            <p className="font-orbitron text-lg text-white">{vibeProfile.title}</p>
            <p className="mt-1 text-white/80">{vibeProfile.note}</p>
          </div>

          <h1 className="font-orbitron text-5xl font-black uppercase leading-[0.9] tracking-tight text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.75)] sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="block">Скорость. Контроль.</span>
            <span className="block text-brand-yellow">Твой путь на байке.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base font-light text-white/90 sm:text-lg md:text-xl">
            Премиальный прокат в Нижнем Новгороде: от первого выбора модели до возврата — всё организовано в одном
            потоке с онлайн-навигацией по аренде.
          </p>

          <div className="mt-9 w-full max-w-5xl rounded-3xl border border-white/20 bg-black/45 p-3 text-left shadow-2xl shadow-black/40 backdrop-blur-md sm:p-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="tablist" aria-label="VIP Bike quick scenario selector">
              {(Object.values(heroPanels) as HeroPanel[]).map((panel) => {
                const isActive = heroMode === panel.mode;

                return (
                  <button
                    key={panel.mode}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setHeroMode(panel.mode)}
                    className={cn(
                      "rounded-2xl border px-3 py-3 text-left transition-all duration-300",
                      isActive
                        ? "border-brand-yellow bg-brand-yellow text-black shadow-lg shadow-brand-yellow/25"
                        : "border-white/15 bg-white/5 text-white/75 hover:border-white/40 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.22em]">
                      <VibeContentRenderer content={panel.icon} />
                      {panel.label}
                    </span>
                    <span className="block font-orbitron text-sm sm:text-base">{panel.cta}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeHeroPanel.mode}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.24 }}
                className="mt-4 grid gap-4 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06] p-4 sm:grid-cols-[1.1fr_0.9fr] sm:p-5"
              >
                <div className="flex min-h-[260px] flex-col justify-between gap-5">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.22em] text-brand-yellow">
                      <VibeContentRenderer content={activeHeroPanel.icon} />
                      {activeHeroPanel.eyebrow}
                    </div>
                    <h2 className="font-orbitron text-2xl font-bold text-white sm:text-3xl">{activeHeroPanel.title}</h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/78 sm:text-base">{activeHeroPanel.description}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {activeHeroPanel.meta.map((item) => (
                      <div key={`${activeHeroPanel.mode}-${item.label}`} className="rounded-xl border border-white/15 bg-black/25 p-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">{item.label}</p>
                        <p className="mt-1 font-orbitron text-sm text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <Button asChild size="lg" variant={activeHeroPanel.mode === "rent" ? "accent" : "outline"} className="w-full font-orbitron sm:w-fit">
                    <Link href={activeHeroPanel.href} className="inline-flex items-center gap-2">
                      <VibeContentRenderer content={activeHeroPanel.icon} />
                      {activeHeroPanel.cta}
                    </Link>
                  </Button>
                </div>

                <div className="relative min-h-[260px] overflow-hidden rounded-2xl border border-white/15 bg-black/35">
                  {activeHeroPanel.imageUrl ? (
                    <Image src={activeHeroPanel.imageUrl} alt={activeHeroPanel.title} fill className="object-cover opacity-80" />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,210,80,0.30),transparent_32%),radial-gradient(circle_at_70%_65%,rgba(64,255,190,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.01))]" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/15 bg-black/50 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3 text-sm text-white/80">
                      <span>Интерактивный режим</span>
                      <span className="rounded-full bg-brand-yellow px-3 py-1 font-orbitron text-xs text-black">{activeHeroPanel.label}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
            {heroMetrics.map((chip) => (
              <div key={chip} className="rounded-xl border border-white/20 bg-black/35 px-3 py-2 text-sm text-white/90 backdrop-blur-sm">
                <VibeContentRenderer content={chip} />
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      <motion.section style={{ y }} className="relative">
        <BikeShowcase />
      </motion.section>

      <div className="container mx-auto max-w-7xl space-y-20 px-4 py-16 sm:space-y-24 sm:py-24">
        <section className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-orbitron text-2xl sm:text-3xl">Актуальность контента / партнёрских ссылок</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Раздел обновлён под новый franchize-поток: Electro-Enduro + Configurator + MapRiders.
                Последний аудит контента: <span className="font-medium text-foreground">04 мая 2026</span>.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/franchize/vip-bike/configurator">Начать с конфигуратора</Link>
            </Button>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {partnerLinks.map((item) => (
              <Card key={item.name} className="border-border/70 bg-background/40">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{item.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-muted-foreground">{item.note}</p>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href={item.href}>Открыть раздел</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <ElectroEnduroShowcase items={items} />

        <MapRidersLivePreview overview={mapOverview} />

        <section>
          <div className="mb-8 text-center">
            <h2 className="font-orbitron text-3xl sm:text-4xl">Экип и безопасность — отдельный блок перед стартом</h2>
            <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
              Перед арендой или покупкой сразу закрываем вопрос защиты: подбираем комплект под стиль катания и сезон.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              "::FaHelmetSafety:: Шлемы",
              "::FaHands:: Перчатки",
              "::FaShirt:: Джерси",
              "::FaShoePrints:: Ботинки",
              "::FaShield:: Черепахи",
              "::FaPersonRunning:: Колени",
              "::FaRoadBarrier:: Локти и защита корпуса",
              "::FaKitMedical:: Аптечка и расходники",
            ].map((item) => (
              <div key={item} className="rounded-xl border border-border/70 bg-card/60 px-3 py-3 text-sm">
                <VibeContentRenderer content={item} />
              </div>
            ))}
          </div>
        </section>

        <StepsProgress items={items} />

        <RentalQuickActionHub items={items} overview={mapOverview} />

        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          <ServiceCard
            title="Требования"
            icon="::FaClipboardList::"
            borderColorClass="border-secondary text-accent"
            imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/fon-8f9c72b7-c622-4159-98da-64173322eae4.jpg"
            items={[
              { icon: "::FaUserClock::", text: "Возраст от 23 лет" },
              { icon: "::FaIdCard::", text: "Паспорт и В/У категории 'А' (есть скутеры без 'А')" },
              { icon: "::FaAward::", text: "Залог от 20 000 ₽" },
              { icon: "::FaCreditCard::", text: "Оплата любым удобным способом" },
            ]}
          />
          <ServiceCard
            title="Что вы получаете"
            icon="::FaGift::"
            borderColorClass="border-accent text-accent"
            imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg"
            items={[
              { icon: "::FaCircleCheck::", text: "Полностью обслуженный и чистый мотоцикл" },
              { icon: "::FaFileSignature::", text: "Открытый полис ОСАГО" },
              { icon: "::FaUserShield::", text: "Полный комплект защитной экипировки" },
              { icon: "::FaTag::", text: "Скидка 10% на первую аренду по промокоду 'ЛЕТО2025'" },
            ]}
          />
          <ServiceCard
            title="Наши услуги"
            icon="::FaWrench::"
            borderColorClass="border-primary text-primary"
            imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/IMG_bg-cf31dc2b-291b-440b-953b-6e1b4a838e4e.jpg"
            items={[
              { icon: "::FaTools::", text: "Обслуживание и ремонт вашего мотоцикла" },
              { icon: "::FaGamepad::", text: "Лаунж-зона с кальяном и игровыми приставками" },
              { icon: "::FaMapLocationDot::", text: "Новая удобная локация: Стригинский переулок 13Б" },
              { icon: "::FaBeerMugEmpty::", text: "Место, где можно встретить единомышленников" },
            ]}
          />
        </motion.section>

        <section>
          <h2 className="mb-10 text-center font-orbitron text-4xl">Как это работает</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StepItem num="1" title="Бронь" icon="::FaCalendarCheck::">
              Выберите модель в нашем{" "}
              <Link href="/franchize/vip-bike" className="text-accent-text hover:underline">
                каталоге
              </Link>{" "}
              и оформите бронь онлайн.
            </StepItem>
            <StepItem num="2" title="Подтверждение" icon="::FaPaperPlane::">
              Свяжитесь с нами для подтверждения. Возьмите с собой оригиналы документов и залог.
            </StepItem>
            <StepItem num="3" title="Получение" icon="::FaKey::">
              Приезжайте в наш новый дом на Стригинском переулке 13Б, подписываем договор и забираете байк.
            </StepItem>
            <StepItem num="4" title="Возврат и отдых" icon="::FaFlagCheckered::">
              Верните мотоцикл в срок. После поездки можно отдохнуть в нашей лаунж-зоне.
            </StepItem>
          </div>
        </section>

   {/* ========================== */}
{/* VIP INVEST V2 — REAL MONEY */}
{/* ========================== */}

<section className="relative mt-24 overflow-hidden rounded-3xl border border-primary/30 bg-black/70 backdrop-blur-xl">

  {/* glow */}
  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,120,0,0.25),transparent_55%)]" />

  <div className="relative z-10 px-6 py-16 md:px-12">

    {/* HERO */}
    <div className="mx-auto max-w-3xl text-center">
      <div className="mb-3 text-brand-yellow">
        <VibeContentRenderer content="::FaChartLine:: INVEST MODE ACTIVATED" />
      </div>

      <h2 className="font-orbitron text-4xl md:text-5xl font-bold text-white">
        Зарабатывай на байках,
        <br />
        пока другие катаются
      </h2>

      <p className="mt-4 text-white/80 text-lg">
        Ты уже внутри экосистемы. Следующий шаг — зарабатывать на спросе.
      </p>
    </div>

    {/* ROI BLOCK */}
    <div className="mt-12 grid gap-6 md:grid-cols-3">

      {[
        {
          title: "Инвестиция",
          value: "500 000 ₽",
          icon: "::FaCoins::",
        },
        {
          title: "Доход / месяц",
          value: "60 000 – 90 000 ₽",
          icon: "::FaMoneyBillTrendUp::",
        },
        {
          title: "Окупаемость",
          value: "6–10 месяцев",
          icon: "::FaStopwatch::",
        },
      ].map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/20"
        >
          <VibeContentRenderer content={item.icon} className="text-3xl text-primary mb-3" />
          <p className="text-sm text-muted-foreground">{item.title}</p>
          <p className="mt-1 text-xl font-bold text-white">{item.value}</p>
        </div>
      ))}
    </div>

    {/* ECONOMICS */}
    <div className="mt-14 mx-auto max-w-3xl rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-sm">
      <h3 className="font-orbitron text-xl mb-4 text-white">
        Как это работает
      </h3>

      <div className="space-y-3 text-sm text-white/80">
        <div><VibeContentRenderer content="::FaMotorcycle:: Байк добавляется в парк" /></div>
        <div><VibeContentRenderer content="::FaUsers:: Используется райдерами ежедневно" /></div>
        <div><VibeContentRenderer content="::FaMoneyBillWave:: Генерирует доход с аренды" /></div>
        <div><VibeContentRenderer content="::FaRepeat:: Ты получаешь выплаты каждый месяц" /></div>
      </div>
    </div>

    {/* TRUST */}
    <div className="mt-12 grid gap-4 md:grid-cols-2">

      {[
        "::FaFileSignature:: Договор и прозрачные условия",
        "::FaCalendar:: Выплаты каждый месяц",
        "::FaRightLeft:: Выход из проекта (30 дней)",
      ].map((item) => (
        <div
          key={item}
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white/90"
        >
          <VibeContentRenderer content={item} />
        </div>
      ))}
    </div>

    {/* CTA */}
<div className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">

  {/* PRIMARY — горячий */}
  <Button
    asChild
    size="lg"
    className="font-orbitron text-base shadow-lg shadow-primary/40 transition hover:scale-105"
  >
    <Link href="https://t.me/salavey13" target="_blank">
      <VibeContentRenderer content="::FaTelegram:: Обсудить инвестиции" />
    </Link>
  </Button>

  {/* SECONDARY — прогрев */}
  <Button
    asChild
    size="lg"
    variant="outline"
    className="border-white/30 bg-black/20 text-white backdrop-blur-sm hover:bg-white hover:text-black"
  >
    <Link href="/moto-investments">
      <VibeContentRenderer content="::FaCircleInfo:: Подробнее об условиях" />
    </Link>
  </Button>

<p className="mt-3 text-xs text-white/50 text-center">
  Сначала изучи условия или сразу обсуди — как удобнее
</p>
</div>
  </div>
</section>

        <motion.section
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="mx-auto max-w-3xl"
        >
          <h2 className="mb-10 text-center font-orbitron text-4xl">Частые вопросы</h2>
          <Accordion type="single" collapsible className="w-full rounded-2xl border border-border/60 bg-card/40 px-4 text-sm">
            <AccordionItem value="item-1">
              <AccordionTrigger className="text-base">Можно ли арендовать мотоцикл без категории «А»?</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                Да! У нас есть парк скутеров, для управления которыми достаточно категории «B» или «M». Для всех остальных мотоциклов категория «А» обязательна.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="text-base">Что будет, если я попаду в ДТП?</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                Все мотоциклы застрахованы по ОСАГО. Ваша финансовая ответственность ограничена суммой залога, если нет серьезных нарушений с вашей стороны. Главное — немедленно связаться с нами.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="text-base">Что входит в стоимость аренды?</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                В стоимость входит аренда мотоцикла на 24 часа, полис ОСАГО и полный комплект защитной экипировки. Пробег обычно ограничен (например, 300 км/сутки), превышение оплачивается отдельно.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="text-base">У вас есть свой сервис?</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                Да, на нашей новой локации работает полноценный сервис. Вы можете пригнать своего верного друга к нам на обслуживание или ремонт.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </motion.section>
      </div>
    </div>
  );
}
