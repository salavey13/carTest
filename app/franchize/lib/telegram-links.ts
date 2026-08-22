// Fallback to environment variable or empty (requires explicit bot username)
export const DEFAULT_TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME
  ? sanitizeTelegramUsername(process.env.TELEGRAM_BOT_USERNAME)
  : "";

function sanitizeTelegramUsername(value?: string | null): string {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "");
}

export function getTelegramHandleHref(handle?: string | null): string {
  const normalized =
    sanitizeTelegramUsername(handle) || DEFAULT_TELEGRAM_BOT_USERNAME;

  return `https://t.me/${normalized}`;
}

export function getTelegramWebAppFallbackHref(
  prefix: string,
  value: string,
  botUsername?: string | null,
  separator: "-" | "_" | "/" = "/",
): string {
  const normalizedBot =
    sanitizeTelegramUsername(botUsername) || DEFAULT_TELEGRAM_BOT_USERNAME;
  const safePrefix =
    prefix.replace(/[^a-zA-Z0-9_/-]/g, "-").slice(0, 24) || "franchize";
  const safeValue =
    value.replace(/[^a-zA-Z0-9_/-]/g, "-").slice(0, 40) || "open";

  return `https://t.me/${normalizedBot}/app?startapp=${safePrefix}${separator}${safeValue}`;
}

/**
 * Build a Telegram WebApp deep-link that routes to a specific franchize page
 * via StartParamRouter. Returns empty string if no bot username is available.
 *
 * Used for "open in TG" buttons that should navigate to e.g. profile, order, etc.
 * inside the Telegram WebApp context.
 */
export function getTelegramWebAppPageHref(
  pagePath: string,
  botUsername?: string | null,
): string {
  const normalizedBot = sanitizeTelegramUsername(botUsername) || DEFAULT_TELEGRAM_BOT_USERNAME;
  if (!normalizedBot) return "";
  // Strip leading slash and encode for startapp param
  const cleanPath = pagePath.replace(/^\/+/, "");
  return `https://t.me/${normalizedBot}/app?startapp=${encodeURIComponent(cleanPath)}`;
}

/**
 * Detect desktop browser from user agent string.
 * Used to choose between t.me deep link (mobile → opens Telegram app)
 * and web.telegram.org (desktop → opens Telegram Web).
 */
export function isDesktopBrowser(userAgent?: string): boolean {
  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
  if (!ua) return false;
  const mobileIndicators = /Mobile|Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i;
  return !mobileIndicators.test(ua);
}

/**
 * Build a Telegram WebApp href that adapts to the device.
 * - Mobile: `https://t.me/<bot>/app?startapp=<value>` (opens Telegram app)
 * - Desktop: `https://web.telegram.org/a/#<bot>?startapp=<value>` (opens Telegram Web)
 */
export function getTelegramWebAppAdaptiveHref(
  startappValue: string,
  botUsername?: string | null,
  userAgent?: string,
): string {
  const normalizedBot = sanitizeTelegramUsername(botUsername) || DEFAULT_TELEGRAM_BOT_USERNAME;
  if (!normalizedBot) return "";
  const encodedValue = encodeURIComponent(startappValue);
  if (isDesktopBrowser(userAgent)) {
    return `https://web.telegram.org/a/#${normalizedBot}?startapp=${encodedValue}`;
  }
  return `https://t.me/${normalizedBot}/app?startapp=${encodedValue}`;
}
