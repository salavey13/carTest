"use server";

import { createInvoice, supabaseAdmin } from "@/lib/supabase-server";
import { notifyAdmin, sendTelegramDocument, sendTelegramInvoice } from "@/app/actions";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import { getCrewSensitiveData, getUserSensitiveData, saveCrewSensitiveData } from "@/app/lib/private-secrets";
import { buildFranchizeDocxFromTemplate } from "@/app/franchize/lib/docx-capability";

type UnknownRecord = Record<string, unknown>;
type RentalAvailabilityRow = {
  vehicle_id: string | null;
  status: string | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  requested_end_date: string | null;
};

type ThemePaletteCandidate = Partial<FranchizeTheme["palette"]> & {
  light?: Partial<FranchizeTheme["palette"]>;
  dark?: Partial<FranchizeTheme["palette"]>;
};

function resolvePaletteByMode(franchize: UnknownRecord): FranchizeTheme["palette"] {
  const mode = readPath(franchize, ["theme", "mode"], defaultTheme.mode).toLowerCase();
  const paletteCandidate = readPath(franchize, ["theme", "palette"], {}) as ThemePaletteCandidate;
  const palettesCandidate = readPath(franchize, ["theme", "palettes"], {}) as ThemePaletteCandidate;

  const explicitFlatPalette = (
    typeof paletteCandidate.bgBase === "string" &&
    typeof paletteCandidate.bgCard === "string" &&
    typeof paletteCandidate.accentMain === "string"
  )
    ? paletteCandidate
    : undefined;

  const modeBucket = mode.includes("light") ? "light" : "dark";
  const nestedByMode = readPath(paletteCandidate, [modeBucket], {}) as Partial<FranchizeTheme["palette"]>;
  const nestedFromPalettes = readPath(palettesCandidate, [modeBucket], {}) as Partial<FranchizeTheme["palette"]>;

  const source = {
    ...explicitFlatPalette,
    ...nestedFromPalettes,
    ...nestedByMode,
  } as Partial<FranchizeTheme["palette"]>;

  return {
    bgBase: readPath(source, ["bgBase"], defaultTheme.palette.bgBase),
    bgCard: readPath(source, ["bgCard"], defaultTheme.palette.bgCard),
    accentMain: readPath(source, ["accentMain"], defaultTheme.palette.accentMain),
    accentMainHover: readPath(source, ["accentMainHover"], defaultTheme.palette.accentMainHover),
    textPrimary: readPath(source, ["textPrimary"], defaultTheme.palette.textPrimary),
    textSecondary: readPath(source, ["textSecondary"], defaultTheme.palette.textSecondary),
    borderSoft: readPath(source, ["borderSoft"], defaultTheme.palette.borderSoft),
  };
}

export interface FranchizeTheme {
  mode: string;
  palette: {
    bgBase: string;
    bgCard: string;
    accentMain: string;
    accentMainHover: string;
    textPrimary: string;
    textSecondary: string;
    borderSoft: string;
  };
}

