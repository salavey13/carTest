#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// assign-subrenter-skill.mjs — Assign a subrenter (partner owner) to a bike
// ═══════════════════════════════════════════════════════════════════════════
//
// CLI twin of the web app's «Субарендаторы (мини-админы)» panel
// (setBikeSubrenterAction). Writes cars.specs.subrenter_chat_id, keeps the
// backwards ownership flag users.metadata.subrenterOf = {crewId:[bikeIds]}
// in sync (both the NEW and the PREVIOUS partner) and notifies the partner
// in Telegram via the forwarding API (no bot token needed locally).
//
// USAGE:
//   node scripts/assign-subrenter-skill.mjs --list
//   node scripts/assign-subrenter-skill.mjs --user 425137783 --bike kawasaki-ex650k            # dry-run
//   node scripts/assign-subrenter-skill.mjs --user @K0r_Al --bike kawasaki --apply             # write
//   node scripts/assign-subrenter-skill.mjs --user "Александр Корнилов" --bike ex650 --apply   # fuzzy name
//   node scripts/assign-subrenter-skill.mjs --bike kawasaki-ex650k --clear --apply             # remove assignment
//
// FLAGS:
//   --user <v>    partner: Telegram id | @username | username | full-name substring
//   --bike <v>    bike: id (exact or substring) | make/model substring
//   --clear       remove the assignment (mutually exclusive with --user)
//   --slug <s>    crew slug (default: vip-bike)
//   --apply       actually write (default: dry-run)
//   --no-notify   skip the Telegram notification to the partner
//   --secrets=<p> secrets file with NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//                 (default: /home/z/my-project/upload/secrets_all.txt, then
//                 /home/z/my-project/upload/secrets.txt, then process.env)
//
// Exit codes: 0 ok (incl. dry-run), 1 usage/lookup error, 2 write error.

import { readFileSync, existsSync } from "node:fs";

// ─── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    const eq = a.indexOf("=");
    if (eq > 2) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else if (args[i + 1] && !args[i + 1].startsWith("--")) flags[a.slice(2)] = args[++i];
    else flags[a.slice(2)] = true;
  }
}

const userQuery = typeof flags.user === "string" ? flags.user.trim() : "";
const bikeQuery = typeof flags.bike === "string" ? flags.bike.trim() : "";
const CREW_SLUG = typeof flags.slug === "string" && flags.slug ? flags.slug : "vip-bike";
const APPLY = flags.apply === true;
const CLEAR = flags.clear === true;
const NOTIFY = flags.notify !== false;
const LIST = flags.list === true;

if (!LIST) {
  if (CLEAR && userQuery) die("--clear and --user are mutually exclusive", 1);
  if (!CLEAR && !userQuery) die("Pass --user <id|@username|name> (or --clear)", 1);
  if (!bikeQuery) die("Pass --bike <id|model substring>", 1);
}

// ─── Credentials ─────────────────────────────────────────────────────────────

const SECRETS_CANDIDATES = [
  typeof flags.secrets === "string" ? flags.secrets : null,
  "/home/z/my-project/upload/secrets_all.txt",
  "/home/z/my-project/upload/secrets.txt",
].filter(Boolean);

const env = { ...process.env };
for (const path of SECRETS_CANDIDATES) {
  if (path && existsSync(path)) {
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim();
    }
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) break;
  }
}

const SUPA_URL = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!SUPA_URL || !SUPA_KEY) die("No Supabase credentials: pass --secrets=<path> or set env vars", 1);

const headers = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, "Content-Type": "application/json" };
const FORWARD_URL = (env.FORWARD_TELEGRAM_URL || "https://v0-car-test.vercel.app/api/forward-telegram").trim();
const FORWARD_ORIGIN = (env.FORWARD_TELEGRAM_ORIGIN || "https://v0-car-test.vercel.app").trim();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function die(message, code = 1) {
  console.error(`✖ ${message}`);
  process.exit(code);
}

async function rest(path, options = {}) {
  const resp = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers, ...options });
  if (!resp.ok) {
    const text = await resp.text();
    die(`Supabase ${options.method || "GET"} ${path.split("?")[0]} → HTTP ${resp.status}: ${text.slice(0, 300)}`, 2);
  }
  // PATCH/DELETE return 204 No Content — nothing to parse
  if (resp.status === 204) return [];
  const text = await resp.text();
  return text ? JSON.parse(text) : [];
}

