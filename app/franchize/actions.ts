"use server";

import { createInvoice, supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions";
import { logger } from "@/lib/logger";
import { z } from "zod";

type UnknownRecord = Record<string, unknown>;

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
  };
  footer: {
    socialLinks: Array<{ label: string; href: string }>;
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
  allowPromo: boolean;
  deliveryModesText: string;
  defaultMode: string;
  advancedJson: string;
}

export interface FranchizeConfigState {
  ok: boolean;
  message: string;
  errors?: Record<string, string[]>;
  data?: FranchizeConfigInput;
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
  allowPromo: z.coerce.boolean().default(true),
  deliveryModesText: z.string().default("pickup,delivery"),
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
  allowPromo: true,
  deliveryModesText: "pickup, delivery",
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
  },
  footer: {
    socialLinks: [],
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

    const { data: cars, error: carsError } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, description, image_url, daily_price, type, specs")
      .eq("crew_id", crew.id)
      .ilike("type", "bike");

    if (carsError) {
      logger.warn("[franchize] failed to load crew cars", { safeSlug, carsError: carsError.message });
    }

    const metadata = ((crew as UnknownRecord).metadata ?? {}) as UnknownRecord;
    const franchize = (metadata.franchize ?? metadata) as UnknownRecord;

    const themePalette = readPath(franchize, ["theme", "palette"], defaultTheme.palette);
    const menuLinks = readPath(franchize, ["header", "menuLinks"], fallbackMenuLinks(safeSlug)).map((link) => ({
      ...link,
      href: withSlug(link.href, crew.slug ?? safeSlug),
    }));

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
        palette: {
          bgBase: readPath(themePalette, ["bgBase"], defaultTheme.palette.bgBase),
          bgCard: readPath(themePalette, ["bgCard"], defaultTheme.palette.bgCard),
          accentMain: readPath(themePalette, ["accentMain"], defaultTheme.palette.accentMain),
          accentMainHover: readPath(themePalette, ["accentMainHover"], defaultTheme.palette.accentMainHover),
          textPrimary: readPath(themePalette, ["textPrimary"], defaultTheme.palette.textPrimary),
          textSecondary: readPath(themePalette, ["textSecondary"], defaultTheme.palette.textSecondary),
          borderSoft: readPath(themePalette, ["borderSoft"], defaultTheme.palette.borderSoft),
        },
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
      },
      footer: {
        socialLinks: extractFooterSocialLinks(franchize, readPath(franchize, ["contacts", "telegram"], "")),
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
        description: car.description ?? "",
        imageUrl: car.image_url ?? "",
        pricePerDay: car.daily_price ?? 0,
        category: subtype,
      };
    });

    return {
      crew: {
        ...hydratedCrew,
        catalog: {
          categories:
            hydratedCrew.catalog.categories.length > 0
              ? hydratedCrew.catalog.categories
              : [...new Set(items.map((item) => item.category).filter(Boolean))],
          quickLinks: hydratedCrew.catalog.quickLinks,
          tickerItems: hydratedCrew.catalog.tickerItems.filter((item) => item.text.trim().length > 0),
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

function toFranchizeConfigInput(crew: UnknownRecord, slug: string): FranchizeConfigInput {
  const metadata = (crew.metadata ?? {}) as UnknownRecord;
  const franchize = (metadata.franchize ?? {}) as UnknownRecord;
  const themePalette = readPath(franchize, ["theme", "palette"], defaultTheme.palette);
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
    allowPromo: readPath(franchize, ["order", "allowPromo"], true),
    deliveryModesText: readPath(franchize, ["order", "deliveryModes"], ["pickup", "delivery"]).join(", "),
    defaultMode: readPath(franchize, ["order", "defaultMode"], "pickup"),
    advancedJson: JSON.stringify(franchize, null, 2),
  };
}

export async function loadFranchizeConfigBySlug(slug: string): Promise<FranchizeConfigState> {
  const safeSlug = slug.trim();
  if (!safeSlug) {
    return { ok: false, message: "Сначала укажите slug экипажа." };
  }

  const { data: crew, error } = await supabaseAdmin.from("crews").select("id, slug, name, logo_url, metadata").eq("slug", safeSlug).maybeSingle();
  if (error || !crew) {
    return { ok: false, message: "Экипаж с таким slug не найден." };
  }

  return {
    ok: true,
    message: `Конфиг для ${safeSlug} загружен.`,
    data: toFranchizeConfigInput(crew as UnknownRecord, safeSlug),
  };
}

export async function saveFranchizeConfig(input: FranchizeConfigInput): Promise<FranchizeConfigState> {
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
  const { data: crew, error: crewError } = await supabaseAdmin.from("crews").select("id, slug, metadata").eq("slug", payload.slug).maybeSingle();
  if (crewError || !crew) {
    return { ok: false, message: "Slug не найден: сохранение не выполнено.", data: payload };
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
        bgBase: payload.bgBase,
        bgCard: payload.bgCard,
        accentMain: payload.accentMain,
        accentMainHover: payload.accentMainHover,
        textPrimary: payload.textPrimary,
        textSecondary: payload.textSecondary,
        borderSoft: payload.borderSoft,
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
    },
    order: {
      ...(readPath(sourceFranchize, ["order"], {}) as UnknownRecord),
      allowPromo: payload.allowPromo,
      deliveryModes: splitCsv(payload.deliveryModesText),
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
    return { ok: false, message: "Не удалось сохранить конфиг в metadata экипажа.", data: payload };
  }

  return {
    ok: true,
    message: `Франшизный конфиг сохранён в crews.metadata.franchize для ${payload.slug}.`,
    data: payload,
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
  cartLines: z.array(z.object({
    itemId: z.string().trim().min(1),
    qty: z.number().int().positive(),
    pricePerDay: z.number().finite().nonnegative(),
    lineTotal: z.number().finite().nonnegative(),
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

  const amountXtr = Math.max(1, Math.ceil(payload.subtotal * 0.01));
  const invoiceId = `franchize_order_${payload.slug}_${payload.orderId}_${Date.now()}`;

  const cartText = payload.cartLines
    .map((line) => `• ${line.itemId} × ${line.qty}`)
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
    `Proof-of-interest tip: ${amountXtr} XTR (1%)`,
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
    tipPercent: 1,
    amountXtr,
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
