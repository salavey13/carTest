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
 * Before the season opens (≤ 14 Oct) the current season is offered; after —
 * the next one.
 */
export function storageSeasonDefaults(now: Date = new Date()): { start: string; end: string } {
  const y = now.getFullYear();
  const seasonStartYear = now.getTime() < new Date(y, 9, 15).getTime() ? y : y + 1;
  return {
    start: `${seasonStartYear}-10-15`,
    end: `${seasonStartYear + 1}-06-01`,
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

/** storage_<slug> — the startapp param the notifications deep-link into. */
export function storageStartParam(slug: string): string {
  const s = String(slug ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  return s ? `storage_${s}` : "storage";
}

/** Public URL of the generated contract in the rental-contracts bucket. */
export function storageDocPublicUrl(docPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base || !docPath) return "";
  return `${base}/storage/v1/object/public/rental-contracts/${docPath.split("/").map(encodeURIComponent).join("/")}`;
}

/** 15000 → «15 000» (plain spaces — Telegram-safe, no U+00A0). */
export function storageFormatRub(value: number): string {
  return Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ── view models (shared by the server action and the wall client) ───────────

export interface StorageBikeEventVM {
  id: number;
  type: string;
  status: StorageBikeStatus | null;
  actorName: string;
  message: string;
  createdAt: string;
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