export interface FranchizeHeaderVM {
  brandName: string;
  tagline: string;
  logoUrl: string;
  menuLinks: Array<{ label: string; href: string }>;
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
    workingHours: string;
    map: {
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
  footer: {
    socialLinks: Array<{ label: string; href: string }>;
    textColor: string;
  };
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

const defaultTheme: FranchizeTheme = {
  mode: "pepperolli_dark",
  palette: {
    bgBase: "#0B0C10",
    bgCard: "#111217",
    accentMain: "#D99A00",
    accentMainHover: "#E2A812",
    textPrimary: "#F2F2F3",
    textSecondary: "#A7ABB4",
    borderSoft: "#24262E",
  },
};

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
  mapBoundsTop: z.string().trim().default("56.42"),
  mapBoundsBottom: z.string().trim().default("56.08"),
  mapBoundsLeft: z.string().trim().default("43.66"),
  mapBoundsRight: z.string().trim().default("44.12"),
  socialLinksText: z.string().default("Telegram|https://t.me/oneBikePlsBot"),
  menuLinksText: z.string().default(""),
  categoryOrderText: z.string().default(""),
  promoBannersText: z.string().default(""),
  adCardsText: z.string().default(""),
  allowPromo: z.coerce.boolean().default(true),
  deliveryModesText: z.string().default("pickup,delivery"),
  paymentOptionsText: z.string().default("telegram_xtr,card,sbp,cash"),
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
  brandName: "VIP BIKE",
  tagline: "Ride the vibe",
  logoUrl: "",
  themeMode: defaultTheme.mode,
  bgBase: defaultTheme.palette.bgBase,
  bgCard: defaultTheme.palette.bgCard,
  accentMain: defaultTheme.palette.accentMain,
  accentMainHover: defaultTheme.palette.accentMainHover,
  textPrimary: defaultTheme.palette.textPrimary,
  textSecondary: defaultTheme.palette.textSecondary,
  borderSoft: defaultTheme.palette.borderSoft,
  lightBgBase: "#F6F6F7",
  lightBgCard: "#FFFFFF",
  lightAccentMain: "#C78900",
  lightAccentMainHover: "#D99A00",
  lightTextPrimary: "#1A1B1F",
  lightTextSecondary: "#4B5160",
  lightBorderSoft: "#D4D8E1",
  phone: "",
  email: "",
  address: "",
  telegram: "",
  mapGps: "56.20420451632873, 43.798582127051695",
  mapImageUrl: "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg",
  mapBoundsTop: "56.42",
  mapBoundsBottom: "56.08",
  mapBoundsLeft: "43.66",
  mapBoundsRight: "44.12",
  socialLinksText: "Telegram|https://t.me/oneBikePlsBot",
  menuLinksText: [
    "Каталог|/franchize/{slug}",
    "Электроэндуро|/franchize/{slug}/electro-enduro",
    "Конфигуратор|/franchize/{slug}/configurator",
    "Map Riders|/franchize/{slug}/map-riders",
    "О нас|/franchize/{slug}/about",
    "Контакты|/franchize/{slug}/contacts",
    "Корзина|/franchize/{slug}/cart",
  ].join("\n"),
  categoryOrderText: "Naked, Supersport, Touring, Neo-retro",
  promoBannersText: "weekend-boost|Weekend boost|Скидка 10% на выходные|WEEKEND10|/franchize/{slug}#catalog-sections||2026-02-01|2026-12-31|90|Забрать скидку",
  adCardsText: "safety-kit|Экипировка PRO|Подбор шлема и защиты перед выдачей|/franchize/{slug}/about||Safety|2026-02-01|2026-12-31|70|Смотреть детали",
  allowPromo: true,
  deliveryModesText: "pickup, delivery",
  paymentOptionsText: "telegram_xtr, card, sbp, cash",
  defaultMode: "pickup",
  issuerName: "",
  issuerRepresentative: "",
  includedMileage: "200",
  overageRateRub: "30",
  bikeValueRub: "700000",
  bikeValueWords: "Семьсот тысяч",
  lateReturnPenaltyRub: "5000",
  returnAddress: "г. Нижний Новгород, ул. Стригинский переулок, дом 13б",
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

const fallbackMenuLinks = (slug: string) => [
  { label: "Каталог", href: `/franchize/${slug}` },
  { label: "Электроэндуро", href: `/franchize/${slug}/electro-enduro` },
  { label: "Конфигуратор", href: `/franchize/${slug}/configurator` },
  { label: "Map Riders", href: `/franchize/${slug}/map-riders` },
  { label: "О нас", href: `/franchize/${slug}/about` },
  { label: "Контакты", href: `/franchize/${slug}/contacts` },
  { label: "Корзина", href: `/franchize/${slug}/cart` },
];

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
      return { label: label || "Social", href: href || "https://t.me/oneBikePlsBot" };
    });
}

