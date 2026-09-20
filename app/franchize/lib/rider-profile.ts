// app/franchize/lib/rider-profile.ts
//
// ─────────────────────────────────────────────────────────────────────────────
// Rider profile v1 (Chain-inspired) — pure logic, no Supabase / React here.
//
// A rider profile is the PUBLIC face of a wall user (Chain's core unit):
//   · header: avatar + name + city + status (emoji+text) + bio;
//   · public stats strip: rides / hours / posts / photos / reactions —
//     NEVER money (₽ belongs to the CRM profile of the owner only),
//     never phone/passport (152-ФЗ hygiene, see the Chain research report);
//   · badges: computed from activity counters (posts, photos, check-ins,
//     reactions, rides) — nothing to migrate, all derived on read;
//   · garage: bikes the rider attached to wall posts (crew_post_bikes);
//   · "this rider's part of the wall": their public posts (author filter on
//     the existing feed action).
//
// Customization lives in users.metadata.riderProfiles[slug] and is EDITED by
// the owner on the same page (view = edit mode toggle). The storage shape is
// deliberately small: bio / city / status emoji+text / hideProfile.
// ─────────────────────────────────────────────────────────────────────────────

import {
  pluralRu,
  riderMilestoneBadge,
  type RiderMilestoneBadge,
} from "@/app/franchize/lib/community-wall";

// ── Limits (mirrored by the zod schemas in the server actions) ───────────────

export const RIDER_BIO_MAX_LEN = 280;
export const RIDER_CITY_MAX_LEN = 40;
export const RIDER_STATUS_TEXT_MAX_LEN = 60;

/** Whitelist — the status emoji must be picked, not typed (no arbitrary
 *  user-supplied glyphs on the public page). */
export const RIDER_STATUS_EMOJIS = [
  "🏍", "🏁", "🔧", "🛠", "⛽", "😎", "🤘", "🔥",
  "📍", "🌧", "❄️", "🌙", "☕", "🚀", "🎯", "📸", "👑", "😴",
] as const;

export type RiderStatusEmoji = (typeof RIDER_STATUS_EMOJIS)[number];

// ── Customization payload (users.metadata.riderProfiles[slug]) ───────────────

export interface RiderProfileCustom {
  bio: string;
  city: string;
  statusEmoji: string;
  statusText: string;
  /** «Скрыть профиль»: other viewers see a minimal card (name + hint),
   *  the owner and crew staff still see everything. */
  hideProfile: boolean;
}

export const EMPTY_RIDER_PROFILE_CUSTOM: RiderProfileCustom = {
  bio: "",
  city: "",
  statusEmoji: "",
  statusText: "",
  hideProfile: false,
};

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Collapse any hostile/legacy shape into a safe RiderProfileCustom.
 *  Never throws — profile fields are cosmetic, garbage degrades to empty. */
export function sanitizeRiderProfileCustom(raw: unknown): RiderProfileCustom {
  const src = typeof raw === "object" && raw ? (raw as Record<string, unknown>) : {};
  const emoji = typeof src.statusEmoji === "string" ? src.statusEmoji.trim() : "";
  return {
    bio: cleanText(src.bio, RIDER_BIO_MAX_LEN),
    city: cleanText(src.city, RIDER_CITY_MAX_LEN),
    statusEmoji: (RIDER_STATUS_EMOJIS as readonly string[]).includes(emoji) ? emoji : "",
    statusText: cleanText(src.statusText, RIDER_STATUS_TEXT_MAX_LEN),
    hideProfile: src.hideProfile === true,
  };
}

export function isRiderProfileCustomEmpty(c: RiderProfileCustom): boolean {
  return !c.bio && !c.city && !c.statusEmoji && !c.statusText && !c.hideProfile;
}

/** Where the custom payload lives inside users.metadata (per-crew scope). */
export function riderProfileMetadataField(): "riderProfiles" {
  return "riderProfiles";
}

// ── Public stats (read-derived, money-free) ──────────────────────────────────

/** Строка блока «Аренды» на профиле. ⚠️ Блок рендерится ТОЛЬКО self/staff —
 *  total_cost (₽) наружу не утекает; чужой зритель получает пустой массив. */
export interface RiderRentalRef {
  rentalId: string;
  bikeTitle: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  totalCost: number | null;
}

export interface RiderPublicStats {
  ridesCount: number;
  hoursRented: number;
  bikesUsed: number;
  /** Public wall posts (is_hidden = false) in this crew. */
  postsCount: number;
  /** Posts that carry at least one photo. */
  photoPostsCount: number;
  commentsCount: number;
  /** Total reactions across ALL of the rider's posts (like_count sum). */
  reactionsReceived: number;
  /** Posts starting with the «📍» check-in prefix (see buildSpotCheckinText). */
  checkinCount: number;
  /** ISO of the earliest dated rental ride («в седле с …»), null if none. */
  firstRideAt: string | null;
}

