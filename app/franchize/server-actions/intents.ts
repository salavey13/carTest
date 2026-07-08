"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { logger } from "@/lib/logger";
import {
  TELEGRAM_ACTOR_COOKIE,
  verifyTelegramActorCookieValue,
} from "@/lib/telegram-actor-cookie";
import { supabaseAdmin } from "@/lib/supabase-server";

const franchizeIntentTypes = [
  "checkout_start",
  "payment_failure",
  "payment_success",
  "hold_created",
  "map_click",
  "contact_click",
  "test_ride_click",
  "test_drive",
  "prebuy",
  "trade_in",
  "finance",
  "rent",
  "sale",
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
  "offer_sent",
  "manual_reserved",
  "alternative_offered",
  "closed",
  "contract_generated",
] as const;

const closerActionStages = {
  send_offer: "offer_sent",
  reserve_manually: "manual_reserved",
  offer_alternative_bike: "alternative_offered",
  mark_closed: "closed",
} as const;

const operatorCloserStages = new Set<string>(Object.values(closerActionStages));

type UnknownRecord = Record<string, unknown>;

type FranchizeIntentStage = (typeof franchizeIntentStages)[number];
export type FranchizeCloserIntentVM = {
  id: string;
  intentType: string;
  stage: string;
  urgencyScore: number;
  bikeId: string | null;
  bikeLabel: string;
  selectedDates: string;
  contactChannel: string;
  lastBlocker: string;
  paymentState: string;
  telegramUserId: string | null;
  telegramUsername: string | null;
  suggestedNextAction: string;
  suggestedTelegramReply: string;
  updatedAt: string;
};

function normalizeSlug(value: string) {
  return (value || "vip-bike").trim().toLowerCase() || "vip-bike";
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const next = readString(value);
    if (next) return next;
  }
  return "";
}

async function resolveFranchizeActorFromServerSession() {
  const actorUserId = verifyTelegramActorCookieValue(
    cookies().get(TELEGRAM_ACTOR_COOKIE)?.value,
  );
  if (actorUserId) {
    return { success: true as const, actorUserId };
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_USE_MOCK_USER === "true"
  ) {
    const mockUserId = process.env.NEXT_PUBLIC_MOCK_USER_ID || "413553377";
    logger.warn(
      "[franchize] using development mock actor for closer server action",
    );
    return { success: true as const, actorUserId: mockUserId };
  }

  return {
    success: false as const,
    error: "Verified Telegram session is required.",
  };
}

