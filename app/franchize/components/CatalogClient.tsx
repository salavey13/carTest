"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toCategoryId } from "../lib/navigation";
import type { FranchizeRouteCtaPolicy } from "../lib/route-cta-policy";
import { shouldShowFloatingCart } from "../lib/route-cta-policy";
import { catalogCardVariantStyles, crewPaletteForSurface, getContrastingGlowStyle, interactionRingStyle, readableTextOnColor, withAlpha } from "../lib/theme";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { upsertFranchizeIntent } from "../actions";
import { hasRentPrice, hasSalePrice } from "../lib/catalog-utils";
import { FloatingCartIconLinkBySlug } from "./FloatingCartIconLinkBySlug";
import { useDisplayMode } from "./DisplayModeContext";
import { SHOW_CART } from "@/lib/feature-flags";
import { ItemModal, type FlowType } from "../modals/Item";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { useFranchizeTheme } from "../hooks/useFranchizeTheme";
import { todayISO } from "../lib/date-utils";
import { buildCatalogRentalStrip } from "../lib/catalog-rental-strip";
import { getCatalogPropulsionSegment } from "../lib/catalog-propulsion";
import { localImageSrc, handleImageError } from "@/lib/image-fallback";
import { logger } from "@/lib/logger";
import { decodeStartappState, isStartappStateFresh } from "@/lib/startapp-state";

interface CatalogClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  items: CatalogItemVM[];
  mode?: "rental" | "electro";
  ctaPolicy?: FranchizeRouteCtaPolicy;
}

type QuickFilterKey = "all" | "budget" | "premium" | "newbie" | "topRated" | "entry" | "mid" | "pro";

const QUICK_FILTERS: Array<{ key: QuickFilterKey; label: string; compactLabel?: string; tierColor?: string }> = [
  { key: "all", label: "Все" },
  { key: "entry", label: "Базовый", compactLabel: "Базов.", tierColor: "#22c55e" },
  { key: "mid", label: "Средний", compactLabel: "Средн.", tierColor: "#eab308" },
  { key: "pro", label: "Профи", tierColor: "#ef4444" },
  { key: "budget", label: "До 5000" },
  { key: "premium", label: "Премиум 7000+" },
  { key: "newbie", label: "Для новичка", compactLabel: "Для новичков" },
  { key: "topRated", label: "Лучшие отзывы" },
];

const sortWbItemLast = <T extends { category: string }>(groups: T[]) => {
  const regular = groups.filter((group) => !group.category.toLowerCase().includes("wbitem"));
  const wbItems = groups.filter((group) => group.category.toLowerCase().includes("wbitem"));
  return [...regular, ...wbItems];
};

type AccessTier = "entry" | "mid" | "pro" | "none";

/** Extract access_tier from item's rawSpecs */
function getItemAccessTier(item: CatalogItemVM): AccessTier {
  const tier = (item.rawSpecs as Record<string, unknown> | undefined)?.access_tier;
  if (tier === "entry" || tier === "mid" || tier === "pro") return tier;
  return "none";
}

/** Get tier emoji + color for a given access tier */
function tierVisuals(tier: AccessTier): { emoji: string; color: string; label: string } {
  switch (tier) {
    case "entry": return { emoji: "🟢", color: "#22c55e", label: "Базовый" };
    case "mid":   return { emoji: "🟡", color: "#eab308", label: "Средний" };
    case "pro":   return { emoji: "🔴", color: "#ef4444", label: "Профи" };
    default:      return { emoji: "⚪", color: "#9ca3af", label: "" };
  }
}

// ── Priority Spec Helper (VIP Bike Landing & Catalog Improvements) ──
// Extract consistent 3 priority specs with Russian labels based on bike type
// Electrics: Power (кВт), Speed (км/ч), Range (км)
// ICE: Power (л.с.), Speed (км/ч), Engine (см³)
function getPrioritySpecs(item: CatalogItemVM): Array<{ label: string; value: string; unit: string }> {
  const rs = item.rawSpecs;
  // Type guard: ensure rawSpecs is a plain object before accessing properties
  const isObject = rs !== null && typeof rs === 'object' && !Array.isArray(rs);
  const safeRs = isObject ? rs as Record<string, unknown> : {};
  const isElectric = safeRs?.type === "Electric";

  if (isElectric) {
    return [
      { label: "Мощность", value: String(safeRs?.power_kw ?? ""), unit: "кВт" },
      { label: "Скорость", value: String(safeRs?.top_speed_kmh ?? ""), unit: "км/ч" },
      { label: "Запас хода", value: String(safeRs?.range_km ?? ""), unit: "км" },
    ].filter(s => s.value !== "" && s.value !== "undefined" && s.value !== "null");
  } else {
    return [
      { label: "Мощность", value: String(safeRs?.power_hp ?? safeRs?.bike_power_hp ?? ""), unit: "л.с." },
      { label: "Скорость", value: String(safeRs?.top_speed_kmh ?? ""), unit: "км/ч" },
      { label: "Объём", value: String(safeRs?.engine_cc ?? safeRs?.bike_engine_cc ?? ""), unit: "см³" },
    ].filter(s => s.value !== "" && s.value !== "undefined" && s.value !== "null");
  }
}

// Check if a rawSpecs flag is truthy (same logic as electro-enduro page)
const isSpecEnabled = (value: unknown) =>
  value === 1 || value === true ||
  String(value).toLowerCase() === "1" ||
  String(value).toLowerCase() === "true";

// Derive flow type per-item from pricing + rawSpecs rent/sale flags
// "rental" → shows 1/3/7 days, packages, auction, rental strip
// "order"  → simple select/purchase flow, no rental UI
function getItemFlowType(item: CatalogItemVM): FlowType {
  const rs = item.rawSpecs;
  const hasExplicitRent = rs != null && "rent" in rs;
  const hasExplicitSale = rs != null && "sale" in rs;
  const rentEnabled = hasExplicitRent ? isSpecEnabled(rs!.rent) : true;
  const saleEnabled = hasExplicitSale ? isSpecEnabled(rs!.sale) : false;

  // rent explicitly disabled → order flow (even if daily_price column has legacy value)
  if (!rentEnabled) return "order";
  // sale explicitly enabled but rent NOT explicitly set → sale-only
  // (prevents "Забронировать" on bikes where daily_price exists from import
  // but the bike is actually only for sale per operator flag)
  if (saleEnabled && !hasExplicitRent) return "order";
  // Items with rental pricing and rent enabled → rental flow
  return item.pricePerDay > 0 ? "rental" : "order";
}

// Derive CTA label per-item from flow type + rent/sale availability
// NOTE: In the ItemModal, dual CTAs are shown when both rent+sale are available.
// This label is used on the catalog card CTA — keeps a single button per card.
function getItemCtaLabel(item: CatalogItemVM): string {
  const rs = item.rawSpecs;
  const hasExplicitRent = rs != null && "rent" in rs;
  const rentEnabled = hasExplicitRent ? isSpecEnabled(rs!.rent) : true;
  const flow = getItemFlowType(item);

  // Rent disabled (sale-only) → show "Купить" if sale price exists, else "Выбрать"
  if (!rentEnabled || flow === "order") {
    return hasSalePrice(item) ? "Купить" : "Выбрать";
  }
  // Rental flow → "Забронировать"
  return "Забронировать";
}

// ── RESTORED: Helper function deleted by agent but still referenced in grid path ──

// NOTE: getVisiblePriceLines was removed — price rendering is now inline (rentalbikes-style)
// with hasRentPrice/hasSalePrice from shared catalog-utils.ts

