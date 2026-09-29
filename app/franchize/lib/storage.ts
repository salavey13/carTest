// /app/franchize/lib/storage.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure shared layer for «Зимнее хранение» (winter storage) — the owner-facing
// wall («Мотопарк for actual owners», /franchize/<slug>/storage) + the
// self-service storage checkout (/franchize/<slug>/storage/new).
//
// Contents: the status lifecycle (labels, tones, allowed transitions), the
// numeric month count that mirrors lib/storage-season (so the wall price and
// the CONTRACT price can never disagree), season defaults for the order form,
// DD.MM.YYYY → ISO season parsing (checkout dates arrive as DD.MM.YYYY), the
// startapp deeplink builder (storage_<slug>) and the view models shared by
// the server actions and the wall client.
//
// PURE ONLY — no supabase / no server imports: the wall client and vitest
// both consume this file.
// ─────────────────────────────────────────────────────────────────────────────

export type StorageBikeStatus = "requested" | "in_storage" | "returned" | "cancelled";

export interface StorageStatusMeta {
  label: string;
  emoji: string;
  /** Tailwind-independent tone keys the wall client maps to palette classes. */
  tone: "amber" | "sky" | "green" | "muted";
}

export const STORAGE_STATUS_META: Record<StorageBikeStatus, StorageStatusMeta> = {
  requested: { label: "Заявка", emoji: "📝", tone: "amber" },
  in_storage: { label: "На хранении", emoji: "🧊", tone: "sky" },
  returned: { label: "Возвращён", emoji: "🤝", tone: "green" },
  cancelled: { label: "Отменена", emoji: "✖", tone: "muted" },
};

export function storageStatusLabel(status: string | null | undefined): string {
  const key = (status ?? "") as StorageBikeStatus;
  return STORAGE_STATUS_META[key]?.label ?? "Заявка";
}

/**
 * Allowed moves. The wall buttons and the server action share this map, so a
 * hand-crafted server action call can never invent a transition the UI never
 * offered:
 *   requested → in_storage | cancelled
 *   in_storage → returned | cancelled
 */
export const STORAGE_STATUS_TRANSITIONS: Record<StorageBikeStatus, StorageBikeStatus[]> = {
  requested: ["in_storage", "cancelled"],
  in_storage: ["returned", "cancelled"],
  returned: [],
  cancelled: [],
};

export function canTransitionStorageStatus(from: string | null | undefined, to: string): boolean {
  const key = (from ?? "") as StorageBikeStatus;
  return (STORAGE_STATUS_TRANSITIONS[key] ?? []).includes(to as StorageBikeStatus);
}

// ── season math (mirrors lib/storage-season — keep both in sync via tests) ──

const AVG_MONTH_DAYS = 30.4375;
const DAY_MS = 24 * 3600 * 1000;

/**
 * Numeric season length between two dates, inclusive, rounded to 0.5 month —
 * the same math formatStorageMonthsLabel() renders as «7,5 месяца». 0 when
 * the range is unusable (missing / reversed).
 */
export function storageMonthsCount(startRaw: unknown, endRaw: unknown): number {
  const start = new Date(String(startRaw ?? ""));
  const end = new Date(String(endRaw ?? ""));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    return 0;
  }
  const inclusiveDays = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return Math.max(0.5, Math.round((inclusiveDays / AVG_MONTH_DAYS) * 2) / 2);
}

/**
 * Season presets for the order form: 15 октября → 1 июня (vip-bike season).
 * Before the season opens (≤ season start day-month) the current season is
 * offered; after — the next one.
 *
 * Per-crew config may override the day-month anchors (MM-DD strings from
 * storage-config); invalid overrides fall back to the vip-bike defaults.
 */
