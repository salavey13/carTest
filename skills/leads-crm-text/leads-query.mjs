#!/usr/bin/env node
// leads-query.mjs — Text-based CRM leads dashboard for VIP Bike.
//
// Queries Supabase REST API directly (no Node server, no supabase-js dep),
// applies the same matching + stage derivation + SLA signals as the leads
// page UI (`/app/franchize/server-actions/leads.ts` + `pipeline-stages.ts`
// + `sla-signals.ts`), and prints a formatted text table.
//
// Usage:
//   node leads-query.mjs list-leads
//   node leads-query.mjs list-leads --hot
//   node leads-query.mjs list-leads --stage awaiting_qr_claim
//   node leads-query.mjs lead-detail <leadId>
//   node leads-query.mjs dismiss-lead <leadId> --reason unreachable --note "..."
//   node leads-query.mjs list-todos --overdue
//   node leads-query.mjs kpis --mode rent
//   node leads-query.mjs pipeline-funnel
//
// Env:
//   SUPABASE_URL            (default: https://inmctohsodgdohamhzag.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (fallback: read from --secrets=<path> or
//                                /home/z/my-project/upload/secrets.txt)
//
// All output goes to stdout; errors go to stderr with exit code 2.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SUPA_URL = "https://inmctohsodgdohamhzag.supabase.co";
const DEFAULT_SECRETS_PATH = "/home/z/my-project/upload/secrets.txt";

const CREW_SLUG = "vip-bike";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const CREW_OWNER_ID = "356282674";

// Operator chat IDs for vip-bike — used by classifyIdentityState to detect
// operator-placeholder leads. From /home/z/my-project/upload/secrets.txt:
//   356282674 → I_O_S_NN               (owner)
//   244736261 → Roman_Vip_Bike_Electro (co_owner)
//   413553377 → salavey13              (admin)
//   7813830016 → DJORUDJOV             (member)
const CREW_OPERATOR_IDS = new Set([
  "356282674",
  "244736261",
  "413553377",
  "7813830016",
]);

// Operator display names — used to render the Assignee column.
const OPERATOR_NAMES = {
  "356282674": "Илья О. (owner)",
  "244736261": "Роман Б. (co-owner)",
  "413553377": "Артур С. (admin)",
  "7813830016": "Джордан (member)",
};

const DISMISS_REASONS = [
  { value: "not_interested",     label: "Не заинтересован",          requiresNote: false },
  { value: "unreachable",        label: "Недозвон / не отвечает",    requiresNote: false },
  { value: "wrong_contact",      label: "Неверный контакт",          requiresNote: false },
  { value: "booked_elsewhere",   label: "Арендовал в другом месте",  requiresNote: false },
  { value: "documents_missing",  label: "Не предоставил документы",  requiresNote: false },
  { value: "timing_issue",       label: "Не подошли даты",           requiresNote: false },
  { value: "operator_error",     label: "Ошибка оператора",          requiresNote: true  },
  { value: "duplicate",          label: "Дубликат",                  requiresNote: false },
  { value: "test_lead",          label: "Тестовый лид",              requiresNote: false },
  { value: "other",              label: "Другое",                    requiresNote: true  },
];

const PIPELINE_STAGES = [
  { key: "new",                label: "Новые",                tone: "gray"     },
  { key: "needs_contact",      label: "Нужен контакт",        tone: "blue"     },
  { key: "contract_sent",      label: "Договор отправлен",    tone: "cyan"     },
  { key: "awaiting_qr_claim",  label: "QR не принят",         tone: "yellow"   },
  { key: "documents_missing",  label: "Документы отсутствуют", tone: "orange"  },
  { key: "active_rental",      label: "Активные",             tone: "green"    },
  { key: "return_due",         label: "Возврат",              tone: "orange"   },
  { key: "closed_won",         label: "Закрыто",              tone: "darkgreen"},
  { key: "closed_lost",        label: "Потеряно",             tone: "darkgray" },
];

const STAGE_LABELS = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, s.label]));

const STAGE_NEXT_ACTION = {
  new:                "Написать в Telegram",
  needs_contact:      "Написать в Telegram",
  contract_sent:      "Переслать QR",
  awaiting_qr_claim:  "Переслать QR",
  documents_missing:  "Запросить документы",
  active_rental:      "Открыть договор",
  return_due:         "Назначить возврат",
  closed_won:         "Создать аренду",
  closed_lost:        "Открыть повторно",
};

// ─── Phone normalization (port of /app/franchize/lib/phone-utils.ts) ──────────

/**
 * Normalize a phone number to canonical E.164-ish form (+7XXXXXXXXXX for RU).
 * Accepts +7/7/8 prefix, spaces, dashes, parentheses.
 * Returns null if input is empty or unparseable.
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let s = String(phone).trim().replace(/[\s\-()]/g, "");
  if (!s) return null;
  if (/^8\d{10}$/.test(s))        s = "+7" + s.slice(1);
  else if (/^7\d{10}$/.test(s))   s = "+" + s;
  else if (/^\d{10}$/.test(s))    s = "+7" + s;
  else if (!s.startsWith("+"))    s = "+" + s;
  return s;
}

function isNumericTelegramId(id) {
  if (!id) return false;
  return /^\d{1,12}$/.test(id);
}

function isPhoneString(id) {
  if (!id) return false;
  return /^(\+7|8|7)\d{10}$/.test(id.replace(/[\s\-()]/g, ""));
}

// ─── Supabase REST client (uses fetch, no supabase-js dep) ────────────────────

let _supaUrl = null;
let _supaKey = null;

function readSecretsFile(path) {
  try {
    const txt = readFileSync(path, "utf-8");
    const m = txt.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

function initSupabase(opts = {}) {
  _supaUrl = opts.url || process.env.SUPABASE_URL || DEFAULT_SUPA_URL;
  _supaKey = opts.key
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || readSecretsFile(opts.secretsPath || DEFAULT_SECRETS_PATH);
  if (!_supaKey) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY not found.");
    console.error("       Set env var, or pass --secrets=<path>, or use default " + DEFAULT_SECRETS_PATH);
    process.exit(2);
  }
}

/**
 * Query a Supabase table via REST.
 *
 * @param {string} table    — table name (e.g. "franchize_intents")
 * @param {object} q        — query params (select, filter*, order, limit, etc.)
 * @param {object} opts
 * @param {string} opts.schema — "public" (default) or "private"
 * @returns {Promise<Array<object>>}
 */
