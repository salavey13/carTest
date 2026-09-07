import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";

import { logger } from "@/lib/logger";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";
import { supabaseAdmin } from "@/lib/supabase-server";
import { recordLeadEvent } from "@/app/franchize/lib/lead-events";
import {
  appendMessageLog,
  mergeClientFacts,
  sanitizeClientFacts,
} from "@/app/franchize/lib/lead-client-facts";

// ═══════════════════════════════════════════════════════════════════════════
// Avito Messenger v3 webhook receiver → VIP BIKE leads (franchize_intents).
//
// Docs: https://developers.avito.ru/api-catalog/messenger/documentation
//       (operation postWebhookV3)
//
// Every incoming Avito chat message about our items lands here. The FIRST
// message of a chat creates a cold lead ("Новые" on the leads page, segment
// "Заявки") — a person who has never been to the showroom. Follow-up messages
// from the buyer update last_seen_at + metadata (no new lead, no notification
// spam). Messages sent by us (the seller) only refresh last_seen_at.
//
// Setup:
//   1) (Recommended) Set AVITO_WEBHOOK_SECRET in the deployment env.
//      The registered webhook URL must then include it:
//        https://<host>/api/webhooks/avito?secret=<AVITO_WEBHOOK_SECRET>
//      If the env var is absent the route accepts requests and logs a warning
//      (needed so the endpoint can go live before secrets are provisioned).
//   2) Register the URL once:
//        node scripts/avito-webhook-setup.mjs register "https://<host>/api/webhooks/avito?secret=..."
//      Avito validates the URL by POSTing '{}' and expects 200 OK within 2s —
//      this route acks that immediately.
//
// Contract: ALWAYS answer 200 fast to the OFFICIAL Avito webhook (Avito
// retries non-200s; a broken handler must never turn into a redelivery
// storm). Lead persistence is best-effort there: if Supabase fails we log
// and ack (Avito data can be re-imported from chats).
//
// EXCEPTION — factory poller events (body.id starts with "monitor:"):
// the factory avito_monitor cron re-delivers via its own durable outbox,
// so a Supabase failure MUST surface as 503 to trigger that retry. Always
// acking would silently drop the lead (the monitor forwards each event
// once per new inbound message).
// ═══════════════════════════════════════════════════════════════════════════

const CREW_SLUG = "vip-bike";
const MAX_BODY_BYTES = 64_000;

/** Avito v3 message payload (defensive subset — fields may be absent). */
type AvitoMessageValue = {
  chat_id?: string;
  chat_created?: string;
  chat_title?: string;
  chat_type?: string;
  author_id?: number;
  created?: string;
  type?: string;
  item_id?: number;
  item_title?: string;
  item_price?: number;
  item_url?: string;
  item_public_user_id?: number;
  published_at?: string;
  buyer_id?: number;
  text?: string;
};

type AvitoWebhookBody = {
  id?: string;
  version?: string;
  timestamp?: number;
  payload?: { type?: string; value?: AvitoMessageValue };
  /**
   * Optional enrichment from the factory avito_monitor poller (cron):
   * real buyer name, listing URL, profile and GLM analysis category.
   * Ignored by the official Avito v3 webhook (it never sends `client`).
   */
  client?: {
    name?: string;
    url?: string;
    profile?: string;
    category?: string;
    /** Lead-temperature from the monitor's BANT scoring: hot|warm|cold. */
    score?: string;
  };
};

const LEAD_SCORES = new Set(["hot", "warm", "cold"]);

function sanitizeScore(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return LEAD_SCORES.has(v) ? v : null;
}

/**
 * Manual/assistant-bot ingest envelope (interim path until Avito API keys are
 * provisioned and the official webhook subscription is live). The VIP BIKE
 * assistant TG bot receives Avito messages via manager forwards; instead of
 * writing leads itself (old CLI gate required a phone in the text), it POSTs
 * them here. Envelope is mapped onto the same lead pipeline as v3 messages.
 */
type BotForwardBody = {
  type: "bot_forward";
  /** Customer message text (required). */
  text?: string;
  /** Phone if the operator extracted one (optional — no hard gate). */
  phone?: string;
  /** Buyer name if visible (optional). */
  name?: string;
  /** Item/listing title if mentioned (optional). */
  bike_title?: string;
  /** Avito dialog/listing URL if present in the forward (optional). */
  url?: string;
  /** Who forwarded (manager name/chat label, for metadata only). */
  manager?: string;
};