// Map common spec keys to emoji icons for card display
// FIX: Expanded pattern matching + return empty string instead of default ⚙️
// when no pattern matches — avoids showing meaningless gear icons on every spec
function specIconForKey(key: string): string {
  const k = key.toLowerCase();

  // ── Specific matches FIRST (avoid short substrings that match too broadly) ──

  // Power / horsepower
  if (k.includes("мощ") || k.includes("power") || k.includes("квт") || k.includes("kw") || k.includes("л.с") || k.includes("hp")) return "⚡";
  // Weight — MUST come before battery so "вес"/"weight" never mislabels as 🔋
  if (k.includes("вес") || k.includes("weight") || k.includes("масс")) return "⚖️";
  // Battery / capacity — specific tokens only; bare "в"/"v" removed (matched "вес", "velocity", etc.)
  if (
    k.includes("бат") || k.includes("bat") ||
    k.includes("ач") || k.includes("ah") ||
    k.includes("ёмкост") || k.includes("capacity") ||
    /\d\s*в\b/.test(k) ||           // "48В", "48 В" (digit + optional space + В at word boundary)
    /\d\s*v\b/.test(k) ||           // "48V", "48 V"
    k.includes("вольт") || k.includes("volt") ||
    k.endsWith(" в") || k.endsWith(",в") || k.endsWith(", в") ||  // trailing "в" with separator
    k.endsWith(" v") || k.endsWith(",v") || k.endsWith(", v")     // trailing "v" with separator
  ) return "🔋";
  // Range / distance
  if (k.includes("запас") || k.includes("ход") || k.includes("range") || k.includes("км") || k.includes("km") || k.includes("дальн")) return "📍";
  // Speed
  if (k.includes("скор") || k.includes("speed") || k.includes("км/ч") || k.includes("km/h")) return "🚀";
  // Mass units alone (e.g. "кг", "kg" not already caught by weight check above)
  if (k.includes("кг") || k.includes("kg")) return "⚖️";
  // Motor / engine
  if (k.includes("двиг") || k.includes("motor") || k.includes("engine") || k.includes("мотор")) return "🔧";
  // Brakes
  if (k.includes("торм") || k.includes("brake") || k.includes("диск")) return "🛑";
  // Transmission / gear
  if (k.includes("короб") || k.includes("transm") || k.includes("передач") || k.includes("gear")) return "🔩";
  // Suspension
  if (k.includes("подвес") || k.includes("susp") || k.includes("аморт")) return "🛞";
  // Frame / chassis
  if (k.includes("рам") || k.includes("frame") || k.includes("шасси")) return "🏗️";
  // Wheel / tire
  if (k.includes("колес") || k.includes("wheel") || k.includes("шин") || k.includes("tire")) return "🛞";
  // Display / screen
  if (k.includes("экран") || k.includes("display") || k.includes("дисплей")) return "📱";
  // Charge / connector
  if (k.includes("заряд") || k.includes("charge") || k.includes("разъём") || k.includes("порт")) return "🔌";
  // No match — return empty string (no icon) instead of default ⚙️
  return "";
}

// ── Spec chip builders ──
// The catalog card shows up to 3 spec chips. The OLD logic just took
// Object.entries(rawSpecs).slice(0,3) — which landed on whatever fields
// happened to be first in the JSON (year, chain type, rental count, …)
// regardless of how informative they were. These builders deliberately
// pick the three most decision-relevant specs, split by propulsion:
//   electric → power (kW), range (km), battery (А·ч)
//   gas/ICE  → power (л.с.), engine (см³), top speed (км/ч)
// Fallbacks fill the remaining slots so we still show 3 chips when a
// primary field is missing (e.g. electric bike with no range → show
// top speed instead). Falls back to the raw specs array only if the
// bike has none of the known keys at all.

type SpecChipDef = {
  keys: string[];
  icon: string;
  /** format the matched value into chip text */
  format: (raw: string | number) => string;
  /** optional: extract a sub-value from a rich string (e.g. "120Ah" out of "72V 120Ah (Li-ion)") */
  extract?: (raw: string) => string | null;
};

/** Parse a numeric spec, tolerating Russian units / ranges. Returns the
 *  rounded integer as a string, or — for range-like values like "90-150"
 *  or unparseable strings — the original string unchanged. */
function formatSpecNum(raw: string | number): string {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(Math.round(raw));
  const s = String(raw).trim();
  if (!s) return s;
  // Range-like ("90-150", "70–110", "90 to 150") → keep verbatim
  if (/[-–]\d/.test(s) || /\s(to|до)\s/i.test(s)) return s;
  const cleaned = s.replace(",", ".").replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return cleaned && Number.isFinite(n) ? String(Math.round(n)) : s;
}

/** Pull the Ah figure out of a battery string like "72V 120Ah (Li-ion, съёмная)". */
function extractAh(raw: string): string | null {
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*[AaАа]\s*[HhЧч]/);
  if (!m) return null;
  const ah = Number(m[1].replace(",", "."));
  return Number.isFinite(ah) ? `${Math.round(ah)} А·ч` : null;
}

function pickChip(rawSpecs: Record<string, unknown>, def: SpecChipDef): { icon: string; text: string } | null {
  for (const key of def.keys) {
    if (!(key in rawSpecs)) continue;
    const v = rawSpecs[key];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "object") continue; // skip nested (battery_options, etc.)
    const s = typeof v === "string" ? v.trim() : String(v);
    if (!s) continue;
    if (def.extract) {
      const extracted = def.extract(s);
      if (extracted) return { icon: def.icon, text: extracted };
      continue; // extraction failed → try next key
    }
    return { icon: def.icon, text: def.format(s) };
  }
  return null;
}

// Electric: power → range → battery, with top speed / charge time as fillers.
const ELECTRIC_CHIP_DEFS: SpecChipDef[] = [
  { keys: ["power_kw", "motor_nominal_kw", "motor_kw", "motor_peak_kw"], icon: "⚡", format: (v) => `${formatSpecNum(v)} кВт` },
  { keys: ["power_w"], icon: "⚡", format: (v) => `${Math.round((Number(String(v).replace(/[^\d.]/g, "")) || 0) / 1000)} кВт` },
  { keys: ["range_km", "max_range_km"], icon: "📍", format: (v) => `${formatSpecNum(v)} км` },
  { keys: ["battery", "battery_capacity", "battery_capacity_kwh"], icon: "🔋", format: (v) => v, extract: extractAh },
  { keys: ["top_speed_kmh", "max_speed_kmh"], icon: "🚀", format: (v) => `${formatSpecNum(v)} км/ч` },
  { keys: ["charge_time_h", "charging_time_h"], icon: "🔌", format: (v) => `${formatSpecNum(v)} ч` },
];

// Gas/ICE: power → displacement → top speed, with torque as filler.
const GAS_CHIP_DEFS: SpecChipDef[] = [
  { keys: ["power_hp", "horsepower", "hp", "bike_power_hp"], icon: "⚡", format: (v) => `${formatSpecNum(v)} л.с.` },
  { keys: ["engine_cc", "bike_engine_cc", "displacement_cc", "cc"], icon: "🔧", format: (v) => `${formatSpecNum(v)} см³` },
  { keys: ["top_speed_kmh", "max_speed_kmh"], icon: "🚀", format: (v) => `${formatSpecNum(v)} км/ч` },
  { keys: ["torque_nm"], icon: "🔩", format: (v) => `${formatSpecNum(v)} Н·м` },
];

function buildChipsFromDefs(rawSpecs: Record<string, unknown>, defs: SpecChipDef[]): Array<{ icon: string; text: string }> {
  const chips: Array<{ icon: string; text: string }> = [];
  for (const def of defs) {
    if (chips.length >= 3) break;
    const chip = pickChip(rawSpecs, def);
    // Skip if extraction failed, OR if an earlier def already produced the
    // same text (e.g. a bike exposes BOTH power_kw=3 and power_w=3000, which
    // both render as "3 кВт" — keep only the first).
    if (chip && !chips.some((c) => c.text === chip.text)) chips.push(chip);
  }
  return chips;
}

function getVisibleSpecChips(item: CatalogItemVM): Array<{ icon: string; text: string }> {
  type ItemWithSpecs = CatalogItemVM & {
    specs?: Array<{ key?: string; label?: string; value?: string; icon?: string }>;
    rawSpecs?: Record<string, unknown>;
    specChips?: Array<{ icon: string; text: string }>;
    subtitle?: string;
    category?: string;
  };

  const withSpecs = item as ItemWithSpecs;

  // 1. Pre-formatted specChips (explicit override from the data pipeline)
  if (Array.isArray(withSpecs.specChips) && withSpecs.specChips.length > 0) {
    return withSpecs.specChips.slice(0, 3);
  }

  const rawSpecs =
    withSpecs.rawSpecs && typeof withSpecs.rawSpecs === "object"
      ? (withSpecs.rawSpecs as Record<string, unknown>)
      : {};

  // 2. Propulsion-aware deliberate picks (power / range-or-cc / battery-or-speed)
  if (Object.keys(rawSpecs).length > 0) {
    const propulsion = getCatalogPropulsionSegment({
      title: item.title,
      subtitle: withSpecs.subtitle,
      description: item.description,
      category: withSpecs.category,
      rawSpecs,
    });
    const defs = propulsion === "gas" ? GAS_CHIP_DEFS : ELECTRIC_CHIP_DEFS;
    const chips = buildChipsFromDefs(rawSpecs, defs);
    if (chips.length > 0) return chips;
  }

  // 3. Last-resort fallback: structured specs array (label/value pairs)
  if (Array.isArray(withSpecs.specs) && withSpecs.specs.length > 0) {
    return withSpecs.specs
      .filter((s) => s.value || s.label)
      .slice(0, 3)
      .map((s) => ({
        icon: s.icon ?? specIconForKey(s.key ?? s.label ?? ""),
        text: s.value ?? s.label ?? "",
      }));
  }

  return [];
}

