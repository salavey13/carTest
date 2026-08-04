// /app/franchize/lib/franchize-config-contract.ts
//
// SINGLE SOURCE OF TRUTH for the crew/franchise configuration contract.
//
// This module is deliberately PURE (no IO, no server-only imports, no `@/`
// path aliases) so it can be imported from THREE places with identical behavior:
//   1. Next.js server actions  — app/franchize/actions-runtime.ts (supabaseAdmin IO)
//   2. The editor UI           — app/franchize/create/CreateFranchizeForm.tsx
//   3. The bot skill script    — scripts/crew-customization-skill.mjs (Node 24 + @supabase/supabase-js)
//
// Everything the editor can validate/map, the skill can do identically.
//
// DO NOT import `server-only`, DO NOT use `@/` aliases here — Node type-stripping
// must resolve every import at runtime.

import { z } from "zod";
import {
  DEFAULT_AD_CARDS_TEXT,
  DEFAULT_CATEGORY_ORDER,
  DEFAULT_CONTRACT_PREFILL,
  DEFAULT_DELIVERY_MODES_TEXT,
  DEFAULT_FRANCHIZE_BRAND,
  DEFAULT_FRANCHIZE_THEME,
  DEFAULT_LIGHT_THEME_PALETTE,
  DEFAULT_MAP_BOUNDS,
  DEFAULT_MAP_GPS,
  DEFAULT_MAP_IMAGE_URL,
  DEFAULT_MENU_LINK_TEMPLATES,
  DEFAULT_PAYMENT_OPTIONS_TEXT,
  DEFAULT_PROMO_BANNERS_TEXT,
  DEFAULT_SOCIAL_LINKS_TEXT,
  DEFAULT_TELEGRAM_BOT_URL,
} from "../../../lib/franchize-config.ts";

export type UnknownRecord = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Flat editor shape (FranchizeConfigInput) — persisted via saveFranchizeConfig
// ─────────────────────────────────────────────────────────────────────────────

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

/** Contract-defaults + doc-templates read from private crew secrets. */
export interface FranchizeSecrets {
  contractDefaults?: UnknownRecord;
  docTemplates?: UnknownRecord;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Validation schema (single source of truth for both UI and skill)
// ─────────────────────────────────────────────────────────────────────────────

export const franchizeConfigSchema = z.object({
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

export const defaultFranchizeConfig: FranchizeConfigInput = {
  slug: "",
  brandName: DEFAULT_FRANCHIZE_BRAND.brandName,
  tagline: DEFAULT_FRANCHIZE_BRAND.tagline,
  logoUrl: "",
  themeMode: DEFAULT_FRANCHIZE_THEME.mode,
  bgBase: DEFAULT_FRANCHIZE_THEME.palette.bgBase,
  bgCard: DEFAULT_FRANCHIZE_THEME.palette.bgCard,
  accentMain: DEFAULT_FRANCHIZE_THEME.palette.accentMain,
  accentMainHover: DEFAULT_FRANCHIZE_THEME.palette.accentMainHover,
  textPrimary: DEFAULT_FRANCHIZE_THEME.palette.textPrimary,
  textSecondary: DEFAULT_FRANCHIZE_THEME.palette.textSecondary,
  borderSoft: DEFAULT_FRANCHIZE_THEME.palette.borderSoft,
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

export function readPath<T>(obj: unknown, path: string[], fallback: T): T {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return fallback;
    }
    current = (current as UnknownRecord)[key];
  }
  return (current as T) ?? fallback;
}

export function readArrayPath<T>(obj: unknown, path: string[], fallback: T[] = []): T[] {
  const value = readPath<unknown>(obj, path, fallback);
  return Array.isArray(value) ? (value as T[]) : fallback;
}

export function splitCsv(text: string): string[] {
  return text
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeCrewSlug(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/%20/g, " ")
    .replace(/\s+/g, "-")
    .replace(/_+/g, "-")
    .replace(/-+/g, "-");
}

export function withSlug(href: string, slug: string): string {
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
}

export function normalizeCampaignHref(href: string, slug: string): string {
  const clean = href.trim();
  if (!clean) {
    return `/franchize/${slug}#catalog-sections`;
  }

  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("mailto:") || clean.startsWith("tel:")) {
    return clean;
  }

  return withSlug(clean, slug);
}

export function trimCampaignTitle(title: string, fallback: string): string {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}

export function parseMenuLinks(lines: string, slug: string): Array<{ label: string; href: string }> {
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

export function parseSocialLinks(lines: string): Array<{ label: string; href: string }> {
  return lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|").map((value) => value.trim());
      return { label: label || "Social", href: href || DEFAULT_TELEGRAM_BOT_URL };
    });
}

