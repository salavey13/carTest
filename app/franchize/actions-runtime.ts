"use server";

import { createInvoice, supabaseAdmin } from "@/lib/supabase-server";
import { notifyAdmin, sendTelegramDocument, sendTelegramInvoice } from "@/app/actions";
import { logger } from "@/lib/logger";
import nodemailer from "nodemailer";
import { z } from "zod";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { getCrewSensitiveDataOrDefault, getUserSensitiveDataOrDefault, saveCrewSensitiveData } from "@/lib/private-secrets";
import { getUserRentalSecrets as getVerifiedRentalSecrets, saveUserRentalSecrets } from "@/app/lib/user-rental-secrets";
import { buildFranchizeDocxFromTemplate, uploadDocxToStorage } from "@/app/franchize/lib/docx-capability";
import { upsertFranchizeIntent } from "@/app/franchize/server-actions/intents";
import { cloneFranchizeContentBlocks, readFranchizeContentBlocks, type FranchizeContentBlocks } from "@/app/franchize/lib/content-blocks";
import { resolveFranchizeTheme, resolvePaletteByMode } from "@/app/franchize/lib/theme-resolver";
import { isTrustedTelegramBypassDeployment } from "@/lib/telegram-bypass-context";
import { computeTelegramWebAppHash } from "@/lib/telegram-webapp-auth";
import { CURRENT_RENTAL_TEMPLATE_VERSION } from "@/lib/rental-template-version";
import { buildRentalContractVariables, type CrewSecrets as RentalCrewSecrets, type RentalContractVariables } from "@/app/lib/rental-contract-vars";
import { resolveCrewOwnerChatId } from "@/lib/rental-date-utils";
import type { FranchizeTheme } from "@/lib/franchize-config";
import { formatRuDate } from "@/app/franchize/lib/date-utils";
import {
  DEFAULT_AD_CARDS_TEXT,
  DEFAULT_CATEGORY_ORDER,
  DEFAULT_CONTRACT_PREFILL,
  DEFAULT_DELIVERY_MODES_TEXT,
  DEFAULT_FOOTER_TEXT_COLOR,
  DEFAULT_FRANCHIZE_BRAND,
  DEFAULT_FRANCHIZE_THEME,
  DEFAULT_LIGHT_THEME_PALETTE,
  DEFAULT_MAP_BOUNDS,
  DEFAULT_MAP_GPS,
  DEFAULT_MAP_IMAGE_URL,
  DEFAULT_MENU_LINK_TEMPLATES,
  DEFAULT_PAYMENT_OPTIONS_TEXT,
  DEFAULT_PROMO_BANNERS_TEXT,
  DEFAULT_SHOWCASE_GROUPS,
  DEFAULT_SOCIAL_LINKS_TEXT,
  DEFAULT_TELEGRAM_BOT_URL,
} from "@/lib/franchize-config";


type UnknownRecord = Record<string, unknown>;
const FRANCHIZE_RENTAL_DOCS_SAFE_ERROR =
  "Не удалось подготовить документы аренды. Мы уже передали заявку оператору — попробуйте ещё раз или напишите в Telegram.";

function logFranchizeCheckoutFailure(
  failureSource: "submitFranchizeOrderNotification" | "createFranchizeOrderCheckout",
  context: { slug: string; orderId: string },
  error: unknown,
) {
  logger.error(`[franchize] ${failureSource} failed`, {
    slug: context.slug,
    orderId: context.orderId,
    failureSource,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
}

type RentalAvailabilityRow = {
  rental_id: string | null;
  vehicle_id: string | null;
  status: string | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  requested_end_date: string | null;
};

/**
 * Grace window added to a rental's agreed_end_date before we treat the bike
 * as available again. Absorbs three real-world cases:
 *   1. Late returns — renter due at 14:00, actually returns at 18:00.
 *   2. Bare-date storage — agreed_end_date stored as a calendar date
 *      ("2026-06-16") parses as midnight UTC, so end-of-day on the 16th
 *      would otherwise look "past" by 23:59 the same day.
 *   3. Timezone fuzz between client entry and server interpretation.
 *
 * The status column alone is NOT authoritative: operators often forget to
 * flip rentals from "active" to "completed" after return, so this date-based
 * gate (with grace) is what actually decides availability in the catalog.
 */
const RENTAL_END_GRACE_MS = 24 * 60 * 60 * 1000; // 24 hours

export type { FranchizeTheme } from "@/lib/franchize-config";

export interface FranchizeHeaderVM {
  brandName: string;
  tagline: string;
  logoUrl: string;
  logoHref: string;
  menuLinks: Array<{ label: string; href: string }>;
}


export interface FranchizeSuccessfulRentalVM {
  rentalId: string;
  status: string;
  bikeId: string;
  bikeName: string;
  renterName: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  contractStatus: "verified" | "pending" | "revoked" | "none" | string;
}

export interface RentalReviewVM {
  id: string;
  rentalId: string;
  userId: string;
  bikeId: string;
  crewId: string;
  rating: number;
  text: string;
  createdAt: string;
  hiddenAt?: string | null;
}

export interface RentalReviewSummaryVM {
  average: number;
  count: number;
  latest?: RentalReviewVM;
  reviews: RentalReviewVM[];
}

export interface CatalogItemVM {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  mediaUrls: string[];
  pricePerDay: number;
  rentPriceLabel: string;
  category: string;
  availabilityStatus: "available" | "busy";
  availabilityLabel: string;
  isHot: boolean;
  saleAvailable: boolean;
  salePrice: number | null;
  specs: Array<{ label: string; value: string }>;
  rawSpecs?: Record<string, unknown>;
  reviewSummary: RentalReviewSummaryVM;
}

export interface FranchizeCrewVM {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string;
  hqLocation: string;
  isFound: boolean;
  theme: FranchizeTheme;
  header: FranchizeHeaderVM;
  contacts: {
    phone: string;
    email: string;
    address: string;
    telegram: string;
    telegramBotUsername: string;
    workingHours: string;
    map: {
      id?: string;
      gps: string;
      publicTransport: string;
      carDirections: string;
      imageUrl: string;
      bounds: {
        top: number;
        bottom: number;
        left: number;
        right: number;
      };
    };
  };
  catalog: {
    categories: string[];
    quickLinks: string[];
    tickerItems: Array<{ id: string; text: string; href: string }>;
    promoBanners: Array<{ id: string; title: string; subtitle: string; code: string; href: string; imageUrl: string; priority: number; activeFrom: string; activeTo: string; ctaLabel: string }>;
    adCards: Array<{ id: string; title: string; subtitle: string; href: string; imageUrl: string; badge: string; priority: number; activeFrom: string; activeTo: string; ctaLabel: string }>;
    showcaseGroups: Array<{
      id: string;
      label: string;
      mode: "subtype" | "price";
      subtype?: string;
      minPrice?: number;
      maxPrice?: number;
    }>;
  };
  ratingSummary: {
    average: number;
    count: number;
  };
  footer: {
    socialLinks: Array<{ label: string; href: string }>;
    columns: Array<{
      title: string;
      items: Array<{
        type: "link" | "external" | "text" | "phone";
        label?: string;
        value?: string;
        href?: string;
        icon?: string;
      }>;
    }>;
    textColor: string;
  };
  reservationHold: FranchizeReservationHoldVM;
  contentBlocks: FranchizeContentBlocks;
}

export interface FranchizeReservationHoldVM {
  amountRub: number;
  amountXtr: number;
  percent: number | null;
  label: string;
  invoiceLabel: string;
  pickupAddress: string;
  requiredDocs: string[];
}

export interface FranchizeBySlugResult {
  crew: FranchizeCrewVM;
  items: CatalogItemVM[];
}

export interface FranchizeConfigInput {
  slug: string;
  brandName: string;
  tagline: string;
  logoUrl: string;
  themeMode: string;
  bgBase: string;
  bgCard: string;
  accentMain: string;
  accentMainHover: string;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
  lightBgBase: string;
  lightBgCard: string;
  lightAccentMain: string;
  lightAccentMainHover: string;
  lightTextPrimary: string;
  lightTextSecondary: string;
  lightBorderSoft: string;
  phone: string;
  email: string;
  address: string;
  telegram: string;
  mapGps: string;
  mapImageUrl: string;
  mapBoundsTop: string;
  mapBoundsBottom: string;
  mapBoundsLeft: string;
  mapBoundsRight: string;
  socialLinksText: string;
  menuLinksText: string;
  categoryOrderText: string;
  promoBannersText: string;
  adCardsText: string;
  allowPromo: boolean;
  deliveryModesText: string;
  paymentOptionsText: string;
  defaultMode: string;
  issuerName: string;
  issuerRepresentative: string;
  includedMileage: string;
  overageRateRub: string;
  bikeValueRub: string;
  bikeValueWords: string;
  lateReturnPenaltyRub: string;
  returnAddress: string;
  contractDefaultsJson: string;
  docTemplatesJson: string;
  advancedJson: string;
}

export interface FranchizeConfigState {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: FranchizeConfigInput;
  canEdit?: boolean;
}

const defaultTheme = DEFAULT_FRANCHIZE_THEME;

const franchizeConfigSchema = z.object({
  slug: z.string().trim().min(2, "Slug is required"),
  brandName: z.string().trim().min(2, "Brand name is required"),
  tagline: z.string().trim().min(2, "Tagline is required"),
  logoUrl: z.string().trim().optional(),
  themeMode: z.string().trim().min(2, "Theme mode is required"),
  bgBase: z.string().trim().min(4, "bgBase is required"),
  bgCard: z.string().trim().min(4, "bgCard is required"),
  accentMain: z.string().trim().min(4, "accentMain is required"),
  accentMainHover: z.string().trim().min(4, "accentMainHover is required"),
  textPrimary: z.string().trim().min(4, "textPrimary is required"),
  textSecondary: z.string().trim().min(4, "textSecondary is required"),
  borderSoft: z.string().trim().min(4, "borderSoft is required"),
  lightBgBase: z.string().trim().min(4, "lightBgBase is required"),
  lightBgCard: z.string().trim().min(4, "lightBgCard is required"),
  lightAccentMain: z.string().trim().min(4, "lightAccentMain is required"),
  lightAccentMainHover: z.string().trim().min(4, "lightAccentMainHover is required"),
  lightTextPrimary: z.string().trim().min(4, "lightTextPrimary is required"),
  lightTextSecondary: z.string().trim().min(4, "lightTextSecondary is required"),
  lightBorderSoft: z.string().trim().min(4, "lightBorderSoft is required"),
  phone: z.string().trim().default(""),
  email: z.string().trim().default(""),
  address: z.string().trim().default(""),
  telegram: z.string().trim().default(""),
  mapGps: z.string().trim().default(""),
  mapImageUrl: z.string().trim().default(""),
  mapBoundsTop: z.string().trim().default(String(DEFAULT_MAP_BOUNDS.top)),
  mapBoundsBottom: z.string().trim().default(String(DEFAULT_MAP_BOUNDS.bottom)),
  mapBoundsLeft: z.string().trim().default(String(DEFAULT_MAP_BOUNDS.left)),
  mapBoundsRight: z.string().trim().default(String(DEFAULT_MAP_BOUNDS.right)),
  socialLinksText: z.string().default(DEFAULT_SOCIAL_LINKS_TEXT),
  menuLinksText: z.string().default(""),
  categoryOrderText: z.string().default(""),
  promoBannersText: z.string().default(""),
  adCardsText: z.string().default(""),
  allowPromo: z.coerce.boolean().default(true),
  deliveryModesText: z.string().default(DEFAULT_DELIVERY_MODES_TEXT),
  paymentOptionsText: z.string().default(DEFAULT_PAYMENT_OPTIONS_TEXT),
  defaultMode: z.string().trim().default("pickup"),
  issuerName: z.string().trim().default(""),
  issuerRepresentative: z.string().trim().default(""),
  includedMileage: z.string().trim().default(""),
  overageRateRub: z.string().trim().default(""),
  bikeValueRub: z.string().trim().default(""),
  bikeValueWords: z.string().trim().default(""),
  lateReturnPenaltyRub: z.string().trim().default(""),
  returnAddress: z.string().trim().default(""),
  contractDefaultsJson: z.string().default(""),
  docTemplatesJson: z.string().default(""),
  advancedJson: z.string().default(""),
});

const defaultFranchizeConfig: FranchizeConfigInput = {
  slug: "",
  brandName: DEFAULT_FRANCHIZE_BRAND.brandName,
  tagline: DEFAULT_FRANCHIZE_BRAND.tagline,
  logoUrl: "",
  themeMode: defaultTheme.mode,
  bgBase: defaultTheme.palette.bgBase,
  bgCard: defaultTheme.palette.bgCard,
  accentMain: defaultTheme.palette.accentMain,
  accentMainHover: defaultTheme.palette.accentMainHover,
  textPrimary: defaultTheme.palette.textPrimary,
  textSecondary: defaultTheme.palette.textSecondary,
  borderSoft: defaultTheme.palette.borderSoft,
  lightBgBase: DEFAULT_LIGHT_THEME_PALETTE.bgBase,
  lightBgCard: DEFAULT_LIGHT_THEME_PALETTE.bgCard,
  lightAccentMain: DEFAULT_LIGHT_THEME_PALETTE.accentMain,
  lightAccentMainHover: DEFAULT_LIGHT_THEME_PALETTE.accentMainHover,
  lightTextPrimary: DEFAULT_LIGHT_THEME_PALETTE.textPrimary,
  lightTextSecondary: DEFAULT_LIGHT_THEME_PALETTE.textSecondary,
  lightBorderSoft: DEFAULT_LIGHT_THEME_PALETTE.borderSoft,
  phone: "",
  email: "",
  address: "",
  telegram: "",
  mapGps: DEFAULT_MAP_GPS,
  mapImageUrl: DEFAULT_MAP_IMAGE_URL,
  mapBoundsTop: String(DEFAULT_MAP_BOUNDS.top),
  mapBoundsBottom: String(DEFAULT_MAP_BOUNDS.bottom),
  mapBoundsLeft: String(DEFAULT_MAP_BOUNDS.left),
  mapBoundsRight: String(DEFAULT_MAP_BOUNDS.right),
  socialLinksText: DEFAULT_SOCIAL_LINKS_TEXT,
  menuLinksText: DEFAULT_MENU_LINK_TEMPLATES.map((link) => `${link.label}|${link.href}`).join("\n"),
  categoryOrderText: DEFAULT_CATEGORY_ORDER,
  promoBannersText: DEFAULT_PROMO_BANNERS_TEXT,
  adCardsText: DEFAULT_AD_CARDS_TEXT,
  allowPromo: true,
  deliveryModesText: DEFAULT_DELIVERY_MODES_TEXT,
  paymentOptionsText: DEFAULT_PAYMENT_OPTIONS_TEXT,
  defaultMode: "pickup",
  issuerName: "",
  issuerRepresentative: "",
  includedMileage: DEFAULT_CONTRACT_PREFILL.includedMileage,
  overageRateRub: DEFAULT_CONTRACT_PREFILL.overageRateRub,
  bikeValueRub: DEFAULT_CONTRACT_PREFILL.bikeValueRub,
  bikeValueWords: DEFAULT_CONTRACT_PREFILL.bikeValueWords,
  lateReturnPenaltyRub: DEFAULT_CONTRACT_PREFILL.lateReturnPenaltyRub,
  returnAddress: DEFAULT_CONTRACT_PREFILL.returnAddress,
  contractDefaultsJson: "",
  docTemplatesJson: "",
  advancedJson: "",
};

function readPath<T>(obj: unknown, path: string[], fallback: T): T {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return fallback;
    }
    current = (current as UnknownRecord)[key];
  }
  return (current as T) ?? fallback;
}

function readNumberPath(obj: unknown, paths: string[][], fallback = 0): number {
  for (const path of paths) {
    const value = readPath<unknown>(obj, path, undefined);
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
}

function buildFranchizeReservationHold(franchize: UnknownRecord, fallbackAddress: string): FranchizeReservationHoldVM {
  const config = readPath<UnknownRecord>(franchize, ["order", "reservationHold"], readPath<UnknownRecord>(franchize, ["reservationHold"], {}));
  const amountRub = Math.max(1, Math.round(readNumberPath(config, [["amountRub"], ["amount_rub"], ["depositRub"], ["deposit_rub"]], 500)));
  const amountXtr = Math.max(1, Math.round(readNumberPath(config, [["amountXtr"], ["amount_xtr"], ["stars"], ["depositXtr"], ["deposit_xtr"]], amountRub)));
  const percentRaw = readNumberPath(config, [["percent"], ["depositPercent"], ["deposit_percent"]], 0);
  const percent = percentRaw > 0 ? percentRaw : null;
  const requiredDocs = readArrayPath<string>(config, ["requiredDocs"], ["Паспорт", "Документ, удостоверяющий личность", "Электронная подпись договора"]);
  const pickupAddress = readPath(config, ["pickupAddress"], readPath(franchize, ["contacts", "address"], fallbackAddress || "адрес выдачи подтвердит оператор"));
  const label = readPath(config, ["label"], `Забронировать за ${amountRub.toLocaleString("ru-RU")}₽ / ${amountXtr.toLocaleString("ru-RU")} XTR`);

  return {
    amountRub,
    amountXtr,
    percent,
    label,
    invoiceLabel: readPath(config, ["invoiceLabel"], `Бронь: ${amountXtr.toLocaleString("ru-RU")} XTR`),
    pickupAddress,
    requiredDocs,
  };
}

function toRentalReviewVM(row: UnknownRecord): RentalReviewVM {
  return {
    id: String(row.id ?? ""),
    rentalId: String(row.rental_id ?? ""),
    userId: String(row.user_id ?? ""),
    bikeId: String(row.bike_id ?? ""),
    crewId: String(row.crew_id ?? ""),
    rating: Math.min(5, Math.max(1, Number(row.rating ?? 0) || 1)),
    text: String(row.text ?? "").trim(),
    createdAt: String(row.created_at ?? ""),
    hiddenAt: typeof row.hidden_at === "string" ? row.hidden_at : null,
  };
}

function buildReviewSummary(reviews: RentalReviewVM[]): RentalReviewSummaryVM {
  const visible = reviews.filter((review) => !review.hiddenAt);
  const count = visible.length;
  const average = count > 0
    ? Math.round((visible.reduce((sum, review) => sum + review.rating, 0) / count) * 10) / 10
    : 0;
  return {
    average,
    count,
    latest: visible[0],
    reviews: visible,
  };
}


function groupReviewsByBike(rows: UnknownRecord[]): Map<string, RentalReviewVM[]> {
  const grouped = new Map<string, RentalReviewVM[]>();
  rows
    .map(toRentalReviewVM)
    .filter((review) => review.bikeId && !review.hiddenAt)
    .forEach((review) => {
      const list = grouped.get(review.bikeId) ?? [];
      list.push(review);
      grouped.set(review.bikeId, list);
    });

  grouped.forEach((list) => {
    list.sort((a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""));
  });

  return grouped;
}

function buildCrewRatingSummary(rows: UnknownRecord[]) {
  return buildReviewSummary(rows.map(toRentalReviewVM).filter((review) => !review.hiddenAt));
}

/*const fallbackMenuLinks = (slug: string) => [
  { label: "Каталог", href: `/franchize/${slug}` },
  { label: "Электроэндуро", href: `/franchize/${slug}/electro-enduro` },
  { label: "Конфигуратор", href: `/franchize/${slug}/configurator` },
  { label: "Map Riders", href: `/franchize/${slug}/map-riders` },
  { label: "О нас", href: `/franchize/${slug}/about` },
  { label: "Контакты", href: `/franchize/${slug}/contacts` },
  { label: "Корзина", href: `/franchize/${slug}/cart` },
];*/
function readArrayPath<T>(obj: unknown, path: string[], fallback: T[] = []): T[] {
  const value = readPath<unknown>(obj, path, fallback);
  return Array.isArray(value) ? (value as T[]) : fallback;
}

const fallbackMenuLinks = (slug: string) => DEFAULT_MENU_LINK_TEMPLATES.map((link) => ({
  label: link.label,
  href: withSlug(link.href, slug),
}));

function normalizeCrewSlug(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/%20/g, " ")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-");
}

const withSlug = (href: string, slug: string) => {
  if (!href) {
    return href;
  }

  if (href.includes("{slug}")) {
    return href.replaceAll("{slug}", slug);
  }

  switch (href) {
    case "/franchize/about":
      return `/franchize/${slug}/about`;
    case "/franchize/contacts":
      return `/franchize/${slug}/contacts`;
    case "/franchize/cart":
      return `/franchize/${slug}/cart`;
    case "/franchize/rentals":
      return `/franchize/${slug}/rentals`;
    default:
      return href;
  }
};

function parseSocialLinks(lines: string): Array<{ label: string; href: string }> {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|").map((value) => value.trim());
      return { label: label || "Social", href: href || DEFAULT_TELEGRAM_BOT_URL };
    });
}

function extractFooterSocialLinks(franchize: UnknownRecord, fallbackTelegram: string) {
  const explicit = readArrayPath<UnknownRecord>(franchize, ["footer", "socialLinks"]);
  const fromExplicit = explicit
    .map((item) => ({ label: readPath(item, ["label"], ""), href: readPath(item, ["href"], "") }))
    .filter((item) => item.label && item.href);

  if (fromExplicit.length > 0) return fromExplicit;

  const columns = readArrayPath<UnknownRecord>(franchize, ["footer", "columns"]);
  const fromColumns = columns.flatMap((column) => {
    const items = readArrayPath<UnknownRecord>(column, ["items"]);
    return items
      .map((item) => ({
        label: readPath(item, ["label"], readPath(item, ["value"], "")),
        href: readPath(item, ["href"], ""),
      }))
      .filter((entry) => entry.label && entry.href);
  });

  if (fromColumns.length > 0) return fromColumns;

  if (fallbackTelegram) {
    return [{ label: fallbackTelegram, href: `https://t.me/${fallbackTelegram.replace("@", "")}` }];
  }

  return [{ label: "Telegram", href: DEFAULT_TELEGRAM_BOT_URL }];
}

function extractFooterColumns(franchize: UnknownRecord, slug: string) {
  const rawColumns = readArrayPath<UnknownRecord>(franchize, ["footer", "columns"]);
  if (rawColumns.length === 0) return [];

  const withSlug = (href: string) =>
    href.includes("{slug}") ? href.replaceAll("{slug}", slug) : href;

  return rawColumns.map((col) => ({
    title: readPath(col, ["title"], ""),
    items: (readArrayPath<UnknownRecord>(col, ["items"])).map((item) => ({
      type: readPath(item, ["type"], "text") as "link" | "external" | "text" | "phone",
      label: readPath(item, ["label"], ""),
      value: readPath(item, ["value"], ""),
      href: item.href ? withSlug(readPath(item, ["href"], "")) : undefined,
      icon: readPath(item, ["icon"], ""),
    })),
  })).filter((col) => col.title || col.items.length > 0);
}

const emptyCrew = (slug: string): FranchizeCrewVM => ({
  id: "",
  slug,
  name: "Экипаж не найден",
  description: "Для этого slug пока нет витрины экипажа.",
  logoUrl: "",
  hqLocation: "",
  isFound: false,
  theme: defaultTheme,
  header: {
    brandName: "Франшиза",
    tagline: "Витрина готовится",
    logoUrl: "",
    logoHref: `/franchize/${slug}`,
    menuLinks: fallbackMenuLinks(slug),
  },
  contacts: {
    phone: "",
    email: "",
    address: "",
    telegram: "",
    telegramBotUsername: "",
    workingHours: "",
    map: {
      gps: "",
      publicTransport: "",
      carDirections: "",
      imageUrl: "",
      bounds: {
        top: DEFAULT_MAP_BOUNDS.top,
        bottom: DEFAULT_MAP_BOUNDS.bottom,
        left: DEFAULT_MAP_BOUNDS.left,
        right: DEFAULT_MAP_BOUNDS.right,
      },
    },
  },
  catalog: {
    categories: [],
    quickLinks: [],
    tickerItems: [],
    promoBanners: [],
    adCards: [],
    showcaseGroups: [],
  },
  ratingSummary: { average: 0, count: 0 },
  footer: {
    socialLinks: [],
    columns: [],
    textColor: "#16130A",
  },
  reservationHold: buildFranchizeReservationHold({}, ""),
  contentBlocks: cloneFranchizeContentBlocks(),
});

