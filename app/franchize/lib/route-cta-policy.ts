export type FranchizeRoutePageIntent =
  | "catalog"
  | "product-buy"
  | "content"
  | "contacts"
  | "checkout"
  | "order"
  | "rental"
  | "map-riders";

export type FranchizeRouteCtaPriority =
  | "cart"
  | "continue-contact"
  | "contact"
  | "form-lifecycle"
  | "map-controls"
  | "content";

export type FloatingCartMode = "enabled" | "if-cart-relevant" | "if-item-context" | "optional" | "disabled";

export interface FranchizeRouteCtaPolicy {
  intent: FranchizeRoutePageIntent;
  priority: FranchizeRouteCtaPriority;
  floatingCartMode: FloatingCartMode;
  /** Padding for Telegram WebApp / mobile bottom bars when the route has bottom CTAs or form actions. */
  pageBottomSafeAreaClassName: string;
  /** Padding for Telegram WebApp / mobile top bars when a route renders sticky chrome. */
  pageTopSafeAreaClassName: string;
  /** Fixed overlay placement that stays above iOS/Telegram bottom safe areas. */
  floatingCartClassName: string;
  /** Routes with forms, lifecycle actions, or maps should not receive bottom overlays. */
  avoidBottomOverlays: boolean;
}

export interface FloatingCartVisibilityContext {
  hasItemContext?: boolean;
  cartRelevant?: boolean;
}

const TELEGRAM_TOP_SAFE_AREA_CLASS = "pt-[calc(0.5rem+env(safe-area-inset-top))]";
const TELEGRAM_BOTTOM_SAFE_AREA_CLASS = "pb-[calc(1.5rem+env(safe-area-inset-bottom))]";
const TELEGRAM_FORM_BOTTOM_SAFE_AREA_CLASS = "pb-[calc(2rem+env(safe-area-inset-bottom))]";

export const FRANCHIZE_HEADER_SAFE_AREA_STYLE = {
  paddingTop: "calc(max(env(safe-area-inset-top), 0px) + 1.45rem)",
  paddingLeft: "calc(max(env(safe-area-inset-left), 0px) + 1rem)",
  paddingRight: "calc(max(env(safe-area-inset-right), 0px) + 1rem)",
} as const;

export const FRANCHIZE_HEADER_CORNER_GUARD_STYLE = {
  paddingInline: "clamp(0.25rem, max(env(safe-area-inset-left), env(safe-area-inset-right)), 1.25rem)",
} as const;

export const FRANCHIZE_MODAL_CLOSE_SAFE_AREA_STYLE = {
  top: "calc(max(env(safe-area-inset-top), 0px) + 0.5rem)",
  right: "calc(max(env(safe-area-inset-right), 0px) + 0.5rem)",
} as const;

export const FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS =
  "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-[60] flex items-center gap-3";

const policiesByIntent: Record<FranchizeRoutePageIntent, Omit<FranchizeRouteCtaPolicy, "intent">> = {
  catalog: {
    priority: "cart",
    floatingCartMode: "enabled",
    pageBottomSafeAreaClassName: TELEGRAM_BOTTOM_SAFE_AREA_CLASS,
    pageTopSafeAreaClassName: TELEGRAM_TOP_SAFE_AREA_CLASS,
    floatingCartClassName: FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS,
    avoidBottomOverlays: false,
  },
  "product-buy": {
    priority: "continue-contact",
    floatingCartMode: "if-cart-relevant",
    pageBottomSafeAreaClassName: TELEGRAM_BOTTOM_SAFE_AREA_CLASS,
    pageTopSafeAreaClassName: TELEGRAM_TOP_SAFE_AREA_CLASS,
    floatingCartClassName: FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS,
    avoidBottomOverlays: false,
  },
  content: {
    priority: "content",
    floatingCartMode: "if-item-context",
    pageBottomSafeAreaClassName: TELEGRAM_BOTTOM_SAFE_AREA_CLASS,
    pageTopSafeAreaClassName: TELEGRAM_TOP_SAFE_AREA_CLASS,
    floatingCartClassName: FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS,
    avoidBottomOverlays: false,
  },
  contacts: {
    priority: "contact",
    floatingCartMode: "optional",
    pageBottomSafeAreaClassName: TELEGRAM_BOTTOM_SAFE_AREA_CLASS,
    pageTopSafeAreaClassName: TELEGRAM_TOP_SAFE_AREA_CLASS,
    floatingCartClassName: FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS,
    avoidBottomOverlays: false,
  },
  checkout: {
    priority: "form-lifecycle",
    floatingCartMode: "disabled",
    pageBottomSafeAreaClassName: TELEGRAM_FORM_BOTTOM_SAFE_AREA_CLASS,
    pageTopSafeAreaClassName: TELEGRAM_TOP_SAFE_AREA_CLASS,
    floatingCartClassName: FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS,
    avoidBottomOverlays: true,
  },
  order: {
    priority: "form-lifecycle",
    floatingCartMode: "disabled",
    pageBottomSafeAreaClassName: TELEGRAM_FORM_BOTTOM_SAFE_AREA_CLASS,
    pageTopSafeAreaClassName: TELEGRAM_TOP_SAFE_AREA_CLASS,
    floatingCartClassName: FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS,
    avoidBottomOverlays: true,
  },
  rental: {
    priority: "form-lifecycle",
    floatingCartMode: "disabled",
    pageBottomSafeAreaClassName: TELEGRAM_FORM_BOTTOM_SAFE_AREA_CLASS,
    pageTopSafeAreaClassName: TELEGRAM_TOP_SAFE_AREA_CLASS,
    floatingCartClassName: FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS,
    avoidBottomOverlays: true,
  },
  "map-riders": {
    priority: "map-controls",
    floatingCartMode: "disabled",
    pageBottomSafeAreaClassName: TELEGRAM_FORM_BOTTOM_SAFE_AREA_CLASS,
    pageTopSafeAreaClassName: TELEGRAM_TOP_SAFE_AREA_CLASS,
    floatingCartClassName: FRANCHIZE_FLOATING_CART_SAFE_AREA_CLASS,
    avoidBottomOverlays: true,
  },
};

export function getFranchizeRouteCtaPolicy(intent: FranchizeRoutePageIntent): FranchizeRouteCtaPolicy {
  return { intent, ...policiesByIntent[intent] };
}

export function shouldShowFloatingCart(
  policy: FranchizeRouteCtaPolicy,
  context: FloatingCartVisibilityContext = {},
) {
  switch (policy.floatingCartMode) {
    case "enabled":
      return true;
    case "if-cart-relevant":
      return Boolean(context.cartRelevant || context.hasItemContext);
    case "if-item-context":
      return Boolean(context.hasItemContext);
    case "optional":
      return Boolean(context.cartRelevant);
    case "disabled":
    default:
      return false;
  }
}
