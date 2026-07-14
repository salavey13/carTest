// app/api/franchize/_auth.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Verify that the request comes from an authenticated crew member.
 * Checks for either:
 * - Telegram WebApp auth (x-telegram-user-id header) — admin or active crew member
 * - Password auth (x-auth-password header matching crew analytics password)
 */
export async function verifyCrewAccess(
  request: NextRequest,
  crewId?: string
): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  // 1. Check Telegram user ID header
  const telegramUserId = request.headers.get("x-telegram-user-id");
  if (telegramUserId) {
    // Check if user is admin
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("role, status")
      .eq("user_id", telegramUserId)
      .maybeSingle();

    if (user?.status === "admin" || user?.role === "admin" || user?.role === "vprAdmin") {
      return { ok: true, userId: telegramUserId };
    }

    // Check crew membership if crewId provided
    if (crewId) {
      const { data: member } = await supabaseAdmin
        .from("crew_members")
        .select("role")
        .eq("crew_id", crewId)
        .eq("user_id", telegramUserId)
        .eq("membership_status", "active")
        .maybeSingle();

      if (member) {
        return { ok: true, userId: telegramUserId };
      }
    }

    // No crewId specified — accept any known user (non-strict mode)
    if (!crewId && user) {
      return { ok: true, userId: telegramUserId };
    }

    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Нет доступа" }, { status: 403 }),
    };
  }

  // 2. Check password auth header (franchize admin pages pattern)
  const authPassword = request.headers.get("x-auth-password");
  if (authPassword) {
    const { data: passwords } = await supabaseAdmin
      .from("analytics_passwords")
      .select("password, crew_id");

    if (passwords?.some((p: { password: string }) => p.password === authPassword)) {
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