function secretProvided(request: NextRequest): string | null {
  return (
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("x-avito-secret")
  );
}

function checkSecret(request: NextRequest): boolean {
  const expected = process.env.AVITO_WEBHOOK_SECRET;
  if (!expected) {
    logger.warn("[avito-webhook] AVITO_WEBHOOK_SECRET is not set — accepting unauthenticated webhook");
    return true;
  }
  return secretProvided(request) === expected;
}

function truncate(value: string | undefined, max: number): string | null {
  const s = (value || "").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function buyerDisplayName(
  value: AvitoMessageValue,
  clientName?: string,
): string {
  // Enriched polls (factory monitor) carry the real buyer name from chat users.
  if (clientName && clientName.trim() && clientName !== "Неизвестно") {
    return clientName.trim().slice(0, 120);
  }
  // Avito webhooks do not carry the buyer's profile name. Keep it honest:
  // a stable pseudonym; the operator opens the chat by chat link in metadata.
  return value.buyer_id ? `Покупатель Avito #${value.buyer_id}` : "Покупатель Avito";
}

async function findLeadByChatId(chatId: string) {
  return supabaseAdmin
    .from("franchize_intents")
    .select("id, metadata")
    .eq("slug", CREW_SLUG)
    .eq("contact_channel", "avito")
    .filter("metadata->>avitoChatId", "eq", chatId)
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function createLead(input: {
  value: AvitoMessageValue;
  eventId: string | null;
  now: string;
  /** bot_forward extras merged into metadata. */
  extra?: Record<string, unknown> | null;
  /** Normalized phone for the phone column (bot_forward only). */
  phone?: string | null;
  /** Monitor enrichment: real buyer name + listing context. */
  client?: AvitoWebhookBody["client"];
  /** AI-анализ сообщения (санитизированный) — в metadata.analysis. */
  analysis?: Record<string, unknown> | null;
}): Promise<void> {
  const { value, eventId, now, extra, phone, client, analysis } = input;
  const leadScore = sanitizeScore(client?.score);
  // НАКОПИТЕЛЬНЫЕ факты клиента («подготовка за 5 минут»): агент присылает
  // их вместе с сообщением, webhook кладёт в metadata.clientFacts. Здесь —
  // первый пасс: мерджим мониторный `client` + агентские client_facts.
  const incomingFacts = mergeClientFacts(
    null,
    sanitizeClientFacts(client ? { name: client.name, ...factsFromAnalysis(analysis) } : factsFromAnalysis(analysis)),
  );
  const leadKey = `avito:${value.chat_id ?? eventId ?? now}`;
  const metadata: Record<string, unknown> = {
    name: buyerDisplayName(value, client?.name),
    phone: null,
    source: "avito",
    avitoChatId: value.chat_id ?? null,
    avitoUserId: value.buyer_id ?? null,
    avitoItemId: value.item_id ?? null,
    avitoChatType: value.chat_type ?? null,
    bikeTitle: truncate(value.item_title, 200),
    itemPrice: typeof value.item_price === "number" ? value.item_price : null,
    firstMessage: truncate(value.text, 1000),
    lastMessage: truncate(value.text, 1000),
    lastMessageAt: value.created || now,
    lastEventId: eventId,
    messagesCount: 1,
    capturedAt: now,
    capturedVia: "avito_webhook_v3",
    // Накопительный лог чата — оператор видит всю переписку без открытия Авито.
    messages: appendMessageLog(null, { at: value.created || now, from: "buyer", text: value.text || "" }),
    ...(incomingFacts ? { clientFacts: incomingFacts } : {}),
    ...(client?.url ? { sourceUrl: client.url } : {}),
    ...(client?.profile ? { avitoProfile: client.profile } : {}),
    ...(client?.category ? { analysisCategory: client.category } : {}),
    ...(leadScore ? { leadScore } : {}),
    ...(analysis ? { analysis } : {}),
    ...(extra || {}),
  };

  const { error } = await supabaseAdmin.from("franchize_intents").insert({
    slug: CREW_SLUG,
    intent_type: "callback_request",
    stage: "lead_captured",
    source_route: "avito_webhook",
    contact_channel: "avito",
    urgency_score: 50,
    phone: phone || null,
    last_seen_at: value.created || now,
    metadata,
  });

  if (error) throw error;
  logger.info("[avito-webhook] lead created", { chatId: value.chat_id });

  // ЖУРНАЛ ИСТОРИИ (wave Lead Game): факты переживают лид и видны команде.
  await recordLeadEvent({
    crewSlug: CREW_SLUG,
    leadId: leadKey,
    type: "lead_created",
    actor: "avito-agent",
    label: "Лид захвачен из Авито",
    detail: [value.item_title, value.text].filter(Boolean).join(" · ").slice(0, 300) || null,
  });
  if (analysis) {
    await recordLeadEvent({
      crewSlug: CREW_SLUG,
      leadId: leadKey,
      type: "analysis_attached",
      actor: "avito-agent",
      label: "AI-разбор первого сообщения",
      detail: analysisSummary(analysis),
    });
  }
}

async function updateLead(
  intentId: string,
  prevMetadata: Record<string, unknown>,
  input: {
    value: AvitoMessageValue;
    eventId: string | null;
    now: string;
    /** AI-анализ нового сообщения — заменяет предыдущий metadata.analysis. */
    analysis?: Record<string, unknown> | null;
  },
): Promise<void> {
  const { value, eventId, now, analysis } = input;
  const count = Number(prevMetadata.messagesCount || 0);
  // Накопительные факты: client_facts от агента мерджатся к предыдущим
  // (первое значение живёт, явные обновления перезаписывают) — карточка
  // клиента только растёт, «подготовка за 5 минут» работает на всей переписке.
  const mergedFacts = mergeClientFacts(
    prevMetadata.clientFacts,
    sanitizeClientFacts(factsFromAnalysis(analysis)),
  );
  const merged: Record<string, unknown> = {
    ...prevMetadata,
    lastMessage: truncate(value.text, 1000) ?? prevMetadata.lastMessage ?? null,
    lastMessageAt: value.created || now,
    lastEventId: eventId,
    messagesCount: Number.isFinite(count) ? count + 1 : 1,
    messages: appendMessageLog(
      prevMetadata.messages,
      { at: value.created || now, from: "buyer", text: value.text || "" },
    ),
  };
  if (mergedFacts) merged.clientFacts = mergedFacts;
  // Свежий анализ заменяет предыдущий (анализируется ПОСЛЕДНЕЕ сообщение).
  if (analysis) merged.analysis = analysis;
  // Backfill item info if the first captured event lacked it.
  if (!merged.bikeTitle && value.item_title) {
    merged.bikeTitle = truncate(value.item_title, 200);
  }
  if (merged.itemPrice == null && typeof value.item_price === "number") {
    merged.itemPrice = value.item_price;
  }

  const { error } = await supabaseAdmin
    .from("franchize_intents")
    .update({ metadata: merged, last_seen_at: value.created || now })
    .eq("id", intentId);

  if (error) throw error;
  logger.info("[avito-webhook] lead updated", { chatId: value.chat_id });

  const leadKey = String(merged.avitoChatId ? `avito:${merged.avitoChatId}` : intentId);
  await recordLeadEvent({
    crewSlug: CREW_SLUG,
    leadId: leadKey,
    type: "avito_message",
    actor: "avito-agent",
    label: "Новое сообщение из Авито",
    detail: truncate(value.text, 200) || null,
  });
  if (analysis) {
    await recordLeadEvent({
      crewSlug: CREW_SLUG,
      leadId: leadKey,
      type: "analysis_attached",
      actor: "avito-agent",
      label: "AI-разбор обновлён",
      detail: analysisSummary(analysis),
    });
  }
}

/** Факты из агентского analysis.client_facts (см. agent-prompt). */
function factsFromAnalysis(analysis: unknown): Record<string, unknown> | null {
  if (!analysis || typeof analysis !== "object") return null;
  const cf = (analysis as Record<string, unknown>).client_facts;
  if (!cf || typeof cf !== "object" || Array.isArray(cf)) return null;
  return cf as Record<string, unknown>;
}

/** Короткое человекочитаемое резюме анализа для журнала/уведомлений. */
function analysisSummary(analysis: Record<string, unknown>): string | null {
  const parts: string[] = [];
  for (const key of ["intent", "temperature", "objection"] as const) {
    const v = analysis[key];
    if (typeof v === "string" && v.trim()) parts.push(v.trim());
  }
  const nba = analysis.nextBestAction;
  if (typeof nba === "string" && nba.trim()) parts.push(nba.trim());
  const joined = parts.join(" · ");
  return joined ? joined.slice(0, 200) : null;
}

/** Best-effort Telegram ping about a brand-new lead — ВСЕМ участникам экипажа.
 *  «All participants get same notifications about new leads appearing» —
 *  раньше пинг уходил только owner'у, и члены экипажа узнавали о лидах
 *  постфактум. Теперь: owner + все active crew_members. Fire-and-forget:
 *  the webhook response must not wait on it (2s limit). */
function notifyCrewOwnerAsync(lead: {
  name: string;
  bikeTitle: string | null;
  text: string | null;
  chatId: string | null;
}): void {
  void (async () => {
    try {
      // Ростер экипажа: owner + активные участники — все получают ОДИНАКОВОЕ
      // уведомление о новом лиде (дедуп ниже).
      const recipients = new Set<string>();
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("id, owner_id")
        .eq("slug", CREW_SLUG)
        .maybeSingle();
      if (crew?.owner_id) recipients.add(crew.owner_id);
      if (crew?.id) {
        const { data: members } = await supabaseAdmin
          .from("crew_members")
          .select("user_id")
          .eq("crew_id", crew.id)
          .eq("membership_status", "active");
        for (const m of members ?? []) {
          if (m.user_id) recipients.add(m.user_id);
        }
      }
      if (recipients.size === 0) return;

      const lines = [
        "🟡 Новый лид из Авито",
        "",
        lead.bikeTitle ? `Объявление: ${lead.bikeTitle}` : null,
        `Покупатель: ${lead.name}`,
        lead.text ? `Сообщение: «${lead.text.slice(0, 300)}»` : null,
        "",
        "Ответить в Авито → авито.ру / мессенджер",
      ].filter(Boolean);
      // Telegram is blocked on the VPS — use the self-hosted proxy, same as
      // the callback-lead generic handler. On Vercel the proxy also works.
      const base = process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
      // Все получатели параллельно; отдельная неудача не рушит остальных.
      await Promise.allSettled(
        Array.from(recipients).map((chatId) =>
          fetch(`${base}/api/forward-telegram`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chatId,
              text: lines.join("\n"),
            }),
            cache: "no-store",
          }),
        ),
      );
    } catch (error) {
      logger.warn("[avito-webhook] crew notification failed", error);
    }
  })();
}

