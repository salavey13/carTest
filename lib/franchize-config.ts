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

export type FranchizeShowcaseGroup = {
  id: string;
  label: string;
  mode: "subtype" | "price";
  subtype?: string;
  minPrice?: number;
  maxPrice?: number;
};

export const DEFAULT_FRANCHIZE_THEME: FranchizeTheme = {
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

export const DEFAULT_LIGHT_THEME_PALETTE: FranchizeTheme["palette"] = {
  bgBase: "#F6F6F7",
  bgCard: "#FFFFFF",
  accentMain: "#C78900",
  accentMainHover: "#D99A00",
  textPrimary: "#1A1B1F",
  textSecondary: "#4B5160",
  borderSoft: "#D4D8E1",
};

export const DEFAULT_FRANCHIZE_BRAND = {
  brandName: "VIP BIKE",
  tagline: "Ride the vibe",
} as const;

export const DEFAULT_TELEGRAM_BOT_URL = "https://t.me/oneBikePlsBot";
export const DEFAULT_SOCIAL_LINKS_TEXT = `Telegram|${DEFAULT_TELEGRAM_BOT_URL}`;

export const DEFAULT_MAP_GPS = "56.20420451632873, 43.798582127051695";
export const DEFAULT_MAP_IMAGE_URL = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg";
export const DEFAULT_MAP_BOUNDS = {
  top: 56.42,
  bottom: 56.08,
  left: 43.66,
  right: 44.12,
} as const;

export const DEFAULT_MENU_LINK_TEMPLATES = [
  { label: "Каталог", href: "/franchize/{slug}" },
  { label: "Электроэндуро", href: "/franchize/{slug}/electro-enduro" },
  { label: "Конфигуратор", href: "/franchize/{slug}/configurator" },
  { label: "Map Riders", href: "/franchize/{slug}/map-riders" },
  { label: "О нас", href: "/franchize/{slug}/about" },
  { label: "Контакты", href: "/franchize/{slug}/contacts" },
  { label: "Корзина", href: "/franchize/{slug}/cart" },
] as const;

export const DEFAULT_CATEGORY_ORDER = "Naked, Supersport, Touring, Neo-retro";
export const DEFAULT_PROMO_BANNERS_TEXT = "weekend-boost|Weekend boost|Скидка 10% на выходные|WEEKEND10|/franchize/{slug}#catalog-sections||2026-02-01|2026-12-31|90|Забрать скидку";
export const DEFAULT_AD_CARDS_TEXT = "safety-kit|Экипировка PRO|Подбор шлема и защиты перед выдачей|/franchize/{slug}/about||Safety|2026-02-01|2026-12-31|70|Смотреть детали";
export const DEFAULT_DELIVERY_MODES_TEXT = "pickup, delivery";
export const DEFAULT_PAYMENT_OPTIONS_TEXT = "telegram_xtr, card, sbp, cash";
export const DEFAULT_CONTRACT_PREFILL = {
  includedMileage: "200",
  overageRateRub: "30",
  bikeValueRub: "700000",
  bikeValueWords: "Семьсот тысяч",
  lateReturnPenaltyRub: "5000",
  returnAddress: "г. Нижний Новгород, ул. Стригинский переулок, дом 13б",
} as const;

export const DEFAULT_SHOWCASE_GROUPS: FranchizeShowcaseGroup[] = [
  { id: "sweetspot-6000", label: "Все по 6000", mode: "price", minPrice: 5600, maxPrice: 6400 },
];

export const DEFAULT_FOOTER_TEXT_COLOR = "#16130A";
