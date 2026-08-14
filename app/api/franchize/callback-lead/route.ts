import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, randomUUID } from "node:crypto";

import { normalizePhone } from "@/app/franchize/lib/phone-utils";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  buildVipBikeCallbackMessage,
  callbackLeadRequestSchema,
} from "@/lib/vip-bike-callback-lead";
import { VIP_BIKE_RENTAL_CATALOG } from "@/lib/vip-bike-rental-catalog";

const MAX_BODY_BYTES = 32_000;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1_000;
const FALLBACK_RATE_WINDOW_MS = 10 * 60 * 1_000;
const FALLBACK_NOTIFICATION_LOCK_MS = 2 * 60 * 1_000;

type CallbackCaptureStatus =
  | "created"
  | "retry_claimed"
  | "duplicate_sent"
  | "pending"
  | "rate_limited";

type CallbackCapture = {
  result_status: CallbackCaptureStatus;
  intent_id: string;
  intent_metadata: Record<string, unknown> | null;
  retry_after_seconds: number;
};

type CallbackCaptureOutcome = {
  capture: CallbackCapture | null;
  error: unknown;
  notificationLockId?: string;
};

function clientIpFromRequest(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return (
    request.headers.get("x-real-ip") ||
    forwarded.split(",")[0]?.trim() ||
    "unknown"
  ).slice(0, 128);
}

