"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Battery,
  Check,
  Gauge,
  PhoneCall,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Timer,
  Weight,
  Zap,
} from "lucide-react";

import type { CatalogItemVM, FranchizeCrewVM } from "@/app/franchize/actions";
import { crewPaletteForSurface } from "@/app/franchize/lib/theme";
import { useFranchizeCart } from "@/app/franchize/hooks/useFranchizeCart";

type ConfigOption = { id: string; label: string; priceDelta: number; subtitle: string };
type ColorOption = { id: string; label: string; hex: string };

const CONFIG_OPTIONS: ConfigOption[] = [
  { id: "standard", label: "Стандарт", subtitle: "Базовая комплектация", priceDelta: 0 },
  { id: "long-range", label: "Long Range", subtitle: "Увеличенный запас хода", priceDelta: 40000 },
  { id: "comfort", label: "Comfort", subtitle: "Комфорт и защита", priceDelta: 25000 },
];

const COLOR_OPTIONS: ColorOption[] = [
  { id: "black", label: "Черный", hex: "#0b0c0f" },
  { id: "graphite", label: "Графит", hex: "#6b7280" },
  { id: "acid", label: "Lime", hex: "#c6ff00" },
  { id: "white", label: "Белый", hex: "#f8fafc" },
];

function formatPrice(value: number): string {
  return value > 0 ? `${value.toLocaleString("ru-RU")} ₽` : "по запросу";
}

