import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

export const TELEGRAM_ACTOR_COOKIE = "cartest_tg_actor";
const DEFAULT_MAX_AGE_SECONDS = 6 * 60 * 60;

type TelegramActorCookiePayload = {
  userId: string;
  exp: number;
};

function getCookieSecret() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createTelegramActorCookieValue(
  userId: string,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
) {
  const secret = getCookieSecret();
  if (!secret) return null;

  const payload = base64UrlEncode(
    JSON.stringify({
      userId: String(userId),
      exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
    } satisfies TelegramActorCookiePayload),
  );
  const signature = signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export function verifyTelegramActorCookieValue(
  value: string | undefined | null,
) {
  const secret = getCookieSecret();
  if (!secret || !value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = signPayload(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      base64UrlDecode(payload),
    ) as Partial<TelegramActorCookiePayload>;
    if (!parsed.userId || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return String(parsed.userId);
  } catch {
    return null;
  }
}

export const TELEGRAM_ACTOR_COOKIE_MAX_AGE_SECONDS = DEFAULT_MAX_AGE_SECONDS;