export async function getFranchizeBySlug(slug: string): Promise<FranchizeBySlugResult> {
  const safeSlug = normalizeCrewSlug(slug ?? "");
  if (!safeSlug) {
    return { crew: emptyCrew("unknown"), items: [] };
  }

  try {
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("*")
      .eq("slug", safeSlug)
      .maybeSingle();

    if (crewError || !crew) {
      if (crewError) {
        logger.warn("[franchize] failed to load crew by slug", { safeSlug, crewError: crewError.message });
      }
      return { crew: emptyCrew(safeSlug), items: [] };
    }

    const catalogTypes = ["bike", "accessories", "gear", "wbitem", "metal_stuff"];
    const { data: cars, error: carsError } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, description, image_url, daily_price, type, specs, availability_rules")
      .eq("crew_id", crew.id)
      .in("type", catalogTypes);

    if (carsError) {
      logger.warn("[franchize] failed to load crew cars", { safeSlug, carsError: carsError.message });
    }

    const vehicleIds = (cars ?? []).map((car) => car.id).filter(Boolean);
    const { data: activeRentals, error: rentalsError } = vehicleIds.length
      ? await supabaseAdmin
          .from("rentals")
          .select("vehicle_id, status, agreed_start_date, agreed_end_date, requested_end_date")
          .in("vehicle_id", vehicleIds)
          .in("status", ["pending_confirmation", "confirmed", "active"])
      : { data: [], error: null };

    if (rentalsError) {
      logger.warn("[franchize] failed to load rentals availability", { safeSlug, rentalsError: rentalsError.message });
    }

    const availabilityByVehicle = new Map<string, { status: "available" | "busy"; label: string }>();
    const nowTs = Date.now();
    for (const rental of (activeRentals ?? []) as RentalAvailabilityRow[]) {
      const vehicleId = typeof rental.vehicle_id === "string" ? rental.vehicle_id : "";
      if (!vehicleId) continue;

      const startTs = rental.agreed_start_date ? Date.parse(rental.agreed_start_date) : Number.NaN;
      const endTs = rental.agreed_end_date
        ? Date.parse(rental.agreed_end_date)
        : rental.requested_end_date
          ? Date.parse(rental.requested_end_date)
          : Number.NaN;
      const rentalStatus = typeof rental.status === "string" ? rental.status : "pending_confirmation";

      // ── Robustness fix: stale "active" rentals ──
      // We can NOT trust `status === "active"` alone. Operators frequently
      // forget to flip a rental to "completed" after the renter returns the
      // bike, so the table accumulates "active" rows whose agreed_end_date
      // is days/weeks in the past. The previous logic short-circuited on
      // status === "active" and skipped the date check entirely, which made
      // those bikes display "В аренде до 16.06" on 27.06 — clearly wrong.
      // (DB snapshot on 2026-06-28: 7 of 8 "active" rentals were stale.)
      //
      // New rule: a rental makes the bike busy only while its end date
      // (plus a grace window that absorbs late returns and the
      // bare-date-as-midnight storage quirk) is still effectively in the
      // future. A stale "active" rental with a past end date is treated as
      // ended → the bike becomes available again automatically.
      //
      // FIX 2026-07-10: If endTs is NaN (neither agreed_end_date nor
      // requested_end_date is set), we must NOT treat the bike as busy
      // forever. The old logic had `Number.isNaN(endTs) || ...` which
      // made any rental with a missing end date permanently busy. Now
      // we fall back to start date + 24h as a last resort; if even the
      // start date is missing, the rental is too broken to gate
      // availability.
      let effectiveEndTs = endTs;
      if (Number.isNaN(effectiveEndTs)) {
        // Fall back to start date + 24h grace
        effectiveEndTs = Number.isNaN(startTs) ? Number.NaN : startTs + RENTAL_END_GRACE_MS;
      }
      // ── Sanity guard: reject implausibly long rentals ──
      // A rental whose (end − start) exceeds 30 days is almost certainly
      // a data-entry error (the classic DD.MM ↔ MM.DD swap turns a 2-day
      // rental into a 31-day one). We skip those so a typo can't keep a
      // bike permanently "busy" in the catalog. Legitimate long-term
      // rentals are rare and should be tracked via subrent contracts.
      const MAX_RENTAL_DURATION_DAYS = 30;
      const MAX_RENTAL_DURATION_MS = MAX_RENTAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
      if (
        !Number.isNaN(startTs) &&
        !Number.isNaN(effectiveEndTs) &&
        effectiveEndTs - startTs > MAX_RENTAL_DURATION_MS
      ) {
        logger.warn("[franchize] skipping rental with implausible duration", {
          rentalId: rental.rental_id,
          vehicleId,
          startTs: new Date(startTs).toISOString(),
          endTs: new Date(effectiveEndTs).toISOString(),
          durationDays: Math.round((effectiveEndTs - startTs) / 86400000),
        });
        continue;
      }
      const hasOpenEnd = !Number.isNaN(effectiveEndTs) && effectiveEndTs + RENTAL_END_GRACE_MS >= nowTs;
      const isActiveNow = rentalStatus === "active" && hasOpenEnd;
      const isUpcomingBooking =
        ["pending_confirmation", "confirmed"].includes(rentalStatus) && hasOpenEnd;
      const isBusy = isActiveNow || isUpcomingBooking;
      if (!isBusy) continue;

      const label = isActiveNow
        ? (Number.isNaN(endTs)
            ? "В аренде сейчас"
            : // FIX: Was `new Date(endTs).toLocaleDateString("ru-RU")` which
              // is timezone-dependent and produced wrong days (e.g. showing
              // "08.07.2026" instead of "09.07.2026" when the stored
              // timestamp was UTC midnight and the server was UTC). Now we
              // parse the timestamp back to a calendar date via the shared
              // `formatRuDate` helper which is timezone-stable.
              `В аренде до ${formatRuDate(new Date(endTs))}`)
        : (Number.isNaN(startTs)
            ? "Забронирован"
            : `Забронирован с ${formatRuDate(new Date(startTs))}`);
      availabilityByVehicle.set(vehicleId, { status: "busy", label });
    }

    const { data: reviewRows, error: reviewsError } = vehicleIds.length
      ? await supabaseAdmin
          .from("rental_reviews")
          .select("id, rental_id, user_id, bike_id, crew_id, rating, text, created_at, hidden_at")
          .in("bike_id", vehicleIds)
          .is("hidden_at", null)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (reviewsError) {
      logger.warn("[franchize] failed to load rental reviews", { safeSlug, reviewsError: reviewsError.message });
    }

    const reviewRowsRaw = ((reviewRows ?? []) as UnknownRecord[]);
    const reviewsByBike = groupReviewsByBike(reviewRowsRaw);
    const crewRatingSummary = buildCrewRatingSummary(reviewRowsRaw);

    const metadata = ((crew as UnknownRecord).metadata ?? {}) as UnknownRecord;
    const franchize = (metadata.franchize ?? metadata) as UnknownRecord;

    const resolvedTheme = resolveFranchizeTheme(franchize);
    const menuLinksRaw = readArrayPath<UnknownRecord>(franchize, ["header", "menuLinks"], fallbackMenuLinks(safeSlug)).map((link) => ({
      label: readPath(link, ["label"], "Ссылка"),
      href: withSlug(readPath(link, ["href"], `/franchize/${crew.slug ?? safeSlug}`), crew.slug ?? safeSlug),
    }));
    // map-riders link is not forced
    const menuLinks = menuLinksRaw/*.some((link) => link.href === `/franchize/${crew.slug ?? safeSlug}/map-riders`)
      ? menuLinksRaw
      : [
          ...menuLinksRaw.slice(0, 1),
          { label: "Карта райдеров", href: `/franchize/${crew.slug ?? safeSlug}/map-riders` },
          ...menuLinksRaw.slice(1),
        ];*/

    const metadataShowcaseGroups = readArrayPath<UnknownRecord>(franchize, ["catalog", "showcaseGroups"]);
    const showcaseGroups = (metadataShowcaseGroups.length > 0
      ? metadataShowcaseGroups.map((group, index) => ({
          id: readPath(group, ["id"], `showcase-${index + 1}`),
          label: readPath(group, ["label"], readPath(group, ["title"], `Витрина ${index + 1}`)),
          mode: readPath(group, ["mode"], "subtype") as "subtype" | "price",
          subtype: readPath(group, ["subtype"], ""),
          minPrice: Number(readPath(group, ["minPrice"], 0)),
          maxPrice: Number(readPath(group, ["maxPrice"], 0)),
        }))
      : DEFAULT_SHOWCASE_GROUPS)
      .filter((group) => group.label.trim().length > 0);

    const hydratedCrew: FranchizeCrewVM = {
      id: crew.id,
      slug: crew.slug ?? safeSlug,
      name: crew.name ?? "Экипаж без названия",
      description: crew.description ?? "",
      logoUrl: crew.logo_url ?? "",
      hqLocation: crew.hq_location ?? "",
      isFound: true,
      theme: resolvedTheme,
      header: {
        brandName: readPath(franchize, ["branding", "name"], crew.name ?? "Franchize"),
        tagline: readPath(franchize, ["branding", "tagline"], "Витрина экипажа"),
        logoUrl: readPath(franchize, ["branding", "logoUrl"], crew.logo_url ?? ""),
        logoHref: readPath(franchize, ["header", "logoHref"], `/franchize/${crew.slug ?? safeSlug}`),
        menuLinks,
      },
      contacts: {
        phone: readPath(franchize, ["contacts", "phone"], readPath(franchize, ["footer", "phone"], "")),
        email: readPath(franchize, ["contacts", "email"], readPath(franchize, ["footer", "email"], "")),
        address: readPath(
          franchize,
          ["contacts", "address"],
          readPath(franchize, ["footer", "address"], crew.hq_location ?? ""),
        ),
        telegram: readPath(franchize, ["contacts", "telegram"], ""),
        telegramBotUsername: readPath(franchize, ["contacts", "telegramBotUsername"], ""),
        workingHours: readPath(franchize, ["contacts", "workingHours"], ""),
        map: {
          gps: readPath(franchize, ["contacts", "map", "gps"], ""),
          publicTransport: readPath(franchize, ["contacts", "map", "publicTransport"], ""),
          carDirections: readPath(franchize, ["contacts", "map", "carDirections"], ""),
          imageUrl: readPath(franchize, ["contacts", "map", "imageUrl"], ""),
          bounds: {
            top: Number(readPath(franchize, ["contacts", "map", "bounds", "top"], DEFAULT_MAP_BOUNDS.top)),
            bottom: Number(readPath(franchize, ["contacts", "map", "bounds", "bottom"], DEFAULT_MAP_BOUNDS.bottom)),
            left: Number(readPath(franchize, ["contacts", "map", "bounds", "left"], DEFAULT_MAP_BOUNDS.left)),
            right: Number(readPath(franchize, ["contacts", "map", "bounds", "right"], DEFAULT_MAP_BOUNDS.right)),
          },
        },
      },
      catalog: {
        categories: readArrayPath<string>(franchize, ["catalog", "groupOrder"]),
        quickLinks: readArrayPath<string>(franchize, ["catalog", "quickLinks"]),
        tickerItems: readArrayPath<unknown>(franchize, ["catalog", "tickerItems"]).map((item: unknown, index: number) => {
          const tickerItem = (item ?? {}) as UnknownRecord;
          const text = readPath(tickerItem, ["text"], readPath(tickerItem, ["title"], ""));

          return {
            id: readPath(tickerItem, ["id"], `ticker-${index + 1}`),
            text,
            href: readPath(tickerItem, ["href"], `/franchize/${crew.slug ?? safeSlug}`),
          };
        }),
        promoBanners: readArrayPath<unknown>(franchize, ["catalog", "promoBanners"]).map((item: unknown, index: number) => {
          const banner = (item ?? {}) as UnknownRecord;
          return {
            id: readPath(banner, ["id"], `promo-${index + 1}`),
            title: readPath(banner, ["title"], ""),
            subtitle: readPath(banner, ["subtitle"], ""),
            code: readPath(banner, ["code"], ""),
            href: readPath(banner, ["href"], `/franchize/${crew.slug ?? safeSlug}`),
            imageUrl: readPath(banner, ["imageUrl"], ""),
            priority: Number(readPath(banner, ["priority"], 50)),
            activeFrom: readPath(banner, ["activeFrom"], ""),
            activeTo: readPath(banner, ["activeTo"], ""),
            ctaLabel: readPath(banner, ["ctaLabel"], "Открыть"),
          };
        }),
        adCards: readArrayPath<unknown>(franchize, ["catalog", "adCards"]).map((item: unknown, index: number) => {
          const ad = (item ?? {}) as UnknownRecord;
          return {
            id: readPath(ad, ["id"], `ad-${index + 1}`),
            title: readPath(ad, ["title"], ""),
            subtitle: readPath(ad, ["subtitle"], ""),
            href: readPath(ad, ["href"], `/franchize/${crew.slug ?? safeSlug}`),
            imageUrl: readPath(ad, ["imageUrl"], ""),
            badge: readPath(ad, ["badge"], ""),
            priority: Number(readPath(ad, ["priority"], 40)),
            activeFrom: readPath(ad, ["activeFrom"], ""),
            activeTo: readPath(ad, ["activeTo"], ""),
            ctaLabel: readPath(ad, ["ctaLabel"], "Подробнее"),
          };
        }),
        showcaseGroups,
      },
      ratingSummary: { average: crewRatingSummary.average, count: crewRatingSummary.count },
      footer: {
        socialLinks: extractFooterSocialLinks(franchize, readPath(franchize, ["contacts", "telegram"], "")),
        columns: extractFooterColumns(franchize, crew.slug ?? safeSlug),
        textColor: readPath(franchize, ["footer", "textColor"], DEFAULT_FOOTER_TEXT_COLOR),
      },
      reservationHold: buildFranchizeReservationHold(franchize, readPath(franchize, ["contacts", "address"], "")),
      contentBlocks: readFranchizeContentBlocks(franchize),
    };

    const items: CatalogItemVM[] = (cars ?? [])
      .filter((car) => {
        const specs = (car.specs ?? {}) as UnknownRecord;
        const hidden = readPath<unknown>(specs, ["hidden"], false);
        return !(
          hidden === true ||
          hidden === 1 ||
          ["1", "true"].includes(String(hidden).toLowerCase())
        );
      })
      .map((car) => {
      const specs = (car.specs ?? {}) as UnknownRecord;
      const subtype =
        (typeof specs.subtype === "string" && specs.subtype.trim()) ||
        (typeof specs.bike_subtype === "string" && specs.bike_subtype.trim()) ||
        (typeof specs.segment === "string" && specs.segment.trim()) ||
        (typeof specs.type === "string" && specs.type.trim().toLowerCase() !== "bike" && specs.type.trim()) ||
        "Без категории";

      const mediaUrls = Array.from(new Set([
        car.image_url ?? "",
        ...(Array.isArray(specs.gallery) ? specs.gallery.filter((value): value is string => typeof value === "string") : []),
        ...(Array.isArray(specs.images) ? specs.images.filter((value): value is string => typeof value === "string") : []),
        ...(Array.isArray(specs.photos) ? specs.photos.filter((value): value is string => typeof value === "string") : []),
        ...(Array.isArray(specs.image_urls) ? specs.image_urls.filter((value): value is string => typeof value === "string") : []),
      ].map((value) => value.trim()).filter(Boolean)));

      const availabilityRulesRaw = (
        car.availability_rules && typeof car.availability_rules === "object" && !Array.isArray(car.availability_rules)
          ? (car.availability_rules as Record<string, unknown>)
          : {}
      );
      const rulesType = typeof availabilityRulesRaw.type === "string" ? availabilityRulesRaw.type : "";
      const manualStatus = typeof availabilityRulesRaw.manual_status === "string"
        ? availabilityRulesRaw.manual_status
        : typeof availabilityRulesRaw.manualStatus === "string"
          ? availabilityRulesRaw.manualStatus
          : "";
      const isWeekend = [6, 7].includes(new Date().getDay() === 0 ? 7 : new Date().getDay());
      const blockedByRules =
        manualStatus === "busy" ||
        manualStatus === "unavailable" ||
        (rulesType === "weekends_only" && !isWeekend);

      const fallbackStatus: "available" | "busy" = blockedByRules ? "busy" : "available";
      const fallbackLabel =
        manualStatus === "busy"
          ? "Временно занят"
          : manualStatus === "unavailable"
            ? "Временно недоступен"
            : rulesType === "weekends_only" && !isWeekend
              ? "Доступен только по выходным"
              : "Свободен сегодня";

      return {
        id: car.id,
        title: `${car.make} ${car.model}`.trim(),
        subtitle: (typeof specs.subtitle === "string" ? specs.subtitle : "Доступно") as string,
        description: car.description ?? (typeof specs.description === "string" ? specs.description : "Подробности откроются в карточке"),
        imageUrl: mediaUrls[0] ?? "",
        mediaUrls,
        pricePerDay: car.daily_price ?? 0,
        rentPriceLabel: (() => {
          // 1. Pre-formatted label from specs (highest priority)
          const preformatted = readPath(specs, ["rent_price_label"], "");
          if (typeof preformatted === "string" && preformatted.trim().length > 0) {
            return preformatted.trim();
          }
          // 2. Weekday + weekend dual pricing
          const weekday = Number(readPath(specs, ["rent_weekday"], 0));
          const weekend = Number(readPath(specs, ["rent_weekend"], 0));
          if (weekday > 0 && weekend > 0) {
            return `${weekday.toLocaleString("ru-RU")} ₽ будни / ${weekend.toLocaleString("ru-RU")} ₽ выходные`;
          }
          // 3. Weekday only
          if (weekday > 0) {
            return `${weekday.toLocaleString("ru-RU")} ₽ / день (будни)`;
          }
          // 4. Weekend only
          if (weekend > 0) {
            return `${weekend.toLocaleString("ru-RU")} ₽ / день (выходные)`;
          }
          // 5. Fallback to daily_price
          return `${Number(car.daily_price ?? 0).toLocaleString("ru-RU")} ₽ / день`;
        })(),
        category: subtype,
        availabilityStatus: availabilityByVehicle.get(car.id)?.status ?? fallbackStatus,
        availabilityLabel: availabilityByVehicle.get(car.id)?.label ?? fallbackLabel,
        isHot:
          Number(car.daily_price ?? 0) >= 7000 ||
          Boolean(readPath(specs, ["is_hot"], false)) ||
          Boolean(readPath(specs, ["hot"], false)) ||
          /hot|🔥/i.test(String(readPath(specs, ["badge"], ""))),
        saleAvailable: (() => {
          const saleFlag = readPath<unknown>(specs, ["sale"], "");
          return saleFlag === 1 || saleFlag === true || ["1", "true"].includes(String(saleFlag).toLowerCase());
        })(),
        salePrice:
          Number(readPath(specs, ["sale_price"], 0)) > 0
            ? Number(readPath(specs, ["sale_price"], 0))
            : Number(readPath(specs, ["purchase_price"], 0)) > 0
              ? Number(readPath(specs, ["purchase_price"], 0))
              : null,
        rawSpecs: specs,
        reviewSummary: buildReviewSummary(reviewsByBike.get(car.id) ?? []),
        specs: (() => {
          const labels = specs.spec_labels && typeof specs.spec_labels === "object" && !Array.isArray(specs.spec_labels)
            ? (specs.spec_labels as Record<string, unknown>)
            : {};
          const hiddenSpecKeys = new Set([
            "subtitle",
            "description",
            "segment",
            "subtype",
            "bike_subtype",
            "type",
            "spec_labels",
            "hidden",
            "is_hot",
            "hot",
            "badge",
            "sale",
            "sale_price",
            "purchase_price",
            "rent_price_label",
            "gallery",
            "images",
            "photos",
            "image_urls",
            "bike_engine_spec_line_1",
            "bike_engine_spec_line_2",
            "bike_engine_spec_line_3",
          ]);
          const priorityKeys = ["power", "top_speed", "engine", "range", "acceleration", "torque", "weight", "capacity"];

          return Object.entries(specs)
            .filter(([, value]) => typeof value === "string" || typeof value === "number")
            .filter(([key]) => !hiddenSpecKeys.has(key))
            .sort((a, b) => {
              const aPriority = priorityKeys.indexOf(a[0]);
              const bPriority = priorityKeys.indexOf(b[0]);
              if (aPriority >= 0 && bPriority >= 0) return aPriority - bPriority;
              if (aPriority >= 0) return -1;
              if (bPriority >= 0) return 1;
              return 0;
            })
            .slice(0, 4)
            .map(([key, value]) => ({
              label: typeof labels[key] === "string" && String(labels[key]).trim().length > 0
                ? String(labels[key]).trim()
                : key.replace(/_/g, " "),
              value: String(value),
            }));
        })(),
      };
      });

    return {
      crew: {
        ...hydratedCrew,
        catalog: {
          categories:
            hydratedCrew.catalog.categories.length > 0
              ? normalizeCatalogOrder(hydratedCrew.catalog.categories)
              : normalizeCatalogOrder(items.map((item) => item.category)),
          quickLinks: hydratedCrew.catalog.quickLinks,
          tickerItems: hydratedCrew.catalog.tickerItems.filter((item) => item.text.trim().length > 0),
          promoBanners: hydratedCrew.catalog.promoBanners.filter((item) => item.title.trim().length > 0),
          adCards: hydratedCrew.catalog.adCards.filter((item) => item.title.trim().length > 0),
          showcaseGroups: hydratedCrew.catalog.showcaseGroups,
        },
        footer: hydratedCrew.footer,
      },
      items,
    };
  } catch (error) {
    logger.error("[franchize] unexpected getFranchizeBySlug failure", error);
    return { crew: emptyCrew(safeSlug), items: [] };
  }
}

export async function markCrewBikesAvailable(slug: string) {
  const safeSlug = slug?.trim().toLowerCase().replace(/\s+/g, "-");
  if (!safeSlug) {
    return { success: false, error: "slug is required" };
  }

  const { data: crew, error: crewError } = await supabaseAdmin
    .from("crews")
    .select("id")
    .eq("slug", safeSlug)
    .maybeSingle();

  if (crewError || !crew) {
    return { success: false, error: crewError?.message || "crew not found" };
  }

  const { data: cars, error: carsError } = await supabaseAdmin
    .from("cars")
    .select("id, availability_rules")
    .eq("crew_id", crew.id)
    .in("type", ["bike", "ebike"]);

  if (carsError) {
    return { success: false, error: carsError.message };
  }

  for (const car of cars ?? []) {
    const currentRules = (car.availability_rules && typeof car.availability_rules === "object" && !Array.isArray(car.availability_rules))
      ? (car.availability_rules as Record<string, unknown>)
      : {};

    const nextRules = {
      ...currentRules,
      manual_status: "available",
      initialized_by: "markCrewBikesAvailable",
      initialized_at: new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from("cars")
      .update({ availability_rules: nextRules })
      .eq("id", car.id);

    if (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: true };
}

function splitCsv(text: string): string[] {
  return text
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeCampaignHref(href: string, slug: string): string {
  const clean = href.trim();
  if (!clean) {
    return `/franchize/${slug}#catalog-sections`;
  }

  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("mailto:") || clean.startsWith("tel:")) {
    return clean;
  }

  return withSlug(clean, slug);
}

function trimCampaignTitle(title: string, fallback: string): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

function parsePromoBanners(lines: string, slug: string): Array<{ id: string; title: string; subtitle: string; code: string; href: string; imageUrl: string; activeFrom: string; activeTo: string; priority: number; ctaLabel: string }> {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [id, title, subtitle, code, href, imageUrl, activeFrom, activeTo, priority, ctaLabel] = line.split("|").map((value) => value.trim());
      return {
        id: id || `promo-${index + 1}`,
        title: trimCampaignTitle(title || "", `Promo ${index + 1}`),
        subtitle: subtitle || "",
        code: code || "",
        href: normalizeCampaignHref(href || "", slug),
        imageUrl: imageUrl || "",
        activeFrom: activeFrom || "",
        activeTo: activeTo || "",
        priority: Number.isFinite(Number(priority)) ? Number(priority) : 50,
        ctaLabel: ctaLabel || "Открыть",
      };
    });
}

function parseAdCards(lines: string, slug: string): Array<{ id: string; title: string; subtitle: string; href: string; imageUrl: string; badge: string; activeFrom: string; activeTo: string; priority: number; ctaLabel: string }> {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [id, title, subtitle, href, imageUrl, badge, activeFrom, activeTo, priority, ctaLabel] = line.split("|").map((value) => value.trim());
      return {
        id: id || `ad-${index + 1}`,
        title: trimCampaignTitle(title || "", `Анонс ${index + 1}`),
        subtitle: subtitle || "",
        href: normalizeCampaignHref(href || "", slug),
        imageUrl: imageUrl || "",
        badge: badge || "Анонс",
        activeFrom: activeFrom || "",
        activeTo: activeTo || "",
        priority: Number.isFinite(Number(priority)) ? Number(priority) : 40,
        ctaLabel: ctaLabel || "Подробнее",
      };
    });
}

function parseMenuLinks(lines: string, slug: string): Array<{ label: string; href: string }> {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|").map((value) => value.trim());
      return {
        label: label || "Ссылка",
        href: withSlug(href || `/franchize/${slug}`, slug),
      };
    });
}

function normalizeCatalogOrder(categories: string[]): string[] {
  const unique = Array.from(new Set(categories.filter(Boolean)));
  const regular = unique.filter((category) => !category.toLowerCase().includes("wbitem"));
  const wbItems = unique.filter((category) => category.toLowerCase().includes("wbitem"));
  return [...regular, ...wbItems];
}

async function resolveFranchizeEditorAccess(actorUserId: string | undefined, crew: { id: string; owner_id?: string | null }): Promise<boolean> {
  if (!actorUserId) {
    return false;
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status")
    .eq("user_id", actorUserId)
    .maybeSingle();

  const isAdmin = user?.status === "admin" || user?.role === "admin" || user?.role === "vprAdmin";
  if (isAdmin) {
    return true;
  }

  if (crew.owner_id && crew.owner_id === actorUserId) {
    return true;
  }

  const { data: membership } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crew.id)
    .eq("user_id", actorUserId)
    .maybeSingle();

  return membership?.membership_status === "active" && membership.role === "owner";
}

