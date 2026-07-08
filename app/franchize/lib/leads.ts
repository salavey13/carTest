"use server";

// Centralized franchize lead/intent helpers.
// All flows that produce a lead (/doc, /testdrive, web cart, continue-in-TG,
// dashboard, new app open) call upsertFranchizeLead() so the leads page
// has a single source of truth for intent rows.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { upsertFranchizeIntent } from "@/app/franchize/server-actions/intents";
import type { FranchizeIntentInput } from "@/app/franchize/server-actions/intents";

export type FranchizeIntentType = FranchizeIntentInput["intentType"];
export type FranchizeIntentStage = FranchizeIntentInput["stage"];

export interface UpsertFranchizeLeadInput {
  slug: string;
  /** User identifier. For TG users this is telegram user_id; for web leads it can be phone or a generated web-id. */
  userId: string;
  intentType: FranchizeIntentType;
  stage: FranchizeIntentStage;
  /** Optional bike id the lead is interested in. */
  bikeId?: string | null;
  /** Human-readable bike title. */
  bikeTitle?: string | null;
  /** Phone if known. */
  phone?: string | null;
  /** Full name if known. */
  fullName?: string | null;
  /** Telegram username if known. */
  username?: string | null;
  /** Where the lead came from (e.g. "/doc-manual", "/cart", "item-modal", "dashboard"). */
  sourceRoute?: string | null;
  /** Contact channel label. */
  contactChannel?: "telegram_bot" | "web_app" | "callback" | "unknown";
  /** 0-100 urgency score. */
  urgencyScore?: number;
  /** Free-form metadata. Will be merged with existing metadata on conflict. */
  metadata?: Record<string, unknown>;
  /** If true, upsert public.users row as well (creates synthetic user for phone-based web leads). */
  ensureUser?: boolean;
}

function sanitizeUserId(id: string): string {
  const s = (id || "").trim();
  if (!s) return "anonymous";
  if (s.length > 128) return s.slice(0, 128);
  return s;
}

function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.startsWith("7") || digits.startsWith("8") ? `+${digits}` : `+${digits}`;
}

/**
 * Upsert a franchize intent (lead) row. This is the canonical way to record a lead.
 * Delegates to the existing upsertFranchizeIntent server action for metadata-merge
 * and stage-preservation logic, and optionally ensures a public.users row exists.
 */
export async function upsertFranchizeLead(input: UpsertFranchizeLeadInput): Promise<void> {
  const slug = (input.slug || "vip-bike").trim().toLowerCase();
  const userId = sanitizeUserId(input.userId);
  const phone = normalizePhone(input.phone);
  const fullName = input.fullName?.trim() || null;
  const username = input.username?.trim() || null;
  const bikeId = input.bikeId?.trim() || null;
  const bikeTitle = input.bikeTitle?.trim() || null;
  const sourceRoute = input.sourceRoute?.trim() || null;
  const channel = input.contactChannel || "unknown";
  const urgency = Math.max(0, Math.min(100, input.urgencyScore ?? 50));
  const now = new Date().toISOString();

  try {
    if (input.ensureUser) {
      const userMeta: Record<string, unknown> = {
        source: input.intentType,
        is_lead: true,
        updatedAt: now,
      };
      if (phone) userMeta.phone = phone;
      if (bikeId) userMeta.bikeId = bikeId;
      if (bikeTitle) userMeta.bikeTitle = bikeTitle;

      await supabaseAdmin.from("users").upsert(
        {
          user_id: userId,
          phone: phone,
          full_name: fullName,
          username: username,
          metadata: userMeta,
          updated_at: now,
          created_at: now,
        },
        { onConflict: "user_id" }
      );
    }

    await upsertFranchizeIntent({
      slug,
      bikeId: bikeId || undefined,
      intentType: input.intentType,
      stage: input.stage,
      sourceRoute: sourceRoute || undefined,
      contactChannel: channel,
      urgencyScore: urgency,
      telegramUserId: /^\d+$/.test(userId) ? userId : undefined,
      phone: phone || undefined,
      metadata: {
        name: fullName,
        phone: phone,
        username: username,
        bikeTitle: bikeTitle,
        sourceRoute: sourceRoute,
        channel: channel,
        lastSeenAt: now,
        ...(input.metadata || {}),
      },
    });
  } catch (err) {
    logger.warn("[upsertFranchizeLead] unexpected error:", err);
  }
}

/**
 * Record a lightweight interaction for an existing lead (e.g. returned to app,
 * opened dashboard). Updates last_seen_at and appends a history entry to metadata
 * when the row exists; does nothing if the intent row is missing.
 */
export async function touchFranchizeLead(
  slug: string,
  userId: string,
  intentType: FranchizeIntentType,
  note?: string
): Promise<void> {
  const id = sanitizeUserId(userId);
  if (!id || id === "anonymous") return;
  try {
    const { data } = await supabaseAdmin
      .from("franchize_intents")
      .select("metadata")
      .eq("slug", slug)
      .eq("telegram_user_id", id)
      .eq("intent_type", intentType)
      .maybeSingle();

    if (!data) return;
    const meta = (data.metadata as Record<string, unknown> | null) || {};
    const history = (meta.history as Array<{ at: string; note: string }>) || [];
    history.unshift({ at: new Date().toISOString(), note: note || "interaction" });
    await supabaseAdmin
      .from("franchize_intents")
      .update({
        last_seen_at: new Date().toISOString(),
        metadata: { ...meta, history: history.slice(0, 20) },
      })
      .eq("slug", slug)
      .eq("telegram_user_id", id)
      .eq("intent_type", intentType);
  } catch (err) {
    logger.warn("[touchFranchizeLead] failed:", err);
  }
}