function extractFooterSocialLinks(franchize: UnknownRecord, fallbackTelegram: string) {
  const explicit = readPath(franchize, ["footer", "socialLinks"], []) as Array<UnknownRecord>;
  const fromExplicit = explicit
    .map((item) => ({ label: readPath(item, ["label"], ""), href: readPath(item, ["href"], "") }))
    .filter((item) => item.label && item.href);

  if (fromExplicit.length > 0) return fromExplicit;

  const columns = readPath(franchize, ["footer", "columns"], []) as Array<UnknownRecord>;
  const fromColumns = columns.flatMap((column) => {
    const items = readPath(column, ["items"], []) as Array<UnknownRecord>;
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

  return [{ label: "Telegram", href: "https://t.me/oneBikePlsBot" }];
}

const emptyCrew = (slug: string): FranchizeCrewVM => ({
  id: "",
  slug,
  name: "Crew not found",
  description: "No franchise crew found for this slug yet.",
  logoUrl: "",
  hqLocation: "",
  isFound: false,
  theme: defaultTheme,
  header: {
    brandName: "Franchize",
    tagline: "Hydration pending",
    logoUrl: "",
    menuLinks: fallbackMenuLinks(slug),
  },
  contacts: {
    phone: "",
    email: "",
    address: "",
    telegram: "",
    workingHours: "",
    map: {
      gps: "",
      publicTransport: "",
      carDirections: "",
      imageUrl: "",
      bounds: {
        top: 56.42,
        bottom: 56.08,
        left: 43.66,
        right: 44.12,
      },
    },
  },
  catalog: {
    categories: [],
    quickLinks: [],
    tickerItems: [],
    showcaseGroups: [],
  },
  footer: {
    socialLinks: [],
    textColor: "#16130A",
  },
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

    const catalogTypes = ["bike", "accessories", "gear", "wbitem"];
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

      const isActiveNow = rentalStatus === "active" || (!Number.isNaN(startTs) && startTs <= nowTs && (Number.isNaN(endTs) || endTs >= nowTs));
      const isUpcomingBooking = ["pending_confirmation", "confirmed"].includes(rentalStatus) && (Number.isNaN(endTs) || endTs >= nowTs);
      const isBusy = isActiveNow || isUpcomingBooking;
      if (!isBusy) continue;

      const label = isActiveNow
        ? (Number.isNaN(endTs) ? "В аренде сейчас" : `В аренде до ${new Date(endTs).toLocaleDateString("ru-RU")}`)
        : (Number.isNaN(startTs) ? "Забронирован" : `Забронирован с ${new Date(startTs).toLocaleDateString("ru-RU")}`);
      availabilityByVehicle.set(vehicleId, { status: "busy", label });
    }

    const metadata = ((crew as UnknownRecord).metadata ?? {}) as UnknownRecord;
    const franchize = (metadata.franchize ?? metadata) as UnknownRecord;

    const themePalette = resolvePaletteByMode(franchize);
    const menuLinksRaw = readPath(franchize, ["header", "menuLinks"], fallbackMenuLinks(safeSlug)).map((link) => ({
      ...link,
      href: withSlug(link.href, crew.slug ?? safeSlug),
    }));
    const menuLinks = menuLinksRaw.some((link) => link.href === `/franchize/${crew.slug ?? safeSlug}/map-riders`)
      ? menuLinksRaw
      : [
          ...menuLinksRaw.slice(0, 1),
          { label: "Map Riders", href: `/franchize/${crew.slug ?? safeSlug}/map-riders` },
          ...menuLinksRaw.slice(1),
        ];

    const metadataShowcaseGroups = readPath(franchize, ["catalog", "showcaseGroups"], []) as Array<UnknownRecord>;
    const defaultShowcaseGroups: FranchizeCrewVM["catalog"]["showcaseGroups"] = [
      { id: "edition-23", label: "23rd feb edition", mode: "subtype", subtype: "bobber" },
      { id: "sweetspot-6000", label: "Все по 6000", mode: "price", minPrice: 5600, maxPrice: 6400 },
    ];
    const showcaseGroups = (metadataShowcaseGroups.length > 0
      ? metadataShowcaseGroups.map((group, index) => ({
          id: readPath(group, ["id"], `showcase-${index + 1}`),
          label: readPath(group, ["label"], readPath(group, ["title"], `Showcase ${index + 1}`)),
          mode: readPath(group, ["mode"], "subtype") as "subtype" | "price",
          subtype: readPath(group, ["subtype"], ""),
          minPrice: Number(readPath(group, ["minPrice"], 0)),
          maxPrice: Number(readPath(group, ["maxPrice"], 0)),
        }))
      : defaultShowcaseGroups)
      .filter((group) => group.label.trim().length > 0);

    const hydratedCrew: FranchizeCrewVM = {
      id: crew.id,
      slug: crew.slug ?? safeSlug,
      name: crew.name ?? "Unnamed crew",
      description: crew.description ?? "",
      logoUrl: crew.logo_url ?? "",
      hqLocation: crew.hq_location ?? "",
      isFound: true,
      theme: {
        mode: readPath(franchize, ["theme", "mode"], defaultTheme.mode),
        palette: themePalette,
      },
      header: {
        brandName: readPath(franchize, ["branding", "name"], crew.name ?? "Franchize"),
        tagline: readPath(franchize, ["branding", "tagline"], "Ride the vibe"),
        logoUrl: readPath(franchize, ["branding", "logoUrl"], crew.logo_url ?? ""),
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
        workingHours: readPath(franchize, ["contacts", "workingHours"], ""),
        map: {
          gps: readPath(franchize, ["contacts", "map", "gps"], ""),
          publicTransport: readPath(franchize, ["contacts", "map", "publicTransport"], ""),
          carDirections: readPath(franchize, ["contacts", "map", "carDirections"], ""),
          imageUrl: readPath(franchize, ["contacts", "map", "imageUrl"], ""),
          bounds: {
            top: Number(readPath(franchize, ["contacts", "map", "bounds", "top"], 56.42)),
            bottom: Number(readPath(franchize, ["contacts", "map", "bounds", "bottom"], 56.08)),
            left: Number(readPath(franchize, ["contacts", "map", "bounds", "left"], 43.66)),
            right: Number(readPath(franchize, ["contacts", "map", "bounds", "right"], 44.12)),
          },
        },
      },
      catalog: {
        categories: readPath(franchize, ["catalog", "groupOrder"], []),
        quickLinks: readPath(franchize, ["catalog", "quickLinks"], []),
        tickerItems: readPath(franchize, ["catalog", "tickerItems"], []).map((item: unknown, index: number) => {
          const tickerItem = (item ?? {}) as UnknownRecord;
          const text = readPath(tickerItem, ["text"], readPath(tickerItem, ["title"], ""));

          return {
            id: readPath(tickerItem, ["id"], `ticker-${index + 1}`),
            text,
            href: readPath(tickerItem, ["href"], `/franchize/${crew.slug ?? safeSlug}`),
          };
        }),
        promoBanners: readPath(franchize, ["catalog", "promoBanners"], []).map((item: unknown, index: number) => {
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
        adCards: readPath(franchize, ["catalog", "adCards"], []).map((item: unknown, index: number) => {
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
      footer: {
        socialLinks: extractFooterSocialLinks(franchize, readPath(franchize, ["contacts", "telegram"], "")),
        textColor: readPath(franchize, ["footer", "textColor"], "#16130A"),
      },
    };

    const items: CatalogItemVM[] = (cars ?? []).map((car) => {
      const specs = (car.specs ?? {}) as UnknownRecord;
      const subtype =
        (typeof specs.subtype === "string" && specs.subtype.trim()) ||
        (typeof specs.bike_subtype === "string" && specs.bike_subtype.trim()) ||
        (typeof specs.segment === "string" && specs.segment.trim()) ||
        (typeof specs.type === "string" && specs.type.trim().toLowerCase() !== "bike" && specs.type.trim()) ||
        "Unsorted";

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
        subtitle: (typeof specs.subtitle === "string" ? specs.subtitle : "Ready to ride") as string,
        description: car.description ?? (typeof specs.description === "string" ? specs.description : "Подробности откроются в карточке"),
        imageUrl: mediaUrls[0] ?? "",
        mediaUrls,
        pricePerDay: car.daily_price ?? 0,
        rentPriceLabel:
          (typeof readPath(specs, ["rent_price_label"], "") === "string" && String(readPath(specs, ["rent_price_label"], "")).trim().length > 0)
            ? String(readPath(specs, ["rent_price_label"], "")).trim()
            : `${Number(car.daily_price ?? 0).toLocaleString("ru-RU")} ₽ / день`,
        category: subtype,
        availabilityStatus: availabilityByVehicle.get(car.id)?.status ?? fallbackStatus,
        availabilityLabel: availabilityByVehicle.get(car.id)?.label ?? fallbackLabel,
        isHot:
          Number(car.daily_price ?? 0) >= 7000 ||
          Boolean(readPath(specs, ["is_hot"], false)) ||
          Boolean(readPath(specs, ["hot"], false)) ||
          /hot|🔥/i.test(String(readPath(specs, ["badge"], ""))),
        saleAvailable:
          readPath(specs, ["sale"], 0) === 1 ||
          readPath(specs, ["sale"], false) === true ||
          String(readPath(specs, ["sale"], "")).toLowerCase() === "1" ||
          String(readPath(specs, ["sale"], "")).toLowerCase() === "true",
        salePrice:
          Number(readPath(specs, ["sale_price"], 0)) > 0
            ? Number(readPath(specs, ["sale_price"], 0))
            : Number(readPath(specs, ["purchase_price"], 0)) > 0
              ? Number(readPath(specs, ["purchase_price"], 0))
              : null,
        rawSpecs: specs,
        specs: Object.entries(specs)
          .filter(([, value]) => typeof value === "string" || typeof value === "number")
          .filter(([key]) => !["subtitle", "description", "segment", "subtype", "bike_subtype", "type"].includes(key))
          .slice(0, 4)
          .map(([key, value]) => ({ label: key.replace(/_/g, " "), value: String(value) })),
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
        title: trimCampaignTitle(title || "", `Ad ${index + 1}`),
        subtitle: subtitle || "",
        href: normalizeCampaignHref(href || "", slug),
        imageUrl: imageUrl || "",
        badge: badge || "Ad",
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
        label: label || "Link",
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
  const menuLinks = readPath(franchize, ["header", "menuLinks"], fallbackMenuLinks(slug));

  const crewSecrets = await getCrewSensitiveData(slug);
  const contractDefaults = (crewSecrets.contractDefaults ?? {}) as UnknownRecord;
  const defaults = (readPath(contractDefaults, ["defaults"], {}) ?? {}) as UnknownRecord;
  const docTemplates = (crewSecrets.docTemplates ?? {}) as UnknownRecord;

  return {
    ...defaultFranchizeConfig,
    slug,
    brandName: readPath(franchize, ["branding", "name"], (crew.name as string) ?? defaultFranchizeConfig.brandName),
    tagline: readPath(franchize, ["branding", "tagline"], defaultFranchizeConfig.tagline),
    logoUrl: readPath(franchize, ["branding", "logoUrl"], (crew.logo_url as string) ?? ""),
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
    mapBoundsTop: String(readPath(franchize, ["contacts", "map", "bounds", "top"], 56.42)),
    mapBoundsBottom: String(readPath(franchize, ["contacts", "map", "bounds", "bottom"], 56.08)),
    mapBoundsLeft: String(readPath(franchize, ["contacts", "map", "bounds", "left"], 43.66)),
    mapBoundsRight: String(readPath(franchize, ["contacts", "map", "bounds", "right"], 44.12)),
    socialLinksText: extractFooterSocialLinks(franchize, readPath(franchize, ["contacts", "telegram"], ""))
      .map((entry) => `${entry.label}|${entry.href}`)
      .join("\n"),
    menuLinksText: menuLinks
      .map((entry) => `${readPath(entry, ["label"], "Link")}|${readPath(entry, ["href"], `/franchize/${slug}`)}`)
      .join("\n"),
    categoryOrderText: readPath(franchize, ["catalog", "groupOrder"], []).join(", "),
    promoBannersText: readPath(franchize, ["catalog", "promoBanners"], [])
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
    adCardsText: readPath(franchize, ["catalog", "adCards"], [])
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
    deliveryModesText: readPath(franchize, ["order", "deliveryModes"], ["pickup", "delivery"]).join(", "),
    paymentOptionsText: readPath(franchize, ["order", "paymentOptions"], ["telegram_xtr", "card", "sbp", "cash"]).join(", "),
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

  const payload = parsed.data;
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

type FranchizeOrderFlowType = "rental" | "sale" | "mixed";

async function loadFranchizeDealTemplate(slug: string, flowType: FranchizeOrderFlowType): Promise<string> {
  const crewSensitive = await getCrewSensitiveData(slug);
  const secureTemplateKey = flowType === "rental" ? "rentalDealTemplate" : "saleDealTemplate";
  const secureTemplate = readPath(crewSensitive.docTemplates ?? {}, [secureTemplateKey], "");
  if (typeof secureTemplate === "string" && secureTemplate.trim().length > 0) {
    return secureTemplate;
  }

  const remoteTemplateUrl = flowType === "rental"
    ? "https://raw.githubusercontent.com/salavey13/carTest/main/docs/RENTAL_DEAL_TEMPLATE_DEMO.md"
    : "https://raw.githubusercontent.com/salavey13/carTest/main/docs/SALE_DEAL_TEMPLATE_DEMO.md";
  const localTemplateFile = flowType === "rental" ? "RENTAL_DEAL_TEMPLATE_DEMO.md" : "SALE_DEAL_TEMPLATE_DEMO.md";

  try {
    const response = await fetch(remoteTemplateUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`template fetch failed with ${response.status}`);
    }

    const remoteTemplate = await response.text();
    if (remoteTemplate.trim().length > 0) {
      return remoteTemplate;
    }

    throw new Error("template fetch returned empty content");
  } catch (error) {
    logger.warn("[franchize] fallback to local template", { flowType, error });
    const localTemplatePath = path.join(process.cwd(), "docs", localTemplateFile);
    return readFile(localTemplatePath, "utf8");
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

    const firstLine = payload.cartLines[0];
    const firstCar = firstLine ? byId.get(firstLine.itemId) : null;
    const firstSpecs = (firstCar?.specs as Record<string, unknown> | null) || {};
    const rentDays = Math.max(...payload.cartLines.map((line) => parseDurationDays(line.options.duration)));
    const flowType: FranchizeOrderFlowType = payload.flowType ?? "rental";
    const isSaleFlow = flowType === "sale" || flowType === "mixed";
    const rentStartDate = payload.rentalStartDate || payload.time;
    const rentEndDate = payload.rentalEndDate || payload.time;
    const dailyPriceRub = firstLine?.pricePerDay || Math.round(payload.subtotal / Math.max(1, rentDays));

    const template = await loadFranchizeDealTemplate(payload.slug, flowType);
    const userSensitive = await getUserSensitiveData(payload.telegramUserId);
    const crewSensitive = await getCrewSensitiveData(payload.slug);
    const contractDefaults = (crewSensitive.contractDefaults ?? {}) as UnknownRecord;
    const defaults = (readPath(contractDefaults, ["defaults"], {}) ?? {}) as UnknownRecord;

    const variables = {
      contract_number: `${payload.slug.toUpperCase()}-${payload.orderId}`,
      contract_date: new Date().toLocaleDateString("ru-RU"),
      day: new Date().getDate().toString().padStart(2, "0"),
      month: new Date().toLocaleString("ru-RU", { month: "long" }),
      year: new Date().getFullYear().toString(),
      renter_full_name: payload.recipient,
      renter_phone: payload.phone,
      renter_driver_license: userSensitive.driverLicense || payload.renterDriverLicense || "указывается при выдаче",
      renter_passport: userSensitive.passport || payload.renterPassport || "указывается при выдаче",
      issuer_name: String(readPath(defaults, ["issuerName"], `Franchize ${payload.slug}`)),
      issuer_signatory: "Администратор экипажа",
      issuer_representative: String(readPath(defaults, ["issuer_representative"], "Сидоров Илья Олегович")),
      bike_make_model: firstCar
        ? `${firstCar.make || "Bike"} ${firstCar.model || "Model"}`
        : payload.cartLines.map((line) => line.itemId).join(", "),
      bike_vin: String(firstSpecs.vin || firstSpecs.frame || firstSpecs.vin_number || "уточняется"),
      bike_plate: String(firstSpecs.plate || firstSpecs.state_number || "уточняется"),
      bike_mileage: "45073",
      rent_start_time: "12:00",
      rent_start_date: rentStartDate,
      rent_end_time: "12:00",
      rent_end_date: rentEndDate,
      rent_days: rentDays,
      daily_price_rub: formatMoney(dailyPriceRub),
      subtotal_rub: formatMoney(payload.subtotal),
      extras_rows: extrasRows,
      extras_total_rub: formatMoney(payload.extrasTotal),
      total_price_rub: formatMoney(payload.totalAmount),
      deposit_rub: "20 000",
      included_mileage: String(readPath(defaults, ["included_mileage"], 200)),
      overage_rate: `${readPath(defaults, ["overage_rate"], 30)} руб/км`,
      bike_value_rub: String(readPath(defaults, ["bike_value_rub"], 700000)),
      bike_value_words: String(readPath(defaults, ["bike_value_words"], "Семьсот тысяч")),
      late_return_penalty_rub: String(readPath(defaults, ["late_return_penalty_rub"], 5000)),
      return_address: String(readPath(defaults, ["return_address"], "г. Нижний Новгород, ул. Стригинский переулок, дом 13б")),
      signature_timestamp: new Date().toLocaleString("ru-RU"),
      signature_fingerprint: payload.signatureFingerprint || "—",
      renter_signature: payload.signatureName || "электронное согласие в Telegram WebApp",
      document_key: `${isSaleFlow ? "sale" : "rental"}-${payload.slug}-${payload.orderId}`,
      verified_at: new Date().toISOString(),
    } as const;

    const docFileName = `franchize-order-${payload.slug}-${payload.orderId}.docx`;
    const verifierScope = `${flowType}:${payload.slug}:${payload.orderId}`;
    const { bytes, renderedMarkdown, verifierRecordId, sha256 } = await buildFranchizeDocxFromTemplate({
      integrationScope: verifierScope,
      uploadedBy: "franchize-order-system",
      documentKey: variables.document_key,
      fileName: docFileName,
      template,
      variables,
    });

    const adminChatId = process.env.ADMIN_CHAT_ID;
    if (!adminChatId) {
      throw new Error("ADMIN_CHAT_ID not configured");
    }

    await notifyAdmin(
      [
        `${isSaleFlow ? "🛍️ Новый franchize-заказ на покупку" : "🧾 Новый franchize-заказ на аренду"} #${payload.orderId}`,
        `Crew: ${payload.slug}`,
        `Получатель: ${payload.recipient}`,
        `Телефон: ${payload.phone}`,
        `Время: ${payload.time}`,
        `Оплата: ${payload.payment}`,
        `Доставка: ${payload.delivery}`,
        `Итого: ${formatMoney(payload.totalAmount)} ₽`,
      ].join("\n"),
    );

    const recipientSet = new Set<string>([adminChatId, payload.telegramUserId]);
    const { data: crewRow } = await supabaseAdmin.from("crews").select("owner_id").eq("slug", payload.slug).maybeSingle();
    const ownerId = typeof crewRow?.owner_id === "string" ? crewRow.owner_id : "";
    if (ownerId) {
      const { data: ownerUser } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", ownerId)
        .maybeSingle();
      const ownerMeta = (ownerUser?.metadata ?? {}) as Record<string, unknown>;
      const ownerTelegramId = String(ownerMeta.telegram_id ?? ownerMeta.telegramId ?? "").trim();
      if (ownerTelegramId) {
        recipientSet.add(ownerTelegramId);
      }
    }

    for (const recipientId of recipientSet) {
      const sendDocResult = await sendTelegramDocument(recipientId, new Blob([bytes]), docFileName);
      if (!sendDocResult.success) {
        throw new Error(sendDocResult.error || `Failed to send DOCX to ${recipientId}`);
      }
    }

    await updateFranchizeOrderNotificationLog(logId, {
      send_status: "sent",
      rendered_markdown: renderedMarkdown,
      doc_file_name: docFileName,
      last_error: "",
    });

    if (flowType === "rental") {
      const { data: rentalRow } = await supabaseAdmin
        .from("rentals")
        .select("rental_id, metadata")
        .eq("metadata->>orderId", payload.orderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (rentalRow?.rental_id) {
        const existingMetadata =
          rentalRow.metadata && typeof rentalRow.metadata === "object" ? (rentalRow.metadata as Record<string, unknown>) : {};
        const rentalScope = `rental:${rentalRow.rental_id}`;
        await supabaseAdmin
          .from("rentals")
          .update({
            metadata: {
              ...existingMetadata,
              contract_verifier: {
                scope: rentalScope,
                sourceScope: verifierScope,
                documentKey: variables.document_key,
                docVerifierRecordId: verifierRecordId ?? null,
                originalSha256: sha256,
                status: "verified",
                verifiedAt: new Date().toISOString(),
                expiresAt: null,
              },
            },
          })
          .eq("rental_id", rentalRow.rental_id);
      }
    }

    return { renderedMarkdown, docFileName };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit order notification";
    await updateFranchizeOrderNotificationLog(logId, {
      send_status: "failed",
      last_error: message,
    });

    throw error;
  }
}


const franchizeOrderInvoiceSchema = z.object({
  slug: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  telegramUserId: z.string().trim().min(1),
  recipient: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  renterDriverLicense: z.string().trim().optional(),
  renterPassport: z.string().trim().optional(),
  time: z.string().trim().min(1),
  comment: z.string().trim().default(""),
  rentalStartDate: z.string().trim().optional(),
  rentalEndDate: z.string().trim().optional(),
  signatureName: z.string().trim().optional(),
  signatureAccepted: z.boolean().optional(),
  signatureFingerprint: z.string().trim().optional(),
  payment: z.enum(["telegram_xtr", "card", "cash", "sbp"]),
  delivery: z.enum(["pickup", "delivery"]),
  subtotal: z.number().finite().nonnegative(),
  extrasTotal: z.number().finite().nonnegative().default(0),
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
  flowType: z.enum(["rental", "sale", "mixed"]).default("rental"),
});

export async function submitFranchizeOrderNotification(input: unknown): Promise<{ success: boolean; error?: string }> {
  const parsed = franchizeOrderInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Некорректный payload заказа." };
  }

  const payload = parsed.data;
  const effectiveTotal = payload.totalAmount > 0 ? payload.totalAmount : payload.subtotal + payload.extrasTotal;

  try {
    await buildFranchizeOrderDocAndNotify({ ...payload, totalAmount: effectiveTotal, subtotal: payload.subtotal, extrasTotal: payload.extrasTotal });
    return { success: true };
  } catch (error) {
    logger.error("[franchize] submitFranchizeOrderNotification failed", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to submit order notification" };
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

type FranchizeOrderInvoicePayload = z.infer<typeof franchizeOrderInvoiceSchema>;

const franchizeCheckoutRateLimits = new Map<string, number>();
const FRANCHIZE_CHECKOUT_COOLDOWN_MS = 8_000;

function buildFranchizeInvoiceId(payload: FranchizeOrderInvoicePayload) {
  const safeSlug = payload.slug.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const safeOrderId = payload.orderId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const safeUserId = payload.telegramUserId.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `franchize_order_${safeSlug}_${safeOrderId}_${safeUserId}`;
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
  const amountXtr = Math.max(1, Math.ceil(effectiveTotal * 0.01));
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
  const flowType = payload.flowType ?? "rental";
  const startParamPrefix = flowType === "rental" ? "rental" : "sale";
  const startParam = `${startParamPrefix}-${rentalId}`;
  const telegramWebappLink = `https://t.me/oneBikePlsBot/app?startapp=${startParam}`;
  const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
  const franchizeRentalLink = `${siteBaseUrl}/franchize/${payload.slug}/rental/${rentalId}`;

  const cartText = payload.cartLines
    .map((line) => `• ${line.itemId} × ${line.qty} (${line.options.package}, ${line.options.duration}, ${line.options.perk}, ${line.options.auction})`)
    .join("\n");

  const description = [
    `Экипаж: ${payload.slug}`,
    `Заказ: #${payload.orderId}`,
    `Получатель: ${payload.recipient}`,
    `Телефон: ${payload.phone}`,
    `Время: ${payload.time}`,
    `Получение: ${payload.delivery === "pickup" ? "Самовывоз" : "Доставка"}`,
    `Состав:`,
    cartText,
    `Subtotal: ${payload.subtotal.toLocaleString("ru-RU")} ₽`,
    `Extras: ${payload.extrasTotal.toLocaleString("ru-RU")} ₽`,
    `Total: ${effectiveTotal.toLocaleString("ru-RU")} ₽`,
    `Proof-of-interest tip: ${amountXtr} XTR (1%)`,
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
    comment: payload.comment,
    payment: payload.payment,
    delivery: payload.delivery,
    subtotal: payload.subtotal,
    extrasTotal: payload.extrasTotal,
    totalAmount: effectiveTotal,
    tipPercent: 1,
    amountXtr,
    rental_id: rentalId,
    startParam,
    telegramWebappLink,
    franchizeRentalLink,
    extras: payload.extras,
    cartLines: payload.cartLines,
    flowType,
  };

  try {
    if (!options.skipNotification) {
      await buildFranchizeOrderDocAndNotify({ ...payload, totalAmount: effectiveTotal, subtotal: payload.subtotal, extrasTotal: payload.extrasTotal });
    }

    const invoiceRecord = await createInvoice("franchize_order", invoiceId, payload.telegramUserId, amountXtr, 0, metadata);
    if (!invoiceRecord.success) {
      return { success: false, error: invoiceRecord.error ?? "Не удалось создать запись счёта." };
    }

    const invoiceSent = await sendTelegramInvoice(
      payload.telegramUserId,
      "Franchize: подтверждение намерения",
      description,
      invoiceId,
      amountXtr,
      0,
    );

    if (!invoiceSent.success) {
      return { success: false, error: invoiceSent.error ?? "Не удалось отправить XTR-счёт в Telegram." };
    }

    return { success: true, invoiceId, amountXtr };
  } catch (error) {
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

  return createFranchizeOrderInvoiceInternal(parsed.data);
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
  franchizeCheckoutRateLimits.set(throttleKey, now);

  const effectiveTotal = payload.totalAmount > 0 ? payload.totalAmount : payload.subtotal + payload.extrasTotal;

  try {
    await buildFranchizeOrderDocAndNotify({
      ...payload,
      subtotal: payload.subtotal,
      extrasTotal: payload.extrasTotal,
      totalAmount: effectiveTotal,
    });

    if (payload.payment === "telegram_xtr") {
      return createFranchizeOrderInvoiceInternal(payload, { skipNotification: true });
    }

    return { success: true };
  } catch (error) {
    logger.error("[franchize] createFranchizeOrderCheckout failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected checkout error",
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
  const startIso = new Date(`${rentalStartDate}T00:00:00.000Z`).toISOString();
  const endIso = new Date(`${rentalEndDate}T23:59:59.999Z`).toISOString();

  const { data, error } = await supabaseAdmin
    .from("rentals")
    .select("vehicle_id")
    .in("vehicle_id", carIds)
    .in("status", ["pending", "confirmed", "active"])
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
  telegramDeepLink: string;
}> {
  const safeSlug = slug.trim();
  const safeRentalId = rentalId.trim();
  if (!safeSlug || !safeRentalId) {
    return {
      found: false,
      rentalId: safeRentalId || "-",
      slug: safeSlug || "vip-bike",
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
      telegramDeepLink: `https://t.me/oneBikePlsBot/app?startapp=rental-${safeRentalId}`,
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
      telegramDeepLink: `https://t.me/oneBikePlsBot/app?startapp=rental-${safeRentalId}`,
    };
  }

  const vehicle = data.vehicle as { make?: string; model?: string } | null;

  const metadata = (data.metadata as Record<string, unknown> | null) ?? null;
  const verifier = metadata && typeof metadata.contract_verifier === "object" ? (metadata.contract_verifier as Record<string, unknown>) : null;
  const expiresAtValue = typeof verifier?.expiresAt === "string" ? verifier.expiresAt : "";
  const hasExpired = Boolean(expiresAtValue) && new Date(expiresAtValue).getTime() < Date.now();
  const contractVerificationStatus = hasExpired
    ? "expired"
    : typeof verifier?.status === "string" && verifier.status.toLowerCase() === "verified"
      ? "verified"
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
    telegramDeepLink: `https://t.me/oneBikePlsBot/app?startapp=rental-${data.rental_id}`,
  };
}
