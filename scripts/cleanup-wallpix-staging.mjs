#!/usr/bin/env node
// scripts/cleanup-wallpix-staging.mjs
//
// Janitor для staging-папок публичного бакета wallpix (OnlyBike wall).
// Каждый «прикрепил фото и не опубликовал пост» оставляет объект в
// staging/<userId>/<hex>.jpg — роут чистит папку автора при каждой загрузке
// (TTL 24h), но если пользователь больше никогда не загрузит фото, хвост
// останется. Этот скрипт — глобальная зачистка: удаляет ВСЕ объекты под
// staging/, старше WALL_STAGING_TTL_HOURS (по умолчанию 48h — с запасом).
//
// Запуск (cron/Vercel cron/внешний таймер):
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role> \
//   node scripts/cleanup-wallpix-staging.mjs [--dry-run] [--ttl-hours=48]
//
// Dependency-free (fetch + Storage API), как scripts/backup-supabase.mjs.

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "wallpix";
const STAGING_PREFIX = "staging";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const ttlArg = args.find((a) => a.startsWith("--ttl-hours="));
const TTL_HOURS = ttlArg ? Number(ttlArg.split("=")[1]) : 48;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY обязательны");
  process.exit(1);
}
if (!Number.isFinite(TTL_HOURS) || TTL_HOURS <= 0) {
  console.error("--ttl-hours должен быть положительным числом");
  process.exit(1);
}

const cutoffMs = Date.now() - TTL_HOURS * 60 * 60 * 1000;

async function listPage(prefix, offset) {
  // Page through with offset: >1000 entries must not be silently skipped.
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "created_at", order: "asc" } }),
  });
  if (!res.ok) throw new Error(`list ${prefix} failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function listAll(prefix) {
  const all = [];
  let offset = 0;
  for (;;) {
    const page = await listPage(prefix, offset);
    all.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return all;
}

async function removeObjects(paths) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  });
  if (!res.ok) throw new Error(`remove failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const folders = await listAll(STAGING_PREFIX);
const userFolders = folders.filter((f) => f.name && f.id === null); // id===null → папка
let scanned = 0;
const removedPaths = [];

for (const folder of userFolders) {
  const files = await listAll(`${STAGING_PREFIX}/${folder.name}`);
  for (const file of files) {
    if (!file.name || file.name === ".emptyFolderPlaceholder") continue;
    scanned += 1;
    const ts = Date.parse(file.created_at || file.updated_at || "");
    if (Number.isFinite(ts) && ts < cutoffMs) {
      removedPaths.push(`${STAGING_PREFIX}/${folder.name}/${file.name}`);
    }
  }
}

console.log(`scanned ${scanned} staging file(s) in ${userFolders.length} folder(s); ${removedPaths.length} older than ${TTL_HOURS}h`);

if (removedPaths.length === 0) {
  console.log("nothing to remove");
  process.exit(0);
}

if (dryRun) {
  for (const p of removedPaths) console.log(`[dry-run] would remove ${p}`);
  process.exit(0);
}

// Batched like the cron route — a single mega-DELETE with thousands of
// prefixes is fragile.
for (let i = 0; i < removedPaths.length; i += 100) {
  await removeObjects(removedPaths.slice(i, i + 100));
}
console.log(`removed ${removedPaths.length} object(s)`);
