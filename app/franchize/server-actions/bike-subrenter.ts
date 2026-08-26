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

    // Permission: crew owner or global admin
    let allowed = crew.owner_id === actorUserId;
    if (!allowed) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", actorUserId)
        .maybeSingle();
      const meta = (user?.metadata ?? {}) as Record<string, unknown>;
      allowed = meta.role === "admin" || meta.status === "admin";
    }
    if (!allowed) {
      return { success: false, error: "Только владелец экипажа или администратор может назначать субарендаторов." };
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

    let allowed = crew.owner_id === actorUserId;
    if (!allowed) {
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", actorUserId)
        .maybeSingle();
      const meta = (user?.metadata ?? {}) as Record<string, unknown>;
      allowed = meta.role === "admin" || meta.status === "admin";
    }
    if (!allowed) return { success: false, error: "Недостаточно прав." };

    const { data: bikes } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, specs")
      .eq("crew_id", crew.id)
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
