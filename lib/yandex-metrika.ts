import { attributionForEvent, type MarketingAttribution } from "./marketing-attribution";

export const VIP_BIKE_METRIKA_COUNTER_ID = 110479791;

export const VIP_BIKE_METRIKA_GOALS = {
  catalogOpen: "rental_catalog_open",
  bikeConfigured: "rental_bike_configured",
  callbackFormView: "rental_callback_form_view",
  callbackFormStart: "rental_callback_form_start",
  callbackSubmitAttempt: "rental_callback_submit_attempt",
  leadDbSuccess: "lead_db_success",
  leadSubmitSuccess: "lead_submit_success",
  leadSubmitError: "lead_submit_error",
  telegramContinue: "rental_telegram_continue",
} as const;

export type VipBikeMetrikaGoal =
  (typeof VIP_BIKE_METRIKA_GOALS)[keyof typeof VIP_BIKE_METRIKA_GOALS];

declare global {
  interface Window {
    ym?: ((counterId: number, method: string, ...args: unknown[]) => void) & {
      a?: unknown[];
      l?: number;
    };
    __vipBikeMetrikaInitialized?: boolean;
    __vipBikeMetrikaLastUrl?: string;
  }
}

export function isVipBikeTrackingHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "rental.vip-bike.ru" || normalized === "www.rental.vip-bike.ru";
}

export function reachVipBikeGoal(
  goal: VipBikeMetrikaGoal,
  params: Record<string, unknown> = {},
  attribution: MarketingAttribution | null = null,
) {
  if (typeof window === "undefined" || !isVipBikeTrackingHost(window.location.hostname)) return;
  window.ym?.(VIP_BIKE_METRIKA_COUNTER_ID, "reachGoal", goal, {
    ...attributionForEvent(attribution),
    ...params,
  });
}