async function resolveFranchizeOperatorAccess(
  actorUserId: string | undefined,
  slug: string,
) {
  if (!actorUserId) {
    return { allowed: false as const, reason: "actorUserId is required" };
  }

  const normalizedSlug = normalizeSlug(slug);
  const { data: crew, error: crewError } = await supabaseAdmin
    .from("crews")
    .select("id, slug, owner_id")
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (crewError) {
    return { allowed: false as const, reason: crewError.message };
  }
  if (!crew?.id) {
    return { allowed: false as const, reason: "Экипаж не найден." };
  }

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status")
    .eq("user_id", actorUserId)
    .maybeSingle();

  const isAdmin =
    user?.status === "admin" ||
    user?.role === "admin" ||
    user?.role === "vprAdmin";
  if (isAdmin || crew.owner_id === actorUserId) {
    return {
      allowed: true as const,
      crewId: String(crew.id),
      role: isAdmin ? "admin" : "owner",
    };
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("crew_members")
    .select("role, membership_status")
    .eq("crew_id", crew.id)
    .eq("user_id", actorUserId)
    .maybeSingle();

  if (membershipError) {
    return { allowed: false as const, reason: membershipError.message };
  }

  const membershipStatus = readString(
    (membership as UnknownRecord | null)?.membership_status,
  );
  if (membership && membershipStatus === "active") {
    return {
      allowed: true as const,
      crewId: String(crew.id),
      role: readString((membership as UnknownRecord).role) || "member",
    };
  }

  return {
    allowed: false as const,
    reason: "Недостаточно прав для closer dashboard.",
  };
}

function getLastBlocker(metadata: UnknownRecord) {
  const direct = metadata.lastBlocker;
  if (typeof direct === "string") return direct;
  const directRecord = asRecord(direct);
  const directLabel = readString(directRecord.label);
  if (directLabel) return directLabel;
  const blockers = Array.isArray(metadata.blockers) ? metadata.blockers : [];
  const firstBlocker = asRecord(blockers[0]);
  return firstString(
    firstBlocker.label,
    firstBlocker.id,
    metadata.blocker,
    "готов к закрытию",
  );
}

function getSelectedDates(metadata: UnknownRecord) {
  const dates = asRecord(metadata.dates);
  const start = firstString(
    dates.start,
    metadata.selectedDate,
    metadata.startDate,
    metadata.rentalStartDate,
  );
  const end = firstString(
    dates.end,
    metadata.selectedEndDate,
    metadata.endDate,
    metadata.rentalEndDate,
  );
  const time = firstString(
    dates.preferredTime,
    metadata.selectedTime,
    metadata.time,
  );
  const range =
    [start, end && end !== start ? end : ""].filter(Boolean).join(" → ") ||
    "даты не выбраны";
  return time ? `${range}, ${time}` : range;
}

function getPaymentState(row: {
  stage?: string | null;
  metadata?: UnknownRecord | null;
}) {
  const metadata = row.metadata ?? {};
  return firstString(
    metadata.paymentState,
    metadata.payment_state,
    metadata.paymentStatus,
    metadata.payment,
    row.stage === "payment_failed" ? "payment_failed" : "",
    row.stage === "payment_confirmed" ? "payment_confirmed" : "",
    "не задано",
  );
}

function buildSuggestedReply(input: {
  bikeLabel: string;
  selectedDates: string;
  lastBlocker: string;
  paymentState: string;
  stage: string;
}) {
  if (
    input.stage === "payment_failed" ||
    input.paymentState.includes("failed")
  ) {
    return `Вижу, оплата по ${input.bikeLabel} не прошла. Могу закрепить байк вручную или переключить на другой способ оплаты. Даты: ${input.selectedDates}.`;
  }
  if (input.lastBlocker && input.lastBlocker !== "готов к закрытию") {
    return `Вижу, остановились на шаге: ${input.lastBlocker}. Помочь закрыть бронь на ${input.bikeLabel}? Даты: ${input.selectedDates}.`;
  }
  return `Привет! ${input.bikeLabel} ещё можно закрепить. Подтвердить бронь на ${input.selectedDates}?`;
}

function buildSuggestedNextAction(input: {
  stage: string;
  lastBlocker: string;
  paymentState: string;
}) {
  if (input.stage === "closed") return "Лид закрыт — история сохранена.";
  if (input.stage === "manual_reserved")
    return "Проверить ручную бронь и отправить подтверждение.";
  if (input.stage === "alternative_offered")
    return "Дождаться ответа или подобрать ещё один вариант.";
  if (input.stage === "payment_failed" || input.paymentState.includes("failed"))
    return "Предложить ручной резерв или другой способ оплаты.";
  if (
    input.lastBlocker.toLowerCase().includes("date") ||
    input.lastBlocker.toLowerCase().includes("дат")
  )
    return "Уточнить даты и отправить короткое предложение.";
  return "Отправить Telegram offer и закрепить следующий шаг.";
}

function mapCloserIntentRow(
  row: any,
  bikeLabels: Map<string, string>,
  userNames: Map<string, string>,
): FranchizeCloserIntentVM {
  const metadata = asRecord(row.metadata);
  const bikeId = row.bike_id ? String(row.bike_id) : null;
  const bikeLabel = bikeId
    ? (bikeLabels.get(bikeId) ?? bikeId)
    : firstString(metadata.bikeLabel, metadata.vehicleLabel, "—");
  const selectedDates = getSelectedDates(metadata);
  const lastBlocker = getLastBlocker(metadata);
  const paymentState = getPaymentState({ stage: row.stage, metadata });
  const telegramUserId = row.telegram_user_id
    ? String(row.telegram_user_id)
    : null;
  const telegramUsername =
    firstString(
      metadata.telegramUsername,
      asRecord(metadata.contact).telegramUsername,
      telegramUserId ? userNames.get(telegramUserId) : "",
    ) || null;
  const stage = String(row.stage ?? "");
  const suggestedTelegramReply =
    firstString(metadata.suggestedTelegramReply) ||
    buildSuggestedReply({
      bikeLabel,
      selectedDates,
      lastBlocker,
      paymentState,
      stage,
    });
  const suggestedNextAction =
    firstString(metadata.suggestedNextAction) ||
    buildSuggestedNextAction({ stage, lastBlocker, paymentState });

  return {
    id: String(row.id),
    intentType: String(row.intent_type ?? "—"),
    stage,
    urgencyScore: Number(row.urgency_score ?? 0),
    bikeId,
    bikeLabel,
    selectedDates,
    contactChannel: firstString(
      row.contact_channel,
      asRecord(metadata.contact).channel,
      "unknown",
    ),
    lastBlocker,
    paymentState,
    telegramUserId,
    telegramUsername,
    suggestedNextAction,
    suggestedTelegramReply,
    updatedAt: String(row.updated_at ?? ""),
  };
}

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
  stage?: string | null;
  urgency_score?: number | null;
  metadata?: Record<string, unknown> | null;
};