async function toFranchizeConfigInput(crew: UnknownRecord, slug: string): Promise<FranchizeConfigInput> {
  const metadata = (crew.metadata ?? {}) as UnknownRecord;
  const franchize = (metadata.franchize ?? {}) as UnknownRecord;
  const themePalette = resolvePaletteByMode(franchize);
  const lightPalette = {
    bgBase: readPath(franchize, ["theme", "palettes", "light", "bgBase"], readPath(franchize, ["theme", "palette", "light", "bgBase"], defaultFranchizeConfig.lightBgBase)),
    bgCard: readPath(franchize, ["theme", "palettes", "light", "bgCard"], readPath(franchize, ["theme", "palette", "light", "bgCard"], defaultFranchizeConfig.lightBgCard)),
    accentMain: readPath(franchize, ["theme", "palettes", "light", "accentMain"], readPath(franchize, ["theme", "palette", "light", "accentMain"], defaultFranchizeConfig.lightAccentMain)),
    accentMainHover: readPath(franchize, ["theme", "palettes", "light", "accentMainHover"], readPath(franchize, ["theme", "palette", "light", "accentMainHover"], defaultFranchizeConfig.lightAccentMainHover)),
    textPrimary: readPath(franchize, ["theme", "palettes", "light", "textPrimary"], readPath(franchize, ["theme", "palette", "light", "textPrimary"], defaultFranchizeConfig.lightTextPrimary)),
    textSecondary: readPath(franchize, ["theme", "palettes", "light", "textSecondary"], readPath(franchize, ["theme", "palette", "light", "textSecondary"], defaultFranchizeConfig.lightTextSecondary)),
    borderSoft: readPath(franchize, ["theme", "palettes", "light", "borderSoft"], readPath(franchize, ["theme", "palette", "light", "borderSoft"], defaultFranchizeConfig.lightBorderSoft)),
  };
  const menuLinks = readArrayPath<UnknownRecord>(franchize, ["header", "menuLinks"], fallbackMenuLinks(slug)).map((link) => ({
    label: readPath(link, ["label"], "Ссылка"),
    href: withSlug(readPath(link, ["href"], `/franchize/${slug}`), slug),
  }));

  const crewSecrets = await getCrewSensitiveDataOrDefault(slug, { source: "toFranchizeConfigInput" });
  const contractDefaults = (crewSecrets.contractDefaults ?? {}) as UnknownRecord;
  const defaults = (readPath(contractDefaults, ["defaults"], {}) ?? {}) as UnknownRecord;
  const docTemplates = (crewSecrets.docTemplates ?? {}) as UnknownRecord;

  return {
    ...defaultFranchizeConfig,
    slug,
    brandName: readPath(franchize, ["branding", "name"], (crew.name as string) ?? defaultFranchizeConfig.brandName),
    tagline: readPath(franchize, ["branding", "tagline"], defaultFranchizeConfig.tagline),
    logoUrl: readPath(franchize, ["branding", "logoUrl"], (crew.logo_url as string) ?? "") ?? "",
    themeMode: readPath(franchize, ["theme", "mode"], defaultTheme.mode),
    bgBase: readPath(themePalette, ["bgBase"], defaultTheme.palette.bgBase),
    bgCard: readPath(themePalette, ["bgCard"], defaultTheme.palette.bgCard),
    accentMain: readPath(themePalette, ["accentMain"], defaultTheme.palette.accentMain),
    accentMainHover: readPath(themePalette, ["accentMainHover"], defaultTheme.palette.accentMainHover),
    textPrimary: readPath(themePalette, ["textPrimary"], defaultTheme.palette.textPrimary),
    textSecondary: readPath(themePalette, ["textSecondary"], defaultTheme.palette.textSecondary),
    borderSoft: readPath(themePalette, ["borderSoft"], defaultTheme.palette.borderSoft),
    lightBgBase: lightPalette.bgBase,
    lightBgCard: lightPalette.bgCard,
    lightAccentMain: lightPalette.accentMain,
    lightAccentMainHover: lightPalette.accentMainHover,
    lightTextPrimary: lightPalette.textPrimary,
    lightTextSecondary: lightPalette.textSecondary,
    lightBorderSoft: lightPalette.borderSoft,
    phone: readPath(franchize, ["contacts", "phone"], readPath(franchize, ["footer", "phone"], "")),
    email: readPath(franchize, ["contacts", "email"], readPath(franchize, ["footer", "email"], "")),
    address: readPath(franchize, ["contacts", "address"], readPath(franchize, ["footer", "address"], "")),
    telegram: readPath(franchize, ["contacts", "telegram"], ""),
    mapGps: readPath(franchize, ["contacts", "map", "gps"], ""),
    mapImageUrl: readPath(franchize, ["contacts", "map", "imageUrl"], ""),
    mapBoundsTop: String(readPath(franchize, ["contacts", "map", "bounds", "top"], DEFAULT_MAP_BOUNDS.top)),
    mapBoundsBottom: String(readPath(franchize, ["contacts", "map", "bounds", "bottom"], DEFAULT_MAP_BOUNDS.bottom)),
    mapBoundsLeft: String(readPath(franchize, ["contacts", "map", "bounds", "left"], DEFAULT_MAP_BOUNDS.left)),
    mapBoundsRight: String(readPath(franchize, ["contacts", "map", "bounds", "right"], DEFAULT_MAP_BOUNDS.right)),
    socialLinksText: extractFooterSocialLinks(franchize, readPath(franchize, ["contacts", "telegram"], ""))
      .map((entry) => `${entry.label}|${entry.href}`)
      .join("\n"),
    menuLinksText: menuLinks
      .map((entry) => `${readPath(entry, ["label"], "Ссылка")}|${readPath(entry, ["href"], `/franchize/${slug}`)}`)
      .join("\n"),
    categoryOrderText: readArrayPath<string>(franchize, ["catalog", "groupOrder"]).join(", "),
    promoBannersText: readArrayPath<unknown>(franchize, ["catalog", "promoBanners"])
      .map((entry: unknown, index: number) => {
        const row = (entry ?? {}) as UnknownRecord;
        return [
          readPath(row, ["id"], `promo-${index + 1}`),
          readPath(row, ["title"], ""),
          readPath(row, ["subtitle"], ""),
          readPath(row, ["code"], ""),
          readPath(row, ["href"], ""),
          readPath(row, ["imageUrl"], ""),
          readPath(row, ["activeFrom"], ""),
          readPath(row, ["activeTo"], ""),
          String(readPath(row, ["priority"], 50)),
          readPath(row, ["ctaLabel"], ""),
        ].join("|");
      })
      .join("\n"),
    adCardsText: readArrayPath<unknown>(franchize, ["catalog", "adCards"])
      .map((entry: unknown, index: number) => {
        const row = (entry ?? {}) as UnknownRecord;
        return [
          readPath(row, ["id"], `ad-${index + 1}`),
          readPath(row, ["title"], ""),
          readPath(row, ["subtitle"], ""),
          readPath(row, ["href"], ""),
          readPath(row, ["imageUrl"], ""),
          readPath(row, ["badge"], ""),
          readPath(row, ["activeFrom"], ""),
          readPath(row, ["activeTo"], ""),
          String(readPath(row, ["priority"], 40)),
          readPath(row, ["ctaLabel"], ""),
        ].join("|");
      })
      .join("\n"),
    allowPromo: readPath(franchize, ["order", "allowPromo"], true),
    deliveryModesText: readArrayPath<string>(franchize, ["order", "deliveryModes"], DEFAULT_DELIVERY_MODES_TEXT.split(", ")).join(", "),
    paymentOptionsText: readArrayPath<string>(franchize, ["order", "paymentOptions"], DEFAULT_PAYMENT_OPTIONS_TEXT.split(", ")).join(", "),
    defaultMode: readPath(franchize, ["order", "defaultMode"], "pickup"),
    issuerName: readPath(defaults, ["issuerName"], ""),
    issuerRepresentative: readPath(defaults, ["issuer_representative"], ""),
    includedMileage: String(readPath(defaults, ["included_mileage"], defaultFranchizeConfig.includedMileage)),
    overageRateRub: String(readPath(defaults, ["overage_rate"], defaultFranchizeConfig.overageRateRub)),
    bikeValueRub: String(readPath(defaults, ["bike_value_rub"], defaultFranchizeConfig.bikeValueRub)),
    bikeValueWords: readPath(defaults, ["bike_value_words"], defaultFranchizeConfig.bikeValueWords),
    lateReturnPenaltyRub: String(readPath(defaults, ["late_return_penalty_rub"], defaultFranchizeConfig.lateReturnPenaltyRub)),
    returnAddress: readPath(defaults, ["return_address"], defaultFranchizeConfig.returnAddress),
    contractDefaultsJson: JSON.stringify(contractDefaults, null, 2),
    docTemplatesJson: JSON.stringify(docTemplates, null, 2),
    advancedJson: JSON.stringify(franchize, null, 2),
  };
}

export async function loadFranchizeConfigBySlug(slug: string, actorUserId?: string): Promise<FranchizeConfigState> {
  const safeSlug = normalizeCrewSlug(String(slug ?? ""));
  if (!safeSlug) {
    return { ok: false, message: "Сначала укажите slug экипажа." };
  }

  const { data: crew, error } = await supabaseAdmin.from("crews").select("id, slug, name, logo_url, metadata, owner_id").eq("slug", safeSlug).maybeSingle();
  if (error || !crew) {
    return { ok: false, message: "Экипаж с таким slug не найден." };
  }

  const canEdit = await resolveFranchizeEditorAccess(actorUserId, { id: crew.id, owner_id: crew.owner_id });

  return {
    ok: true,
    message: canEdit
      ? `Конфиг для ${safeSlug} загружен.`
      : `Конфиг для ${safeSlug} загружен в read-only режиме.`,
    data: await toFranchizeConfigInput(crew as UnknownRecord, safeSlug),
    canEdit,
  };
}

export async function saveFranchizeConfig(input: FranchizeConfigInput, actorUserId?: string): Promise<FranchizeConfigState> {
  const parsed = franchizeConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Проверка не пройдена: проверьте обязательные поля формы.",
      errors: parsed.error.flatten().fieldErrors,
      data: input,
    };
  }

  const payload: FranchizeConfigInput = { ...parsed.data, logoUrl: parsed.data.logoUrl ?? "" };
  const normalizedSlug = normalizeCrewSlug(payload.slug);
  payload.slug = normalizedSlug;

  const { data: crew, error: crewError } = await supabaseAdmin.from("crews").select("id, slug, metadata, owner_id").eq("slug", normalizedSlug).maybeSingle();
  if (crewError || !crew) {
    return { ok: false, message: "Slug не найден: сохранение не выполнено.", data: payload };
  }

  const canEdit = await resolveFranchizeEditorAccess(actorUserId, { id: crew.id, owner_id: crew.owner_id });
  if (!canEdit) {
    return { ok: false, message: "Недостаточно прав: сохранять может только owner экипажа или all-admin.", data: payload, canEdit: false };
  }

  let advancedOverrides: UnknownRecord = {};
  if (payload.advancedJson.trim()) {
    try {
      const parsedJson = JSON.parse(payload.advancedJson) as unknown;
      if (parsedJson && typeof parsedJson === "object") {
        advancedOverrides = parsedJson as UnknownRecord;
      }
    } catch {
      return { ok: false, message: "Advanced JSON должен быть валидным JSON-объектом.", data: payload };
    }
  }

  let contractDefaultsOverrides: UnknownRecord = {};
  if (payload.contractDefaultsJson.trim()) {
    try {
      const parsedJson = JSON.parse(payload.contractDefaultsJson) as unknown;
      if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
        contractDefaultsOverrides = parsedJson as UnknownRecord;
      }
    } catch {
      return { ok: false, message: "Contract defaults JSON должен быть валидным JSON-объектом.", data: payload };
    }
  }

  let docTemplatesOverrides: UnknownRecord = {};
  if (payload.docTemplatesJson.trim()) {
    try {
      const parsedJson = JSON.parse(payload.docTemplatesJson) as unknown;
      if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
        docTemplatesOverrides = parsedJson as UnknownRecord;
      }
    } catch {
      return { ok: false, message: "Doc templates JSON должен быть валидным JSON-объектом.", data: payload };
    }
  }

  const baseMetadata = ((crew as UnknownRecord).metadata ?? {}) as UnknownRecord;
  const existingFranchize = (readPath(baseMetadata, ["franchize"], {}) ?? {}) as UnknownRecord;
  const menuLinks = parseMenuLinks(payload.menuLinksText, payload.slug);

  const sourceFranchize: UnknownRecord = {
    ...existingFranchize,
    ...advancedOverrides,
  };

  const franchizeMetadata: UnknownRecord = {
    ...sourceFranchize,
    version: readPath(sourceFranchize, ["version"], "2026-02-19-editor-v2"),
    enabled: readPath(sourceFranchize, ["enabled"], true),
    slug: payload.slug,
    branding: {
      ...(readPath(sourceFranchize, ["branding"], {}) as UnknownRecord),
      name: payload.brandName,
      tagline: payload.tagline,
      logoUrl: payload.logoUrl,
    },
    theme: {
      ...(readPath(sourceFranchize, ["theme"], {}) as UnknownRecord),
      mode: payload.themeMode,
      palette: {
        ...(readPath(sourceFranchize, ["theme", "palette"], {}) as UnknownRecord),
        bgBase: payload.themeMode.toLowerCase().includes("light") ? payload.lightBgBase : payload.bgBase,
        bgCard: payload.themeMode.toLowerCase().includes("light") ? payload.lightBgCard : payload.bgCard,
        accentMain: payload.themeMode.toLowerCase().includes("light") ? payload.lightAccentMain : payload.accentMain,
        accentMainHover: payload.themeMode.toLowerCase().includes("light") ? payload.lightAccentMainHover : payload.accentMainHover,
        textPrimary: payload.themeMode.toLowerCase().includes("light") ? payload.lightTextPrimary : payload.textPrimary,
        textSecondary: payload.themeMode.toLowerCase().includes("light") ? payload.lightTextSecondary : payload.textSecondary,
        borderSoft: payload.themeMode.toLowerCase().includes("light") ? payload.lightBorderSoft : payload.borderSoft,
      },
      palettes: {
        ...(readPath(sourceFranchize, ["theme", "palettes"], {}) as UnknownRecord),
        dark: {
          ...(readPath(sourceFranchize, ["theme", "palettes", "dark"], {}) as UnknownRecord),
          bgBase: payload.bgBase,
          bgCard: payload.bgCard,
          accentMain: payload.accentMain,
          accentMainHover: payload.accentMainHover,
          textPrimary: payload.textPrimary,
          textSecondary: payload.textSecondary,
          borderSoft: payload.borderSoft,
        },
        light: {
          ...(readPath(sourceFranchize, ["theme", "palettes", "light"], {}) as UnknownRecord),
          bgBase: payload.lightBgBase,
          bgCard: payload.lightBgCard,
          accentMain: payload.lightAccentMain,
          accentMainHover: payload.lightAccentMainHover,
          textPrimary: payload.lightTextPrimary,
          textSecondary: payload.lightTextSecondary,
          borderSoft: payload.lightBorderSoft,
        },
      },
    },
    header: {
      ...(readPath(sourceFranchize, ["header"], {}) as UnknownRecord),
      menuLinks,
    },
    footer: {
      ...(readPath(sourceFranchize, ["footer"], {}) as UnknownRecord),
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      socialLinks: parseSocialLinks(payload.socialLinksText),
    },
    contacts: {
      ...(readPath(sourceFranchize, ["contacts"], {}) as UnknownRecord),
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      telegram: payload.telegram,
      map: {
        ...(readPath(sourceFranchize, ["contacts", "map"], {}) as UnknownRecord),
        gps: payload.mapGps,
        imageUrl: payload.mapImageUrl,
        bounds: {
          ...(readPath(sourceFranchize, ["contacts", "map", "bounds"], {}) as UnknownRecord),
          top: Number(payload.mapBoundsTop),
          bottom: Number(payload.mapBoundsBottom),
          left: Number(payload.mapBoundsLeft),
          right: Number(payload.mapBoundsRight),
        },
      },
    },
    catalog: {
      ...(readPath(sourceFranchize, ["catalog"], {}) as UnknownRecord),
      groupOrder: splitCsv(payload.categoryOrderText),
      promoBanners: parsePromoBanners(payload.promoBannersText, payload.slug),
      adCards: parseAdCards(payload.adCardsText, payload.slug),
    },
    order: {
      ...(readPath(sourceFranchize, ["order"], {}) as UnknownRecord),
      allowPromo: payload.allowPromo,
      deliveryModes: splitCsv(payload.deliveryModesText),
      paymentOptions: splitCsv(payload.paymentOptionsText),
      defaultMode: payload.defaultMode,
    },
  };

  const mergedMetadata: UnknownRecord = {
    ...baseMetadata,
    franchize: franchizeMetadata,
  };

  const { error: updateError } = await supabaseAdmin.from("crews").update({ metadata: mergedMetadata }).eq("id", crew.id);
  if (updateError) {
    logger.error("[franchize] save config failed", updateError);
    return { ok: false, message: "Не удалось сохранить конфиг в metadata экипажа.", data: payload, canEdit: true };
  }

  const mergedContractDefaults: UnknownRecord = {
    ...contractDefaultsOverrides,
    defaults: {
      ...(readPath(contractDefaultsOverrides, ["defaults"], {}) as UnknownRecord),
      issuerName: payload.issuerName || defaultFranchizeConfig.issuerName,
      issuer_representative: payload.issuerRepresentative || defaultFranchizeConfig.issuerRepresentative,
      included_mileage: Number(payload.includedMileage) || Number(defaultFranchizeConfig.includedMileage),
      overage_rate: Number(payload.overageRateRub) || Number(defaultFranchizeConfig.overageRateRub),
      bike_value_rub: Number(payload.bikeValueRub) || Number(defaultFranchizeConfig.bikeValueRub),
      bike_value_words: payload.bikeValueWords || defaultFranchizeConfig.bikeValueWords,
      late_return_penalty_rub: Number(payload.lateReturnPenaltyRub) || Number(defaultFranchizeConfig.lateReturnPenaltyRub),
      return_address: payload.returnAddress || defaultFranchizeConfig.returnAddress,
    },
  };

  await saveCrewSensitiveData(payload.slug, {
    contractDefaults: mergedContractDefaults,
    docTemplates: docTemplatesOverrides,
  });

  return {
    ok: true,
    message: `Франшизный конфиг сохранён в crews.metadata.franchize для ${payload.slug}.`,
    data: payload,
    canEdit: true,
  };
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString("ru-RU");
}

/**
 * Convert a number to Russian words (used in testdrive contracts for
 * "price_words" and "deposit_words" template variables).
 * Supports numbers up to 999,999.
 */
function numberToWords(n: number): string {
  const units = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"];
  const teens = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"];
  const tens = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"];
  const hundreds = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"];

  if (n >= 1000000) return String(n);
  if (n >= 1000) {
    const th = Math.floor(n / 1000);
    const r = n % 1000;
    const lastTwo = th % 100, lastOne = th % 10;
    let w = "тысяч";
    if (lastTwo >= 11 && lastTwo <= 19) w = "тысяч";
    else if (lastOne === 1) w = "тысяча";
    else if (lastOne >= 2 && lastOne <= 4) w = "тысячи";
    return numberToWords(th) + " " + w + (r > 0 ? " " + numberToWords(r) : "");
  }
  if (n === 0) return "ноль";
  if (n < 10) return units[n];
  if (n < 20) return teens[n - 10];
  if (n < 100) {
    const t = Math.floor(n / 10), u = n % 10;
    return tens[t] + (u > 0 ? " " + units[u] : "");
  }
  if (n < 1000) {
    const h = Math.floor(n / 100), r = n % 100;
    return hundreds[h] + (r > 0 ? " " + numberToWords(r) : "");
  }
  return String(n);
}

const franchizePromoValidationSchema = z.object({
  slug: z.string().trim().min(1),
  code: z.string().trim().min(1),
  baseAmount: z.number().finite().nonnegative(),
});

type PromoValidationBanner = {
  title: string;
  subtitle: string;
  code: string;
  activeFrom: string;
  activeTo: string;
  ctaLabel: string;
  discountType: string;
  discountPercent: number;
  discountAmount: number;
  maxDiscount: number;
  minSubtotal: number;
};

function normalizePromoCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function parsePromoDate(value: string, boundary: "start" | "end"): Date | null {
  if (!value.trim()) return null;
  const date = new Date(boundary === "start" ? `${value}T00:00:00` : `${value}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isPromoActiveNow(banner: PromoValidationBanner, now = new Date()): boolean {
  const activeFrom = parsePromoDate(banner.activeFrom, "start");
  const activeTo = parsePromoDate(banner.activeTo, "end");
  return (!activeFrom || now >= activeFrom) && (!activeTo || now <= activeTo);
}

function readPromoNumber(banner: UnknownRecord, keys: string[]): number {
  for (const key of keys) {
    const value = readPath<unknown>(banner, [key], undefined);
    const numericValue = typeof value === "string" ? Number(value.replace(/\s+/g, "")) : Number(value);
    if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
  }
  return 0;
}

function capPromoDiscount(amount: number, baseAmount: number, maxDiscount: number): number {
  const cappedBySubtotal = Math.min(baseAmount, Math.round(amount));
  return maxDiscount > 0 ? Math.min(cappedBySubtotal, Math.round(maxDiscount)) : cappedBySubtotal;
}

function extractPromoDiscount(banner: PromoValidationBanner, baseAmount: number): { amount: number; description: string } {
  if (banner.discountPercent > 0) {
    const percent = Math.min(90, Math.max(1, banner.discountPercent));
    const amount = capPromoDiscount((baseAmount * percent) / 100, baseAmount, banner.maxDiscount);
    return { amount, description: `${percent}% скидка` };
  }

  if (banner.discountAmount > 0) {
    const amount = capPromoDiscount(banner.discountAmount, baseAmount, banner.maxDiscount);
    return { amount, description: `${amount.toLocaleString("ru-RU")} ₽ скидка` };
  }

  const promoText = [banner.subtitle, banner.title, banner.ctaLabel, banner.code].filter(Boolean).join(" ");
  const percentMatch = promoText.match(/(?:-|скидка\s*)?(\d{1,2})\s*%/i);
  if (percentMatch) {
    const percent = Math.min(90, Math.max(1, Number(percentMatch[1])));
    const amount = capPromoDiscount((baseAmount * percent) / 100, baseAmount, banner.maxDiscount);
    return { amount, description: `${percent}% скидка` };
  }

  const fixedRubMatch = promoText.match(/(?:-|скидка\s*)?(\d[\d\s]{2,})\s*(?:₽|руб\.?)/i);
  if (fixedRubMatch) {
    const fixedAmount = Number(fixedRubMatch[1].replace(/\s+/g, ""));
    if (Number.isFinite(fixedAmount) && fixedAmount > 0) {
      const amount = capPromoDiscount(fixedAmount, baseAmount, banner.maxDiscount);
      return { amount, description: `${amount.toLocaleString("ru-RU")} ₽ скидка` };
    }
  }

  return { amount: 0, description: banner.subtitle.trim() || banner.title.trim() || "Бонус применён" };
}

export async function validateFranchizePromoCode(input: unknown): Promise<
  | { success: true; code: string; title: string; discountAmount: number; description: string }
  | { success: false; error: string }
> {
  const parsed = franchizePromoValidationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Некорректный промокод." };
  }

  const slug = normalizeCrewSlug(parsed.data.slug);
  const code = normalizePromoCode(parsed.data.code);
  const baseAmount = Math.round(parsed.data.baseAmount);
  if (!slug || !code) return { success: false, error: "Введите промокод из активной акции." };
  if (baseAmount <= 0) return { success: false, error: "Промокод можно применить после добавления товаров в заказ." };

  const { data: crew, error } = await supabaseAdmin
    .from("crews")
    .select("metadata")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    logger.error("[franchize] promo validation crew lookup failed", error);
    return { success: false, error: "Не удалось проверить промокод. Попробуйте ещё раз." };
  }
  if (!crew) return { success: false, error: "Витрина для промокода не найдена." };

  const franchize = readPath<UnknownRecord>(crew.metadata, ["franchize"], {});
  if (!readPath(franchize, ["order", "allowPromo"], true)) {
    return { success: false, error: "Промокоды отключены для этой витрины." };
  }

  const availablePromos = readArrayPath<unknown>(franchize, ["catalog", "promoBanners"])
    .map((item: unknown): PromoValidationBanner => {
      const banner = (item ?? {}) as UnknownRecord;
      const discountType = readPath(banner, ["discountType"], readPath(banner, ["discount_type"], "")).toLowerCase();
      const discountValue = readPromoNumber(banner, ["discountValue", "discount_value"]);
      return {
        title: readPath(banner, ["title"], ""),
        subtitle: readPath(banner, ["subtitle"], ""),
        code: readPath(banner, ["code"], ""),
        activeFrom: readPath(banner, ["activeFrom"], ""),
        activeTo: readPath(banner, ["activeTo"], ""),
        ctaLabel: readPath(banner, ["ctaLabel"], ""),
        discountType,
        discountPercent: readPromoNumber(banner, ["discountPercent", "discount_percent", "percent"]) || (discountType === "percent" ? discountValue : 0),
        discountAmount: readPromoNumber(banner, ["discountAmount", "discount_amount", "amountRub", "amount_rub"]) || (discountType === "fixed" ? discountValue : 0),
        maxDiscount: readPromoNumber(banner, ["maxDiscount", "max_discount", "maxDiscountRub", "max_discount_rub"]),
        minSubtotal: readPromoNumber(banner, ["minSubtotal", "min_subtotal", "minAmount", "min_amount"]),
      };
    })
    .filter((banner) => normalizePromoCode(banner.code).length > 0);

  if (availablePromos.length === 0) return { success: false, error: "Для этой витрины сейчас нет промокодов." };

  const matchedPromo = availablePromos.find((banner) => normalizePromoCode(banner.code) === code);
  if (!matchedPromo) return { success: false, error: "Промокод не найден. Проверьте код с карточки акции." };
  if (!isPromoActiveNow(matchedPromo)) return { success: false, error: "Срок действия промокода уже не активен для выбранной витрины." };
  if (matchedPromo.minSubtotal > 0 && baseAmount < matchedPromo.minSubtotal) {
    return { success: false, error: `Минимальная сумма для промокода — ${matchedPromo.minSubtotal.toLocaleString("ru-RU")} ₽.` };
  }

  const discount = extractPromoDiscount(matchedPromo, baseAmount);
  return {
    success: true,
    code,
    title: matchedPromo.title || code,
    discountAmount: discount.amount,
    description: discount.description,
  };
}

async function resolveFranchizeCheckoutTotal(
  payload: z.infer<typeof franchizeOrderInvoiceSchema>,
): Promise<
  | { success: true; totalAmount: number; promoCode?: string; promoTitle?: string; promoDiscount: number }
  | { success: false; error: string }
> {
  const baseAmount = Math.round(payload.subtotal + payload.extrasTotal);
  const code = normalizePromoCode(payload.promoCode ?? "");
  if (!code) return { success: true, totalAmount: baseAmount, promoDiscount: 0 };

  const result = await validateFranchizePromoCode({ slug: payload.slug, code, baseAmount });
  if (!result.success) return result;

  const expectedDiscount = Math.min(result.discountAmount, baseAmount);
  const submittedDiscount = Math.min(Math.round(payload.promoDiscount ?? 0), baseAmount);
  if (submittedDiscount !== expectedDiscount) {
    return { success: false, error: "Сумма промокода изменилась. Примените промокод ещё раз перед отправкой." };
  }

  return {
    success: true,
    totalAmount: Math.max(0, baseAmount - expectedDiscount),
    promoCode: result.code,
    promoTitle: result.title,
    promoDiscount: expectedDiscount,
  };
}

function parseDurationDays(rawDuration: string): number {
  const normalized = String(rawDuration || "").toLowerCase();
  const numericMatch = normalized.match(/\d+/);
  const days = numericMatch ? Number(numericMatch[0]) : 1;
  if (!Number.isFinite(days) || days <= 0) {
    return 1;
  }
  return days;
}

type FranchizeOrderNotifyPayload = z.infer<typeof franchizeOrderInvoiceSchema> & {
  totalAmount: number;
  subtotal: number;
  extrasTotal: number;
};

type FranchizeOrderDocContactField = "renterBirthDate" | "renterPhone" | "renterEmail";
type FranchizeOrderDocRequiredField = "renterPhone";
const FRANCHIZE_DOC_REQUIRED_FIELDS: FranchizeOrderDocRequiredField[] = ["renterPhone"];

type FranchizeOrderDocVariables = {
  renterBirthDate: string;
  renterPhone: string;
  renterEmail: string;
};

class FranchizeOrderDocValidationError extends Error {
  readonly missingFields: FranchizeOrderDocRequiredField[];

  constructor(missingFields: FranchizeOrderDocRequiredField[]) {
    super(`Для генерации договора не заполнены обязательные поля: ${missingFields.join(", ")}.`);
    this.name = "FranchizeOrderDocValidationError";
    this.missingFields = missingFields;
  }
}

function formatDateDdMmYyyy(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return "";

  // Already in DD.MM.YYYY format (with 1-2 digit day/month and 4 digit year)
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(value)) {
    const parts = value.split('.');
    const day = String(Number(parts[0])).padStart(2, '0');
    const month = String(Number(parts[1])).padStart(2, '0');
    return `${day}.${month}.${parts[2]}`;
  }

  // Try YYYY-MM-DD format
  const isoMatch = value.match(/^\d{4}-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, month, day] = isoMatch;
    return `${String(Number(day)).padStart(2, '0')}.${String(Number(month)).padStart(2, '0')}.${value.slice(0, 4)}`;
  }

  // Fallback: try native Date parsing
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

function formatPhoneRu(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const tail = digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))
    ? digits.slice(1)
    : digits.length === 10
      ? digits
      : "";
  return tail.length === 10 ? `+7${tail}` : "";
}

function resolveFranchizeDocField(
  field: FranchizeOrderDocContactField,
  payload: FranchizeOrderNotifyPayload,
  userSensitive: UnknownRecord,
  fallbackValue: string,
): string {
  const payloadValue = readPath(payload as UnknownRecord, [field], "");
  const payloadNormalized = typeof payloadValue === "string" ? payloadValue.trim() : "";
  if (payloadNormalized) return payloadNormalized;
  const sensitiveValue = readPath(userSensitive, [field], "");
  const sensitiveNormalized = typeof sensitiveValue === "string" ? sensitiveValue.trim() : "";
  if (sensitiveNormalized) return sensitiveNormalized;
  return fallbackValue.trim();
}

/**
 * Payload contract for order-doc generation:
 * Required: renterPhone. Optional: renterBirthDate, renterEmail.
 * Priority source is strict: payload -> userSensitive -> fallback.
 * Valid example: { renterBirthDate: "15.03.1992", renterPhone: "+79001234567", renterEmail: "rider@crew.ru" }
 * Invalid example: { renterBirthDate: "", renterPhone: "12345" } // invalid RU phone.
 */
function resolveAndValidateFranchizeDocVariables(
  payload: FranchizeOrderNotifyPayload,
  userSensitive: UnknownRecord,
): FranchizeOrderDocVariables {
  // FIX: Web app client sends `birthDate`, not `renterBirthDate`.
  // Check both sources directly, then fall back to userSensitive chain.
  const rawBirthDate = String(readPath(payload, ["birthDate"], "") || readPath(payload, ["renterBirthDate"], "")).trim();
  const birthDate = formatDateDdMmYyyy(rawBirthDate || resolveFranchizeDocField("renterBirthDate", payload, userSensitive, ""));
  const normalizedBirthDate = birthDate || "указывается при выдаче";
  const phone = formatPhoneRu(resolveFranchizeDocField("renterPhone", payload, userSensitive, payload.phone || ""));
  const email = resolveFranchizeDocField("renterEmail", payload, userSensitive, "указывается при выдаче");
  if (!birthDate) {
    logger.warn("[franchize-doc] renterBirthDate missing in payload/userSensitive; using fallback placeholder");
  }

  const requiredValues: Record<FranchizeOrderDocRequiredField, string> = {
    renterPhone: phone,
  };
  const missing = FRANCHIZE_DOC_REQUIRED_FIELDS.filter((field) => !requiredValues[field]);
  if (missing.length > 0) throw new FranchizeOrderDocValidationError(missing);

  return {
    renterBirthDate: normalizedBirthDate,
    renterPhone: phone,
    renterEmail: email,
  };
}

type FranchizeOrderFlowType = "rental" | "sale" | "mixed" | "testdrive";

async function loadFranchizeDealTemplate(slug: string, flowType: FranchizeOrderFlowType): Promise<{ template: string; templateMode: "md" | "html" }> {
  const crewSensitive = await getCrewSensitiveDataOrDefault(slug, { source: "loadFranchizeDealTemplate" });
  const secureTemplateKey = flowType === "rental" ? "rentalDealTemplate" : "saleDealTemplate";
  const secureTemplate = readPath(crewSensitive.docTemplates ?? {}, [secureTemplateKey], "");
  if (typeof secureTemplate === "string" && secureTemplate.trim().length > 0) {
    // Auto-detect mode from stored template content
    const templateMode = /<[a-z][\s>]/i.test(secureTemplate.trimStart().slice(0, 200)) ? "html" as const : "md" as const;
    return { template: secureTemplate, templateMode };
  }

  // FIX: Both rental and sale flows now use the proper HTML templates
    // (aligned with /doc command which reads them directly via readFileSync).
    // Previously sale used SALE_DEAL_TEMPLATE_DEMO.md which produced the
    // "garbage truck" legacy contract output. Now both flows use .html.
    const isRental = flowType === "rental";
    const isTestdrive = flowType === "testdrive";
    const localTemplateFile = isRental
      ? "RENTAL_DEAL_TEMPLATE.html"
      : isTestdrive
        ? "TESTDRIVE_DEAL_TEMPLATE.html"
        : "SALE_DEAL_TEMPLATE.html";
    const defaultTemplateMode = "html" as const;

  // Check crew-specific template in crewDocs/ first
  const crewDocPath = path.join(process.cwd(), "docs", "crewDocs", `${slug}_${localTemplateFile}`);
  try {
    const crewTemplate = await readFile(crewDocPath, "utf8");
    if (crewTemplate.trim().length > 0) {
      logger.info(`[franchize] Using crew-specific template: ${slug}_${localTemplateFile}`);
      return { template: crewTemplate, templateMode: defaultTemplateMode };
    }
  } catch (crewDocErr) {
    logger.info(`[franchize] No crew-specific template for ${slug}, using general: ${localTemplateFile}`);
  }

  // Prefer local file (fast, no network hop, matches /doc behaviour)
  try {
    const localTemplatePath = path.join(process.cwd(), "docs", localTemplateFile);
    const localTemplate = await readFile(localTemplatePath, "utf8");
    if (localTemplate.trim().length > 0) {
      return { template: localTemplate, templateMode: defaultTemplateMode };
    }
  } catch (localErr) {
    logger.warn("[franchize] local template not found, falling back to remote", { flowType, localTemplateFile });
  }

  // Fallback: fetch from GitHub (for Vercel ephemeral builds that might
    // not have the docs/ folder synced)
    const remoteTemplateUrl = isRental
      ? "https://raw.githubusercontent.com/salavey13/carTest/main/docs/RENTAL_DEAL_TEMPLATE.html"
      : isTestdrive
        ? "https://raw.githubusercontent.com/salavey13/carTest/main/docs/TESTDRIVE_DEAL_TEMPLATE.html"
        : "https://raw.githubusercontent.com/salavey13/cartTest/main/docs/SALE_DEAL_TEMPLATE.html";
  try {
    const response = await fetch(remoteTemplateUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`template fetch failed with ${response.status}`);
    }
    const remoteTemplate = await response.text();
    if (remoteTemplate.trim().length > 0) {
      return { template: remoteTemplate, templateMode: defaultTemplateMode };
    }
    throw new Error("template fetch returned empty content");
  } catch (error) {
    logger.error("[franchize] template load failed entirely", { flowType, error });
    throw new Error(`Failed to load contract template for flowType=${flowType}`);
  }
}

async function createFranchizeOrderNotificationLog(payload: FranchizeOrderNotifyPayload) {
  const snapshot = {
    ...payload,
    persistedAt: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("franchize_order_notifications")
    .insert({
      slug: payload.slug,
      order_id: payload.orderId,
      payload: snapshot,
      send_status: "pending",
      attempts: 1,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to persist order snapshot: ${error.message}`);
  }

  return data.id as string;
}

async function updateFranchizeOrderNotificationLog(
  logId: string,
  patch: {
    send_status: "sent" | "failed";
    rendered_markdown?: string;
    doc_file_name?: string;
    last_error?: string;
  },
) {
  const { error } = await supabaseAdmin
    .from("franchize_order_notifications")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    logger.error("[franchize] failed to update franchize_order_notifications", { logId, error });
  }
}

