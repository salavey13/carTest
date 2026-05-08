"use server";

import { z } from "zod";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";

const franchizeIntentTypes = [
  "checkout_start",
  "payment_failure",
  "payment_success",
  "hold_created",
  "map_click",
  "contact_click",
  "test_ride_click",
  "test_ride",
  "prebuy",
  "trade_in",
  "finance",
  "rent",
] as const;

const franchizeIntentStages = [
  "discovered",
  "clicked",
  "prebuy_started",
  "checkout_started",
  "hold_created",
  "payment_failed",
  "payment_confirmed",
  "contacted",
  "test_ride_requested",
  "trade_in_requested",
  "finance_requested",
  "viewed",
  "configured",
] as const;

const metadataSchema = z.record(z.string(), z.unknown()).default({});

function sanitizeIntentMetadata(
  value: Record<string, unknown>,
): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch (error) {
    logger.warn("[franchize] intent metadata serialization failed", error);
    return {
      _serializationError: "metadata_not_json_serializable",
    };
  }
}

function readIntentMetadataDedupeKey(metadata: Record<string, unknown>) {
  const value = metadata.dedupeKey;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().slice(0, 180)
    : null;
}

const franchizeIntentInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((value) => value.toLowerCase()),
  bikeId: z.string().trim().min(1).max(120).optional(),
  intentType: z.enum(franchizeIntentTypes),
  stage: z.enum(franchizeIntentStages),
  sourceRoute: z.string().trim().min(1).max(240).optional(),
  contactChannel: z.string().trim().min(1).max(80).optional(),
  urgencyScore: z.coerce.number().int().min(0).max(100).default(0),
  metadata: metadataSchema,
  telegramUserId: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().min(3).max(40).optional(),
});

export type FranchizeIntentInput = z.input<typeof franchizeIntentInputSchema>;
export type FranchizeIntentResult = {
  success: boolean;
  intentId?: string;
  action?: "inserted" | "updated";
  error?: string;
};

type FranchizeIntentRow = {
  id: string;
  urgency_score?: number | null;
  metadata?: Record<string, unknown> | null;
};

function toDbPayload(intent: z.output<typeof franchizeIntentInputSchema>) {
  return {
    slug: intent.slug,
    bike_id: intent.bikeId ?? null,
    intent_type: intent.intentType,
    stage: intent.stage,
    source_route: intent.sourceRoute ?? null,
    contact_channel: intent.contactChannel ?? null,
    urgency_score: intent.urgencyScore,
    metadata: intent.metadata,
    telegram_user_id: intent.telegramUserId ?? null,
    phone: intent.phone ?? null,
    last_seen_at: new Date().toISOString(),
  };
}

function franchizeIntentsTable() {
  return (supabaseAdmin as any).from("franchize_intents");
}

export async function upsertFranchizeIntent(
  input: unknown,
): Promise<FranchizeIntentResult> {
  const parsed = franchizeIntentInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Некорректный franchize intent payload.",
    };
  }

  const intent = {
    ...parsed.data,
    metadata: sanitizeIntentMetadata(parsed.data.metadata),
  };
  const dbPayload = toDbPayload(intent);

  try {
    let query = franchizeIntentsTable()
      .select("id, urgency_score, metadata")
      .eq("slug", intent.slug)
      .eq("intent_type", intent.intentType)
      .eq("stage", intent.stage)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (intent.bikeId) {
      query = query.eq("bike_id", intent.bikeId);
    } else {
      query = query.is("bike_id", null);
    }

    const dedupeKey = readIntentMetadataDedupeKey(intent.metadata);
    if (dedupeKey) {
      query = query.contains("metadata", { dedupeKey });
    } else if (intent.telegramUserId) {
      query = query.eq("telegram_user_id", intent.telegramUserId);
    } else if (intent.phone) {
      query = query.eq("phone", intent.phone);
    } else if (intent.contactChannel) {
      query = query.eq("contact_channel", intent.contactChannel);
    } else {
      query = query.is("telegram_user_id", null).is("phone", null);
    }

    const { data: existingRows, error: selectError } = await query;
    if (selectError) {
      throw selectError;
    }

    const existing = (existingRows?.[0] ?? null) as FranchizeIntentRow | null;
    if (existing?.id) {
      const mergedMetadata = {
        ...(existing.metadata ?? {}),
        ...intent.metadata,
        lastStage: intent.stage,
      };
      const { data, error } = await franchizeIntentsTable()
        .update({
          ...dbPayload,
          urgency_score: Math.max(
            Number(existing.urgency_score ?? 0),
            intent.urgencyScore,
          ),
          metadata: mergedMetadata,
        })
        .eq("id", existing.id)
        .select("id")
        .single();

      if (error) throw error;
      return { success: true, intentId: String(data.id), action: "updated" };
    }

    const { data, error } = await franchizeIntentsTable()
      .insert(dbPayload)
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, intentId: String(data.id), action: "inserted" };
  } catch (error) {
    logger.error("[franchize] upsertFranchizeIntent failed", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось сохранить franchize intent.",
    };
  }
}
