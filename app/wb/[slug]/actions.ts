"use server";

import { supabaseAdmin } from "@/hooks/supabase";

/**
 * Server actions for crew-specific WB page (slug-based).
 *
 * DEBUG_ITEM_TYPE is used to simulate 'wb_item' with 'bike' for the demo.
 * Set DEBUG_ITEM_TYPE in env (Vercel/.env). Default: "bike".
 */
const DEBUG_ITEM_TYPE = (process.env.DEBUG_ITEM_TYPE || "bike").toString();

type FetchResult = {
  success: boolean;
  data?: any[];
  crew?: { id: string; name: string; slug: string; owner_id?: string; logo_url?: string };
  error?: string | null;
};

/**
 * Fetch items for crew identified by slug.
 * If userChatId provided — perform membership check (defense in depth).
 * itemType overrides DEBUG_ITEM_TYPE when provided.
 */
export async function fetchCrewItemsBySlug(
  slug: string,
  userChatId?: string,
  itemType?: string
): Promise<FetchResult> {
  try {
    if (!slug) return { success: false, error: "slug is required" };

    // 1) Resolve crew by slug
    const { data: crewRows, error: crewErr } = await supabaseAdmin
      .from("crews")
      .select("id, name, slug, owner_id, logo_url")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();

    if (crewErr) {
      console.error("fetchCrewItemsBySlug: crew lookup error:", crewErr);
      return { success: false, error: "Failed to lookup crew" };
    }
    if (!crewRows) return { success: false, error: `Crew with slug '${slug}' not found` };

    const crew = crewRows as any;

    // 2) If userChatId provided, verify membership
    if (userChatId) {
      const { data: member, error: memberErr } = await supabaseAdmin
        .from("crew_members")
        .select("id, membership_status")
        .eq("crew_id", crew.id)
        .eq("user_id", userChatId)
        .limit(1)
        .maybeSingle();

      if (memberErr) {
        console.error("fetchCrewItemsBySlug: membership check failed:", memberErr);
        return { success: false, error: "Membership check failed" };
      }
      if (!member) {
        return { success: false, error: "User is not a member of this crew" };
      }
      // optional: reject pending members if you want:
      // if (member.membership_status !== 'active') return { success:false, error: 'Membership pending' }
    }

    // 3) Query items by crew_id and type (debug override)
    const typeToUse = itemType || DEBUG_ITEM_TYPE;

    const { data, error } = await supabaseAdmin
      .from("cars")
      .select("*")
      .eq("crew_id", crew.id)
      .eq("type", typeToUse)
      .order("make", { ascending: true });

    if (error) {
      console.error("fetchCrewItemsBySlug supabase error:", error);
      return { success: false, error: error.message || "Failed to fetch items" };
    }

    // 4) Normalize a bit (unwrap specs for easy client display)
    const normalized = (data || []).map((r: any) => {
      let specs = {};
      try { specs = r.specs || {}; } catch (e) { specs = {}; }
      return { ...r, specs };
    });

    return { success: true, data: normalized, crew: { id: crew.id, name: crew.name, slug: crew.slug, owner_id: crew.owner_id, logo_url: crew.logo_url } };
  } catch (err: any) {
    console.error("fetchCrewItemsBySlug unexpected error:", err);
    return { success: false, error: err?.message || "unknown error" };
  }
}

/**
 * Lightweight helper to fetch crew metadata by slug.
 */
export async function fetchCrewBySlug(slug: string): Promise<{ success: boolean; crew?: any; error?: string }> {
  try {
    if (!slug) return { success: false, error: "slug required" };
    const { data, error } = await supabaseAdmin.from("crews").select("id, name, slug, description, logo_url, owner_id, hq_location").eq("slug", slug).limit(1).maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Crew not found" };
    return { success: true, crew: data };
  } catch (e: any) {
    console.error("fetchCrewBySlug error:", e);
    return { success: false, error: e?.message || "unknown" };
  }
}