function shouldPreserveOperatorCloserStage(
  existingStage: string | null | undefined,
  incomingStage: FranchizeIntentStage,
) {
  return Boolean(
    existingStage &&
    operatorCloserStages.has(existingStage) &&
    incomingStage !== "payment_confirmed",
  );
}

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
    const dedupeKey = readIntentMetadataDedupeKey(intent.metadata);
    let query = franchizeIntentsTable()
      .select("id, stage, urgency_score, metadata")
      .eq("slug", intent.slug)
      .eq("intent_type", intent.intentType)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!dedupeKey) {
      query = query.eq("stage", intent.stage);
    }

    if (intent.bikeId) {
      query = query.eq("bike_id", intent.bikeId);
    } else {
      query = query.is("bike_id", null);
    }

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
      const preserveOperatorStage = shouldPreserveOperatorCloserStage(
        existing.stage,
        intent.stage,
      );
      const mergedMetadata = {
        ...(existing.metadata ?? {}),
        ...intent.metadata,
        lastSignalStage: intent.stage,
        lastStage: preserveOperatorStage ? existing.stage : intent.stage,
      };
      const { data, error } = await franchizeIntentsTable()
        .update({
          ...dbPayload,
          stage: preserveOperatorStage ? existing.stage : intent.stage,
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

export async function getFranchizeOperatorDashboardAccess(
  input: unknown,
): Promise<{
  success: boolean;
  canOpen: boolean;
  role?: string;
  error?: string;
}> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1).max(80),
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      canOpen: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный access payload.",
    };
  }

  const actor = await resolveFranchizeActorFromServerSession();
  if (!actor.success) {
    return { success: true, canOpen: false, error: actor.error };
  }

  const access = await resolveFranchizeOperatorAccess(
    actor.actorUserId,
    parsed.data.slug,
  );
  return access.allowed
    ? { success: true, canOpen: true, role: access.role }
    : { success: true, canOpen: false, error: access.reason };
}