export function SaleBikeLanding({ crew, item }: { crew: FranchizeCrewVM; item: CatalogItemVM }) {
  const resolvedSlug = crew.slug || "vip-bike";
  const surface = crewPaletteForSurface(crew.theme);
  const gallery = item.mediaUrls?.filter(Boolean)?.length ? item.mediaUrls.filter(Boolean) : [item.imageUrl].filter(Boolean);
  const heroImage = gallery[0] ?? "https://placehold.co/1200x900/0b0f13/e6edf3?text=No+image";
  const specs = item.rawSpecs || {};
  const basePrice = Number(specs.price_rub || specs.sale_price || 0);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string>(CONFIG_OPTIONS[0].id);
  const [selectedColorId, setSelectedColorId] = useState<string>(COLOR_OPTIONS[0].id);

  const selectedOption = useMemo(
    () => CONFIG_OPTIONS.find((option) => option.id === selectedOptionId) || CONFIG_OPTIONS[0],
    [selectedOptionId],
  );

  const finalPrice = useMemo(() => basePrice + selectedOption.priceDelta, [basePrice, selectedOption.priceDelta]);

  const cards = [
    { label: "Тип", value: item.category, icon: Tag },
    { label: "Мощность", value: String(specs.power_kw || specs.motor_peak_kw || "—"), icon: Zap },
    { label: "Батарея", value: String(specs.battery || "—"), icon: Battery },
    { label: "Запас хода", value: `${specs.range_km || "—"} км`, icon: Gauge },
    { label: "Макс. скорость", value: `${specs.top_speed_kmh || "—"} км/ч`, icon: Gauge },
    { label: "Вес", value: `${specs.weight_kg || "—"} кг`, icon: Weight },
    { label: "Зарядка", value: `${specs.charge_time_h || "—"} ч`, icon: Timer },
    { label: "Привод", value: String(specs.drive || "—"), icon: ShoppingBag },
  ];

  const buyFaq = [
    {
      q: "Как проходит покупка?",
      a: "Оставляете заявку, менеджер связывается, подтверждаем наличие и фиксируем конфигурацию. Дальше — договор, оплата и выдача с инструктажем.",
    },
    {
      q: "Можно ли протестировать перед покупкой?",
      a: "Да. Запишем на тест-драйв в офлайн-точке, подберем удобный слот и маршрут.",
    },
    {
      q: "Есть ли гарантия и сервис?",
      a: "Да, даем гарантийные условия, документы и сопровождение по сервису после покупки.",
    },
  ];

  const { addItem, isHydrated } = useFranchizeCart(resolvedSlug);
  const [addedOnce, setAddedOnce] = useState(false);

  return (
    <section className="min-h-screen pb-28 pt-3 sm:pt-6" style={surface.page}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/franchize/${resolvedSlug}?vehicle=${item.id}&flow=buy`}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            style={surface.subtleCard}
          >
            <ArrowLeft className="h-4 w-4" />В маркет
          </Link>
          <span className="rounded-full border px-3 py-1 text-xs font-semibold" style={surface.subtleCard}>
            На продажу
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border"
          style={surface.card}
        >
          <div className="grid lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-2 p-2 sm:p-3">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black/30">
                <Image src={gallery[selectedImage] ?? heroImage} alt={item.title} fill sizes="(max-width: 1024px) 100vw, 66vw" unoptimized className="object-cover" />
              </div>
              <div className="grid grid-cols-5 gap-2">
                {gallery.slice(0, 5).map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    onClick={() => setSelectedImage(i)}
                    className="overflow-hidden rounded-xl border transition hover:brightness-110"
                    style={{
                      ...(i === selectedImage ? { borderColor: crew.theme.palette.accentMain, boxShadow: `0 0 0 1px ${crew.theme.palette.accentMain}` } : {}),
                    }}
                  >
                    <span className="relative block aspect-[4/3] w-full"><Image src={img} alt={`${item.title}-${i}`} fill sizes="120px" unoptimized className="object-cover" /></span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold" style={surface.subtleCard}>
                <Sparkles className="h-3.5 w-3.5" />Premium eMoto
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{item.title}</h1>
              <p className="text-sm opacity-80">{item.description}</p>

              <div className="rounded-2xl border p-4" style={surface.subtleCard}>
                <p className="text-xs uppercase tracking-[0.16em] opacity-70">Цена продажи</p>
                <p className="text-3xl font-bold sm:text-4xl">{formatPrice(finalPrice)}</p>
                <p className="mt-2 inline-flex items-center gap-2 text-xs opacity-80">
                  <ShieldCheck className="h-3.5 w-3.5" />Официальная сделка + документы
                </p>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isHydrated) return;
                    addItem(
                      item.id,
                      {
                        package: selectedOption.label,
                        duration: "Покупка",
                        perk: `Цвет: ${COLOR_OPTIONS.find((color) => color.id === selectedColorId)?.label ?? "—"}`,
                        auction: "Покупка",
                        buyConfigId: selectedOption.id,
                        buyPriceDelta: selectedOption.priceDelta,
                      },
                      1,
                    );
                    setAddedOnce(true);
                  }}
                  disabled={!isHydrated}
                  className="rounded-xl px-4 py-3 text-center font-semibold transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ ...surface.subtleCard, background: crew.theme.palette.accentMain, color: "#101010" }}
                >
                  {!isHydrated ? "Подготовка корзины..." : addedOnce ? "Добавлено в корзину" : "Добавить в корзину"}
                </button>
                <Link
                  href={`tel:${crew.contacts?.phone || "+79999005588"}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center font-semibold"
                >
                  <PhoneCall className="h-4 w-4" />Позвонить
                </Link>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border p-3" style={surface.subtleCard}>
                <card.icon className="mb-2 h-4 w-4 opacity-80" />
                <p className="text-xs opacity-70">{card.label}</p>
                <p className="text-sm font-semibold">{card.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border p-4 sm:p-5" style={surface.card}>
            <h2 className="text-xl font-semibold sm:text-2xl">Конфигуратор</h2>
            <p className="mt-1 text-sm opacity-80">Соберите конфигурацию под себя и сразу видьте итоговую цену.</p>
            <div className="mt-4 space-y-2">
              {CONFIG_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOptionId(option.id)}
                  className="flex w-full items-center justify-between rounded-2xl border p-3 text-left transition hover:brightness-110"
                  style={selectedOptionId === option.id ? { ...surface.subtleCard, borderColor: crew.theme.palette.accentMain } : surface.subtleCard}
                >
                  <div>
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-xs opacity-70">{option.subtitle}</p>
                  </div>
                  <p className="font-semibold">{option.priceDelta === 0 ? "Включено" : `+ ${option.priceDelta.toLocaleString("ru-RU")} ₽`}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setSelectedColorId(color.id)}
                  aria-label={color.label}
                  className="h-8 w-8 rounded-full border-2"
                  style={{ background: color.hex, borderColor: selectedColorId === color.id ? crew.theme.palette.accentMain : "rgba(255,255,255,0.3)" }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border p-4 sm:p-5" style={surface.card}>
            <h2 className="text-xl font-semibold">Нам доверяют</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border p-3" style={surface.subtleCard}><p className="text-2xl font-bold">120+</p><p className="text-xs opacity-70">Продано</p></div>
              <div className="rounded-xl border p-3" style={surface.subtleCard}><p className="text-2xl font-bold">4.9</p><p className="text-xs opacity-70">Рейтинг</p></div>
              <div className="rounded-xl border p-3" style={surface.subtleCard}><p className="text-2xl font-bold">98%</p><p className="text-xs opacity-70">Рекомендуют</p></div>
            </div>
            <div className="mt-3 rounded-2xl border p-3" style={surface.subtleCard}>
              <p className="font-medium">Алексей, Москва</p>
              <p className="mt-1 inline-flex items-center gap-1 text-yellow-300">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}</p>
              <p className="mt-1 text-sm opacity-80">"Отличный байк и сервис, быстро оформили и объяснили всё по обслуживанию."</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border p-4" style={surface.subtleCard}>
            <p className="text-xs uppercase tracking-[0.16em] opacity-70">Тест-драйв</p>
            <p className="mt-2 text-sm">Офлайн-показ и тест-драйв по предварительной записи.</p>
          </div>
          <div className="rounded-2xl border p-4" style={surface.subtleCard}>
            <p className="text-xs uppercase tracking-[0.16em] opacity-70">Группа магазина</p>
            <p className="mt-2 text-sm">Актуальные поставки и консультации: <a className="underline" href="https://vk.ru/vip_bike_electro" target="_blank" rel="noreferrer">vk.ru/vip_bike_electro</a></p>
          </div>
          <div className="rounded-2xl border p-4" style={surface.subtleCard}>
            <p className="text-xs uppercase tracking-[0.16em] opacity-70">После покупки</p>
            <p className="mt-2 text-sm">Сервисное сопровождение и рекомендации по обслуживанию.</p>
          </div>
        </div>

        <div className="rounded-3xl border p-4 sm:p-5" style={surface.card}>
          <h2 className="text-xl font-semibold sm:text-2xl">FAQ по покупке</h2>
          <div className="mt-3 space-y-3">
            {buyFaq.map((faq) => (
              <details key={faq.q} className="rounded-2xl border p-4 open:shadow-sm" style={surface.subtleCard}>
                <summary className="cursor-pointer list-none font-medium">{faq.q}</summary>
                <p className="mt-2 text-sm opacity-80">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      <div className="fixed inset-x-2 bottom-2 z-40 rounded-2xl border p-2 backdrop-blur md:hidden" style={surface.card}>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="text-base font-bold" style={{ color: crew.theme.palette.accentMain }}>{formatPrice(finalPrice)}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isHydrated) return;
              addItem(item.id, {
                package: selectedOption.label,
                duration: "Покупка",
                perk: `Цвет: ${COLOR_OPTIONS.find((color) => color.id === selectedColorId)?.label ?? "—"}`,
                auction: "Покупка",
                buyConfigId: selectedOption.id,
                buyPriceDelta: selectedOption.priceDelta,
              }, 1);
              setAddedOnce(true);
            }}
            disabled={!isHydrated}
            className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: crew.theme.palette.accentMain, color: "#111" }}
          >
            {addedOnce ? <Check className="h-4 w-4" /> : "В корзину"}
          </button>
        </div>
      </div>
    </section>
  );
}