export function parsePromoBanners(lines: string, slug: string): Array<{ id: string; title: string; subtitle: string; code: string; href: string; imageUrl: string; activeFrom: string; activeTo: string; priority: number; ctaLabel: string }> {
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

export function parseAdCards(lines: string, slug: string): Array<{ id: string; title: string; subtitle: string; href: string; imageUrl: string; badge: string; activeFrom: string; activeTo: string; priority: number; ctaLabel: string }> {
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

export function extractFooterSocialLinks(franchize: UnknownRecord, fallbackTelegram: string) {
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

export function extractFooterColumns(franchize: UnknownRecord, slug: string) {
  const rawColumns = readArrayPath<UnknownRecord>(franchize, ["footer", "columns"]);
  if (rawColumns.length === 0) return [];

  const withSlugLocal = (href: string) =>
    href.includes("{slug}") ? href.replaceAll("{slug}", slug) : href;

  return rawColumns.map((col) => ({
    title: readPath(col, ["title"], ""),
    items: (readArrayPath<UnknownRecord>(col, ["items"])).map((item) => ({
      type: readPath(item, ["type"], "text") as "link" | "external" | "text" | "phone",
      label: readPath(item, ["label"], ""),
      value: readPath(item, ["value"], ""),
      href: item.href ? withSlugLocal(readPath(item, ["href"], "")) : undefined,
      icon: readPath(item, ["icon"], ""),
    })),
  })).filter((col) => col.title || col.items.length > 0);
}

export const fallbackMenuLinks = (slug: string) => DEFAULT_MENU_LINK_TEMPLATES.map((link) => ({
  label: link.label,
  href: withSlug(link.href, slug),
}));

export function normalizeCatalogOrder(categories: string[]): string[] {
  const unique = Array.from(new Set(categories.filter(Boolean)));
  const regular = unique.filter((category) => !category.toLowerCase().includes("wbitem"));
  const wbItems = unique.filter((category) => category.toLowerCase().includes("wbitem"));
  return [...regular, ...wbItems];
}

/**
 * Resolve the effective palette for the active theme mode.
 * Inlined here (not imported from theme-resolver) so this module stays free of
 * `@/` aliases and remains importable by the Node skill script.
 */
export function resolvePaletteByMode(franchize: unknown): {
  bgBase: string;
  bgCard: string;
  accentMain: string;
  accentMainHover: string;
  textPrimary: string;
  textSecondary: string;
  borderSoft: string;
} {
  const mode = readPath(franchize, ["theme", "mode"], DEFAULT_FRANCHIZE_THEME.mode);
  const modeStr = String(mode || "").toLowerCase();
  const paletteCandidate = (readPath(franchize, ["theme", "palette"], {}) ?? {}) as UnknownRecord;
  const palettesCandidate = (readPath(franchize, ["theme", "palettes"], {}) ?? {}) as UnknownRecord;

  const modeBucket = modeStr.includes("light") ? "light" : "dark";
  const nestedFromPalettes = (readPath(palettesCandidate, [modeBucket], {}) ?? {}) as UnknownRecord;
  const nestedByMode = (readPath(paletteCandidate, [modeBucket], {}) ?? {}) as UnknownRecord;

  const read = (key: string) => {
    const value = readPath(source, [key], DEFAULT_FRANCHIZE_THEME.palette[key as keyof typeof DEFAULT_FRANCHIZE_THEME.palette]);
    return typeof value === "string" && value.trim().length > 0 ? value : DEFAULT_FRANCHIZE_THEME.palette[key as keyof typeof DEFAULT_FRANCHIZE_THEME.palette];
  };

  const hasModeSpecificPalette = (
    typeof nestedFromPalettes.bgBase === "string" &&
    typeof nestedFromPalettes.bgCard === "string" &&
    typeof nestedFromPalettes.accentMain === "string"
  );

  const explicitFlatPalette = hasModeSpecificPalette
    ? {}
    : (
        typeof paletteCandidate.bgBase === "string" &&
        typeof paletteCandidate.bgCard === "string" &&
        typeof paletteCandidate.accentMain === "string"
      )
      ? paletteCandidate
      : {};

  const source = {
    ...explicitFlatPalette,
    ...nestedFromPalettes,
    ...nestedByMode,
  } as UnknownRecord;

  return {
    bgBase: read("bgBase"),
    bgCard: read("bgCard"),
    accentMain: read("accentMain"),
    accentMainHover: read("accentMainHover"),
    textPrimary: read("textPrimary"),
    textSecondary: read("textSecondary"),
    borderSoft: read("borderSoft"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. configToMetadata — flat editor input → crews.metadata.franchize JSON
//    (mirrors the merge in the former saveFranchizeConfig body)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param input         validated flat config (already passed through franchizeConfigSchema)
 * @param sourceFranchize  existing metadata.franchize (already merged with advancedJson overrides)
 */
export function configToMetadata(input: FranchizeConfigInput, sourceFranchize: UnknownRecord): UnknownRecord {
  const menuLinks = parseMenuLinks(input.menuLinksText, input.slug);
  const isLight = input.themeMode.toLowerCase().includes("light");

  return {
    ...sourceFranchize,
    version: readPath(sourceFranchize, ["version"], "2026-02-19-editor-v2"),
    enabled: readPath(sourceFranchize, ["enabled"], true),
    slug: input.slug,
    branding: {
      ...(readPath(sourceFranchize, ["branding"], {}) as UnknownRecord),
      name: input.brandName,
      tagline: input.tagline,
      logoUrl: input.logoUrl,
    },
    theme: {
      ...(readPath(sourceFranchize, ["theme"], {}) as UnknownRecord),
      mode: input.themeMode,
      palette: {
        ...(readPath(sourceFranchize, ["theme", "palette"], {}) as UnknownRecord),
        bgBase: isLight ? input.lightBgBase : input.bgBase,
        bgCard: isLight ? input.lightBgCard : input.bgCard,
        accentMain: isLight ? input.lightAccentMain : input.accentMain,
        accentMainHover: isLight ? input.lightAccentMainHover : input.accentMainHover,
        textPrimary: isLight ? input.lightTextPrimary : input.textPrimary,
        textSecondary: isLight ? input.lightTextSecondary : input.textSecondary,
        borderSoft: isLight ? input.lightBorderSoft : input.borderSoft,
      },
      palettes: {
        ...(readPath(sourceFranchize, ["theme", "palettes"], {}) as UnknownRecord),
        dark: {
          ...(readPath(sourceFranchize, ["theme", "palettes", "dark"], {}) as UnknownRecord),
          bgBase: input.bgBase,
          bgCard: input.bgCard,
          accentMain: input.accentMain,
          accentMainHover: input.accentMainHover,
          textPrimary: input.textPrimary,
          textSecondary: input.textSecondary,
          borderSoft: input.borderSoft,
        },
        light: {
          ...(readPath(sourceFranchize, ["theme", "palettes", "light"], {}) as UnknownRecord),
          bgBase: input.lightBgBase,
          bgCard: input.lightBgCard,
          accentMain: input.lightAccentMain,
          accentMainHover: input.lightAccentMainHover,
          textPrimary: input.lightTextPrimary,
          textSecondary: input.lightTextSecondary,
          borderSoft: input.lightBorderSoft,
        },
      },
    },
    header: {
      ...(readPath(sourceFranchize, ["header"], {}) as UnknownRecord),
      menuLinks,
    },
    footer: {
      ...(readPath(sourceFranchize, ["footer"], {}) as UnknownRecord),
      phone: input.phone,
      email: input.email,
      address: input.address,
      socialLinks: parseSocialLinks(input.socialLinksText),
    },
    contacts: {
      ...(readPath(sourceFranchize, ["contacts"], {}) as UnknownRecord),
      phone: input.phone,
      email: input.email,
      address: input.address,
      telegram: input.telegram,
      map: {
        ...(readPath(sourceFranchize, ["contacts", "map"], {}) as UnknownRecord),
        gps: input.mapGps,
        imageUrl: input.mapImageUrl,
        bounds: {
          ...(readPath(sourceFranchize, ["contacts", "map", "bounds"], {}) as UnknownRecord),
          top: Number(input.mapBoundsTop),
          bottom: Number(input.mapBoundsBottom),
          left: Number(input.mapBoundsLeft),
          right: Number(input.mapBoundsRight),
        },
      },
    },
    catalog: {
      ...(readPath(sourceFranchize, ["catalog"], {}) as UnknownRecord),
      groupOrder: splitCsv(input.categoryOrderText),
      promoBanners: parsePromoBanners(input.promoBannersText, input.slug),
      adCards: parseAdCards(input.adCardsText, input.slug),
    },
    order: {
      ...(readPath(sourceFranchize, ["order"], {}) as UnknownRecord),
      allowPromo: input.allowPromo,
      deliveryModes: splitCsv(input.deliveryModesText),
      paymentOptions: splitCsv(input.paymentOptionsText),
      defaultMode: input.defaultMode,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. metadataToConfig — crews.metadata.franchize → flat editor input
//    (mirrors the former toFranchizeConfigInput body; secrets passed in, no IO)
// ─────────────────────────────────────────────────────────────────────────────

export function metadataToConfig(metadata: UnknownRecord, crew: UnknownRecord, secrets: FranchizeSecrets = {}): FranchizeConfigInput {
  const franchize = (readPath(metadata, ["franchize"], {}) ?? {}) as UnknownRecord;
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
  const menuLinks = readArrayPath<UnknownRecord>(franchize, ["header", "menuLinks"], fallbackMenuLinks(crew.slug as string)).map((link) => ({
    label: readPath(link, ["label"], "Ссылка"),
    href: withSlug(readPath(link, ["href"], `/franchize/${crew.slug}`), crew.slug as string),
  }));

  const contractDefaults = (secrets.contractDefaults ?? {}) as UnknownRecord;
  const defaults = (readPath(contractDefaults, ["defaults"], {}) ?? {}) as UnknownRecord;
  const docTemplates = (secrets.docTemplates ?? {}) as UnknownRecord;

  return {
    ...defaultFranchizeConfig,
    slug: (crew.slug as string) ?? "",
    brandName: readPath(franchize, ["branding", "name"], (crew.name as string) ?? defaultFranchizeConfig.brandName),
    tagline: readPath(franchize, ["branding", "tagline"], defaultFranchizeConfig.tagline),
    logoUrl: readPath(franchize, ["branding", "logoUrl"], (crew.logo_url as string) ?? "") ?? "",
    themeMode: readPath(franchize, ["theme", "mode"], DEFAULT_FRANCHIZE_THEME.mode),
    bgBase: readPath(themePalette, ["bgBase"], DEFAULT_FRANCHIZE_THEME.palette.bgBase),
    bgCard: readPath(themePalette, ["bgCard"], DEFAULT_FRANCHIZE_THEME.palette.bgCard),
    accentMain: readPath(themePalette, ["accentMain"], DEFAULT_FRANCHIZE_THEME.palette.accentMain),
    accentMainHover: readPath(themePalette, ["accentMainHover"], DEFAULT_FRANCHIZE_THEME.palette.accentMainHover),
    textPrimary: readPath(themePalette, ["textPrimary"], DEFAULT_FRANCHIZE_THEME.palette.textPrimary),
    textSecondary: readPath(themePalette, ["textSecondary"], DEFAULT_FRANCHIZE_THEME.palette.textSecondary),
    borderSoft: readPath(themePalette, ["borderSoft"], DEFAULT_FRANCHIZE_THEME.palette.borderSoft),
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
      .map((entry) => `${readPath(entry, ["label"], "Ссылка")}|${readPath(entry, ["href"], `/franchize/${crew.slug}`)}`)
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. JSON-override parsing (advancedJson / contractDefaultsJson / docTemplatesJson)
// ─────────────────────────────────────────────────────────────────────────────

/** Parse a JSON string into a plain object; returns null when invalid. */
export function parseJsonObject(raw: string): UnknownRecord | null {
  if (!String(raw ?? "").trim()) return null;
  try {
    const parsed = JSON.parse(String(raw)) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as UnknownRecord;
    }
    return null;
  } catch {
    return null;
  }
}

/** Validate the editor's "advancedJson" field. Returns { ok } or { ok, message }. */
export function validateAdvancedJson(json: string): { ok: true } | { ok: false; message: string } {
  if (!json.trim()) return { ok: true };
  const parsed = parseJsonObject(json);
  if (!parsed) return { ok: false, message: "Advanced JSON должен быть валидным JSON-объектом." };
  return { ok: true };
}