export async function getFranchizeCloserIntents(input: unknown): Promise<{
  success: boolean;
  items?: FranchizeCloserIntentVM[];
  error?: string;
}> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1).max(80),
      limit: z.coerce.number().int().min(1).max(100).default(40),
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Некорректный closer payload.",
    };
  }

  const { slug, limit } = parsed.data;
  const normalizedSlug = normalizeSlug(slug);
  const actor = await resolveFranchizeActorFromServerSession();
  if (!actor.success) {
    return { success: false, error: actor.error };
  }
  const access = await resolveFranchizeOperatorAccess(
    actor.actorUserId,
    normalizedSlug,
  );
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  const { data, error } = await franchizeIntentsTable()
    .select(
      "id, slug, bike_id, intent_type, stage, contact_channel, urgency_score, metadata, telegram_user_id, phone, updated_at",
    )
    .eq("slug", normalizedSlug)
    .order("urgency_score", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: error.message };
  }

  const rows = (data ?? []) as any[];
  const bikeIds = Array.from(
    new Set(
      rows
        .map((row) => (row.bike_id ? String(row.bike_id) : ""))
        .filter(Boolean),
    ),
  );
  const telegramIds = Array.from(
    new Set(
      rows
        .map((row) =>
          row.telegram_user_id ? String(row.telegram_user_id) : "",
        )
        .filter(Boolean),
    ),
  );

  const bikeLabels = new Map<string, string>();
  if (bikeIds.length > 0) {
    const { data: bikes, error: bikesError } = await supabaseAdmin
      .from("cars")
      .select("id, make, model")
      .in("id", bikeIds);
    if (!bikesError) {
      (bikes ?? []).forEach((bike: any) =>
        bikeLabels.set(
          String(bike.id),
          `${bike.make || "Bike"} ${bike.model || bike.id}`.trim(),
        ),
      );
    }
  }

  const userNames = new Map<string, string>();
  if (telegramIds.length > 0) {
    const { data: users, error: usersError } = await supabaseAdmin
      .from("users")
      .select("user_id, username")
      .in("user_id", telegramIds);
    if (!usersError) {
      (users ?? []).forEach((user: any) => {
        const username = readString(user.username);
        if (username)
          userNames.set(String(user.user_id), username.replace(/^@/, ""));
      });
    }
  }

  return {
    success: true,
    items: rows.map((row) => mapCloserIntentRow(row, bikeLabels, userNames)),
  };
}

export async function updateFranchizeCloserIntentStage(
  input: unknown,
): Promise<{
  success: boolean;
  item?: FranchizeCloserIntentVM;
  error?: string;
}> {
  const parsed = z
    .object({
      slug: z.string().trim().min(1).max(80),
      intentId: z.string().uuid(),
      action: z.enum([
        "send_offer",
        "reserve_manually",
        "offer_alternative_bike",
        "mark_closed",
      ]),
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Некорректный closer action payload.",
    };
  }

  const { slug, intentId, action } = parsed.data;
  const normalizedSlug = normalizeSlug(slug);
  const actor = await resolveFranchizeActorFromServerSession();
  if (!actor.success) {
    return { success: false, error: actor.error };
  }
  const actorUserId = actor.actorUserId;
  const access = await resolveFranchizeOperatorAccess(
    actorUserId,
    normalizedSlug,
  );
  if (!access.allowed) {
    return { success: false, error: access.reason };
  }

  const { data: existing, error: readError } = await franchizeIntentsTable()
    .select("id, slug, metadata")
    .eq("id", intentId)
    .eq("slug", normalizedSlug)
    .maybeSingle();

  if (readError) return { success: false, error: readError.message };
  if (!existing) return { success: false, error: "Intent не найден." };

  const now = new Date().toISOString();
  const metadata = asRecord((existing as any).metadata);
  const closerActions = Array.isArray(metadata.closerActions)
    ? metadata.closerActions
    : [];
  const nextStage = closerActionStages[action] satisfies FranchizeIntentStage;
  const nextMetadata = sanitizeIntentMetadata({
    ...metadata,
    lastCloserAction: action,
    lastCloserActionAt: now,
    lastCloserActorUserId: actorUserId,
    closerActions: [
      ...closerActions,
      { action, stage: nextStage, at: now, actorUserId, role: access.role },
    ],
  });

  const { error: updateError } = await franchizeIntentsTable()
    .update({ stage: nextStage, metadata: nextMetadata, last_seen_at: now })
    .eq("id", intentId)
    .eq("slug", normalizedSlug);

  if (updateError) return { success: false, error: updateError.message };

  const refreshed = await getFranchizeCloserIntents({
    slug: normalizedSlug,
    limit: 100,
  });
  return {
    success: true,
    item: refreshed.items?.find((item) => item.id === intentId),
  };
}
