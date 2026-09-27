// tests/franchize/storage-wall.spec.ts
// 2026-09-27: «Зимнее хранение» — the owner-facing wall («Мотопарк for actual
// owners») + the self-service checkout finishing the flowType="storage" flow:
//   · lib/storage — status lifecycle, season math mirror, deeplink, offer math;
//   · the checkout now PERSISTS a storage_bikes row (+ created event) so the
//     wall can track every move (actions-runtime consolidated block);
//   · server actions ladder: signed cookie / HMAC initData / guest — staff vs
//     owner vs offer, transitions validated, notifications on EVERY move;
//   · routing: storage_<slug> fast path + gated vip-bike header link +
//     modal/form CTA wiring.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  canTransitionStorageStatus,
  storageDocPublicUrl,
  storageFormatRub,
  storageMonthsCount,
  storageSeasonDateToIso,
  storageSeasonDefaults,
  storageSeasonDateToIso as toIso,
  storageStartParam,
  storageStatsOf,
  storageStatusLabel,
  STORAGE_STATUS_TRANSITIONS,
} from "@/app/franchize/lib/storage";
import { formatStorageMonthsLabel } from "@/app/franchize/lib/storage-season";
import { buildFranchizeIntentLinks } from "@/app/franchize/lib/section-links";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");

const read = (rel: string) => readFileSync(join(repoRoot, rel), "utf8");

describe("storage season math (lib/storage mirror of storage-season)", () => {
  it("17.10 → 1.06 inclusive = 7.5 months — matches the contract label", () => {
    expect(storageMonthsCount("2025-10-17", "2026-06-01")).toBe(7.5);
    expect(formatStorageMonthsLabel("2025-10-17", "2026-06-01")).toBe("7,5 месяца");
  });

  it("returns 0 for unusable ranges (missing / reversed / equal)", () => {
    expect(storageMonthsCount("", "2026-06-01")).toBe(0);
    expect(storageMonthsCount("2026-06-01", "2025-10-17")).toBe(0);
    expect(storageMonthsCount("2025-10-17", "2025-10-17")).toBe(0);
  });

  it("season defaults: before 15 Oct → the upcoming season (15.10 → 1.06)", () => {
    expect(storageSeasonDefaults(new Date("2026-09-27T12:00:00Z"))).toEqual({ start: "2026-10-15", end: "2027-06-01" });
    expect(storageSeasonDefaults(new Date("2026-01-10T12:00:00Z"))).toEqual({ start: "2026-10-15", end: "2027-06-01" });
    expect(storageSeasonDefaults(new Date("2026-10-16T12:00:00Z"))).toEqual({ start: "2027-10-15", end: "2028-06-01" });
  });

  it("season date parsing: DD.MM.YYYY (checkout pickers) and ISO both → ISO", () => {
    expect(storageSeasonDateToIso("17.10.2025")).toBe("2025-10-17");
    expect(toIso("2025-10-17")).toBe("2025-10-17");
    expect(toIso("17.10.2025")).toBe(toIso("2025-10-17"));
    expect(toIso("")).toBeNull();
    expect(toIso("garbage")).toBeNull();
  });

  it("status lifecycle: requested → in_storage → returned, cancel from both", () => {
    expect(canTransitionStorageStatus("requested", "in_storage")).toBe(true);
    expect(canTransitionStorageStatus("in_storage", "returned")).toBe(true);
    expect(canTransitionStorageStatus("requested", "cancelled")).toBe(true);
    expect(canTransitionStorageStatus("in_storage", "cancelled")).toBe(true);
    //Illegal moves the UI never offers:
    expect(canTransitionStorageStatus("requested", "returned")).toBe(false);
    expect(canTransitionStorageStatus("returned", "in_storage")).toBe(false);
    expect(canTransitionStorageStatus("cancelled", "in_storage")).toBe(false);
    expect(canTransitionStorageStatus("garbage", "in_storage")).toBe(false);
    //Terminal statuses are exits, not entries:
    expect(STORAGE_STATUS_TRANSITIONS.returned).toEqual([]);
    expect(STORAGE_STATUS_TRANSITIONS.cancelled).toEqual([]);
  });

  it("labels cover the whole lifecycle; deeplink budget-safe; rub plain-space grouping", () => {
    expect(storageStatusLabel("in_storage")).toBe("На хранении");
    expect(storageStatusLabel("returned")).toBe("Возвращён");
    expect(storageStatusLabel("unknown")).toBe("Заявка");
    expect(storageStartParam("vip-bike")).toBe("storage_vip-bike");
    // Hostile slug → sanitized (no smuggled query/path into startapp)
    expect(storageStartParam("a?b/c=d")).toBe("storage_abcd");
    expect(storageStartParam("")).toBe("storage");
    expect(storageFormatRub(15000)).toBe("15 000");
    expect(storageFormatRub(2000)).toBe("2 000");
    expect(storageFormatRub(0)).toBe("0");
  });

  it("doc URL points into the rental-contracts public storage", () => {
    // The helper reads NEXT_PUBLIC_SUPABASE_URL lazily — vitest env has no
    // .env, so pin it (same project the app builds URLs from).
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://inmctohsodgdohamhzag.supabase.co";
    const url = storageDocPublicUrl("vip-bike/storage-vip-bike-o1.docx");
    expect(url).toContain("/storage/v1/object/public/rental-contracts/");
    expect(url.startsWith("https://")).toBe(true);
    expect(storageDocPublicUrl("")).toBe("");
  });

  it("wall stats bucket every status", () => {
    const stats = storageStatsOf([
      { status: "requested" },
      { status: "in_storage" },
      { status: "in_storage" },
      { status: "returned" },
      { status: "cancelled" },
    ]);
    expect(stats).toEqual({ total: 5, requested: 1, inStorage: 2, returned: 1, cancelled: 1 });
  });
});

