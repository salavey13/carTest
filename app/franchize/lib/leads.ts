"use server";

// Centralized franchize lead/intent helpers.
// All flows that produce a lead (/doc, /testdrive, web cart, continue-in-TG,
// dashboard, new app open) call upsertFranchizeLead() so the leads page
// has a single source of truth for intent rows.

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { upsertFranchizeIntent } from "@/app/franchize/server-actions/intents";
import type { FranchizeIntentInput } from "@/app/franchize/server-actions/intents";
import { normalizePhone } from "./phone-utils";

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
  contactChannel?: "telegram_bot" | "web_app" | "callback" | "web_cart" | "unknown";
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

      // IMPORTANT: never overwrite the profile of an existing real user.
      // When an operator creates a contract for a client, userId is the operator's
      // Telegram chat ID — writing the client's full_name/username into that row
      // corrupts the operator's profile (evening digest, shift reports, etc).
      // ensureUser is only meant to CREATE synthetic users for phone-based web
      // leads (user_id = phone); existing rows stay untouched.
      const { data: existingUser } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingUser) {
        await supabaseAdmin.from("users").upsert(
          {
            user_id: userId,
            full_name: fullName,
            username: username,
            metadata: userMeta,
            updated_at: now,
            created_at: now,
          },
          { onConflict: "user_id" }
        );
      }
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

/**
 * Link existing test_drive franchize_intents to a newly-created rental.
 *
 * When /doc-manual converts a testdrive into a real rental, the rental row is
 * created and a new `rent` intent is upserted. But the ORIGINAL test_drive intent
 * (created by /testdrive) is left dangling — it has no rental_id reference.
 *
 * This helper finds test_drive intents for the same crew + bike + customer and
 * writes `metadata.rentalId` + `metadata.convertedToRentalAt` so:
 *   1. The leads page can attach the rental to the testdrive lead directly via
 *      metadata lookup (robust to phone-format mismatches between operators).
 *   2. The evening digest can count testdrive→rental conversions.
 *
 * Matching strategy (any of):
 *   - phone match (preferred — works across operators)
 *   - telegram_user_id match (same operator created both)
 *
 * @returns number of intents updated.
 */
export async function linkTestdriveIntentsToRental(params: {
  slug: string;
  bikeId?: string | null;
  phone?: string | null;
  telegramUserId?: string | null;
  rentalId: string;
}): Promise<number> {
  const slug = (params.slug || "").trim().toLowerCase();
  if (!slug || !params.rentalId) return 0;

  const phone = normalizePhone(params.phone);
  const tgId = params.telegramUserId?.trim() || null;
  const bikeId = params.bikeId?.trim() || null;

  // Build a disjunctive filter. We match on (slug + intent_type='test_drive') AND
  // (phone = X OR telegram_user_id = Y) AND optionally bike_id = Z. Supabase REST
  // doesn't expose OR-of-different-columns cleanly, so we run up to two queries
  // and dedupe by id.
  const baseQuery = () =>
    supabaseAdmin
      .from("franchize_intents")
      .select("id, metadata, phone, telegram_user_id, bike_id")
      .eq("slug", slug)
      .eq("intent_type", "test_drive")
      .neq("stage", "dismissed");

  type Row = { id: string; metadata: Record<string, unknown> | null; phone: string | null; telegram_user_id: string | null; bike_id: string | null };
  const queries: Promise<Row[] | null>[] = [];
  if (phone) queries.push(Promise.resolve(baseQuery().eq("phone", phone).then((r) => (r.data as Row[] | null) ?? null)));
  if (tgId) queries.push(Promise.resolve(baseQuery().eq("telegram_user_id", tgId).then((r) => (r.data as Row[] | null) ?? null)));

  if (queries.length === 0) return 0;

  try {
    const results = await Promise.all(queries);
    const seen = new Set<string>();
    const toUpdate: Array<{ id: string; metadata: Record<string, unknown> }> = [];

    for (const rows of results) {
      if (!rows) continue;
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        // Optional bike_id filter — only link when the testdrive was for the same
        // bike (or bike_id is null on the intent, meaning generic).
        if (bikeId && row.bike_id && row.bike_id !== bikeId) continue;
        const existingMeta = (row.metadata as Record<string, unknown> | null) || {};
        // Skip if already linked to a DIFFERENT rental (don't overwrite).
        if (existingMeta.rentalId && existingMeta.rentalId !== params.rentalId) continue;
        if (existingMeta.rentalId === params.rentalId) continue; // already linked
        toUpdate.push({
          id: row.id,
          metadata: {
            ...existingMeta,
            rentalId: params.rentalId,
            convertedToRentalAt: new Date().toISOString(),
          },
        });
      }
    }

    if (toUpdate.length === 0) return 0;

    // Update each intent row individually (preserves existing metadata merge).
    const updates = toUpdate.map((u) =>
      supabaseAdmin
        .from("franchize_intents")
        .update({
          metadata: u.metadata,
          // Mark as closed — the testdrive is no longer an open lead; it has
          // been converted into a real rental. "closed" is a valid stage value
          // (see franchizeIntentStages) and is in operatorCloserStages so it
          // won't be silently downgraded by future upserts.
          stage: "closed",
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", u.id),
    );
    const results2 = await Promise.all(updates);
    const failed = results2.filter((r) => r.error);
    if (failed.length > 0) {
      logger.warn(
        `[linkTestdriveIntentsToRental] ${failed.length}/${toUpdate.length} updates failed:`,
        failed[0]?.error,
      );
    }
    const succeeded = toUpdate.length - failed.length;
    if (succeeded > 0) {
      logger.info(
        `[linkTestdriveIntentsToRental] linked ${succeeded} test_drive intent(s) to rental ${params.rentalId}`,
      );
    }
    return succeeded;
  } catch (err) {
    logger.warn("[linkTestdriveIntentsToRental] failed:", err);
    return 0;
  }
}
