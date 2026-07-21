"use server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { DISMISS_REASONS } from "@/app/franchize/[slug]/leads/lib/dismiss-reasons";

export interface DismissLeadInput {
  slug: string;
  leadId: string;
  reason: string;
  note?: string;
  actorUserId?: string;
}

export async function dismissLeadWithReason(input: DismissLeadInput): Promise<{ success: boolean; error?: string }> {
  const validReasons = DISMISS_REASONS.map((r) => r.value);
  if (!validReasons.includes(input.reason)) return { success: false, error: "Invalid dismiss reason" };
  if (input.reason === "other" && !input.note?.trim()) return { success: false, error: "Note is required for 'other' reason" };

  try {
    const { data: intent, error: fetchError } = await supabaseAdmin
      .from("franchize_intents")
      .select("id, metadata")
      .eq("slug", input.slug)
      .or(`telegram_user_id.eq.${input.leadId},phone.eq.${input.leadId}`)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
      logger.error("[dismissLeadWithReason] update failed:", updateError);
      return { success: false, error: updateError.message };
    }
    return { success: true };
  } catch (err) {
    logger.error("[dismissLeadWithReason] exception:", err);
    return { success: false, error: "Internal error" };
  }
}
