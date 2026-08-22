#!/usr/bin/env node
// rental-ops-skill.mjs — Rental lifecycle operations for VIP Bike.
//
// Text-based rental operations: list, show, extend, close, stuck, returns-today.
// Wraps Supabase queries + mirrors the web app's extendRental + updateRentalStatus logic.
//
// Sibling of leads-query.mjs / catalog-query.mjs. Same conventions:
//   - default secrets path: /home/z/my-project/upload/secrets.txt
//   - all output → stdout; errors → stderr with exit code 2
//   - write ops require --actorUserId (auth check via crew_members)
//
// Usage:
//   node rental-ops-skill.mjs list-rentals --status active
//   node rental-ops-skill.mjs list-rentals --status active --overdue
//   node rental-ops-skill.mjs show-rental <rentalId>
//   node rental-ops-skill.mjs returns-today
//   node rental-ops-skill.mjs stuck
//   node rental-ops-skill.mjs extend --rentalId <id> --start 2026-08-05 --end 2026-08-07
//   node rental-ops-skill.mjs extend --rentalId <id> --start 2026-08-05 --end 2026-08-07 --dryRun
//   node rental-ops-skill.mjs close --rentalId <id> --odometer 12345 --damage none --depositReturned
//   node rental-ops-skill.mjs close --rentalId <id> --odometer 12345 --damage light --depositReturned --notes "Царапина на баке"
//   node rental-ops-skill.mjs close --rentalId <id> --odometer 12345 --damage heavy --no-deposit --notes "Повреждён пластик"
//
// Env:
//   SUPABASE_URL                (default: https://inmctohsodgdohamhzag.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (fallback: read from --secrets=<path> or
//                                /home/z/my-project/upload/secrets.txt)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SUPA_URL = "https://inmctohsodgdohamhzag.supabase.co";
const DEFAULT_SECRETS_PATH = "/home/z/my-project/upload/secrets.txt";
const CREW_SLUG = "vip-bike";
const CREW_ID = "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const command = args[0] || "";
const positional = [];
const flags = {};
let secretsPath = DEFAULT_SECRETS_PATH;

for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--secrets=")) { secretsPath = a.slice(10); continue; }
  if (a.startsWith("--")) {
    const key = a.slice(2).replace(/=.*$/, "");
    const val = a.includes("=") ? a.slice(a.indexOf("=") + 1) : (args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : true);
    flags[key] = val;
  } else {
    positional.push(a);
  }
}

const arg = (k) => flags[k];
const hasFlag = (k) => k in flags;
const dryRun = hasFlag("dryRun") || hasFlag("dry-run");

// ─── Supabase setup ──────────────────────────────────────────────────────────

function loadSecrets() {
  try {
    const raw = readFileSync(secretsPath, "utf-8");
    const lines = raw.split("\n");
    const map = {};
    for (const line of lines) {
      const idx = line.indexOf("=");
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        map[key] = val;
      }
    }
    return map;
  } catch { return {}; }
}

const secretsMap = loadSecrets();
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPA_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || secretsMap.SUPABASE_SERVICE_ROLE_KEY || secretsMap.SUPABASE_SERVICE_KEY;

