// app/franchize/lib/analytics-owner-cookie.ts
//
// TASK159 (boss 2026-10-28) — «kinda auth» для ПК-зрителя аналитики.
//
// Проблема: пароль аналитики (/analytics_pass) жил только в sessionStorage
// клиента, поэтому страница аренды /franchize/<slug>/rental/<id> (серверный
// компонент) не видела сессию — карточка «Сверка комиссии» с КОММЕНТАРИЕМ
// по сверке не рендерилась на ПК без Telegram.
//
// Решение: validateAnalyticsPassword при успехе ставит httpOnly cookie с
// подписью HMAC (секрет = SUPABASE_SERVICE_ROLE_KEY, серверный). Страница
// аренды читает cookie, проверяет подпись/срок и СНОВА гейтит владельца по
// БД (actor — владелец именно этого экипажа / глобальный админ), после чего
// рендерит карточку сверки с passwordAuthOwnerId (сервер-экшены карточки
// дополнительно перепроверяют claimed id). Cookie один на экипаж; пароли
// сами истекают в analytics_passwords, cookie — независимо, 30 дней.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-server";

export const ANALYTICS_OWNER_COOKIE = "vb_analytics_owner";
/** 30 дней — комфорт для ПК владельца; пароли аналитики истекают сами. */
const COOKIE_TTL_MS = 30 * 24 * 3600 * 1000;

function hmacSecret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || "vb-analytics-owner-fallback";
}

function sign(payload: string): string {
  return createHmac("sha256", hmacSecret()).update(payload).digest("base64url");
}

/** Значение cookie: `${ownerId}|${slug}|${expEpochMs}` + подпись. */
export function buildAnalyticsOwnerCookieValue(ownerId: string, slug: string): {
  value: string;
  maxAgeSeconds: number;
} {
  const exp = Date.now() + COOKIE_TTL_MS;
  const payload = `${ownerId}|${slug}|${exp}`;
  return {
    value: `${Buffer.from(payload, "utf8").toString("base64url")}.${sign(payload)}`,
    maxAgeSeconds: Math.floor(COOKIE_TTL_MS / 1000),
  };
}

/** Проверка подписи и срока; slug обязан совпасть. null = нет/просрочена/чужая. */
export function verifyAnalyticsOwnerCookieValue(
  value: string | undefined | null,
  slug: string,
): { ownerId: string; slug: string } | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const b64 = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const [ownerId, cookieSlug, expRaw] = payload.split("|");
  if (!ownerId || !cookieSlug || !expRaw) return null;
  if (cookieSlug !== slug) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return { ownerId, slug: cookieSlug };
}

/**
 * Полный гейт для серверного компонента: cookie валидна И её владелец —
 * владелец этого экипажа (или глобальный админ). Возвращает ownerId для
 * passwordAuthOwnerId-пропов, null — если сессии нет.
 */
export async function resolveAnalyticsPasswordOwnerForSlug(
  slug: string,
): Promise<string | null> {
  try {
    const raw = (await cookies()).get(ANALYTICS_OWNER_COOKIE)?.value;
    const parsed = verifyAnalyticsOwnerCookieValue(raw, slug);
    if (!parsed) return null;
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew) return null;
    if (crew.owner_id === parsed.ownerId) return parsed.ownerId;
    // Глобальный админ (тот же допуск, что у verifyPasswordAuthOwner).
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("role, status, metadata")
      .eq("user_id", parsed.ownerId)
      .maybeSingle();
    if (!user) return null;
    const meta = (user.metadata || {}) as Record<string, unknown>;
    if (
      user.role === "admin" ||
      user.role === "vprAdmin" ||
      user.status === "admin" ||
      meta?.role === "admin" ||
      meta?.status === "admin"
    ) {
      return parsed.ownerId;
    }
    return null;
  } catch {
    return null;
  }
}
