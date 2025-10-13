"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";

/**
 * Server actions for crew-specific WB page (slug-based).
 * DEBUG_ITEM_TYPE default "bike" (env override).
 */
const DEBUG_ITEM_TYPE = (process.env.DEBUG_ITEM_TYPE || "bike").toString();

type FetchResult = {
  success: boolean;
  data?: any[];
  crew?: { id: string; name: string; slug: string; owner_id?: string; logo_url?: string };
  error?: string | null;
  debug?: {
    queriedType?: string;
    foundCount?: number;
    totalForCrew?: number;
    sampleAllTypes?: Array<{ id: string; type?: string }>;
    crewId?: string;
  };
};

function logInfo(...args: any[]) {
  try { logger?.info?.(...args); } catch(e){ /* noop */ }
  // also console to ensure visibility in simple setups
  // eslint-disable-next-line no-console
  console.log("[fetchCrewItemsBySlug]", ...args);
}
function logError(...args: any[]) {
  try { logger?.error?.(...args); } catch(e){ /* noop */ }
  // eslint-disable-next-line no-console
  console.error("[fetchCrewItemsBySlug]", ...args);
}

/**
 * Fetch items for crew identified by slug.
 * If userChatId provided — perform membership check.
 * itemType overrides DEBUG_ITEM_TYPE when provided.
 */
export async function fetchCrewItemsBySlug(
  slug: string,
  userChatId?: string,
  itemType?: string
): Promise<FetchResult> {
  try {
    if (!slug) {
      logError("Called without slug");
      return { success: false, error: "slug is required" };
    }

    logInfo("Starting fetchCrewItemsBySlug", { slug, userChatId, envType: DEBUG_ITEM_TYPE });

    // 1) Resolve crew by slug
    const { data: crewRow, error: crewErr } = await supabaseAdmin
      .from("crews")
      .select("id, name, slug, owner_id, logo_url")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (crewErr) {
      logError("Crew lookup error:", crewErr);
      return { success: false, error: "Failed to lookup crew", debug: { crewId: undefined } };
    }
    if (!crewRow) {
      logError(`Crew with slug '${slug}' not found`);
      return { success: false, error: `Crew with slug '${slug}' not found`, debug: { crewId: undefined } };
    }

    const crew = crewRow as any;
    logInfo("Crew resolved", { crewId: crew.id, crewName: crew.name });

    // 2) If userChatId provided, verify membership
    if (userChatId) {
      try {
        const { data: member, error: memberErr } = await supabaseAdmin
          .from("crew_members")
          .select("id, membership_status")
          .eq("crew_id", crew.id)
          .eq("user_id", userChatId)
          .limit(1)
          .maybeSingle();

        if (memberErr) {
          logError("Membership check DB error:", memberErr);
          return { success: false, error: "Membership check failed (db)", debug: { crewId: crew.id } };
        }
        if (!member) {
          logInfo("User is not a member of crew", { userChatId, crewId: crew.id });
          return { success: false, error: "User is not a member of this crew", debug: { crewId: crew.id } };
        }
        logInfo("Membership validated", { userChatId, membership_status: (member as any).membership_status });
      } catch (mErr:any) {
        logError("Membership check unexpected error:", mErr);
        return { success: false, error: "Membership check failed", debug: { crewId: crew.id } };
      }
    } else {
      logInfo("No userChatId provided — skipping membership check");
    }

    // 3) Query items by crew_id and type (debug override)
    const typeToUse = itemType || DEBUG_ITEM_TYPE;
    logInfo("Querying cars", { crewId: crew.id, type: typeToUse });

    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .eq("crew_id", crew.id)
      .eq("type", typeToUse)
      .order("make", { ascending: true });

    if (error) {
      logError("Supabase query error for cars:", error);
      return { success: false, error: error.message || "Failed to fetch items", debug: { crewId: crew.id, queriedType: typeToUse } };
    }

    const foundCount = (data || []).length;
    logInfo("Query returned", { foundCount, crewId: crew.id, queriedType: typeToUse });

    // 4) If zero results, fetch a quick fallback: count of all cars for this crew + sample of types
    let debug: FetchResult["debug"] = { crewId: crew.id, queriedType: typeToUse, foundCount };
    if (foundCount === 0) {
      try {
        const { data: allForCrew, error: allErr } = await supabaseAdmin
          .from("cars")
          .select("id, type")
          .eq("crew_id", crew.id)
          .limit(50); // small sample

        if (allErr) {
          logError("Fallback allForCrew error:", allErr);
          debug.totalForCrew = 0;
          debug.sampleAllTypes = [];
        } else {
          debug.totalForCrew = (allForCrew || []).length;
          debug.sampleAllTypes = (allForCrew || []).slice(0, 10).map((r:any) => ({ id: r.id, type: r.type }));
        }
        logInfo("Fallback info", debug);
      } catch (fbErr:any) {
        logError("Fallback unexpected error:", fbErr);
        debug.totalForCrew = 0;
        debug.sampleAllTypes = [];
      }
    }

    // 5) Normalize a bit (unwrap specs for easy client display)
    const normalized = (data || []).map((r: any) => {
      let specs = {};
      try { specs = r.specs || {}; } catch (e) { specs = {}; }
      return { ...r, specs };
    });

    return { success: true, data: normalized, crew: { id: crew.id, name: crew.name, slug: crew.slug, owner_id: crew.owner_id, logo_url: crew.logo_url }, debug };
  } catch (err: any) {
    logError("Unexpected error in fetchCrewItemsBySlug:", err);
    return { success: false, error: err?.message || "unknown error", debug: { crewId: undefined } };
  }
}

/**
 * Lightweight helper to fetch crew metadata by slug.
 */
export async function fetchCrewBySlug(slug: string): Promise<{ success: boolean; crew?: any; error?: string }> {
  try {
    if (!slug) return { success: false, error: "slug required" };
    const { data, error } = await supabaseAdmin.from("crews").select("id, name, slug, description, logo_url, owner_id, hq_location").eq("slug", slug).limit(1).maybeSingle();
    if (error) {
      logError("fetchCrewBySlug DB error:", error);
      return { success: false, error: error.message };
    }
    if (!data) {
      logInfo("fetchCrewBySlug: crew not found", { slug });
      return { success: false, error: "Crew not found" };
    }
    return { success: true, crew: data };
  } catch (e: any) {
    logError("fetchCrewBySlug unexpected error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}