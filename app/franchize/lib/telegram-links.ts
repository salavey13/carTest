export const DEFAULT_TELEGRAM_BOT_USERNAME = "oneBikePlsBot";

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
): string {
  const normalizedBot =
    sanitizeTelegramUsername(botUsername) || DEFAULT_TELEGRAM_BOT_USERNAME;
  const safePrefix =
    prefix.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 24) || "franchize";
  const safeValue =
    value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40) || "open";

  return `https://t.me/${normalizedBot}/app?startapp=${safePrefix}-${safeValue}`;
}