async function buildFranchizeOrderDocAndNotify(payload: FranchizeOrderNotifyPayload) {
  const logId = await createFranchizeOrderNotificationLog(payload);

  try {
    const { data: cars, error: carsError } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs")
      .in("id", payload.cartLines.map((line) => line.itemId));

    if (carsError) {
      logger.error("[franchize] failed to load cars for order doc", carsError);
    }

    const byId = new Map((cars || []).map((car) => [car.id, car]));
    const extrasRows = payload.extras.length
      ? payload.extras
          .map((extra) => `| ${extra.label} | 1 | ${formatMoney(extra.amount)} ₽ | ${formatMoney(extra.amount)} ₽ |`)
          .join("\n")
      : "| Без доп. опций | 0 | 0 ₽ | 0 ₽ |";

    const flowType = (payload.flowType ?? "rental") as FranchizeOrderFlowType;
    const isSaleFlow = flowType === "sale" || flowType === "mixed";
    const isTestdrive = flowType === "testdrive";

    // For mixed flow, determine each bike's individual flow type
    // based on whether it has rental pricing or sale pricing
    const bikeFlowTypes = payload.cartLines.map((line) => {
      if (isTestdrive) return "testdrive";
      if (flowType === "sale") return "sale";
      if (flowType === "rental") return "rental";
      // Mixed flow: check if this specific bike is for sale or rent
      const car = byId.get(line.itemId);
      const specs = (car?.specs as Record<string, unknown> | null) || {};
      const hasSalePrice = Boolean(specs.sale_price && Number(specs.sale_price) > 0);
      const hasRentalPrice = Boolean(line.pricePerDay && line.pricePerDay > 0);
      // If both, prefer sale (explicit sale intent)
      if (hasSalePrice) return "sale";
      if (hasRentalPrice) return "rental";
      // Default to rental
      return "rental";
    });

    const rentDays = Math.max(...payload.cartLines.map((line) => parseDurationDays(line.options.duration)));
    const rentStartDate = payload.rentalStartDate || payload.time;
    const rentEndDate = payload.rentalEndDate || payload.time;

    // Load templates based on what flow types are present in the cart.
    // For mixed flow, we need BOTH rental and sale templates so each bike
    // gets the correct one. For pure flows, only one template is loaded.
    const needsRentalTemplate = bikeFlowTypes.includes("rental");
    const needsSaleTemplate = bikeFlowTypes.includes("sale");
    const needsTestdriveTemplate = bikeFlowTypes.includes("testdrive");

    let rentalTemplate: string | null = null;
    let saleTemplate: string | null = null;
    let testdriveTemplate: string | null = null;
    let templateMode: "md" | "html" = "html";

    if (needsRentalTemplate) {
      const result = await loadFranchizeDealTemplate(payload.slug, "rental");
      rentalTemplate = result.template;
      templateMode = result.templateMode;
    }
    if (needsSaleTemplate) {
      const result = await loadFranchizeDealTemplate(payload.slug, "sale");
      saleTemplate = result.template;
      templateMode = result.templateMode;
    }
    if (needsTestdriveTemplate) {
      const result = await loadFranchizeDealTemplate(payload.slug, "testdrive");
      testdriveTemplate = result.template;
      templateMode = result.templateMode;
    }
    const privateReadContext = { source: "buildFranchizeOrderDocAndNotify", orderId: payload.orderId };
    const userSensitive = await getUserSensitiveDataOrDefault(payload.telegramUserId, privateReadContext);
    const crewSensitive = await getCrewSensitiveDataOrDefault(payload.slug, privateReadContext);
    const contractDefaults = (crewSensitive.contractDefaults ?? {}) as UnknownRecord;
    // FIX: contract_defaults in crew_secrets is a FLAT JSON object (not nested
    // under a "defaults" key). The old code did readPath(contractDefaults, ["defaults"], {})
    // which always returned {} because there is no nested "defaults" key.
    // This caused all org fields to fall back to "Franchize" / empty strings.
    const defaults = contractDefaults;
    const docIdentity = resolveAndValidateFranchizeDocVariables(payload, userSensitive);

    // Fetch verified rental secrets from past rentals — richest personal data source
    // Priority chain: rental secrets (verified OCR/past contract) > userSensitive > placeholder
    const rentalSecretsRecord = await getVerifiedRentalSecrets(payload.telegramUserId, payload.slug);
    // Extract non-null string fields for convenient access in variables map
    const rentalSecrets: Record<string, string> = {};
    if (rentalSecretsRecord) {
      for (const [key, value] of Object.entries(rentalSecretsRecord)) {
        if (typeof value === "string" && value.trim().length > 0) {
          rentalSecrets[key] = value.trim();
        }
      }
    }

    // Parse driver license string into series/number if available
    let driverLicenseSeries = "";
    let driverLicenseNumber = "";
    const driverLicenseFull = rentalSecrets?.renter_driver_license || userSensitive.driverLicense || payload.renterDriverLicense || "";
    if (driverLicenseFull && driverLicenseFull !== "указывается при выдаче") {
      const dlParts = driverLicenseFull.trim().split(/\s+/);
      if (dlParts.length >= 3) {
        // Format: "12 34 567890" or "1234 567890"
        if (dlParts.length === 3 && dlParts[0].length <= 4 && dlParts[1].length <= 6) {
          driverLicenseSeries = dlParts[0];
          driverLicenseNumber = `${dlParts[1]} ${dlParts[2]}`;
        } else if (dlParts.length >= 2) {
          driverLicenseSeries = dlParts[0];
          driverLicenseNumber = dlParts.slice(1).join(" ");
        }
      }
    }

    // Parse passport string into series/number if available
    let passportSeries = "";
    let passportNumber = "";
    const passportFull = rentalSecrets?.renter_passport || userSensitive.passport || payload.renterPassport || "";
    if (passportFull && passportFull !== "указывается при выдаче") {
      const passParts = passportFull.trim().split(/\s+/);
      if (passParts.length >= 2) {
        passportSeries = passParts[0];
        passportNumber = passParts.slice(1).join(" ");
      }
    }

    // Build crew secrets object matching RentalCrewSecrets type
    // FIX: Key names must match the hydration SQL which uses camelCase
    // (organizationName, organizationShort, etc.), not snake_case.
    // readPath traverses nested paths, so we use readFirst for alternatives.
    const readFirst = (keys: string[], fallback: string): string => {
      for (const key of keys) {
        const val = readPath<string>(defaults, [key], "");
        if (val && typeof val === "string" && val.trim().length > 0) return val;
      }
      return fallback;
    };
    const crewSecrets: RentalCrewSecrets = {
      legalAddress: readFirst(["legalAddress", "legal_address"], "г. Нижний Новгород"),
      returnAddress: readFirst(["returnAddress", "return_address", "lessor_address"], "г. Нижний Новгород, пл. Комсомольская 2"),
      issuerName: readFirst(["issuerName", "issuer_name", "organizationShort", "organization_short"], `ИП Воробьева Р.В.`),
      signatoryRole: readFirst(["issuer_signatory", "signatoryRole"], "Менеджер Мотосалона"),
      organizationRepresentative: readFirst(["organizationRepresentative", "organization_representative", "issuer_representative"], "Сидоров Илья Олегович"),
      organizationName: readFirst(["organizationName", "organization_name"], "Мотосалон ВипБайкЭлектро"),
      organizationShort: readFirst(["organizationShort", "organization_short"], "ИП Воробьева Р.В."),
      ogrnip: readFirst(["ogrnip", "OGRNIP"], ""),
      inn: readFirst(["inn", "INN"], ""),
      bankAccount: readFirst(["bankAccount", "bank_account"], ""),
      bankName: readFirst(["bankName", "bank_name"], ""),
      bankCity: readFirst(["bankCity", "bank_city"], ""),
      bankCorrAccount: readFirst(["bankCorrAccount", "bank_corr_account"], ""),
      email: readFirst(["email"], ""),
      contractDefaults: defaults,
    };

    // === MULTI-BIKE DOCUMENT GENERATION ===
    // Generate one DOCX per bike in cart
    const bikeDocs: Array<{ bytes: Uint8Array; fileName: string; bikeName: string; bikeId: string; documentKey: string; sha256: string }> = [];
    // Collect per-bike equipment data for todo creation after the loop
    const bikeEquipment: Array<{ bikeId: string; bikeName: string; equipment: { helmets: number; gloves: number; jacket: boolean; boots: boolean; net: boolean; backpack: boolean; bag: boolean; charger: boolean } }> = [];

    for (let bikeIndex = 0; bikeIndex < payload.cartLines.length; bikeIndex++) {
      const line = payload.cartLines[bikeIndex];
      const car = byId.get(line.itemId);
      if (!car) {
        logger.warn("[franchize] car not found for cart line", { itemId: line.itemId, bikeIndex });
        continue;
      }

      const specs = (car.specs as Record<string, unknown> | null) || {};
      const dailyPriceRub = line.pricePerDay || Math.round(line.lineTotal / Math.max(1, parseDurationDays(line.options.duration)));

      // ── SALE flow: build sale-specific variables (aligned with /doc command) ──
      if (bikeFlowTypes[bikeIndex] === "sale") {
        const now = new Date();
        const salePrice = String(line.lineTotal || payload.totalAmount || "390000");
        const isElectric = String(specs.type || "").toLowerCase() === "electric" || /электро|electric|e-bike/i.test(String(specs.type || specs.fuel_type || ""));

        // Effective color/VIN from bike specs (web app doesn't collect overrides like /doc)
        const effectiveColor = String(specs.color || "уточняется");
        const bikeCatalogVin = String(specs.vin || specs.frame || specs.vin_number || "").trim();
        const effectiveVin = bikeCatalogVin || "уточняется";

        const saleVariables: Record<string, string> = {
          contract_number: `${now.getDate()}.${now.getMonth() + 1}/${car.id}`,
          day: String(now.getDate()).padStart(2, "0"),
          month: now.toLocaleString("ru-RU", { month: "long" }),
          month_num: String(now.getMonth() + 1).padStart(2, "0"),
          year: String(now.getFullYear()),
          contract_day: String(now.getDate()),
          contract_month_genitive: now.toLocaleString("ru-RU", { month: "long" }),
          contract_year: String(now.getFullYear()),
          appendix_date: `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`,
          buyer_full_name: payload.recipient || "",
          buyer_short_name: (payload.recipient || "").split(" ").map((n, i) => i === 0 ? n : `${n[0]}.`).join(" ") || "",
          buyer_birth_date: payload.birthDate || docIdentity.renterBirthDate || "",
          buyer_passport_number: [payload.passportSeries, payload.passportNumber].filter(Boolean).join(" ").trim() || rentalSecrets?.renter_passport || String(userSensitive.passport || "") || "указывается при выдаче",
          buyer_passport_issued_by: payload.passportIssuedBy || rentalSecrets?.renter_passport_issued_by || "",
          buyer_passport_issue_date: payload.passportIssueDate || rentalSecrets?.renter_passport_issue_date || "",
          buyer_registration: payload.registrationAddress || rentalSecrets?.renter_registration || "",
          buyer_email: docIdentity.renterEmail || "",
          buyer_phone: docIdentity.renterPhone || payload.phone || "",
          product_name: isElectric ? "Электромотоцикл" : "Мотоцикл",
          product_color: effectiveColor,
          product_type: String(specs.bike_subtype || (isElectric ? "Электромотоцикл" : "Мотоцикл")),
          product_motor_type: isElectric ? "Электрический двигатель" : "ДВС",
          product_motor_power: specs.power_kw ? `${specs.power_kw} кВт` : (specs.engine_cc ? `рабочий объем ${specs.engine_cc} куб.см` : ""),
          product_vin: effectiveVin,
          product_year: String(specs.year || "уточняется"),
          product_unit: "шт.",
          spec_number: `${now.getDate()}.${now.getMonth() + 1}/${car.id}`,
          seller_address: crewSecrets.legalAddress,
          lessor_address: crewSecrets.legalAddress,
          issuer_name: crewSecrets.issuerName,
          issuer_signatory: crewSecrets.signatoryRole || "Менеджер",
          issuer_representative: crewSecrets.organizationRepresentative || crewSecrets.issuerName,
          organization_name: crewSecrets.organizationName,
          organization_short: crewSecrets.organizationShort,
          ogrnip: crewSecrets.ogrnip,
          inn: crewSecrets.inn,
          bank_account: crewSecrets.bankAccount,
          bank_name: crewSecrets.bankName,
          bank_city: crewSecrets.bankCity,
          bank_corr_account: crewSecrets.bankCorrAccount,
          email: crewSecrets.email,
          legal_address: crewSecrets.legalAddress,
          signature_timestamp: now.toLocaleString("ru-RU"),
          signature_fingerprint: payload.signatureFingerprint || "web-app-sale",
          renter_signature: payload.signatureName || "электронное согласие в Telegram WebApp",
          price_digits: salePrice,
          price_words: numberToWords(Number(salePrice) || 0),
          price_digits_table: salePrice.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1 ") + ",00",
          warranty_months: "0",
          document_key: `sale-${car.id}-${Date.now()}`,
          bike_make: car.make || "уточняется",
          bike_model: car.model || "уточняется",
          bike_vin: effectiveVin,
          bike_category: String(specs.category || "A/L3"),
          bike_color: effectiveColor,
          bike_year: String(specs.year || "уточняется"),
          bike_engine_cc: String(specs.engine_cc || specs.displacement_cc || "0"),
          bike_power_hp: String(specs.power_hp || specs.max_power_hp || "0"),
          bike_power_kw: (() => {
            const raw = String(specs.power_kw || "0");
            if (isElectric) {
              const num = Number(raw);
              return num > 3 ? "3" : raw;
            }
            return raw;
          })(),
          bike_battery: String(specs.battery || (isElectric ? "уточняется" : "")),
        };

        const saleDocFileName = `sale-${car.make}-${car.model}-${now.toISOString().split("T")[0]}.docx`.replace(/\s+/g, "-");
        const saleVerifierScope = `sale:${payload.slug}:${payload.orderId}:bike${bikeIndex}`;

        const { bytes, sha256 } = await buildFranchizeDocxFromTemplate({
          integrationScope: saleVerifierScope,
          uploadedBy: "franchize-order-system",
          documentKey: saleVariables.document_key,
          fileName: saleDocFileName,
          template: saleTemplate!,
          variables: saleVariables,
          flowType: "sale",
          templateMode,
        });

        bikeDocs.push({
          bytes,
          fileName: saleDocFileName,
          bikeName: `${car.make} ${car.model}`,
          bikeId: car.id,
          documentKey: saleVariables.document_key,
          sha256,
        });

        continue; // Skip the rental builder below
      }

      // ── TESTDRIVE flow: build simple vars (customer_* not renter_*) ──
      if (bikeFlowTypes[bikeIndex] === "testdrive") {
        const now = new Date();
        const passportStr = [payload.passportSeries, payload.passportNumber].filter(Boolean).join(" ").trim();
        const licenseStr = [payload.licenseSeries, payload.licenseNumber].filter(Boolean).join(" ").trim();
        const tdVariables: Record<string, string> = {
          contract_number: `${payload.slug.toUpperCase()}-${payload.orderId}-${bikeIndex + 1}`,
          day: String(now.getDate()).padStart(2, "0"),
          month: now.toLocaleString("ru-RU", { month: "long" }),
          year: String(now.getFullYear()),
          customer_full_name: payload.recipient || "",
          customer_short_name: (payload.recipient || "").split(" ").map((n, i) => i === 0 ? n : `${n[0]}.`).join(" "),
          customer_phone: docIdentity.renterPhone || payload.phone || "",
          customer_passport_number: passportStr || "",
          customer_passport_issued_by: payload.passportIssuedBy || "",
          customer_passport_issue_date: payload.passportIssueDate || "",
          customer_birth_date: payload.birthDate || docIdentity.renterBirthDate || "",
          customer_registration: payload.registrationAddress || "",
          license_series: payload.licenseSeries || "",
          license_number: payload.licenseNumber || "",
          license_issue_date: "",
          license_expiry_date: payload.licenseExpiryDate || "",
          license_category: payload.licenseCategories || "",
          bike_make: car.make || "уточняется",
          bike_model: car.model || "уточняется",
          bike_color: String(specs.color || "уточняется"),
          bike_year: String(specs.year || now.getFullYear()),
          price_digits: String(payload.totalAmount || 5000),
          price_words: numberToWords(payload.totalAmount || 5000),
          deposit_rub: "0",
          deposit_words: numberToWords(0),
          organization_name: crewSecrets.organizationName,
          organization_short: crewSecrets.organizationShort,
          issuer_name: crewSecrets.issuerName,
          issuer_signatory: crewSecrets.signatoryRole || crewSecrets.issuerName || "Менеджер",
          ogrnip: crewSecrets.ogrnip,
          inn: crewSecrets.inn,
          legal_address: crewSecrets.legalAddress,
          return_address: crewSecrets.returnAddress || crewSecrets.legalAddress,
          phone: crewSecrets.email ? "" : "",
          email: crewSecrets.email,
          signature_timestamp: now.toLocaleString("ru-RU"),
          document_key: `testdrive-${payload.slug}-${payload.orderId}-bike${bikeIndex}`,
        };

        const tdDocFileName = `testdrive-${payload.slug}-${payload.orderId}-bike${bikeIndex}.docx`;
        const tdVerifierScope = `testdrive:${payload.slug}:${payload.orderId}:bike${bikeIndex}`;
        try {
          const { bytes, sha256 } = await buildFranchizeDocxFromTemplate({
            integrationScope: tdVerifierScope,
            uploadedBy: "franchize-order-system",
            documentKey: tdVariables.document_key,
            fileName: tdDocFileName,
            template: testdriveTemplate!,
            variables: tdVariables,
            flowType: "testdrive" as any,
            templateMode,
          });
          bikeDocs.push({
            bytes, fileName: tdDocFileName, bikeName: `${car.make} ${car.model}`, bikeId: car.id,
            documentKey: tdVariables.document_key, sha256,
          });
        } catch (tdErr) {
          logger.error("[franchize] testdrive doc generation failed", { error: tdErr instanceof Error ? tdErr.message : String(tdErr) });
        }
        continue; // Skip the rental/sale builder below
      }

      // ── Parse equipment from cart line perk string ──────────────────────
      // The Item modal stores extras in the `perk` field as a human-readable
      // string like "🪖 Шлем ×1, 🧤 Перчатки, 🔌 Зарядка" or "стандарт".
      // We parse this back into the equipment object for the contract builder.
      const perkStr = String((line as any).options?.perk || "").toLowerCase();
      const equipment = {
        helmets: (() => {
          const m = perkStr.match(/шлем\s*×\s*(\d+)/i);
          return m ? Number(m[1]) : 0;
        })(),
        gloves: /перчатк/.test(perkStr) ? 1 : 0,
        jacket: /куртк/.test(perkStr),
        boots: /бот[ыы]|сапог/.test(perkStr),
        net: /сетк/.test(perkStr),
        backpack: /рюкзак/.test(perkStr),
        bag: /сумк|багажн/.test(perkStr),
        charger: /зарядк/.test(perkStr),
      };

      // ── Payment split: cash = deposit, bank = rest (or all cash / all bank) ──
      const depositNum = Number(String(specs.deposit_rub || specs.deposit || 20000).replace(/[^\d]/g, "")) || 20000;
      const lineTotal = line.lineTotal || 0;
      const paymentSplit = (() => {
        if (payload.payment === "cash") {
          return { cashAmount: lineTotal + depositNum, bankAmount: 0 };
        }
        // card / sbp → cash = deposit, bank = rent + equipment
        return { cashAmount: depositNum, bankAmount: lineTotal };
      })();

      // Use shared builder for rental contracts
      const baseVariables = buildRentalContractVariables({
        renter: {
          fullName: payload.recipient || "",
          phone: docIdentity.renterPhone || "",
          birthDate: payload.birthDate || docIdentity.renterBirthDate || "",
          email: docIdentity.renterEmail || "",
          passportSeries: payload.passportSeries || passportSeries || undefined,
          passportNumber: payload.passportNumber || passportNumber || undefined,
          passportIssueDate: payload.passportIssueDate || rentalSecrets?.renter_passport_issue_date || String(readPath(userSensitive, ["passportIssueDate"], "") || readPath(userSensitive, ["passport_issue_date"], "")) || "",
          passportIssuedBy: payload.passportIssuedBy || rentalSecrets?.renter_passport_issued_by || "",
          registration: payload.registrationAddress || rentalSecrets?.renter_registration || String(readPath(userSensitive, ["registration"], "")) || "",
          address: payload.registrationAddress || rentalSecrets?.renter_address || payload.pickupAddress || String(readPath(userSensitive, ["renterAddress"], "") || readPath(userSensitive, ["registration"], "")) || "",
          driverLicenseSeries: payload.licenseSeries || driverLicenseSeries || undefined,
          driverLicenseNumber: payload.licenseNumber || driverLicenseNumber || undefined,
        },
        bike: {
          id: car.id,
          make: car.make,
          model: car.model,
          type: String(specs.type || ""),
          specs,
        },
        period: {
          startDate: rentStartDate,
          // FIX: Was hardcoded "12:00" — ignored the user-picked pickup
          // time on the cart line. Read the explicit time fields from
          // the cart line options when available, fall back to 10:00.
          startTime: (line as any).options?.rentStartTime || "10:00",
          endDate: rentEndDate,
          endTime: (line as any).options?.rentEndTime || "10:00",
          dailyPrice: dailyPriceRub,
          hourlyPrice: Number(specs.price_per_hour || 0),
        },
        crewSecrets,
        meta: {
          // Sequential contract numbers for multi-bike: "11.7/falcon-pro-2025-1", "11.7/rerode-r1-plus-2"
          // Single bike: "11.7/falcon-pro-2025" (no suffix, matches /doc format)
          contractNumber: payload.cartLines.length > 1
            ? `${new Date().getDate()}.${new Date().getMonth() + 1}/${car.id}-${bikeIndex + 1}`
            : `${new Date().getDate()}.${new Date().getMonth() + 1}/${car.id}`,
          contractDate: new Date().toLocaleDateString("ru-RU"),
          signatureTimestamp: new Date().toLocaleString("ru-RU"),
          signatureFingerprint: payload.signatureFingerprint || "—",
          renterSignature: payload.signatureName || "электронное согласие в Telegram WebApp",
          documentKey: `${isSaleFlow ? "sale" : "rental"}-${car.id}-${Date.now()}`,
          verifiedAt: new Date().toISOString(),
        },
        extrasRows,
        extrasTotalRub: formatMoney(payload.extrasTotal),
        // Pass cart-calculated priceBreakdown to ensure contract matches cart
        priceBreakdown: (line as any).priceBreakdown,
        // ── Equipment selection parsed from perk string ──
        equipment,
        // ── Payment split based on user-selected payment method ──
        paymentSplit,
      });

      // Merge with web-app specific overrides
      // FIX: Use per-bike line.lineTotal instead of payload.totalAmount
      // so each bike's contract shows its own price, not the order total.
      const variables: RentalContractVariables = {
        ...baseVariables,
        // Web app specific overrides that aren't in the shared builder
        rent_days: String(rentDays),
        total_price_rub: formatMoney(line.lineTotal || payload.totalAmount),
        // Use formatMoney for price fields that expect formatted strings
        hourly_price_rub: formatMoney(Number(specs.price_per_hour || 0)),
        daily_price_rub: formatMoney(dailyPriceRub),
        subtotal_rub: formatMoney(line.lineTotal || payload.subtotal),
        // Include renter_phone explicitly (shared builder has it but ensure it's present)
        renter_phone: docIdentity.renterPhone || "",
        // FIX: Don't override equipment with "—" — the shared builder already
        // computed equipment_summary from the parsed equipment object.
        // Only override media_links (no user-generated media in web flow).
        media_links: "—",
        // FIX: Web app client sends structured passportSeries+passportNumber, not
        // combined renterPassport. Combine them explicitly so user-entered data
        // isn't lost to the "указывается при выдаче" fallback. Priority:
        // 1. rentalSecrets (verified from past contract)
        // 2. userSensitive (from Telegram profile)
        // 3. structured fields from web app order form (passportSeries+passportNumber)
        // 4. legacy combined field (payload.renterPassport — rarely set)
        // 5. placeholder
        renter_passport: rentalSecrets?.renter_passport
          || userSensitive.passport
          || [payload.passportSeries, payload.passportNumber].filter(Boolean).join(" ").trim()
          || payload.renterPassport
          || "указывается при выдаче",
        // Same fix for driver license: web app sends licenseSeries+licenseNumber
        renter_driver_license: rentalSecrets?.renter_driver_license
          || userSensitive.driverLicense
          || (payload.hasLicense === false ? "" : [payload.licenseSeries, payload.licenseNumber].filter(Boolean).join(" ").trim())
          || payload.renterDriverLicense
          || "указывается при выдаче",
      };

      const docFileName = `rental-${car.make}-${car.model}-${rentStartDate || new Date().toISOString().slice(0, 10)}.docx`.replace(/\s+/g, '-');
      const verifierScope = `${flowType}:${payload.slug}:${payload.orderId}:bike${bikeIndex}`;
      const { bytes, renderedMarkdown, verifierRecordId, sha256 } = await buildFranchizeDocxFromTemplate({
        integrationScope: verifierScope,
        uploadedBy: "franchize-order-system",
        documentKey: variables.document_key,
        fileName: docFileName,
        template: rentalTemplate!,
        variables,
        flowType: flowType as any,
        templateMode,
      });

      bikeDocs.push({
        bytes,
        fileName: docFileName,
        bikeName: `${car.make} ${car.model}`,
        bikeId: car.id,
        documentKey: variables.document_key,
        sha256,
      });
    }

    if (bikeDocs.length === 0) {
      throw new Error("No valid bikes found in cart for document generation");
    }

    // ── Upload DOCX to Supabase Storage (aligned with /doc command) ──
    // This ensures contracts are permanently stored and can be re-downloaded.
    for (const doc of bikeDocs) {
      try {
        const uploadResult = await uploadDocxToStorage({
          crewSlug: payload.slug,
          contractKey: doc.documentKey,
          buffer: Buffer.from(doc.bytes),
          metadata: {
            source: "franchize-web-order",
            flow_type: flowType,
            bike_id: doc.bikeId,
            bike_name: doc.bikeName,
            order_id: payload.orderId,
          },
        });
        // Attach storage_path to doc object for later use in artifacts
        (doc as any).storagePath = uploadResult.storagePath;
        logger.info("[franchize] DOCX uploaded to storage:", {
          documentKey: doc.documentKey,
          storagePath: uploadResult.storagePath,
        });
      } catch (uploadErr) {
        logger.warn("[franchize] Storage upload failed (non-fatal):", {
          documentKey: doc.documentKey,
          error: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
        });
      }
    }

    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (!adminChatId) {
      throw new Error("ADMIN_CHAT_ID not configured");
    }

    // Update admin notification to reflect multiple bikes
    const bikeCount = bikeDocs.length;
    const bikeLabel = bikeCount === 1
      ? bikeDocs[0].bikeName
      : `${bikeCount} ${bikeCount === 2 ? "мотоцикла" : "мотоциклов"}`;

    // ── Extract accessories from cart lines ──
    const accessoryLabels = payload.cartLines
      .map((line: any) => String(line?.options?.perk || ""))
      .filter((p: string) => p && p !== "стандарт");
    const accessoriesStr = accessoryLabels.length > 0
      ? accessoryLabels.join("; ")
      : "—";

    // ── Build rental period string (times from cart line options) ──
    const firstLine = payload.cartLines[0] as any;
    const rentStartTime = firstLine?.options?.rentStartTime || "10:00";
    const rentEndTime = firstLine?.options?.rentEndTime || "10:00";
    const periodStr = payload.rentalStartDate
      ? `${payload.rentalStartDate} ${rentStartTime} → ${payload.rentalEndDate || "..."} ${rentEndTime}`
      : payload.time || "по согласованию";

    // ── Enhanced notification with bike label for ALL flows, accessories, and actual time ──
    const notificationParts = [
      `${flowType === "mixed" ? "📦 Смешанный заказ (аренда + покупка)" : isSaleFlow ? "🛍️ Новый заказ на покупку" : isTestdrive ? "🏁 Новый заказ на тест-драйв" : "🧾 Новый заказ на аренду"} #${payload.orderId}`,
      `Байк: ${bikeLabel}`,
      `Crew: ${payload.slug}`,
      `Получатель: ${payload.recipient}`,
      `Телефон: ${payload.phone}`,
    ];
    // Rental period (actual dates, not just the comment field)
    if (payload.rentalStartDate) {
      notificationParts.push(`Период: ${periodStr}`);
    }
    if (payload.time && payload.time !== "по согласованию") {
      notificationParts.push(`Комментарий: ${payload.time}`);
    }
    notificationParts.push(
      `Экипировка: ${accessoriesStr}`,
      `Оплата: ${payload.payment}`,
      `Доставка: ${payload.delivery}`,
      `Итого: ${formatMoney(payload.totalAmount)} ₽`,
    );
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vip-bike.ru";
    notificationParts.push(
      ``,
      `🔗 Аренда: ${siteUrl}/franchize/${payload.slug}/rentals`,
      `📋 Лиды: ${siteUrl}/franchize/${payload.slug}/leads`,
    );

    await notifyAdmin(notificationParts.join("\n"));

    // ── Send notification to creator too (Issue 4) ──
    if (payload.telegramUserId && payload.telegramUserId !== adminChatId) {
      const userNotification = [
        `${flowType === "mixed" ? "📦 Смешанный заказ" : isSaleFlow ? "🛍️ Заказ на покупку" : isTestdrive ? "🏁 Заказ на тест-драйв" : "🧾 Заказ на аренду"} #${payload.orderId}`,
        `Байк: ${bikeLabel}`,
        `Статус: оформлен, договор готов`,
        payload.rentalStartDate ? `Период: ${payload.rentalStartDate} ${rentStartTime} → ${payload.rentalEndDate || "..."} ${rentEndTime}` : "",
      ].filter(Boolean).join("\n");

      try {
        const { sendComplexMessage } = await import("@/app/webhook-handlers/actions/sendComplexMessage");
        await sendComplexMessage(payload.telegramUserId, userNotification);
      } catch (userNotifyErr) {
        logger.warn("[franchize] Failed to send notification to order creator", {
          telegramUserId: payload.telegramUserId,
          error: userNotifyErr instanceof Error ? userNotifyErr.message : String(userNotifyErr),
        });
      }
    }

    const recipientSet = new Set<string>([adminChatId, payload.telegramUserId]);
    const { data: crewRow } = await supabaseAdmin
      .from("crews")
      .select("owner_id, metadata")
      .eq("slug", payload.slug)
      .maybeSingle();
    // owner_id IS the Telegram chat ID (user_id === telegram chat_id)
    if (crewRow?.owner_id) {
      recipientSet.add(String(crewRow.owner_id));
    }

    // ── Persist each bike document to rental_contract_artifacts ────────────────
    // For audit trail and consistent access across flows
    for (const doc of bikeDocs) {
      try {
        // Build passport + license strings from structured fields (like /doc)
        const passportStr = [payload.passportSeries, payload.passportNumber].filter(Boolean).join(" ").trim()
          || rentalSecrets?.renter_passport || userSensitive.passport || payload.renterPassport || null;
        const licenseStr = (payload.hasLicense !== false
          ? [payload.licenseSeries, payload.licenseNumber].filter(Boolean).join(" ").trim()
          : "")
          || (payload.hasLicense === false ? null : (rentalSecrets?.renter_driver_license || userSensitive.driverLicense || payload.renterDriverLicense || null));

        if (flowType === "sale") {
          // ── Sale contract artifacts (aligned with /doc command) ──────────
          // Use per-bike price from cart line (not order total)
          const bikeIndex = bikeDocs.indexOf(doc);
          const cartLine = payload.cartLines[bikeIndex];
          const salePrice = String(cartLine?.lineTotal || payload.totalAmount || "0");

          // Dedup by semantic key: same buyer + same bike = duplicate (retry)
          const { data: existingSale } = await supabaseAdmin
            .schema("private" as any)
            .from("sale_contract_artifacts")
            .select("id, storage_path")
            .eq("buyer_full_name", payload.recipient || "")
            .eq("resolved_bike_id", doc.bikeId)
            .maybeSingle();

          if (existingSale) {
            logger.info("[franchize] Duplicate sale detected (same buyer+bike), skipping", {
              existingId: existingSale.id,
              documentKey: doc.documentKey,
            });
            // Backfill storage_path on existing record if missing
            if (!existingSale.storage_path && (doc as any).storagePath) {
              await supabaseAdmin
                .schema("private" as any)
                .from("sale_contract_artifacts")
                .update({ storage_path: (doc as any).storagePath })
                .eq("id", existingSale.id);
              logger.info("[franchize] Backfilled storage_path on existing sale artifact");
            }
            continue; // Skip insert for this bike
          }

          const { error: artifactError } = await supabaseAdmin
            .schema("private" as any)
            .from("sale_contract_artifacts")
            .insert({
              contract_key: doc.documentKey,
              storage_path: (doc as any).storagePath || null,
              original_sha256: doc.sha256,
              requested_bike_id: null,
              resolved_bike_id: doc.bikeId,
              telegram_chat_id: payload.telegramUserId,
              telegram_message_id: null,
              buyer_full_name: payload.recipient || null,
              buyer_passport_number: passportStr,
              buyer_passport_issued_by: payload.passportIssuedBy || rentalSecrets?.renter_passport_issued_by || null,
              buyer_passport_issue_date: payload.passportIssueDate || rentalSecrets?.renter_passport_issue_date || null,
              buyer_registration: payload.registrationAddress || rentalSecrets?.renter_registration || null,
              sale_price: salePrice,
              warranty_months: "0",
              template_version: CURRENT_RENTAL_TEMPLATE_VERSION,
              metadata: {
                flow_type: flowType,
                order_id: payload.orderId,
                file_name: doc.fileName,
                source: "franchize-web-order",
                bike_id: doc.bikeId,
                bike_name: doc.bikeName,
              },
            });
          if (artifactError) {
            logger.error("[franchize] Failed to save sale_contract_artifact", {
              documentKey: doc.documentKey,
              error: artifactError.message,
            });
          }
        } else {
          // ── Rental/testdrive contract artifacts ────────────────────────────
          // Use per-bike price from cart line (aligned with sale artifacts)
          const bikeIndex = bikeDocs.indexOf(doc);
          const cartLine = payload.cartLines[bikeIndex];
          const bikePrice = cartLine?.lineTotal || payload.totalAmount;

          // Dedup by semantic key: same renter + same bike + same start date = duplicate (retry)
          const { data: existingRental } = await supabaseAdmin
            .schema("private" as any)
            .from("rental_contract_artifacts")
            .select("id, storage_path")
            .eq("renter_full_name", payload.recipient || "")
            .eq("resolved_bike_id", doc.bikeId)
            .eq("rent_start_date", rentStartDate || "")
            .maybeSingle();

          if (existingRental) {
            logger.info("[franchize] Duplicate rental detected (same renter+bike+date), skipping", {
              existingId: existingRental.id,
              documentKey: doc.documentKey,
            });
            // Backfill storage_path on existing record if missing
            if (!existingRental.storage_path && (doc as any).storagePath) {
              await supabaseAdmin
                .schema("private" as any)
                .from("rental_contract_artifacts")
                .update({ storage_path: (doc as any).storagePath })
                .eq("id", existingRental.id);
              logger.info("[franchize] Backfilled storage_path on existing rental artifact");
            }
            continue; // Skip insert for this bike
          }

          const { error: artifactError } = await supabaseAdmin
            .schema("private" as any)
            .from("rental_contract_artifacts")
            .insert({
              contract_key: doc.documentKey,
              storage_path: (doc as any).storagePath || null,
              original_sha256: doc.sha256,
              requested_bike_id: null,
              resolved_bike_id: doc.bikeId, // FIX: now properly resolved to actual bike ID
              telegram_chat_id: payload.telegramUserId,
              telegram_message_id: null,
              renter_full_name: payload.recipient || null,
              renter_passport: passportStr,
              renter_passport_issued_by: payload.passportIssuedBy || rentalSecrets?.renter_passport_issued_by || null,
              renter_passport_issue_date: payload.passportIssueDate || rentalSecrets?.renter_passport_issue_date || null,
              renter_registration: payload.registrationAddress || rentalSecrets?.renter_registration || null,
              renter_driver_license: licenseStr,
              renter_birth_date: payload.birthDate || docIdentity.renterBirthDate || null,
              license_categories: payload.licenseCategories || rentalSecrets?.license_categories || null,
              rent_start_date: rentStartDate || null,
              rent_end_date: rentEndDate || null,
              daily_price: null,
              deposit_rub: null,
              total_sum: bikePrice,
              template_version: CURRENT_RENTAL_TEMPLATE_VERSION,
              metadata: {
                flow_type: flowType,
                order_id: payload.orderId,
                file_name: doc.fileName,
                source: "franchize-web-order",
                bike_id: doc.bikeId,
                bike_name: doc.bikeName,
              },
            });
          if (artifactError) {
            logger.error("[franchize] Failed to save rental_contract_artifact", {
              documentKey: doc.documentKey,
              error: artifactError.message,
            });
          }
        }
      } catch (artifactError) {
        logger.error("[franchize] Exception saving contract artifact", {
          documentKey: doc.documentKey,
          error: artifactError instanceof Error ? artifactError.message : String(artifactError),
        });
      }
    }

    // ── Send DOCX for each bike ─────────────────────────────────────────────
    // Web app users are already authenticated; QR for repeat rental is unnecessary.
    // The /doc command flow (different code path) handles QR generation for unauthenticated users.

    for (const recipientId of recipientSet) {
      for (const doc of bikeDocs) {
        const sendDocResult = await sendTelegramDocument(recipientId, new Blob([doc.bytes]), doc.fileName);
        if (!sendDocResult.success) {
          throw new Error(sendDocResult.error || `Failed to send DOCX ${doc.fileName} to ${recipientId}`);
        }
      }
    }

    // Use the first bike's document info for the notification log
    await updateFranchizeOrderNotificationLog(logId, {
      send_status: "sent",
      rendered_markdown: `Generated ${bikeDocs.length} contract${bikeDocs.length > 1 ? "s" : ""}: ${bikeDocs.map(d => d.fileName).join(", ")}`,
      doc_file_name: bikeDocs.map(d => d.fileName).join(", "),
      last_error: "",
    });

    let sourceRentalId: string | null = null;

    if (flowType === "rental") {
      const { data: rentalRow, error: rentalLookupError } = await supabaseAdmin
        .from("rentals")
        .select("rental_id, metadata")
        .eq("metadata->>orderId", payload.orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rentalLookupError) {
        logger.warn("[franchize] rental lookup for contract attachment failed", {
          orderId: payload.orderId,
          slug: payload.slug,
          error: rentalLookupError.message,
        });
      } else if (!rentalRow?.rental_id) {
        logger.warn("[franchize] rental not found for contract attachment", {
          orderId: payload.orderId,
          slug: payload.slug,
        });
      } else {
        sourceRentalId = String(rentalRow.rental_id);
        const existingMetadata =
          rentalRow.metadata && typeof rentalRow.metadata === "object" ? (rentalRow.metadata as Record<string, unknown>) : {};
        const rentalScope = `rental:${rentalRow.rental_id}`;

        // Attach all bike documents to the rental metadata
        const contractVerifiers = bikeDocs.map((doc, idx) => {
          const verifierScope = `${flowType}:${payload.slug}:${payload.orderId}:bike${idx}`;
          return {
            scope: rentalScope,
            sourceScope: verifierScope,
            documentKey: doc.documentKey,
            originalSha256: doc.sha256,
            status: "verified" as const,
            verifiedAt: new Date().toISOString(),
            expiresAt: null,
          };
        });

        const { error: rentalUpdateError } = await supabaseAdmin
          .from("rentals")
          .update({
            metadata: {
              ...existingMetadata,
              contract_verifiers: contractVerifiers,
              // Also keep the first one as the primary for backward compatibility
              contract_verifier: contractVerifiers[0],
            },
          })
          .eq("rental_id", rentalRow.rental_id);

        if (rentalUpdateError) {
          logger.warn("[franchize] rental contract verifier attachment failed", {
            rentalId: rentalRow.rental_id,
            orderId: payload.orderId,
            error: rentalUpdateError.message,
          });
        }
      }
    }

    // ── Create public.rentals row (aligned with /doc flow) ────────────────
    // This ensures the rental appears in analytics and the bike shows as busy
    if ((flowType === "rental" || flowType === "mixed") && payload.rentalStartDate && payload.rentalEndDate) {
      try {
        // time-aware ISO timestamps (use cart-line times if available)
        const firstLine = payload.cartLines[0];
        const startTime = (firstLine as any)?.options?.rentStartTime || "10:00";
        const endTime = (firstLine as any)?.options?.rentEndTime || "10:00";
        const startIso = new Date(`${payload.rentalStartDate}T${startTime}:00`).toISOString();
        const endIso = new Date(`${payload.rentalEndDate}T${endTime}:00`).toISOString();

        // Resolve crew owner once (avoid N+1 queries)
        const { data: crewRow } = await supabaseAdmin.from("crews").select("id, owner_id").eq("slug", payload.slug).maybeSingle();
        if (!crewRow?.id) {
          logger.error("[franchize] Crew not found for slug:", payload.slug, "— skipping rental creation");
          throw new Error(`Crew not found for slug: ${payload.slug}`);
        }
        const crewId = crewRow.id;
        const crewOwnerChatId = await resolveCrewOwnerChatId(supabaseAdmin, crewId);

        for (const doc of bikeDocs) {
          // For mixed flow, only create rental rows for rental bikes (not sale bikes)
          const bikeIndex = bikeDocs.indexOf(doc);
          const bikeFlowType = bikeFlowTypes[bikeIndex];
          if (bikeFlowType === "sale") continue; // Skip sale bikes in mixed flow

          try {
            const { data: rentalRow, error: rentalInsertError } = await supabaseAdmin
              .from("rentals")
              .insert({
                user_id: payload.telegramUserId,
                owner_id: crewOwnerChatId || payload.telegramUserId,
                vehicle_id: doc.bikeId, // FIX: was bikeName (a label), now uses actual bike ID
                crew_id: crewId,
                requested_start_date: startIso,
                requested_end_date: endIso,
                agreed_start_date: startIso,
                agreed_end_date: endIso,
                status: "pending_confirmation", // 2-step: operator activates via LEADS page → active
                payment_status: payload.payment === "telegram_xtr" ? "interest_paid" : "pending",
                total_cost: Math.round(payload.cartLines[bikeIndex]?.lineTotal || payload.totalAmount),
                metadata: {
                  source: "franchize_web_order",
                  order_id: payload.orderId,
                  doc_sha256: doc.sha256,
                  document_key: doc.documentKey,
                  renter_name: payload.recipient,
                  renter_phone: payload.phone,
                  flow_type: flowType,
                  bike_name: doc.bikeName,
                },
              })
              .select("rental_id")
              .maybeSingle();
            if (rentalInsertError) {
              logger.warn("[franchize] Rental insert error:", { error: rentalInsertError.message, bikeId: doc.bikeId });
            } else if (rentalRow?.rental_id) {
              logger.info("[franchize] Created rental row:", rentalRow.rental_id, "bike:", doc.bikeId);
              
              // Create verification todos for this rental (5 todos: passport mainpage, 
              // passport registration, drivers license, odometer, dates)
              try {
                const { createRentalVerificationTodos } = await import("@/app/franchize/server-actions/rental-verification-todos");
                const leadId = payload.phone || payload.telegramUserId;
                const todosResult = await createRentalVerificationTodos(rentalRow.rental_id, crewId, leadId);
                if (todosResult.success) {
                  logger.info(`[franchize] Created ${todosResult.created} verification todos for rental ${rentalRow.rental_id}`);
                } else {
                  logger.warn(`[franchize] Failed to create verification todos for rental ${rentalRow.rental_id}:`, todosResult.error);
                }
              } catch (todoErr) {
                logger.warn("[franchize] Failed to create verification todos (non-fatal):", todoErr);
              }
            }
          } catch (rentalErr) {
            logger.warn("[franchize] Failed to create rental row:", rentalErr);
          }
        }
      } catch (rentalSetupErr) {
        logger.warn("[franchize] Rental creation setup failed:", rentalSetupErr);
      }
    }

    // ── Create franchize_intents lead (aligned with /doc flow) ──────────
    // ONE lead per order (same person), even with multiple bikes.
    try {
      const { upsertFranchizeLead } = await import("@/app/franchize/lib/leads");
      await upsertFranchizeLead({
        slug: payload.slug,
        userId: payload.phone || payload.telegramUserId,
        intentType: flowType === "sale" ? "sale" : "rent",
        stage: "contract_generated",
        bikeId: bikeDocs[0]?.bikeId,
        bikeTitle: bikeDocs.map((d) => d.bikeName).join(", "),
        phone: payload.phone || undefined,
        fullName: payload.recipient || undefined,
        sourceRoute: `/franchize/${payload.slug}/order/${payload.orderId}`,
        contactChannel: "web_cart",
        urgencyScore: flowType === "rental" ? 90 : 85,
        metadata: {
          dealType: flowType === "sale" ? "sale" : "rent",
          order_id: payload.orderId,
          hasPassport: !!(payload.passportSeries && payload.passportNumber),
          hasLicense: !!(payload.licenseSeries && payload.licenseNumber),
          flow_type: flowType,
          bikeIds: bikeDocs.map((d) => d.bikeId),
          bikeNames: bikeDocs.map((d) => d.bikeName),
          bikeCount: bikeDocs.length,
        },
        ensureUser: true,
      });
    } catch (leadErr) {
      logger.warn("[franchize] Failed to create lead:", leadErr);
    }

    // ── Create crew_todos for equipment return (aligned with /doc-manual flow) ──
    // Todos are PER BIKE — each bike has its own equipment to return.
    // One lead, many todos. Pattern follows doc-manual.ts lines 1705-1751.
    if (flowType === "rental" || flowType === "mixed") {
      try {
        // Resolve crew from slug (no hardcoded fallback)
        const { data: crewRowForTodos } = await supabaseAdmin.from("crews").select("id").eq("slug", payload.slug).maybeSingle();
        if (!crewRowForTodos?.id) {
          logger.warn("[franchize] Cannot create crew_todos: crew not found for slug:", payload.slug);
        } else {
        const crewId = crewRowForTodos.id;
        const leadId = payload.phone || payload.telegramUserId;
        const baseTs = Date.now();
        const allTodoPromises: Promise<unknown>[] = [];

        for (let bikeIndex = 0; bikeIndex < bikeDocs.length; bikeIndex++) {
          const doc = bikeDocs[bikeIndex];
          const line = payload.cartLines[bikeIndex];
          const car = byId.get(line?.itemId);
          const bikeMake = car?.make || doc.bikeName.split(" ")[0] || "Байк";
          const bikeModel = car?.model || doc.bikeName.split(" ").slice(1).join(" ") || "";
          const rentEndDate = payload.rentalEndDate || "";
          const rentEndTime = (line as any)?.options?.rentEndTime || "10:00";

          // Parse equipment from this bike's cart line perk string
          const perkStr = String((line as any)?.options?.perk || "").toLowerCase();
          const equip = {
            helmets: (() => { const m = perkStr.match(/шлем\s*×\s*(\d+)/i); return m ? Number(m[1]) : 0; })(),
            gloves: /перчатк/.test(perkStr) ? 1 : 0,
            jacket: /куртк/.test(perkStr),
            boots: /бот[ыы]|сапог/.test(perkStr),
            net: /сетк/.test(perkStr),
            backpack: /рюкзак/.test(perkStr),
            bag: /сумк|багажн/.test(perkStr),
            charger: /зарядк/.test(perkStr),
          };

          const bikeLabel = `${bikeMake} ${bikeModel}`;
          const todos: Array<{ title: string; priority: string }> = [
            { title: `🔧 Проверить ТС при возврате: ${bikeLabel} (${rentEndDate} ${rentEndTime})`, priority: "high" },
            { title: `🔑 Принять ключи от ${bikeLabel}`, priority: "high" },
            { title: `📄 Проверить документы при возврате ${bikeLabel}`, priority: "medium" },
            { title: `🔍 Осмотр на повреждения: ${bikeLabel}`, priority: "high" },
          ];
          if (equip.helmets > 0) todos.push({ title: `🪖 Принять ${equip.helmets} шлем(а/ов) от ${bikeLabel}`, priority: "medium" });
          if (equip.gloves > 0) todos.push({ title: `🧤 Принять ${equip.gloves} перчатки от ${bikeLabel}`, priority: "low" });
          if (equip.jacket) todos.push({ title: `🧥 Принять куртку от ${bikeLabel}`, priority: "low" });
          if (equip.boots) todos.push({ title: `👢 Принять боты от ${bikeLabel}`, priority: "low" });
          if (equip.net) todos.push({ title: `🌐 Принять сетку от ${bikeLabel}`, priority: "low" });
          if (equip.backpack) todos.push({ title: `🎒 Принять рюкзак от ${bikeLabel}`, priority: "low" });
          if (equip.bag) todos.push({ title: `👜 Принять сумку от ${bikeLabel}`, priority: "low" });
          if (equip.charger) todos.push({ title: `🔌 Принять зарядное устройство от ${bikeLabel}`, priority: "medium" });

          for (let ti = 0; ti < todos.length; ti++) {
            const todo = todos[ti];
            const todoId = `todo-${(baseTs + bikeIndex * 1000).toString(36)}-${ti}-${Math.random().toString(36).slice(2, 5)}`;
            allTodoPromises.push(
              Promise.resolve(supabaseAdmin.from("crew_todos").insert({
                id: todoId,
                crew_id: crewId,
                lead_id: leadId,
                title: todo.title,
                status: "pending",
                priority: todo.priority,
                assigned_to: null,
                category: "lead_followup",
                description: JSON.stringify({
                  lead_id: leadId,
                  lead_phone: payload.phone || "",
                  lead_name: payload.recipient || "",
                  bike_id: doc.bikeId,
                  rental_id: null, // will be linked when rental row is confirmed
                  rent_end_date: rentEndDate || null,
                  order_id: payload.orderId,
                  source: "web_app_checkout",
                }),
              }).then(({ error }) => {
                if (error) logger.warn("[franchize] Failed to create crew_todo:", todo.title, error);
              }))
            );
          }
        }

        await Promise.all(allTodoPromises);
        logger.info(`[franchize] Created ${allTodoPromises.length} crew_todos for ${bikeDocs.length} bike(s) equipment return`);
        } // close else (crew found)
      } catch (todoErr) {
        logger.warn("[franchize] Failed to create crew_todos:", todoErr);
      }
    }

    // ── Create crew_todos for SALE deals (aligned with /doc command) ──
    if (flowType === "sale") {
      try {
        const { data: crewRowForSaleTodos } = await supabaseAdmin.from("crews").select("id").eq("slug", payload.slug).maybeSingle();
        if (!crewRowForSaleTodos?.id) {
          logger.warn("[franchize] Cannot create sale crew_todos: crew not found for slug:", payload.slug);
        } else {
          const crewId = crewRowForSaleTodos.id;
          const leadId = payload.phone || payload.telegramUserId;
          const baseTs = Date.now();
          const saleTodoPromises: Promise<unknown>[] = [];

          for (let bikeIndex = 0; bikeIndex < bikeDocs.length; bikeIndex++) {
            const doc = bikeDocs[bikeIndex];
            const line = payload.cartLines[bikeIndex];
            const car = byId.get(line?.itemId);
            const bikeMake = car?.make || doc.bikeName.split(" ")[0] || "Байк";
            const bikeModel = car?.model || doc.bikeName.split(" ").slice(1).join(" ") || "";
            const bikeLabel = `${bikeMake} ${bikeModel}`;
            const salePrice = String(line?.lineTotal || payload.totalAmount || "?");

            const saleTodos: Array<{ title: string; priority: string }> = [
              { title: `📦 Подготовить ТС к передаче: ${bikeLabel}`, priority: "high" },
              { title: `🔑 Передать ключи и документы: ${bikeLabel}`, priority: "high" },
              { title: `📋 Подписать Акт приёма-передачи с ${payload.recipient || "покупателем"}`, priority: "high" },
              { title: `💳 Проконтролировать оплату (${salePrice} ₽)`, priority: "medium" },
            ];

            for (let ti = 0; ti < saleTodos.length; ti++) {
              const todo = saleTodos[ti];
              const todoId = `todo-sale-${(baseTs + bikeIndex * 1000).toString(36)}-${ti}-${Math.random().toString(36).slice(2, 5)}`;
              saleTodoPromises.push(
                Promise.resolve(supabaseAdmin.from("crew_todos").insert({
                  id: todoId,
                  crew_id: crewId,
                  lead_id: leadId,
                  title: todo.title,
                  status: "pending",
                  priority: todo.priority,
                  assigned_to: null,
                  category: "lead_followup",
                  description: JSON.stringify({
                    lead_id: leadId,
                    lead_phone: payload.phone || "",
                    lead_name: payload.recipient || "",
                    bike_id: doc.bikeId,
                    order_id: payload.orderId,
                    source: "web_app_checkout_sale",
                    deal_type: "sale",
                  }),
                }).then(({ error }) => {
                  if (error) logger.warn("[franchize] Failed to create sale crew_todo:", todo.title, error);
                }))
              );
            }
          }

          await Promise.all(saleTodoPromises);
          logger.info(`[franchize] Created ${saleTodoPromises.length} sale crew_todos for ${bikeDocs.length} bike(s)`);
        }
      } catch (saleTodoErr) {
        logger.warn("[franchize] Failed to create sale crew_todos:", saleTodoErr);
      }
    }

    // ── Send DOCX to crew email (aligned with /doc flow) ────────────────
    try {
      const smtpHost = process.env.SMTP_HOST || process.env.SMTP_YANDEX_HOST;
      const smtpPort = Number(process.env.SMTP_PORT || process.env.SMTP_YANDEX_PORT || 465);
      const smtpUser = process.env.SMTP_USER || process.env.SMTP_YANDEX_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.SMTP_YANDEX_PASS;
      const emailFrom = process.env.EMAIL_FROM || smtpUser;
      const emailTo = process.env.EMAIL_DEFAULT_TO || crewSecrets.email || "vip_bike@mail.ru";
      if (smtpHost && smtpUser && smtpPass) {
        const docType = flowType === "sale" ? "купли-продажи" : "аренды";
        const emailBody = [
          `Договор ${docType} №${bikeDocs[0]?.documentKey || payload.orderId}`,
          ``,
          bikeDocs.length === 1 ? `Байк: ${bikeDocs[0].bikeName}` : `Байков: ${bikeDocs.length}`,
          `Клиент: ${payload.recipient || "—"}`,
          `Телефон: ${payload.phone || "—"}`,
          ``,
          flowType === "sale"
            ? `Цена: ${payload.totalAmount.toLocaleString("ru-RU")} ₽`
            : `Период: ${payload.rentalStartDate || "?"} → ${payload.rentalEndDate || "?"}`,
          ``,
          `Договор сгенерирован через веб-приложение.`,
          `Документ во вложении.`,
        ].join("\n");
        const transporter = nodemailer.createTransport({
          host: smtpHost, port: smtpPort, secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 8000,
        });
        // Fire-and-forget — don't block checkout on email
        transporter.sendMail({
          from: emailFrom, to: emailTo,
          subject: `Договор ${docType} — ${bikeDocs[0]?.bikeName || payload.orderId}`,
          text: emailBody,
          attachments: bikeDocs.map((doc) => ({
            filename: doc.fileName,
            content: Buffer.from(doc.bytes),
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          })),
        }).then(() => logger.info(`[franchize] Email with DOCX sent to ${emailTo}`))
          .catch((emailErr: any) => logger.warn("[franchize] Email send failed (non-fatal):", emailErr?.message || emailErr));
      }
    } catch (emailSetupErr) {
      logger.warn("[franchize] Email setup failed:", emailSetupErr);
    }

    // Save rental secrets using the first bike's document info
    // Aligned with /doc command: prefer structured web-app data, fall back to
    // rentalSecrets (verified from past rentals), then userSensitive, then legacy.
    const firstBikeDoc = bikeDocs[0];

    // Build combined passport + license strings from structured fields (like /doc)
    const passportStr = [payload.passportSeries, payload.passportNumber].filter(Boolean).join(" ").trim()
      || rentalSecrets?.renter_passport || userSensitive.passport || payload.renterPassport || "указывается при выдаче";
    const licenseStr = (payload.hasLicense !== false
      ? [payload.licenseSeries, payload.licenseNumber].filter(Boolean).join(" ").trim()
      : "") 
      || (payload.hasLicense === false ? "" : (rentalSecrets?.renter_driver_license || userSensitive.driverLicense || payload.renterDriverLicense || "указывается при выдаче"));

    try {
      await saveUserRentalSecrets({
        chat_id: payload.telegramUserId,
        crew_slug: payload.slug,
        doc_sha256: firstBikeDoc.sha256,
        renter_full_name: payload.recipient || "",
        renter_passport: passportStr,
        renter_passport_issue_date: payload.passportIssueDate || rentalSecrets?.renter_passport_issue_date || String(readPath(userSensitive, ["passportIssueDate"], "") || readPath(userSensitive, ["passport_issue_date"], "")) || "",
        renter_passport_issued_by: payload.passportIssuedBy || rentalSecrets?.renter_passport_issued_by || "",
        renter_registration: payload.registrationAddress || rentalSecrets?.renter_registration || String(readPath(userSensitive, ["registration"], "")) || "",
        renter_driver_license: licenseStr,
        renter_birth_date: payload.birthDate || docIdentity.renterBirthDate,
        renter_phone: docIdentity.renterPhone || payload.phone,
        renter_email: docIdentity.renterEmail,
        renter_address: payload.registrationAddress || rentalSecrets?.renter_address || payload.pickupAddress || String(readPath(userSensitive, ["renterAddress"], "") || readPath(userSensitive, ["registration"], "")) || "",
        license_categories: payload.licenseCategories || rentalSecrets?.license_categories || "",
        license_expiry_date: payload.licenseExpiryDate || rentalSecrets?.license_expiry_date || "",
        source_doc_key: firstBikeDoc.documentKey,
        source_rental_id: sourceRentalId,
        verification_status: "verified",
        template_version: CURRENT_RENTAL_TEMPLATE_VERSION,
      });
    } catch (error) {
      logger.error("[buildFranchizeOrderDocAndNotify] failed to save rental secrets", {
        slug: payload.slug,
        orderId: payload.orderId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    return { renderedMarkdown: `Generated ${bikeDocs.length} contract${bikeDocs.length > 1 ? "s" : ""}`, docFileName: bikeDocs.map(d => d.fileName).join(", ") };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit order notification";
    logger.error("[franchize] buildFranchizeOrderDocAndNotify failed", {
      slug: payload.slug,
      orderId: payload.orderId,
      failureSource: "buildFranchizeOrderDocAndNotify",
      errorName: error instanceof Error ? error.name : undefined,
      errorMessage: message,
    });
    await updateFranchizeOrderNotificationLog(logId, {
      send_status: "failed",
      last_error: message,
    });

    throw error;
  }
}

export async function reconcileRentalContractVerifierAttachment(input: {
  rentalId: string;
  orderId?: string;
  flowType?: "rental" | "sale" | "mixed";
  slug?: string;
}): Promise<{ success: boolean; error?: string; attached?: boolean; recordId?: string }> {
  const rentalId = input.rentalId.trim();
  if (!rentalId) return { success: false, error: "rentalId is required" };

  const { data: rental, error: rentalError } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, metadata")
    .eq("rental_id", rentalId)
    .maybeSingle();

  if (rentalError || !rental) {
    return { success: false, error: rentalError?.message || "rental not found" };
  }

  const metadata = rental.metadata && typeof rental.metadata === "object" ? (rental.metadata as Record<string, unknown>) : {};
  const verifier = metadata.contract_verifier && typeof metadata.contract_verifier === "object"
    ? (metadata.contract_verifier as Record<string, unknown>)
    : null;

  const flowType = input.flowType ?? "rental";
  const slug = (input.slug || String(metadata.slug || "")).trim();
  const orderId = (input.orderId || String(metadata.orderId || "")).trim();

  const sourceScope = typeof verifier?.sourceScope === "string" && verifier.sourceScope.trim()
    ? verifier.sourceScope.trim()
    : slug && orderId
      ? `${flowType}:${slug}:${orderId}`
      : "";
  const keyPrefix = flowType === "sale" || flowType === "mixed" ? "sale" : "rental";
  const documentKey = typeof verifier?.documentKey === "string" && verifier.documentKey.trim()
    ? verifier.documentKey.trim()
    : slug && orderId
      ? `${keyPrefix}-${slug}-${orderId}`
      : "";

  if (!sourceScope || !documentKey) {
    return { success: false, error: "Cannot derive sourceScope/documentKey for reconciliation" };
  }

  const { data: record, error: recordError } = await supabaseAdmin
    .from("doc_verifier_records")
    .select("id, integration_scope, document_key, original_sha256")
    .eq("integration_scope", sourceScope)
    .eq("document_key", documentKey)
    .maybeSingle();

  if (recordError || !record) {
    return { success: false, error: recordError?.message || "doc_verifier record not found" };
  }

  const contractVerifierPatch = {
    ...(verifier ?? {}),
    scope: `rental:${rentalId}`,
    sourceScope: sourceScope,
    documentKey: documentKey,
    docVerifierRecordId: record.id,
    originalSha256: record.original_sha256,
    status: "verified",
    verifiedAt: new Date().toISOString(),
    expiresAt: typeof verifier?.expiresAt === "string" ? verifier.expiresAt : null,
  };

  const { error: updateError } = await supabaseAdmin
    .from("rentals")
    .update({
      metadata: {
        ...metadata,
        contract_verifier: contractVerifierPatch,
      },
    })
    .eq("rental_id", rentalId);

  if (updateError) return { success: false, error: updateError.message };
  return { success: true, attached: true, recordId: record.id };
}


const franchizeOrderInvoiceSchema = z.object({
  slug: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  telegramUserId: z.string().trim().min(1),
  recipient: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  renterBirthDate: z.string().trim().optional(),
  renterPhone: z.string().trim().optional(),
  renterEmail: z.string().trim().optional(),
  renterDriverLicense: z.string().trim().optional(),
  renterPassport: z.string().trim().optional(),
  time: z.string().trim().min(1),
  comment: z.string().trim().default(""),
  rentalStartDate: z.string().trim().optional(),
  rentalEndDate: z.string().trim().optional(),
  // ── Structured personal data from web app (aligned with /doc flow) ──
  birthDate: z.string().trim().optional(),
  passportSeries: z.string().trim().optional(),
  passportNumber: z.string().trim().optional(),
  passportIssueDate: z.string().trim().optional(),
  passportIssuedBy: z.string().trim().optional(),
  registrationAddress: z.string().trim().optional(),
  hasLicense: z.boolean().optional().default(true),
  licenseSeries: z.string().trim().optional(),
  licenseNumber: z.string().trim().optional(),
  licenseCategories: z.string().trim().optional(),
  licenseExpiryDate: z.string().trim().optional(),
  signatureName: z.string().trim().optional(),
  signatureAccepted: z.boolean().optional(),
  signatureFingerprint: z.string().trim().optional(),
  payment: z.enum(["telegram_xtr", "card", "cash", "sbp"]),
  delivery: z.enum(["pickup", "delivery"]),
  subtotal: z.number().finite().nonnegative(),
  extrasTotal: z.number().finite().nonnegative().default(0),
  promoCode: z.string().trim().optional(),
  promoTitle: z.string().trim().optional(),
  promoDiscount: z.number().finite().nonnegative().default(0),
  totalAmount: z.number().finite().nonnegative().default(0),
  extras: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        label: z.string().trim().min(1),
        amount: z.number().finite().nonnegative(),
      }),
    )
    .default([]),
  cartLines: z.array(z.object({
    lineId: z.string().trim().min(1).optional(),
    itemId: z.string().trim().min(1),
    qty: z.number().int().positive(),
    pricePerDay: z.number().finite().nonnegative(),
    lineTotal: z.number().finite().nonnegative(),
    options: z
      .object({
        package: z.string().trim().default("Базовый"),
        duration: z.string().trim().default("1 день"),
        perk: z.string().trim().default("Стандарт"),
        auction: z.string().trim().default("Без аукциона"),
      })
      .default({ package: "Базовый", duration: "1 день", perk: "Стандарт", auction: "Без аукциона" }),
  })).min(1),
  depositAmount: z.number().finite().nonnegative().optional(),
  checkoutBlockers: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(180),
  })).max(20).default([]),
  safetyQuizPassed: z.boolean().optional(),
  pickupAddress: z.string().trim().optional(),
  requiredDocs: z.array(z.string().trim().min(1).max(120)).max(12).default([]),
  flowType: z.enum(["rental", "sale", "mixed"]).default("rental"),
});

