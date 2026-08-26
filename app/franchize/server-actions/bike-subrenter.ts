"use server";

// bike-subrenter.ts
// ──────────────────────────────────────────────────────────────────────────
// Subrenter management (iter7): a bike's partner-owner is marked by his
// Telegram chat id in cars.specs.subrenter_chat_id (NO schema migration —
// pure JSONB data, same approach as specs.salary).
//
// A subrenter gets:
//   • read access to rentals of HIS bikes (/franchize/{slug}/rentals)
//   • operator-like view on the rental page of his bike's rentals
//   • exploration achievements
//
// Setting the value is restricted to the crew owner / global admin.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { z } from "zod";

/**
 * Unified permission check for subrenter management.
 *
 * HISTORY BUG (iter8): the original check only accepted
 *   crew.owner_id === actorUserId  OR  users.metadata.role/status === "admin"
 * But the real global admin (salavey13 / 413553377) carries his admin status in
 * the TOP-LEVEL users.role="vprAdmin" + users.status="admin" columns, and crew
 * admins live in crew_members.role — so the action returned "Недостаточно прав"
 * and the admin panel's «Субарендаторы» section showed "0 записей / В экипаже
 * пока нет техники" even though yamaha-r7 already had specs.subrenter_chat_id.
 *
 * Allowed actors (mirrors the client-side isCrewFleetAdmin gate in
 * FranchizeAdminClient so the panel never shows UI the server rejects):
 *   • crew owner
 *   • active crew_members row with role owner / admin / co_owner
 *   • global admin: users.role in (admin, vprAdmin) or users.status = admin
 *     (top-level columns) or metadata.role / metadata.status = admin (legacy)
 */
async function canManageSubrenters(
  crewId: string,
  crewOwnerId: string | null,
  actorUserId: string,
): Promise<boolean> {
  if (crewOwnerId && crewOwnerId === actorUserId) return true;

  // Active crew membership with an admin-grade role
  const { data: membership } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crewId)
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (
    membership?.membership_status === "active" &&
    ["owner", "admin", "co_owner"].includes(membership.role || "")
  ) {
    return true;
  }

  // Global admin — top-level columns first, then legacy metadata keys
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status, metadata")
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (!user) return false;
  if (user.role === "admin" || user.role === "vprAdmin" || user.status === "admin") return true;
  const meta = (user.metadata ?? {}) as Record<string, unknown>;
  return meta.role === "admin" || meta.status === "admin";
}

const inputSchema = z.object({
  slug: z.string().trim().min(1),
  actorUserId: z.string().trim().min(1),
  bikeId: z.string().trim().min(1),
  /** Telegram chat id of the subrenter, or "" / null to clear. */
  subrenterChatId: z.string().trim().max(24).nullable(),
});

export async function setBikeSubrenterAction(input: {
  slug: string;
  actorUserId: string;
  bikeId: string;
  subrenterChatId: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Некорректный запрос." };
  }
  const { slug, actorUserId, bikeId, subrenterChatId } = parsed.data;

  try {
    // Resolve crew + bike (bike must belong to the crew)
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();
    if (!crew) return { success: false, error: "Экипаж не найден." };

    const { data: bike } = await supabaseAdmin
      .from("cars")
      .select("id, specs")
      .eq("id", bikeId)
      .eq("crew_id", crew.id)
      .maybeSingle();
    if (!bike) return { success: false, error: "Байк не найден в этом экипаже." };

    // Permission: crew owner / crew admin / co_owner / global admin
    const allowed = await canManageSubrenters(crew.id, crew.owner_id, actorUserId);
    if (!allowed) {
      return { success: false, error: "Только владелец экипажа, админ экипажа или администратор может назначать субарендаторов." };
    }

    const normalized = (subrenterChatId || "").replace(/\D/g, "");
    const specs = (bike.specs && typeof bike.specs === "object" && !Array.isArray(bike.specs)
      ? { ...(bike.specs as Record<string, unknown>) }
      : {}) as Record<string, unknown>;

    if (normalized.length > 0) {
      specs.subrenter_chat_id = normalized;
      specs.subrenter_set_at = new Date().toISOString();
      specs.subrenter_set_by = actorUserId;
    } else {
      delete specs.subrenter_chat_id;
      delete specs.subrenter_set_at;
      delete specs.subrenter_set_by;
    }

    const { error: updateError } = await supabaseAdmin
      .from("cars")
      .update({ specs, updated_at: new Date().toISOString() })
      .eq("id", bikeId);

    if (updateError) return { success: false, error: updateError.message };

    logger.info("[setBikeSubrenterAction] updated", { slug, bikeId, subrenterChatId: normalized || "(cleared)" });
    return { success: true };
  } catch (error) {
    logger.error("[setBikeSubrenterAction] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Crew fleet with subrenter info for the admin panel. */
export async function getCrewBikesSubrenterInfoAction(input: {
  slug: string;
  actorUserId: string;
}): Promise<{
  success: boolean;
  data?: Array<{ bikeId: string; label: string; subrenterChatId: string | null }>;
  error?: string;
}> {
  const parsed = z.object({
    slug: z.string().trim().min(1),
    actorUserId: z.string().trim().min(1),
  }).safeParse(input);
  if (!parsed.success) return { success: false, error: "Некорректный запрос." };
  const { slug, actorUserId } = parsed.data;

  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();
    if (!crew) return { success: false, error: "Экипаж не найден." };

    const allowed = await canManageSubrenters(crew.id, crew.owner_id, actorUserId);
    if (!allowed) return { success: false, error: "Недостаточно прав." };

    // Only rentable vehicles (bikes / ebikes) — a subrenter is a partner who
    // owns a BIKE. The crew fleet also contains services, equipment and
    // marketplace items (vip-bike has 100+ rows) which made the panel an
    // endless wall of noise where the actual bikes were hard to find.
    const { data: bikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs")
      .eq("crew_id", crew.id)
      .in("type", ["bike", "ebike"])
      .order("make", { ascending: true });

    const data = (bikes ?? []).map((b) => {
      const specs = (b.specs ?? {}) as Record<string, unknown>;
      return {
        bikeId: String(b.id),
        label: `${b.make ?? ""} ${b.model ?? ""}`.trim() || String(b.id),
        subrenterChatId: typeof specs.subrenter_chat_id === "string" ? specs.subrenter_chat_id : null,
      };
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
