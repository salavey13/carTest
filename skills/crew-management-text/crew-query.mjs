#!/usr/bin/env node
// crew-query.mjs — Text-based crew management for VIP Bike.
//
// Mirrors the `/franchize/[slug]/crew`, `/crew/members`, and `/crew/shifts`
// pages. Queries Supabase REST API directly (no Node server, no supabase-js
// dep) and prints formatted text tables — same data as the crew UI but as
// CLI output, ready for Telegram / shell piping.
//
// Usage:
//   node crew-query.mjs crew-info
//   node crew-query.mjs crew-members
//   node crew-query.mjs crew-member-detail <userId>
//   node crew-query.mjs crew-stats
//   node crew-query.mjs crew-todos [--assignee <userId>] [--status pending|done|all] [--overdue]
//   node crew-query.mjs crew-todo-stats
//
// Write commands (NOT implemented here — use curl recipes in SKILL.md):
//   - update-member-role <userId> --role <owner|co_owner|admin|mechanic|member>
//   - crew-shifts [--date YYYY-MM-DD]
//
// Env:
//   SUPABASE_URL                (default: https://inmctohsodgdohamhzag.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY   (fallback: read from --secrets=<path> or
//                                /home/z/my-project/upload/secrets.txt)
//   CREW_CLI_ACTOR              (optional — telegram user_id of the operator
//                                running the command, for audit logging)
//
// All output goes to stdout; errors go to stderr with exit code 2.

import { readFileSync } from "node:fs";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SUPA_URL = "https://inmctohsodgdohamhzag.supabase.co";
const DEFAULT_SECRETS_PATH = "/home/z/my-project/upload/secrets.txt";

// Crew context — hardcoded for vip-bike (override via env if needed).
const CREW_SLUG = process.env.CREW_SLUG || "vip-bike";
const CREW_ID = process.env.CREW_ID || "2d5fde70-1dd3-4f0d-8d72-66ccf6908746";

// Web app links — appended to every command's output.
const WEB_BASE = "https://vip-bike.ru/franchize/vip-bike";
const WEB_LINKS = {
  crew: `${WEB_BASE}/crew`,
  members: `${WEB_BASE}/crew/members`,
  shifts: `${WEB_BASE}/crew/shifts`,
};

// Allowed crew_member roles (matches the `crew_members_role_check` DB constraint:
//   role IN ('owner','co_owner','admin','mechanic','member')).
const ALLOWED_ROLES = ["owner", "co_owner", "admin", "mechanic", "member"];

// Role display labels (RU).
const ROLE_LABELS = {
  owner:    "Владелец",
  co_owner: "Совладелец",
  admin:    "Администратор",
  mechanic: "Механик",
  member:   "Участник",
};

// Membership status labels.
const STATUS_LABELS = {
  active:   "Активен",
  inactive: "Неактивен",
  invited:  "Приглашён",
  pending:  "Ожидает",
};

// Known todo categories (extend as the schema grows).
const KNOWN_TODO_CATEGORIES = new Set([
  "lead_followup",
  "rental_verification",
  "general",
  "maintenance",
  "documents",
]);

// ─── Supabase REST client ─────────────────────────────────────────────────────

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
 * @param {string} table — table name, e.g. "crew_members"
 * @param {object} q     — { select, filters: [...], order, limit }
 * @param {object} opts  — { schema: "public" | "private" }
 * @returns {Promise<Array<object>>}
 */
