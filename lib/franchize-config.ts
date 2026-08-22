export interface FranchizeTheme {
  mode: string;
  isAuto?: boolean; // When true, palette should respond to global theme preference
  palette: {
    bgBase: string;
    bgCard: string;
    accentMain: string;
    accentMainHover: string;
    textPrimary: string;
    textSecondary: string;
    borderSoft: string;
  };
  palettes?: {
    light?: {
      bgBase: string;
      bgCard: string;
      accentMain: string;
      accentMainHover: string;
      textPrimary: string;
      textSecondary: string;
      borderSoft: string;
    };
    dark?: {
      bgBase: string;
      bgCard: string;
      accentMain: string;
      accentMainHover: string;
      textPrimary: string;
      textSecondary: string;
      borderSoft: string;
    };
  };
}

export type FranchizeShowcaseGroup = {
  id: string;
  label: string;
  mode: "subtype" | "price";
  subtype?: string;
  minPrice?: number;
  maxPrice?: number;
};

// DEFAULT_FRANCHIZE_THEME — the fallback palette used when a crew has no
// theme metadata, and the value returned by getEarlyFranchizeThemeHint()
// before the full crew row is fetched.
//
// Seeded from vip-bike's dark palette (docs/sql/vip-bike-franchize-hydration.sql
// → theme.palettes.dark). vip-bike is the primary tenant on rental.vip-bike.ru
// (next.config rewrites "/" → "/franchize/vip-bike"), so making the default
// match its dark variant means:
//   • the SSR/early-hint colors equal the final colors for the main tenant,
//     eliminating the "strange default colors → real palette" flash;
//   • other tenants (svarprofi, …) still override this via their own SQL
//     metadata — the resolver reads from there and only falls back here.
//
// NOTE: keep these values in sync with the `:root`/`.dark` --franchize-*
// defaults in app/globals.css (the CSS-level fallback for the very first
// paint of isAuto crew pages, before useFranchizeTheme hydrates).
export const DEFAULT_FRANCHIZE_THEME: FranchizeTheme = {
  mode: "vip_bike_dark",
  palette: {
    bgBase: "#0A0A0A",
    bgCard: "#1A1A1A",
    accentMain: "#FFD700",
    accentMainHover: "#FFC125",
    textPrimary: "#FFFAF0",
    textSecondary: "#D4AF37",
    borderSoft: "#2A2A2A",
  },
};

export const DEFAULT_LIGHT_THEME_PALETTE: FranchizeTheme["palette"] = {
  bgBase: "#F6F6F7",
  bgCard: "#FFFFFF",
  accentMain: "#C78900",
  accentMainHover: "#D99A00",
  textPrimary: "#1A1B1F",
  textSecondary: "#4B5160",
  borderSoft: "#D4D8E1",
};

// FIX: De-biked default brand. Was "VIP BIKE" / "Ride the vibe" — now generic.
// Actual brand/tagline is hydrated from crew metadata in SQL.
// These defaults only apply when creating a NEW crew with no branding.
export const DEFAULT_FRANCHIZE_BRAND = {
  brandName: "Экипаж",
  tagline: "Витрина экипажа",
} as const;

// FIX: De-biked default bot URL. Was hardcoded to oneBikePlsBot.
// Actual bot URL is hydrated from crew metadata. Empty string means
// "no bot configured" — the UI should hide/show the Telegram CTA accordingly.
export const DEFAULT_TELEGRAM_BOT_URL = "";
export const DEFAULT_SOCIAL_LINKS_TEXT = `Telegram|${DEFAULT_TELEGRAM_BOT_URL}`;

// FIX: De-biked map defaults. Was hardcoded to VIP BIKE's Nizhny Novgorod location.
// Actual map data is hydrated from crew metadata. Empty/0 defaults mean
// "no map configured" — the UI should hide the map section accordingly.
export const DEFAULT_MAP_GPS = "";
export const DEFAULT_MAP_IMAGE_URL = "";
export const DEFAULT_MAP_BOUNDS = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
} as const;

// FIX: De-biked menu links. Removed bike-specific items ("Электроэндуро",
// "Конфигуратор", "Map Riders"). These should come from crew metadata.
// Only universal links remain as defaults.
export const DEFAULT_MENU_LINK_TEMPLATES = [
  { label: "Каталог", href: "/franchize/{slug}" },
  { label: "О нас", href: "/franchize/{slug}/about" },
  { label: "Контакты", href: "/franchize/{slug}/contacts" },
  { label: "Корзина", href: "/franchize/{slug}/cart" },
] as const;

// FIX: De-biked category order. Was "Naked, Supersport, Touring, Neo-retro"
// (motorcycle types). Now empty — categories come from crew metadata.
export const DEFAULT_CATEGORY_ORDER = "";

// FIX: De-biked promo/ad text. Was bike-specific promos. Now empty —
// campaigns come from crew metadata.
export const DEFAULT_PROMO_BANNERS_TEXT = "";
export const DEFAULT_AD_CARDS_TEXT = "";
export const DEFAULT_DELIVERY_MODES_TEXT = "pickup, delivery";
export const DEFAULT_PAYMENT_OPTIONS_TEXT = "telegram_xtr, card, sbp, cash";

// FIX: De-biked contract prefill. Was bike-specific (байк, motorcycle values).
// Now uses generic terminology. Actual contract data comes from crew metadata.
export const DEFAULT_CONTRACT_PREFILL = {
  includedMileage: "200",
  overageRateRub: "30",
  bikeValueRub: "700000",
  bikeValueWords: "Семьсот тысяч",
  lateReturnPenaltyRub: "5000",
  returnAddress: "",
} as const;

// FIX: De-biked showcase groups. Was bike-specific price range.
// Now empty — showcase groups come from crew metadata.
export const DEFAULT_SHOWCASE_GROUPS: FranchizeShowcaseGroup[] = [];

export const DEFAULT_FOOTER_TEXT_COLOR = "#16130A";