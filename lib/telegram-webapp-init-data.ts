// lib/telegram-webapp-init-data.ts
//
// Client-side helper: read the raw Telegram WebApp initData query string so
// server actions can HMAC-verify the actor when the signed actor cookie is
// unavailable (Telegram Web on desktop, Safari blocking third-party cookies).
//
// SECURITY NOTE: the raw string is signed by Telegram — the SERVER verifies
// its HMAC-SHA256 against the bot token (lib/telegram-webapp-auth.ts) and
// requires the claimed actorUserId to match the signed user. The raw string
// is never trusted by itself.

/** Returns the Telegram WebApp initData string, or null outside Telegram. */
export function getTelegramInitData(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.Telegram?.WebApp?.initData;
    return typeof raw === "string" && raw.length > 0 ? raw : undefined;
  } catch {
    // Safari can throw when accessing WebApp getters on a Proxy.
    return undefined;
  }
}
