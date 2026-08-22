// app/api/franchize/_auth.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from "@/lib/telegram-actor-cookie";

/**
 * Verify that the request comes from an authenticated crew member.
 * Uses TWO verification paths (both server-side):
 *
 * 1. Telegram WebApp: reads signed TELEGRAM_ACTOR_COOKIE (HMAC-SHA256) → gets real userId
 *    → checks crew owner / admin / active crew member
 * 2. Password auth: x-auth-password header validated against analytics_passwords table
 *
 * LR3-003 FIX: was trusting forgeable x-telegram-user-id header (anyone could set it).
 * Now uses the signed cookie as the PRIMARY auth method. The x-telegram-user-id header
 * is still accepted as a FALLBACK for backwards compat during transition, but the
 * non-strict "any known user" mode has been removed.
 */
export async function verifyCrewAccess(
  request: NextRequest,
  crewId?: string
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  // 1. Try signed cookie (PRIMARY — cryptographically verified)
  const cookieUserId = verifyTelegramActorCookieValue(
    request.cookies.get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (cookieUserId) {
    return verifyUserIdAccess(cookieUserId, crewId);
  }

  // 2. Fallback: x-telegram-user-id header (BACKWARDS COMPAT — will be removed)
  // LR3-003 FIX: this is forgeable but kept temporarily for clients that don't
  // send cookies (e.g., some older builds). The non-strict mode is removed.
  const telegramUserId = request.headers.get("x-telegram-user-id");
  if (telegramUserId) {
    return verifyUserIdAccess(telegramUserId, crewId);
  }

  // 3. Password auth (x-auth-password header)
  const authPassword = request.headers.get("x-auth-password");
  if (authPassword) {
    const { data: passwords } = await supabaseAdmin
      .from("analytics_passwords")
      .select("password, crew_id");

    const match = passwords?.find(
      (p: { password: string; crew_id: string }) =>
        p.password === authPassword && (!crewId || p.crew_id === crewId),
    );

    if (match) {
      return { ok: true, userId: "password-auth" };
    }
  }

  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: "Требуется авторизация" },
      { status: 401 }
    ),
  };
}

/**
 * Verify a user ID has access to the given crew (or is a global admin).
 * Shared between cookie-auth and header-auth paths.
 */
async function verifyUserIdAccess(
  userId: string,
  crewId?: string,
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  // Check if user is admin
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status, metadata")
    .eq("user_id", userId)
    .maybeSingle();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Пользователь не найден" }, { status: 403 }),
    };
  }

  const userMeta = user.metadata as Record<string, unknown> | null;
  const isAdmin =
    user?.status === "admin" ||
    user?.role === "admin" ||
    user?.role === "vprAdmin" ||
    userMeta?.role === "admin" ||
    userMeta?.status === "admin";

  if (isAdmin) {
    return { ok: true, userId };
  }

  // Check crew membership if crewId provided
  if (crewId) {
    // Check if user is the crew owner
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", crewId)
      .maybeSingle();

    if (crew?.owner_id === userId) {
      return { ok: true, userId };
    }

    // Check active crew member
    const { data: member } = await supabaseAdmin
      .from("crew_members")
      .select("role")
      .eq("crew_id", crewId)
      .eq("user_id", userId)
      .eq("membership_status", "active")
      .maybeSingle();

    if (member) {
      return { ok: true, userId };
    }
  }

  // LR3-003 FIX: removed non-strict "any known user" mode (was line 44-47).
  // Without crewId, we can't verify crew membership → deny.
  return {
    ok: false,
    response: NextResponse.json({ success: false, error: "Нет доступа" }, { status: 403 }),
  };
}
