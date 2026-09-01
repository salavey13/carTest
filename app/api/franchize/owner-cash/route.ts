import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/lib/supabase-server";

// ═══════════════════════════════════════════════════════════════════════════
// Кошелёк владельца экипажа — ingest для ассистента (@vipBikeAssistantBot).
//
// «Пришло 19500 за CBR 600RR Влад» / «ушло 8500 шлем Байкленд» /
// «выплата субарендатору Иван 7000» → POST сюда → public.owner_cash_entries.
//
// Auth: OWNER_CASH_SECRET (env) — query `?secret=` или header `x-owner-cash-secret`.
// Если env не задан — принимаем с warning (как avito-webhook), секрет
// рекомендуется выставить на обоих деплоях.
// ═══════════════════════════════════════════════════════════════════════════

const MAX_BODY_BYTES = 8_000;

type OwnerCashBody = {
  slug?: string;
  direction?: string;
  amount?: number | string;
  title?: string;
  person?: string;
  kind?: string;
  entryDate?: string;
  createdBy?: string;
};

function checkSecret(request: NextRequest): boolean {
  const expected = process.env.OWNER_CASH_SECRET;
  // M3 fix: FAIL CLOSED. This is a money-ledger ingest — when the secret is
  // missing we must refuse writes (the old warn-and-accept behavior let any
  // caller plant arbitrary cash entries). Configure OWNER_CASH_SECRET to use
  // the assistant path.
  if (!expected) {
    logger.error("[owner-cash] OWNER_CASH_SECRET is not set — rejecting ingest (fail closed)");
    return false;
  }
  const provided =
    request.nextUrl.searchParams.get("secret") ||
    request.headers.get("x-owner-cash-secret");
  if (provided !== expected) return false;
  // Constant-time re-check to avoid trivially timing the prefix.
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  if (!checkSecret(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const raw = await request.text();
    if (!raw || new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
    }
    const body = JSON.parse(raw) as OwnerCashBody;

    const slug = (body.slug || "vip-bike").trim().toLowerCase();
    const direction = body.direction === "in" ? "in" : body.direction === "out" ? "out" : null;
    const amount = Number(String(body.amount ?? "").replace(/[^\d.]/g, ""));
    const title = (body.title || "").trim();
    const kind =
      body.kind === "subrenter_payout" || body.kind === "other" ? body.kind : "personal";

    if (!direction) {
      return NextResponse.json(
        { ok: false, error: "direction должен быть 'in' (пришло) или 'out' (ушло)" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "amount должен быть числом > 0" }, { status: 400 });
    }
    // Same cap as the zod schema on the server-action path.
    if (amount > 10_000_000) {
      return NextResponse.json({ ok: false, error: "amount слишком большой" }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ ok: false, error: "title обязателен (за что/от кого)" }, { status: 400 });
    }
    const entryDate = /^\d{4}-\d{2}-\d{2}$/.test(body.entryDate || "")
      ? (body.entryDate as string)
      : new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10); // MSK

    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!crew?.id) {
      return NextResponse.json({ ok: false, error: "crew not found" }, { status: 404 });
    }

    const person = (body.person || "").trim() || null;
    const { data, error } = await supabaseAdmin
      .from("owner_cash_entries")
      .insert({
        crew_id: crew.id,
        owner_user_id: crew.owner_id ? String(crew.owner_id) : null,
        direction,
        kind,
        amount,
        title: title.slice(0, 300),
        person: person ? person.slice(0, 200) : null,
        entry_date: entryDate,
        created_by: (body.createdBy || "assistant_bot").slice(0, 120),
        source: "assistant_bot",
      })
      .select("id")
      .single();
    if (error) throw error;

    logger.info("[owner-cash] entry added", { slug, direction, amount, title: title.slice(0, 50) });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    logger.error("[owner-cash] failed", error);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}
