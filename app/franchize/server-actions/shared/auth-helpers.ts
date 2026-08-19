// app/franchize/server-actions/shared/auth-helpers.ts
/**
 * Shared authentication and authorization helpers for I5 server actions.
 * Extracted from equipment-rentals, cash-transactions, commissions, and salary-calculations
 * to eliminate duplication and ensure consistency.
 */

import { supabaseAdmin } from "@/lib/supabase-server";

/**
 * Result of crew access verification.
 * Consolidates all variations used across I5 server actions.
 */
export interface CrewAccessResult {
  allowed: boolean;
  crewId?: string;
  actorUserId?: string;
  isOwner?: boolean;
  error?: string;
}

/**
 * Verifies that the current user has access to the specified crew.
 *
 * This is the unified auth helper for I5 server actions. It:
 * - Validates Telegram actor cookie
 * - Checks if user is admin (global access)
 * - Checks if user is crew owner (full access)
 * - Checks if user is active crew member (read access)
 *
 * @param slug - The crew slug to verify access for
 * @returns CrewAccessResult with access status and user/crew IDs
 *
 * @example
 * ```ts
 * const access = await verifyCrewAccess("my-crew");
 * if (!access.allowed) {
 *   return { success: false, error: access.error };
 * }
 * // Use access.crewId and access.actorUserId for queries
 * ```
 */
export async function verifyCrewAccess(
  slug: string,
): Promise<CrewAccessResult> {
  const { cookies } = await import("next/headers");
  const { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } = await import("@/lib/telegram-actor-cookie");

  const cookieUserId = verifyTelegramActorCookieValue(
    (await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (!cookieUserId) {
    return { allowed: false, error: "Не авторизовано." };
  }

  try {
    // Check if user is admin
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin" || userMetadata?.status === "admin";

    // Get crew details
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!crew) {
      return { allowed: false, error: "Экипаж не найден." };
    }

    // Active crew member has limited access (owner, admin, co_owner get full access)
    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", crew.id)
      .eq("user_id", cookieUserId)
      .maybeSingle();

    // Owner or admin has full access
    const isOwner = crew.owner_id === cookieUserId || isAdmin;
    const isCoOwner = membership?.membership_status === "active" && ["co_owner", "admin"].includes(membership?.role || "");

    if (isOwner || isCoOwner) {
      return {
        allowed: true,
        crewId: crew.id,
        actorUserId: cookieUserId,
        isOwner: true
      };
    }

    // Regular active crew member has limited access
    if (membership?.membership_status === "active") {
      return {
        allowed: true,
        crewId: crew.id,
        actorUserId: cookieUserId,
        isOwner: false
      };
    }

    return { allowed: false, error: "Недостаточно прав." };
  } catch (error) {
    // Log but don't expose internal errors
    console.error("[verifyCrewAccess] Auth check failed:", error);
    return { allowed: false, error: "Ошибка проверки доступа." };
  }
}

/**
 * Type-safe error handler for server action catch blocks.
 * Replaces the common `err?.message || "Unknown error."` pattern.
 *
 * @param error - The caught error object
 * @param context - Context for logging (e.g., function name)
 * @returns Safe error message for client response
 */
export function handleError(error: unknown, context: string): string {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  console.error(`[${context}] Exception:`, error);
  return errorMessage;
}

/**
 * Standard success response type for all I5 server actions.
 */
export interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Standard success response factory.
 * Properly preserves generic type information for type-safe responses.
 */
export function successResponse<T = unknown>(data?: T): ActionResponse<T> {
  return { success: true, data };
}

/**
 * Standard error response factory.
 */
export function errorResponse(error: string): ActionResponse {
  return { success: false, error };
}

// ─── Period normalization helpers (2026-08-19 review) ───────────────────────
//
// Throughout the salary subsystem, server actions accept `from` / `to` params
// that may be either date-only ("2026-08-19") or full ISO strings
// ("2026-08-19T20:59:59.999Z", already adjusted to Moscow end-of-day by the
// client).
//
// Previously the server did `new Date(to); toDate.setHours(23, 59, 59, 999)`
// to "extend to end of day" — but `setHours` uses the server's local TZ. On
// a Vercel deployment (UTC server) for a Moscow user, this silently shifted
// the boundary by ±3 hours and either dropped or included the wrong shifts.
//
// These helpers:
//   - If the input is date-only (YYYY-MM-DD), extend to start/end-of-day in
//     UTC. The user's actual TZ is the server's responsibility to know
//     (Europe/Moscow in this codebase per `user.timezone` config), but since
//     our DB stores `timestamptz`, querying in UTC +0 / UTC +23:59:59 is
//     equivalent to "the entire day in any TZ" when the comparison is purely
//     on the time axis.
//   - If the input already has time info, use as-is — the caller has already
//     done the timezone math.

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePeriodStart(from: string): string {
  if (!from) return from;
  if (DATE_ONLY_RE.test(from)) {
    return `${from}T00:00:00.000Z`;
  }
  // Already a full ISO / has time component — use as-is.
  return new Date(from).toISOString();
}

export function normalizePeriodEnd(to: string): string {
  if (!to) return to;
  if (DATE_ONLY_RE.test(to)) {
    return `${to}T23:59:59.999Z`;
  }
  return new Date(to).toISOString();
}