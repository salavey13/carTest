"use server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { cookies } from "next/headers";
import { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } from "@/lib/telegram-actor-cookie";
import { DISMISS_REASONS } from "@/app/franchize/[slug]/leads/lib/dismiss-reasons";

export interface DismissLeadInput {
  slug: string;
  leadId: string;
  reason: string;
  note?: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
}

// ── Auth helper (same secure pattern as leads.ts) ────────────────────────────
// LR3-001 FIX: was NO auth at all — anyone could dismiss any lead in any crew.
// Now: verifies caller identity via signed cookie (Telegram) or crew ownership (password).
async function verifyDismissAccess(
  slug: string,
  actorUserId?: string,
  isPasswordAuth?: boolean,
): Promise<{ allowed: boolean; error?: string }> {
  // Path 1: Telegram WebApp — read signed cookie
  const cookieUserId = verifyTelegramActorCookieValue(
    (await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (cookieUserId) {
    // Fetch crew by slug
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!crew) return { allowed: false, error: "Экипаж не найден." };

    const isOwner = crew.owner_id === cookieUserId;

    // Check admin
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();
    const userMeta = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMeta?.role === "admin" || userMeta?.status === "admin";

    // Check active crew member
    const { data: member } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crew.id)
      .eq("user_id", cookieUserId)
      .eq("membership_status", "active")
      .maybeSingle();
    const isMember = !!member;

    if (isOwner || isAdmin || isMember) return { allowed: true };
    return { allowed: false, error: "Недостаточно прав." };
  }

  // Path 2: Password auth — verify actorUserId is the crew owner
  if (actorUserId && isPasswordAuth) {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!crew) return { allowed: false, error: "Экипаж не найден." };
    if (crew.owner_id === actorUserId) return { allowed: true };

    // Also check if actorUserId is a global admin
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();
    const userMeta = user?.metadata as Record<string, unknown> | null;
    if (userMeta?.role === "admin" || userMeta?.status === "admin") return { allowed: true };

    return { allowed: false, error: "Недостаточно прав." };
  }

  return { allowed: false, error: "Не авторизован." };
}

export async function dismissLeadWithReason(input: DismissLeadInput): Promise<{ success: boolean; error?: string }> {
  const validReasons = DISMISS_REASONS.map((r) => r.value);
  if (!validReasons.includes(input.reason)) return { success: false, error: "Invalid dismiss reason" };
  const reasonDef = DISMISS_REASONS.find((r) => r.value === input.reason);
  if (reasonDef?.requiresNote && !input.note?.trim()) return { success: false, error: `Note is required for '${reasonDef.label}'` };

  // LR3-001 FIX: verify auth before any DB write
  const access = await verifyDismissAccess(input.slug, input.actorUserId, input.isPasswordAuth);
  if (!access.allowed) {
    return { success: false, error: access.error || "Недостаточно прав." };
  }

  try {
    // Use two separate queries to avoid PostgREST filter injection
    const [{ data: byTg, error: tgErr }, { data: byPhone, error: phoneErr }] = await Promise.all([
      supabaseAdmin.from("franchize_intents").select("id, metadata").eq("slug", input.slug).eq("telegram_user_id", input.leadId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from("franchize_intents").select("id, metadata").eq("slug", input.slug).eq("phone", input.leadId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    const fetchError = tgErr || phoneErr;
    const intent = byTg || byPhone;

    if (fetchError || !intent) return { success: false, error: "Lead not found" };

    const existingMeta = (intent.metadata as Record<string, unknown>) || {};
    const updatedMeta = {
      ...existingMeta,
      dismissReason: input.reason,
      dismissNote: input.note?.trim() || null,
      dismissedAt: new Date().toISOString(),
      dismissedBy: input.actorUserId || null,
    };

    const { error: updateError } = await supabaseAdmin
      .from("franchize_intents")
      .update({ stage: "dismissed", metadata: updatedMeta, last_seen_at: new Date().toISOString() })
      .eq("id", intent.id);

    if (updateError) {
      // LR3-015 FIX: was duplicate logger.error line
      logger.error("[dismissLeadWithReason] update failed:", updateError);
      return { success: false, error: "Failed to dismiss lead" };
    }
    return { success: true };
  } catch (err) {
    logger.error("[dismissLeadWithReason] exception:", err);
    return { success: false, error: "Internal error" };
  }
}
