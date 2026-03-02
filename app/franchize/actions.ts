"use server";


import { createInvoice, supabaseAdmin } from "@/lib/supabase-server";
import { sendTelegramInvoice } from "@/app/actions";
import { logger } from "@/lib/logger";
import { z } from "zod";
import { randomUUID } from "crypto";

type UnknownRecord = Record<string, unknown>;

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
  pricePerDay: number;
  category: string;
  specs: Array<{ label: string; value: string }>;
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
  { label: "О нас", href: `/franchize/${slug}/about` },
  { label: "Контакты", href: `/franchize/${slug}/contacts` },
  { label: "Корзина", href: `/franchize/${slug}/cart` },
];

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
  const safeSlug = slug?.trim();
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
      .select("id, make, model, description, image_url, daily_price, type, specs")
      .eq("crew_id", crew.id)
      .in("type", catalogTypes);

    if (carsError) {
      logger.warn("[franchize] failed to load crew cars", { safeSlug, carsError: carsError.message });
    }

    const metadata = ((crew as UnknownRecord).metadata ?? {}) as UnknownRecord;
    const franchize = (metadata.franchize ?? metadata) as UnknownRecord;

    const themePalette = resolvePaletteByMode(franchize);
    const menuLinks = readPath(franchize, ["header", "menuLinks"], fallbackMenuLinks(safeSlug)).map((link) => ({
      ...link,
      href: withSlug(link.href, crew.slug ?? safeSlug),
    }));

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

      return {
        id: car.id,
        title: `${car.make} ${car.model}`.trim(),
        subtitle: (typeof specs.subtitle === "string" ? specs.subtitle : "Ready to ride") as string,
        description: car.description ?? (typeof specs.description === "string" ? specs.description : "Подробности откроются в карточке"),
        imageUrl: car.image_url ?? "",
        pricePerDay: car.daily_price ?? 0,
        category: subtype,
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

function toFranchizeConfigInput(crew: UnknownRecord, slug: string): FranchizeConfigInput {
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
    advancedJson: JSON.stringify(franchize, null, 2),
  };
}

export async function loadFranchizeConfigBySlug(slug: string, actorUserId?: string): Promise<FranchizeConfigState> {
  const safeSlug = slug.trim();
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
    data: toFranchizeConfigInput(crew as UnknownRecord, safeSlug),
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
  const { data: crew, error: crewError } = await supabaseAdmin.from("crews").select("id, slug, metadata, owner_id").eq("slug", payload.slug).maybeSingle();
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

  return {
    ok: true,
    message: `Франшизный конфиг сохранён в crews.metadata.franchize для ${payload.slug}.`,
    data: payload,
    canEdit: true,
  };
}

const franchizeOrderInvoiceSchema = z.object({
  slug: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  telegramUserId: z.string().trim().min(1),
  recipient: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  time: z.string().trim().min(1),
  comment: z.string().trim().default(""),
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
        package: z.string().trim().default("Base"),
        duration: z.string().trim().default("1 day"),
        perk: z.string().trim().default("Стандарт"),
        auction: z.string().trim().default("Без аукциона"),
      })
      .default({ package: "Base", duration: "1 day", perk: "Стандарт", auction: "Без аукциона" }),
  })).min(1),
});

export async function createFranchizeOrderInvoice(input: unknown): Promise<{ success: boolean; invoiceId?: string; amountXtr?: number; error?: string }> {
  const parsed = franchizeOrderInvoiceSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный payload для XTR-счёта.",
    };
  }

  const payload = parsed.data;

  if (payload.payment !== "telegram_xtr") {
    return {
      success: false,
      error: "Для этой операции поддерживается только Telegram Stars (XTR).",
    };
  }

  const effectiveTotal = payload.totalAmount > 0 ? payload.totalAmount : payload.subtotal + payload.extrasTotal;
  const amountXtr = Math.max(1, Math.ceil(effectiveTotal * 0.01));
  const invoiceId = `franchize_order_${payload.slug}_${payload.orderId}_${Date.now()}`;
  const rentalId = randomUUID();
  const startParam = `rental-${rentalId}`;
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
    `Franchize rental card: ${franchizeRentalLink}`,
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
  };

  try {
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
      telegramDeepLink: `https://t.me/oneBikePlsBot/app?startapp=rental-${safeRentalId}`,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("rentals")
    .select("rental_id, status, payment_status, total_cost, user_id, owner_id, vehicle:cars(make, model)")
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
      telegramDeepLink: `https://t.me/oneBikePlsBot/app?startapp=rental-${safeRentalId}`,
    };
  }

  const vehicle = data.vehicle as { make?: string; model?: string } | null;

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
    telegramDeepLink: `https://t.me/oneBikePlsBot/app?startapp=rental-${data.rental_id}`,
  };
}