/**
 * AI-анализ сообщения от внешнего агента (см.
 * public/docs/autoreply/vip-bike-avito-agent-prompt.md). Агент, который
 * контролирует извлечение авито-сообщений, может приложить к любому
 * событию (v3 или bot_forward) блок `analysis` — он пишется в
 * metadata.analysis и ПРИОРИТЕТНЕЕ локального keyword-детектора в
 * движке «Готовый ответ» (lead-scripts.ts).
 */
type AvitoAnalysisEnvelope = {
  /** Интент из словаря lead-scripts. */
  intent?: string;
  /** Уверенность 0–100 (<40 движок игнорирует). */
  confidence?: number;
  /** Готовый текст ответа покупателю (главнее шаблона). */
  suggested_reply?: string;
  /** Короткий вариант. */
  short_reply?: string;
  /** Next Best Action. */
  next_best_action?: string;
  /** hot | warm | cold. */
  temperature?: string;
  /** price | license | experience | trust | none. */
  objection?: string;
  /** Извлечённые сущности (dates/phone/bike/budget/…). */
  entities?: Record<string, unknown>;
  /** НАКОПИТЕЛЬНЫЕ факты клиента («подготовка за 5 минут») — мерджатся
   *  в metadata.clientFacts, а не заменяются. См. lead-client-facts.ts. */
  client_facts?: Record<string, unknown>;
  /** Заметка агента для оператора. */
  notes?: string;
  /** Название модели/агента. */
  model?: string;
};