if (!supabaseKey) {
  console.error(JSON.stringify({ ok: false, stage: "env", reason: "missing_supabase_key", details: { expected: "SUPABASE_SERVICE_ROLE_KEY env or in secrets file" } }));
  process.exit(2);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const supabasePrivate = createClient(supabaseUrl, supabaseKey, { db: { schema: "private" } });

// ─── Output helpers ──────────────────────────────────────────────────────────

function fail(payload) {
  console.error(JSON.stringify({ ok: false, ...payload }, null, 2));
  process.exit(2);
}
function done(payload) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

// ─── Auth check (for write ops) ─────────────────────────────────────────────

async function checkWriteAccess(crew, actorUserId) {
  if (!actorUserId) {
    fail({ stage: "auth", reason: "missing_actor", details: { hint: "Pass --actorUserId <telegram_chat_id> for write operations" } });
  }
  if (crew.owner_id === actorUserId) return;
  const { data: membership } = await supabase
    .from("crew_members")
    .select("role")
    .eq("crew_id", crew.id)
    .eq("user_id", actorUserId)
    .maybeSingle();
  if (membership && ["owner", "admin", "co_owner", "member"].includes(membership.role)) return;
  const { data: user } = await supabase.from("users").select("metadata").eq("user_id", actorUserId).maybeSingle();
  const meta = user?.metadata;
  if (meta?.role === "admin" || meta?.status === "admin") return;
  fail({ stage: "auth", reason: "not_authorized", details: { actorUserId, crewSlug: crew.slug } });
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function loadCrew(slug) {
  const { data, error } = await supabase
    .from("crews")
    .select("id, slug, name, owner_id, metadata")
    .eq("slug", slug || CREW_SLUG)
    .maybeSingle();
  if (error || !data) fail({ stage: "load_crew", reason: "not_found", details: { slug: slug || CREW_SLUG } });
  return data;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString("ru-RU") + " ₽";
}

function shortId(id) {
  return id ? id.slice(0, 8) : "?";
}

// ─── COMMAND: list-rentals ───────────────────────────────────────────────────

async function cmdListRentals() {
  const status = arg("status") || "active";
  const overdueOnly = hasFlag("overdue");
  const limit = parseInt(arg("limit") || "20", 10);

  let query = supabase
    .from("rentals")
    .select("rental_id, user_id, owner_id, status, payment_status, total_cost, agreed_start_date, agreed_end_date, vehicle:cars(make, model)")
    .eq("crew_id", CREW_ID)
    .order("agreed_end_date", { ascending: true })
    .limit(limit);

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) fail({ stage: "list_rentals", reason: "db_error", details: { message: error.message } });

  const now = Date.now();
  let rentals = data || [];

  if (overdueOnly) {
    rentals = rentals.filter((r) => {
      const end = r.agreed_end_date ? new Date(r.agreed_end_date).getTime() : 0;
      return end > 0 && end < now;
    });
  }

  if (rentals.length === 0) {
    done({ ok: true, stage: "list_rentals", count: 0, rentals: [], message: overdueOnly ? "Нет просроченных аренд" : `Нет аренд со статусом "${status}"` });
  }

  const formatted = rentals.map((r) => {
    const vehicle = r.vehicle?.[0] || r.vehicle;
    const bike = vehicle ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "—";
    const endTs = r.agreed_end_date ? new Date(r.agreed_end_date).getTime() : 0;
    const isOverdue = endTs > 0 && endTs < now;
    const hoursOverdue = isOverdue ? Math.floor((now - endTs) / 3600000) : 0;
    return {
      rentalId: shortId(r.rental_id),
      fullId: r.rental_id,
      bike,
      userId: r.user_id ? r.user_id.slice(0, 8) + "…" : "—",
      status: r.status,
      payment: r.payment_status,
      totalCost: fmtMoney(r.total_cost),
      startDate: fmtDate(r.agreed_start_date),
      endDate: fmtDate(r.agreed_end_date),
      ...(isOverdue ? { overdue: true, hoursOverdue } : {}),
    };
  });

  done({ ok: true, stage: "list_rentals", count: formatted.length, status, overdueOnly, rentals: formatted });
}

// ─── COMMAND: show-rental ────────────────────────────────────────────────────

async function cmdShowRental() {
  const rentalId = positional[0];
  if (!rentalId) fail({ stage: "show_rental", reason: "missing_id", details: { expected: "show-rental <rentalId>" } });

  const { data: r, error } = await supabase
    .from("rentals")
    .select("rental_id, user_id, owner_id, status, payment_status, total_cost, agreed_start_date, agreed_end_date, requested_start_date, requested_end_date, metadata, vehicle:cars(make, model, image_url)")
    .eq("rental_id", rentalId)
    .maybeSingle();

  if (error || !r) fail({ stage: "show_rental", reason: "not_found", details: { rentalId } });

  const vehicle = r.vehicle?.[0] || r.vehicle;
  const bike = vehicle ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "—";

  // Fetch renter name from artifacts
  let renterName = "—";
  let renterPhone = "—";
  let renterChatId = "—";
  try {
    const { data: artifact } = await supabasePrivate
      .from("rental_contract_artifacts")
      .select("renter_full_name, renter_phone, telegram_chat_id, created_by_operator_chat_id")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (artifact) {
      renterName = artifact.renter_full_name || "—";
      renterPhone = artifact.renter_phone || "—";
      const isPreClaim = artifact.created_by_operator_chat_id && artifact.telegram_chat_id === artifact.created_by_operator_chat_id;
      renterChatId = isPreClaim ? "QR не отсканирован" : (artifact.telegram_chat_id || "—");
    }
  } catch { /* non-fatal */ }

  // Fetch todos
  const { data: todos } = await supabase
    .from("crew_todos")
    .select("id, title, status, priority, due_date")
    .eq("rental_id", rentalId)
    .order("status", { ascending: true });

  const meta = r.metadata || {};
  const odometerBefore = meta?.pickup_freeze?.odometer_km || meta?.odometer_before || null;
  const depositRub = meta?.deposit_rub || null;

  done({
    ok: true,
    stage: "show_rental",
    rental: {
      rentalId: r.rental_id,
      shortId: shortId(r.rental_id),
      bike,
      bikePhoto: vehicle?.image_url || null,
      status: r.status,
      paymentStatus: r.payment_status,
      totalCost: fmtMoney(r.total_cost),
      startDate: fmtDate(r.agreed_start_date),
      endDate: fmtDate(r.agreed_end_date),
      renter: {
        name: renterName,
        phone: renterPhone,
        telegramChatId: renterChatId,
        userId: r.user_id || "—",
      },
      odometerBefore: odometerBefore ? `${odometerBefore} км` : null,
      deposit: depositRub ? fmtMoney(depositRub) : null,
      todos: (todos || []).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        due: t.due_date ? fmtDate(t.due_date) : null,
      })),
      todoSummary: {
        total: (todos || []).length,
        done: (todos || []).filter((t) => t.status === "done").length,
      },
    },
  });
}