describe("winter storage migration", () => {
  const migration = read("supabase/migrations/20260927120000_winter_storage.sql");

  it("creates both tables with the lifecycle + source checks", () => {
    expect(migration.includes("create table if not exists public.storage_bikes")).toBe(true);
    expect(migration.includes("create table if not exists public.storage_bike_events")).toBe(true);
    expect(migration.includes("'requested', 'in_storage', 'returned', 'cancelled'")).toBe(true);
    expect(migration.includes("'checkout', 'owner_add', 'crew_add'")).toBe(true);
    expect(migration.includes("references public.storage_bikes (id) on delete cascade")).toBe(true);
  });

  it("locks direct access: RLS on, owner-scoped read only, no anon writes", () => {
    expect(migration.includes("enable row level security")).toBe(true);
    expect(migration.includes("auth.jwt() ->> 'chat_id'")).toBe(true);
    // Only SELECT policies exist — every write goes through server actions.
    expect(migration.match(/create policy/g)?.length).toBe(2);
    expect(migration.includes("for select")).toBe(true);
    expect(migration.includes("for insert")).toBe(false);
    expect(migration.includes("for update")).toBe(false);
  });
});

describe("checkout → wall persistence (actions-runtime)", () => {
  const runtime = read("app/franchize/actions-runtime.ts");

  it("storage flow persists a season row with owner link, season, prices, doc", () => {
    expect(runtime.includes('from("storage_bikes")')).toBe(true);
    expect(runtime.includes('from("storage_bike_events")')).toBe(true);
    // The block lives inside the storage branch and is non-fatal:
    expect(runtime.includes("if (isStorageFlow) {")).toBe(true);
    expect(runtime.includes("storage row persist failed (non-fatal)")).toBe(true);
    // Owner link only for a REAL TG chat id (anonymous web → "manual-order"):
    expect(runtime.includes("/^\\d+$/.test(String(payload.telegramUserId ?? \"\"))")).toBe(true);
    // Season comes from the checkout dates; ПЭП flag rides along:
    expect(runtime.includes("storageSeasonDateToIso(payload.rentalStartDate || payload.time)")).toBe(true);
    expect(runtime.includes("pep_signed: Boolean(pepMeta)")).toBe(true);
    expect(runtime.includes("doc_path: (stDoc as { storagePath?: string } | undefined)?.storagePath || null")).toBe(true);
    // Idempotent: one season row per orderId even across retries.
    expect(runtime.includes('.eq("order_id", payload.orderId)')).toBe(true);
  });

  it("crew + owner notifications deep-link into the wall (every move, startapp)", () => {
    expect(runtime.includes("storageStartParam(payload.slug)")).toBe(true);
    expect(runtime.includes("Открыть «Хранение»")).toBe(true);
    // The owner confirmation carries the tracking button:
    expect(runtime.includes("Моё хранение")).toBe(true);
    // The old «no analytics wall» dead-end comment is gone:
    expect(runtime.includes("deeplinks would 404")).toBe(false);
  });
});

