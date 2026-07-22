#!/usr/bin/env node
// rental-query.mjs — Text-based rental card detail for VIP Bike.
//
// Mirrors the data shown on `/franchize/vip-bike/rental/<id>` page:
// rental status, dates, cost, payment, bike, renter, documents
// (passport/license photos), QR-claim state, verification todos,
// handoff checklist, contract artifact, message threads, status history.
//
// Read-only commands:
//   node rental-query.mjs rental-card <rentalId>
//   node rental-query.mjs rental-todos <rentalId>
//   node rental-query.mjs rental-documents <rentalId>
//   node rental-query.mjs rental-handoff <rentalId>
//   node rental-query.mjs list-rentals [--status active|completed|cancelled|pending] [--date YYYY-MM-DD]
//   node rental-query.mjs rental-history <rentalId>
//
// Write commands (activate/complete/update-status/send-message) are documented
// as curl recipes in SKILL.md — they require operator auth context that lives
// in the Next.js server-actions layer, not in this read-only CLI.
//
// Env:
//   SUPABASE_URL            (default: https://inmctohsodgdohamhzag.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (fallback: read from --secrets=<path> or
//                                /home/z/my-project/upload/secrets.txt)
//
// All output goes to stdout; errors go to stderr with exit code 2.

import { readFileSync } from "node:fs";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SUPA_URL = "https://inmctohsodgdohamhzag.supabase.co";
const DEFAULT_SECRETS_PATH = "/home/z/my-project/upload/secrets.txt";

const CREW_SLUG = "vip-bike";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";
const CREW_OWNER_ID = "356282674";

// Operator chat IDs for vip-bike — used by classifyIdentityState to detect
// operator-placeholder rentals (created by an operator before the renter
// scans their QR and claims). From /home/z/my-project/upload/secrets.txt:
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

const OPERATOR_NAMES = {
  "356282674": "Илья О. (owner)",
  "244736261": "Роман Б. (co-owner)",
  "413553377": "Артур С. (admin)",
  "7813830016": "Джордан (member)",
};

const STATUS_LABELS = {
  pending_confirmation: "Ожидает",
  confirmed:            "Подтверждена",
  active:               "Активна",
  completed:            "Завершена",
  cancelled:            "Отменена",
  disputed:             "Спор",
};

const PAYMENT_LABELS = {
  pending:      "Ожидает оплаты",
  interest_paid:"Депозит внесён",
  fully_paid:   "Полностью оплачено",
  refunded:     "Возврат",
  failed:       "Ошибка платежа",
};

const VERIFICATION_TODO_TYPES = [
  "passport_mainpage",
  "passport_registration",
  "drivers_license",
  "odometer",
  "dates",
];

const VERIFICATION_TODO_LABELS = {
  passport_mainpage:     "Паспорт (главная)",
  passport_registration: "Паспорт (прописка)",
  drivers_license:       "Вод. удостоверение",
  odometer:              "Одометр (старт)",
  dates:                 "Даты аренды",
};

const WEB_BASE = "https://vip-bike.ru/franchize/vip-bike/rental";

// ─── Phone normalization (port of /app/franchize/lib/phone-utils.ts) ──────────

function normalizePhone(phone) {
  if (!phone) return null;
  let s = String(phone).trim().replace(/[\s\-()]/g, "");
  if (!s) return null;
  if (/^8\d{10}$/.test(s))      s = "+7" + s.slice(1);
  else if (/^7\d{10}$/.test(s)) s = "+" + s;
  else if (/^\d{10}$/.test(s))  s = "+7" + s;
  else if (!s.startsWith("+"))  s = "+" + s;
  return s;
}