export function storageSeasonDefaults(
  now: Date = new Date(),
  seasonMMDD?: { start: string; end: string },
): { start: string; end: string } {
  const parse = (raw: string | undefined, fallbackM: number, fallbackD: number) => {
    const m = String(raw ?? "").match(/^(\d{2})-(\d{2})$/);
    const month = m ? Math.min(12, Math.max(1, Number(m[1]))) : fallbackM;
    const day = m ? Math.min(31, Math.max(1, Number(m[2]))) : fallbackD;
    return { month, day };
  };
  const start = parse(seasonMMDD?.start, 10, 15);
  const end = parse(seasonMMDD?.end, 6, 1);

  const y = now.getFullYear();
  const seasonStartYear =
    now.getTime() < new Date(y, start.month - 1, start.day).getTime() ? y : y + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${seasonStartYear}-${pad(start.month)}-${pad(start.day)}`,
    end: `${seasonStartYear + 1}-${pad(end.month)}-${pad(end.day)}`,
  };
}

/**
 * Checkout dates arrive as DD.MM.YYYY (the order form pickers) or ISO — the
 * DB wants a date-only ISO or NULL. Accepts both, rejects garbage.
 */
export function storageSeasonDateToIso(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const ru = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ru) {
    const [, d, m, y] = ru;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/** DD.MM.YYYY for the wall (season rows render in the human format). */
export function storageIsoToRu(iso: string | null | undefined): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

// ── deeplink + money ─────────────────────────────────────────────────────────

/**
 * storage_<slug> — the startapp param the notifications deep-link into.
 * With bikeId (a storage_bikes uuid): storage_<slug>_<bikeId> — deep-links
 * straight into that bike's «Карточка хранения» story page (boss nuance 2,
 * 2026-09-29). The uuid has no underscores, so useStartParamRouter splits at
 * the LAST underscore and never confuses a bike card with the wall.
 */
export function storageStartParam(slug: string, bikeId?: string | null): string {
  const s = String(slug ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  const base = s ? `storage_${s}` : "storage";
  const id = String(bikeId ?? "").trim();
  // Only real uuids qualify — a bare numeric id would be re-parsed as part
  // of the slug and break the wall route.
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id)
    ? `${base}_${id}`
    : base;
}
// NOTE (boss review R2 #1): the former storageDocPublicUrl() helper is GONE —
// it built a public-objects URL against the PRIVATE rental-contracts bucket
// and the contracts carry the owner's passport. Delivery now goes through the
// short-lived signed URL minted inside getStorageDocUrlAction /
// getStorageBikeReportAction (storage-bikes.ts).

// ── фотофиксация (acceptance/return photos in the event timeline) ───────────

/** Public bucket for storage bike photos (winter_storage_v3 migration). */
export const STORAGE_PHOTO_BUCKET = "storagepix";

/** Photos per event — the wall composer cap, reused for the timeline parity. */
export const STORAGE_PHOTOS_MAX = 6;

/**
 * Moves that deserve фотофиксация (Акт приёма-передачи photo fixation).
 * Single source shared by the wall + story move panels.
 */
export const STORAGE_PHOTO_WORTHY_TARGETS: StorageBikeStatus[] = ["in_storage", "returned"];

/**
 * Public URL of a storage photo. Paths arrive from the DB (server-sanitized
 * `bikes/<bikeId>/<32hex>.jpg`), so encoding per segment is enough.
 */
export function storagePhotoPublicUrl(photoPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base || !photoPath) return "";
  return `${base}/storage/v1/object/public/${STORAGE_PHOTO_BUCKET}/${photoPath.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * Exact shape the upload route produces: bikes/<bikeId>/<32 hex>.jpg.
 * Anything else (../, other bikes' folders, .png, weird names) is rejected —
 * a raw API caller can only reference files that exist in THIS bike's folder,
 * and the folder is only writable through the identity-checked route.
 */
export function storagePhotoPathRe(bikeId: string): RegExp {
  const id = String(bikeId || "").replace(/[^a-fA-F0-9-]/g, "");
  return new RegExp(`^bikes/${id}/[0-9a-f]{32}\\.jpg$`);
}

/**
 * Photos payload gate (mirror of the wall's sanitizeWallPhotoInputs): absent
 * payload → [] (no photos), valid array → deduped paths strictly from THIS
 * bike's folder, anything else → null (caller answers with a human error).
 * null vs [] matters: null = hand-crafted/invalid payload, [] = simply none.
 */
export function sanitizeStoragePhotoPaths(raw: unknown, bikeId: string): string[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return null;
  if (raw.length > STORAGE_PHOTOS_MAX) return null;
  const re = storagePhotoPathRe(bikeId);
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") return null;
    if (!re.test(item)) return null;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

/** 15000 → «15 000» (plain spaces — Telegram-safe, no U+00A0). */
export function storageFormatRub(value: number): string {
  return Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ── view models (shared by the server action and the wall client) ───────────

export interface StorageBikeEventVM {
  id: number;
  /** Free-form string on purpose (DB CHECK guards the set) — renderers map it via STORAGE_EVENT_TYPE_LABELS. */
  type: string;
  status: StorageBikeStatus | null;
  actorName: string;
  message: string;
  createdAt: string;
  /** Фотофиксация: PUBLIC URLs (server resolves storagepix paths) — empty for text-only events. */
  photoUrls: string[];
  /** Raw storagepix paths — the delete action's currency (URLs are display-only). */
  photoPaths: string[];
}

/**
 * Human label per event type — the wall/story timelines render through this,
 * so new event kinds (payment, owner_linked, photo) never show up as
 * «Статус: Заявка». Unknown types fall back to the raw type string.
 */
export const STORAGE_EVENT_TYPE_LABELS: Record<string, string> = {
  created: "Заявка создана",
  status_changed: "Статус",
  note: "Заметка",
  doc: "Документ",
  payment: "Оплата",
  owner_linked: "Владелец привязан",
  photo: "Фотофиксация",
};

export function storageEventLabel(type: string): string {
  return STORAGE_EVENT_TYPE_LABELS[String(type ?? "")] ?? String(type ?? "");
}

export interface StorageBikeVM {
  id: string;
  createdAt: string;
  status: StorageBikeStatus;
  ownerName: string;
  ownerPhone: string;
  /** Марка и модель (единая строка договора, «SYM LM 25»). */
  bikeTitle: string;
  regNumber: string;
  vin: string;
  year: number | null;
  color: string;
  mileageKm: number | null;
  accessories: string;
  estimatedValueRub: number;
  monthlyPriceRub: number;
  totalPriceRub: number;
  seasonStart: string | null;
  seasonEnd: string | null;
  monthsLabel: string;
  storageAddress: string;
  noticeAddress: string;
  orderId: string | null;
  docPath: string | null;
  pepSigned: boolean;
  /** One-shot season payment marker (NULL = не оплачено). */
  paidUntil: string | null;
  source: "checkout" | "owner_add" | "crew_add";
  events: StorageBikeEventVM[];
}

export interface StorageWallStats {
  total: number;
  requested: number;
  inStorage: number;
  returned: number;
  cancelled: number;
}

export interface StorageWallVM {
  access: "staff" | "owner" | "guest";
  /** Verified actor (server-side) — null for guests. */
  viewerId: string | null;
  bikes: StorageBikeVM[];
  stats: StorageWallStats;
}

export const STORAGE_SOURCE_LABELS: Record<StorageBikeVM["source"], string> = {
  checkout: "Оформление онлайн",
  owner_add: "Добавлен владельцем",
  crew_add: "Добавлен экипажем",
};

// ── money (season is paid one-shot — the contract's оплата единовременно) ──

export interface StorageMoneyStats {
  /** Сумма сезона по активным байкам (requested + in_storage). */
  activeRub: number;
  /** Из них уже на хранении. */
  inStorageRub: number;
  /** Активные и оплаченные (paid_until покрывает сегодня). */
  paidRub: number;
  /** Активные и НЕ оплаченные — «ждёт оплаты» tile. */
  unpaidRub: number;
}

/**
 * «Оплачено» = paid_until is a date >= today (MSK wall-clock, the app tz).
 * Injectable `today` (ISO date or timestamp) keeps the pure function honest
 * in tests — mirrors the report builder's nowMs pattern.
 */
export function storagePaidCovered(paidUntil: string | null | undefined, today?: string | number | Date): boolean {
  if (!paidUntil) return false;
  const paid = String(paidUntil).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paid)) return false;
  let todayIso: string;
  if (typeof today === "string" && /^\d{4}-\d{2}-\d{2}/.test(today)) {
    todayIso = today.slice(0, 10);
  } else {
    const ts = today === undefined ? Date.now() : new Date(today as string | number).getTime();
    if (Number.isNaN(ts)) return false;
    todayIso = new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Moscow" });
  }
  return paid >= todayIso;
}

export function storageMoneyStatsOf(bikes: Array<{ status: string; totalPriceRub: number; paidUntil: string | null }>, today?: string | number | Date): StorageMoneyStats {
  const stats: StorageMoneyStats = { activeRub: 0, inStorageRub: 0, paidRub: 0, unpaidRub: 0 };
  for (const b of bikes) {
    if (b.status !== "requested" && b.status !== "in_storage") continue;
    const rub = Math.max(0, Math.round(Number(b.totalPriceRub) || 0));
    stats.activeRub += rub;
    if (b.status === "in_storage") stats.inStorageRub += rub;
    if (storagePaidCovered(b.paidUntil, today)) stats.paidRub += rub;
    else stats.unpaidRub += rub;
  }
  return stats;
}

// ── wall triage: status filter + sort (Мотопарк parity) ─────────────────────

export type StorageStatusFilter = "all" | StorageBikeStatus;

export function filterStorageBikes<T extends { status: StorageBikeStatus }>(bikes: T[], filter: StorageStatusFilter): T[] {
  if (!filter || filter === "all") return bikes;
  return bikes.filter((b) => b.status === filter);
}

export type StorageSortMode = "recent" | "money" | "title";

/** Full-history cap for the story page + report (bike-wall WALL_EVENTS_CAP recipe). */
export const STORAGE_STORY_EVENTS_CAP = 80;

export const STORAGE_SORT_LABELS: Record<StorageSortMode, string> = {
  recent: "По свежести",
  money: "По сумме",
  title: "По названию",
};

export function sortStorageBikes<T extends { createdAt: string; totalPriceRub: number; bikeTitle: string }>(bikes: T[], mode: StorageSortMode): T[] {
  const copy = [...bikes];
  if (mode === "money") copy.sort((a, b) => (Number(b.totalPriceRub) || 0) - (Number(a.totalPriceRub) || 0));
  else if (mode === "title") copy.sort((a, b) => String(a.bikeTitle || "").localeCompare(String(b.bikeTitle || ""), "ru"));
  else copy.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  return copy;
}

/** Source of truth for the wall: how the VM is assembled from DB rows. */
export function storageStatsOf(bikes: Array<{ status: string }>): StorageWallStats {
  const stats: StorageWallStats = { total: bikes.length, requested: 0, inStorage: 0, returned: 0, cancelled: 0 };
  for (const b of bikes) {
    if (b.status === "requested") stats.requested += 1;
    else if (b.status === "in_storage") stats.inStorage += 1;
    else if (b.status === "returned") stats.returned += 1;
    else stats.cancelled += 1;
  }
  return stats;
}