function ack() {
  return NextResponse.json({ ok: true });
}

/**
 * Санитизация analysis-envelope: только известные ключи, обрезка длинных
 * строк, clamp confidence, entities ≤10 × 120 символов. null — мусор.
 */
function sanitizeAnalysis(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const raw = input as AvitoAnalysisEnvelope;
  const str = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const s = v.trim();
    if (!s) return null;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };
  const out: Record<string, unknown> = {};
  const intent = str(raw.intent, 40);
  if (intent) out.intent = intent;
  if (typeof raw.confidence === "number" && Number.isFinite(raw.confidence)) {
    out.confidence = Math.max(0, Math.min(100, Math.round(raw.confidence)));
  }
  const reply = str(raw.suggested_reply, 4000);
  if (reply) out.suggestedReply = reply;
  const shortReply = str(raw.short_reply, 500);
  if (shortReply) out.shortReply = shortReply;
  const nba = str(raw.next_best_action, 500);
  if (nba) out.nextBestAction = nba;
  const temperature = str(raw.temperature, 20);
  if (temperature) out.temperature = temperature;
  const objection = str(raw.objection, 40);
  if (objection) out.objection = objection;
  if (raw.entities && typeof raw.entities === "object" && !Array.isArray(raw.entities)) {
    const entities: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw.entities).slice(0, 10)) {
      const key = str(k, 40);
      const val = str(v, 120);
      if (key && val) entities[key] = val;
    }
    if (Object.keys(entities).length > 0) out.entities = entities;
  }
  // НАКОПИТЕЛЬНЫЕ факты клиента: проходим через свой санитайзер (известные
  // ключи + кастомные, короткие строки) — они полетят в metadata.clientFacts.
  if (raw.client_facts && typeof raw.client_facts === "object" && !Array.isArray(raw.client_facts)) {
    const facts = sanitizeClientFacts(raw.client_facts);
    if (facts) out.client_facts = facts;
  }
  const notes = str(raw.notes, 800);
  if (notes) out.notes = notes;
  const model = str(raw.model, 80);
  if (model) out.model = model;
  if (Object.keys(out).length === 0) return null;
  out.analyzedAt = new Date().toISOString();
  return out;
}