async function supabaseQuery(table, q = {}, opts = {}) {
  const schema = opts.schema || "public";
  const params = new URLSearchParams();

  // select
  if (q.select) params.set("select", q.select);

  // filters — pass as array of strings like ["slug=eq.vip-bike", "stage=neq.dismissed"]
  if (Array.isArray(q.filters)) {
    for (const f of q.filters) {
      const [key] = f.split("=");
      // URLSearchParams.set would collapse multiple filters on the same column;
      // use append so we can have e.g. category=in.(a,b) AND category=not.eq.x.
      params.append(key, f.slice(key.length + 1));
    }
  }

  if (q.order)       params.set("order", q.order);
  if (q.limit)       params.set("limit", String(q.limit));

  const url = `${_supaUrl}/rest/v1/${table}?${params.toString()}`;
  const headers = {
    apikey: _supaKey,
    Authorization: `Bearer ${_supaKey}`,
  };
  if (schema === "private") {
    headers["Accept-Profile"] = "private";
    headers["Content-Profile"] = "private";
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase ${schema}.${table} ${res.status}: ${body.slice(0, 400)}`);
  }
  return res.json();
}

async function supabasePatch(table, filters, body, opts = {}) {
  const schema = opts.schema || "public";
  const params = new URLSearchParams();
  if (Array.isArray(filters)) {
    for (const f of filters) {
      const [key] = f.split("=");
      params.append(key, f.slice(key.length + 1));
    }
  }
  const url = `${_supaUrl}/rest/v1/${table}?${params.toString()}`;
  const headers = {
    apikey: _supaKey,
    Authorization: `Bearer ${_supaKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  if (schema === "private") {
    headers["Accept-Profile"] = "private";
    headers["Content-Profile"] = "private";
  }
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase PATCH ${schema}.${table} ${res.status}: ${txt.slice(0, 400)}`);
  }
  return res.json();
}

// ─── Identity classification (port of leads.ts classifyIdentityState) ─────────

function classifyIdentityState(lead) {
  const userId = lead.user_id;
  const originalOp = lead.originalOperatorChatId || null;

  if (CREW_OPERATOR_IDS.has(userId)) return "operator_placeholder";

  if (originalOp && CREW_OPERATOR_IDS.has(originalOp) && originalOp !== userId) {
    return "merged";
  }

  if (isPhoneString(userId) || (lead.phone && userId === lead.phone)) return "phone_only";

  if (isNumericTelegramId(userId)) return "claimed_user";

  if ((lead.sourceCount || 0) >= 2) return "merged";

  if (lead.telegramChatId
      && isNumericTelegramId(lead.telegramChatId)
      && !CREW_OPERATOR_IDS.has(lead.telegramChatId)) {
    return "claimed_user";
  }

  if (lead.phone) return "phone_only";

  return "operator_placeholder";
}

// ─── Build lead map (port of leads.ts getFranchizeLeads) ──────────────────────

function addOrMerge(leadMap, row) {
  const existing = leadMap.get(row.user_id);
  if (!existing) {
    leadMap.set(row.user_id, { ...row, sourceCount: 1 });
    return;
  }
  existing.sourceCount = (existing.sourceCount || 1) + 1;
  if (row.verified) existing.verified = true;
  if (row.full_name && !existing.full_name) existing.full_name = row.full_name;
  if (row.username && !existing.username) existing.username = row.username;
  if (row.phone && !existing.phone) existing.phone = row.phone;
  if (row.bikeTitle && !existing.bikeTitle) existing.bikeTitle = row.bikeTitle;
  if (row.intentType && !existing.intentType) existing.intentType = row.intentType;
  if (row.intentStage && !existing.intentStage) existing.intentStage = row.intentStage;
  if ((row.urgencyScore ?? 0) > (existing.urgencyScore ?? 0)) existing.urgencyScore = row.urgencyScore;
  if (row.createdAt && (!existing.createdAt || row.createdAt > existing.createdAt)) existing.createdAt = row.createdAt;
  if (row.lastSeenAt && (!existing.lastSeenAt || row.lastSeenAt > existing.lastSeenAt)) existing.lastSeenAt = row.lastSeenAt;
  if (row.telegramChatId && !existing.telegramChatId) existing.telegramChatId = row.telegramChatId;
  if (row.sourceRoute && !existing.sourceRoute) existing.sourceRoute = row.sourceRoute;
  if (row.contactChannel && !existing.contactChannel) existing.contactChannel = row.contactChannel;
  if (row.originalOperatorChatId && !existing.originalOperatorChatId) {
    existing.originalOperatorChatId = row.originalOperatorChatId;
  }
  if (row.rentals.length > 0) existing.rentals.push(...row.rentals);
  if (row.sales.length > 0) existing.sales.push(...row.sales);
}

async function buildLeadMap() {
  const artifactPhoneByRentalId = new Map();
  const rentalIdsByNormalizedPhone = new Map();
  const bikeTitleMap = new Map();
  const leadMap = new Map();

  // ── Parallel fetch of all 5 lead sources ──
  const [intentLeads, artifactUsers, secretUsers, rentals, saleArtifacts] = await Promise.all([
    // 1. franchize_intents (crew-filtered by slug, stage != dismissed)
    supabaseQuery("franchize_intents", {
      select: "telegram_user_id,phone,intent_type,stage,urgency_score,source_route,contact_channel,last_seen_at,created_at,metadata,bike_id",
      filters: [`slug=eq.${CREW_SLUG}`, `stage=neq.dismissed`],
      order: "last_seen_at.desc",
      limit: 800,
    }),
    // 2. rental_contract_artifacts (private schema, crew-filtered)
    supabaseQuery("rental_contract_artifacts", {
      select: "telegram_chat_id,renter_full_name,renter_phone,rental_id,rent_start_date,rent_end_date,requested_bike_id,resolved_bike_id,total_sum,created_at,created_by_operator_chat_id",
      filters: [`crew_slug=eq.${CREW_SLUG}`],
      order: "created_at.desc",
      limit: 300,
    }, { schema: "private" }),
    // 3. user_rental_secrets (private schema, crew-filtered)
    supabaseQuery("user_rental_secrets", {
      select: "chat_id,renter_full_name,renter_phone,verification_status,source_doc_key,created_at",
      filters: [`crew_slug=eq.${CREW_SLUG}`],
      order: "created_at.desc",
      limit: 300,
    }, { schema: "private" }),
    // 4. rentals (crew-filtered by crew_id)
    supabaseQuery("rentals", {
      select: "rental_id,user_id,status,payment_status,requested_start_date,requested_end_date,total_cost,metadata,passport_mainpage_photo,passport_registration_photo,drivers_licence_frontal_photo,crew_id,created_by_operator_chat_id",
      filters: [`crew_id=eq.${CREW_ID}`],
      order: "created_at.desc",
      limit: 500,
    }),
    // 5. sale_contract_artifacts (private schema, crew-filtered)
    supabaseQuery("sale_contract_artifacts", {
      select: "id,telegram_chat_id,buyer_phone,requested_bike_id,resolved_bike_id,sale_price,total_sum,created_at",
      filters: [`crew_slug=eq.${CREW_SLUG}`],
      order: "created_at.desc",
      limit: 200,
    }, { schema: "private" }),
  ]);

  // Pre-fetch bike titles for artifacts + sales (rentals get bike title from cars
  // lookup below — done separately because Supabase REST resource embedding via
  // `vehicle:cars(make, model)` doesn't always work with the FK setup).
  const artifactBikeIds = new Set();
  for (const a of artifactUsers) {
    const bid = a.resolved_bike_id || a.requested_bike_id;
    if (bid) artifactBikeIds.add(bid);
  }
  for (const s of saleArtifacts) {
    const bid = s.resolved_bike_id || s.requested_bike_id;
    if (bid) artifactBikeIds.add(bid);
  }
  // Also collect bike_ids from rentals.metadata.bike_id (if present).
  const rentalBikeIds = new Set();
  for (const r of rentals) {
    const meta = r.metadata && typeof r.metadata === "object" ? r.metadata : null;
    const bid = meta?.bike_id || meta?.requested_bike_id;
    if (bid) rentalBikeIds.add(bid);
  }
  const allBikeIds = new Set([...artifactBikeIds, ...rentalBikeIds]);
  if (allBikeIds.size > 0) {
    // supabaseQuery needs special handling for `in.(...)` filter:
    const inFilter = `id=in.(${Array.from(allBikeIds).join(",")})`;
    const bikeRows = await supabaseQuery("cars", {
      select: "id,make,model",
      filters: [inFilter],
      limit: 500,
    });
    for (const b of bikeRows) {
      const title = `${b.make || ""} ${b.model || ""}`.trim();
      if (title) bikeTitleMap.set(b.id, title);
    }
  }

  // ── 1. franchize_intents → leadMap ──
  for (const i of intentLeads) {
    if (!i.telegram_user_id && !i.phone) continue;
    const normalizedIntentPhone = normalizePhone(i.phone) || normalizePhone(i.metadata?.phone);
    const id = i.telegram_user_id || normalizedIntentPhone || "";
    if (!id) continue;
    const meta = i.metadata || {};
    const originalOp = meta?.operatorId || null;
    addOrMerge(leadMap, {
      user_id: id,
      full_name: meta?.name || null,
      username: meta?.username || null,
      phone: normalizedIntentPhone,
      source: i.intent_type || "unknown",
      bikeTitle: meta?.bikeTitle || null,
      createdAt: i.created_at,
      lastSeenAt: i.last_seen_at,
      verified: ["rent", "sale", "test_drive"].includes(i.intent_type || "")
                && i.stage === "contract_generated",
      intentType: i.intent_type,
      intentStage: i.stage,
      urgencyScore: i.urgency_score ?? undefined,
      telegramChatId: i.telegram_user_id || null,
      sourceRoute: i.source_route,
      contactChannel: i.contact_channel,
      originalOperatorChatId: originalOp,
      rentals: [],
      sales: [],
    });
  }

  // ── 2. rental_contract_artifacts → leadMap ──
  for (const a of artifactUsers) {
    if (!a.telegram_chat_id && !a.renter_phone) continue;
    const normalizedArtifactPhone = normalizePhone(a.renter_phone);
    if (a.rental_id) {
      artifactPhoneByRentalId.set(a.rental_id, normalizedArtifactPhone);
      if (normalizedArtifactPhone) {
        const set = rentalIdsByNormalizedPhone.get(normalizedArtifactPhone) ?? new Set();
        set.add(a.rental_id);
        rentalIdsByNormalizedPhone.set(normalizedArtifactPhone, set);
      }
    }
    // Pre-claim state = telegram_chat_id === created_by_operator_chat_id
    const isPreClaimByOperatorColumn =
      !!a.created_by_operator_chat_id &&
      a.telegram_chat_id === a.created_by_operator_chat_id;
    const isOperatorFromCrew = a.telegram_chat_id && CREW_OPERATOR_IDS.has(a.telegram_chat_id);
    const preferPhone = (isPreClaimByOperatorColumn || isOperatorFromCrew) && !!normalizedArtifactPhone;
    const id = preferPhone ? normalizedArtifactPhone : (a.telegram_chat_id || normalizedArtifactPhone || "");
    if (!id) continue;
    const bikeId = a.resolved_bike_id || a.requested_bike_id;
    const bikeTitle = (bikeId && bikeTitleMap.get(bikeId)) || null;
    const originalOp = a.created_by_operator_chat_id || null;
    addOrMerge(leadMap, {
      user_id: id,
      full_name: a.renter_full_name,
      username: null,
      phone: normalizedArtifactPhone,
      source: "rental_contract",
      bikeTitle,
      createdAt: a.created_at,
      lastSeenAt: a.created_at,
      verified: true,
      telegramChatId: preferPhone ? null : (a.telegram_chat_id || null),
      originalOperatorChatId: originalOp,
      rentals: [{
        rentalId: a.rental_id || "",
        status: "confirmed",
        paymentStatus: "interest_paid",
        startDate: a.rent_start_date,
        endDate: a.rent_end_date,
        bikeTitle,
        totalCost: Number(a.total_sum) || 0,
      }],
      sales: [],
    });
  }

  // ── 3. user_rental_secrets → leadMap (no merge into existing phone keys;
  //        keyed by chat_id per leads.ts behavior) ──
  for (const s of secretUsers) {
    if (!s.chat_id) continue;
    const normalizedSecretPhone = normalizePhone(s.renter_phone);
    const existing = leadMap.get(s.chat_id);
    if (!existing) {
      leadMap.set(s.chat_id, {
        user_id: s.chat_id,
        full_name: s.renter_full_name,
        username: null,
        phone: normalizedSecretPhone,
        source: s.source_doc_key === "profile_prefill" ? "profile_prefill" : "rental_secret",
        bikeTitle: null,
        createdAt: s.created_at,
        lastSeenAt: s.created_at,
        verified: s.verification_status === "verified",
        telegramChatId: s.chat_id,
        rentals: [],
        sales: [],
        sourceCount: 1,
      });
    } else {
      existing.sourceCount = (existing.sourceCount || 1) + 1;
      if (s.verification_status === "verified") existing.verified = true;
      if (!existing.full_name) existing.full_name = s.renter_full_name;
      if (!existing.phone && normalizedSecretPhone) existing.phone = normalizedSecretPhone;
    }
  }

  // ── 4. rentals → leadMap ──
  for (const r of rentals) {
    if (!r.user_id) continue;
    const rentalCreatedByOp = r.created_by_operator_chat_id || null;
    const isPreClaimByOperatorColumn =
      !!rentalCreatedByOp && r.user_id === rentalCreatedByOp;
    const isOperatorFromCrew = CREW_OPERATOR_IDS.has(r.user_id);
    const prefersPhone = isPreClaimByOperatorColumn || isOperatorFromCrew;
    const artifactPhone = artifactPhoneByRentalId.get(r.rental_id) || null;
    const metaRenterPhone = (r.metadata && typeof r.metadata === "object")
      ? normalizePhone(r.metadata.renter_phone)
      : null;
    const effectivePhone = artifactPhone || metaRenterPhone || null;
    const effectiveId = (prefersPhone && effectivePhone) ? effectivePhone : r.user_id;

    let existing = leadMap.get(effectiveId);
    if (!existing && metaRenterPhone) {
      existing = leadMap.get(metaRenterPhone) || null;
    }
    // Resolve bike title: try bike_id from metadata → bikeTitleMap; else fall back to null.
    const meta = (r.metadata && typeof r.metadata === "object") ? r.metadata : null;
    const bikeId = meta?.bike_id || meta?.requested_bike_id;
    const bikeTitle = (bikeId && bikeTitleMap.get(bikeId)) || null;
    const originalOp = rentalCreatedByOp;
    const rentalRow = {
      rentalId: r.rental_id,
      status: r.status || "pending_confirmation",
      paymentStatus: r.payment_status || "interest_paid",
      startDate: r.requested_start_date,
      endDate: r.requested_end_date,
      bikeTitle,
      totalCost: Number(r.total_cost) || 0,
      metadata: r.metadata || null,
      passportMainpagePhoto: r.passport_mainpage_photo || null,
      passportRegistrationPhoto: r.passport_registration_photo || null,
      driversLicenceFrontalPhoto: r.drivers_licence_frontal_photo || null,
    };
    if (!existing) {
      leadMap.set(effectiveId, {
        user_id: effectiveId,
        full_name: null,
        username: null,
        phone: effectivePhone,
        source: "rental",
        bikeTitle,
        createdAt: r.requested_start_date,
        lastSeenAt: r.requested_start_date,
        verified: ["active", "completed", "confirmed"].includes(r.status || ""),
        telegramChatId: /^\d+$/.test(r.user_id) ? r.user_id : null,
        originalOperatorChatId: originalOp,
        rentals: [rentalRow],
        sales: [],
        sourceCount: 1,
      });
    } else {
      existing.sourceCount = (existing.sourceCount || 1) + 1;
      existing.rentals.push(rentalRow);
      if (!existing.phone && effectivePhone) existing.phone = effectivePhone;
      if (originalOp && !existing.originalOperatorChatId) existing.originalOperatorChatId = originalOp;
      if (["active", "completed", "confirmed"].includes(r.status || "")) existing.verified = true;
    }
  }

  // ── 5. sale_contract_artifacts → leadMap ──
  for (const s of saleArtifacts) {
    const normalizedBuyerPhone = normalizePhone(s.buyer_phone);
    const preferPhone = !!normalizedBuyerPhone;
    const id = preferPhone ? normalizedBuyerPhone : (s.telegram_chat_id || "");
    if (!id) continue;
    const bikeId = s.resolved_bike_id || s.requested_bike_id;
    const bikeTitle = (bikeId && bikeTitleMap.get(bikeId)) || null;
    addOrMerge(leadMap, {
      user_id: id,
      full_name: null,
      username: null,
      phone: normalizedBuyerPhone,
      source: "sale_contract",
      bikeTitle,
      createdAt: s.created_at,
      lastSeenAt: s.created_at,
      verified: true,
      telegramChatId: s.telegram_chat_id || null,
      rentals: [],
      sales: [{
        saleId: s.id,
        bikeTitle,
        salePrice: Number(s.total_sum ?? s.sale_price) || 0,
        createdAt: s.created_at,
      }],
    });
  }

  // ── Enrichment (parallel) ──
  const allUserIds = Array.from(leadMap.keys()).filter((id) => /^\d+$/.test(id));
  const leadPhones = Array.from(leadMap.values()).map((l) => l.phone).filter(Boolean);

  const [tgUsers, secretByPhone, troubledUsers, todos] = await Promise.all([
    // public.users enrichment
    allUserIds.length > 0
      ? supabaseQuery("users", {
          select: "user_id,username,full_name,metadata",
          filters: [`user_id=in.(${allUserIds.join(",")})`],
          limit: 1000,
        })
      : Promise.resolve([]),
    // user_rental_secrets by phone (private)
    leadPhones.length > 0
      ? supabaseQuery("user_rental_secrets", {
          select: "chat_id,renter_phone",
          filters: [`crew_slug=eq.${CREW_SLUG}`, `renter_phone=in.(${leadPhones.join(",")})`],
          limit: 500,
        }, { schema: "private" })
      : Promise.resolve([]),
    // troubled users (metadata->>troubled is not null)
    supabaseQuery("users", {
      select: "user_id,metadata",
      filters: [`troubled=not.is.null`],  // placeholder, replaced below
      limit: 5000,
    }).catch(() => []),  // this filter syntax doesn't work for JSONB; use fallback
    // crew_todos
    supabaseQuery("crew_todos", {
      select: "id,lead_id,user_id,phone,rental_id,title,description,status,priority,category,created_at,completed_at,assigned_to,due_date",
      filters: [`crew_id=eq.${CREW_ID}`, `category=in.(lead_followup,rental_verification)`],
      order: "created_at.desc",
      limit: 2000,
    }),
  ]);

  // Workaround for JSONB filter on troubled users: re-query without filter, then
  // filter in JS. The query above (with `troubled=not.is.null`) is expected to
  // fail silently (we .catch() it to []); fetch unfiltered users metadata instead.
  let troubledMap = new Map();
  if (allUserIds.length > 0) {
    // Re-fetch only the users we already fetched — we already have `tgUsers`,
    // which has metadata. Use that.
    for (const u of tgUsers) {
      const meta = u.metadata || {};
      if (meta.troubled === true) {
        troubledMap.set(u.user_id, meta.troubled_reason || null);
      }
    }
  }

  // Backfill top-level bikeTitle from rentals/sales.
  for (const l of leadMap.values()) {
    if (!l.bikeTitle) {
      const firstRentalWithTitle = l.rentals.find((r) => r.bikeTitle);
      const firstSaleWithTitle = l.sales.find((s) => s.bikeTitle);
      if (firstRentalWithTitle) l.bikeTitle = firstRentalWithTitle.bikeTitle;
      else if (firstSaleWithTitle) l.bikeTitle = firstSaleWithTitle.bikeTitle;
    }
  }

  // Enrich telegramChatId, username, full_name, phone from public.users.
  for (const l of leadMap.values()) {
    const match = tgUsers.find((u) => u.user_id === l.user_id);
    if (match) {
      l.telegramChatId = l.user_id;
      if (match.username && !l.username) l.username = match.username;
      if (match.full_name && !l.full_name) l.full_name = match.full_name;
      const meta = match.metadata || {};
      const metaPhone = normalizePhone(meta.phone);
      if (metaPhone && !l.phone) l.phone = metaPhone;
    }
  }

  // Enrich telegramChatId from secrets by phone.
  for (const l of leadMap.values()) {
    if (!l.telegramChatId && l.phone) {
      const match = secretByPhone.find((s) =>
        s.chat_id && s.renter_phone && normalizePhone(s.renter_phone) === l.phone
      );
      if (match) l.telegramChatId = match.chat_id;
    }
  }

  // Apply troubled flags.
  for (const l of leadMap.values()) {
    if (troubledMap.has(l.user_id)) {
      l.troubled = true;
      l.troubledReason = troubledMap.get(l.user_id) || null;
    }
  }

  // Aggregate totals.
  for (const l of leadMap.values()) {
    l.contractCount = l.rentals.length;
    l.saleCount = l.sales.length;
    const rentalTotal = l.rentals.reduce((s, r) => s + (Number(r.totalCost) || 0), 0);
    const saleTotal = l.sales.reduce((s, sale) => s + (Number(sale.salePrice) || 0), 0);
    l.totalSpent = rentalTotal + saleTotal;
    const lastRental = l.rentals
      .filter((r) => r.startDate)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())[0];
    l.lastRentalDate = lastRental?.startDate || null;
    l.contractRef = lastRental?.rentalId || l.sales[0]?.saleId || null;
  }

  // Classify identity state.
  for (const l of leadMap.values()) {
    l.identityState = classifyIdentityState(l);
  }

  return { leads: Array.from(leadMap.values()), todos };
}

// ─── Stage derivation (port of pipeline-stages.ts computeLeadStage) ───────────

function isPastOrDueSoon(endDate) {
  if (!endDate) return false;
  const end = new Date(endDate).getTime();
  return end - Date.now() < 24 * 60 * 60 * 1000;
}

function computeLeadStage(lead) {
  if (lead.intentStage === "dismissed") return "closed_lost";
  if (lead.sales.length > 0 && lead.rentals.length === 0) return "closed_won";
  if (lead.rentals.length > 0) {
    const r = lead.rentals[0];
    if (r.status === "completed") return "closed_won";
    if (r.status === "cancelled") return "closed_lost";
    if (r.status === "active") return isPastOrDueSoon(r.endDate) ? "return_due" : "active_rental";
    if (r.status === "confirmed" || r.status === "pending_confirmation") {
      const qrClaimed = lead.identityState === "claimed_user" || lead.identityState === "merged";
      const hasUnclaimed = !!lead.originalOperatorChatId && !qrClaimed;
      const docsMissing =
        !r.passportMainpagePhoto
        || !r.passportRegistrationPhoto
        || !r.driversLicenceFrontalPhoto;
      if (hasUnclaimed) return r.status === "confirmed" ? "awaiting_qr_claim" : "contract_sent";
      if (docsMissing && qrClaimed) return "documents_missing";
      return "awaiting_qr_claim";
    }
  }
  if (lead.intentStage === "contract_generated") return "contract_sent";
  if (["contacted", "offer_sent", "manual_reserved", "alternative_offered"].includes(lead.intentStage || "")) return "needs_contact";
  if (lead.intentStage === "closed") return "closed_lost";
  return "new";
}

function computeQrStatus(lead) {
  if (!lead.originalOperatorChatId) return "claimed";
  const qrClaimed = lead.identityState === "claimed_user" || lead.identityState === "merged";
  if (qrClaimed) return "claimed";
  return "unclaimed";
}

// ─── Todo matching (port of pipeline-stages.ts matchTodosToLead) ──────────────

function normalizeTodoPhone(phone) {
  return normalizePhone(phone);
}

function extractTodoLeadId(todo) {
  if (todo.user_id && /^\d{1,12}$/.test(todo.user_id)) return todo.user_id;
  if (todo.phone) {
    const n = normalizeTodoPhone(todo.phone);
    if (n) return n;
  }
  if (todo.lead_id) {
    if (/^\d{1,12}$/.test(todo.lead_id)) return todo.lead_id;
    const n = normalizeTodoPhone(todo.lead_id);
    if (n) return n;
    if (todo.lead_id.includes("-")) return todo.lead_id;
  }
  if (todo.description) {
    try {
      const d = JSON.parse(todo.description);
      if (d.user_id && /^\d{1,12}$/.test(d.user_id)) return d.user_id;
      if (d.phone) { const n = normalizeTodoPhone(d.phone); if (n) return n; }
      if (d.lead_id) {
        if (/^\d{1,12}$/.test(d.lead_id)) return d.lead_id;
        const n = normalizeTodoPhone(d.lead_id);
        if (n) return n;
        if (d.lead_id.includes("-")) return d.lead_id;
      }
    } catch {}
  }
  return null;
}

function matchTodosToLead(lead, allTodos) {
  const identitySet = new Set(
    [lead.user_id, lead.phone, normalizePhone(lead.phone)].filter(Boolean)
  );
  const rentalIds = new Set(lead.rentals.map((r) => r.rentalId).filter(Boolean));
  return allTodos.filter((t) => {
    if (t.rental_id && rentalIds.has(t.rental_id)) return true;
    if (t.description) {
      try {
        const d = JSON.parse(t.description);
        if (d.rental_id && rentalIds.has(d.rental_id)) return true;
      } catch {}
    }
    const id = extractTodoLeadId(t);
    if (id && identitySet.has(id)) return true;
    return false;
  });
}

function computeAssignee(lead, todos) {
  const leadTodos = matchTodosToLead(lead, todos);
  const pending = leadTodos
    .filter((t) => t.status !== "done")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (pending.length > 0 && pending[0].assigned_to) return pending[0].assigned_to;
  const done = leadTodos
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
  if (done.length > 0 && done[0].assigned_to) return done[0].assigned_to;
  return lead.originalOperatorChatId || null;
}

// ─── SLA signals (port of sla-signals.ts computeLeadSignals) ──────────────────

function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}д ${h % 24}ч`;
  if (h > 0) return `${h}ч ${m % 60}м`;
  return `${m}м`;
}

function computeLeadSignals(lead, allTodos) {
  const signals = [];
  const now = Date.now();
  const todos = matchTodosToLead(lead, allTodos);

  if (lead.createdAt) {
    const ms = now - new Date(lead.createdAt).getTime();
    const h = ms / 36e5;
    signals.push({
      key: "first_contact",
      label: "С первого контакта",
      value: fmtDuration(ms),
      tone: h < 24 ? "neutral" : h < 72 ? "warning" : "danger",
      priority: h < 24 ? 0 : h < 72 ? 1 : 2,
    });
  }
  if (lead.lastSeenAt) {
    const ms = now - new Date(lead.lastSeenAt).getTime();
    const h = ms / 36e5;
    signals.push({
      key: "no_response",
      label: "Без отклика",
      value: fmtDuration(ms),
      detail: h > 24 ? "ОТКЛИКА НЕТ" : undefined,
      tone: h < 1 ? "good" : h < 4 ? "neutral" : h < 24 ? "warning" : "danger",
      priority: h < 1 ? 0 : h < 4 ? 1 : h < 24 ? 2 : 4,
    });
  }
  const overdue = todos.filter((t) => t.due_date && new Date(t.due_date).getTime() < now && t.status !== "done");
  if (overdue.length > 0) {
    signals.push({
      key: "overdue_todos",
      label: "Просроченные задачи",
      value: String(overdue.length),
      detail: "просроч. задачи",
      tone: overdue.length >= 2 ? "danger" : "warning",
      priority: overdue.length >= 2 ? 4 : 2,
    });
  }
  const future = lead.rentals
    .filter((r) => r.startDate && new Date(r.startDate).getTime() > now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  if (future.length > 0) {
    const ms = new Date(future[0].startDate).getTime() - now;
    const d = ms / 864e5;
    signals.push({
      key: "rental_start",
      label: "До начала аренды",
      value: fmtDuration(ms),
      tone: d > 7 ? "neutral" : d > 1 ? "warning" : "danger",
      priority: d > 7 ? 0 : d > 1 ? 2 : 4,
    });
  }
  const qrStatus = computeQrStatus(lead);
  if (qrStatus === "unclaimed" || qrStatus === "sent") {
    if (lead.createdAt) {
      const ms = now - new Date(lead.createdAt).getTime();
      const h = ms / 36e5;
      signals.push({
        key: "qr_age",
        label: "QR не принят",
        value: fmtDuration(ms),
        tone: h < 17 ? "neutral" : h < 48 ? "warning" : "danger",
        priority: h < 17 ? 1 : h < 48 ? 2 : 4,
      });
    }
  }
  const active = lead.rentals
    .filter((r) => r.status === "active" && r.endDate)
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
  if (active.length > 0) {
    const ms = new Date(active[0].endDate).getTime() - now;
    const d = ms / 864e5;
    signals.push({
      key: "until_return",
      label: "До возврата",
      value: fmtDuration(ms),
      tone: d > 3 ? "good" : d > 1 ? "warning" : "danger",
      priority: d > 3 ? 0 : d > 1 ? 2 : 4,
    });
  }
  return signals.sort((a, b) => b.priority - a.priority);
}

function isHotLead(lead, todos) {
  if ((lead.urgencyScore ?? 0) >= 80) return true;
  return computeLeadSignals(lead, todos).some((s) => s.tone === "danger");
}

function toneEmoji(tone) {
  return { good: "🟢", neutral: "⚪", warning: "🟡", danger: "🔴" }[tone] || "⚪";
}

// ─── Text table formatter ─────────────────────────────────────────────────────

function pad(str, len, align = "left") {
  str = String(str ?? "");
  if (str.length > len) return str.slice(0, Math.max(0, len - 1)) + "…";
  const spaces = " ".repeat(Math.max(0, len - str.length));
  return align === "right" ? spaces + str : str + spaces;
}

function formatTable(rows, widths) {
  // rows: array of arrays of strings. widths: array of column widths.
  return rows.map((r) => r.map((cell, i) => pad(cell, widths[i])).join("  ")).join("\n");
}

function formatMoney(rub) {
  const n = Number(rub) || 0;
  if (n === 0) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k₽`;
  return `${n}₽`;
}

function formatShortName(fullName) {
  if (!fullName) return "—";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  // "Закиров Артур Рамилевич" → "Закиров Артур"
  return `${parts[0]} ${parts[1]}`;
}

function formatAssignee(assigneeId) {
  if (!assigneeId) return "—";
  if (OPERATOR_NAMES[assigneeId]) return OPERATOR_NAMES[assigneeId];
  return `ID:${assigneeId}`;
}

function topSignal(signals) {
  if (!signals.length) return null;
  return signals[0];
}

function formatSla(signals) {
  const top = topSignal(signals);
  if (!top) return "—";
  return `${top.value} ${toneEmoji(top.tone)}`;
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdListLeads(opts) {
  const { leads, todos } = await buildLeadMap();

  // Compute stage + signals + assignee for each lead.
  for (const l of leads) {
    l.stageKey = computeLeadStage(l);
    l.qrStatus = computeQrStatus(l);
    l.signals = computeLeadSignals(l, todos);
    l.assignee = computeAssignee(l, todos);
    l.hot = isHotLead(l, todos);
  }

  // Apply filters.
  let filtered = leads;
  if (opts.hot)              filtered = filtered.filter((l) => l.hot);
  
  // Validate --stage
  if (opts.stage) {
    const validStages = ['new','needs_contact','contract_sent','awaiting_qr_claim','documents_missing','active_rental','return_due','closed_won','closed_lost'];
    if (!validStages.includes(opts.stage)) {
      console.error(`ERROR: invalid stage "${opts.stage}". Valid stages:`);
      console.error('  new, needs_contact, contract_sent, awaiting_qr_claim,');
      console.error('  documents_missing, active_rental, return_due, closed_won, closed_lost');
      process.exit(2);
    }
  }

  if (opts.stage)            filtered = filtered.filter((l) => l.stageKey === opts.stage);
  if (opts.troubled)         filtered = filtered.filter((l) => l.troubled);
  if (opts.unclaimedQr)      filtered = filtered.filter((l) => l.qrStatus === "unclaimed");
  if (opts.docsMissing)      filtered = filtered.filter((l) => l.stageKey === "documents_missing");
  if (opts.activeRental)     filtered = filtered.filter((l) => l.stageKey === "active_rental");
  if (opts.returnDue)        filtered = filtered.filter((l) => l.stageKey === "return_due");
  if (opts.overdueOnly)      filtered = filtered.filter((l) => l.signals.some((s) => s.key === "overdue_todos"));
  if (opts.hidePlaceholders) filtered = filtered.filter((l) => l.identityState !== "operator_placeholder" || l.rentals.length > 0 || l.sales.length > 0);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    filtered = filtered.filter((l) =>
      (l.full_name || "").toLowerCase().includes(q)
      || (l.phone || "").includes(q)
      || (l.username || "").toLowerCase().includes(q)
      || (l.bikeTitle || "").toLowerCase().includes(q)
    );
  }

  // Sort: hot first (by top-signal priority desc), then by lastSeenAt desc.
  filtered.sort((a, b) => {
    if (a.hot !== b.hot) return a.hot ? -1 : 1;
    const sa = topSignal(a.signals)?.priority || 0;
    const sb = topSignal(b.signals)?.priority || 0;
    if (sa !== sb) return sb - sa;
    return (b.lastSeenAt || "").localeCompare(a.lastSeenAt || "");
  });

  const totalLeads = leads.length;
  const hotCount = leads.filter((l) => l.hot).length;

  // Header.
  console.log(`=== Лиды VIP Bike (${totalLeads} всего, ${hotCount} горячих) ===`);
  if (opts.search || opts.stage || opts.hot) {
    const segs = [];
    if (opts.search)       segs.push(`поиск: "${opts.search}"`);
    
  // Validate --stage
  if (opts.stage) {
    const validStages = ['new','needs_contact','contract_sent','awaiting_qr_claim','documents_missing','active_rental','return_due','closed_won','closed_lost'];
    if (!validStages.includes(opts.stage)) {
      console.error(`ERROR: invalid stage "${opts.stage}". Valid stages:`);
      console.error('  new, needs_contact, contract_sent, awaiting_qr_claim,');
      console.error('  documents_missing, active_rental, return_due, closed_won, closed_lost');
      process.exit(2);
    }
  }

  if (opts.stage)        segs.push(`стадия: ${STAGE_LABELS[opts.stage] || opts.stage}`);
    if (opts.hot)          segs.push("только горячие");
    if (opts.troubled)     segs.push("только проблемные");
    if (opts.unclaimedQr)  segs.push("только QR не принят");
    if (opts.docsMissing)  segs.push("только документы отсутствуют");
    if (opts.activeRental) segs.push("только активные");
    if (opts.returnDue)    segs.push("только возвраты");
    if (opts.overdueOnly)  segs.push("только просроченные");
    if (opts.hidePlaceholders) segs.push("без операторов-плейсхолдеров");
    console.log(`Фильтр: ${segs.join(" | ")} → показано ${filtered.length}`);
  }
  console.log("");

  if (filtered.length === 0) {
    console.log("(нет лидов по фильтру)");
    return;
  }

  // Table.
  const widths = [22, 16, 20, 16, 22, 20, 10];
  const header = ["Имя", "Телефон", "Стадия", "SLA", "Назначен", "Байк", "Выручка"];
  console.log(formatTable([header], widths));
  console.log(widths.map((w) => "─".repeat(w)).join("  "));

  const rows = filtered.slice(0, opts.limit || 100).map((l) => [
    formatShortName(l.full_name) || (l.identityState === "operator_placeholder" ? "[оператор]" : "[аноним]"),
    l.phone || l.telegramChatId || l.user_id,
    STAGE_LABELS[l.stageKey] || l.stageKey,
    formatSla(l.signals),
    formatAssignee(l.assignee),
    l.bikeTitle ? (l.bikeTitle.length > 20 ? l.bikeTitle.slice(0, 18) + "…" : l.bikeTitle) : "—",
    formatMoney(l.totalSpent),
  ]);
  console.log(formatTable(rows, widths));

  // Funnel summary.
  console.log("");
  printFunnel(leads);
}

function printFunnel(leads) {
  const counts = {};
  for (const s of PIPELINE_STAGES) counts[s.key] = 0;
  for (const l of leads) {
    const stage = l.stageKey || computeLeadStage(l);
    counts[stage] = (counts[stage] || 0) + 1;
  }
  console.log("=== Воронка ===");
  const parts = PIPELINE_STAGES.map((s) => `${s.label}: ${counts[s.key] || 0}`);
  console.log(parts.join(" | "));
}

async function cmdLeadDetail(leadId, opts) {
  if (!leadId) {
    console.error("ERROR: leadId is required. Usage: lead-detail <leadId>");
    process.exit(2);
  }
  const { leads, todos } = await buildLeadMap();

  // Match by user_id, phone (normalized), or telegramChatId.
  const normalized = normalizePhone(leadId);
  const lead = leads.find((l) =>
    l.user_id === leadId
    || (normalized && l.phone === normalized)
    || l.telegramChatId === leadId
  );

  if (!lead) {
    console.error(`ERROR: Lead not found: ${leadId}`);
    console.error(`       Tried: user_id=${leadId}, phone=${normalized || "—"}, telegramChatId=${leadId}`);
    process.exit(2);
  }

  lead.stageKey = computeLeadStage(lead);
  lead.qrStatus = computeQrStatus(lead);
  lead.signals = computeLeadSignals(lead, todos);
  lead.assignee = computeAssignee(lead, todos);
  const leadTodos = matchTodosToLead(lead, todos);

  console.log("=== Карточка лида ===");
  console.log(`Имя:             ${lead.full_name || "[не указано]"}`);
  console.log(`Username:        ${lead.username || "—"}`);
  console.log(`Телефон:         ${lead.phone || "—"}`);
  console.log(`Telegram ID:     ${lead.telegramChatId || "—"}`);
  console.log(`User ID (key):   ${lead.user_id}`);
  console.log(`Identity:        ${lead.identityState}`);
  console.log(`Sources merged:  ${lead.sourceCount || 1}`);
  console.log(`Создан:          ${lead.createdAt || "—"}`);
  console.log(`Последняя актив: ${lead.lastSeenAt || "—"}`);
  console.log(`Intent type:     ${lead.intentType || "—"}`);
  console.log(`Intent stage:    ${lead.intentStage || "—"}`);
  console.log(`Urgency:         ${lead.urgencyScore ?? "—"}`);
  console.log(`Troubled:        ${lead.troubled ? "⚠️ " + (lead.troubledReason || "да") : "нет"}`);
  console.log(`Source route:    ${lead.sourceRoute || "—"}`);
  console.log(`Contact channel: ${lead.contactChannel || "—"}`);
  console.log("");

  console.log("=== Pipeline ===");
  console.log(`Стадия:          ${STAGE_LABELS[lead.stageKey] || lead.stageKey}`);
  console.log(`QR status:       ${lead.qrStatus}`);
  console.log(`
  // Fetch lead notes
  const notesResp = await fetch(`${SUPABASE_URL}/rest/v1/lead_notes?select=id,text,created_by,created_at&lead_id=eq.${encodeURIComponent(leadId)}&order=created_at.desc&limit=20`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const notes = await notesResp.json();
  if (Array.isArray(notes) && notes.length > 0) {
    console.log('\n--- Заметки ---');
    for (const n of notes) {
      console.log(`  [${n.created_at?.slice(0,16)}] ${n.text}`);
    }
  }

  // Следующее действие: ${STAGE_NEXT_ACTION[lead.stageKey] || "—"}`);
  console.log(`Assignee:        ${formatAssignee(lead.assignee)}`);
  console.log("");

  console.log("=== SLA-сигналы ===");
  if (lead.signals.length === 0) {
    console.log("(нет активных сигналов)");
  } else {
    for (const s of lead.signals) {
      const emoji = toneEmoji(s.tone);
      const detail = s.detail ? ` [${s.detail}]` : "";
      console.log(`${emoji} ${s.label.padEnd(28)} ${s.value}${detail}`);
    }
  }
  console.log("");

  console.log("=== Аренды ===");
  if (lead.rentals.length === 0) {
    console.log("(нет аренд)");
  } else {
    const widths = [38, 12, 12, 12, 10];
    console.log(formatTable([["ID", "Статус", "Начало", "Конец", "Сумма"]], widths));
    console.log(widths.map((w) => "─".repeat(w)).join("  "));
    const rows = lead.rentals.map((r) => [
      `${r.rentalId.slice(0, 8)}… ${r.bikeTitle || "—"}`.slice(0, 38),
      r.status,
      (r.startDate || "—").slice(0, 10),
      (r.endDate || "—").slice(0, 10),
      formatMoney(r.totalCost),
    ]);
    console.log(formatTable(rows, widths));
  }
  console.log("");

  console.log("=== Покупки ===");
  if (lead.sales.length === 0) {
    console.log("(нет покупок)");
  } else {
    for (const s of lead.sales) {
      console.log(`  • ${s.saleId.slice(0, 8)}…  ${s.bikeTitle || "—"}  ${formatMoney(s.salePrice)}  (${s.createdAt?.slice(0, 10) || "—"})`);
    }
  }
  console.log("");

  console.log("=== Задачи ===");
  if (leadTodos.length === 0) {
    console.log("(нет задач)");
  } else {
    const now = Date.now();
    for (const t of leadTodos) {
      const overdue = t.due_date && new Date(t.due_date).getTime() < now && t.status !== "done";
      const flag = overdue ? "⚠️ ПРОСРОЧЕНА " : "";
      const due = t.due_date ? ` (due: ${t.due_date.slice(0, 10)})` : "";
      const assignee = t.assigned_to ? ` → ${formatAssignee(t.assigned_to)}` : "";
      const status = t.status === "done" ? "✓" : t.status === "in_progress" ? "…" : "○";
      console.log(`  ${status} ${flag}${t.title}${due}${assignee}`);
    }
  }
  console.log("");

  console.log("=== Документы ===");
  if (lead.rentals.length === 0) {
    console.log("(нет аренд — документы не привязаны)");
  } else {
    const r = lead.rentals[0];
    const checks = [
      ["Паспорт (главная)",     !!r.passportMainpagePhoto],
      ["Паспорт (регистрация)", !!r.passportRegistrationPhoto],
      ["Водительское удостоверение", !!r.driversLicenceFrontalPhoto],
    ];
    for (const [label, ok] of checks) {
      console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    }
  }
  console.log("");

  console.log("=== QR-claim ===");
  console.log(`Status: ${lead.qrStatus}`);
  if (lead.originalOperatorChatId) {
    console.log(`Original operator: ${formatAssignee(lead.originalOperatorChatId)}`);
    console.log(`Claim state: ${lead.identityState === "merged" ? "merged (renter claimed)" : "operator placeholder"}`);
  } else {
    console.log("(лид создан напрямую арендатором, без оператора)");
  }
  console.log("");

  console.log("=== Следующее рекомендованное действие ===");
  console.log(STAGE_NEXT_ACTION[lead.stageKey] || "—");
  if (lead.signals.some((s) => s.tone === "danger")) {
    const top = lead.signals.find((s) => s.tone === "danger");
    console.log(`⚠️ Критический сигнал: ${top.label} — ${top.value}${top.detail ? ` (${top.detail})` : ""}`);
  }
}

async function cmdDismissLead(leadId, opts) {
  if (!leadId) {
    console.error("ERROR: leadId is required. Usage: dismiss-lead <leadId> --reason <reason>");
    process.exit(2);
  }
  if (!opts.reason) {
    console.error("ERROR: --reason is required. Valid reasons:");
    for (const r of DISMISS_REASONS) {
      console.error(`  ${r.value.padEnd(20)} ${r.label}${r.requiresNote ? " (requires --note)" : ""}`);
    }
    process.exit(2);
  }
  const validReason = DISMISS_REASONS.find((r) => r.value === opts.reason);
  if (!validReason) {
    console.error(`ERROR: invalid reason "${opts.reason}". Valid reasons:`);
    for (const r of DISMISS_REASONS) console.error(`  ${r.value}`);
    process.exit(2);
  }
  if (validReason.requiresNote && !opts.note?.trim()) {
    console.error(`ERROR: reason "${opts.reason}" requires --note "<text>"`);
    process.exit(2);
  }

  // Find the franchize_intents row matching this leadId.
  // leadId may be telegram_user_id OR phone — try both.
  const normalizedPhone = normalizePhone(leadId);
  const filters = normalizedPhone
    ? [`slug=eq.${CREW_SLUG}`, `or=(telegram_user_id.eq.${leadId},phone.eq.${normalizedPhone})`]
    : [`slug=eq.${CREW_SLUG}`, `telegram_user_id=eq.${leadId}`];

  const intents = await supabaseQuery("franchize_intents", {
    select: "id,metadata,stage",
    filters,
    order: "updated_at.desc",
    limit: 1,
  });

  if (!intents || intents.length === 0) {
    console.error(`ERROR: Lead not found in franchize_intents: ${leadId}`);
    process.exit(2);
  }

  const intent = intents[0];
  const existingMeta = (intent.metadata && typeof intent.metadata === "object") ? intent.metadata : {};
  const updatedMeta = {
    ...existingMeta,
    dismissReason: opts.reason,
    dismissNote: opts.note?.trim() || null,
    dismissedAt: new Date().toISOString(),
    dismissedBy: opts.actorUserId || process.env.LEADS_CLI_ACTOR || null,
  };

  let patched;
  try {
    patched = await supabasePatch(
      "franchize_intents",
      [`id=eq.${intent.id}`],
      {
        stage: "dismissed",
        metadata: updatedMeta,
        last_seen_at: new Date().toISOString(),
      },
    );
  } catch (err) {
    // Detect the CHECK constraint violation on the stage column and print a
    // helpful hint — the production DB must allow "dismissed" as a stage value.
    // Constraint name: franchize_intents_stage_allowed (migration 20260508120000).
    if (err.message.includes("23514") || /new row for relation "franchize_intents"/.test(err.message)) {
      console.error("ERROR: Supabase CHECK constraint 'franchize_intents_stage_allowed' rejected 'dismissed' stage.");
      console.error("       The DB constraint has not been updated to allow stage='dismissed'.");
      console.error("       Run this migration on the production DB first:");
      console.error("");
      console.error("         ALTER TABLE public.franchize_intents");
      console.error("           DROP CONSTRAINT IF EXISTS franchize_intents_stage_allowed;");
      console.error("         ALTER TABLE public.franchize_intents");
      console.error("           ADD CONSTRAINT franchize_intents_stage_allowed CHECK (");
      console.error("             stage IN (");
      console.error("               'discovered','clicked','prebuy_started','checkout_started',");
      console.error("               'hold_created','payment_failed','payment_confirmed',");
      console.error("               'contacted','test_ride_requested','viewed','configured',");
      console.error("               'contract_generated','alternative_offered','offer_sent',");
      console.error("               'manual_reserved','closed','dismissed'");
      console.error("             )");
      console.error("           );");
      console.error("");
      console.error(`       Original error: ${err.message.split("\n")[0]}`);
      process.exit(2);
    }
    throw err;  // re-throw unexpected errors
  }

  if (!patched || patched.length === 0) {
    console.error("ERROR: PATCH returned no rows. The intent may have been deleted between SELECT and PATCH.");
    console.error(`       Intent ID: ${intent.id}`);
    process.exit(2);
  }

  console.log("✓ Лид отклонён");
  console.log(`  ID:           ${intent.id}`);
  console.log(`  Lead key:     ${leadId}`);
  console.log(`  Reason:       ${opts.reason} (${validReason.label})`);
  if (opts.note) console.log(`  Note:         ${opts.note}`);
  console.log(`  Dismissed at: ${updatedMeta.dismissedAt}`);
  console.log(`  By:           ${updatedMeta.dismissedBy || "—"}`);
}

async function cmdListTodos(opts) {
  const { leads, todos } = await buildLeadMap();

  let filtered = todos;
  if (opts.leadId) {
    // Filter todos matching this lead (via matchTodosToLead).
    const normalized = normalizePhone(opts.leadId);
    const lead = leads.find((l) =>
      l.user_id === opts.leadId
      || (normalized && l.phone === normalized)
      || l.telegramChatId === opts.leadId
    );
    if (!lead) {
      console.error(`ERROR: Lead not found: ${opts.leadId}`);
      process.exit(2);
    }
    filtered = matchTodosToLead(lead, todos);
  }
  if (opts.overdue) {
    const now = Date.now();
    filtered = filtered.filter((t) => t.due_date && new Date(t.due_date).getTime() < now && t.status !== "done");
  }
  if (opts.mine) {
    filtered = filtered.filter((t) => t.assigned_to === opts.mine);
  }
  if (opts.status) {
    filtered = filtered.filter((t) => t.status === opts.status);
  }

  // Dedupe by id.
  const seen = new Set();
  const deduped = [];
  for (const t of filtered) {
    if (t.id && seen.has(t.id)) continue;
    if (t.id) seen.add(t.id);
    deduped.push(t);
  }

  console.log(`=== Задачи VIP Bike (${deduped.length}) ===`);
  if (opts.leadId || opts.overdue || opts.mine || opts.status) {
    const segs = [];
    if (opts.leadId)  segs.push(`lead: ${opts.leadId}`);
    if (opts.overdue) segs.push("только просроченные");
    if (opts.mine)    segs.push(`assignee: ${opts.mine}`);
    if (opts.status)  segs.push(`status: ${opts.status}`);
    console.log(`Фильтр: ${segs.join(" | ")}`);
  }
  console.log("");

  if (deduped.length === 0) {
    console.log("(нет задач по фильтру)");
    return;
  }

  const widths = [38, 12, 12, 14, 16];
  console.log(formatTable([["Заголовок", "Статус", "Due", "Assignee", "Категория"]], widths));
  console.log(widths.map((w) => "─".repeat(w)).join("  "));

  const now = Date.now();
  const rows = deduped.slice(0, opts.limit || 200).map((t) => {
    const overdue = t.due_date && new Date(t.due_date).getTime() < now && t.status !== "done";
    return [
      (overdue ? "⚠️ " : "") + (t.title || "(без заголовка)"),
      t.status,
      t.due_date ? t.due_date.slice(0, 10) : "—",
      formatAssignee(t.assigned_to),
      t.category,
    ];
  });
  console.log(formatTable(rows, widths));
}

async function cmdKpis(opts) {
  const mode = opts.mode || "rent";
  if (!["rent", "sale", "service"].includes(mode)) {
    console.error(`ERROR: invalid mode "${mode}". Use rent|sale|service.`);
    process.exit(2);
  }

  const { leads, todos } = await buildLeadMap();

  const modeIntents = {
    rent: ["rent", "test_drive", "test_ride_click", "checkout_start", "prebuy", "trade_in", "finance", "hold_created", "payment_failure", "payment_success", "map_click", "contact_click"],
    sale: ["sale"],
    service: ["service"],
  };
  const filtered = leads.filter((l) => modeIntents[mode].includes(l.intentType || ""));

  // Compute stage for each.
  for (const l of filtered) {
    l.stageKey = computeLeadStage(l);
    l.signals = computeLeadSignals(l, todos);
    l.hot = isHotLead(l, todos);
  }

  const totalLeads = filtered.filter((l) => l.stageKey !== "closed_lost").length;
  const hotLeads = filtered.filter((l) => l.hot).length;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 864e5);
  const recent = filtered.filter((l) => l.createdAt && new Date(l.createdAt) >= thirtyDaysAgo);
  const recentWon = recent.filter((l) => l.stageKey === "closed_won").length;
  const conversionRate = recent.length > 0 ? Math.round((recentWon / recent.length) * 100) : 0;

  const monthlyRevenue = filtered.reduce((sum, l) => {
    return sum + l.rentals
      .filter((r) => r.status === "active" || r.status === "completed")
      .reduce((s, r) => s + (Number(r.totalCost) || 0), 0);
  }, 0);

  console.log(`=== KPI лидов VIP Bike (mode: ${mode}) ===`);
  console.log(`Всего лидов:        ${totalLeads}`);
  console.log(`Горячих:            ${hotLeads}`);
  console.log(`Конверсия (30д):    ${conversionRate}% (${recentWon}/${recent.length})`);
  console.log(`Выручка за период:  ${formatMoney(monthlyRevenue)}`);
}

async function cmdPipelineFunnel(opts) {
  const { leads, todos } = await buildLeadMap();
  for (const l of leads) l.stageKey = computeLeadStage(l);
  printFunnel(leads);
  console.log("");
  console.log(`Всего лидов: ${leads.length}`);
  const hot = leads.filter((l) => isHotLead(l, todos)).length;
  console.log(`Горячих:     ${hot}`);
}

// ─── CLI arg parser ───────────────────────────────────────────────────────────

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const eq = key.indexOf("=");
      if (eq >= 0) {
        opts[key.slice(0, eq)] = key.slice(eq + 1);
      } else if (i + 1 < rest.length && !rest[i + 1].startsWith("--")) {
        opts[key] = rest[++i];
      } else {
        // boolean flag
        opts[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { command, opts, positional };
}

function printUsage() {
  console.log(`leads-query.mjs — text-based CRM leads dashboard for VIP Bike

Usage:
  node leads-query.mjs list-leads [filters]
  node leads-query.mjs lead-detail <leadId>
  node leads-query.mjs dismiss-lead <leadId> --reason <reason> [--note <text>]
  node leads-query.mjs list-todos [--leadId <id>] [--overdue] [--mine <userId>] [--status <s>]
  node leads-query.mjs kpis [--mode rent|sale|service]
  node leads-query.mjs pipeline-funnel

list-leads filters:
  --hot                    Only hot leads (urgency >= 80 OR any danger signal)
  --stage <key>            Filter by stage (new|needs_contact|contract_sent|
                           awaiting_qr_claim|documents_missing|active_rental|
                           return_due|closed_won|closed_lost)
  --troubled               Only troubled leads
  --unclaimedQr            Only leads with QR not claimed
  --docsMissing            Only leads with missing documents
  --activeRental           Only active rentals
  --returnDue              Only rentals due soon
  --overdueOnly            Only leads with overdue todos
  --hidePlaceholders       Hide pure operator-placeholder leads with no activity
  --search <text>          Search by name/phone/username/bikeTitle
  --limit <n>              Max rows to print (default 100)

dismiss-lead reasons:`);
  for (const r of DISMISS_REASONS) {
    console.log(`  ${r.value.padEnd(20)} ${r.label}${r.requiresNote ? "  (requires --note)" : ""}`);
  }
  console.log(`
Environment:
  SUPABASE_URL                Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY   Service role key (or read from --secrets path)
  --secrets <path>            Path to secrets.txt (default: ${DEFAULT_SECRETS_PATH})
  LEADS_CLI_ACTOR             User ID to record as actor for dismiss-lead
`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "-h" || argv[0] === "--help") {
    printUsage();
    process.exit(0);
  }

  const { command, opts, positional } = parseArgs(argv);

  // Init Supabase client.
  initSupabase({
    url: opts.SUPABASE_URL,
    key: opts.SUPABASE_SERVICE_ROLE_KEY,
    secretsPath: opts.secrets,
  });

  try {
    switch (command) {
      case "list-leads":
        await cmdListLeads(opts);
        break;
      case "lead-detail": {
        const leadId = positional[0] || opts.leadId;
        await cmdLeadDetail(leadId, opts);
        break;
      }
      case "dismiss-lead": {
        const leadId = positional[0] || opts.leadId;
        await cmdDismissLead(leadId, opts);
        break;
      }
      case "list-todos":
        if (opts.leadId === true) opts.leadId = positional[0];
        await cmdListTodos(opts);
        break;
      case "kpis":
        await cmdKpis(opts);
        break;
      case "pipeline-funnel":
      case "funnel":
        await cmdPipelineFunnel(opts);
        break;
      default:
        console.error(`ERROR: unknown command "${command}"`);
        printUsage();
        process.exit(2);
    }
  } catch (err) {
    console.error(`ERROR: ${err.message || err}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(2);
  }
}

main();