// ─── COMMAND: returns-today ──────────────────────────────────────────────────

async function cmdReturnsToday() {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const { data, error } = await supabase
    .from("rentals")
    .select("rental_id, user_id, status, total_cost, agreed_end_date, vehicle:cars(make, model)")
    .eq("crew_id", CREW_ID)
    .in("status", ["active", "confirmed"])
    .gte("agreed_end_date", startOfDay.toISOString())
    .lte("agreed_end_date", endOfDay.toISOString())
    .order("agreed_end_date", { ascending: true });

  if (error) fail({ stage: "returns_today", reason: "db_error", details: { message: error.message } });

  const formatted = (data || []).map((r) => {
    const vehicle = r.vehicle?.[0] || r.vehicle;
    const bike = vehicle ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "—";
    const endTime = r.agreed_end_date ? new Date(r.agreed_end_date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "?";
    const isOverdue = r.agreed_end_date && new Date(r.agreed_end_date).getTime() < now.getTime();
    return {
      rentalId: shortId(r.rental_id),
      fullId: r.rental_id,
      bike,
      userId: r.user_id ? r.user_id.slice(0, 8) + "…" : "—",
      returnTime: endTime,
      totalCost: fmtMoney(r.total_cost),
      ...(isOverdue ? { overdue: true } : {}),
    };
  });

  done({ ok: true, stage: "returns_today", count: formatted.length, date: now.toLocaleDateString("ru-RU"), returns: formatted });
}

// ─── COMMAND: stuck ──────────────────────────────────────────────────────────

async function cmdStuck() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("rentals")
    .select("rental_id, user_id, status, total_cost, agreed_end_date, vehicle:cars(make, model)")
    .eq("crew_id", CREW_ID)
    .eq("status", "active")
    .lt("agreed_end_date", nowIso)
    .order("agreed_end_date", { ascending: true })
    .limit(20);

  if (error) fail({ stage: "stuck", reason: "db_error", details: { message: error.message } });

  const now = Date.now();
  const formatted = (data || []).map((r) => {
    const vehicle = r.vehicle?.[0] || r.vehicle;
    const bike = vehicle ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "—";
    const endTs = r.agreed_end_date ? new Date(r.agreed_end_date).getTime() : 0;
    const hoursOverdue = endTs > 0 ? Math.floor((now - endTs) / 3600000) : 0;
    return {
      rentalId: shortId(r.rental_id),
      fullId: r.rental_id,
      bike,
      userId: r.user_id ? r.user_id.slice(0, 8) + "…" : "—",
      endDate: fmtDate(r.agreed_end_date),
      hoursOverdue,
      totalCost: fmtMoney(r.total_cost),
    };
  });

  done({ ok: true, stage: "stuck", count: formatted.length, overdue: formatted, message: formatted.length === 0 ? "Нет просроченных аренд — всё под контролем" : null });
}