describe("storage wall server actions (identity ladder + move notifications)", () => {
  const src = read("app/franchize/server-actions/storage-bikes.ts");

  it("identity: signed cookie first, HMAC initData fallback, guest gets zero data", () => {
    expect(src.includes("verifyTelegramActorCookieValue")).toBe(true);
    expect(src.includes("computeTelegramWebAppHash")).toBe(true);
    expect(src.includes("tgUserId && tgUserId === String(params.actorUserId).trim()")).toBe(true);
    // Guests receive the offer view — not an error, and not one byte of bikes:
    expect(src.includes('access: "guest"')).toBe(true);
    // NO analytics password path here (owner PII wall):
    expect(src.includes("isPasswordAuth")).toBe(false);
  });

  it("staff gate = crew owner / global admin / active member (bikes-wall parity)", () => {
    expect(src.includes('eq("membership_status", "active")')).toBe(true);
    expect(src.includes("isGlobalAdminRow")).toBe(true);
    expect(src.includes("ownerId === actorUserId || isGlobalAdminRow")).toBe(true);
  });

  it("status moves validate the shared transition map and log the event", () => {
    expect(src.includes("canTransitionStorageStatus(currentStatus, status)")).toBe(true);
    expect(src.includes('type: "status_changed"')).toBe(true);
    // Non-staff can NEVER move a status:
    expect(src.includes("Статус хранения меняет экипаж")).toBe(true);
  });

  it("every move notifies crew (owner+admins) and the bike owner, skipping the actor", () => {
    expect(src.includes("resolveLeadNotifyRecipients(slug, { includeMembers: false })")).toBe(true);
    expect(src.includes("telegramDeliver")).toBe(true);
    expect(src.includes("alsoChatIds: bike.owner_user_id ? [String(bike.owner_user_id)] : []")).toBe(true);
    expect(src.includes("excludeChatIds: [staffId]")).toBe(true);
    // Owner notes reach the crew; staff notes reach the owner:
    expect(src.includes("alsoChatIds: isStaff ? (bike.owner_user_id ? [String(bike.owner_user_id)] : []) : [senderId]")).toBe(true);
  });

  it("manual add: owners add their own machines, staff adds on behalf", () => {
    expect(src.includes("const ownerUserId = isStaff ? (form.ownerTgUserId ?? null) : actorUserId;")).toBe(true);
    expect(src.includes('source: isStaff ? "crew_add" : "owner_add"')).toBe(true);
    expect(src.includes("откройте приложение через бота")).toBe(true);
  });
});

describe("routing + surfaces wiring", () => {
  it("storage_<slug> routes on the static fast path (no auth roundtrip)", () => {
    const router = read("hooks/useStartParamRouter.ts");
    expect(router.includes('param.startsWith("storage_")')).toBe(true);
    expect(router.includes("/franchize/${slug}/storage")).toBe(true);
  });

  it("header «Хранение» link is gated to the crew that sells the service", () => {
    const links = buildFranchizeIntentLinks("vip-bike", "/franchize/vip-bike/storage");
    expect(links.some((l) => l.label === "Хранение" && l.active)).toBe(true);
    const other = buildFranchizeIntentLinks("another-crew", "/franchize/another-crew/storage");
    expect(other.some((l) => l.label === "Хранение")).toBe(false);
  });

  it("the wall page renders the client and the offer for guests", () => {
    const client = read("app/franchize/[slug]/storage/StorageWallClient.tsx");
    expect(client.includes("не для аренды")).toBe(true);
    expect(client.includes("GuestOffer")).toBe(true);
    expect(client.includes("getStorageWallAction")).toBe(true);
    expect(client.includes("STORAGE_STATUS_TRANSITIONS")).toBe(true);
    // The fetch passes verified identity only — no client-trusted booleans:
    expect(client.includes("getTelegramInitData()")).toBe(true);
    expect(client.includes("isPasswordAuth")).toBe(false);
  });

  it("the self-service form submits a synthetic flowType=storage payload through the real checkout", () => {
    const form = read("app/franchize/[slug]/storage/StorageOrderForm.tsx");
    expect(form.includes("createFranchizeOrderCheckout")).toBe(true);
    expect(form.includes('flowType: "storage"')).toBe(true);
    expect(form.includes('itemId: "storage"')).toBe(true);
    expect(form.includes("pepInitData: pepInitData ?? undefined")).toBe(true);
    // assertStorageIdentityDocs requires owner passport + bike value — the
    // form enforces the same minimum client-side:
    expect(form.includes("passportSeries")).toBe(true);
    expect(form.includes("estimatedValueRub")).toBe(true);
    // Stable per-mount orderId → the idempotency guard can swallow retries:
    expect(form.includes("orderIdRef")).toBe(true);
  });

  it("catalog modal now offers the online checkout beside the manager link", () => {
    const modal = read("app/franchize/components/WinterStorageModal.tsx");
    expect(modal.includes("slug?: string")).toBe(true);
    expect(modal.includes("/storage/new")).toBe(true);
    const catalog = read("app/franchize/components/CatalogClient.tsx");
    expect(catalog.includes("slug={resolvedSlug}")).toBe(true);
  });

  it("db types carry the strict shapes the actions type against", () => {
    const types = read("types/database.types.ts");
    expect(types.includes("storage_bikes: {")).toBe(true);
    expect(types.includes("storage_bike_events: {")).toBe(true);
    const gen = read("scripts/gen-db-types.mjs");
    expect(gen.includes('"storage_bikes"')).toBe(true);
    expect(gen.includes('"storage_bike_events"')).toBe(true);
  });
});
