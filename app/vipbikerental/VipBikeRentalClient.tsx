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
import type { CatalogItemVM, FranchizeTheme } from "@/app/franchize/actions";
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

const getRussianRiderLabel = (count: number) => {
  const rounded = Math.abs(Math.round(count));
  const lastTwo = rounded % 100;
  const last = rounded % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return "райдеров онлайн";
  if (last === 1) return "райдер онлайн";
  if (last >= 2 && last <= 4) return "райдера онлайн";
  return "райдеров онлайн";
};

const fallbackHeroPanels: Record<HeroMode, HeroPanel> = {
  rent: {
    mode: "rent",
    label: "Аренда",
    icon: "::FaMotorcycle::",
    eyebrow: "Премиальная бронь сегодня",
    title: "VIP Bike Electro-Enduro S1",
    description: "Контролируемый первый выезд: подготовленный электроэндуро, защитный комплект и сопровождение до уверенного возвращения.",
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
    title: "Соберите электроэндуро под свой стиль",
    description: "Модель, батарея, цвет и опции собираются в понятный заказ — без хаоса в переписке и с прозрачным следующим шагом.",
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
    eyebrow: "Живая карта",
    title: "Живые маршруты и точки сбора",
    description: "Видите активность экипажа, точки встреч и темп группы заранее — поездка ощущается организованной ещё до старта.",
    href: "/franchize/vip-bike/map-riders",
    cta: "Открыть карту",
    meta: [
      { label: "онлайн", value: "3 райдера" },
      { label: "маршруты", value: "речные точки" },
      { label: "встречи", value: "2" },
    ],
  },
  rentals: {
    mode: "rentals",
    label: "Мои аренды",
    icon: "::FaTicket::",
    eyebrow: "Личный контроль",
    title: "Контролируйте активные аренды",
    description: "Статусы, подтверждения, фото до/после и возврат собраны в одном центре, чтобы сделка не зависала в чатах.",
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
    <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-[var(--vip-accent)] font-orbitron font-bold text-primary-foreground">
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
  { id: "buy", label: "Купить", hint: "в наличии" },
] as const;

const heroMetrics = [
  "::FaStopwatch:: Бронь без лишних созвонов",
  "::FaShieldHeart:: ОСАГО + экип",
  "::FaMapLocationDot:: Выдача в удобной городской точке",
  "::FaHeadset:: Поддержка на маршруте",
];

const conversionPilotChecks = [
  { label: "Старт", value: "понятный", icon: "::FaLayerGroup::" },
  { label: "Защита", value: "экип + ОСАГО", icon: "::FaShieldHeart::" },
  { label: "Путь", value: "3 сценария", icon: "::FaBolt::" },
];

const decisionRoutes = [
  {
    title: "Первый выезд",
    text: "Для первого контакта с электроэндуро: выбираете байк, слот и экипировку, а дальше система ведёт к подтверждённой выдаче.",
    href: "/franchize/vip-bike",
    cta: "Выбрать аренду",
    icon: "::FaMotorcycle::",
  },
  {
    title: "Тест → покупка",
    text: "Для покупки без сомнений: соберите конфигурацию, закрепите тест-драйв и сравните ощущения до оплаты.",
    href: "/franchize/vip-bike/configurator",
    cta: "Собрать байк",
    icon: "::FaCartShopping::",
  },
  {
    title: "Кататься с группой",
    text: "Для групповых выездов: смотрите райдеров рядом, точки старта и ближайшие встречи вместо случайных договорённостей.",
    href: "/franchize/vip-bike/map-riders",
    cta: "Смотреть карту",
    icon: "::FaMapLocationDot::",
  },
];

const newbieFlow = [
  {
    step: "Шаг 1",
    title: "Старт с понятного сценария",
    description: "Откройте страницу заказа: локация, маршруты, ограничения и правила безопасности собраны до выбора слота.",
    href: "/vipbikerental",
    cta: "Открыть вводный блок",
  },
  {
    step: "Шаг 2",
    title: "Подбор байка и конфигурации",
    description: "Перейдите в конфигуратор: модель, батарея, режим мощности и допы фиксируются в одном заказе.",
    href: "/franchize/vip-bike/electro-enduro",
    cta: "Подобрать конфиг",
  },
  {
    step: "Шаг 3",
    title: "Корзина и оформление",
    description: "Проверьте состав, добавьте защиту, подтвердите контакты и отправьте менеджеру уже структурированную заявку.",
    href: "/franchize/vip-bike/profile",
    cta: "Проверить оформление",
  },
];

function ConversionPilot({ items, overview, isCatalogLoading = false }: { items: CatalogItemVM[]; overview: MapRidersOverview | null; isCatalogLoading?: boolean }) {
  const rentableItems = items.filter((item) => item.availabilityStatus === "available" && item.pricePerDay > 0);
  const pricedRentalItems = items.filter((item) => item.pricePerDay > 0);
  const availableItems = rentableItems.length > 0 ? rentableItems : pricedRentalItems;
  const saleItems = items.filter((item) => item.saleAvailable || isEnabled(item.rawSpecs?.sale));
  const dayPrices = availableItems.map((item) => item.pricePerDay).filter((price) => price > 0);
  const minDayPrice = dayPrices.length ? Math.min(...dayPrices) : fallbackElectroItems[0]?.pricePerDay ?? 4900;
  const activeRidersCount = Number(overview?.stats?.activeRiders ?? overview?.liveLocations?.length ?? fallbackMapLocations.length);
  const activeRiders = formatCompactNumber(activeRidersCount, fallbackMapLocations.length);
  const leadItem = availableItems[0] ?? saleItems[0] ?? items[0] ?? fallbackElectroItems[0];
  const leadHref = leadItem?.id ? `/franchize/vip-bike?vehicle=${leadItem.id}` : "/franchize/vip-bike";
  const score = Math.min(9.2, 8.4 + (availableItems.length > 0 ? 0.3 : 0) + (saleItems.length > 0 ? 0.25 : 0) + (overview ? 0.25 : 0));
  const scoreLabel = score.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  const riderLabel = getRussianRiderLabel(activeRidersCount);
  const scoreReasons = [
    `${availableItems.length || fallbackElectroItems.length} вариантов аренды`,
    saleItems.length > 0 ? "покупка доступна" : "тест-драйв перед покупкой",
    overview ? "карта подключена" : "карта готова",
  ];

  return (
    <section className="rounded-[2rem] border border-primary/30 bg-card/50 p-4 shadow-2xl shadow-black/10 backdrop-blur-sm sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">быстрый выбор</p>
          <h2 className="mt-2 font-orbitron text-3xl sm:text-4xl">Найдите правильный сценарий за 30 секунд</h2>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">готовность</span>
          <span className="ml-3 font-orbitron text-2xl text-primary">{scoreLabel}/10</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/70 p-6 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,179,71,0.25),transparent_38%),radial-gradient(circle_at_80%_70%,rgba(34,197,94,0.16),transparent_34%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-8">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-brand-yellow">следующий шаг</p>
              <h3 className="mt-3 font-orbitron text-3xl sm:text-4xl">{leadItem?.title || "VIP Bike"}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/75">
                {isCatalogLoading ? "Подтягиваем актуальные карточки..." : `От ${minDayPrice.toLocaleString("ru-RU")} ₽ / день · ${activeRiders} ${riderLabel}`}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {scoreReasons.map((reason) => (
                  <span key={reason} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75">
                    {reason}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {conversionPilotChecks.map((check) => (
                <div key={check.label} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                  <VibeContentRenderer content={check.icon} className="mx-auto text-lg text-brand-yellow" />
                  <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-white/45">{check.label}</p>
                  <p className="mt-1 font-orbitron text-xs text-white sm:text-sm">{check.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
          {decisionRoutes.map((route, index) => (
            <Link
              key={route.title}
              href={route.href}
              aria-label={`${route.cta}: ${route.title}`}
              className="group rounded-2xl border border-border/70 bg-card/60 p-4 transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="flex items-start justify-between gap-3">
                <VibeContentRenderer content={route.icon} className="text-2xl text-primary" />
                <span className="rounded-full border border-border/70 bg-background/45 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  0{index + 1}
                </span>
              </div>
              <h4 className="mt-3 font-orbitron text-lg">{route.title}</h4>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{route.text}</p>
              <span className="mt-4 inline-flex text-xs font-medium text-primary group-hover:underline">{route.cta}</span>
            </Link>
          ))}
          <Button asChild className="mt-1 w-full md:col-span-3 lg:col-span-1">
            <Link href={leadHref}>Начать с рекомендованного байка</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

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
                    <p className="mt-2 font-orbitron text-lg">Байк, экипировка и слот уже сведены в один путь</p>
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


function VipBikeCompanyServiceHub() {
  const serviceLanes = [
    {
      title: "Прокат и выдача",
      icon: "::FaKey::",
      text: "Быстрая бронь, договор, экипировка и понятная выдача без лишних звонков.",
      href: "/franchize/vip-bike",
      cta: "Выбрать байк",
    },
    {
      title: "Сервис и ремонт",
      icon: "::FaWrench::",
      text: "Обслуживание своего мотоцикла, диагностика, сезонная подготовка и расходники на базе VIP BIKE.",
      href: "https://t.me/salavey13",
      cta: "Написать в сервис",
    },
    {
      title: "Комьюнити райдеров",
      icon: "::FaUsersViewfinder::",
      text: "MapRiders, точки встреч, живые маршруты и социальное доказательство вокруг реальных поездок.",
      href: "/franchize/vip-bike/map-riders",
      cta: "Открыть карту",
    },
  ];

  const companyFacts = [
    "Локация: ул. Комсомольская 2",
    "Формат: аренда, продажа, сервис, комьюнити",
    "Фокус: electro-enduro и городские тест-драйвы",
  ];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-card/50 p-5 shadow-2xl shadow-primary/10 sm:p-7">
      <div className="grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-black/35 p-5 text-white">
          <p className="text-xs uppercase tracking-[0.24em] text-primary">company hub</p>
          <h2 className="mt-3 font-orbitron text-3xl sm:text-4xl">VIP BIKE — не только прокат, а база райдера</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            Один экран объясняет компанию простыми словами: где взять байк, где обслужить свой мотоцикл, куда приехать и как попасть в живое сообщество.
          </p>
          <div className="mt-5 grid gap-2">
            {companyFacts.map((fact) => (
              <div key={fact} className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85">
                <VibeContentRenderer content="::FaCircleCheck::" className="mt-0.5 text-primary" />
                <span>{fact}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-1">
          {serviceLanes.map((lane) => (
            <article key={lane.title} className="rounded-3xl border border-border/70 bg-background/55 p-4 transition hover:-translate-y-1 hover:border-primary/50">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <VibeContentRenderer content={lane.icon} />
                </div>
                <div>
                  <h3 className="font-orbitron text-lg">{lane.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{lane.text}</p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link href={lane.href}>{lane.cta}</Link>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}


function RentalQuickActionHub({ items, overview, isCatalogLoading = false }: { items: CatalogItemVM[]; overview: MapRidersOverview | null; isCatalogLoading?: boolean }) {
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
      text: "Байк, экип и слот выдачи — в одном личном разделе.",
      cta: "Открыть сделки",
      href: "/franchize/vip-bike/rentals",
    },
    {
      id: "riders" as const,
      title: "Райдеры рядом",
      icon: "::FaMapLocationDot::",
      metric: `${activeRiders} онлайн`,
      text: `Неделя: ${weeklyDistance} км · встречи: ${meetupCount}.`,
      cta: "Открыть карту",
      href: "/franchize/vip-bike/map-riders",
    },
    {
      id: "chooser" as const,
      title: "Быстрый подбор",
      icon: "::FaBolt::",
      metric: leadItem?.title || "VIP Bike",
      text: isCatalogLoading ? "Готовим актуальные карточки..." : "Подборка по цели поездки и доступности.",
      cta: "Подобрать байк",
      href: "/franchize/vip-bike",
    },
  ];

  const selectedCard = actionCards.find((card) => card.id === selectedAction) ?? actionCards[0];

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">Быстрые действия VIP Bike</h2>
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
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">райдеры сейчас</p>
                    <h3 className="mt-2 font-orbitron text-2xl">{activeRiders} райдера онлайн</h3>
                    <p className="mt-2 text-sm text-muted-foreground">Смотри активность перед стартом и решай: ехать соло или присоединиться к группе.</p>
                    <Button asChild variant="outline" className="mt-5 w-full sm:w-fit">
                      <Link href="/franchize/vip-bike/map-riders">Открыть MapRiders</Link>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "онлайн", value: activeRiders },
                      { label: "встречи", value: meetupCount },
                      { label: "за неделю", value: `${weeklyDistance} км` },
                      { label: "формат", value: "группа" },
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
  const safeSeconds = Number(seconds);
  if (!Number.isFinite(safeSeconds)) return "—";
  if (safeSeconds === 0) return "Только что начали!";
  if (safeSeconds < 60) return "Меньше минуты";

  const minutes = Math.round(safeSeconds / 60);
  if (minutes < 60) return `${minutes} мин`;
  return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
};

function MapRidersLivePreview({ overview }: { overview: MapRidersOverview | null }) {
  const liveLocations = (overview?.liveLocations?.length ? overview.liveLocations : fallbackMapLocations).slice(0, 3);
  const meetups = (overview?.meetups?.length ? overview.meetups : fallbackMeetups).slice(0, 2);
  const latestRide = overview?.latestCompleted?.[0];
  const activeRiders = formatCompactNumber(overview?.stats?.activeRiders, liveLocations.length);
  const meetupCount = formatCompactNumber(overview?.stats?.meetupCount, meetups.length);
  const weeklyDistance = formatCompactNumber(overview?.stats?.totalWeeklyDistanceKm, 127);
  const isMapRidersWarmup = Boolean(
    overview &&
      !overview.liveLocations?.length &&
      !overview.meetups?.length &&
      !overview.latestCompleted?.length &&
      Number(overview.stats?.activeRiders || 0) <= 0 &&
      Number(overview.stats?.totalWeeklyDistanceKm || 0) <= 0,
  );
  const latestRideDistanceKm = Number(latestRide?.total_distance_km || 0);
  const latestRideHint = latestRide
    ? latestRideDistanceKm <= 0 ? "Последний заезд сохранён, дистанция ещё уточняется." : null
    : "Ждём первый живой заезд — он появится здесь после старта MapRiders.";
  const speedPath = "M4 42 C18 34 24 18 38 28 C50 36 58 12 70 22 C82 30 88 18 96 10";

  return (
    <section>
      <div className="mb-8 text-center">
        <h2 className="font-orbitron text-3xl sm:text-4xl">MapRiders — карта, которой реально хочется пользоваться</h2>
        <p className="mx-auto mt-3 max-w-3xl text-muted-foreground">
          Райдеры, встречи и последние поездки — без тяжёлой карты на первом экране.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Link
          href="/franchize/vip-bike/map-riders"
          className="group relative min-h-[360px] overflow-hidden rounded-3xl border border-primary/35 bg-[#d8c99b] p-5 text-[#182016] shadow-2xl shadow-black/20"
          aria-label="Открыть полную карту MapRiders"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(255,244,196,0.78),transparent_28%),radial-gradient(circle_at_72%_64%,rgba(48,142,94,0.30),transparent_30%),linear-gradient(135deg,rgba(255,249,219,0.82),rgba(96,131,91,0.42))]" />
          <svg className="absolute inset-0 h-full w-full opacity-80" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
            <path d="M-6 78 C18 66 30 54 52 54 C70 54 84 42 106 30" fill="none" stroke="rgba(31,54,36,0.20)" strokeWidth="10" strokeLinecap="round" />
            <path d="M-4 76 C18 64 30 52 52 52 C70 52 84 40 104 28" fill="none" stroke="rgba(255,246,210,0.78)" strokeWidth="3" strokeLinecap="round" />
            <path d="M8 14 C24 22 28 36 42 42 C56 49 68 44 91 56" fill="none" stroke="rgba(23,88,63,0.42)" strokeWidth="2" strokeLinecap="round" strokeDasharray="7 4" />
            <path d="M2 40 C20 35 28 28 42 26 C58 23 69 16 98 12" fill="none" stroke="rgba(171,112,38,0.45)" strokeWidth="1.7" strokeLinecap="round" />
            <path d="M12 92 C22 78 34 72 48 72 C64 72 74 82 92 78" fill="none" stroke="rgba(24,89,116,0.32)" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 bg-[linear-gradient(rgba(24,32,22,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(24,32,22,0.08)_1px,transparent_1px)] bg-[size:34px_34px] mix-blend-multiply" />

          {liveLocations.map((location, index) => {
            const point = normalizeMapPoint(location.lat, location.lng, index);
            return (
              <div
                key={location.user_id || `${location.lat}-${location.lng}-${index}`}
                className="absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2"
                style={{ left: `${point.left}%`, top: `${point.top}%` }}
              >
                <span className="relative flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-600 opacity-50" />
                  <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-emerald-600 shadow-[0_0_16px_rgba(22,163,74,0.8)]" />
                </span>
                <span className="rounded-full border border-emerald-900/15 bg-white/75 px-2 py-1 text-[10px] font-semibold text-emerald-950 shadow-sm backdrop-blur-sm">
                  {Math.round(Number(location.speed_kmh || 0)) || 18} км/ч
                </span>
              </div>
            );
          })}

          {meetups.map((meetup, index) => {
            const point = normalizeMapPoint(meetup.lat, meetup.lng, index + 4);
            return (
              <div
                key={`${meetup.title || "vstrecha"}-${index}`}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-900/20 bg-amber-100/85 px-3 py-2 text-xs font-semibold text-amber-950 shadow-sm backdrop-blur-sm"
                style={{ left: `${point.left}%`, top: `${point.top}%` }}
              >
                <VibeContentRenderer content="::FaLocationDot::" className="mr-1 inline text-amber-700" />
                {meetup.title || "Точка встречи"}
              </div>
            );
          })}

          <div className="relative z-10 flex h-full min-h-[320px] flex-col justify-between">
            <div className="max-w-md rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-900/70">превью маршрута</p>
              <h3 className="mt-2 font-orbitron text-2xl text-[#182016]">Райдеры на карте прямо сейчас</h3>
              <p className="mt-2 text-sm text-[#354131]">Откроется полная карта с геопозицией, встречами и рейтингом.</p>
              {isMapRidersWarmup ? (
                <p className="mt-2 text-xs font-medium text-emerald-950/70">Живые данные появятся после первого заезда — пока показываем демо-сцену.</p>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "онлайн", value: activeRiders },
                { label: "за неделю", value: `${weeklyDistance} км` },
                { label: "встречи", value: meetupCount },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm backdrop-blur-md">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[#52604d]">{stat.label}</p>
                  <p className="mt-1 font-orbitron text-lg text-[#182016]">{stat.value}</p>
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
                  <p className="mt-1 font-medium">{latestRide?.rider_name || "Ждём первый заезд"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Дистанция</p>
                  <p className="mt-1 font-medium">{latestRide ? `${formatCompactNumber(latestRide.total_distance_km, 0)} км` : "—"}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Время</p>
                  <p className="mt-1 font-medium">{formatRideDuration(latestRide?.duration_seconds)}</p>
                </div>
              </div>
              {latestRideHint ? <p className="text-xs text-muted-foreground">{latestRideHint}</p> : null}
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


function BikeCardSkeleton({ index }: { index: number }) {
  return (
    <article className="relative min-w-[280px] snap-start overflow-hidden rounded-2xl border border-border/70 bg-background/45 shadow-xl shadow-black/10 sm:min-w-[340px]" aria-hidden="true">
      <div className="relative h-52 overflow-hidden bg-black/40">
        <motion.div
          className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-primary/25 to-transparent"
          initial={{ x: "-120%" }}
          animate={{ x: "260%" }}
          transition={{ duration: 1.25, repeat: Infinity, delay: index * 0.12, ease: "easeInOut" }}
        />
        <div className="absolute bottom-3 left-3 h-6 w-28 rounded-full bg-white/15" />
      </div>
      <div className="space-y-3 p-4">
        <div className="h-5 w-2/3 rounded-full bg-muted/60" />
        <div className="h-4 w-full rounded-full bg-muted/35" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-16 rounded-xl bg-muted/35" />
          <div className="h-16 rounded-xl bg-muted/35" />
        </div>
        <div className="h-10 rounded-xl bg-primary/20" />
      </div>
    </article>
  );
}

function ElectroEnduroShowcase({ items, isCatalogLoading = false }: { items: CatalogItemVM[]; isCatalogLoading?: boolean }) {
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
        <h2 className="font-orbitron text-3xl sm:text-4xl">Electro-Enduro: аренда и покупка</h2>
      </div>

      <div className="overflow-hidden rounded-3xl border border-primary/30 bg-card/50 p-4 backdrop-blur-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">гараж на витрине</p>
            <h3 className="mt-1 font-orbitron text-2xl">Свободные модели и быстрый конфиг</h3>
          </div>
          <Button asChild variant="outline" className="sm:w-fit">
            <Link href="/franchize/vip-bike/electro-enduro">Полный раздел Electro-Enduro</Link>
          </Button>
        </div>

        <div className="flex snap-x gap-4 overflow-x-auto pb-3 [scrollbar-width:thin]">
          {isCatalogLoading && items.length === 0 && [0, 1, 2].map((index) => <BikeCardSkeleton key={index} index={index} />)}
          {(!isCatalogLoading || items.length > 0) && electroItems.map((item) => {
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

export function VipBikeRentalClient({ items, theme }: { items: CatalogItemVM[]; theme: FranchizeTheme }) {
  const { dbUser } = useAppContext();
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const [heroMode, setHeroMode] = useState<HeroMode>("rent");
  const [mapOverview, setMapOverview] = useState<MapRidersOverview | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItemVM[]>(items);
  const [isCatalogLoading, setIsCatalogLoading] = useState(items.length === 0);

  useEffect(() => {
    setCatalogItems(items);
    setIsCatalogLoading(items.length === 0);
  }, [items]);

  useEffect(() => {
    let isMounted = true;

    if (items.length === 0) {
      fetch("/api/franchize/catalog?slug=vip-bike")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (isMounted && payload?.success && Array.isArray(payload.data?.items)) {
            setCatalogItems(payload.data.items as CatalogItemVM[]);
          }
        })
        .catch(() => {
          if (isMounted) {
            setCatalogItems([]);
          }
        })
        .finally(() => {
          if (isMounted) {
            setIsCatalogLoading(false);
          }
        });
    }

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
  }, [items.length]);

  const heroPanels = useMemo<Record<HeroMode, HeroPanel>>(() => {
    const rentItem = catalogItems.find((item) => item.availabilityStatus === "available" && item.pricePerDay > 0) ?? catalogItems.find((item) => item.pricePerDay > 0);
    const saleItem = catalogItems.find((item) => item.saleAvailable || isEnabled(item.rawSpecs?.sale));

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
          { label: "встречи", value: formatCompactNumber(mapOverview?.stats?.meetupCount, 2) },
        ],
      },
    };
  }, [catalogItems, mapOverview]);

  const activeHeroPanel = heroPanels[heroMode];

  const vibeProfile = useMemo(() => {
    const surveyResults = (dbUser?.metadata?.survey_results || {}) as Record<string, string>;
    const bikeStyle = surveyResults.bike_style || surveyResults.style || surveyResults.riding_style;

    if (!bikeStyle) {
      return {
        badge: "::FaCompass:: Универсальный подбор",
        title: "Подберём байк под задачу за 2 минуты",
        note: "Пройди /start в Telegram, чтобы открыть персональные рекомендации на этой странице.",
      };
    }

    if (bikeStyle.toLowerCase().includes("спорт")) {
      return {
        badge: "::FaBolt:: Спортивный сценарий",
        title: "Ваш сценарий: скорость и адреналин",
        note: "Рекомендуем начать с Supersport и быстрых слотов выдачи.",
      };
    }

    if (bikeStyle.toLowerCase().includes("ретро") || bikeStyle.toLowerCase().includes("neo")) {
      return {
        badge: "::FaWandSparkles:: Neo-retro подборка",
        title: "Ваш сценарий: стиль и харизма",
        note: "Для вас выделили neo-retro подборку с маршрутами, которые выглядят хорошо и в поездке, и на фото.",
      };
    }

    return {
      badge: "::FaRoute:: Персональный маршрут",
      title: `Ваш сценарий: ${bikeStyle}`,
      note: "Используйте персональный фильтр: меньше случайных карточек, быстрее уверенное решение.",
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
            <span>VIP BIKE · ПРЕМИАЛЬНЫЙ ПРОКАТ И МАРШРУТЫ</span>
          </div>
          <div className="mb-5 w-full max-w-2xl rounded-2xl border border-white/20 bg-black/40 p-4 text-left text-sm text-white/90 backdrop-blur-sm">
            <div className="mb-1 font-medium text-brand-yellow"><VibeContentRenderer content={vibeProfile.badge} /></div>
            <p className="font-orbitron text-lg text-white">{vibeProfile.title}</p>
            <p className="mt-1 text-white/80">{vibeProfile.note}</p>
          </div>

          <h1 className="font-orbitron text-5xl font-black uppercase leading-[0.9] tracking-tight text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.75)] sm:text-6xl md:text-7xl lg:text-8xl">
            <span className="block">Скорость. Контроль.</span>
            <span className="block text-brand-yellow">Ваш выезд организован заранее.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base font-light text-white/90 sm:text-lg md:text-xl">
            Премиальный прокат в Нижнем Новгороде: от выбора модели до возврата — единый управляемый поток, где клиент понимает цену, слот, защиту и следующий шаг.
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
                        ? "border-brand-yellow bg-brand-yellow/20 text-white shadow-lg shadow-brand-yellow/25 ring-1 ring-brand-yellow/40"
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
                      <span className="rounded-full border border-brand-yellow/40 bg-black/55 px-3 py-1 font-orbitron text-xs text-brand-yellow">{activeHeroPanel.label}</span>
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
        <ConversionPilot items={catalogItems} overview={mapOverview} isCatalogLoading={isCatalogLoading} />

        <ElectroEnduroShowcase items={catalogItems} isCatalogLoading={isCatalogLoading} />

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

        <StepsProgress items={catalogItems} />

        <RentalQuickActionHub items={catalogItems} overview={mapOverview} isCatalogLoading={isCatalogLoading} />

        <VipBikeCompanyServiceHub />

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
            title="Что получает клиент"
            icon="::FaGift::"
            borderColorClass="border-accent text-accent"
            imageUrl="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/81Dts9uMBXZXTKC7PjIbBRRRHYGQx_2TPEKFWvaUwDzzgSQPjxUf4GjAiRaDWIcWgwmeaZQTKppFn5VBS6yZeK7R-38bfc7fb-0d5a-4b62-b7e6-ca83950cb265.jpg"
            items={[
              { icon: "::FaCircleCheck::", text: "Полностью обслуженный и чистый мотоцикл" },
              { icon: "::FaFileSignature::", text: "Открытый полис ОСАГО" },
              { icon: "::FaUserShield::", text: "Полный комплект защитной экипировки" },
              { icon: "::FaTag::", text: "Минус 10% на первый выезд по промокоду VIPSTART — мягкий вход без снижения уровня сервиса" },
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
              { icon: "::FaMapLocationDot::", text: "Новая удобная локация: ул. Комсомольская 2" },
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
              Приезжайте на ул. Комсомольская 2: быстро сверяем документы, подписываем договор и выдаём подготовленный байк.
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
        Включайте байки в доходную сеть,
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
        <div><VibeContentRenderer content="::FaMoneyBillWave:: Работает в арендной модели с понятной загрузкой" /></div>
        <div><VibeContentRenderer content="::FaRepeat:: Вы получаете регулярные выплаты по согласованной модели" /></div>
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
