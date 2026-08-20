import type { FranchizeCrewVM } from "@/app/franchize/actions";
import { DEFAULT_FRANCHIZE_CONTENT_BLOCKS } from "@/app/franchize/lib/content-blocks";

/**
 * Fallback crew object used by admin & dashboard clients
 * when crew data is not yet loaded from server.
 */
export const fallbackCrew: FranchizeCrewVM = {
  id: "",
  slug: "vip-bike",
  name: "VIP BIKE",
  description: "Crew admin panel",
  logoUrl: "",
  hqLocation: "",
  isFound: false,
  theme: {
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
  },
  header: {
    brandName: "VIP BIKE",
    tagline: "Ride the vibe",
    logoUrl: "",
    logoHref: "",
    menuLinks: [],
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
      bounds: { top: 0, bottom: 0, left: 0, right: 0 },
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
  footer: { socialLinks: [], columns: [], textColor: "#16130A" },
  // 2026-08-19 review: the FranchizeCrewVM interface was extended to
  // require reservationHold, contentBlocks, and cta — but the fallbackCrew
  // constant hadn't been updated, so ProfileClient (and other consumers)
  // silently failed the typecheck. Use the canonical defaults.
  reservationHold: {
    amountRub: 0,
    amountXtr: 0,
    percent: null,
    label: "",
    invoiceLabel: "",
    pickupAddress: "",
    requiredDocs: [],
  },
  contentBlocks: DEFAULT_FRANCHIZE_CONTENT_BLOCKS,
  cta: {
    title: "",
    description: "",
    buttonLabel: "",
    buttonHref: "",
  },
};