async function supabaseQuery(table, q = {}, opts = {}) {
  const schema = opts.schema || "public";
  const params = new URLSearchParams();

  if (q.select) params.set("select", q.select);

  // Filters are appended (not set) so multiple filters on the same column work.
  if (Array.isArray(q.filters)) {
    for (const f of q.filters) {
      const idx = f.indexOf("=");
      const key = f.slice(0, idx);
      const val = f.slice(idx + 1);
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

// ─── Format helpers ───────────────────────────────────────────────────────────

/** Pad string to width, truncate with ellipsis if longer. */
function pad(s, width, align = "left") {
  s = s == null ? "" : String(s);
  if (s.length > width) return s.slice(0, Math.max(1, width - 1)) + "…";
  const sp = " ".repeat(Math.max(0, width - s.length));
  return align === "right" ? sp + s : s + sp;
}

/** Format an ISO timestamp as DD.MM.YYYY HH:MM (UTC). Empty if null. */
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

/** Format an ISO timestamp as DD.MM.YYYY (UTC). Empty if null. */
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Format an ISO timestamp as HH:MM (UTC). */
function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

/** Return true if a todo is overdue (due_date in past and status != done). */
function isOverdue(todo, nowMs = Date.now()) {
  if (!todo.due_date) return false;
  if (todo.status === "done") return false;
  return new Date(todo.due_date).getTime() < nowMs;
}

/** Format a duration in minutes as "Hч Mм" (or "Mм" if < 60). */
function fmtDuration(minutes) {
  if (minutes == null) return "—";
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}м`;
  if (rem === 0) return `${h}ч`;
  return `${h}ч ${rem}м`;
}

/** Resolve a "display name" for a user row. Falls back to username / user_id. */
function displayName(user) {
  if (!user) return "(unknown)";
  if (user.full_name) return user.full_name;
  if (user.username) return `@${user.username}`;
  return `ID:${user.user_id}`;
}

/** Resolve a short label for an assignee (used in compact tables). */
function assigneeLabel(todo, userMap) {
  if (!todo.assigned_to) return "(unassigned)";
  const u = userMap.get(todo.assigned_to);
  if (!u) return `ID:${todo.assigned_to}`;
  return u.username ? `@${u.username}` : displayName(u);
}

/** Normalize a `metadata` field that may be a string or object. */
function parseMeta(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

/** Extract contacts from crew.metadata (defensive — schema is loose). */
function extractContacts(metadata) {
  const m = parseMeta(metadata) || {};
  return m.contacts || null;
}

// ─── Command: crew-info ───────────────────────────────────────────────────────

async function cmdCrewInfo() {
  // Single-row fetch by slug.
  const rows = await supabaseQuery("crews", {
    select: "id,name,slug,description,logo_url,owner_id,created_at,updated_at,hq_location,metadata",
    filters: [`slug=eq.${CREW_SLUG}`],
    limit: 1,
  });
  if (!rows.length) {
    throw new Error(`Экипаж не найден: slug=${CREW_SLUG}`);
  }
  const crew = rows[0];

  // Member count (active + total).
  const allMembers = await supabaseQuery("crew_members", {
    select: "user_id,role,membership_status",
    filters: [`crew_id=eq.${crew.id}`],
  });
  const total = allMembers.length;
  const active = allMembers.filter((m) => m.membership_status === "active").length;

  // Owner display (resolve username / full_name from users).
  let ownerDisplay = `ID:${crew.owner_id}`;
  try {
    const ownerRows = await supabaseQuery("users", {
      select: "user_id,username,full_name",
      filters: [`user_id=eq.${crew.owner_id}`],
      limit: 1,
    });
    if (ownerRows.length) ownerDisplay = displayName(ownerRows[0]);
  } catch { /* fall back to ID */ }

  // Contacts from metadata.contacts.
  const contacts = extractContacts(crew.metadata) || {};
  const contactLines = [];
  if (contacts.primary_phone) contactLines.push(`Телефон:         ${contacts.primary_phone}`);
  if (contacts.working_hours) contactLines.push(`Часы работы:     ${contacts.working_hours}`);
  if (contacts.manager_sales)   contactLines.push(`Менеджер продаж: ${contacts.manager_sales}`);
  if (contacts.manager_support) contactLines.push(`Поддержка:       ${contacts.manager_support}`);
  if (!contactLines.length) contactLines.push("(контакты не заданы в metadata.contacts)");

  const out = [];
  out.push(`=== Экипаж ${crew.name} ===`);
  out.push(`Slug:             ${crew.slug || "—"}`);
  out.push(`ID:               ${crew.id}`);
  out.push(`Владелец:         ${ownerDisplay}`);
  out.push(`Создан:           ${fmtDate(crew.created_at)}`);
  out.push(`Обновлён:         ${fmtDate(crew.updated_at)}`);
  out.push(`Локация (HQ):     ${crew.hq_location || "—"}`);
  out.push(`Описание:`);
  out.push(`  ${crew.description || "(без описания)"}`);
  out.push(`Участники:        ${active} активных из ${total} всего`);
  out.push(`Контакты:`);
  for (const line of contactLines) out.push(`  ${line}`);
  out.push("");
  out.push(`🌐 Web: ${WEB_LINKS.crew}`);
  console.log(out.join("\n"));
}

// ─── Command: crew-members ────────────────────────────────────────────────────

async function cmdCrewMembers() {
  // Fetch crew_members with users join via PostgREST resource embedding.
  // We use the FK relationship crew_members_user_id_fkey (user_id → users.user_id).
  const rows = await supabaseQuery("crew_members", {
    select: [
      "user_id",
      "role",
      "membership_status",
      "joined_at",
      "live_status",
      "user:users!crew_members_user_id_fkey(user_id,username,full_name)",
    ].join(","),
    filters: [`crew_id=eq.${CREW_ID}`],
    order: "joined_at.asc",
  });

  if (!rows.length) {
    console.log(`=== Участники экипажа ${CREW_SLUG} (0) ===`);
    console.log("Нет участников.");
    console.log("");
    console.log(`🌐 Web: ${WEB_LINKS.members}`);
    return;
  }

  // Sort: owner first, then co_owner, admin, mechanic, member (then by joined_at).
  const roleOrder = { owner: 0, co_owner: 1, admin: 2, mechanic: 3, member: 4 };
  rows.sort((a, b) => {
    const ra = roleOrder[a.role] ?? 99;
    const rb = roleOrder[b.role] ?? 99;
    if (ra !== rb) return ra - rb;
    return String(a.joined_at || "").localeCompare(String(b.joined_at || ""));
  });

  const out = [];
  out.push(`=== Участники экипажа ${CREW_SLUG} (${rows.length}) ===`);
  out.push("");
  out.push(
    pad("User ID", 14) +
    pad("Username", 26) +
    pad("Имя", 24) +
    pad("Роль", 12) +
    pad("Статус", 12) +
    pad("С нами с", 12)
  );
  out.push("─".repeat(14 + 26 + 24 + 12 + 12 + 12));

  for (const m of rows) {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    const username = u?.username ? `@${u.username}` : "—";
    const fullName = u?.full_name || "—";
    out.push(
      pad(m.user_id, 14) +
      pad(username, 26) +
      pad(fullName, 24) +
      pad(ROLE_LABELS[m.role] || m.role, 12) +
      pad(STATUS_LABELS[m.membership_status] || m.membership_status, 12) +
      pad(fmtDate(m.joined_at), 12)
    );
  }

  out.push("");
  out.push(`Всего: ${rows.length}`);
  out.push(`🌐 Web: ${WEB_LINKS.members}`);
  console.log(out.join("\n"));
}

// ─── Command: crew-member-detail ──────────────────────────────────────────────

async function cmdCrewMemberDetail(userId) {
  if (!userId) {
    throw new Error("userId required: crew-member-detail <userId>");
  }

  // 1. Resolve membership + user profile in parallel.
  const [memberRows, userRows] = await Promise.all([
    supabaseQuery("crew_members", {
      select: "user_id,role,membership_status,joined_at,live_status,last_location",
      filters: [`crew_id=eq.${CREW_ID}`, `user_id=eq.${userId}`],
      limit: 1,
    }),
    supabaseQuery("users", {
      select: "user_id,username,full_name,metadata",
      filters: [`user_id=eq.${userId}`],
      limit: 1,
    }),
  ]);

  if (!memberRows.length) {
    throw new Error(`Участник не найден: user_id=${userId} (crew=${CREW_SLUG})`);
  }
  const member = memberRows[0];
  const user = userRows[0] || null;
  const userMeta = parseMeta(user?.metadata) || {};

  // 2. Their todos (assigned_to).
  const todos = await supabaseQuery("crew_todos", {
    select: "id,assigned_to,title,description,category,status,priority,due_date,created_at,completed_at,lead_id,rental_id",
    filters: [`crew_id=eq.${CREW_ID}`, `assigned_to=eq.${userId}`],
    order: "created_at.desc",
  });

  // 3. Their assigned rentals (rentals where user_id = userId AND vehicle belongs to crew).
  // PostgREST resource embedding: rentals.user_id → users.user_id (already the filter).
  // We need crew filter — rentals has `crew_id` column? It doesn't (verified via schema dump).
  // The crew filter on rentals is via the `vehicle_id` → cars.id → cars.crew_id join.
  // We use resource embedding: `vehicle:cars!inner(crew_id)` with `vehicle.crew_id=eq.${CREW_ID}`.
  let rentals = [];
  try {
    rentals = await supabaseQuery("rentals", {
      select: [
        "rental_id",
        "user_id",
        "vehicle_id",
        "status",
        "payment_status",
        "total_cost",
        "agreed_start_date",
        "agreed_end_date",
        "requested_start_date",
        "requested_end_date",
        "created_at",
        "vehicle:cars!rentals_vehicle_id_fkey(id,make,model,crew_id)",
      ].join(","),
      filters: [`user_id=eq.${userId}`, `vehicle.crew_id=eq.${CREW_ID}`],
      order: "created_at.desc",
      limit: 50,
    });
  } catch (e) {
    // Fallback: fetch without crew filter, then filter client-side via a bike lookup.
    rentals = await supabaseQuery("rentals", {
      select: "rental_id,user_id,vehicle_id,status,payment_status,total_cost,agreed_start_date,agreed_end_date,requested_start_date,requested_end_date,created_at",
      filters: [`user_id=eq.${userId}`],
      order: "created_at.desc",
      limit: 50,
    });
  }

  // 4. Render.
  const out = [];
  out.push(`=== Карточка участника ${displayName(user)} ===`);
  out.push("");
  out.push(`User ID:          ${member.user_id}`);
  out.push(`Username:         ${user?.username ? "@" + user.username : "—"}`);
  out.push(`Полное имя:       ${user?.full_name || "—"}`);
  out.push(`Роль:             ${ROLE_LABELS[member.role] || member.role}`);
  out.push(`Статус:           ${STATUS_LABELS[member.membership_status] || member.membership_status}`);
  out.push(`Live-статус:      ${member.live_status || "—"}`);
  out.push(`В экипаже с:      ${fmtDate(member.joined_at)}`);
  if (member.last_location) out.push(`Локация:          ${JSON.stringify(member.last_location)}`);
  if (userMeta?.phone) out.push(`Телефон (meta):   ${userMeta.phone}`);
  out.push("");

  // Todos block.
  const nowMs = Date.now();
  const todoPending  = todos.filter((t) => t.status === "pending").length;
  const todoProgress = todos.filter((t) => t.status === "in_progress").length;
  const todoDone     = todos.filter((t) => t.status === "done").length;
  const todoOverdue  = todos.filter((t) => isOverdue(t, nowMs)).length;
  out.push(`— Задачи (${todos.length}: pending ${todoPending}, in_progress ${todoProgress}, done ${todoDone}, overdue ${todoOverdue}) —`);
  if (!todos.length) {
    out.push("  Нет задач.");
  } else {
    for (const t of todos.slice(0, 20)) {
      const flag = t.status === "done" ? "✓" : (isOverdue(t, nowMs) ? "⚠" : " ");
      const due = t.due_date ? ` due ${fmtDate(t.due_date)}` : "";
      const prio = t.priority ? `[${t.priority}]` : "";
      out.push(`  ${flag} ${prio} ${pad(t.title || "(без названия)", 60)}${due}`);
    }
    if (todos.length > 20) out.push(`  … и ещё ${todos.length - 20} задач (используйте crew-todos --assignee ${userId})`);
  }
  out.push("");

  // Rentals block.
  out.push(`— Аренды (${rentals.length}) —`);
  if (!rentals.length) {
    out.push("  Нет аренд.");
  } else {
    out.push(
      "  " +
      pad("Rental ID", 12) +
      pad("Байк", 24) +
      pad("Статус", 12) +
      pad("Период", 23) +
      pad("Сумма", 10, "right")
    );
    out.push("  " + "─".repeat(12 + 24 + 12 + 23 + 10));
    for (const r of rentals.slice(0, 20)) {
      let bikeTitle = r.vehicle_id || "—";
      const veh = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
      if (veh && (veh.make || veh.model)) {
        bikeTitle = [veh.make, veh.model].filter(Boolean).join(" ");
      }
      const period = `${fmtDate(r.requested_start_date)} - ${fmtDate(r.requested_end_date)}`;
      const sum = r.total_cost != null ? `${Number(r.total_cost).toLocaleString("ru-RU")} ₽` : "—";
      out.push(
        "  " +
        pad(String(r.rental_id || "").slice(0, 12), 12) +
        pad(bikeTitle, 24) +
        pad(r.status || "—", 12) +
        pad(period, 23) +
        pad(sum, 10, "right")
      );
    }
    if (rentals.length > 20) out.push(`  … и ещё ${rentals.length - 20} аренд`);
  }
  out.push("");
  out.push(`🌐 Web: ${WEB_LINKS.members}`);
  console.log(out.join("\n"));
}

// ─── Command: crew-stats ──────────────────────────────────────────────────────

async function cmdCrewStats() {
  // Fetch members + todos in parallel.
  const [members, todos] = await Promise.all([
    supabaseQuery("crew_members", {
      select: "user_id,role,membership_status",
      filters: [`crew_id=eq.${CREW_ID}`],
    }),
    supabaseQuery("crew_todos", {
      select: "id,assigned_to,status,due_date,category",
      filters: [`crew_id=eq.${CREW_ID}`],
    }),
  ]);

  const nowMs = Date.now();
  const total = todos.length;
  const pending  = todos.filter((t) => t.status === "pending").length;
  const progress = todos.filter((t) => t.status === "in_progress").length;
  const done     = todos.filter((t) => t.status === "done").length;
  const overdue  = todos.filter((t) => isOverdue(t, nowMs)).length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // Count members by role.
  const byRole = {};
  for (const r of ALLOWED_ROLES) byRole[r] = 0;
  for (const m of members) {
    byRole[m.role] = (byRole[m.role] || 0) + 1;
  }

  const out = [];
  out.push(`=== Статистика экипажа ${CREW_SLUG} ===`);
  out.push("");
  out.push("— Участники по ролям —");
  for (const r of ALLOWED_ROLES) {
    out.push(`  ${pad(ROLE_LABELS[r], 14)} ${String(byRole[r] || 0).padStart(3)}`);
  }
  out.push(`  ${pad("Всего участников", 14)} ${String(members.length).padStart(3)}`);
  out.push("");
  out.push("— Задачи —");
  out.push(`  Всего:           ${total}`);
  out.push(`  Pending:         ${pending}`);
  out.push(`  In progress:     ${progress}`);
  out.push(`  Done:            ${done}`);
  out.push(`  Просрочено:      ${overdue}`);
  out.push(`  Completion rate: ${completionRate}% (${done}/${total})`);
  out.push("");
  out.push(`🌐 Web: ${WEB_LINKS.crew}`);
  console.log(out.join("\n"));
}

// ─── Command: crew-todos ──────────────────────────────────────────────────────

async function cmdCrewTodos(filters = {}) {
  const dbFilters = [`crew_id=eq.${CREW_ID}`];
  if (filters.assignee) dbFilters.push(`assigned_to=eq.${filters.assignee}`);
  if (filters.status && filters.status !== "all") {
    dbFilters.push(`status=eq.${filters.status}`);
  }

  // Pull all crew todos (with assignee + creator enrichment) and filter client-side
  // for `--overdue` (PostgREST can't do `due_date < now()` as a parameter).
  const rows = await supabaseQuery("crew_todos", {
    select: [
      "id",
      "assigned_to",
      "title",
      "category",
      "status",
      "priority",
      "due_date",
      "created_at",
      "completed_at",
      "assignee:users!crew_todos_assigned_to_fkey(user_id,username,full_name)",
    ].join(","),
    filters: dbFilters,
    order: "created_at.desc",
    limit: 500,
  });

  const nowMs = Date.now();
  let items = rows;
  if (filters.overdue) {
    items = rows.filter((t) => isOverdue(t, nowMs));
  }

  // Build a user map for the assignee column.
  const userMap = new Map();
  for (const t of rows) {
    const u = Array.isArray(t.assignee) ? t.assignee[0] : t.assignee;
    if (u && u.user_id) userMap.set(u.user_id, u);
  }

  const out = [];
  const filterBits = [];
  if (filters.assignee) filterBits.push(`assignee=${filters.assignee}`);
  if (filters.status && filters.status !== "all") filterBits.push(`status=${filters.status}`);
  if (filters.overdue) filterBits.push("overdue=1");
  const filterLine = filterBits.length ? `Фильтр: ${filterBits.join(", ")}` : "";

  out.push(`=== Задачи экипажа ${CREW_SLUG} (${items.length}${filterLine ? ", " + filterLine : ""}) ===`);
  if (!items.length) {
    out.push("Нет задач по выбранным фильтрам.");
    out.push("");
    out.push(`🌐 Web: ${WEB_LINKS.crew}`);
    console.log(out.join("\n"));
    return;
  }

  out.push("");
  out.push(
    pad("#", 4) +
    pad("Статус", 12) +
    pad("Приор.", 8) +
    pad("Исполнитель", 22) +
    pad("Due", 12) +
    pad("Категория", 20) +
    "Заголовок"
  );
  out.push("─".repeat(4 + 12 + 8 + 22 + 12 + 20 + 30));

  let i = 1;
  for (const t of items.slice(0, 100)) {
    let statusLabel = t.status || "—";
    if (t.status === "done")            statusLabel = "✓ done";
    else if (t.status === "in_progress") statusLabel = "→ in_prog";
    else if (isOverdue(t, nowMs))        statusLabel = "⚠ overdue";
    else                                  statusLabel = "  pending";

    const due = t.due_date ? fmtDate(t.due_date) : "—";
    const cat = KNOWN_TODO_CATEGORIES.has(t.category) ? t.category : (t.category || "general");
    out.push(
      pad(String(i++), 4) +
      pad(statusLabel, 12) +
      pad(t.priority || "—", 8) +
      pad(assigneeLabel(t, userMap), 22) +
      pad(due, 12) +
      pad(cat, 20) +
      (t.title || "(без названия)")
    );
  }
  if (items.length > 100) {
    out.push(`… и ещё ${items.length - 100} задач (уточните фильтр)`);
  }
  out.push("");
  out.push(`🌐 Web: ${WEB_LINKS.crew}`);
  console.log(out.join("\n"));
}

// ─── Command: crew-todo-stats ─────────────────────────────────────────────────

async function cmdCrewTodoStats() {
  // Fetch crew_members (to enumerate every member, even with zero todos) + all todos.
  const [members, todos] = await Promise.all([
    supabaseQuery("crew_members", {
      select: "user_id,role",
      filters: [`crew_id=eq.${CREW_ID}`],
    }),
    supabaseQuery("crew_todos", {
      select: "id,assigned_to,status,due_date",
      filters: [`crew_id=eq.${CREW_ID}`],
    }),
  ]);

  // Resolve display names for every user_id (members + any assigned_to).
  const ids = new Set(members.map((m) => m.user_id));
  for (const t of todos) if (t.assigned_to) ids.add(t.assigned_to);
  let userMap = new Map();
  if (ids.size > 0) {
    try {
      const users = await supabaseQuery("users", {
        select: "user_id,username,full_name",
        filters: [`user_id=in.(${Array.from(ids).map((id) => `"${id}"`).join(",")})`],
      });
      for (const u of users) userMap.set(u.user_id, u);
    } catch { /* tolerate — fall back to ID labels */ }
  }

  // Per-assignee aggregation.
  const stats = new Map();
  for (const m of members) {
    stats.set(m.user_id, { pending: 0, done: 0, overdue: 0, total: 0, role: m.role });
  }
  stats.set("__unassigned__", { pending: 0, done: 0, overdue: 0, total: 0, role: null });

  const nowMs = Date.now();
  for (const t of todos) {
    const key = t.assigned_to || "__unassigned__";
    if (!stats.has(key)) stats.set(key, { pending: 0, done: 0, overdue: 0, total: 0, role: null });
    const s = stats.get(key);
    s.total += 1;
    if (t.status === "done") s.done += 1;
    else if (t.status === "pending") s.pending += 1;
    if (isOverdue(t, nowMs)) s.overdue += 1;
  }

  // Sort: members by role order (owner → member), then unassigned last.
  const roleOrder = { owner: 0, co_owner: 1, admin: 2, mechanic: 3, member: 4 };
  const sortedKeys = Array.from(stats.keys()).sort((a, b) => {
    if (a === "__unassigned__") return 1;
    if (b === "__unassigned__") return -1;
    const ra = roleOrder[stats.get(a).role] ?? 99;
    const rb = roleOrder[stats.get(b).role] ?? 99;
    return ra - rb;
  });

  const out = [];
  out.push(`=== Задачи экипажа ${CREW_SLUG} по исполнителям ===`);
  out.push("");
  out.push(
    pad("Исполнитель", 28) +
    pad("Роль", 10) +
    pad("Всего", 8, "right") +
    pad("Pending", 9, "right") +
    pad("Done", 8, "right") +
    pad("Overdue", 9, "right")
  );
  out.push("─".repeat(28 + 10 + 8 + 9 + 8 + 9));

  let totals = { total: 0, pending: 0, done: 0, overdue: 0 };
  for (const key of sortedKeys) {
    const s = stats.get(key);
    if (s.total === 0 && key !== "__unassigned__") {
      // Skip members with zero todos to keep the table compact? No — show all.
    }
    let label;
    let roleLabel;
    if (key === "__unassigned__") {
      label = "(unassigned)";
      roleLabel = "—";
    } else {
      const u = userMap.get(key);
      label = u ? displayName(u) : `ID:${key}`;
      roleLabel = ROLE_LABELS[s.role] || s.role || "—";
    }
    out.push(
      pad(label, 28) +
      pad(roleLabel, 10) +
      pad(String(s.total), 8, "right") +
      pad(String(s.pending), 9, "right") +
      pad(String(s.done), 8, "right") +
      pad(String(s.overdue), 9, "right")
    );
    totals.total   += s.total;
    totals.pending += s.pending;
    totals.done    += s.done;
    totals.overdue += s.overdue;
  }

  out.push("─".repeat(28 + 10 + 8 + 9 + 8 + 9));
  out.push(
    pad("ИТОГО", 28) +
    pad("", 10) +
    pad(String(totals.total), 8, "right") +
    pad(String(totals.pending), 9, "right") +
    pad(String(totals.done), 8, "right") +
    pad(String(totals.overdue), 9, "right")
  );
  out.push("");
  out.push(`🌐 Web: ${WEB_LINKS.crew}`);
  console.log(out.join("\n"));
}

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  // Strip leading --secrets / --url / --crewSlug / --crewId flags.
  const cleaned = [];
  let secretsPath = null;
  let url = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--secrets" || a.startsWith("--secrets=")) {
      secretsPath = a.includes("=") ? a.split("=")[1] : argv[++i];
      continue;
    }
    if (a === "--url" || a.startsWith("--url=")) {
      url = a.includes("=") ? a.split("=")[1] : argv[++i];
      continue;
    }
    cleaned.push(a);
  }
  return { cleaned, secretsPath, url };
}

function parseTodoFlags(tokens) {
  // tokens: everything after "crew-todos"
  const filters = { assignee: null, status: null, overdue: false };
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "--assignee" || t.startsWith("--assignee=")) {
      filters.assignee = t.includes("=") ? t.split("=")[1] : tokens[++i];
    } else if (t === "--status" || t.startsWith("--status=")) {
      const v = t.includes("=") ? t.split("=")[1] : tokens[++i];
      if (!["pending", "done", "in_progress", "all"].includes(v)) {
        throw new Error(`invalid --status "${v}" (use: pending|done|in_progress|all)`);
      }
      filters.status = v;
    } else if (t === "--overdue") {
      filters.overdue = true;
    } else {
      throw new Error(`unknown flag: ${t}`);
    }
  }
  return filters;
}

function printHelp() {
  const out = [];
  out.push("crew-query.mjs — text-based crew management for VIP Bike");
  out.push("");
  out.push("Usage:");
  out.push("  node crew-query.mjs crew-info");
  out.push("  node crew-query.mjs crew-members");
  out.push("  node crew-query.mjs crew-member-detail <userId>");
  out.push("  node crew-query.mjs crew-stats");
  out.push("  node crew-query.mjs crew-todos [--assignee <userId>] [--status pending|done|in_progress|all] [--overdue]");
  out.push("  node crew-query.mjs crew-todo-stats");
  out.push("");
  out.push("Common flags (before subcommand):");
  out.push("  --secrets <path>   Path to secrets.txt (default: /home/z/my-project/upload/secrets.txt)");
  out.push("  --url <url>        Supabase URL (default: https://inmctohsodgdohamhzag.supabase.co)");
  out.push("");
  out.push("Env vars:");
  out.push("  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CREW_SLUG, CREW_ID, CREW_CLI_ACTOR");
  out.push("");
  out.push("Write commands (use curl recipes in SKILL.md):");
  out.push("  update-member-role <userId> --role <owner|co_owner|admin|mechanic|member>");
  out.push("  crew-shifts [--date YYYY-MM-DD]");
  console.log(out.join("\n"));
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────

async function main() {
  const { cleaned: argv, secretsPath, url } = parseArgs(process.argv.slice(2));

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h" || argv[0] === "help") {
    printHelp();
    process.exit(0);
  }

  const cmd = argv[0];
  const rest = argv.slice(1);

  initSupabase({ secretsPath, url });

  try {
    switch (cmd) {
      case "crew-info":
        await cmdCrewInfo();
        break;
      case "crew-members":
        await cmdCrewMembers();
        break;
      case "crew-member-detail":
        await cmdCrewMemberDetail(rest[0]);
        break;
      case "crew-stats":
        await cmdCrewStats();
        break;
      case "crew-todos":
        await cmdCrewTodos(parseTodoFlags(rest));
        break;
      case "crew-todo-stats":
        await cmdCrewTodoStats();
        break;
      default:
        console.error(`ERROR: unknown command "${cmd}"`);
        console.error("       Run with --help for the list of commands.");
        process.exit(2);
    }
  } catch (err) {
    console.error(`ERROR: ${err.message || err}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(2);
  }
}

main();