export async function submitFranchizeOrderNotification(input: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = franchizeOrderInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Некорректный payload заказа." };
  }

  const payload = parsed.data;
  const totalResult = await resolveFranchizeCheckoutTotal(payload);
  if (!totalResult.success) return totalResult;
  const effectiveTotal = totalResult.totalAmount;
  const validatedPayload = { ...payload, ...totalResult, totalAmount: effectiveTotal };
  await recordFranchizeOrderIntent(validatedPayload, {
    intentType: "rent",
    stage: "checkout_started",
    urgencyScore: validatedPayload.flowType === "rental" ? 75 : 85,
  });

  try {
    await buildFranchizeOrderDocAndNotify({ ...validatedPayload, totalAmount: effectiveTotal, subtotal: payload.subtotal, extrasTotal: payload.extrasTotal });
    return { success: true };
  } catch (error) {
    logFranchizeCheckoutFailure("submitFranchizeOrderNotification", { slug: payload.slug, orderId: payload.orderId }, error);
    if (error instanceof FranchizeOrderDocValidationError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: FRANCHIZE_RENTAL_DOCS_SAFE_ERROR };
  }
}

const retryFranchizeNotificationSchema = z.object({
  slug: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  actorUserId: z.string().trim().min(1),
});

export async function retryFranchizeOrderNotification(input: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = retryFranchizeNotificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Некорректный payload для retry." };
  }

  const { slug, orderId, actorUserId } = parsed.data;
  const { data: crew } = await supabaseAdmin.from("crews").select("id, owner_id").eq("slug", slug).maybeSingle();
  if (!crew) return { success: false, error: "Экипаж не найден." };
  const canRetry = await resolveFranchizeEditorAccess(actorUserId, crew);
  if (!canRetry) return { success: false, error: "Недостаточно прав для retry уведомления." };
  const { data: logRow, error } = await supabaseAdmin
    .from("franchize_order_notifications")
    .select("payload")
    .eq("slug", slug)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { success: false, error: `Не удалось загрузить snapshot для retry: ${error.message}` };
  }

  if (!logRow?.payload || typeof logRow.payload !== "object") {
    return { success: false, error: "Snapshot заказа не найден для retry." };
  }

  return submitFranchizeOrderNotification(logRow.payload);
}

