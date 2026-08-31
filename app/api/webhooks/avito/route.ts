import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";

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
// Contract: ALWAYS answer 200 fast. Avito retries non-200s; a broken handler
// must never turn into a redelivery storm. Lead persistence is best-effort:
// if Supabase fails we log and ack (Avito data can be re-imported from chats).
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

function buyerDisplayName(value: AvitoMessageValue): string {
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
}): Promise<void> {
  const { value, eventId, now } = input;
  const metadata: Record<string, unknown> = {
    name: buyerDisplayName(value),
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
  };

  const { error } = await supabaseAdmin.from("franchize_intents").insert({
    slug: CREW_SLUG,
    intent_type: "callback_request",
    stage: "lead_captured",
    source_route: "avito_webhook",
    contact_channel: "avito",
    urgency_score: 50,
    last_seen_at: value.created || now,
    metadata,
  });

  if (error) throw error;
  logger.info("[avito-webhook] lead created", { chatId: value.chat_id });
}

async function updateLead(
  intentId: string,
  prevMetadata: Record<string, unknown>,
  input: { value: AvitoMessageValue; eventId: string | null; now: string },
): Promise<void> {
  const { value, eventId, now } = input;
  const count = Number(prevMetadata.messagesCount || 0);
  const merged: Record<string, unknown> = {
    ...prevMetadata,
    lastMessage: truncate(value.text, 1000) ?? prevMetadata.lastMessage ?? null,
    lastMessageAt: value.created || now,
    lastEventId: eventId,
    messagesCount: Number.isFinite(count) ? count + 1 : 1,
  };
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
}

/** Best-effort Telegram ping to the crew owner about a brand-new lead.
 *  Fire-and-forget: the webhook response must not wait on it (2s limit). */
function notifyCrewOwnerAsync(lead: {
  name: string;
  bikeTitle: string | null;
  text: string | null;
  chatId: string | null;
}): void {
  void (async () => {
    try {
      const { data: crew } = await supabaseAdmin
        .from("crews")
        .select("owner_id")
        .eq("slug", CREW_SLUG)
        .maybeSingle();
      if (!crew?.owner_id) return;

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
      await fetch(`${base}/api/forward-telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: crew.owner_id,
          text: lines.join("\n"),
        }),
        cache: "no-store",
      });
    } catch (error) {
      logger.warn("[avito-webhook] crew notification failed", error);
    }
  })();
}

function ack() {
  return NextResponse.json({ ok: true });
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
    if (body.payload?.type !== "message" || !body.payload.value) return ack();
    const value = body.payload.value;
    if (!value.chat_id) return ack();

    // Seller's own messages (operator replied from Avito) → touch, no lead ops.
    const fromBuyer =
      value.buyer_id == null || value.author_id == null || value.author_id === value.buyer_id;

    const now = new Date().toISOString();
    const existing = await findLeadByChatId(value.chat_id);
    if (existing.error) {
      logger.error("[avito-webhook] lookup failed", existing.error);
      return ack();
    }

    if (existing.data?.id) {
      const prevMeta =
        existing.data.metadata && typeof existing.data.metadata === "object"
          ? (existing.data.metadata as Record<string, unknown>)
          : {};
      // Idempotency: Avito redelivers on flaky networks.
      if (body.id && prevMeta.lastEventId === body.id) return ack();
      if (!fromBuyer) {
        await supabaseAdmin
          .from("franchize_intents")
          .update({ last_seen_at: value.created || now })
          .eq("id", existing.data.id);
        return ack();
      }
      await updateLead(existing.data.id, prevMeta, { value, eventId: body.id ?? null, now });
      return ack();
    }

    if (!fromBuyer) return ack();

    await createLead({ value, eventId: body.id ?? null, now });
    notifyCrewOwnerAsync({
      name: buyerDisplayName(value),
      bikeTitle: truncate(value.item_title, 200),
      text: truncate(value.text, 300),
      chatId: value.chat_id,
    });
    return ack();
  } catch (error) {
    logger.error("[avito-webhook] processing failed", error);
    return ack();
  }
}