function hashClientIp(ip: string): string | null {
  const secret =
    process.env.CALLBACK_RATE_LIMIT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.TELEGRAM_BOT_TOKEN;
  if (!secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex");
}

function deterministicIntentId(phone: string, at: Date): string {
  const bucket = Math.floor(at.getTime() / DUPLICATE_WINDOW_MS);
  const bytes = createHash("sha256")
    .update(`vip-bike:${phone}:${bucket}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      success: false,
      error: "Слишком много заявок. Попробуйте ещё раз через несколько минут.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isMissingCallbackRpc(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "PGRST202" ||
        error.message?.includes("capture_vip_bike_callback_intent")),
  );
}

async function removeFallbackToken(tokenId?: string) {
  if (!tokenId) return;
  const { error } = await supabaseAdmin
    .from("temp_franchize_carts")
    .delete()
    .eq("cart_id", tokenId);
  if (error) {
    logger.warn("[callback-lead] fallback token cleanup failed", {
      code: error.code,
    });
  }
}

async function acquireFallbackSlot(
  prefix: string,
  slotCount: number,
  expiresAt: string,
): Promise<{ status: "acquired" | "limited" | "error"; tokenId?: string; error?: unknown }> {
  for (let slot = 0; slot < slotCount; slot += 1) {
    const tokenId = `${prefix}:${slot}`;
    const { error } = await supabaseAdmin.from("temp_franchize_carts").insert({
      cart_id: tokenId,
      cart_by_slug: {
        __vipBikeCallback: true,
        kind: "rate_limit",
        expiresAt,
      },
    });
    if (!error) return { status: "acquired", tokenId };
    if (error.code !== "23505") return { status: "error", error };
  }
  return { status: "limited" };
}

function existingCaptureState(
  requestId: string,
  metadata: Record<string, unknown>,
  nowMs: number,
): CallbackCapture | null {
  if (metadata.notificationStatus === "sent") {
    return {
      result_status: "duplicate_sent",
      intent_id: requestId,
      intent_metadata: metadata,
      retry_after_seconds: 0,
    };
  }
  const lastAttemptAt = Date.parse(String(metadata.notificationLastAttemptAt || ""));
  if (
    metadata.notificationStatus === "pending" &&
    Number.isFinite(lastAttemptAt) &&
    nowMs - lastAttemptAt < 30_000
  ) {
    return {
      result_status: "pending",
      intent_id: requestId,
      intent_metadata: metadata,
      retry_after_seconds: Math.max(
        1,
        Math.ceil((30_000 - (nowMs - lastAttemptAt)) / 1_000),
      ),
    };
  }
  return null;
}

async function claimExistingFallback(input: {
  requestId: string;
  notificationAttemptId: string;
  now: string;
}): Promise<CallbackCaptureOutcome> {
  const readExisting = () =>
    supabaseAdmin
      .from("franchize_intents")
      .select("id, metadata")
      .eq("id", input.requestId)
      .eq("slug", "vip-bike")
      .maybeSingle();

  const firstRead = await readExisting();
  if (firstRead.error || !firstRead.data?.id) {
    return { capture: null, error: firstRead.error || new Error("missing intent") };
  }
  const firstMetadata = metadataRecord(firstRead.data.metadata);
  const firstState = existingCaptureState(
    input.requestId,
    firstMetadata,
    Date.now(),
  );
  if (firstState) return { capture: firstState, error: null };

  const notificationLockId = `vip-bike-callback-notify:${input.requestId}`;
  await supabaseAdmin
    .from("temp_franchize_carts")
    .delete()
    .eq("cart_id", notificationLockId)
    .lt(
      "created_at",
      new Date(Date.now() - FALLBACK_NOTIFICATION_LOCK_MS).toISOString(),
    );
  const { error: lockError } = await supabaseAdmin
    .from("temp_franchize_carts")
    .insert({
      cart_id: notificationLockId,
      cart_by_slug: {
        __vipBikeCallback: true,
        kind: "notification_lock",
        expiresAt: new Date(
          Date.now() + FALLBACK_NOTIFICATION_LOCK_MS,
        ).toISOString(),
      },
    });
  if (lockError?.code === "23505") {
    return {
      capture: {
        result_status: "pending",
        intent_id: input.requestId,
        intent_metadata: firstMetadata,
        retry_after_seconds: 30,
      },
      error: null,
    };
  }
  if (lockError) return { capture: null, error: lockError };

  const lockedRead = await readExisting();
  if (lockedRead.error || !lockedRead.data?.id) {
    await removeFallbackToken(notificationLockId);
    return { capture: null, error: lockedRead.error || new Error("missing intent") };
  }
  const lockedMetadata = metadataRecord(lockedRead.data.metadata);
  const lockedState = existingCaptureState(
    input.requestId,
    lockedMetadata,
    Date.now(),
  );
  if (lockedState) {
    await removeFallbackToken(notificationLockId);
    return { capture: lockedState, error: null };
  }

  const attempts = Number(lockedMetadata.notificationAttempts || 0);
  const claimedMetadata = {
    ...lockedMetadata,
    notificationStatus: "pending",
    notificationAttempts: Number.isFinite(attempts) ? attempts + 1 : 1,
    notificationLastAttemptAt: input.now,
    notificationAttemptId: input.notificationAttemptId,
  };
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from("franchize_intents")
    .update({ metadata: claimedMetadata, last_seen_at: input.now })
    .eq("id", input.requestId)
    .select("id")
    .single();
  if (claimError || !claimed?.id) {
    await removeFallbackToken(notificationLockId);
    return { capture: null, error: claimError || new Error("claim failed") };
  }

  return {
    capture: {
      result_status: "retry_claimed",
      intent_id: input.requestId,
      intent_metadata: claimedMetadata,
      retry_after_seconds: 0,
    },
    error: null,
    notificationLockId,
  };
}

async function captureCallbackFallback(input: {
  requestId: string;
  notificationAttemptId: string;
  bikeId?: string;
  phone: string;
  sourceRoute: string;
  ipHash: string;
  metadata: Record<string, unknown>;
  now: string;
}): Promise<CallbackCaptureOutcome> {
  const existing = await supabaseAdmin
    .from("franchize_intents")
    .select("id")
    .eq("id", input.requestId)
    .eq("slug", "vip-bike")
    .maybeSingle();
  if (existing.error) return { capture: null, error: existing.error };
  if (existing.data?.id) {
    return claimExistingFallback(input);
  }

  const bucket = Math.floor(Date.now() / FALLBACK_RATE_WINDOW_MS);
  const expiresAt = new Date(
    (bucket + 1) * FALLBACK_RATE_WINDOW_MS,
  ).toISOString();
  await supabaseAdmin
    .from("temp_franchize_carts")
    .delete()
    .like("cart_id", "vip-bike-callback-rate:%")
    .lt(
      "created_at",
      new Date(Date.now() - FALLBACK_RATE_WINDOW_MS * 2).toISOString(),
    );

  const ipSlot = await acquireFallbackSlot(
    `vip-bike-callback-rate:${bucket}:ip:${input.ipHash}`,
    5,
    expiresAt,
  );
  if (ipSlot.status === "limited") {
    return {
      capture: {
        result_status: "rate_limited",
        intent_id: input.requestId,
        intent_metadata: null,
        retry_after_seconds: 600,
      },
      error: null,
    };
  }
  if (ipSlot.status === "error") {
    return { capture: null, error: ipSlot.error };
  }

  const globalSlot = await acquireFallbackSlot(
    `vip-bike-callback-rate:${bucket}:global`,
    30,
    expiresAt,
  );
  if (globalSlot.status !== "acquired") {
    await removeFallbackToken(ipSlot.tokenId);
    if (globalSlot.status === "limited") {
      return {
        capture: {
          result_status: "rate_limited",
          intent_id: input.requestId,
          intent_metadata: null,
          retry_after_seconds: 600,
        },
        error: null,
      };
    }
    return { capture: null, error: globalSlot.error };
  }

  const claimedMetadata = {
    ...input.metadata,
    notificationStatus: "pending",
    notificationAttempts: 1,
    notificationLastAttemptAt: input.now,
    notificationAttemptId: input.notificationAttemptId,
  };
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("franchize_intents")
    .insert({
      id: input.requestId,
      slug: "vip-bike",
      bike_id: input.bikeId || null,
      intent_type: "callback_request",
      stage: "lead_captured",
      source_route: input.sourceRoute,
      contact_channel: "web_callback",
      urgency_score: 80,
      phone: input.phone,
      last_seen_at: input.now,
      metadata: claimedMetadata,
    })
    .select("id")
    .single();

  if (insertError?.code === "23505") {
    await Promise.all([
      removeFallbackToken(ipSlot.tokenId),
      removeFallbackToken(globalSlot.tokenId),
    ]);
    return claimExistingFallback(input);
  }
  if (insertError || !inserted?.id) {
    await Promise.all([
      removeFallbackToken(ipSlot.tokenId),
      removeFallbackToken(globalSlot.tokenId),
    ]);
    return { capture: null, error: insertError || new Error("insert failed") };
  }

  return {
    capture: {
      result_status: "created",
      intent_id: input.requestId,
      intent_metadata: claimedMetadata,
      retry_after_seconds: 0,
    },
    error: null,
  };
}

async function notifyCrewOwner(input: {
  ownerChatId: string;
  message: string;
}): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.error("[callback-lead] TELEGRAM_BOT_TOKEN is not configured");
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: input.ownerChatId, text: input.message }),
      cache: "no-store",
      signal: controller.signal,
      },
    );
    if (!response.ok) {
      logger.error("[callback-lead] Telegram delivery failed", {
        status: response.status,
      });
      return false;
    }
    const result = (await response.json()) as { ok?: boolean };
    return result.ok === true;
  } catch (error) {
    logger.error("[callback-lead] Telegram delivery exception", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function sourceRouteFromRequest(request: NextRequest) {
  const referer = request.headers.get("referer");
  if (!referer) return "/franchize/vip-bike";
  try {
    const url = new URL(referer);
    return `${url.pathname}${url.search}${url.hash}`.slice(0, 1_000);
  } catch {
    return "/franchize/vip-bike";
  }
}

async function handleVipBikeRentalCallback(request: NextRequest) {
  try {
    const clientIp = clientIpFromRequest(request);
    const localLimit = enforceRateLimit(
      `vip-bike-callback:${clientIp}`,
      4,
      60_000,
    );
    if (!localLimit.allowed) {
      return rateLimitResponse(localLimit.retryAfterSeconds);
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: "Слишком большой запрос" },
        { status: 413 },
      );
    }

    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, error: "Слишком большой запрос" },
        { status: 413 },
      );
    }

    let requestBody: unknown;
    try {
      requestBody = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: "Некорректный JSON" },
        { status: 400 },
      );
    }

    const parsed = callbackLeadRequestSchema.safeParse(requestBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || "Некорректные данные заявки",
        },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const normalizedPhone = normalizePhone(input.phone);
    if (!normalizedPhone || !/^\+[1-9]\d{9,14}$/.test(normalizedPhone)) {
      return NextResponse.json(
        { success: false, error: "Укажите корректный номер телефона" },
        { status: 400 },
      );
    }

    const ipHash = hashClientIp(clientIp);
    if (!ipHash) {
      logger.error("[callback-lead] no server secret for IP hashing");
      return NextResponse.json(
        { success: false, error: "Сервис заявок временно недоступен." },
        { status: 503 },
      );
    }

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const requestId = deterministicIntentId(normalizedPhone, nowDate);
    const notificationAttemptId = randomUUID();
    const sourceRoute = sourceRouteFromRequest(request);
    const canonicalBike = input.bikeId
      ? VIP_BIKE_RENTAL_CATALOG[input.bikeId]
      : undefined;
    if (input.bikeId && !canonicalBike) {
      return NextResponse.json(
        { success: false, error: "Выбранная модель не найдена в каталоге аренды" },
        { status: 400 },
      );
    }
    const bikeTitle = canonicalBike?.title;

    const leadMetadata: Record<string, unknown> = {
      name: input.name,
      phone: normalizedPhone,
      requestId,
      bikeTitle: bikeTitle || null,
      sourceRoute,
      attribution: input.attribution || null,
      attributionTrust: "client_supplied",
      consent: true,
      consentAt: now,
      capturedAt: now,
      ipHash,
    };

    const { data: captureRows, error: captureRpcError } = await supabaseAdmin.rpc(
      "capture_vip_bike_callback_intent",
      {
        p_intent_id: requestId,
        p_bike_id: input.bikeId || null,
        p_phone: normalizedPhone,
        p_source_route: sourceRoute,
        p_ip_hash: ipHash,
        p_metadata: leadMetadata,
        p_notification_attempt_id: notificationAttemptId,
      },
    );
    let captureSource: "rpc" | "fallback" = "rpc";
    let fallbackNotificationLockId: string | undefined;
    let capture: CallbackCapture | null = captureRows?.[0]
      ? {
          ...captureRows[0],
          result_status: captureRows[0]
            .result_status as CallbackCaptureStatus,
          intent_metadata: metadataRecord(captureRows[0].intent_metadata),
        }
      : null;
    let captureError: unknown = captureRpcError;

    if (isMissingCallbackRpc(captureRpcError)) {
      captureSource = "fallback";
      logger.warn(
        "[callback-lead] atomic RPC migration is pending; using unique-row fallback",
      );
      const fallback = await captureCallbackFallback({
        requestId,
        notificationAttemptId,
        bikeId: input.bikeId,
        phone: normalizedPhone,
        sourceRoute,
        ipHash,
        metadata: leadMetadata,
        now,
      });
      capture = fallback.capture;
      captureError = fallback.error;
      fallbackNotificationLockId = fallback.notificationLockId;
    }

    if (captureError || !capture) {
      logger.error("[callback-lead] atomic intent capture failed", captureError);
      return NextResponse.json(
        { success: false, error: "Не удалось проверить заявку. Попробуйте ещё раз." },
        { status: 503 },
      );
    }

    if (capture.result_status === "rate_limited") {
      return rateLimitResponse(capture.retry_after_seconds || 600);
    }
    if (capture.result_status === "duplicate_sent") {
      return NextResponse.json({
        success: true,
        requestId,
        intentId: requestId,
        notificationSent: true,
        deduplicated: true,
      });
    }
    if (capture.result_status === "pending") {
      const retryAfter = capture.retry_after_seconds || 30;
      return NextResponse.json(
        { success: false, saved: true, error: "Заявка уже обрабатывается." },
        { status: 409, headers: { "Retry-After": String(retryAfter) } },
      );
    }
    if (
      capture.result_status !== "created" &&
      capture.result_status !== "retry_claimed"
    ) {
      logger.error("[callback-lead] unexpected atomic capture status", {
        status: capture.result_status,
      });
      return NextResponse.json(
        { success: false, error: "Не удалось проверить заявку. Попробуйте ещё раз." },
        { status: 503 },
      );
    }

    const deduplicated = capture.result_status === "retry_claimed";

    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("slug", input.slug)
      .maybeSingle();

    if (crewError) {
      logger.warn("[callback-lead] crew owner lookup failed", crewError);
    }

    const ownerChatId = crew?.owner_id ? String(crew.owner_id) : "";
    const notificationSent = ownerChatId
      ? await notifyCrewOwner({
          ownerChatId,
          message: buildVipBikeCallbackMessage({
            name: input.name,
            phone: normalizedPhone,
            bikeTitle,
            sourceRoute,
            attribution: input.attribution,
            createdAt: now,
          }),
        })
      : false;

    let notificationStateSaved = false;
    let notificationStateError: unknown = null;
    if (captureSource === "rpc") {
      const finalized = await supabaseAdmin.rpc(
        "finalize_vip_bike_callback_notification",
        {
          p_intent_id: requestId,
          p_notification_attempt_id: notificationAttemptId,
          p_notification_status: notificationSent ? "sent" : "failed",
        },
      );
      notificationStateSaved = finalized.data === true;
      notificationStateError = finalized.error;
    } else {
      const persistedMetadata = metadataRecord(capture.intent_metadata);
      const finalizedMetadata = {
        ...persistedMetadata,
        notificationStatus: notificationSent ? "sent" : "failed",
        notificationLastAttemptAt: new Date().toISOString(),
        notificationDeliveredAt: notificationSent
          ? new Date().toISOString()
          : persistedMetadata.notificationDeliveredAt || null,
      };
      const finalized = await supabaseAdmin
        .from("franchize_intents")
        .update({ metadata: finalizedMetadata })
        .eq("id", requestId)
        .filter(
          "metadata->>notificationAttemptId",
          "eq",
          notificationAttemptId,
        )
        .select("id")
        .maybeSingle();
      notificationStateSaved = Boolean(finalized.data?.id);
      notificationStateError = finalized.error;
      await removeFallbackToken(fallbackNotificationLockId);
    }
    if (notificationStateError || !notificationStateSaved) {
      logger.error(
        "[callback-lead] notification state update failed",
        notificationStateError || { notificationStateSaved },
      );
    }

    if (!ownerChatId) {
      logger.warn("[callback-lead] crew owner is not configured", {
        slug: input.slug,
      });
    }

    if (!notificationSent) {
      return NextResponse.json(
        {
          success: false,
          saved: true,
          requestId,
          intentId: requestId,
          notificationSent: false,
          error: "Заявка сохранена, но уведомление менеджеру не доставлено. Повторите отправку.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      requestId,
      intentId: requestId,
      notificationSent: true,
      deduplicated,
    });
  } catch (error) {
    logger.error("[callback-lead] exception", error);
    return NextResponse.json(
      { success: false, error: "Не удалось обработать заявку. Попробуйте ещё раз." },
      { status: 500 },
    );
  }
}

/**
 * Legacy shared callback endpoint used by non-rental crews and by sale/service
 * flows. Keep this contract separate from the stricter VIP BIKE rental handler.
 */
async function handleGenericCallback(request: NextRequest) {
  try {
    const body = await request.json();
    const { slug, bikeId, bikeTitle, name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: "Name and phone are required" },
        { status: 400 },
      );
    }

    const normalizedPhone = normalizePhone(phone) || phone.replace(/[^\d+]/g, "");
    const userId = normalizedPhone;

    const { error: upsertError } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          user_id: userId,
          full_name: name,
          metadata: {
            source: "web_callback",
            phone: normalizedPhone,
            bikeId: bikeId || null,
            bikeTitle: bikeTitle || null,
            slug: slug || null,
            createdAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (upsertError) {
      logger.error("[callback-lead] upsert failed", upsertError);
    }

    await supabaseAdmin.from("franchize_intents").upsert({
      slug: slug || "vip-bike",
      bike_id: bikeId || null,
      intent_type: "callback_request",
      stage: "lead_captured",
      source_route: "/franchize/web",
      contact_channel: "web_callback",
      urgency_score: 60,
      telegram_user_id: userId,
      metadata: { name, phone: normalizedPhone, bikeTitle },
    }).then(({ error }) => {
      if (error) logger.warn("[callback-lead] intent insert failed", error);
    });

    let ownerChatId: string | null = null;
    if (slug) {
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("owner_id")
        .eq("slug", slug)
        .maybeSingle();
      if (crew?.owner_id) {
        ownerChatId = crew.owner_id;
      }
    }

    if (ownerChatId) {
      const message =
        `*Новая заявка на звонок*\n\n` +
        `Модель: ${bikeTitle || "Байк"}\n` +
        `Имя: ${name}\n` +
        `Телефон: ${normalizedPhone}\n` +
        `Источник: веб-сайт\n` +
        `Время: ${new Date().toLocaleString("ru-RU")}`;

      try {
        await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/forward-telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId: ownerChatId,
            text: message,
            parseMode: "Markdown",
          }),
        });
      } catch {
        // The user and intent are already stored; keep legacy best-effort behavior.
      }
    }

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    logger.error("[callback-lead] exception", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (
    request.nextUrl.pathname ===
    "/api/franchize/vip-bike/callback-lead"
  ) {
    return handleVipBikeRentalCallback(request);
  }
  return handleGenericCallback(request);
}