export async function getFranchizeSuccessfulRentals(input: unknown): Promise<{ success: boolean; items?: FranchizeSuccessfulRentalVM[]; error?: string }> {
  const parsed = z.object({ slug: z.string().trim().min(1), actorUserId: z.string().trim().min(1) }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug, actorUserId } = parsed.data;
  const { data: crew } = await supabaseAdmin.from("crews").select("id, owner_id").eq("slug", normalizeCrewSlug(slug)).maybeSingle();
  if (!crew) return { success: false, error: "Экипаж не найден." };
  const canRead = await resolveFranchizeEditorAccess(actorUserId, crew);
  if (!canRead) return { success: false, error: "Недостаточно прав для просмотра аренд." };

  const { data, error } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, user_id, vehicle_id, status, requested_start_date, requested_end_date, agreed_start_date, agreed_end_date, created_at, metadata, vehicle:cars!inner(id, make, model, crew_id), user:users!rentals_user_id_fkey(user_id, full_name, username, metadata)")
    .eq("vehicle.crew_id", crew.id)
    .in("status", ["confirmed", "active", "completed"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    items: ((data ?? []) as UnknownRecord[]).map((row) => {
      const vehicle = (Array.isArray(row.vehicle) ? row.vehicle[0] : row.vehicle) as UnknownRecord | undefined;
      const user = (Array.isArray(row.user) ? row.user[0] : row.user) as UnknownRecord | undefined;
      const metadata = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as UnknownRecord;
      const userMetadata = (user?.metadata && typeof user.metadata === "object" ? user.metadata : {}) as UnknownRecord;
      const franchizeFormPrefill = (userMetadata.franchizeFormPrefill && typeof userMetadata.franchizeFormPrefill === "object"
        ? userMetadata.franchizeFormPrefill
        : {}) as UnknownRecord;
      const slugPrefill = (franchizeFormPrefill[normalizeCrewSlug(slug)] && typeof franchizeFormPrefill[normalizeCrewSlug(slug)] === "object"
        ? franchizeFormPrefill[normalizeCrewSlug(slug)]
        : {}) as UnknownRecord;
      const verifier = (metadata.contract_verifier && typeof metadata.contract_verifier === "object" ? metadata.contract_verifier : {}) as UnknownRecord;
      const contractStatus = typeof verifier.status === "string" && verifier.status.trim() ? verifier.status.trim() : "none";
      const bikeName = `${typeof vehicle?.make === "string" ? vehicle.make : ""} ${typeof vehicle?.model === "string" ? vehicle.model : ""}`.trim();
      const fallbackUserId = String(row.user_id ?? "").trim();
      const renterNameCandidates = [
        metadata.renter_full_name,
        metadata.recipientName,
        metadata.recipient,
        metadata.customerName,
        user?.full_name,
        userMetadata.display_name,
        slugPrefill.fullName,
        user?.username,
      ];
      const renterName =
        renterNameCandidates.find((value) => typeof value === "string" && value.trim()) as string | undefined;
      const displayRenterName = renterName?.trim() || (fallbackUserId ? `Пользователь #${fallbackUserId}` : "");
      const startDate = typeof row.agreed_start_date === "string" ? row.agreed_start_date
        : typeof row.requested_start_date === "string" ? row.requested_start_date
          : typeof metadata.rentalStartDate === "string" ? metadata.rentalStartDate
            : null;
      const endDate = typeof row.agreed_end_date === "string" ? row.agreed_end_date
        : typeof row.requested_end_date === "string" ? row.requested_end_date
          : typeof metadata.rentalEndDate === "string" ? metadata.rentalEndDate
            : null;

      return {
        rentalId: String(row.rental_id ?? ""),
        status: String(row.status ?? ""),
        bikeId: String(row.vehicle_id ?? ""),
        bikeName: bikeName || String(row.vehicle_id ?? "Техника"),
        renterName: displayRenterName || "Арендатор не указан",
        startDate,
        endDate,
        createdAt: String(row.created_at ?? ""),
        contractStatus,
      };
    }),
  };
}

export async function getFranchizeOrderNotificationFailures(input: unknown): Promise<{ success: boolean; items?: Array<{ orderId: string; sendTo: string; lastError: string; createdAt: string }>; error?: string }> {
  const parsed = z.object({ slug: z.string().trim().min(1), actorUserId: z.string().trim().min(1) }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug, actorUserId } = parsed.data;
  const { data: crew } = await supabaseAdmin.from("crews").select("id, owner_id").eq("slug", slug).maybeSingle();
  if (!crew) return { success: false, error: "Экипаж не найден." };
  const canRead = await resolveFranchizeEditorAccess(actorUserId, crew);
  if (!canRead) return { success: false, error: "Недостаточно прав для просмотра логов." };

  const { data, error } = await supabaseAdmin
    .from("franchize_order_notifications")
    .select("order_id, send_to, last_error, created_at")
    .eq("slug", slug)
    .eq("send_status", "failed")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { success: false, error: error.message };
  return {
    success: true,
    items: (data ?? []).map((row) => ({ orderId: row.order_id, sendTo: row.send_to ?? "", lastError: row.last_error ?? "", createdAt: row.created_at ?? "" })),
  };
}

const rentalReviewInputSchema = z.object({
  slug: z.string().trim().min(1),
  rentalId: z.string().uuid(),
  initData: z.string().trim().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().max(1200).default(""),
});

async function resolveVerifiedTelegramUserId(initDataString: string): Promise<{ success: boolean; userId?: string; error?: string }> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return { success: false, error: "Telegram bot token is not configured." };

  const params = new URLSearchParams(initDataString);
  const hashFromClient = params.get("hash");
  if (!hashFromClient) return { success: false, error: "Telegram init data hash is missing." };

  const validation = await computeTelegramWebAppHash(initDataString, botToken);
  const bypassValidation = process.env.TEMP_BYPASS_TG_AUTH_VALIDATION === "true" && isTrustedTelegramBypassDeployment();

  if (!validation.isValid && !bypassValidation) {
    return { success: false, error: "Telegram init data hash mismatch." };
  }

  const userParam = params.get("user");
  if (!userParam) return { success: false, error: "Telegram init data user is missing." };

  const authDate = Number(params.get("auth_date") ?? 0);
  const maxInitDataAgeSeconds = 24 * 60 * 60;
  if (!bypassValidation && (!Number.isFinite(authDate) || authDate <= 0 || Date.now() / 1000 - authDate > maxInitDataAgeSeconds)) {
    return { success: false, error: "Telegram init data is expired." };
  }

  try {
    const user = JSON.parse(userParam) as { id?: unknown };
    const userId = typeof user.id === "number" || typeof user.id === "string" ? String(user.id) : "";
    if (!userId) return { success: false, error: "Telegram init data user id is missing." };
    return { success: true, userId };
  } catch {
    return { success: false, error: "Telegram init data user payload is invalid." };
  }
}