function userLabel(u) {
  const parts = [];
  if (u.full_name) parts.push(u.full_name);
  if (u.username) parts.push(`@${String(u.username).replace(/^@+/, "")}`);
  if (u.user_id) parts.push(String(u.user_id));
  return parts.join(" · ");
}

function bikeLabel(b) {
  return `${`${b.make ?? ""} ${b.model ?? ""}`.trim() || b.id} (${b.id})`;
}

// ─── Steps ───────────────────────────────────────────────────────────────────

async function main() {
  // 1. Crew
  const crews = await rest(`crews?select=id,name,slug,owner_id&slug=eq.${encodeURIComponent(CREW_SLUG)}`);
  const crew = crews[0];
  if (!crew) die(`Crew "${CREW_SLUG}" not found`, 1);

  // 2. Crew bikes (bikes/ebikes only — mirrors the web panel)
  const bikes = await rest(
    `cars?select=id,make,model,type,specs&crew_id=eq.${crew.id}&type=in.(bike,ebike)&order=id.asc`,
  );

  // ── --list: print the current assignment table and exit ──
  if (LIST) {
    const assigned = bikes.filter((b) => b.specs && b.specs.subrenter_chat_id);
    if (assigned.length === 0) {
      console.log(`Crew ${crew.slug}: no subrenter assignments.`);
      return;
    }
    const ids = [...new Set(assigned.map((b) => b.specs.subrenter_chat_id))];
    const users = await rest(`users?select=user_id,username,full_name&user_id=in.(${ids.join(",")})`);
    const byId = new Map(users.map((u) => [String(u.user_id), u]));
    console.log(`Crew ${crew.slug} — ${assigned.length} assigned bike(s):`);
    for (const b of assigned) {
      const u = byId.get(String(b.specs.subrenter_chat_id));
      console.log(`  ${bikeLabel(b)}\n    → ${u ? userLabel(u) : `id ${b.specs.subrenter_chat_id} (not in users table)`}`);
    }
    return;
  }

  // 3. Resolve the bike (exact id → id substring → make/model substring)
  const q = bikeQuery.toLowerCase();
  const exact = bikes.find((b) => b.id.toLowerCase() === q);
  const bikeMatches = exact
    ? [exact]
    : bikes.filter(
        (b) =>
          b.id.toLowerCase().includes(q) ||
          `${b.make ?? ""} ${b.model ?? ""}`.toLowerCase().includes(q) ||
          String(b.model ?? "").toLowerCase().includes(q),
      );
  if (bikeMatches.length === 0) {
    die(`No bike matches "${bikeQuery}" in crew ${crew.slug}. Run --list to see the fleet.`, 1);
  }
  if (bikeMatches.length > 1) {
    console.error(`✖ "${bikeQuery}" is ambiguous — ${bikeMatches.length} bikes match:`);
    for (const b of bikeMatches) console.error(`   ${bikeLabel(b)}`);
    die("Pass the exact bike id.", 1);
  }
  const bike = bikeMatches[0];
  const specs = bike.specs && typeof bike.specs === "object" && !Array.isArray(bike.specs)
    ? { ...bike.specs }
    : {};
  const previousSubrenter = typeof specs.subrenter_chat_id === "string" ? specs.subrenter_chat_id : "";

  // 4. Resolve the user (id → exact username → username/full-name substring)
  let partner = null;
  if (!CLEAR) {
    const digits = userQuery.replace(/\D/g, "");
    if (/^\d{5,}$/.test(userQuery) && digits) {
      const rows = await rest(
        `users?select=user_id,username,full_name&user_id=eq.${encodeURIComponent(digits)}`,
      );
      partner = rows[0] ?? null;
      if (!partner) die(`User id ${digits} not found in the users table. They must open the bot at least once (or use the web panel to assign a raw id).`, 1);
    } else {
      const clean = userQuery.replace(/^@+/, "").trim();
      const like = encodeURIComponent(`*${clean}*`);
      const rows = await rest(
        `users?select=user_id,username,full_name&or=(username.ilike."${clean}",full_name.ilike."${like}")&limit=10`,
      );
      const exactUsername = rows.find((u) => String(u.username).toLowerCase() === clean.toLowerCase());
      if (exactUsername) partner = exactUsername;
      else if (rows.length === 1) partner = rows[0];
      else if (rows.length === 0) {
        die(`No user matches "${userQuery}". Search by Telegram id, exact @username or part of the full name.`, 1);
      } else {
        console.error(`✖ "${userQuery}" is ambiguous — ${rows.length} users match:`);
        for (const u of rows) console.error(`   ${userLabel(u)}`);
        die("Pass the exact Telegram id.", 1);
      }
    }
  }

  // 5. Plan
  const now = new Date().toISOString();
  console.log(`Crew:        ${crew.name || crew.slug}`);
  console.log(`Bike:        ${bikeLabel(bike)}`);
  console.log(`Current:     ${previousSubrenter ? `id ${previousSubrenter}` : "— (no subrenter)"}`);
  if (CLEAR) {
    console.log(`Action:      CLEAR the subrenter assignment`);
  } else {
    console.log(`New partner: ${userLabel(partner)}`);
    if (previousSubrenter && previousSubrenter === String(partner.user_id)) {
      console.log(`NOTE:        this partner is already assigned — the write is a no-op refresh.`);
    }
  }
  console.log(`Will update: cars.specs.subrenter_chat_id, users.metadata.subrenterOf (new + previous partner)${CLEAR ? "" : ", TG notification to the partner"}`);

  if (!APPLY) {
    console.log("\nDRY RUN — no changes written. Re-run with --apply to write to Supabase.");
    return;
  }

  // 6a. Write the bike specs
  if (CLEAR) {
    delete specs.subrenter_chat_id;
    delete specs.subrenter_set_at;
    delete specs.subrenter_set_by;
  } else {
    specs.subrenter_chat_id = String(partner.user_id);
    specs.subrenter_set_at = now;
    specs.subrenter_set_by = "cli-skill";
  }
  // NOTE: cars has NO updated_at column (PGRST204) — only real columns are sent
  await rest(`cars?id=eq.${encodeURIComponent(bike.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ specs }),
  });
  console.log(`\n✔ cars.specs updated (${CLEAR ? "cleared" : `subrenter_chat_id=${partner.user_id}`})`);

  // 6b. Sync users.metadata.subrenterOf for both affected partners
  const affected = [...new Set([CLEAR ? "" : String(partner.user_id), previousSubrenter].filter((id) => id.length >= 5))];
  for (const partnerId of affected) {
    const partnerBikes = await rest(
      `cars?select=id&crew_id=eq.${crew.id}&specs->>subrenter_chat_id=eq.${encodeURIComponent(partnerId)}`,
    );
    const bikeIds = partnerBikes.map((b) => String(b.id)).sort();
    const userRows = await rest(`users?select=user_id,metadata&user_id=eq.${encodeURIComponent(partnerId)}`);
    const user = userRows[0];
    if (!user) continue;
    const metadata = user.metadata && typeof user.metadata === "object" ? { ...user.metadata } : {};
    const prev = metadata.subrenterOf && typeof metadata.subrenterOf === "object" ? { ...metadata.subrenterOf } : {};
    if (bikeIds.length > 0) prev[crew.id] = bikeIds;
    else delete prev[crew.id];
    metadata.subrenterOf = prev;
    await rest(`users?user_id=eq.${encodeURIComponent(partnerId)}`, {
      method: "PATCH",
      body: JSON.stringify({ metadata, updated_at: now }),
    });
    console.log(`✔ users.metadata.subrenterOf synced for ${partnerId}: ${JSON.stringify(prev[crew.id] ?? [])}`);
  }

  // 6c. Telegram notification to the partner (forwarding API, best-effort)
  if (!CLEAR && NOTIFY) {
    try {
      const resp = await fetch(FORWARD_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: FORWARD_ORIGIN },
        body: JSON.stringify({
          chat_id: partner.user_id,
          method: "sendMessage",
          payload: {
            text: [
              "🔓 Вам передан байк в аренду",
              `Байк: ${`${bike.make ?? ""} ${bike.model ?? ""}`.trim() || bike.id}`,
              `Экипаж: ${crew.name || crew.slug}`,
              "",
              "Теперь вы видите аренды своего байка (страница «Аренды») и уведомления по нему.",
            ].join("\n"),
          },
        }),
        signal: AbortSignal.timeout(20000),
      });
      const json = await resp.json().catch(() => null);
      if (resp.ok && json?.ok) console.log(`✔ Telegram notification delivered to ${partner.user_id}`);
      else console.warn(`⚠ Telegram notification failed (non-fatal): HTTP ${resp.status} ${JSON.stringify(json)?.slice(0, 200)}`);
    } catch (err) {
      console.warn(`⚠ Telegram notification failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => die(e instanceof Error ? e.stack || e.message : String(e), 2));
