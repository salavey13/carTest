"use server";

// Compatibility surface for existing franchize routes/components.
// New code should import from the focused modules in `app/franchize/server-actions/*`.

import {
  getFranchizeBySlug as getFranchizeBySlugRuntime,
  markCrewBikesAvailable as markCrewBikesAvailableRuntime,
} from "@/app/franchize/actions-runtime";
import type { FranchizeBySlugResult } from "@/app/franchize/actions-runtime";

// ── SPEED FIX (task131, 2026-10-24): in-process memo for the catalog read ──
//
// `getFranchizeBySlugRuntime` is `noStore()` + FOUR sequential Supabase
// roundtrips (crews → cars → rentals → rental_reviews) + availability/review
// mapping. A single navigation to /franchize/[slug] used to run it THREE
// times — app/franchize/[slug]/layout.tsx, page.tsx and metadata.ts all call
// it per request — i.e. 12 sequential cross-region roundtrips before the
// catalog could paint. That was the «выбрать байк takes forever» tail.
//
// The memo dedupes those three same-request calls (all three hit the same
// instance within the render pass) AND repeat navigations within the TTL.
// Freshness contract: 60s staleness on catalog/availability is fine for a
// storefront (new bookings show «В аренде» within a minute); mutations that
// materially change the payload — markCrewBikesAvailable — bust the entry
// explicitly. structuredClone on every hit so no caller can mutate shared
// state across requests.
//
// Why not unstable_cache: the runtime action calls `noStore()` internally,
// which errors inside an unstable_cache scope; unwrapping it in the
// 7000-line actions-runtime was too much blast radius for this pass.

type FranchizeCatalogMemoEntry = {
  at: number;
  data: FranchizeBySlugResult;
};

const CATALOG_MEMO_TTL_MS = 60_000;
const CATALOG_MEMO_MAX_KEYS = 50;
const catalogMemo = new Map<string, FranchizeCatalogMemoEntry>();

function normalizeCatalogMemoKey(slug: string) {
  return (slug ?? "").trim().toLowerCase();
}

function readCatalogMemo(key: string): FranchizeBySlugResult | null {
  const hit = catalogMemo.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CATALOG_MEMO_TTL_MS) {
    catalogMemo.delete(key);
    return null;
  }
  // Guard against in-place mutation by any server-side consumer.
  return structuredClone(hit.data);
}

function writeCatalogMemo(key: string, data: FranchizeBySlugResult) {
  // Cache only real crew payloads — emptyCrew misses (unknown slug / DB
  // hiccup) stay uncached so a transient failure never sticks for 60s.
  if (!data?.crew?.id) return;
  if (catalogMemo.size >= CATALOG_MEMO_MAX_KEYS) {
    const oldestKey = catalogMemo.keys().next().value;
    if (typeof oldestKey === "string") catalogMemo.delete(oldestKey);
  }
  catalogMemo.set(key, { at: Date.now(), data });
}

export async function getFranchizeBySlug(slug: string): Promise<FranchizeBySlugResult> {
  const key = normalizeCatalogMemoKey(slug);
  const hit = readCatalogMemo(key);
  if (hit) return hit;

  const data = await getFranchizeBySlugRuntime(slug);
  writeCatalogMemo(key, data);
  // Same clone-on-return contract for the fresh fetch: the memoized copy and
  // the returned copy must never alias.
  return data?.crew?.id ? structuredClone(data) : data;
}

export async function markCrewBikesAvailable(slug: string) {
  const key = normalizeCatalogMemoKey(slug);
  // Bust before AND after: the action mutates availability rows, and any
  // render that races the mutation must not resurrect the stale entry.
  catalogMemo.delete(key);
  const result = await markCrewBikesAvailableRuntime(slug);
  catalogMemo.delete(key);
  return result;
}