function isNumericTelegramId(id) {
  if (!id) return false;
  return /^\d{1,12}$/.test(id);
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
 * Query a Supabase table via REST (PostgREST).
 *
 * @param {string} table
 * @param {object} q        { select, filters[], order, limit, headers }
 * @param {object} opts     { schema: "public" | "private" }
 * @returns {Promise<Array<object>>}
 */
async function supabaseQuery(table, q = {}, opts = {}) {
  const schema = opts.schema || "public";
  const params = new URLSearchParams();

  if (q.select) params.set("select", q.select);

  if (Array.isArray(q.filters)) {
    for (const f of q.filters) {
      // Each filter is "col=op.value" — split on the FIRST "=".
      const eq = f.indexOf("=");
      if (eq < 0) continue;
      const key = f.slice(0, eq);
      const val = f.slice(eq + 1);
      // Use append so multiple filters on the same column are preserved.
      params.append(key, val);
    }
  }

  if (q.order) params.set("order", q.order);
  if (q.limit) params.set("limit", String(q.limit));

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

/**
 * Fetch a single row from a table.
 */
async function supabaseSingle(table, q = {}, opts = {}) {
  const rows = await supabaseQuery(table, { ...q, limit: 1 }, opts);
  return rows && rows.length > 0 ? rows[0] : null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function pad(str, len, align = "left") {
  str = String(str ?? "");
  if (str.length > len) return str.slice(0, Math.max(0, len - 1)) + "…";
  const spaces = " ".repeat(Math.max(0, len - str.length));
  return align === "right" ? spaces + str : str + spaces;
}

function formatTable(rows, widths) {
  return rows.map((r) => r.map((cell, i) => pad(cell, widths[i])).join("  ")).join("\n");
}

function formatMoney(rub) {
  const n = Number(rub) || 0;
  if (n === 0) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k₽`;
  return `${n}₽`;
}

function formatMoneyFull(rub) {
  const n = Number(rub) || 0;
  if (n === 0) return "—";
  return n.toLocaleString("ru-RU") + " ₽";
}

function formatShortName(fullName) {
  if (!fullName) return "—";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`;
}

function formatAssignee(assigneeId) {
  if (!assigneeId) return "—";
  if (OPERATOR_NAMES[assigneeId]) return OPERATOR_NAMES[assigneeId];
  return `ID:${assigneeId}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(iso).slice(0, 10);
  }
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
    return d.toISOString().slice(0, 16).replace("T", " ");
  } catch {
    return String(iso).slice(0, 16);
  }
}

function yesNo(b) {
  return b ? "✓" : "✗";
}

function maskPhone(phone) {
  if (!phone) return "—";
  const s = String(phone);
  if (s.length < 7) return s;
  return s.slice(0, -4) + "XXXX";
}

function maskName(fullName) {
  if (!fullName) return "—";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1][0]}.`;
  return `${parts[0]} ${parts[1][0]}.${parts[2][0]}.`;
}

function webLink(rentalId) {
  return `🌐 Web: ${WEB_BASE}/${rentalId}`;
}

function extractTodoTypeFromDescription(desc) {
  if (!desc) return null;
  try {
    const d = typeof desc === "string" ? JSON.parse(desc) : desc;
    return d?.todo_type || null;
  } catch {
    return null;
  }
}

function extractRentalIdFromDescription(desc) {
  if (!desc) return null;
  try {
    const d = typeof desc === "string" ? JSON.parse(desc) : desc;
    return d?.rental_id || null;
  } catch {
    return null;
  }
}

// ─── Identity classification (port of leads.ts classifyIdentityState) ─────────

/**
 * Determines whether a rental is in operator-placeholder state (created by an
 * operator before the renter scans the QR), claimed by renter, or phone-only.
 *
 * Mirrors /app/franchize/server-actions/leads.ts logic.
 */
function classifyRentalIdentityState(rental) {
  const userId = rental.user_id;
  const originalOp = rental.created_by_operator_chat_id || null;

  if (CREW_OPERATOR_IDS.has(userId)) return "operator_placeholder";

  if (originalOp && CREW_OPERATOR_IDS.has(originalOp) && originalOp !== userId) {
    return "merged";
  }

  if (isNumericTelegramId(userId)) return "claimed_user";

  // user_id looks like a phone number (no Telegram auth yet)
  if (userId && /^(\+7|7|8)\d{10}$/.test(userId.replace(/[\s\-()]/g, ""))) {
    return "phone_only";
  }

  return "operator_placeholder";
}

/**
 * QR claim status — mirrors computeQrStatus() from leads-crm-text.
 *
 * - "claimed"      — renter has scanned the QR and the rental is bound to their TG ID
 * - "unclaimed"    — rental was created by an operator placeholder; QR not yet scanned
 * - "not_applicable" — rental has no operator provenance (renter-created directly)
 */
function computeQrStatus(rental) {
  if (!rental.created_by_operator_chat_id) return "not_applicable";
  const identityState = classifyRentalIdentityState(rental);
  if (identityState === "claimed_user" || identityState === "merged") return "claimed";
  return "unclaimed";
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchRental(rentalId) {
  return supabaseSingle("rentals", {
    select: [
      "rental_id",
      "user_id",
      "vehicle_id",
      "owner_id",
      "crew_id",
      "status",
      "payment_status",
      "interest_amount",
      "total_cost",
      "requested_start_date",
      "requested_end_date",
      "agreed_start_date",
      "agreed_end_date",
      "delivery_address",
      "metadata",
      "passport_mainpage_photo",
      "passport_registration_photo",
      "drivers_licence_frontal_photo",
      "created_by_operator_chat_id",
      "created_at",
      "updated_at",
    ].join(","),
    filters: [`rental_id=eq.${rentalId}`],
  });
}

async function fetchVehicle(vehicleId) {
  if (!vehicleId) return null;
  return supabaseSingle("cars", {
    select: "id,make,model,type,specs,crew_id",
    filters: [`id=eq.${vehicleId}`],
  });
}

async function fetchUser(userId) {
  if (!userId) return null;
  return supabaseSingle("users", {
    select: "user_id,username,full_name,metadata",
    filters: [`user_id=eq.${userId}`],
  });
}

async function fetchRentalSecret(rentalId) {
  if (!rentalId) return null;
  // Get the LATEST secret by created_at desc for this rental
  const rows = await supabaseQuery("user_rental_secrets", {
    select: [
      "id",
      "chat_id",
      "crew_slug",
      "doc_sha256",
      "renter_full_name",
      "renter_passport",
      "renter_passport_issued_by",
      "renter_passport_issue_date",
      "renter_registration",
      "renter_driver_license",
      "renter_birth_date",
      "renter_phone",
      "renter_email",
      "renter_address",
      "source_doc_key",
      "source_rental_id",
      "verification_status",
      "template_version",
      "is_web_app_flow",
      "qr_generated_at",
      "qr_first_viewed_at",
      "qr_claimed_at",
      "qr_regeneration_count",
      "original_doc_sha256",
      "passport_mainpage_photo",
      "passport_registration_photo",
      "drivers_licence_frontal_photo",
      "created_at",
      "updated_at",
    ].join(","),
    filters: [`source_rental_id=eq.${rentalId}`],
    order: "created_at.desc",
    limit: 5,
  }, { schema: "private" });
  return rows && rows.length > 0 ? rows[0] : null;
}

async function fetchContractArtifact(rentalId) {
  if (!rentalId) return null;
  const rows = await supabaseQuery("rental_contract_artifacts", {
    select: [
      "id",
      "contract_key",
      "requested_bike_id",
      "resolved_bike_id",
      "telegram_chat_id",
      "telegram_message_id",
      "renter_full_name",
      "renter_passport",
      "renter_passport_issued_by",
      "renter_passport_issue_date",
      "renter_registration",
      "renter_driver_license",
      "renter_birth_date",
      "license_categories",
      "rent_start_date",
      "rent_end_date",
      "daily_price",
      "deposit_rub",
      "total_sum",
      "original_sha256",
      "doc_verifier_id",
      "template_version",
      "created_at",
      "sts_pledge_used",
      "sts_series",
      "sts_number",
      "sts_vehicle_plate",
      "sts_vehicle_vin",
      "sts_vehicle_model",
      "sts_owner_full_name",
      "rental_id",
      "storage_path",
      "crew_slug",
      "renter_phone",
      "created_by_operator_chat_id",
    ].join(","),
    filters: [`rental_id=eq.${rentalId}`],
    order: "created_at.desc",
    limit: 3,
  }, { schema: "private" });
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Fetch all crew_todos that reference this rental.
 *
 * Lookup paths (mirrors /app/franchize/server-actions/rentals-dashboard.ts and
 * rental-verification-todos.ts):
 *   1. crew_todos.rental_id = <rentalId>  (Phase 3c FK — primary)
 *   2. crew_todos.description->>'rental_id' = <rentalId>  (legacy fallback)
 *
 * We fetch with filter #1 directly via PostgREST, then ALSO fetch by category
 * without filter and filter in JS for legacy rows that only have it in JSON.
 */
async function fetchRentalTodos(rentalId, opts = {}) {
  // Primary: by FK column
  const fkTodos = await supabaseQuery("crew_todos", {
    select: "id,crew_id,lead_id,user_id,phone,rental_id,title,description,category,status,priority,due_date,assigned_to,created_by,created_at,completed_at,updated_at",
    filters: [`rental_id=eq.${rentalId}`],
    order: "created_at.asc",
    limit: 200,
  });

  // Legacy fallback: rows where rental_id is null but description has it in JSON.
  // We can't filter JSON via PostgREST directly, so we fetch crew-scoped rows
  // and filter in JS. Limited to rental_verification + lead_followup categories
  // to keep the result set reasonable.
  const { categoryFilter } = opts;
  const cats = categoryFilter || ["rental_verification", "lead_followup"];
  const catIn = `category=in.(${cats.join(",")})`;
  const legacyTodosRaw = await supabaseQuery("crew_todos", {
    select: "id,crew_id,lead_id,user_id,phone,rental_id,title,description,category,status,priority,due_date,assigned_to,created_by,created_at,completed_at,updated_at",
    filters: [`crew_id=eq.${CREW_ID}`, catIn, `rental_id=is.null`],
    order: "created_at.desc",
    limit: 1000,
  });
  const legacyTodos = legacyTodosRaw.filter((t) => {
    const rid = extractRentalIdFromDescription(t.description);
    return rid === rentalId;
  });

  // Merge & dedupe by id
  const seen = new Set();
  const merged = [];
  for (const t of [...fkTodos, ...legacyTodos]) {
    if (t.id && seen.has(t.id)) continue;
    if (t.id) seen.add(t.id);
    merged.push(t);
  }
  // Sort by created_at asc
  merged.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  return merged;
}

async function fetchHandoffs(rentalId) {
  if (!rentalId) return { handout: null, return: null, error: null };
  let rows;
  try {
    rows = await supabaseQuery("rental_handoffs", {
      select: [
        "id",
        "rental_id",
        "phase",
        "passport_checked",
        "license_checked",
        "deposit_collected",
        "helmet_issued",
        "keys_issued",
        "instructions_given",
        "photos_taken",
        "condition_checked",
        "helmet_returned",
        "keys_returned",
        "deposit_returned",
        "no_damages_confirmed",
        "odometer_start",
        "odometer_end",
        "fuel_level_start",
        "fuel_level_end",
        "battery_level_start",
        "battery_level_end",
        "damage_notes",
        "handout_notes",
        "return_notes",
        "keys_count",
        "charger_included",
        "lock_cable_included",
        "jacket_issued",
        "second_helmet_issued",
        "bag_issued",
        "net_issued",
        "camera_mount_issued",
        "moto_cover_issued",
        "ebike_charger_issued",
        "other_equipment",
        "equipment_condition_return",
        "completed_at",
        "completed_by",
        "created_at",
        "updated_at",
      ].join(","),
      filters: [`rental_id=eq.${rentalId}`],
      order: "phase.asc",
      limit: 10,
    });
  } catch (err) {
    // rental_handoffs table is created by a migration that may not yet be
    // applied to the target DB. Return a graceful "table missing" marker
    // instead of crashing the whole rental-card command.
    if (err.message && err.message.includes("42P01")) {
      return { handout: null, return: null, error: "table_missing" };
    }
    throw err;
  }
  const handout = rows.find((h) => h.phase === "handout") || null;
  const ret     = rows.find((h) => h.phase === "return")  || null;
  return { handout, return: ret, error: null };
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * `rental-card <rentalId>` — full rental detail.
 *
 * Sections: header (id, status, payment, dates, cost), bike, renter (TG id,
 * name, phone, identity state), QR-claim state, verification todos (counts),
 * documents (passport/license photos on rental + secret), handoff summary,
 * contract artifact (sha256, contract_key, dates, total_sum), messages hint,
 * next recommended action.
 */
async function cmdRentalCard(rentalId) {
  if (!rentalId) {
    console.error("ERROR: rentalId is required. Usage: rental-card <rentalId>");
    process.exit(2);
  }

  const rental = await fetchRental(rentalId);
  if (!rental) {
    console.error(`ERROR: Rental not found: ${rentalId}`);
    console.error(`       Check the rental_id (must be a UUID).`);
    process.exit(2);
  }

  // Parallel enrichment
  const [vehicle, renter, secret, artifact, todos, handoffs] = await Promise.all([
    fetchVehicle(rental.vehicle_id),
    fetchUser(rental.user_id),
    fetchRentalSecret(rentalId),
    fetchContractArtifact(rentalId),
    fetchRentalTodos(rentalId),
    fetchHandoffs(rentalId),
  ]);

  const identityState = classifyRentalIdentityState(rental);
  const qrStatus      = computeQrStatus(rental);
  const vehicleTitle  = vehicle ? `${vehicle.make || "—"} ${vehicle.model || ""}`.trim() : "—";
  const statusLabel   = STATUS_LABELS[rental.status] || rental.status;
  const paymentLabel  = PAYMENT_LABELS[rental.payment_status] || rental.payment_status || "—";

  const renterName = renter?.full_name
    || renter?.metadata?.fullName
    || renter?.metadata?.display_name
    || secret?.renter_full_name
    || artifact?.renter_full_name
    || "[не указано]";
  const renterUsername = renter?.username || "—";
  const renterPhone = normalizePhone(renter?.metadata?.phone)
    || normalizePhone(secret?.renter_phone)
    || normalizePhone(artifact?.renter_phone)
    || "—";

  // Verification todos breakdown
  const verifTodos = todos.filter((t) => t.category === "rental_verification");
  const verifDone  = verifTodos.filter((t) => t.status === "done").length;
  const verifTotal = verifTodos.length;
  const allVerifDone = verifTotal > 0 && verifDone === verifTotal;

  // Documents present
  const docsOnRental = {
    passportMainpage:     !!rental.passport_mainpage_photo,
    passportRegistration: !!rental.passport_registration_photo,
    driversLicense:       !!rental.drivers_licence_frontal_photo,
  };
  const docsOnSecret = secret ? {
    passportMainpage:     !!secret.passport_mainpage_photo,
    passportRegistration: !!secret.passport_registration_photo,
    driversLicense:       !!secret.drivers_licence_frontal_photo,
  } : { passportMainpage: false, passportRegistration: false, driversLicense: false };

  // Contract verification (stored in rental.metadata.contract_verifier)
  const meta = (rental.metadata && typeof rental.metadata === "object") ? rental.metadata : {};
  const verifier = (meta.contract_verifier && typeof meta.contract_verifier === "object")
    ? meta.contract_verifier : null;
  const contractVerificationStatus = verifier?.status
    ? (verifier.status === "verified" || verifier.status === "ok" || verifier.status === "valid"
        ? "verified"
        : verifier.status === "expired" ? "expired" : "not_verified")
    : "not_verified";

  console.log("=== Карточка аренды ===");
  console.log(`Rental ID:        ${rental.rental_id}`);
  console.log(`Crew:             ${CREW_SLUG} (${CREW_ID})`);
  console.log(`Статус:           ${statusLabel} (${rental.status})`);
  console.log(`Оплата:           ${paymentLabel} (${rental.payment_status || "—"})`);
  console.log(`Итого:            ${formatMoneyFull(rental.total_cost)}`);
  if (rental.interest_amount) {
    console.log(`Депозит:          ${formatMoneyFull(rental.interest_amount)}`);
  }
  console.log("");
  console.log("=== Даты ===");
  console.log(`Запрошенные:      ${fmtDateTime(rental.requested_start_date)} → ${fmtDateTime(rental.requested_end_date)}`);
  if (rental.agreed_start_date || rental.agreed_end_date) {
    console.log(`Согласованные:    ${fmtDateTime(rental.agreed_start_date)} → ${fmtDateTime(rental.agreed_end_date)}`);
  }
  console.log(`Создана:          ${fmtDateTime(rental.created_at)}`);
  console.log(`Обновлена:        ${fmtDateTime(rental.updated_at)}`);
  if (rental.delivery_address) {
    console.log(`Адрес доставки:   ${rental.delivery_address}`);
  }
  console.log("");

  console.log("=== Транспорт ===");
  if (vehicle) {
    console.log(`Байк:             ${vehicleTitle}`);
    console.log(`ID ТС:            ${vehicle.id}`);
    console.log(`Тип:              ${vehicle.type || "—"}`);
    if (vehicle.crew_id) console.log(`Crew ID (ТС):     ${vehicle.crew_id}`);
  } else {
    console.log(`Байк:             — (vehicle_id=${rental.vehicle_id || "—"} не найден в cars)`);
  }
  console.log("");

  console.log("=== Арендатор ===");
  console.log(`Имя:              ${renterName}`);
  console.log(`Username:         ${renterUsername}`);
  console.log(`Телефон:          ${maskPhone(renterPhone)}`);
  console.log(`Telegram ID:      ${rental.user_id || "—"}`);
  console.log(`Identity state:   ${identityState}`);
  console.log(`Owner ID:         ${rental.owner_id || "—"} (${formatAssignee(rental.owner_id)})`);
  if (rental.created_by_operator_chat_id) {
    console.log(`Created by op:    ${rental.created_by_operator_chat_id} (${formatAssignee(rental.created_by_operator_chat_id)})`);
  }
  console.log("");

  console.log("=== QR-claim ===");
  console.log(`Status:           ${qrStatus}`);
  if (secret) {
    if (secret.qr_generated_at) console.log(`QR generated:     ${fmtDateTime(secret.qr_generated_at)}`);
    if (secret.qr_first_viewed_at) console.log(`QR first viewed:  ${fmtDateTime(secret.qr_first_viewed_at)}`);
    if (secret.qr_claimed_at)  console.log(`QR claimed:       ${fmtDateTime(secret.qr_claimed_at)}`);
    if (secret.qr_regeneration_count != null) {
      console.log(`QR regenerations: ${secret.qr_regeneration_count}`);
    }
    if (secret.is_web_app_flow != null) {
      console.log(`Web-app flow:     ${secret.is_web_app_flow ? "да" : "нет"}`);
    }
  } else {
    console.log(`(нет записи в user_rental_secrets для source_rental_id=${rentalId})`);
  }
  console.log("");

  console.log("=== Verification todos ===");
  if (verifTotal === 0) {
    console.log("(нет verification todos для этой аренды)");
  } else {
    console.log(`Прогресс:         ${verifDone}/${verifTotal} ${allVerifDone ? "✓" : "○"}`);
    for (const t of verifTodos) {
      const todoType = extractTodoTypeFromDescription(t.description) || "?";
      const label = VERIFICATION_TODO_LABELS[todoType] || t.title || todoType;
      const status = t.status === "done" ? "✓" : t.status === "in_progress" ? "…" : "○";
      const completedAt = t.completed_at ? ` (${fmtDateTime(t.completed_at)})` : "";
      console.log(`  ${status} ${label}${completedAt}`);
    }
  }
  console.log("");

  console.log("=== Документы (фото на rentals) ===");
  console.log(`  ${yesNo(docsOnRental.passportMainpage)} Паспорт (главная)`);
  console.log(`  ${yesNo(docsOnRental.passportRegistration)} Паспорт (регистрация)`);
  console.log(`  ${yesNo(docsOnRental.driversLicense)} Вод. удостоверение`);
  if (secret) {
    console.log("");
    console.log("=== Документы (на user_rental_secrets) ===");
    console.log(`  ${yesNo(docsOnSecret.passportMainpage)} Паспорт (главная)`);
    console.log(`  ${yesNo(docsOnSecret.passportRegistration)} Паспорт (регистрация)`);
    console.log(`  ${yesNo(docsOnSecret.driversLicense)} Вод. удостоверение`);
    if (secret.renter_passport)        console.log(`  Паспорт (текст):    ${secret.renter_passport}`);
    if (secret.renter_driver_license)  console.log(`  ВУ (текст):          ${secret.renter_driver_license}`);
    if (secret.renter_birth_date)      console.log(`  Дата рождения:       ${secret.renter_birth_date}`);
    if (secret.renter_registration)    console.log(`  Регистрация:         ${secret.renter_registration}`);
    if (secret.renter_email)           console.log(`  Email:               ${secret.renter_email}`);
  }
  console.log("");

  console.log("=== Контракт-артефакт ===");
  if (artifact) {
    console.log(`Contract key:     ${artifact.contract_key}`);
    console.log(`SHA256:           ${artifact.original_sha256 || "—"}`);
    console.log(`Created at:       ${fmtDateTime(artifact.created_at)}`);
    console.log(`Dates:            ${artifact.rent_start_date || "—"} → ${artifact.rent_end_date || "—"}`);
    if (artifact.total_sum != null)   console.log(`Total sum:         ${formatMoneyFull(artifact.total_sum)}`);
    if (artifact.daily_price)         console.log(`Daily price:       ${artifact.daily_price}`);
    if (artifact.deposit_rub)         console.log(`Deposit:           ${artifact.deposit_rub}`);
    if (artifact.template_version != null) console.log(`Template version:  ${artifact.template_version}`);
    if (artifact.storage_path)        console.log(`Storage path:      ${artifact.storage_path}`);
    if (artifact.doc_verifier_id)     console.log(`Doc verifier ID:   ${artifact.doc_verifier_id}`);
    if (artifact.sts_pledge_used) {
      console.log(`STS pledge:       used (series=${artifact.sts_series || "—"}, num=${artifact.sts_number || "—"})`);
    }
    console.log(`Created by op:    ${artifact.created_by_operator_chat_id || "—"} ${artifact.created_by_operator_chat_id ? "(" + formatAssignee(artifact.created_by_operator_chat_id) + ")" : ""}`);
  } else {
    console.log(`(нет записи в rental_contract_artifacts для rental_id=${rentalId})`);
  }
  console.log("");

  console.log("=== Handoff ===");
  if (handoffs.error === "table_missing") {
    console.log("(таблица rental_handoffs не существует в БД — миграция не применена)");
  } else if (handoffs.handout || handoffs.return) {
    if (handoffs.handout) {
      console.log("Handout (выдача):");
      console.log(`  Завершён:        ${handoffs.handout.completed_at ? "✓ " + fmtDateTime(handoffs.handout.completed_at) : "○ (не завершён)"}`);
      console.log(`  Одометр (старт): ${handoffs.handout.odometer_start ?? "—"} км`);
      console.log(`  Топливо:         ${handoffs.handout.fuel_level_start ?? "—"}%`);
      console.log(`  Батарея:         ${handoffs.handout.battery_level_start ?? "—"}%`);
      console.log(`  Чек-лист: паспорт ${yesNo(handoffs.handout.passport_checked)} · ВУ ${yesNo(handoffs.handout.license_checked)} · депозит ${yesNo(handoffs.handout.deposit_collected)} · шлем ${yesNo(handoffs.handout.helmet_issued)} · ключи ${yesNo(handoffs.handout.keys_issued)} · инструкции ${yesNo(handoffs.handout.instructions_given)} · фото ${yesNo(handoffs.handout.photos_taken)}`);
      if (handoffs.handout.keys_count != null) console.log(`  Ключей выдано:   ${handoffs.handout.keys_count}`);
      if (handoffs.handout.damage_notes)   console.log(`  Повреждения:     ${handoffs.handout.damage_notes}`);
      if (handoffs.handout.handout_notes)  console.log(`  Заметки:         ${handoffs.handout.handout_notes}`);
    } else {
      console.log("Handout: нет данных (выдача не отмечена)");
    }
    if (handoffs.return) {
      console.log("Return (возврат):");
      console.log(`  Завершён:        ${handoffs.return.completed_at ? "✓ " + fmtDateTime(handoffs.return.completed_at) : "○ (не завершён)"}`);
      console.log(`  Одометр (конец): ${handoffs.return.odometer_end ?? "—"} км`);
      const odoDiff = (handoffs.return.odometer_end != null && handoffs.handout?.odometer_start != null)
        ? (handoffs.return.odometer_end - handoffs.handout.odometer_start) : null;
      if (odoDiff != null) console.log(`  Пробег за аренду:${odoDiff} км`);
      console.log(`  Топливо:         ${handoffs.return.fuel_level_end ?? "—"}%`);
      console.log(`  Батарея:         ${handoffs.return.battery_level_end ?? "—"}%`);
      console.log(`  Чек-лист: состояние ${yesNo(handoffs.return.condition_checked)} · шлем ${yesNo(handoffs.return.helmet_returned)} · ключи ${yesNo(handoffs.return.keys_returned)} · депозит ${yesNo(handoffs.return.deposit_returned)} · без повреждений ${yesNo(handoffs.return.no_damages_confirmed)}`);
      if (handoffs.return.return_notes)             console.log(`  Заметки:         ${handoffs.return.return_notes}`);
      if (handoffs.return.equipment_condition_return) console.log(`  Состояние equip: ${handoffs.return.equipment_condition_return}`);
    } else {
      console.log("Return: нет данных (возврат не отмечен)");
    }
  } else {
    console.log("(нет записей в rental_handoffs для этой аренды)");
  }
  console.log("");

  console.log("=== Сообщения ===");
  // Messages aren't stored as rows — they go via Telegram forward-telegram
  // endpoint to the renter. Show a hint + how to send one.
  console.log(`Отправка: см. send-rental-message в SKILL.md (POST /api/forward-telegram).`);
  console.log("");

  console.log("=== Контракт verifier ===");
  console.log(`Status:           ${contractVerificationStatus}`);
  if (verifier) {
    if (verifier.scope)         console.log(`Scope:            ${verifier.scope}`);
    if (verifier.documentKey)   console.log(`Document key:     ${verifier.documentKey}`);
    if (verifier.expiresAt)     console.log(`Expires at:       ${fmtDateTime(verifier.expiresAt)}`);
    if (verifier.originalSha256) console.log(`SHA256:           ${verifier.originalSha256}`);
  }
  console.log("");

  // History hint
  const history = Array.isArray(meta.history) ? meta.history : [];
  if (history.length > 0) {
    console.log(`=== История (metadata.history, ${history.length} записей) ===`);
    for (const h of history) {
      const by = h.by ? ` · by ${formatAssignee(h.by)}` : "";
      const msg = h.message ? ` · "${h.message}"` : "";
      console.log(`  ${fmtDateTime(h.at)}  → ${STATUS_LABELS[h.status] || h.status}${by}${msg}`);
    }
    console.log("");
  }

  // Recommended next action
  console.log("=== Следующее рекомендованное действие ===");
  console.log(recommendNextAction(rental, { verifDone, verifTotal, qrStatus, identityState, handoffs }));
  console.log("");

  console.log(webLink(rentalId));
}

function recommendNextAction(rental, ctx) {
  const { verifDone, verifTotal, qrStatus, identityState, handoffs } = ctx;
  switch (rental.status) {
    case "pending_confirmation":
      if (qrStatus === "unclaimed") return "Переслать QR арендатору (rental.user_id ещё оператор-плейсхолдер)";
      if (verifTotal === 0)         return "Создать verification todos (5 шт: паспорт, прописка, ВУ, одометр, даты)";
      if (verifDone < verifTotal)   return `Завершить verification todos (${verifDone}/${verifTotal})`;
      return "Активировать аренду (activate-rental с начальным одометром)";
    case "confirmed":
      if (!handoffs?.handout) return "Заполнить handout-чек-лист (паспорт, ВУ, депозит, шлем, ключи, одометр)";
      return "Перевести в active (update-rental-status --status active)";
    case "active":
      if (!handoffs?.return)  return "Заполнить return-чек-лист при возврате (состояние, одометр-конец, депозит-возврат)";
      return "Завершить аренду (complete-rental --odometer <km>)";
    case "completed":
      return "Архив. Арендатор может арендовать снова из каталога.";
    case "cancelled":
      return "Архив. Аренда отменена.";
    case "disputed":
      return "Разрешить спор — связаться с арендатором и владельцем.";
    default:
      return "—";
  }
}

/**
 * `rental-todos <rentalId>` — all verification + lead_followup todos.
 */
async function cmdRentalTodos(rentalId) {
  if (!rentalId) {
    console.error("ERROR: rentalId is required. Usage: rental-todos <rentalId>");
    process.exit(2);
  }
  const todos = await fetchRentalTodos(rentalId);

  const verifTodos  = todos.filter((t) => t.category === "rental_verification");
  const followupTodos = todos.filter((t) => t.category === "lead_followup");
  const otherTodos  = todos.filter((t) => t.category !== "rental_verification" && t.category !== "lead_followup");

  console.log(`=== Todos для аренды ${rentalId.slice(0, 8)}… ===`);
  console.log(`Всего: ${todos.length} · verification: ${verifTodos.length} · lead_followup: ${followupTodos.length} · other: ${otherTodos.length}`);
  console.log("");

  if (verifTodos.length > 0) {
    console.log("── rental_verification ──");
    const widths = [38, 12, 22, 18, 16];
    console.log(formatTable([["Заголовок", "Статус", "Тип", "Создан", "Завершён"]], widths));
    console.log(widths.map((w) => "─".repeat(w)).join("  "));
    const rows = verifTodos.map((t) => {
      const todoType = extractTodoTypeFromDescription(t.description) || "?";
      const label = VERIFICATION_TODO_LABELS[todoType] || todoType;
      return [
        t.title || "(без заголовка)",
        t.status,
        label,
        fmtDate(t.created_at),
        t.completed_at ? fmtDateTime(t.completed_at) : "—",
      ];
    });
    console.log(formatTable(rows, widths));
    console.log("");
  }

  if (followupTodos.length > 0) {
    console.log("── lead_followup ──");
    const widths = [38, 12, 14, 22, 18];
    console.log(formatTable([["Заголовок", "Статус", "Приоритет", "Создан", "Assignee"]], widths));
    console.log(widths.map((w) => "─".repeat(w)).join("  "));
    const rows = followupTodos.map((t) => [
      t.title || "(без заголовка)",
      t.status,
      t.priority || "—",
      fmtDate(t.created_at),
      formatAssignee(t.assigned_to),
    ]);
    console.log(formatTable(rows, widths));
    console.log("");
  }

  if (otherTodos.length > 0) {
    console.log("── other ──");
    const widths = [38, 12, 14, 22];
    console.log(formatTable([["Заголовок", "Статус", "Категория", "Создан"]], widths));
    console.log(widths.map((w) => "─".repeat(w)).join("  "));
    const rows = otherTodos.map((t) => [
      t.title || "(без заголовка)",
      t.status,
      t.category,
      fmtDate(t.created_at),
    ]);
    console.log(formatTable(rows, widths));
    console.log("");
  }

  if (todos.length === 0) {
    console.log("(нет задач для этой аренды)");
    console.log("");
  }

  console.log(webLink(rentalId));
}

/**
 * `rental-documents <rentalId>` — document status: passport photos, license,
 * OCR data from user_rental_secrets.
 */
async function cmdRentalDocuments(rentalId) {
  if (!rentalId) {
    console.error("ERROR: rentalId is required. Usage: rental-documents <rentalId>");
    process.exit(2);
  }
  const [rental, secret, artifact] = await Promise.all([
    fetchRental(rentalId),
    fetchRentalSecret(rentalId),
    fetchContractArtifact(rentalId),
  ]);

  if (!rental) {
    console.error(`ERROR: Rental not found: ${rentalId}`);
    process.exit(2);
  }

  console.log(`=== Документы по аренде ${rentalId.slice(0, 8)}… ===`);
  console.log("");

  console.log("── Фото на rentals ──");
  const docsOnRental = [
    ["Паспорт (главная)",     rental.passport_mainpage_photo],
    ["Паспорт (регистрация)", rental.passport_registration_photo],
    ["Вод. удостоверение",    rental.drivers_licence_frontal_photo],
  ];
  for (const [label, path] of docsOnRental) {
    console.log(`  ${yesNo(!!path)} ${label.padEnd(26)} ${path ? String(path).slice(0, 60) + (String(path).length > 60 ? "…" : "") : "—"}`);
  }
  console.log("");

  console.log("── Данные на user_rental_secrets ──");
  if (secret) {
    console.log(`  Secret ID:        ${secret.id}`);
    console.log(`  Verification:     ${secret.verification_status}`);
    console.log(`  Doc SHA256:       ${secret.doc_sha256}`);
    if (secret.original_doc_sha256 && secret.original_doc_sha256 !== secret.doc_sha256) {
      console.log(`  Original SHA256:  ${secret.original_doc_sha256}`);
    }
    console.log(`  Created at:       ${fmtDateTime(secret.created_at)}`);
    console.log("");
    console.log("  Фото на secret:");
    console.log(`    ${yesNo(!!secret.passport_mainpage_photo)} Паспорт (главная)`);
    console.log(`    ${yesNo(!!secret.passport_registration_photo)} Паспорт (регистрация)`);
    console.log(`    ${yesNo(!!secret.drivers_licence_frontal_photo)} Вод. удостоверение`);
    console.log("");
    console.log("  OCR / текстовые поля:");
    if (secret.renter_full_name)         console.log(`    ФИО:                  ${secret.renter_full_name}`);
    if (secret.renter_passport)          console.log(`    Паспорт:              ${secret.renter_passport}`);
    if (secret.renter_passport_issued_by) console.log(`    Кем выдан:            ${secret.renter_passport_issued_by}`);
    if (secret.renter_passport_issue_date) console.log(`    Дата выдачи:          ${secret.renter_passport_issue_date}`);
    if (secret.renter_registration)      console.log(`    Регистрация:          ${secret.renter_registration}`);
    if (secret.renter_driver_license)    console.log(`    ВУ:                   ${secret.renter_driver_license}`);
    if (secret.renter_birth_date)        console.log(`    Дата рождения:        ${secret.renter_birth_date}`);
    if (secret.renter_phone)             console.log(`    Телефон:              ${maskPhone(secret.renter_phone)}`);
    if (secret.renter_email)             console.log(`    Email:                ${secret.renter_email}`);
    if (secret.renter_address)           console.log(`    Адрес:                ${secret.renter_address}`);
    if (secret.template_version != null) console.log(`    Template version:     ${secret.template_version}`);

    // STS fields (used when sts_pledge_used=true on the artifact)
    if (secret.sts_series || secret.sts_number || secret.sts_vehicle_plate) {
      console.log("");
      console.log("  STS (залог ПТС):");
      if (secret.sts_series)         console.log(`    Серия:                ${secret.sts_series}`);
      if (secret.sts_number)         console.log(`    Номер:                ${secret.sts_number}`);
      if (secret.sts_vehicle_plate)  console.log(`    Госномер:             ${secret.sts_vehicle_plate}`);
      if (secret.sts_vehicle_vin)    console.log(`    VIN:                  ${secret.sts_vehicle_vin}`);
      if (secret.sts_vehicle_model)  console.log(`    Модель ТС:            ${secret.sts_vehicle_model}`);
      if (secret.sts_owner_full_name) console.log(`    Собственник:          ${secret.sts_owner_full_name}`);
    }
  } else {
    console.log("  (нет записи в user_rental_secrets для source_rental_id=" + rentalId + ")");
  }
  console.log("");

  console.log("── Контракт-артефакт (rental_contract_artifacts) ──");
  if (artifact) {
    console.log(`  Contract key:        ${artifact.contract_key}`);
    console.log(`  SHA256:              ${artifact.original_sha256 || "—"}`);
    console.log(`  Created at:          ${fmtDateTime(artifact.created_at)}`);
    console.log(`  Renter name:         ${artifact.renter_full_name || "—"}`);
    if (artifact.renter_passport)        console.log(`  Passport:            ${artifact.renter_passport}`);
    if (artifact.renter_passport_issued_by) console.log(`  Issued by:           ${artifact.renter_passport_issued_by}`);
    if (artifact.renter_passport_issue_date) console.log(`  Issue date:          ${artifact.renter_passport_issue_date}`);
    if (artifact.renter_registration)    console.log(`  Registration:        ${artifact.renter_registration}`);
    if (artifact.renter_driver_license)  console.log(`  Driver license:      ${artifact.renter_driver_license}`);
    if (artifact.license_categories)     console.log(`  License categories:  ${artifact.license_categories}`);
    if (artifact.renter_phone)           console.log(`  Phone:               ${maskPhone(artifact.renter_phone)}`);
    if (artifact.daily_price)            console.log(`  Daily price:         ${artifact.daily_price}`);
    if (artifact.deposit_rub)            console.log(`  Deposit:             ${artifact.deposit_rub}`);
    if (artifact.total_sum != null)      console.log(`  Total sum:           ${formatMoneyFull(artifact.total_sum)}`);
    if (artifact.storage_path)           console.log(`  Storage path:        ${artifact.storage_path}`);
    if (artifact.sts_pledge_used) {
      console.log(`  STS pledge:          used (series=${artifact.sts_series || "—"}, num=${artifact.sts_number || "—"}, plate=${artifact.sts_vehicle_plate || "—"})`);
    }
  } else {
    console.log("  (нет записи в rental_contract_artifacts для rental_id=" + rentalId + ")");
  }
  console.log("");

  console.log(webLink(rentalId));
}

/**
 * `rental-handoff <rentalId>` — handoff checklist for both phases.
 */
async function cmdRentalHandoff(rentalId) {
  if (!rentalId) {
    console.error("ERROR: rentalId is required. Usage: rental-handoff <rentalId>");
    process.exit(2);
  }
  const [handoffsResp, rental] = await Promise.all([
    fetchHandoffs(rentalId),
    fetchRental(rentalId),
  ]);
  const { handout, return: ret, error: handoffError } = handoffsResp;

  if (!rental) {
    console.error(`ERROR: Rental not found: ${rentalId}`);
    process.exit(2);
  }

  console.log(`=== Handoff по аренде ${rentalId.slice(0, 8)}… ===`);
  console.log(`Статус аренды: ${STATUS_LABELS[rental.status] || rental.status}`);
  console.log("");

  if (handoffError === "table_missing") {
    console.log("⚠ Таблица rental_handoffs не существует в БД (миграция не применена).");
    console.log("  Ожидаемые колонки: id, rental_id, phase, passport_checked, license_checked,");
    console.log("  deposit_collected, helmet_issued, keys_issued, instructions_given, photos_taken,");
    console.log("  condition_checked, helmet_returned, keys_returned, deposit_returned,");
    console.log("  no_damages_confirmed, odometer_start, odometer_end, fuel_level_start/end,");
    console.log("  battery_level_start/end, damage_notes, handout_notes, return_notes, …");
    console.log("");
    console.log(webLink(rentalId));
    return;
  }

  console.log("── Handout (выдача) ──");
  if (handout) {
    printHandoffPhase(handout, "handout");
  } else {
    console.log("  (нет записи handout — выдача не отмечена)");
  }
  console.log("");

  console.log("── Return (возврат) ──");
  if (ret) {
    printHandoffPhase(ret, "return");
  } else {
    console.log("  (нет записи return — возврат не отмечен)");
  }
  console.log("");

  // Summary
  console.log("=== Сводка ===");
  const odoStart = handout?.odometer_start ?? null;
  const odoEnd   = ret?.odometer_end ?? null;
  console.log(`  Одометр (старт):  ${odoStart ?? "—"} км`);
  console.log(`  Одометр (конец):  ${odoEnd ?? "—"} км`);
  if (odoStart != null && odoEnd != null) {
    console.log(`  Пробег за аренду: ${odoEnd - odoStart} км`);
  }
  console.log(`  Handout завершён: ${handout?.completed_at ? "✓" : "✗"}`);
  console.log(`  Return завершён:  ${ret?.completed_at ? "✓" : "✗"}`);
  console.log("");

  console.log(webLink(rentalId));
}

function printHandoffPhase(h, phase) {
  console.log(`  Завершён:        ${h.completed_at ? "✓ " + fmtDateTime(h.completed_at) : "○ (не завершён)"}`);
  if (h.completed_by) console.log(`  Completed by:    ${formatAssignee(h.completed_by)}`);
  console.log(`  Created at:      ${fmtDateTime(h.created_at)}`);
  console.log(`  Updated at:      ${fmtDateTime(h.updated_at)}`);

  if (phase === "handout") {
    console.log("");
    console.log("  Чек-лист (булевы):");
    console.log(`    ${yesNo(h.passport_checked)} Паспорт проверен`);
    console.log(`    ${yesNo(h.license_checked)} ВУ проверено`);
    console.log(`    ${yesNo(h.deposit_collected)} Депозит получен`);
    console.log(`    ${yesNo(h.helmet_issued)} Шлем выдан`);
    console.log(`    ${yesNo(h.keys_issued)} Ключи выданы`);
    console.log(`    ${yesNo(h.instructions_given)} Инструкции даны`);
    console.log(`    ${yesNo(h.photos_taken)} Фото сделаны`);

    console.log("");
    console.log("  Замеры:");
    console.log(`    Одометр (старт): ${h.odometer_start ?? "—"} км`);
    console.log(`    Топливо (старт): ${h.fuel_level_start ?? "—"}%`);
    console.log(`    Батарея (старт): ${h.battery_level_start ?? "—"}%`);

    console.log("");
    console.log("  Оборудование:");
    console.log(`    Ключей:          ${h.keys_count ?? "—"}`);
    console.log(`    ${yesNo(h.charger_included)} Зарядка`);
    console.log(`    ${yesNo(h.lock_cable_included)} Замок/трос`);
    console.log(`    ${yesNo(h.jacket_issued)} Куртка`);
    console.log(`    ${yesNo(h.second_helmet_issued)} Второй шлем`);
    console.log(`    ${yesNo(h.bag_issued)} Сумка`);
    console.log(`    ${yesNo(h.net_issued)} Сетка`);
    console.log(`    ${yesNo(h.camera_mount_issued)} Крепление камеры`);
    console.log(`    ${yesNo(h.moto_cover_issued)} Чехол мото`);
    console.log(`    ${yesNo(h.ebike_charger_issued)} Зарядка e-bike`);
    if (h.other_equipment) console.log(`    Другое:          ${h.other_equipment}`);

    if (h.damage_notes) {
      console.log("");
      console.log(`  Повреждения при выдаче: ${h.damage_notes}`);
    }
    if (h.handout_notes) {
      console.log(`  Заметки:              ${h.handout_notes}`);
    }
  } else {
    console.log("");
    console.log("  Чек-лист (булевы):");
    console.log(`    ${yesNo(h.condition_checked)} Состояние проверено`);
    console.log(`    ${yesNo(h.helmet_returned)} Шлем возвращён`);
    console.log(`    ${yesNo(h.keys_returned)} Ключи возвращены`);
    console.log(`    ${yesNo(h.deposit_returned)} Депозит возвращён`);
    console.log(`    ${yesNo(h.no_damages_confirmed)} Без повреждений`);

    console.log("");
    console.log("  Замеры:");
    console.log(`    Одометр (конец): ${h.odometer_end ?? "—"} км`);
    console.log(`    Топливо (конец): ${h.fuel_level_end ?? "—"}%`);
    console.log(`    Батарея (конец): ${h.battery_level_end ?? "—"}%`);

    if (h.return_notes) {
      console.log("");
      console.log(`  Заметки при возврате: ${h.return_notes}`);
    }
    if (h.equipment_condition_return) {
      console.log(`  Состояние оборудования: ${h.equipment_condition_return}`);
    }
  }
}

/**
 * `list-rentals [--status X] [--date YYYY-MM-DD]` — list rentals filtered.
 *
 * Mirrors the rentals-analytics page logic:
 *   - If --date given: rentals where (created_at within date) OR
 *     (requested_start_date/end_date overlaps the date).
 *   - If --status given: filter by status.
 */
async function cmdListRentals(opts) {
  // Validate --status
  if (opts.status) {
    const validStatuses = ["active", "completed", "cancelled", "pending", "confirmed", "disputed"];
    // 'pending' is a shortcut for 'pending_confirmation'
    if (!validStatuses.includes(opts.status)) {
      console.error(`ERROR: invalid status "${opts.status}". Valid: active, completed, cancelled, pending, confirmed, disputed`);
      process.exit(2);
    }
  }

  const statusFilter = opts.status === "pending" ? "pending_confirmation" : opts.status;

  // ── Fetch rentals for crew ──
  const filters = [`crew_id=eq.${CREW_ID}`];
  if (statusFilter) filters.push(`status=eq.${statusFilter}`);

  let dateRange = null;
  if (opts.date) {
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
      console.error(`ERROR: invalid --date format. Expected YYYY-MM-DD, got "${opts.date}"`);
      process.exit(2);
    }
    const start = `${opts.date}T00:00:00.000Z`;
    const end   = `${opts.date}T23:59:59.999Z`;
    dateRange = { start, end };
  }

  // Two queries (created-on-day OR period-overlapping), then merge by rental_id.
  let rentals = [];
  if (dateRange) {
    const [byCreated, byPeriod] = await Promise.all([
      supabaseQuery("rentals", {
        select: "rental_id,user_id,vehicle_id,owner_id,status,payment_status,total_cost,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,created_by_operator_chat_id,metadata,created_at",
        filters: [...filters, `created_at=gte.${dateRange.start}`, `created_at=lte.${dateRange.end}`],
        order: "created_at.desc",
        limit: 500,
      }),
      supabaseQuery("rentals", {
        select: "rental_id,user_id,vehicle_id,owner_id,status,payment_status,total_cost,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,created_by_operator_chat_id,metadata,created_at",
        filters: [...filters, `requested_start_date=lte.${dateRange.end}`, `requested_end_date=gte.${dateRange.start}`],
        order: "created_at.desc",
        limit: 500,
      }),
    ]);
    // Merge — period-overlapping wins (more relevant for the day)
    const byId = new Map();
    for (const r of byCreated) byId.set(r.rental_id, r);
    for (const r of byPeriod)  byId.set(r.rental_id, r); // overwrites
    rentals = Array.from(byId.values());
    // Re-sort by created_at desc
    rentals.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  } else {
    rentals = await supabaseQuery("rentals", {
      select: "rental_id,user_id,vehicle_id,owner_id,status,payment_status,total_cost,requested_start_date,requested_end_date,agreed_start_date,agreed_end_date,created_by_operator_chat_id,metadata,created_at",
      filters,
      order: "created_at.desc",
      limit: 500,
    });
  }

  const total = rentals.length;

  // ── Enrich: bike titles + renter names ──
  const vehicleIds = Array.from(new Set(rentals.map((r) => r.vehicle_id).filter(Boolean)));
  const userIds    = Array.from(new Set(rentals.map((r) => r.user_id).filter(Boolean)));

  const [vehicles, users] = await Promise.all([
    vehicleIds.length > 0
      ? supabaseQuery("cars", {
          select: "id,make,model,type",
          filters: [`id=in.(${vehicleIds.join(",")})`],
          limit: 500,
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? supabaseQuery("users", {
          select: "user_id,username,full_name,metadata",
          filters: [`user_id=in.(${userIds.join(",")})`],
          limit: 1000,
        })
      : Promise.resolve([]),
  ]);

  const vehicleTitleById = new Map();
  for (const v of vehicles) {
    vehicleTitleById.set(v.id, `${v.make || "—"} ${v.model || ""}`.trim());
  }
  const userNameById = new Map();
  for (const u of users) {
    const meta = u.metadata || {};
    const name = u.full_name || meta.fullName || meta.display_name || u.username || `ID:${u.user_id?.slice(0, 8)}`;
    userNameById.set(u.user_id, name);
  }

  // ── Header ──
  const dateLabel = opts.date ? ` за ${opts.date}` : "";
  const statusLabel = statusFilter ? ` со статусом "${statusFilter}"` : "";
  console.log(`=== Аренды VIP Bike${dateLabel}${statusLabel} (${total} всего) ===`);

  // Summary by status
  const byStatus = {};
  for (const r of rentals) {
    const s = r.status || "unknown";
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  const sumParts = Object.entries(byStatus)
    .map(([k, v]) => `${STATUS_LABELS[k] || k}: ${v}`);
  if (sumParts.length > 0) {
    console.log(`   ${sumParts.join(" | ")}`);
  }
  console.log("");

  if (total === 0) {
    console.log("(нет аренд по фильтру)");
    console.log("");
    console.log(webLink("<rentalId>"));
    return;
  }

  // ── Table ──
  const widths = [22, 22, 14, 18, 12, 12];
  console.log(formatTable([["ID", "Байк", "Статус", "Рентер", "Даты", "Сумма"]], widths));
  console.log(widths.map((w) => "─".repeat(w)).join("  "));

  const limit = opts.limit ? Number(opts.limit) : 100;
  const rows = rentals.slice(0, limit).map((r) => {
    const bikeTitle = vehicleTitleById.get(r.vehicle_id) || "—";
    const renterName = userNameById.get(r.user_id) || (CREW_OPERATOR_IDS.has(r.user_id) ? "[оператор]" : "ID:" + (r.user_id || "—").slice(0, 8));
    const dateRange = (r.requested_start_date || r.agreed_start_date)
      ? `${fmtDate(r.requested_start_date || r.agreed_start_date)}→${fmtDate(r.requested_end_date || r.agreed_end_date)}`
      : "—";
    return [
      r.rental_id.slice(0, 8) + "…",
      bikeTitle.length > 22 ? bikeTitle.slice(0, 20) + "…" : bikeTitle,
      STATUS_LABELS[r.status] || r.status,
      formatShortName(renterName),
      dateRange,
      formatMoney(r.total_cost),
    ];
  });
  console.log(formatTable(rows, widths));
  console.log("");

  // Hint: each rental card link
  console.log(`Открыть карточку: ${WEB_BASE}/<rentalId>`);
}

/**
 * `rental-history <rentalId>` — status change history + todo completion history.
 *
 * Status history comes from rentals.metadata.history[] (appended by
 * updateRentalStatus server action). Todo completion history comes from
 * crew_todos.completed_at for todos matching this rental.
 */
async function cmdRentalHistory(rentalId) {
  if (!rentalId) {
    console.error("ERROR: rentalId is required. Usage: rental-history <rentalId>");
    process.exit(2);
  }
  const [rental, todos] = await Promise.all([
    fetchRental(rentalId),
    fetchRentalTodos(rentalId),
  ]);

  if (!rental) {
    console.error(`ERROR: Rental not found: ${rentalId}`);
    process.exit(2);
  }

  const meta = (rental.metadata && typeof rental.metadata === "object") ? rental.metadata : {};
  const statusHistory = Array.isArray(meta.history) ? meta.history : [];

  console.log(`=== История аренды ${rentalId.slice(0, 8)}… ===`);
  console.log(`Текущий статус: ${STATUS_LABELS[rental.status] || rental.status}`);
  console.log(`Создана:        ${fmtDateTime(rental.created_at)}`);
  console.log(`Обновлена:      ${fmtDateTime(rental.updated_at)}`);
  if (meta.last_status_change_at) {
    console.log(`Последнее изменение статуса: ${fmtDateTime(meta.last_status_change_at)}`);
  }
  if (meta.last_status_change_by) {
    console.log(`Кем:                          ${formatAssignee(meta.last_status_change_by)}`);
  }
  if (meta.last_status_change_message) {
    console.log(`Сообщение:                    ${meta.last_status_change_message}`);
  }
  console.log("");

  // ── Build a unified timeline ──
  const events = [];

  // Rental creation event
  events.push({
    at: rental.created_at,
    type: "rental_created",
    label: `Аренда создана (статус: ${STATUS_LABELS[rental.status] || rental.status})`,
    by: rental.created_by_operator_chat_id || null,
    message: null,
  });

  // Status changes from metadata.history
  for (const h of statusHistory) {
    events.push({
      at: h.at,
      type: "status_change",
      label: `Статус → ${STATUS_LABELS[h.status] || h.status}`,
      by: h.by || null,
      message: h.message || null,
    });
  }

  // Todo completions
  for (const t of todos) {
    if (t.completed_at) {
      const todoType = extractTodoTypeFromDescription(t.description);
      const label = todoType
        ? `Todo выполнен: ${VERIFICATION_TODO_LABELS[todoType] || todoType}`
        : `Todo выполнен: ${t.title || t.category}`;
      events.push({
        at: t.completed_at,
        type: "todo_completed",
        label,
        by: t.assigned_to || t.created_by || null,
        message: null,
      });
    } else if (t.status === "in_progress") {
      const todoType = extractTodoTypeFromDescription(t.description);
      events.push({
        at: t.updated_at || t.created_at,
        type: "todo_in_progress",
        label: `Todo в работе: ${VERIFICATION_TODO_LABELS[todoType] || t.title || t.category}`,
        by: t.assigned_to || null,
        message: null,
      });
    }
    // todo created
    events.push({
      at: t.created_at,
      type: "todo_created",
      label: `Todo создан: ${t.title || t.category}`,
      by: t.created_by || null,
      message: null,
    });
  }

  // Sort by timestamp asc
  events.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });

  console.log(`=== Timeline (${events.length} событий) ===`);
  const widths = [18, 18, 50, 22];
  console.log(formatTable([["Дата", "Тип", "Событие", "Кем"]], widths));
  console.log(widths.map((w) => "─".repeat(w)).join("  "));
  const rows = events.map((e) => [
    fmtDateTime(e.at),
    e.type,
    e.label + (e.message ? ` — "${e.message}"` : ""),
    e.by ? formatAssignee(e.by) : "—",
  ]);
  console.log(formatTable(rows, widths));
  console.log("");

  // Summary
  console.log("=== Сводка ===");
  const byType = {};
  for (const e of events) byType[e.type] = (byType[e.type] || 0) + 1;
  for (const [k, v] of Object.entries(byType)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("");

  console.log(webLink(rentalId));
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
        opts[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { command, opts, positional };
}

function printUsage() {
  console.log(`rental-query.mjs — text-based rental card detail for VIP Bike

Usage:
  node rental-query.mjs rental-card <rentalId>
  node rental-query.mjs rental-todos <rentalId>
  node rental-query.mjs rental-documents <rentalId>
  node rental-query.mjs rental-handoff <rentalId>
  node rental-query.mjs list-rentals [--status active|completed|cancelled|pending|confirmed|disputed] [--date YYYY-MM-DD] [--limit N]
  node rental-query.mjs rental-history <rentalId>

list-rentals filters:
  --status <s>     Filter by rental status. 'pending' is a shortcut for 'pending_confirmation'.
  --date YYYY-MM-DD  Show rentals created OR with period overlapping this UTC day.
  --limit <n>      Max rows to print (default 100).

Write commands (activate-rental, complete-rental, update-rental-status, send-rental-message)
are documented as curl recipes in SKILL.md — they require operator auth context
that lives in the Next.js server-actions layer.

Environment:
  SUPABASE_URL                Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY   Service role key (or read from --secrets path)
  --secrets <path>            Path to secrets.txt (default: ${DEFAULT_SECRETS_PATH})
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

  initSupabase({
    url: opts.SUPABASE_URL,
    key: opts.SUPABASE_SERVICE_ROLE_KEY,
    secretsPath: opts.secrets,
  });

  try {
    switch (command) {
      case "rental-card": {
        const rentalId = positional[0] || opts.rentalId;
        await cmdRentalCard(rentalId);
        break;
      }
      case "rental-todos": {
        const rentalId = positional[0] || opts.rentalId;
        await cmdRentalTodos(rentalId);
        break;
      }
      case "rental-documents": {
        const rentalId = positional[0] || opts.rentalId;
        await cmdRentalDocuments(rentalId);
        break;
      }
      case "rental-handoff": {
        const rentalId = positional[0] || opts.rentalId;
        await cmdRentalHandoff(rentalId);
        break;
      }
      case "list-rentals": {
        await cmdListRentals(opts);
        break;
      }
      case "rental-history": {
        const rentalId = positional[0] || opts.rentalId;
        await cmdRentalHistory(rentalId);
        break;
      }
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
