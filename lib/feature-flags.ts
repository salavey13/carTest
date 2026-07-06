/**
 * Feature flags — deployment-aware toggles.
 * 
 * The rental repo deploys to TWO environments:
 *   1. Vercel (v0-car-test.vercel.app) — Telegram webhook, full auth, all features
 *   2. VPS (rental.vip-bike.ru) — no Telegram (blocked in RF), password-auth only
 * 
 * Some features only make sense with Telegram auth (cart, orders, profile).
 * These are hidden on VPS to avoid dead-end UX.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

/**
 * True when deployed on Vercel (Telegram auth available).
 * False on VPS (no Telegram, password auth only).
 */
export const IS_TELEGRAM_AUTH_AVAILABLE: boolean = 
  SITE_URL.includes('vercel.app') || 
  (!SITE_URL.includes('rental.vip-bike.ru') && SITE_URL !== '');

/**
 * True when running on VPS production (rental.vip-bike.ru).
 */
export const IS_VPS_DEPLOYMENT: boolean = 
  SITE_URL.includes('rental.vip-bike.ru');

/**
 * Whether to show cart-related UI (cart icon, floating cart, cart menu link).
 * Enabled for all deployments — cart works in both Telegram and web app contexts.
 */
export const SHOW_CART: boolean = true;