// ──────────────────────────────────────────────────────────────────────────────────

function CatalogCardSkeleton({ index }: { index: number }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--catalog-border)] bg-[var(--catalog-card-bg)]" aria-hidden="true">
      <div className="relative aspect-[9/16] overflow-hidden bg-[var(--catalog-card-bg)]">
        <div
          className="absolute inset-y-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/15 to-transparent"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      </div>
      <div className="space-y-3 p-3">
        <div className="h-4 w-2/3 rounded-full bg-[var(--catalog-muted)]/25" />
        <div className="h-3 w-full rounded-full bg-[var(--catalog-muted)]/20" />
        <div className="h-3 w-4/5 rounded-full bg-[var(--catalog-muted)]/20" />
        <div className="h-10 rounded-xl border-2 border-[var(--catalog-accent)]/30 bg-[var(--catalog-accent)]/10" />
      </div>
    </article>
  );
}

export function CatalogClient({ crew, slug, items, mode = "rental", ctaPolicy }: CatalogClientProps) {
  // Apply franchize theme CSS variables
  useFranchizeTheme(crew.theme);

  const surface = crewPaletteForSurface(crew.theme);
  // Get accent color for price glow computation
  const accentColor = crew.theme.isAuto
    ? (crew.theme.palettes?.light?.accentMain || crew.theme.palettes?.dark?.accentMain || crew.theme.palette.accentMain)
    : crew.theme.palette.accentMain;
  const priceGlowStyle = getContrastingGlowStyle(accentColor);
  const [selectedItem, setSelectedItem] = useState<CatalogItemVM | null>(null);
  const { addItem } = useFranchizeCart(crew.slug || slug);
  const [selectedOptions, setSelectedOptions] = useState({ package: "Базовый", duration: "1 день", perk: "Стандарт", auction: "Без аукциона", rentStartDate: todayISO(), rentEndDate: todayISO(), rentStartTime: "10:00", rentEndTime: "10:00" });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchCtaFocused, setSearchCtaFocused] = useState(false);
  const [clearFocused, setClearFocused] = useState(false);
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");
  const [campaignIndex, setCampaignIndex] = useState(0);
  const [carouselActiveByCategory, setCarouselActiveByCategory] = useState<Record<string, number>>({});
  const [carouselParallaxByItem, setCarouselParallaxByItem] = useState<Record<string, { x: number; y: number }>>({});
  const [carouselLoadedByItem, setCarouselLoadedByItem] = useState<Record<string, true>>({});
  const searchParams = useSearchParams();
  const { displayMode, isTransitioning } = useDisplayMode();
  const { user, dbUser } = useAppContext();
  const lastQueryViewedVehicleRef = useRef<string>("");
  const recordRentIntentRef = useRef<
    (item: CatalogItemVM, stage: "viewed" | "configured", metadata?: Record<string, unknown>) => Promise<unknown>
  >();
  const resolvedSlug = crew.slug || slug;
  const showFloatingCart = SHOW_CART && (ctaPolicy ? shouldShowFloatingCart(ctaPolicy, { cartRelevant: true }) : true);
  const carouselRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const promoModules = useMemo(() => {
    const now = Date.now();
    const parseDate = (value: string) => {
      if (!value) return Number.NaN;
      const ts = Date.parse(value);
      return Number.isNaN(ts) ? Number.NaN : ts;
    };

    const campaignPool = [
      ...(crew.catalog.promoBanners ?? []).map((item, index) => ({
        id: `${item.id}-${index}` ,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        imageUrl: item.imageUrl,
        badge: item.code || "Промо",
        priority: item.priority ?? 50,
        activeFrom: item.activeFrom ?? "",
        activeTo: item.activeTo ?? "",
        ctaLabel: item.ctaLabel || "Открыть",
      })),
      ...(crew.catalog.adCards ?? []).map((item, index) => ({
        id: `${item.id}-${index}` ,
        title: item.title,
        subtitle: item.subtitle,
        href: item.href,
        imageUrl: item.imageUrl,
        badge: item.badge || "Анонс",
        priority: item.priority ?? 40,
        activeFrom: item.activeFrom ?? "",
        activeTo: item.activeTo ?? "",
        ctaLabel: item.ctaLabel || "Подробнее",
      })),
    ];

    const activeCampaigns = campaignPool
      .filter((item) => item.title.trim().length > 0)
      .filter((item) => {
        const fromTs = parseDate(item.activeFrom);
        const toTs = parseDate(item.activeTo);
        const afterFrom = Number.isNaN(fromTs) ? true : now >= fromTs;
        const beforeTo = Number.isNaN(toTs) ? true : now <= toTs;
        return afterFrom && beforeTo;
      })
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    if (activeCampaigns.length > 0) {
      return activeCampaigns.slice(0, 5).map((item) => ({
        ...item,
        title: item.title.length > 84 ? `${item.title.slice(0, 81)}...` : item.title,
        href: item.href?.trim() || `/franchize/${crew.slug || slug}#catalog-sections`,
      }));
    }

    return crew.catalog.tickerItems.slice(0, 3).map((item, index) => ({
      id: `${item.id}-${index}`,
      title: item.text,
      subtitle: "",
      href: item.href?.trim() || `/franchize/${crew.slug || slug}#catalog-sections`,
      imageUrl: "",
      badge: "Промо",
      priority: 0,
      activeFrom: "",
      activeTo: "",
      ctaLabel: "Открыть",
    }));
  }, [crew.catalog.adCards, crew.catalog.promoBanners, crew.catalog.tickerItems, crew.slug, slug]);

  useEffect(() => {
    if (promoModules.length <= 3) {
      setCampaignIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setCampaignIndex((prev) => (prev + 1) % promoModules.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [promoModules]);

  const visiblePromoModules = useMemo(() => {
    if (promoModules.length <= 3) return promoModules;
    const windowed = [];
    for (let i = 0; i < 3; i += 1) {
      windowed.push(promoModules[(campaignIndex + i) % promoModules.length]);
    }
    return windowed;
  }, [campaignIndex, promoModules]);

  const auctionTickOptions = useMemo(() => {
    const fromCampaigns = promoModules
      .map((module) => module.badge?.trim() || module.title?.trim())
      .filter((value): value is string => Boolean(value && value.length > 0));

    return ["Без аукциона", ...Array.from(new Set(fromCampaigns)).slice(0, 6)];
  }, [promoModules]);

  const promoGradientByIndex = (index: number) => {
    const isLight = crew.theme.mode.toLowerCase().includes("light");
    const accentMain = crew.theme.isAuto
      ? (crew.theme.palettes?.light?.accentMain || crew.theme.palettes?.dark?.accentMain || crew.theme.palette.accentMain)
      : crew.theme.palette.accentMain;
    const gradients = isLight
      ? [
          `linear-gradient(130deg, ${accentMain}E0, #FF7F50D0)`,
          `linear-gradient(130deg, #8B5CF6D9, ${accentMain}D8)`,
          `linear-gradient(130deg, #F59E0BD1, #EF4444CC)`,
        ]
      : [
          `linear-gradient(130deg, ${accentMain}E0, #FF7F50D0)`,
          `linear-gradient(130deg, #8B5CF6D9, ${accentMain}D8)`,
          `linear-gradient(130deg, #22C55ED1, #06B6D4CC)`,
        ];

    return gradients[index % gradients.length];
  };

  const orderedCategories = useMemo(() => Array.from(new Set(items.map((item) => item.category).filter(Boolean))), [items]);

  const matchesQuickFilter = (item: CatalogItemVM, filter: QuickFilterKey) => {
    if (filter === "budget") {
      return item.pricePerDay <= 5000;
    }
    if (filter === "premium") {
      return item.pricePerDay >= 7000;
    }
    if (filter === "newbie") {
      return /naked|neo|scooter|300|400/i.test(`${item.category} ${item.title}`);
    }
    if (filter === "topRated") {
      return item.reviewSummary.count > 0 && item.reviewSummary.average >= 4.5;
    }
    if (filter === "entry" || filter === "mid" || filter === "pro") {
      return getItemAccessTier(item) === filter;
    }
    return true;
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      const matchesSearch = !query || [item.title, item.subtitle, item.description, item.category].join(" ").toLowerCase().includes(query);
      if (!matchesSearch) return false;
      return matchesQuickFilter(item, quickFilter);
    });
  }, [items, quickFilter, searchQuery]);

  const quickFilterCounts = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const searchFiltered = items.filter((item) => !query || [item.title, item.subtitle, item.description, item.category].join(" ").toLowerCase().includes(query));
    return QUICK_FILTERS.reduce<Record<QuickFilterKey, number>>(
      (acc, filter) => {
        acc[filter.key] = searchFiltered.filter((item) => matchesQuickFilter(item, filter.key)).length;
        return acc;
      },
      { all: 0, budget: 0, premium: 0, newbie: 0, topRated: 0, entry: 0, mid: 0, pro: 0 },
    );
  }, [items, searchQuery]);

  const itemsByCategory = useMemo(() => {
    const sortedFilteredItems = quickFilter === "topRated"
      ? [...filteredItems].sort((a, b) => (b.reviewSummary.average - a.reviewSummary.average) || (b.reviewSummary.count - a.reviewSummary.count))
      : filteredItems;

    // Filter by display mode (rent vs sale)
    const displayFiltered = sortedFilteredItems.filter(item => {
      if (displayMode === "rent") return hasRentPrice(item);
      return hasSalePrice(item);
    });

    const grouped = orderedCategories
      .map((category) => ({
        category,
        title: "",
        items: displayFiltered.filter((item) => item.category === category),
      }))
      .filter((group) => group.items.length > 0);

    const saleGroup = displayFiltered.filter((item) => item.saleAvailable);
    const saleCategory = mode === "electro" ? "Электроэндуро в продаже" : "В продаже";
    const baseGroups = grouped.filter((group) => group.category !== saleCategory);
    const normalized = sortWbItemLast(baseGroups);
    if (saleGroup.length === 0) return normalized;
    return [{ category: saleCategory, title: "", items: saleGroup }, ...normalized];
  }, [filteredItems, mode, orderedCategories, quickFilter, displayMode]);

  // ── VIP Bike Categorization (VIP Bike Landing & Catalog Improvements) ──
  // Categorize bikes by type + sale status for vip-bike franchize
  // Sort: R7 first (client's wish), then by year (newer first), then by price
  const sortVipBikeItems = (items: CatalogItemVM[]) => {
    return [...items].sort((a, b) => {
      // R7 always first (client's explicit wish)
      const aIsR7 = a.id.toLowerCase().includes('r7') || a.title.toLowerCase().includes('r7');
      const bIsR7 = b.id.toLowerCase().includes('r7') || b.title.toLowerCase().includes('r7');
      if (aIsR7 && !bIsR7) return -1;
      if (!aIsR7 && bIsR7) return 1;

      // Then by year (newer first)
      const rsA = a.rawSpecs as Record<string, unknown> | undefined;
      const rsB = b.rawSpecs as Record<string, unknown> | undefined;
      const yearA = Number(rsA?.year) || 0;
      const yearB = Number(rsB?.year) || 0;
      if (yearA !== yearB) return yearB - yearA;

      // Then by price (expensive first)
      if (b.pricePerDay !== a.pricePerDay) return b.pricePerDay - a.pricePerDay;

      // Then by rating
      return (b.reviewSummary.average || 0) - (a.reviewSummary.average || 0);
    });
  };

  const categorizedItems = useMemo(() => {
    const isRent = displayMode === "rent";

    // Filter by display mode
    const filtered = items.filter(item => {
      if (isRent) return hasRentPrice(item);
      return hasSalePrice(item);
    });

    const electric = filtered.filter(i =>
      (i.rawSpecs as Record<string, unknown> | undefined)?.type === "Electric"
    );
    const ice = filtered.filter(i =>
      (i.rawSpecs as Record<string, unknown> | undefined)?.type !== "Electric"
    );

    return [
      { category: "electric", title: "Электро", items: sortVipBikeItems(electric) },
      { category: "ice", title: "ДВС", items: sortVipBikeItems(ice) },
    ].filter(g => g.items.length > 0);
  }, [items, displayMode]);

  // Active groups for carousel rendering + IntersectionObserver
  // For vip-bike: use categorizedItems, for others: use itemsByCategory
  const activeGroupsForCarousel = useMemo(() => {
    return (slug === "vip-bike" || crew.slug === "vip-bike") ? categorizedItems : itemsByCategory;
  }, [slug, crew.slug, categorizedItems, itemsByCategory]);

  const recordRentIntent = useCallback((item: CatalogItemVM, stage: "viewed" | "configured", metadata: Record<string, unknown> = {}) => {
    const strip = buildCatalogRentalStrip(item, crew);
    return upsertFranchizeIntent({
      slug: resolvedSlug,
      bikeId: item.id,
      intentType: "rent",
      stage,
      sourceRoute: `/franchize/${resolvedSlug}`,
      contactChannel: "catalog_card",
      urgencyScore: stage === "configured" ? 68 : 42,
      telegramUserId: user?.id ? String(user.id) : dbUser?.user_id ? String(dbUser.user_id) : undefined,
      phone: typeof (dbUser as { phone?: unknown } | null)?.phone === "string" ? (dbUser as { phone?: string } | null)?.phone : undefined,
      metadata: {
        itemTitle: item.title,
        availabilityStatus: item.availabilityStatus,
        availabilityLabel: strip.availabilityLabel,
        nearestStartWindow: strip.nearestStartWindow,
        pickupHint: strip.pickupHint,
        priceTeaser: strip.priceTeaser,
        ...metadata,
      },
    }).catch((error) => console.warn("rent intent tracking failed", error));
  }, [crew, dbUser, resolvedSlug, user]);

  useEffect(() => {
    recordRentIntentRef.current = recordRentIntent;
  }, [recordRentIntent]);

  const openItem = (item: CatalogItemVM) => {
    setSelectedItem(item);
    // Focus the modal's close button after it renders
    setTimeout(() => {
      const closeButton = document.querySelector('[data-modal-close="true"]') as HTMLElement;
      closeButton?.focus();
    }, 100);
    const defaultOptions = {
      package: "Базовый",
      duration: "1 день",
      perk: "Стандарт",
      auction: auctionTickOptions[0] ?? "Без аукциона",
    };
    setSelectedOptions(defaultOptions);
    void recordRentIntent(item, "viewed", { trigger: "catalog_card", options: defaultOptions });
  };

  // Check for edit context from cart page
  useEffect(() => {
    const editContextStr = sessionStorage.getItem("franchize-edit-cart-line");
    if (!editContextStr) return;

    try {
      const editContext = JSON.parse(editContextStr);
      const item = items.find((i) => i.id === editContext.itemId);
      if (!item) return;

      // Open modal with the item and pre-filled options
      setSelectedItem(item);
      setSelectedOptions({
        package: editContext.options.package ?? "Базовый",
        duration: editContext.options.duration ?? "1 день",
        perk: editContext.options.perk ?? "Стандарт",
        auction: editContext.options.auction ?? "Без аукциона",
        rentStartDate: editContext.options.rentStartDate ?? todayISO(),
        rentEndDate: editContext.options.rentEndDate ?? todayISO(),
        rentStartTime: editContext.options.rentStartTime ?? "10:00",
        rentEndTime: editContext.options.rentEndTime ?? "10:00",
      });

      // Clear the edit context
      sessionStorage.removeItem("franchize-edit-cart-line");
    } catch (error) {
      console.warn("Failed to parse edit context:", error);
      sessionStorage.removeItem("franchize-edit-cart-line");
    }
  }, [items]);

  useEffect(() => {
    const focusedVehicle = (searchParams.get("vehicle") || "").trim().toLowerCase();
    if (!focusedVehicle) return;
    const target = items.find((item) => item.id.toLowerCase() === focusedVehicle);
    if (target && lastQueryViewedVehicleRef.current !== target.id) {
      lastQueryViewedVehicleRef.current = target.id;
      setSelectedItem(target);
      const defaultOptions = {
        package: "Базовый",
        duration: "1 день",
        perk: "Стандарт",
        auction: auctionTickOptions[0] ?? "Без аукциона",
      };
      setSelectedOptions(defaultOptions);
      void recordRentIntentRef.current?.(target, "viewed", { trigger: "vehicle_query", options: defaultOptions });
    }
  }, [auctionTickOptions, items, searchParams]);

  /**
   * Handle deep-link from Telegram bot (startapp state payload).
   *
   * When a bot (/doc, /buy, etc.) has already collected some user choices
   * (bike, dates, helmet, package), it encodes them in `startapp` and sends
   * a link. The redirect lands here with `?startappState=…` and companion
   * query params. We open the modal for the right bike and pre-fill the
   * already-known options so the user only needs to provide what's left
   * (e.g. personal info, payment).
   *
   * See: app/lib/startapp-state.ts for the encoding format.
   */
  useEffect(() => {
    const startappBikeId = (searchParams.get("startappBikeId") || "").trim();
    if (!startappBikeId) return;

    // Guard against re-triggering on every re-render — only run once per param set.
    if (lastQueryViewedVehicleRef.current === startappBikeId) return;

    const target = items.find((item) => item.id === startappBikeId);
    if (!target) {
      logger.warn("[startapp-state] bike not found in catalog", { bikeId: startappBikeId });
      return;
    }

    lastQueryViewedVehicleRef.current = startappBikeId;
    setSelectedItem(target);

    // Build pre-filled options from the query params.
    const extrasParts: string[] = [];
    const helmetCount = searchParams.get("helmetCount");
    if (helmetCount && Number(helmetCount) > 0) extrasParts.push(`🪖 Шлем ×${helmetCount}`);
    if (searchParams.get("extrasGloves") === "true") extrasParts.push("🧤 Перчатки");
    if (searchParams.get("extrasNet") === "true") extrasParts.push("🌐 Сеть");
    if (searchParams.get("extrasBag") === "true") extrasParts.push("👜 Сумка");
    if (searchParams.get("extrasJacket") === "true") extrasParts.push("🧥 Куртка");
    if (searchParams.get("extrasBoots") === "true") extrasParts.push("👢 Боты");
    if (searchParams.get("extrasBackpack") === "true") extrasParts.push("🎒 Рюкзак");
    if (searchParams.get("extrasCharger") === "true") extrasParts.push("🔌 Зарядка");

    const extrasSelection: Record<string, number | boolean> = {};
    if (helmetCount && Number(helmetCount) > 0) extrasSelection.helmet = Number(helmetCount);
    if (searchParams.get("extrasGloves") === "true") extrasSelection.gloves = true;
    if (searchParams.get("extrasNet") === "true") extrasSelection.net = true;
    if (searchParams.get("extrasBag") === "true") extrasSelection.bag = true;
    if (searchParams.get("extrasJacket") === "true") extrasSelection.jacket = true;
    if (searchParams.get("extrasBoots") === "true") extrasSelection.boots = true;
    if (searchParams.get("extrasBackpack") === "true") extrasSelection.backpack = true;
    if (searchParams.get("extrasCharger") === "true") extrasSelection.charger = true;

    const prefill: typeof selectedOptions & {
      rentStartTime?: string;
      rentEndTime?: string;
      extrasSelection?: Record<string, number | boolean>;
    } = {
      package: (searchParams.get("package") || "Базовый") as never,
      duration: "1 день",
      perk: (extrasParts.length > 0 ? extrasParts.join(", ") : (searchParams.get("perk") || "Стандарт")) as never,
      auction: auctionTickOptions[0] ?? "Без аукциона",
      rentStartDate: searchParams.get("startDate") || "",
      rentEndDate: searchParams.get("endDate") || "",
      rentStartTime: searchParams.get("startTime") || "",
      rentEndTime: searchParams.get("endTime") || "",
      extrasSelection: Object.keys(extrasSelection).length > 0 ? extrasSelection : undefined,
    };

    // Derive a duration label from the dates so the chip looks consistent.
    if (prefill.rentStartDate && prefill.rentEndDate) {
      const start = new Date(prefill.rentStartDate + "T00:00:00");
      const end = new Date(prefill.rentEndDate + "T00:00:00");
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      if (days === 1) prefill.duration = "1 день";
      else if (days <= 3) prefill.duration = "3 дня";
      else if (days <= 7) prefill.duration = "7 дней";
      else if (days <= 14) prefill.duration = "2 недели";
      else prefill.duration = "1 месяц";
    }

    setSelectedOptions(prefill);
    void recordRentIntentRef.current?.(target, "viewed", {
      trigger: "startapp_state",
      options: prefill,
    });

    // Show a one-time banner in the modal explaining the deep-link.
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "franchize-startapp-banner",
        JSON.stringify({
          ts: Date.now(),
          bikeId: startappBikeId,
          source: "telegram_bot",
        }),
      );
    }
  }, [auctionTickOptions, items, searchParams]);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const rafByCategory: Record<string, number | undefined> = {};
    const cleanupByCategory: Array<() => void> = [];

    activeGroupsForCarousel.forEach((group) => {
      if (group.items.length > 8) return;
      const root = carouselRefs.current[group.category || group.title || "section"];
      if (!root) return;
      const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-carousel-card='true']"));
      if (cards.length === 0) return;

      const groupKey = group.category || group.title || "section";

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!visible) return;
          const nextIndex = Number((visible.target as HTMLElement).dataset.carouselIndex ?? "0");
          setCarouselActiveByCategory((prev) => (prev[groupKey] === nextIndex ? prev : { ...prev, [groupKey]: nextIndex }));
        },
        { root, threshold: [0.55, 0.75] },
      );

      cards.forEach((card) => observer.observe(card));
      observers.push(observer);

      const onScroll = () => {
        if (rafByCategory[groupKey]) {
          window.cancelAnimationFrame(rafByCategory[groupKey] as number);
        }
        rafByCategory[groupKey] = window.requestAnimationFrame(() => {
          const slotWidth = cards[0]?.offsetWidth || 1;
          const gap = 12; // gap-3 = 0.75rem = 12px
          const nextIndex = Math.round(root.scrollLeft / (slotWidth + gap));
          setCarouselActiveByCategory((prev) => (prev[groupKey] === nextIndex ? prev : { ...prev, [groupKey]: nextIndex }));
          rafByCategory[groupKey] = undefined;
        });
      };

      root.addEventListener("scroll", onScroll, { passive: true });
      cleanupByCategory.push(() => root.removeEventListener("scroll", onScroll));
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
      Object.values(rafByCategory).forEach((id) => {
        if (id) window.cancelAnimationFrame(id);
      });
      cleanupByCategory.forEach((cleanup) => cleanup());
    };
  }, [activeGroupsForCarousel]);

  return (
    <>
      <section
        className="relative mx-auto w-full max-w-7xl px-4 pb-6 pt-8 xl:max-w-[1440px] 2xl:max-w-[1800px]"
        id="catalog-sections"
        style={{
          ["--catalog-accent" as string]: crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain,
          ["--catalog-accent-hover" as string]: crew.theme.isAuto ? "var(--franchize-accent-hover)" : crew.theme.palette.accentMainHover,
          ["--catalog-border" as string]: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
          ["--catalog-text" as string]: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
          ["--catalog-muted" as string]: crew.theme.isAuto ? "var(--franchize-text-secondary)" : crew.theme.palette.textSecondary,
          ["--catalog-card-bg" as string]: crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard,
          ["--catalog-bg" as string]: crew.theme.isAuto ? "var(--franchize-bg-base)" : crew.theme.palette.bgBase,
          ["--catalog-accent-contrast" as string]: crew.theme.isAuto
            ? readableTextOnColor(crew.theme.palettes?.dark?.accentMain || crew.theme.palettes?.light?.accentMain || crew.theme.palette.accentMain)
            : readableTextOnColor(crew.theme.palette.accentMain),
          ["--catalog-accent-muted-contrast" as string]: crew.theme.isAuto
            ? withAlpha(readableTextOnColor(crew.theme.palettes?.dark?.accentMain || crew.theme.palettes?.light?.accentMain || crew.theme.palette.accentMain), 0.7)
            : withAlpha(readableTextOnColor(crew.theme.palette.accentMain), 0.7),
          ["--catalog-accent-subtle" as string]: crew.theme.isAuto
            ? "var(--franchize-accent-main)"
            : withAlpha(crew.theme.palette.accentMain, 0.12),
        }}
      >
        {!crew.isFound && (
          <p className="mb-4 rounded-xl border border-[var(--catalog-accent)] px-3 py-2 text-sm text-[var(--catalog-accent)]">
            Crew slug was not found. Rendering safe fallback shell.
          </p>
        )}

        <div id="catalog-search" className="relative mb-5" role="search" aria-label="Поиск по каталогу">
          <label htmlFor="catalog-search-input" className="sr-only">
            Поиск по каталогу
          </label>
          <input
            id="catalog-search-input"
            type="text"
            placeholder="Найдите по названию или сценарию"
            autoComplete="off"
            aria-describedby="catalog-results-status"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-full border py-3 pl-5 pr-24 text-sm outline-none transition focus:border-transparent focus:ring-2 md:pr-36"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              boxShadow: `0 0 0 1px ${crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft}`,
              borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
              backgroundColor: crew.theme.isAuto ? "var(--franchize-bg-card)" : `${crew.theme.palette.bgCard}99`,
              color: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary,
              ...(searchFocused ? interactionRingStyle(crew.theme) : {}),
            }}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              aria-label="Очистить поиск по каталогу"
              onClick={() => setSearchQuery("")}
              className="absolute bottom-2 right-16 top-2 rounded-full px-3 text-xs font-medium transition active:scale-95 md:right-24"
              onFocus={() => setClearFocused(true)}
              onBlur={() => setClearFocused(false)}
              style={{
                backgroundColor: crew.theme.isAuto ? "var(--franchize-bg-base)" : `${crew.theme.palette.bgBase}F0`,
                color: crew.theme.isAuto ? "var(--franchize-text-secondary)" : crew.theme.palette.textSecondary,
                border: `1px solid ${crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft}`,
                ...(clearFocused ? interactionRingStyle(crew.theme) : {}),
              }}
            >
              Сброс
            </button>
          )}
          <button
            type="button"
            aria-label="Перейти к первой найденной позиции"
            onClick={() => {
              const firstResult = document.querySelector("[data-catalog-item-button='true']") as HTMLButtonElement | null;
              firstResult?.scrollIntoView({ behavior: "smooth", block: "center" });
              firstResult?.focus({ preventScroll: true });
            }}
            className="absolute bottom-1 right-1 top-1 rounded-full px-5 text-sm font-semibold transition active:scale-95"
            onFocus={() => setSearchCtaFocused(true)}
            onBlur={() => setSearchCtaFocused(false)}
            style={{
              backgroundColor: crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain,
              color: readableTextOnColor(crew.theme.isAuto
                ? (crew.theme.palettes?.dark?.accentMain || crew.theme.palettes?.light?.accentMain || crew.theme.palette.accentMain)
                : crew.theme.palette.accentMain),
              ...(searchCtaFocused ? interactionRingStyle(crew.theme) : {}),
            }}
          >
            Показать
          </button>
        </div>

        {promoModules.length > 0 && mode !== "electro" && (
          <div className="mb-5 flex gap-2 overflow-x-auto [overflow-y:clip] [touch-action:pan-y_pan-x] overscroll-behavior-x-contain pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track:bg-transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:bg-current/20] [&::-webkit-scrollbar-thumb:hover:bg-current/30] sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 sm:[&::-webkit-scrollbar]:hidden sm:[scrollbar-width:none]">
            {visiblePromoModules.map((module, index) => {
              const isExternal = /^(https?:|mailto:|tel:)/.test(module.href);
              return (
                <Link
                  key={module.id}
                  title={module.title}
                  href={module.href}
                  aria-label={`${module.ctaLabel}: ${module.title}`}
                  className="w-[85vw] shrink-0 rounded-2xl border p-3 transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--catalog-accent)] sm:w-auto"
                  style={{
                    borderColor: crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft,
                    background: promoGradientByIndex(index),
                  }}
                  prefetch={!isExternal}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noreferrer noopener" : undefined}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--catalog-accent-contrast)]">
                    {module.badge}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[var(--catalog-accent-contrast)]">
                    {module.title}
                  </p>
                  {module.subtitle && <p className="mt-1 text-xs text-[var(--catalog-accent-muted-contrast)]">{module.subtitle}</p>}
                  <p className="mt-2 text-xs font-semibold text-[var(--catalog-accent-contrast)]">
                    {module.ctaLabel} →
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        <p id="catalog-results-status" className="sr-only" aria-live="polite">
          Найдено позиций: {filteredItems.length}
        </p>

        <div className="mb-5 flex gap-2 overflow-x-auto [overflow-y:clip] [touch-action:pan-y_pan-x] overscroll-behavior-x-contain pb-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track:bg-transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:bg-current/20] [&::-webkit-scrollbar-thumb:hover:bg-current/30]" role="group" aria-label="Быстрые фильтры каталога">
          {QUICK_FILTERS.map((filter) => {
            const active = quickFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setQuickFilter(filter.key)}
                aria-pressed={active}
                className="shrink-0 rounded-full bg-[var(--quick-pill-bg)] px-3 py-1.5 text-xs font-medium text-[var(--quick-pill-text)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--catalog-accent)]"
                style={{
                  ["--quick-pill-bg" as string]: active
                    ? (filter.tierColor || (crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain))
                    : (crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard),
                  ["--quick-pill-text" as string]: active
                    ? readableTextOnColor(filter.tierColor || (crew.theme.isAuto
                        ? (crew.theme.palettes?.dark?.accentMain || crew.theme.palettes?.light?.accentMain || crew.theme.palette.accentMain)
                        : crew.theme.palette.accentMain))
                    : (crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary),
                  ...(active && filter.tierColor ? { boxShadow: `0 0 8px ${filter.tierColor}60` } : {}),
                }}
              >
                {filter.tierColor && <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: filter.tierColor }} />}
                {(filter.compactLabel ?? filter.label)} · {quickFilterCounts[filter.key]}
              </button>
            );
          })}
          {(quickFilter !== "all" || searchQuery.trim().length > 0) && (
            <button
              type="button"
              onClick={() => {
                setQuickFilter("all");
                setSearchQuery("");
              }}
              aria-label="Сбросить поиск и все быстрые фильтры"
              className="shrink-0 rounded-full bg-[var(--quick-pill-bg)] px-3 py-1.5 text-xs font-medium text-[var(--quick-pill-text)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--catalog-accent)]"
              style={{
                ["--quick-pill-bg" as string]: crew.theme.isAuto ? "var(--franchize-bg-card)" : crew.theme.palette.bgCard,
                ["--quick-pill-text" as string]: crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary
              }}
            >
              Сбросить всё
            </button>
          )}
        </div>

        {isTransitioning && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--catalog-bg)]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--catalog-accent)] border-t-transparent" />
              <p className="text-sm text-[var(--catalog-muted)]">Переключаем режим...</p>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <section aria-label="Загружаем каталог" className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--catalog-text)]">Каталог готовых выездов</h2>
              <span className="inline-flex rounded-full bg-[var(--catalog-card-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--catalog-muted)]">синхронизируем наличие</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((index) => <CatalogCardSkeleton key={index} index={index} />)}
            </div>
          </section>
        ) : activeGroupsForCarousel.length === 0 && !isTransitioning ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-6xl">🔍</div>
            <h3 className="mb-2 text-lg font-semibold text-[var(--catalog-text)]">
              {displayMode === "rent" ? "Нет байков в аренду" : "Нет байков для продажи"}
            </h3>
            <p className="mb-4 text-sm text-[var(--catalog-muted)]">
              {searchQuery
                ? "Попробуйте изменить поисковый запрос или сбросить фильтры"
                : "В этом режиме пока нет доступных байков"}
            </p>
            {(searchQuery || quickFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setQuickFilter("all");
                }}
                className="rounded-full bg-[var(--catalog-accent)] px-6 py-2 text-sm font-semibold text-[var(--catalog-accent-contrast)] transition hover:opacity-90"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {activeGroupsForCarousel.map((group) => (
              <section key={group.title || group.category || "section"} id={toCategoryId(group.title || group.category || "section")} data-category={group.title || group.category} data-count={group.items.length}>
                {group.title && (
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold uppercase leading-tight tracking-tight text-[var(--catalog-text)]">
                    {group.title || group.category}
                  </h2>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--catalog-card-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--catalog-muted)]">
                    {group.items.length} шт.
                  </span>
                </div>
                )}
                {group.items.length <= 8 ? (
                  <>
                    {/* ── CAROUSEL MODE (≤8 items) ── Cards aligned with reference design:
                        Image → Badges → Title → Specs (icon+text) → Price (large bold) → CTA */}
                    <div
                      ref={(node) => {
                        carouselRefs.current[group.category || group.title || "section"] = node;
                      }}
                      className="flex snap-x snap-mandatory gap-3 overflow-x-auto [overflow-y:clip] pt-1 pb-2 [touch-action:pan-y_pan-x] overscroll-behavior-x-contain [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track:bg-transparent] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:bg-current/20] [&::-webkit-scrollbar-thumb:hover:bg-current/30] sm:[&::-webkit-scrollbar]:h-2 sm:[&::-webkit-scrollbar-track]:rounded-full sm:[&::-webkit-scrollbar-track]:bg-transparent sm:[&::-webkit-scrollbar-thumb]:rounded-full sm:[&::-webkit-scrollbar-thumb:bg-current/20] sm:[&::-webkit-scrollbar-thumb:hover:bg-current/30]"
                      style={{ scrollbarWidth: "auto" }}
                      tabIndex={0}
                      role="region"
                      aria-label={`Карусель категории ${group.category}`}
                      onKeyDown={(event) => {
                        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                        const root = carouselRefs.current[group.category || group.title || "section"];
                        if (!root) return;
                        const step = root.clientWidth * 0.9;
                        root.scrollBy({ left: event.key === "ArrowRight" ? step : -step, behavior: "smooth" });
                      }}
                    >
                      {group.items.map((item, index) => {
                        const rentalStrip = buildCatalogRentalStrip(item, crew);
                        const parallax = carouselParallaxByItem[item.id] ?? { x: 0, y: 0 };
                        const specChips = getVisibleSpecChips(item);
                        return (
                    <article
                      key={item.id}
                      data-catalog-item="true"
                      data-carousel-card="true"
                      data-carousel-index={index}
                      className="group w-[calc(50vw-14px)] shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--catalog-border)] transition-[border-color] duration-300 hover:!border-[var(--catalog-accent)] sm:w-[220px] sm:max-w-[240px]"
                      style={catalogCardVariantStyles(crew.theme, item.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))}
                    >
                      <button
                        type="button"
                        aria-label={`Открыть карточку ${item.title}: ${item.rentPriceLabel}`}
                        data-catalog-item-button="true"
                        className="flex h-full w-full flex-col text-left"
                        onClick={() => openItem(item)}
                        onFocus={() => setFocusedItemId(item.id)}
                        onBlur={() => setFocusedItemId((prev) => (prev === item.id ? null : prev))}
                        style={focusedItemId === item.id ? interactionRingStyle(crew.theme) : undefined}
                        onPointerMove={(event) => {
                          if (event.pointerType === 'touch') return;
                          const rect = event.currentTarget.getBoundingClientRect();
                          const dx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
                          const dy = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
                          setCarouselParallaxByItem((prev) => ({ ...prev, [item.id]: { x: dx, y: dy } }));
                        }}
                        onPointerLeave={() => {
                          setCarouselParallaxByItem((prev) => ({ ...prev, [item.id]: { x: 0, y: 0 } }));
                        }}
                      >
                        {/* ── Image area (9:16 portrait) with speed badge ── */}
                        <div className="relative aspect-[9/16] w-full overflow-hidden">
                          {item.imageUrl && !carouselLoadedByItem[item.id] && (
                            <div className="absolute inset-0 overflow-hidden bg-[var(--catalog-bg)]/30">
                              <div className="absolute inset-y-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                            </div>
                          )}
                          {item.imageUrl ? (
                            <Image
                              src={localImageSrc(item.imageUrl)}
                              alt={item.title}
                              fill
                              sizes="(max-width: 1279px) 46vw, 220px"
                              className="object-cover transition-transform duration-300 ease-out"
                              style={{ transform: `scale(1.04) translate3d(${parallax.x * 4}px, ${parallax.y * 4}px, 0)` }}
                              onLoad={() => setCarouselLoadedByItem((prev) => ({ ...prev, [item.id]: true }))}
                              onError={handleImageError(item.imageUrl)}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs" style={surface.mutedText}>Фото загружается</div>
                          )}
                          {/* Speed / spec badge on image (rentalbikes-style) */}
                          {specChips.length > 0 && (
                            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                              {specChips.slice(0, 2).map((spec, si) => (
                                <span key={`${item.id}-badge-${si}`} className="inline-flex items-center gap-1 rounded-lg bg-[var(--catalog-bg)]/65 px-1.5 py-1 text-[9px] font-semibold text-[var(--catalog-accent)] backdrop-blur-sm">
                                  {spec.icon && <span className="text-[10px]">{spec.icon}</span>}
                                  {spec.text}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Availability dot on image top-right */}
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--catalog-bg)]/60 px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm" style={{ color: rentalStrip.isAvailable ? "#4ade80" : "#f87171" }}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rentalStrip.isAvailable ? "#4ade80" : "#f87171" }} />
                            {rentalStrip.availabilityLabel}
                          </span>
                        </div>

                        {/* ── Info + CTA area (rentalbikes-style: highlight on hover, unified container to avoid gap) ── */}
                        {/* flex-1 + flex-col fills the card height so the hover border aligns. */}
                        <div className="flex flex-1 flex-col rounded-b-2xl bg-[var(--catalog-card-bg)] p-3 transition-colors duration-300 group-hover:bg-[var(--catalog-accent)]">
                          {/* Badges row */}
                          <div className="mb-1 flex flex-wrap gap-1">
                            {item.isHot && (
                              <span className="inline-flex items-center rounded-full bg-[var(--catalog-accent)] px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--catalog-accent-contrast)] group-hover:bg-[var(--catalog-bg)]/20">
                                Хит
                              </span>
                            )}
                            {displayMode === "sale" && hasSalePrice(item) && <span className="inline-flex rounded-full border-2 border-[var(--catalog-accent)] bg-[var(--catalog-bg)] px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.02em] text-[var(--catalog-accent)] group-hover:bg-[var(--catalog-accent)] group-hover:text-[var(--catalog-accent-contrast)]">Продажа</span>}
                            {(() => { const tv = tierVisuals(getItemAccessTier(item)); return tv.label ? <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.02em] group-hover:bg-[var(--catalog-accent)] group-hover:text-[var(--catalog-accent-contrast)]" style={{ backgroundColor: `${tv.color}30`, color: tv.color, border: `1px solid ${tv.color}60` }}><span className="text-[7px]">{tv.emoji}</span>{tv.label}</span> : null; })()}
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-bold leading-5 text-[var(--catalog-text)] transition-colors duration-300 group-hover:text-[var(--catalog-accent-contrast)]">{item.title}</h3>

                          {/* Price — conditional on displayMode */}
                          <div className="mt-1.5">
                            {displayMode === "rent" ? (
                              <p className="text-base font-semibold text-[var(--catalog-accent)] transition-colors duration-300 group-hover:text-[var(--catalog-accent-contrast)]" style={priceGlowStyle}>
                                {item.rentPriceLabel}
                              </p>
                            ) : (
                              <p className="text-base font-semibold text-[var(--catalog-accent)] transition-colors duration-300 group-hover:text-[var(--catalog-accent-contrast)]" style={priceGlowStyle}>
                                {item.salePrice?.toLocaleString("ru-RU")} ₽
                              </p>
                            )}
                          </div>

                          {/* CTA button inside same container (rentalbikes-style: bordered, accent color) */}
                          <div className="mt-3">
                            <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[var(--catalog-accent)] px-2 py-2.5 text-xs font-bold uppercase tracking-[0.04em] text-[var(--catalog-accent)] transition-colors duration-300 group-hover:bg-[var(--catalog-accent)] group-hover:text-[var(--catalog-accent-contrast)] active:scale-95">
                              {displayMode === "rent" ? "Забронировать" : "Купить"}
                            </span>
                          </div>
                        </div>
                      </button>
                    </article>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-2" aria-label={`Пагинация карусели ${group.category}`}>
                      {(() => {
                        const groupKey = group.category || group.title || "section";
                        const activeIndex = carouselActiveByCategory[groupKey] ?? 0;
                        return group.items.map((item, index) => {
                          const isActive = activeIndex === index;
                          return (
                            <button
                              key={`${item.id}-dot`}
                              type="button"
                              aria-label={`Показать карточку ${index + 1}`}
                              aria-current={isActive ? "true" : undefined}
                              className="rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--catalog-accent)]"
                              style={{
                                width: isActive ? "24px" : "10px",
                                height: "10px",
                                backgroundColor: isActive
                                  ? (crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain)
                                  : (crew.theme.isAuto ? "var(--franchize-text-secondary)" : crew.theme.palette.textSecondary),
                                opacity: isActive ? 1 : 0.4,
                              }}
                              onClick={() => {
                                const root = carouselRefs.current[groupKey];
                                if (!root) return;
                                const slotWidth = root.querySelector<HTMLElement>("[data-carousel-card='true']")?.offsetWidth || root.clientWidth;
                                const gap = 12; // gap-3 = 0.75rem = 12px
                                root.scrollTo({ left: (slotWidth + gap) * index, behavior: "smooth" });
                              }}
                            />
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {group.items.map((item) => {
                    const rentalStrip = buildCatalogRentalStrip(item, crew);
                    const visibleSpecs = getVisibleSpecChips(item);
                    return (
                    <article
                      key={item.id}
                      data-catalog-item="true"
                      className="group overflow-hidden rounded-2xl border border-[var(--catalog-border)] transition-[border-color] duration-300 hover:!border-[var(--catalog-accent)]"
                      style={catalogCardVariantStyles(crew.theme, item.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))}
                    >
                      <button
                        type="button"
                        aria-label={`Открыть карточку ${item.title}: ${item.rentPriceLabel}`}
                        data-catalog-item-button="true"
                        className="flex h-full w-full flex-col text-left"
                        onClick={() => openItem(item)}
                        onFocus={() => setFocusedItemId(item.id)}
                        onBlur={() => setFocusedItemId((prev) => (prev === item.id ? null : prev))}
                        style={focusedItemId === item.id ? interactionRingStyle(crew.theme) : undefined}
                      >
                        {/* ── Image area (9:16 portrait) with spec badges ── */}
                        <div className="relative aspect-[9/16] w-full">
                          {item.imageUrl ? (
                            <Image
                              src={localImageSrc(item.imageUrl)}
                              alt={item.title}
                              fill
                              sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 16vw"
                              className="object-cover"
                              onError={handleImageError(item.imageUrl)}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs" style={surface.mutedText}>Фото загружается</div>
                          )}
                          {/* Spec badges on image (rentalbikes-style speedometer) */}
                          {visibleSpecs.length > 0 && (
                            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
                              {visibleSpecs.slice(0, 3).map((spec, index) => (
                                <span key={`${item.id}-spec-${index}`} className="inline-flex items-center gap-1 rounded-lg bg-[var(--catalog-bg)]/65 px-2 py-1 text-[10px] font-semibold text-[var(--catalog-accent)] backdrop-blur-sm">
                                  {spec.icon && <span className="text-[11px]">{spec.icon}</span>}
                                  {spec.text}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Availability dot on image top-right */}
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--catalog-bg)]/60 px-2 py-0.5 text-[9px] font-semibold backdrop-blur-sm" style={{ color: rentalStrip.isAvailable ? "#4ade80" : "#f87171" }}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rentalStrip.isAvailable ? "#4ade80" : "#f87171" }} />
                            {rentalStrip.availabilityLabel}
                          </span>
                        </div>

                        {/* ── Info + CTA area (rentalbikes-style: highlight on hover, unified container) ── */}
                        {/* flex-1 + flex-col so this area grows to fill the card height (the
                            image is fixed aspect-[9/16]). Without this, shorter cards left a
                            gap between the content and the article border, so the hover border
                            looked misaligned on shorter cards in a stretched grid/carousel row. */}
                        <div className="flex flex-1 flex-col rounded-b-2xl bg-[var(--catalog-card-bg)] p-3 transition-colors duration-300 group-hover:bg-[var(--catalog-accent)]">
                          {/* Badges row */}
                          <div className="mb-1 flex flex-wrap gap-1">
                            {item.isHot && (
                              <span className="inline-flex items-center rounded-full bg-[var(--catalog-accent)] px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--catalog-accent-contrast)] group-hover:bg-[var(--catalog-bg)]/20">
                                Хит
                              </span>
                            )}
                            {displayMode === "sale" && hasSalePrice(item) && <span className="inline-flex rounded-full border-2 border-[var(--catalog-accent)] bg-[var(--catalog-bg)] px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.02em] text-[var(--catalog-accent)] group-hover:bg-[var(--catalog-accent)] group-hover:text-[var(--catalog-accent-contrast)]">Продажа</span>}
                            {(() => { const tv = tierVisuals(getItemAccessTier(item)); return tv.label ? <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[8px] font-semibold tracking-[0.02em] group-hover:bg-[var(--catalog-accent)] group-hover:text-[var(--catalog-accent-contrast)]" style={{ backgroundColor: `${tv.color}30`, color: tv.color, border: `1px solid ${tv.color}60` }}><span className="text-[7px]">{tv.emoji}</span>{tv.label}</span> : null; })()}
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-bold leading-5 text-[var(--catalog-text)] transition-colors duration-300 group-hover:text-[var(--catalog-accent-contrast)]">{item.title}</h3>

                          {/* Price — conditional on displayMode */}
                          <div className="mt-1.5">
                            {displayMode === "rent" ? (
                              <p className="text-base font-semibold text-[var(--catalog-accent)] transition-colors duration-300 group-hover:text-[var(--catalog-accent-contrast)]" style={priceGlowStyle}>
                                {item.rentPriceLabel}
                              </p>
                            ) : (
                              <p className="text-base font-semibold text-[var(--catalog-accent)] transition-colors duration-300 group-hover:text-[var(--catalog-accent-contrast)]" style={priceGlowStyle}>
                                {item.salePrice?.toLocaleString("ru-RU")} ₽
                              </p>
                            )}
                          </div>

                          {/* CTA button inside same container (rentalbikes-style: bordered, accent color) */}
                          <div className="mt-3">
                            <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[var(--catalog-accent)] px-2 py-2 text-xs font-bold uppercase tracking-[0.04em] text-[var(--catalog-accent)] transition-colors duration-300 group-hover:bg-[var(--catalog-accent)] group-hover:text-[var(--catalog-accent-contrast)] active:scale-95">
                              {displayMode === "rent" ? "Забронировать" : "Купить"}
                            </span>
                          </div>
                        </div>
                      </button>
                    </article>
                    );
                  })}
                </div>
                )}
              </section>
            ))}
          </div>
        )}
      </section>

      {/* 🛒 Floating Cart: Hide when modal is open to avoid z-index overlap */}
      {!selectedItem && showFloatingCart && (
        <FloatingCartIconLinkBySlug
          slug={resolvedSlug}
          href={`/franchize/${resolvedSlug}/cart`}
          items={items}
          accentColor={crew.theme.isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain}
          textColor={crew.theme.isAuto ? "var(--franchize-text-primary)" : crew.theme.palette.textPrimary}
          borderColor={crew.theme.isAuto ? "var(--franchize-border-soft)" : crew.theme.palette.borderSoft}
          theme={crew.theme}
          className={ctaPolicy?.floatingCartClassName}
        />
      )}

      <ItemModal
        item={selectedItem}
        items={items}
        slug={resolvedSlug}
        theme={crew.theme}
        pickupAddress={crew.contacts.address || crew.hqLocation}
        workingHours={crew.contacts.workingHours}
        flowType={displayMode === "rent" ? "rental" : "order"}
        displayMode={displayMode}
        options={selectedOptions}
        auctionOptions={auctionTickOptions}
        onChangeOption={(key, value) => setSelectedOptions((prev) => ({ ...prev, [key]: value }))}
        onBuyItem={() => {
          if (!selectedItem) return;
          void recordRentIntent(selectedItem, "configured", {
            trigger: "modal_buy_cta",
            options: { ...selectedOptions, action: "buy" },
          });
          addItem(selectedItem.id, { action: "buy" }, 1);
          setSelectedItem(null);
        }}
        onClose={() => setSelectedItem(null)}
        onTestdrive={() => {
          if (!selectedItem) return;
          void recordRentIntent(selectedItem, "configured", {
            trigger: "modal_testdrive_cta",
            options: { ...selectedOptions, action: "testdrive" },
          });
          // Testdrive: add to cart with testdrive action — duration is 10min (hardcoded)
          addItem(selectedItem.id, {
            ...selectedOptions,
            action: "testdrive",
            duration: "10 минут",
          }, 1);
          setSelectedItem(null);
        }}
        onAddToCart={(extrasStr) => {
          if (!selectedItem) return;
          const cartOptions = {
            ...selectedOptions,
            action: "rent",
            // FIX: extrasStr from handler bypasses stale selectedOptions.perk
            perk: extrasStr || selectedOptions.perk || "стандарт",
          };
          void recordRentIntent(selectedItem, "configured", {
            trigger: "modal_rent_cta",
            options: cartOptions,
          });
          addItem(selectedItem.id, cartOptions, 1);
          setSelectedItem(null);
        }}
      />
    </>
  );
}