/** Stable synthetic chat id for manual forwards: same text+phone → same lead. */
function forwardChatId(body: BotForwardBody): string {
  const key = `${(body.text || "").trim().toLowerCase()}|${(body.phone || "").trim()}`;
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 20);
  return `fwd-${hash}`;
}

async function handleBotForward(body: BotForwardBody): Promise<NextResponse> {
  const text = (body.text || "").trim();
  if (!text) {
    logger.warn("[avito-webhook] bot_forward without text");
    return ack();
  }
  const now = new Date().toISOString();
  const chatId = forwardChatId(body);
  const phone = normalizePhone(body.phone);
  const analysis = sanitizeAnalysis((body as BotForwardBody & { analysis?: unknown }).analysis);
  const value: AvitoMessageValue = {
    chat_id: chatId,
    text: text.slice(0, 4000),
    item_title: body.bike_title || undefined,
    created: now,
  };
  const extra: Record<string, unknown> = {
    // Spread last in createLead metadata → overrides v3 defaults.
    name: body.name || null,
    phone: body.phone || null,
    capturedVia: "bot_forward",
    forwardManager: body.manager || null,
    sourceUrl: body.url || null,
  };

  try {
    const existing = await findLeadByChatId(chatId);
    if (existing.error) {
      logger.error("[avito-webhook] bot_forward lookup failed", existing.error);
      return ack();
    }
    if (existing.data?.id) {
      const prevMeta =
        existing.data.metadata && typeof existing.data.metadata === "object"
          ? (existing.data.metadata as Record<string, unknown>)
          : {};
      await updateLead(existing.data.id, prevMeta, { value, eventId: null, now, analysis });
      return ack();
    }
    await createLead({ value, eventId: null, now, extra, phone: phone || null, analysis });
    notifyCrewOwnerAsync({
      name: body.name || `Покупатель Avito (форвард${body.manager ? ` от ${body.manager}` : ""})`,
      bikeTitle: body.bike_title || null,
      text: text.slice(0, 300),
      chatId,
    });
    return ack();
  } catch (error) {
    logger.error("[avito-webhook] bot_forward failed", error);
    return ack();
  }
}

export async function GET() {
  // Manual availability probe.
  return ack();
}