export async function getRentalReviewContext(input: unknown): Promise<{ success: boolean; error?: string; rental?: { rentalId: string; status: string; userId: string; bikeId: string; bikeTitle: string; crewId: string; existingReview?: RentalReviewVM } }> {
  const parsed = z.object({ slug: z.string().trim().min(1), rentalId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректная ссылка отзыва." };
  const { slug, rentalId } = parsed.data;

  const { data: crew } = await supabaseAdmin.from("crews").select("id").eq("slug", normalizeCrewSlug(slug)).maybeSingle();
  if (!crew) return { success: false, error: "Экипаж не найден." };

  const { data: rental, error } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, user_id, vehicle_id, status, vehicle:cars(id, make, model, crew_id)")
    .eq("rental_id", rentalId)
    .maybeSingle();
  if (error) return { success: false, error: error.message };
  if (!rental) return { success: false, error: "Аренда не найдена." };

  const vehicle = Array.isArray(rental.vehicle) ? rental.vehicle[0] : rental.vehicle;
  if (vehicle?.crew_id !== crew.id) return { success: false, error: "Аренда относится к другому экипажу." };

  const { data: existing } = await supabaseAdmin
    .from("rental_reviews")
    .select("id, rental_id, user_id, bike_id, crew_id, rating, text, created_at, hidden_at")
    .eq("rental_id", rentalId)
    .maybeSingle();

  return {
    success: true,
    rental: {
      rentalId: String(rental.rental_id),
      status: String(rental.status ?? ""),
      userId: String(rental.user_id ?? ""),
      bikeId: String(rental.vehicle_id ?? ""),
      bikeTitle: `${vehicle?.make ?? ""} ${vehicle?.model ?? ""}`.trim() || "байк",
      crewId: String(crew.id),
      existingReview: existing && !(existing as UnknownRecord).hidden_at ? toRentalReviewVM(existing as UnknownRecord) : undefined,
    },
  };
}

export async function submitRentalReview(input: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = rentalReviewInputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Некорректный отзыв." };
  const { slug, rentalId, initData, rating, text } = parsed.data;

  const verifiedTelegramUser = await resolveVerifiedTelegramUserId(initData);
  if (!verifiedTelegramUser.success || !verifiedTelegramUser.userId) {
    return { success: false, error: verifiedTelegramUser.error ?? "Не удалось подтвердить Telegram-пользователя." };
  }

  const context = await getRentalReviewContext({ slug, rentalId });
  if (!context.success || !context.rental) return { success: false, error: context.error ?? "Аренда не найдена." };
  if (context.rental.status !== "completed") return { success: false, error: "Отзыв можно оставить после завершения аренды." };
  if (context.rental.userId !== verifiedTelegramUser.userId) return { success: false, error: "Отзыв может оставить только арендатор." };

  const { data: existingReview, error: existingReviewError } = await supabaseAdmin
    .from("rental_reviews")
    .select("hidden_at")
    .eq("rental_id", rentalId)
    .maybeSingle();
  if (existingReviewError) return { success: false, error: existingReviewError.message };
  if (existingReview?.hidden_at) {
    return { success: false, error: "Отзыв скрыт модератором. Обновление возможно только после восстановления владельцем экипажа." };
  }

  const { error } = await supabaseAdmin.from("rental_reviews").upsert(
    {
      rental_id: rentalId,
      user_id: verifiedTelegramUser.userId,
      bike_id: context.rental.bikeId,
      crew_id: context.rental.crewId,
      rating,
      text,
    },
    { onConflict: "rental_id" },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getFranchizeRentalReviewsForModeration(input: unknown): Promise<{ success: boolean; error?: string; items?: RentalReviewVM[] }> {
  const parsed = z.object({ slug: z.string().trim().min(1), actorUserId: z.string().trim().min(1) }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug, actorUserId } = parsed.data;
  const { data: crew } = await supabaseAdmin.from("crews").select("id, owner_id").eq("slug", normalizeCrewSlug(slug)).maybeSingle();
  if (!crew) return { success: false, error: "Экипаж не найден." };
  const canRead = await resolveFranchizeEditorAccess(actorUserId, crew);
  if (!canRead) return { success: false, error: "Недостаточно прав для модерации отзывов." };

  const { data, error } = await supabaseAdmin
    .from("rental_reviews")
    .select("id, rental_id, user_id, bike_id, crew_id, rating, text, created_at, hidden_at")
    .eq("crew_id", crew.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return { success: false, error: error.message };
  return { success: true, items: ((data ?? []) as UnknownRecord[]).map(toRentalReviewVM) };
}

export async function moderateRentalReview(input: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = z.object({ slug: z.string().trim().min(1), actorUserId: z.string().trim().min(1), reviewId: z.string().uuid(), hidden: z.boolean() }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос модерации." };
  const { slug, actorUserId, reviewId, hidden } = parsed.data;
  const { data: crew } = await supabaseAdmin.from("crews").select("id, owner_id").eq("slug", normalizeCrewSlug(slug)).maybeSingle();
  if (!crew) return { success: false, error: "Экипаж не найден." };
  const canModerate = await resolveFranchizeEditorAccess(actorUserId, crew);
  if (!canModerate) return { success: false, error: "Недостаточно прав для модерации отзывов." };

  const { error } = await supabaseAdmin
    .from("rental_reviews")
    .update({ hidden_at: hidden ? new Date().toISOString() : null, moderated_by: actorUserId })
    .eq("id", reviewId)
    .eq("crew_id", crew.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

type FranchizeOrderInvoicePayload = z.infer<typeof franchizeOrderInvoiceSchema>;

function summarizeFranchizeIntentCartLines(payload: FranchizeOrderInvoicePayload) {
  return payload.cartLines.map((line) => ({
    itemId: line.itemId,
    qty: line.qty,
    lineTotal: line.lineTotal,
    options: line.options,
  }));
}

async function recordFranchizeOrderIntent(
  payload: FranchizeOrderInvoicePayload,
  input: {
    intentType: "checkout_start" | "payment_failure" | "hold_created" | "payment_success" | "rent";
    stage: "checkout_started" | "payment_failed" | "hold_created" | "payment_confirmed";
    urgencyScore: number;
    sourceRoute?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const firstLine = payload.cartLines[0];
  const result = await upsertFranchizeIntent({
    slug: payload.slug,
    bikeId: firstLine?.itemId,
    intentType: input.intentType,
    stage: input.stage,
    sourceRoute: input.sourceRoute ?? `/franchize/${payload.slug}/order/${payload.orderId}`,
    contactChannel: payload.payment,
    urgencyScore: input.urgencyScore,
    telegramUserId: payload.telegramUserId,
    phone: payload.phone,
    metadata: {
      dedupeKey: `order:${payload.slug}:${payload.orderId}:${input.stage}`,
      orderId: payload.orderId,
      flowType: payload.flowType ?? "rental",
      totalAmount: payload.totalAmount,
      subtotal: payload.subtotal,
      price: payload.totalAmount,
      depositAmount: payload.depositAmount,
      selectedDate: payload.rentalStartDate,
      selectedEndDate: payload.rentalEndDate,
      selectedTime: payload.time,
      bikeIds: payload.cartLines.map((line) => line.itemId),
      cartLines: summarizeFranchizeIntentCartLines(payload),
      blockers: payload.checkoutBlockers,
      safetyQuizPassed: payload.safetyQuizPassed,
      pickupAddress: payload.pickupAddress,
      requiredDocs: payload.requiredDocs,
      ...input.metadata,
    },
  });

  if (!result.success) {
    logger.warn("[franchize] intent tracking skipped", {
      slug: payload.slug,
      orderId: payload.orderId,
      intentType: input.intentType,
      error: result.error,
    });
  }

  return result;
}


const franchizeCheckoutRecoverySnapshotSchema = z.object({
  slug: z.string().trim().min(1).max(80).transform((value) => normalizeCrewSlug(value)),
  orderId: z.string().trim().min(1).max(120),
  stage: z.enum(["checkout_started", "payment_failed"]).default("checkout_started"),
  route: z.string().trim().min(1).max(240),
  bikeIds: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  dates: z.object({
    start: z.string().trim().optional(),
    end: z.string().trim().optional(),
    preferredTime: z.string().trim().optional(),
  }),
  contact: z.object({
    phone: z.string().trim().max(40).optional(),
    telegramUserId: z.string().trim().max(80).optional(),
    telegramPresent: z.boolean().default(false),
    recipient: z.string().trim().max(120).optional(),
  }),
  readinessPercent: z.number().int().min(0).max(100),
  blockers: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(180),
  })).max(20),
  totalAmount: z.number().finite().nonnegative(),
  depositAmount: z.number().finite().nonnegative(),
  payment: z.enum(["telegram_xtr", "card", "cash", "sbp"]).optional(),
  flowType: z.enum(["rental", "sale", "mixed"]).default("rental"),
});

type FranchizeCheckoutRecoverySnapshot = z.infer<typeof franchizeCheckoutRecoverySnapshotSchema>;

const franchizeCheckoutRecoveryRateLimits = new Map<string, number>();
const FRANCHIZE_RECOVERY_NOTIFY_COOLDOWN_MS = 10 * 60_000;
const FRANCHIZE_RECOVERY_WRITE_COOLDOWN_MS = 12_000;
const FRANCHIZE_RECOVERY_READY_THRESHOLD = 67;

function normalizeOptionalString(value?: string | null) {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : undefined;
}

function buildCheckoutRecoveryFingerprint(snapshot: FranchizeCheckoutRecoverySnapshot) {
  const blocker = snapshot.blockers[0]?.id ?? "ready";
  return [
    snapshot.slug,
    snapshot.orderId,
    snapshot.stage,
    snapshot.bikeIds.slice().sort().join(","),
    snapshot.dates.start ?? "no-date",
    snapshot.dates.end ?? "no-end",
    snapshot.contact.phone ? "phone" : "no-phone",
    snapshot.contact.telegramPresent ? "tg" : "no-tg",
    Math.floor(snapshot.readinessPercent / 10) * 10,
    blocker,
    Math.round(snapshot.totalAmount),
  ].join("|");
}

function getCheckoutRecoveryWriteKey(snapshot: FranchizeCheckoutRecoverySnapshot) {
  return [
    snapshot.slug,
    snapshot.orderId,
    snapshot.stage,
  ].join(":");
}

function shouldNotifyCheckoutRecovery(snapshot: FranchizeCheckoutRecoverySnapshot) {
  const hasPhone = Boolean(normalizeOptionalString(snapshot.contact.phone));
  const hasDate = Boolean(normalizeOptionalString(snapshot.dates.start));
  const highReadiness = snapshot.readinessPercent >= FRANCHIZE_RECOVERY_READY_THRESHOLD;
  const invoiceFailed = snapshot.stage === "payment_failed";
  return invoiceFailed || hasPhone || hasDate || highReadiness;
}

function buildCheckoutRecoverySuggestion(snapshot: FranchizeCheckoutRecoverySnapshot) {
  const lastBlocker = snapshot.blockers[0]?.label;
  if (snapshot.stage === "payment_failed") {
    return "Написать: «Вижу, XTR-счёт не прошёл. Забронирую байк вручную или переключим на карту/наличные?»";
  }
  if (lastBlocker?.toLowerCase().includes("telegram")) {
    return "Написать: «Открой оформление из Telegram — помогу добить Stars-счёт и закреплю байк.»";
  }
  if (lastBlocker) {
    return `Написать: «Вижу, остановились на шаге: ${lastBlocker}. Помочь закрыть бронь?»`;
  }
  return "Написать: «Вижу почти готовую бронь. Закрепить этот байк за вами?»";
}

async function buildCheckoutRecoveryBikeLabel(slug: string, bikeIds: string[]) {
  const uniqueIds = Array.from(new Set(bikeIds));
  if (!uniqueIds.length) return "—";

  const { data, error } = await supabaseAdmin
    .from("cars")
    .select("id, make, model")
    .in("id", uniqueIds);

  if (error) {
    logger.warn("[franchize] checkout recovery bike lookup failed", { slug, error });
    return uniqueIds.join(", ");
  }

  const byId = new Map((data ?? []).map((row: any) => [String(row.id), `${row.make || "Bike"} ${row.model || row.id}`.trim()]));
  return uniqueIds.map((id) => byId.get(id) ?? id).join(", ");
}

function buildCheckoutRecoveryAdminText(snapshot: FranchizeCheckoutRecoverySnapshot, bikeLabel: string) {
  const lastBlocker = snapshot.blockers[0]?.label ?? "готов к ручному закрытию";
  const phone = normalizeOptionalString(snapshot.contact.phone);
  const telegram = snapshot.contact.telegramUserId ? `tg:${snapshot.contact.telegramUserId}` : snapshot.contact.telegramPresent ? "Telegram WebApp открыт" : "Telegram не виден";
  const dateLabel = [snapshot.dates.start, snapshot.dates.end && snapshot.dates.end !== snapshot.dates.start ? snapshot.dates.end : null]
    .filter(Boolean)
    .join(" → ") || "дата не выбрана";

  return [
    snapshot.stage === "payment_failed" ? "⚠️ Franchize payment recovery" : "🧲 Franchize checkout recovery",
    `Crew: ${snapshot.slug}`,
    `Bike: ${bikeLabel}`,
    `Date: ${dateLabel}${snapshot.dates.preferredTime ? `, ${snapshot.dates.preferredTime}` : ""}`,
    `Contact: ${[snapshot.contact.recipient, phone, telegram].filter(Boolean).join(" / ")}`,
    `Ready: ${snapshot.readinessPercent}% · ${snapshot.flowType} · ${formatMoney(snapshot.totalAmount)} ₽ · deposit ${formatMoney(snapshot.depositAmount)} ₽`,
    `Last blocker: ${lastBlocker}`,
    `Route: ${snapshot.route}`,
    buildCheckoutRecoverySuggestion(snapshot),
  ].join("\n");
}

async function readCheckoutRecoveryIntentMetadata(intentId: string) {
  const { data, error } = await supabaseAdmin
    .from("franchize_intents")
    .select("metadata")
    .eq("id", intentId)
    .maybeSingle();

  if (error) {
    logger.warn("[franchize] checkout recovery notification metadata read failed", { intentId, error });
    return {} as Record<string, unknown>;
  }

  return ((data?.metadata ?? {}) as Record<string, unknown>);
}

function wasCheckoutRecoveryRecentlyNotified(metadata: Record<string, unknown>, nowMs: number) {
  const recoveryNotification = metadata.recoveryNotification as Record<string, unknown> | undefined;
  if (typeof recoveryNotification?.notifiedAt !== "string") {
    return false;
  }

  const notifiedAtMs = Date.parse(recoveryNotification.notifiedAt);
  return Number.isFinite(notifiedAtMs) && nowMs - notifiedAtMs < FRANCHIZE_RECOVERY_NOTIFY_COOLDOWN_MS;
}

async function markCheckoutRecoveryNotification(
  intentId: string,
  metadata: Record<string, unknown>,
  fingerprint: string,
  notifiedAt: string,
) {
  const { error: updateError } = await supabaseAdmin
    .from("franchize_intents")
    .update({
      metadata: {
        ...metadata,
        recoveryNotification: {
          fingerprint,
          notifiedAt,
          channel: "admin_telegram",
        },
      },
    })
    .eq("id", intentId);

  if (updateError) {
    logger.warn("[franchize] checkout recovery notification metadata update failed", { intentId, error: updateError });
  }
}

export async function recordFranchizeCheckoutRecoverySnapshot(
  input: unknown,
): Promise<{ success: boolean; intentId?: string; notified?: boolean; throttled?: boolean; error?: string }> {
  const parsed = franchizeCheckoutRecoverySnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный checkout recovery snapshot.",
    };
  }

  const snapshot = parsed.data;
  const normalizedSnapshot = {
    ...snapshot,
    contact: {
      ...snapshot.contact,
      phone: normalizeOptionalString(snapshot.contact.phone),
      recipient: normalizeOptionalString(snapshot.contact.recipient),
      telegramUserId: normalizeOptionalString(snapshot.contact.telegramUserId),
    },
    dates: {
      start: normalizeOptionalString(snapshot.dates.start),
      end: normalizeOptionalString(snapshot.dates.end),
      preferredTime: normalizeOptionalString(snapshot.dates.preferredTime),
    },
  } satisfies FranchizeCheckoutRecoverySnapshot;

  const fingerprint = buildCheckoutRecoveryFingerprint(normalizedSnapshot);
  const writeKey = getCheckoutRecoveryWriteKey(normalizedSnapshot);
  const nowMs = Date.now();
  const lastWriteAt = franchizeCheckoutRecoveryRateLimits.get(writeKey) ?? 0;
  if (nowMs - lastWriteAt < FRANCHIZE_RECOVERY_WRITE_COOLDOWN_MS) {
    return { success: true, throttled: true };
  }
  franchizeCheckoutRecoveryRateLimits.set(writeKey, nowMs);

  const lastBlocker = normalizedSnapshot.blockers[0] ?? null;
  const result = await upsertFranchizeIntent({
    slug: normalizedSnapshot.slug,
    bikeId: normalizedSnapshot.bikeIds[0],
    intentType: "rent",
    stage: normalizedSnapshot.stage,
    sourceRoute: normalizedSnapshot.route,
    contactChannel: normalizedSnapshot.contact.telegramPresent ? "telegram" : normalizedSnapshot.contact.phone ? "phone" : normalizedSnapshot.payment,
    urgencyScore: normalizedSnapshot.stage === "payment_failed" ? 95 : Math.min(90, Math.max(35, normalizedSnapshot.readinessPercent)),
    telegramUserId: normalizedSnapshot.contact.telegramUserId,
    phone: normalizedSnapshot.contact.phone,
    metadata: {
      dedupeKey: `checkout-recovery:${normalizedSnapshot.slug}:${normalizedSnapshot.orderId}:${normalizedSnapshot.stage}`,
      orderId: normalizedSnapshot.orderId,
      recoveryFingerprint: fingerprint,
      bikeIds: normalizedSnapshot.bikeIds,
      dates: normalizedSnapshot.dates,
      readinessPercent: normalizedSnapshot.readinessPercent,
      blockers: normalizedSnapshot.blockers,
      lastBlocker,
      totalAmount: normalizedSnapshot.totalAmount,
      depositAmount: normalizedSnapshot.depositAmount,
      route: normalizedSnapshot.route,
      payment: normalizedSnapshot.payment,
      flowType: normalizedSnapshot.flowType,
      contact: {
        hasPhone: Boolean(normalizedSnapshot.contact.phone),
        telegramPresent: normalizedSnapshot.contact.telegramPresent,
        recipient: normalizedSnapshot.contact.recipient,
      },
    },
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (!result.intentId || !shouldNotifyCheckoutRecovery(normalizedSnapshot)) {
    return { success: true, intentId: result.intentId, notified: false };
  }

  const notifyKey = writeKey;
  const lastNotifyAt = franchizeCheckoutRecoveryRateLimits.get(notifyKey) ?? 0;
  if (nowMs - lastNotifyAt < FRANCHIZE_RECOVERY_NOTIFY_COOLDOWN_MS) {
    return { success: true, intentId: result.intentId, notified: false, throttled: true };
  }

  const intentMetadata = await readCheckoutRecoveryIntentMetadata(result.intentId);
  if (wasCheckoutRecoveryRecentlyNotified(intentMetadata, nowMs)) {
    franchizeCheckoutRecoveryRateLimits.set(notifyKey, nowMs);
    return { success: true, intentId: result.intentId, notified: false, throttled: true };
  }

  try {
    const bikeLabel = await buildCheckoutRecoveryBikeLabel(normalizedSnapshot.slug, normalizedSnapshot.bikeIds);
    const text = buildCheckoutRecoveryAdminText(normalizedSnapshot, bikeLabel);
    await notifyAdmin(text);
    franchizeCheckoutRecoveryRateLimits.set(notifyKey, nowMs);
    await markCheckoutRecoveryNotification(result.intentId, intentMetadata, fingerprint, new Date(nowMs).toISOString());
    return { success: true, intentId: result.intentId, notified: true };
  } catch (error) {
    logger.warn("[franchize] checkout recovery admin notification failed", {
      slug: normalizedSnapshot.slug,
      orderId: normalizedSnapshot.orderId,
      error,
    });
    return { success: true, intentId: result.intentId, notified: false, error: error instanceof Error ? error.message : "Не удалось отправить recovery notification." };
  }
}

const franchizeCheckoutRateLimits = new Map<string, number>();
const FRANCHIZE_CHECKOUT_COOLDOWN_MS = 8_000;

function buildFranchizeInvoiceId(payload: FranchizeOrderInvoicePayload) {
  const safeSlug = payload.slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const safeOrderId = payload.orderId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const safeUserId = payload.telegramUserId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `franchize_order_${safeSlug}_${safeOrderId}_${safeUserId}`;
}

async function cleanupPendingFranchizeInvoiceAfterSendFailure(invoiceId: string, rentalId: string) {
  const { error } = await supabaseAdmin
    .from("invoices")
    .delete()
    .eq("id", invoiceId)
    .eq("status", "pending")
    .contains("metadata", { rental_id: rentalId });

  if (error) {
    logger.error("[franchize] failed to cleanup unsent invoice", {
      invoiceId,
      rentalId,
      error: error.message,
    });
    return false;
  }

  logger.warn("[franchize] cleaned up unsent pending invoice after Telegram XTR send failure", {
    invoiceId,
    rentalId,
  });
  return true;
}

async function resolveFranchizeReservationHold(slug: string): Promise<FranchizeReservationHoldVM> {
  const { data: crew, error } = await supabaseAdmin
    .from("crews")
    .select("metadata")
    .eq("slug", normalizeCrewSlug(slug))
    .maybeSingle();

  if (error) {
    logger.warn("[franchize] reservation hold config lookup failed", { slug, error: error.message });
  }

  const metadata = ((crew?.metadata ?? {}) as UnknownRecord);
  const franchize = (metadata.franchize ?? metadata) as UnknownRecord;
  return buildFranchizeReservationHold(franchize, readPath(franchize, ["contacts", "address"], ""));
}

async function createFranchizeOrderInvoiceInternal(
  payload: FranchizeOrderInvoicePayload,
  options: { skipNotification?: boolean } = {},
): Promise<{ success: boolean; invoiceId?: string; amountXtr?: number; error?: string }> {
  if (payload.payment !== "telegram_xtr") {
    return {
      success: false,
      error: "Для этой операции поддерживается только Telegram Stars (XTR).",
    };
  }

  const effectiveTotal = payload.totalAmount > 0 ? payload.totalAmount : payload.subtotal + payload.extrasTotal;
  const flowType = payload.flowType ?? "rental";
  const holdConfig = await resolveFranchizeReservationHold(payload.slug);
  let amountXtr: number;
  let invoiceTitle = "Franchize: подтверждение намерения";
  let invoiceDescriptionPrefix = "Подтверждение аренды";
  let invoiceProofLabel = "Proof-of-interest tip";

  if (flowType === "sale") {
    amountXtr = Math.min(500, Math.max(100, Math.ceil(effectiveTotal * 0.001)));
    invoiceTitle = "Franchize: Бронь тест-драйва";
    invoiceDescriptionPrefix = "Резерв на тест-драйв и получение спеццены на";
    invoiceProofLabel = "Бронь тест-драйва";
  } else {
    amountXtr = holdConfig.percent
      ? Math.max(1, Math.ceil(effectiveTotal * (holdConfig.percent / 100)))
      : holdConfig.amountXtr;
    invoiceTitle = "Franchize: Бронь";
    invoiceDescriptionPrefix = "Бронь аренды";
    invoiceProofLabel = holdConfig.invoiceLabel;
  }

  const invoiceDepositAmount = amountXtr;
  const invoiceDepositAmountRub = holdConfig.percent || flowType === "sale" ? amountXtr : holdConfig.amountRub;
  const serverTrustedPayload = {
    ...payload,
    totalAmount: effectiveTotal,
    depositAmount: invoiceDepositAmount,
  };

  const invoiceId = buildFranchizeInvoiceId(payload);

  const { data: existingInvoice } = await supabaseAdmin
    .from("invoices")
    .select("id, amount, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (existingInvoice?.id) {
    return { success: true, invoiceId, amountXtr: Number(existingInvoice.amount) || amountXtr };
  }

  const rentalId = randomUUID();
  const startParamPrefix = flowType === "rental" ? "rental" : "sale";
  const startParam = `${startParamPrefix}-${rentalId}`;

  // Get crew bot username from metadata (or fallback to env var)
  const crewBotUsername = process.env.TELEGRAM_BOT_USERNAME || "";
  const botUsername = crewBotUsername || "oneBikePlsBot"; // Fallback for compatibility
  const telegramWebappLink = `https://t.me/${botUsername}/app?startapp=${startParam}`;
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
  const franchizeRentalLink = `${siteBaseUrl}/franchize/${payload.slug}/rental/${rentalId}`;

  const cartText = payload.cartLines
    .map((line) => `• ${line.itemId} × ${line.qty} (${line.options.package}, ${line.options.duration}, ${line.options.perk}, ${line.options.auction})`)
    .join("\n");

  const description = [
    `${invoiceDescriptionPrefix}: ${payload.slug}`,
    `Заказ: #${payload.orderId}`,
    `Получатель: ${payload.recipient}`,
    `Телефон: ${payload.phone}`,
    `Время: ${payload.time}`,
    `Получение: ${payload.delivery === "pickup" ? "Самовывоз" : "Доставка"}`,
    `Состав:`,
    cartText,
    `Subtotal: ${payload.subtotal.toLocaleString("ru-RU")} ₽`,
    `Extras: ${payload.extrasTotal.toLocaleString("ru-RU")} ₽`,
    payload.promoCode ? `Promo: ${payload.promoCode} (-${payload.promoDiscount.toLocaleString("ru-RU")} ₽)` : "",
    `Total: ${effectiveTotal.toLocaleString("ru-RU")} ₽`,
    `${invoiceProofLabel}: ${amountXtr} XTR${holdConfig.percent ? ` (${holdConfig.percent}%)` : ""}`,
    `WebApp: ${telegramWebappLink}`,
    `Franchize card: ${franchizeRentalLink}`,
  ]
    .filter(Boolean)
    .join("\n");

  const metadata = {
    slug: payload.slug,
    orderId: payload.orderId,
    recipient: payload.recipient,
    phone: payload.phone,
    time: payload.time,
    rentalStartDate: payload.rentalStartDate,
    rentalEndDate: payload.rentalEndDate,
    comment: payload.comment,
    payment: payload.payment,
    delivery: payload.delivery,
    subtotal: payload.subtotal,
    extrasTotal: payload.extrasTotal,
    promoCode: payload.promoCode,
    promoTitle: payload.promoTitle,
    promoDiscount: payload.promoDiscount,
    totalAmount: effectiveTotal,
    tipPercent: holdConfig.percent ?? (flowType === "sale" ? 0.1 : null),
    reservationHold: holdConfig,
    depositAmount: invoiceDepositAmount,
    depositAmountRub: invoiceDepositAmountRub,
    depositAmountXtr: amountXtr,
    amountXtr,
    rental_id: rentalId,
    startParam,
    telegramWebappLink,
    franchizeRentalLink,
    extras: payload.extras,
    cartLines: payload.cartLines,
    flowType,
  };

  let createdPendingInvoiceForThisAttempt = false;

  try {
    if (!options.skipNotification) {
      await buildFranchizeOrderDocAndNotify({ ...payload, totalAmount: effectiveTotal, subtotal: payload.subtotal, extrasTotal: payload.extrasTotal });
    }

    const invoiceRecord = await createInvoice("franchize_order", invoiceId, payload.telegramUserId, amountXtr, 0, metadata);
    if (!invoiceRecord.success) {
      return { success: false, error: invoiceRecord.error ?? "Не удалось создать запись счёта." };
    }
    createdPendingInvoiceForThisAttempt = invoiceRecord.data?.status === "pending";

    const invoiceSent = await sendTelegramInvoice(
      payload.telegramUserId,
      invoiceTitle,
      description,
      invoiceId,
      amountXtr,
      0,
    );

    if (!invoiceSent.success) {
      if (createdPendingInvoiceForThisAttempt) {
        await cleanupPendingFranchizeInvoiceAfterSendFailure(invoiceId, rentalId);
      }
      await recordFranchizeOrderIntent(serverTrustedPayload, {
        intentType: "rent",
        stage: "payment_failed",
        urgencyScore: 90,
        metadata: {
          invoiceId,
          rentalId,
          failureSource: "sendTelegramInvoice",
          telegramError: invoiceSent.error ?? "telegram_invoice_send_failed",
          reason: invoiceSent.error ?? "telegram_invoice_send_failed",
        },
      });
      return { success: false, error: invoiceSent.error ?? "Не удалось отправить XTR-счёт в Telegram." };
    }

    await recordFranchizeOrderIntent(serverTrustedPayload, {
      intentType: "rent",
      stage: "hold_created",
      urgencyScore: flowType === "sale" ? 95 : 85,
      metadata: { invoiceId, rentalId, amountXtr, telegramWebappLink, franchizeRentalLink },
    });

    return { success: true, invoiceId, amountXtr };
  } catch (error) {
    if (createdPendingInvoiceForThisAttempt) {
      await cleanupPendingFranchizeInvoiceAfterSendFailure(invoiceId, rentalId);
    }
    await recordFranchizeOrderIntent(serverTrustedPayload, {
      intentType: "rent",
      stage: "payment_failed",
      urgencyScore: 90,
      metadata: {
        invoiceId,
        rentalId,
        failureSource: "createFranchizeOrderInvoice",
        errorName: error instanceof Error ? error.name : undefined,
        errorMessage: error instanceof Error ? error.message : String(error),
        reason: error instanceof Error ? error.message : String(error),
      },
    });
    logger.error("[franchize] createFranchizeOrderInvoice failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected invoice error",
    };
  }
}

export async function createFranchizeOrderInvoice(input: unknown): Promise<{ success: boolean; invoiceId?: string; amountXtr?: number; error?: string }> {
  const parsed = franchizeOrderInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный payload для XTR-счёта.",
    };
  }

  const totalResult = await resolveFranchizeCheckoutTotal(parsed.data);
  if (!totalResult.success) return totalResult;
  return createFranchizeOrderInvoiceInternal({ ...parsed.data, ...totalResult, totalAmount: totalResult.totalAmount });
}

export async function createFranchizeOrderCheckout(
  input: unknown,
): Promise<{ success: boolean; invoiceId?: string; amountXtr?: number; error?: string }> {
  const parsed = franchizeOrderInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Некорректный payload заказа." };
  }

  const payload = parsed.data;
  const now = Date.now();
  const throttleKey = `${payload.slug}:${payload.orderId}:${payload.telegramUserId}`;
  const lastRequestAt = franchizeCheckoutRateLimits.get(throttleKey) ?? 0;
  if (now - lastRequestAt < FRANCHIZE_CHECKOUT_COOLDOWN_MS) {
    return { success: false, error: "Слишком частые запросы. Повторите через несколько секунд." };
  }
  const totalResult = await resolveFranchizeCheckoutTotal(payload);
  if (!totalResult.success) return totalResult;
  franchizeCheckoutRateLimits.set(throttleKey, now);
  const effectiveTotal = totalResult.totalAmount;
  const validatedPayload = { ...payload, ...totalResult, totalAmount: effectiveTotal };
  await recordFranchizeOrderIntent(validatedPayload, {
    intentType: "rent",
    stage: "checkout_started",
    urgencyScore: validatedPayload.flowType === "rental" ? 75 : 85,
  });

  try {
    await buildFranchizeOrderDocAndNotify({
      ...validatedPayload,
      subtotal: payload.subtotal,
      extrasTotal: payload.extrasTotal,
      totalAmount: effectiveTotal,
    });

    if (payload.payment === "telegram_xtr") {
      return createFranchizeOrderInvoiceInternal(validatedPayload, { skipNotification: true });
    }

    return { success: true };
  } catch (error) {
    logFranchizeCheckoutFailure("createFranchizeOrderCheckout", { slug: payload.slug, orderId: payload.orderId }, error);
    return {
      success: false,
      error: FRANCHIZE_RENTAL_DOCS_SAFE_ERROR,
    };
  }
}

const checkFranchizeAvailabilitySchema = z.object({
  carIds: z.array(z.string().trim().min(1)).min(1),
  rentalStartDate: z.string().trim().min(1),
  rentalEndDate: z.string().trim().min(1),
});

export async function checkFranchizeCarsAvailability(input: unknown): Promise<{ success: boolean; unavailableCarIds?: string[]; error?: string }> {
  const parsed = checkFranchizeAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Некорректный запрос проверки доступности." };
  }

  const { carIds, rentalStartDate, rentalEndDate } = parsed.data;
  const startAt = new Date(`${rentalStartDate}T00:00:00.000Z`);
  const endAt = new Date(`${rentalEndDate}T23:59:59.999Z`);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt < startAt) {
    return { success: false, error: "Проверьте диапазон дат аренды." };
  }
  const startIso = startAt.toISOString();
  const endIso = endAt.toISOString();

  const blockingStatuses = ["pending", "pending_confirmation", "confirmed", "active"] as const;

  const { data, error } = await supabaseAdmin
    .from("rentals")
    .select("vehicle_id")
    .in("vehicle_id", carIds)
    .in("status", blockingStatuses)
    .filter("requested_start_date", "lt", endIso)
    .filter("requested_end_date", "gt", startIso);

  if (error) {
    return { success: false, error: `Не удалось проверить пересечения аренды: ${error.message}` };
  }

  const unavailableCarIds = Array.from(new Set((data ?? []).map((row) => row.vehicle_id).filter((id): id is string => typeof id === "string")));
  return { success: true, unavailableCarIds };
}

export async function getFranchizeRentalCard(slug: string, rentalId: string): Promise<{
  found: boolean;
  rentalId: string;
  slug: string;
  status: string;
  paymentStatus: string;
  totalCost: number;
  vehicleTitle: string;
  renterId: string;
  ownerId: string;
  metadata: Record<string, unknown> | null;
  contractVerificationStatus: "verified" | "not_verified" | "expired";
  contractVerifierScope: string;
  contractDocumentKey: string;
  docVerifierRecordId: string;
  contractSourceScope: string;
  contractOriginalSha256: string;
  telegramDeepLink: string;
}> {
  const safeSlug = slug.trim();
  const safeRentalId = rentalId.trim();
  if (!safeSlug || !safeRentalId) {
    return {
      found: false,
      rentalId: safeRentalId || "-",
      slug: safeSlug || "",
      status: "pending_confirmation",
      paymentStatus: "interest_paid",
      totalCost: 0,
      vehicleTitle: "—",
      renterId: "",
      ownerId: "",
      metadata: null,
      contractVerificationStatus: "not_verified",
      contractVerifierScope: "",
      contractDocumentKey: "",
      docVerifierRecordId: "",
      contractSourceScope: "",
      contractOriginalSha256: "",
      // Use env var for crew bot username in fallback case
      telegramDeepLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot"}/app?startapp=rental-${safeRentalId}`,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, status, payment_status, total_cost, user_id, owner_id, metadata, vehicle:cars(make, model)")
    .eq("rental_id", safeRentalId)
    .maybeSingle();

  if (error || !data) {
    return {
      found: false,
      rentalId: safeRentalId,
      slug: safeSlug,
      status: "pending_confirmation",
      paymentStatus: "interest_paid",
      totalCost: 0,
      vehicleTitle: "—",
      renterId: "",
      ownerId: "",
      metadata: null,
      contractVerificationStatus: "not_verified",
      contractVerifierScope: "",
      contractDocumentKey: "",
      docVerifierRecordId: "",
      contractSourceScope: "",
      contractOriginalSha256: "",
      // Use env var for crew bot username in fallback case
      telegramDeepLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot"}/app?startapp=rental-${safeRentalId}`,
    };
  }

  const vehicle = data.vehicle as { make?: string; model?: string } | null;

  const metadata = (data.metadata as Record<string, unknown> | null) ?? null;
  const verifier = metadata && typeof metadata.contract_verifier === "object" ? (metadata.contract_verifier as Record<string, unknown>) : null;
  const rawStatus = typeof verifier?.status === "string" ? verifier.status.trim().toLowerCase() : "";
  const expiresAtValue = typeof verifier?.expiresAt === "string" ? verifier.expiresAt : "";
  const hasExpired = Boolean(expiresAtValue) && new Date(expiresAtValue).getTime() < Date.now();
  const contractVerificationStatus = hasExpired
    ? "expired"
    : rawStatus === "verified" || rawStatus === "ok" || rawStatus === "valid"
      ? "verified"
      : rawStatus === "expired"
        ? "expired"
      : "not_verified";

  return {
    found: true,
    rentalId: data.rental_id,
    slug: safeSlug,
    status: data.status ?? "pending_confirmation",
    paymentStatus: data.payment_status ?? "interest_paid",
    totalCost: Number(data.total_cost ?? 0),
    vehicleTitle: `${vehicle?.make ?? "Vehicle"} ${vehicle?.model ?? ""}`.trim(),
    renterId: data.user_id ?? "",
    ownerId: data.owner_id ?? "",
    metadata,
    contractVerificationStatus,
    contractVerifierScope: typeof verifier?.scope === "string" ? verifier.scope : "",
    contractDocumentKey: typeof verifier?.documentKey === "string" ? verifier.documentKey : "",
    docVerifierRecordId: typeof verifier?.docVerifierRecordId === "string" ? verifier.docVerifierRecordId : "",
    contractSourceScope: typeof verifier?.sourceScope === "string" ? verifier.sourceScope : "",
    contractOriginalSha256: typeof verifier?.originalSha256 === "string" ? verifier.originalSha256 : "",
    // Use env var for crew bot username
    telegramDeepLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot"}/app?startapp=rental-${data.rental_id}`,
  };
}

/**
 * Get today's rentals analytics for a crew.
 * Only accessible to active crew members.
 *
 * @param input - { slug: string, actorUserId: string }
 * @returns Analytics data with rentals list and totals
 */
export async function getTodayRentalsAnalytics(input: unknown) {
  const parsed = z
    .object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1).optional(),
    })
    .safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Invalid input", rentals: [], summary: null };
  }

  const { slug, actorUserId } = parsed.data;

  try {
    // Get crew ID from slug (include owner_id for auth check)
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!crew?.id) {
      return { ok: false, error: "Crew not found", rentals: [], summary: null };
    }

    // Authorization check: verify user is admin, crew owner, or active owner member
    const canAccess = await resolveFranchizeEditorAccess(actorUserId, crew);
    if (!canAccess) {
      return { ok: false, error: "Недостаточно прав для просмотра аналитики.", rentals: [], summary: null };
    }

    // Query today's rentals for this crew with proper UTC date boundaries
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString();
    const endOfDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() + 1)).toISOString();

    const { data: rentals, error } = await supabaseAdmin
      .from("rentals")
      .select(
        `
        rental_id,
        user_id,
        vehicle_id,
        requested_start_date,
        requested_end_date,
        total_cost,
        status,
        payment_status,
        vehicle:cars!inner(id, make, model, crew_id, specs)
      `
      )
      .eq("status", "active")
      .eq("vehicle.crew_id", crew.id)  // Filter by crew_id to prevent cross-crew data leakage
      .gte("requested_start_date", startOfDay)
      .lt("requested_start_date", endOfDay)
      .order("requested_start_date", { ascending: false });

    if (error) {
      logger.error("[getTodayRentalsAnalytics] Query failed:", error);
      return { ok: false, error: error.message, rentals: [], summary: null };
    }

    // Get renter names from users table
    const userIds = rentals.map((r) => r.user_id).filter(Boolean);
    const rentersMap = new Map<string, string>();

    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("user_id, username, metadata")
        .in("user_id", userIds);

      for (const user of users ?? []) {
        if (!user.user_id) continue;  // Skip null user_id
        const fullName =
          user.metadata?.fullName ||
          user.metadata?.display_name ||
          user.username ||
          `Пользователь #${user.user_id.slice(0, 8)}`;
        rentersMap.set(user.user_id, fullName);
      }
    }

    // Enrich rentals with renter names
    const enrichedRentals = rentals.map((r: any) => {
      const vehicle = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
      return {
        rentalId: r.rental_id,
        userId: r.user_id,
        vehicleId: r.vehicle_id,
        bikeName: `${vehicle?.make || ''} ${vehicle?.model || ''}`.trim(),
        bikeSpecs: vehicle?.specs,
        startDate: r.requested_start_date,
        endDate: r.requested_end_date,
        totalCost: r.total_cost,
        status: r.status,
        paymentStatus: r.payment_status,
        renterName: rentersMap.get(r.user_id) || "Неизвестный",
      };
    });

    // Calculate summary
    const totalCount = enrichedRentals.length;
    const totalRevenue = enrichedRentals.reduce(
      (sum, r) => sum + (r.totalCost || 0),
      0
    );

    const summary = {
      count: totalCount,
      revenue: totalRevenue,
      date: startOfDay.split("T")[0],  // Use the UTC date string
    };

    return {
      ok: true,
      rentals: enrichedRentals,
      summary,
    };
  } catch (error) {
    logger.error("[getTodayRentalsAnalytics] Exception:", error);
    return { ok: false, error: "Exception", rentals: [], summary: null };
  }
}

// Contract generation types
export type {
  SubmitContractDraftInput,
  SubmitContractDraftResult,
  ApproveContractInput,
  ApproveContractResult,
  DeclineContractInput,
  DeclineContractResult,
  ContractDraftData,
  FinalizeRentalReturnInput,
  FinalizeRentalReturnResult,
  RentalContractTemplateVars,
  CrewContractSecrets,
  BikeSpecs,
} from './lib/rental-contract-types';