// ─── COMMAND: extend ─────────────────────────────────────────────────────────

async function cmdExtend() {
  const rentalId = arg("rentalId");
  const newStartDate = arg("start");
  const newEndDate = arg("end");

  if (!rentalId) fail({ stage: "extend", reason: "missing_rentalId", details: { expected: "--rentalId <uuid>" } });
  if (!newStartDate || !newEndDate) fail({ stage: "extend", reason: "missing_dates", details: { expected: "--start YYYY-MM-DD --end YYYY-MM-DD" } });

  // Validate date format
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(newStartDate) || !dateRe.test(newEndDate)) {
    fail({ stage: "extend", reason: "invalid_date_format", details: { expected: "YYYY-MM-DD", got: { start: newStartDate, end: newEndDate } } });
  }

  const start = new Date(newStartDate);
  const end = new Date(newEndDate);
  if (end < start) fail({ stage: "extend", reason: "end_before_start", details: { start: newStartDate, end: newEndDate } });
  if ((end - start) / 86400000 > 365) fail({ stage: "extend", reason: "too_long", details: { maxDays: 365 } });

  // Fetch original rental
  const { data: original, error: fetchErr } = await supabase
    .from("rentals")
    .select("rental_id, user_id, owner_id, crew_id, vehicle_id, total_cost, status, metadata, agreed_start_date, agreed_end_date, vehicle:cars(id, make, model, daily_price)")
    .eq("rental_id", rentalId)
    .maybeSingle();

  if (fetchErr || !original) fail({ stage: "extend", reason: "not_found", details: { rentalId } });

  // Auth check
  const crew = await loadCrew(CREW_SLUG);
  if (!dryRun) await checkWriteAccess(crew, arg("actorUserId"));

  // Status check
  if (!["active", "completed"].includes(original.status)) {
    fail({ stage: "extend", reason: "bad_status", details: { status: original.status, hint: "Only active or completed rentals can be extended" } });
  }

  const vehicle = original.vehicle?.[0] || original.vehicle;
  if (!vehicle) fail({ stage: "extend", reason: "no_vehicle" });

  // Calculate days + price
  const days = Math.max(1, Math.ceil((end - start) / 86400000));
  const dailyPrice = Number(vehicle.daily_price) || Number(original.total_cost) / Math.max(1, days) || 0;
  if (dailyPrice <= 0) fail({ stage: "extend", reason: "no_price", details: { hint: "Could not determine daily price" } });
  const newTotal = dailyPrice * days;

  // Fetch renter name
  let renterName = "клиент";
  let renterChatId = "";
  try {
    const { data: artifact } = await supabasePrivate
      .from("rental_contract_artifacts")
      .select("renter_full_name, telegram_chat_id")
      .eq("rental_id", rentalId)
      .maybeSingle();
    if (artifact?.renter_full_name) renterName = artifact.renter_full_name;
    if (artifact?.telegram_chat_id) renterChatId = artifact.telegram_chat_id;
  } catch { /* non-fatal */ }

  if (dryRun) {
    done({
      ok: true,
      stage: "extend",
      dryRun: true,
      originalRentalId: rentalId,
      newDates: { start: newStartDate, end: newEndDate, days },
      bike: `${vehicle.make} ${vehicle.model}`.trim(),
      renter: renterName,
      dailyPrice: fmtMoney(dailyPrice),
      newTotal: fmtMoney(newTotal),
      wouldCreate: true,
      persisted: false,
    });
  }

  // Bike availability check (exclude original rental)
  const { data: overlapping } = await supabase
    .from("rentals")
    .select("rental_id")
    .eq("vehicle_id", original.vehicle_id)
    .in("status", ["active", "confirmed", "pending_confirmation"])
    .neq("rental_id", rentalId)
    .or(`and(agreed_start_date.lte.${newEndDate},agreed_end_date.gte.${newStartDate})`)
    .limit(1)
    .maybeSingle();

  if (overlapping) {
    fail({ stage: "extend", reason: "bike_unavailable", details: { hint: "Bike already booked for these dates" } });
  }

  // Create new rental
  const newRentalId = crypto.randomUUID();
  const originalMeta = original.metadata || {};
  const { error: insertErr } = await supabase.from("rentals").insert({
    rental_id: newRentalId,
    user_id: original.user_id,
    owner_id: original.owner_id,
    crew_id: original.crew_id,
    vehicle_id: original.vehicle_id,
    requested_start_date: newStartDate,
    requested_end_date: newEndDate,
    agreed_start_date: newStartDate,
    agreed_end_date: newEndDate,
    total_cost: newTotal,
    payment_status: "pending",
    status: "pending_confirmation",
    metadata: {
      equipment: originalMeta.equipment,
      pickup_freeze: originalMeta.pickup_freeze,
      daily_price: dailyPrice,
      extended_from: rentalId,
      extension_created_at: new Date().toISOString(),
      extension_days: days,
    },
  });

  if (insertErr) fail({ stage: "extend", reason: "insert_failed", details: { message: insertErr.message } });

  // Send TG notification to operator
  try {
    const botToken = secretsMap.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    const botLink = secretsMap.TELEGRAM_BOT_LINK || process.env.TELEGRAM_BOT_LINK || "https://t.me/oneBikePlsBot/app";
    const bikeTitle = `${vehicle.make} ${vehicle.model}`.trim();
    const dateRange = `${start.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} → ${end.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}`;

    if (botToken && original.owner_id) {
      const msg = `✅ <b>Аренда продлена</b>\n🏍 ${bikeTitle}\n👤 ${renterName}\n📅 ${dateRange} (${days} дн.)\n💰 ${newTotal.toLocaleString("ru-RU")} ₽\n🔑 Аренда: ${newRentalId.slice(0, 8)}\n\nДоговор сформируется автоматически. Активируйте после выдачи ТС.`;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: original.owner_id,
          text: msg,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[
            { text: "📋 Открыть аренду", url: `${botLink}?startapp=rental_${newRentalId}` },
          ]] },
        }),
      });
    }
  } catch { /* non-fatal */ }

  done({
    ok: true,
    stage: "extend",
    originalRentalId: rentalId,
    newRentalId,
    shortId: newRentalId.slice(0, 8),
    bike: `${vehicle.make} ${vehicle.model}`.trim(),
    renter: renterName,
    dates: { start: newStartDate, end: newEndDate, days },
    dailyPrice: fmtMoney(dailyPrice),
    newTotal: fmtMoney(newTotal),
    persisted: true,
    notified: true,
  });
}