export async function POST(request: NextRequest) {
  if (!checkSecret(request)) {
    logger.warn("[avito-webhook] unauthorized webhook call");
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: AvitoWebhookBody;
  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      // Empty body = Avito registration probe. Oversized = malformed — ack and drop.
      return ack();
    }
    body = JSON.parse(raw);
  } catch {
    // Must ack: 4xx would make Avito retry a permanently-broken payload.
    logger.warn("[avito-webhook] non-JSON body");
    return ack();
  }

  try {
    if ((body as BotForwardBody).type === "bot_forward") {
      return await handleBotForward(body as BotForwardBody);
    }
    // Factory poller events may fail the whole pipeline with 503 — the
    // monitor's outbox retries them. Official Avito events stay always-ack.
    const isMonitorEvent =
      typeof body.id === "string" && body.id.startsWith("monitor:");
    const onPersistError = () => {
      if (!isMonitorEvent) return ack();
      return NextResponse.json(
        { ok: false, error: "lead persistence failed; retry via monitor outbox" },
        { status: 503 },
      );
    };
    if (body.payload?.type !== "message" || !body.payload.value) return ack();
    const value = body.payload.value;
    if (!value.chat_id) return ack();
    // AI-анализ от внешнего агента (опционально; промпт агента —
    // public/docs/autoreply/vip-bike-avito-agent-prompt.md).
    const analysis = sanitizeAnalysis((body as AvitoWebhookBody & { analysis?: unknown }).analysis);

    // Seller's own messages (operator replied from Avito) → touch, no lead ops.
    const fromBuyer =
      value.buyer_id == null || value.author_id == null || value.author_id === value.buyer_id;

    const now = new Date().toISOString();
    const existing = await findLeadByChatId(value.chat_id);
    if (existing.error) {
      logger.error("[avito-webhook] lookup failed", existing.error);
      return onPersistError();
    }

    if (existing.data?.id) {
      const prevMeta =
        existing.data.metadata && typeof existing.data.metadata === "object"
          ? (existing.data.metadata as Record<string, unknown>)
          : {};
      // Idempotency: Avito redelivers on flaky networks.
      if (body.id && prevMeta.lastEventId === body.id) return ack();
      if (!fromBuyer) {
        // Наш ответ (оператор ответил из Авито): кроме touch фиксируем его в
        // накопительном логе чата — «подготовка за 5 минут» видит и наши
        // реплики, а не только вопросы покупателя.
        await supabaseAdmin
          .from("franchize_intents")
          .update({
            last_seen_at: value.created || now,
            metadata: {
              ...prevMeta,
              messages: appendMessageLog(
                prevMeta.messages,
                { at: value.created || now, from: "seller", text: value.text || "" },
              ),
            },
          })
          .eq("id", existing.data.id);
        return ack();
      }
      const merged = { ...prevMeta };
      // Monitor enrichment: replace the pseudonym with the real buyer name
      // and backfill listing context on subsequent events.
      if (body.client?.name && body.client.name !== "Неизвестно") {
        merged.name = body.client.name.trim().slice(0, 120);
      }
      if (body.client?.url && !merged.sourceUrl) merged.sourceUrl = body.client.url;
      if (body.client?.profile) merged.avitoProfile = body.client.profile;
      if (body.client?.category) merged.analysisCategory = body.client.category;
      const updateScore = sanitizeScore(body.client?.score);
      if (updateScore) merged.leadScore = updateScore;
      await updateLead(existing.data.id, merged, { value, eventId: body.id ?? null, now, analysis });
      return ack();
    }

    if (!fromBuyer) return ack();

    await createLead({ value, eventId: body.id ?? null, now, client: body.client, analysis });
    notifyCrewOwnerAsync({
      name: buyerDisplayName(value, body.client?.name),
      bikeTitle: truncate(value.item_title, 200),
      text: truncate(value.text, 300),
      chatId: value.chat_id,
    });
    return ack();
  } catch (error) {
    logger.error("[avito-webhook] processing failed", error);
    const isMonitorRetry =
      typeof body.id === "string" && body.id.startsWith("monitor:");
    if (isMonitorRetry) {
      return NextResponse.json(
        { ok: false, error: "lead persistence failed; retry via monitor outbox" },
        { status: 503 },
      );
    }
    return ack();
  }
}