export const EMPTY_RIDER_PUBLIC_STATS: RiderPublicStats = {
  ridesCount: 0,
  hoursRented: 0,
  bikesUsed: 0,
  postsCount: 0,
  photoPostsCount: 0,
  commentsCount: 0,
  reactionsReceived: 0,
  checkinCount: 0,
  firstRideAt: null,
};

// ── Badges (computed, Chain-style collection) ────────────────────────────────

export interface RiderWallBadge {
  id: string;
  title: string;
  emoji: string;
  description: string;
  unlocked: boolean;
  /** 0..1 — progress towards the next tier (1 when unlocked). */
  progress: number;
  /** Human-readable next step, e.g. «ещё 2 поста». */
  hint: string | null;
}

const BADGE_TIERS: ReadonlyArray<{
  id: string;
  title: string;
  emoji: string;
  description: string;
  value: (s: RiderPublicStats) => number;
  steps: readonly number[];
  noun: [string, string, string]; // pluralRu forms for the hint
}> = [
  {
    id: "first_post",
    title: "Первый пост",
    emoji: "📝",
    description: "Написал первый пост на стене экипажа",
    value: (s) => s.postsCount,
    steps: [1],
    noun: ["пост", "поста", "постов"],
  },
  {
    id: "voice",
    title: "Голос улиц",
    emoji: "📣",
    description: "10 постов — стена слушает тебя",
    value: (s) => s.postsCount,
    steps: [10],
    noun: ["пост", "поста", "постов"],
  },
  {
    id: "photographer",
    title: "Фотограф",
    emoji: "📸",
    description: "3 поста с фото байков и поездок",
    value: (s) => s.photoPostsCount,
    steps: [3],
    noun: ["фото-пост", "фото-поста", "фото-постов"],
  },
  {
    id: "stamps",
    title: "Штемпели",
    emoji: "📍",
    description: "Чек-ины на мототочках НН — собери все 11",
    value: (s) => s.checkinCount,
    steps: [3],
    noun: ["чек-ин", "чек-ина", "чек-инов"],
  },
  {
    id: "crowd_fav",
    title: "Любимчик экипажа",
    emoji: "❤️",
    description: "25 реакций на твои посты",
    value: (s) => s.reactionsReceived,
    steps: [25],
    noun: ["реакция", "реакции", "реакций"],
  },
  {
    id: "saddle",
    title: "Часы в седле",
    emoji: "⏱",
    description: "20 часов аренды — настоящий наездник",
    value: (s) => s.hoursRented,
    steps: [20],
    noun: ["час", "часа", "часов"],
  },
];

function badgeProgress(value: number, steps: readonly number[]): { progress: number; unlocked: boolean } {
  const target = steps[steps.length - 1];
  const unlocked = value >= target;
  // progress fills to the FIRST unlocked tier, then stays full
  const firstTarget = steps[0];
  const progress = unlocked ? 1 : Math.max(0, Math.min(1, value / firstTarget));
  return { progress, unlocked };
}

function hintFor(value: number, steps: readonly number[], noun: [string, string, string]): string | null {
  const target = steps[0];
  if (value >= target) return null;
  const left = target - value;
  return `ещё ${left} ${pluralRu(left, noun)}`;
}

/** All wall badges for a rider: the fixed collection + the ride milestone
 *  (reuses riderMilestoneBadge so stats posts and the profile never drift). */
export function computeRiderWallBadges(stats: RiderPublicStats): RiderWallBadge[] {
  const badges: RiderWallBadge[] = BADGE_TIERS.map((def) => {
    const value = def.value(stats);
    const { progress, unlocked } = badgeProgress(value, def.steps);
    return {
      id: def.id,
      title: def.title,
      emoji: def.emoji,
      description: def.description,
      unlocked,
      progress,
      hint: hintFor(value, def.steps, def.noun),
    };
  });

  const rideMilestone = riderMilestoneBadge(stats.ridesCount);
  if (rideMilestone) {
    badges.push({
      id: "ride_milestone",
      title: rideMilestone.label,
      emoji: rideMilestone.emoji,
      description: `Милистоун заездов: ${stats.ridesCount} — тот же бейдж, что на статс-постах`,
      unlocked: true,
      progress: 1,
      hint: null,
    });
  }
  return badges;
}

/** Public header meta — what «в экипаже с …» shows. */
export function riderSinceLabel(firstRideAt: string | null, memberSinceIso: string | null): string | null {
  const source = firstRideAt ?? memberSinceIso;
  if (!source) return null;
  const ts = Date.parse(source);
  if (Number.isNaN(ts)) return null;
  const year = new Date(ts).getFullYear();
  return `в экипаже с ${year} года`;
}

/** Re-export so client components can import one module only. */
export type { RiderMilestoneBadge };