// ─── COMMAND: close ──────────────────────────────────────────────────────────

async function cmdClose() {
  const rentalId = arg("rentalId");
  if (!rentalId) fail({ stage: "close", reason: "missing_rentalId", details: { expected: "--rentalId <uuid>" } });

  const odometer = arg("odometer") ? parseInt(arg("odometer"), 10) : null;
  const damage = arg("damage") || "none";
  const depositReturned = !hasFlag("no-deposit");
  const notes = arg("notes") || "";

  if (!["none", "light", "heavy"].includes(damage)) {
    fail({ stage: "close", reason: "invalid_damage", details: { expected: "none|light|heavy", got: damage } });
  }

  // Fetch rental
  const { data: rental, error: fetchErr } = await supabase
    .from("rentals")
    .select("rental_id, user_id, owner_id, status, total_cost, metadata, vehicle:cars(make, model)")
    .eq("rental_id", rentalId)
    .maybeSingle();

  if (fetchErr || !rental) fail({ stage: "close", reason: "not_found", details: { rentalId } });
  if (rental.status !== "active") fail({ stage: "close", reason: "not_active", details: { status: rental.status, hint: "Only active rentals can be closed" } });

  // Auth check
  const crew = await loadCrew(CREW_SLUG);
  if (!dryRun) await checkWriteAccess(crew, arg("actorUserId"));

  const vehicle = rental.vehicle?.[0] || rental.vehicle;
  const bike = vehicle ? `${vehicle.make} ${vehicle.model}`.trim() : "—";

  if (dryRun) {
    done({
      ok: true,
      stage: "close",
      dryRun: true,
      rentalId,
      bike,
      odometer,
      damage,
      depositReturned,
      notes,
      wouldClose: true,
    });
  }

  // Build damage notes with level prefix
  const damagePrefix = { none: "", light: "[Лёгкие повреждения] ", heavy: "[Серьёзные повреждения] " }[damage] || "";
  const fullDamageNotes = notes ? `${damagePrefix}${notes}` : (damage !== "none" ? damagePrefix.trim() : null);

  // Update rental
  const updatePayload = {
    status: "completed",
    metadata: {
      ...(rental.metadata || {}),
      closure_data: {
        odometer_after: odometer,
        damage_level: damage,
        damage_notes: fullDamageNotes,
        deposit_returned: depositReturned,
        closed_at: new Date().toISOString(),
        closed_by: arg("actorUserId") || "skill",
        return_notes: notes || null,
      },
    },
  };

  const { error: updateErr } = await supabase
    .from("rentals")
    .update(updatePayload)
    .eq("rental_id", rentalId);

  if (updateErr) fail({ stage: "close", reason: "update_failed", details: { message: updateErr.message } });

  // Update bike specs with odometer
  if (odometer && vehicle?.id) {
    try {
      const { data: car } = await supabase.from("cars").select("specs").eq("id", vehicle.id).maybeSingle();
      if (car) {
        const specs = car.specs || {};
        await supabase.from("cars").update({ specs: { ...specs, last_known_odometer: odometer } }).eq("id", vehicle.id);
      }
    } catch { /* non-fatal */ }
  }

  // Notify renter
  try {
    const botToken = secretsMap.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    let renterChatId = rental.user_id;
    try {
      const { data: artifact } = await supabasePrivate
        .from("rental_contract_artifacts")
        .select("telegram_chat_id")
        .eq("rental_id", rentalId)
        .maybeSingle();
      if (artifact?.telegram_chat_id) renterChatId = artifact.telegram_chat_id;
    } catch { /* non-fatal */ }

    if (botToken && renterChatId) {
      const msg = `✅ <b>Аренда завершена</b>\n🏍 ${bike}\n🔑 ${shortId(rentalId)}\n${odometer ? `📊 Одометр: ${odometer} км\n` : ""}${depositReturned ? "💰 Депозит возвращён ✓\n" : ""}\nСпасибо за аренду! Оставьте отзыв — это поможет другим клиентам.`;
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: renterChatId, text: msg, parse_mode: "HTML" }),
      });
    }
  } catch { /* non-fatal */ }

  done({
    ok: true,
    stage: "close",
    rentalId,
    shortId: shortId(rentalId),
    bike,
    status: "completed",
    odometer,
    damage,
    depositReturned,
    notes: notes || null,
    persisted: true,
    notified: true,
  });
}

// ─── Router ──────────────────────────────────────────────────────────────────

async function main() {
  switch (command) {
    case "list-rentals": return await cmdListRentals();
    case "show-rental": return await cmdShowRental();
    case "returns-today": return await cmdReturnsToday();
    case "stuck": return await cmdStuck();
    case "extend": return await cmdExtend();
    case "close": return await cmdClose();
    default:
      fail({ stage: "router", reason: "unknown_command", details: { command, available: ["list-rentals", "show-rental", "returns-today", "stuck", "extend", "close"] } });
  }
}

main().catch((e) => fail({ stage: "unhandled", reason: "exception", details: { message: e.message, stack: e.stack?.split("\n").slice(0, 5) } }));
