"use server";

import { supabaseAdmin } from "@/lib/supabase-server";

export type FranchizeAchievementDefinition = {
  id: string;
  title: string;
  description: string;
  category: "onboarding" | "operations" | "map_riders" | "growth";
  triggerSources: string[];
};

export type FranchizeAchievementUnlock = {
  unlockedAt: string;
  source: string;
  context?: Record<string, unknown>;
};

export type FranchizeProfileState = {
  slug: string;
  crewName: string;
  achievements: Record<string, FranchizeAchievementUnlock>;
  counters: Record<string, number>;
  lastActivityAt: string;
};

export type FranchizeFormPrefill = {
  fullName: string;
  phone: string;
  preferredTime: string;
  deliveryMode: "pickup" | "delivery";
  comment: string;
};

export type FranchizeActivityDigest = {
  rentals: Array<{ rentalId: string; status: string; vehicleId: string; vehicleLabel: string; docLink: string }>;
  buyOrders: Array<{ orderId: string; status: string; vehicleIds: string[]; docLink: string; createdAt: string; docFileName?: string }>;
};

const FRANCHIZE_ACHIEVEMENT_CAPABILITIES = {
  onboarding: "Tracks onboarding participation (/start survey completion) and marks crew-level readiness.",
  operations: "Tracks recurring crew operations and delivery signals for franchize execution.",
  map_riders: "Tracks map-riders mission activity for field execution personas.",
  growth: "Tracks expansion and conversion improvements tied to franchize outcomes.",
} as const;

export async function getFranchizeCapabilityContractAction() {
  return FRANCHIZE_ACHIEVEMENT_CAPABILITIES;
}

const DEFAULT_PROFILE = (slug: string): FranchizeProfileState => ({
  slug,
  crewName: slug,
  achievements: {},
  counters: {},
  lastActivityAt: new Date(0).toISOString(),
});

const DEFAULT_PREFILL: FranchizeFormPrefill = {
  fullName: "",
  phone: "",
  preferredTime: "",
  deliveryMode: "pickup",
  comment: "",
};

function getCatalogBySlug(slug: string): FranchizeAchievementDefinition[] {
  const shared: FranchizeAchievementDefinition[] = [
    {
      id: "onboarding_survey_completed",
      title: "Вошёл в контур",
      description: "Завершил стартовый онбординг-опрос и активировал профилирование оператора.",
      category: "onboarding",
      triggerSources: ["telegram:/start"],
    },
    {
      id: "franchize_profile_opened",
      title: "Профиль франшизы открыт",
      description: "Первый вход на персональную страницу франшизы с локальными достижениями.",
      category: "operations",
      triggerSources: ["web:franchize_profile"],
    },
  ];

  const vipBikeOnly: FranchizeAchievementDefinition[] = [
    {
      id: "vipbike_map_riders_ready",
      title: "Map Riders ready",
      description: "Оператор открыл контур map-riders и готов к полевому режиму.",
      category: "map_riders",
      triggerSources: ["web:map_riders"],
    },
  ];

  if (slug === "vip-bike") return [...shared, ...vipBikeOnly];
  return shared;
}

export async function getFranchizeAchievementCatalogAction(slug: string): Promise<FranchizeAchievementDefinition[]> {
  return getCatalogBySlug((slug || "vip-bike").trim().toLowerCase());
}

export async function getFranchizeProfileBySlugAction(params: {
  slug: string;
  userId: string;
}): Promise<{ success: boolean; data?: FranchizeProfileState; error?: string; catalog?: FranchizeAchievementDefinition[] }> {
  const slug = (params.slug || "vip-bike").trim().toLowerCase();
  if (!params.userId) {
    return { success: false, error: "userId is required", catalog: getCatalogBySlug(slug) };
  }

  const [{ data: user, error: userError }, { data: crew }] = await Promise.all([
    supabaseAdmin.from("users").select("metadata").eq("user_id", params.userId).maybeSingle(),
    supabaseAdmin.from("crews").select("name").eq("slug", slug).maybeSingle(),
  ]);

  if (userError) {
    return { success: false, error: userError.message, catalog: getCatalogBySlug(slug) };
  }

  const metadata = (user?.metadata || {}) as Record<string, any>;
  const franchizeProfiles = (metadata.franchizeProfiles || {}) as Record<string, any>;
  const rawState = franchizeProfiles[slug] || {};

  const data: FranchizeProfileState = {
    ...DEFAULT_PROFILE(slug),
    crewName: (crew?.name as string) || slug,
    ...(typeof rawState === "object" && rawState ? rawState : {}),
    slug,
  };

  return { success: true, data, catalog: getCatalogBySlug(slug) };
}

export async function grantFranchizeAchievementAction(params: {
  slug: string;
  userId: string;
  achievementId: string;
  source: string;
  context?: Record<string, unknown>;
  incrementCounters?: Record<string, number>;
}): Promise<{ success: boolean; alreadyUnlocked?: boolean; error?: string }> {
  const slug = (params.slug || "vip-bike").trim().toLowerCase();
  if (!params.userId || !params.achievementId) {
    return { success: false, error: "userId and achievementId are required" };
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("metadata")
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) return { success: false, error: error.message };

  const metadata = ((user?.metadata || {}) as Record<string, any>) || {};
  const profiles = ((metadata.franchizeProfiles || {}) as Record<string, any>) || {};
  const currentState = (profiles[slug] || DEFAULT_PROFILE(slug)) as FranchizeProfileState;

  const currentAchievements = { ...(currentState.achievements || {}) };
  const alreadyUnlocked = !!currentAchievements[params.achievementId];

  if (!alreadyUnlocked) {
    currentAchievements[params.achievementId] = {
      unlockedAt: new Date().toISOString(),
      source: params.source,
      context: params.context,
    };
  }

  const nextCounters = { ...(currentState.counters || {}) };
  Object.entries(params.incrementCounters || {}).forEach(([key, value]) => {
    const delta = Number(value || 0);
    if (!Number.isFinite(delta)) return;
    nextCounters[key] = (nextCounters[key] || 0) + delta;
  });

  const nextState: FranchizeProfileState = {
    ...currentState,
    slug,
    achievements: currentAchievements,
    counters: nextCounters,
    lastActivityAt: new Date().toISOString(),
  };

  const nextMetadata = {
    ...metadata,
    franchizeProfiles: {
      ...profiles,
      [slug]: nextState,
    },
  };

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
    .eq("user_id", params.userId);

  if (updateError) return { success: false, error: updateError.message };
  return { success: true, alreadyUnlocked };
}

export async function getFranchizeFormPrefillAction(params: { userId: string; slug: string }): Promise<{ success: boolean; data?: FranchizeFormPrefill; error?: string }> {
  const { data: user, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", params.userId).maybeSingle();
  if (error) return { success: false, error: error.message };
  const metadata = (user?.metadata || {}) as Record<string, any>;
  const prefill = metadata.franchizeFormPrefill?.[params.slug] ?? metadata.franchizeFormPrefill?.default ?? DEFAULT_PREFILL;
  return { success: true, data: { ...DEFAULT_PREFILL, ...(prefill as Record<string, unknown>) } as FranchizeFormPrefill };
}

export async function saveFranchizeFormPrefillAction(params: { userId: string; slug: string; prefill: FranchizeFormPrefill }): Promise<{ success: boolean; error?: string }> {
  const { data: user, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", params.userId).maybeSingle();
  if (error) return { success: false, error: error.message };
  const metadata = (user?.metadata || {}) as Record<string, any>;
  const next = {
    ...metadata,
    franchizeFormPrefill: {
      ...(metadata.franchizeFormPrefill || {}),
      [params.slug]: params.prefill,
    },
  };
  const { error: updateError } = await supabaseAdmin.from("users").update({ metadata: next, updated_at: new Date().toISOString() }).eq("user_id", params.userId);
  return updateError ? { success: false, error: updateError.message } : { success: true };
}

export async function getFranchizeActivityDigestAction(params: { userId: string; slug: string }): Promise<{ success: boolean; data?: FranchizeActivityDigest; error?: string }> {
  const { data: rentals, error: rentalsError } = await supabaseAdmin
    .from("rentals")
    .select("rental_id,status,vehicle_id,vehicle:cars(make,model)")
    .or(`user_id.eq.${params.userId},owner_id.eq.${params.userId}`)
    .order("created_at", { ascending: false })
    .limit(20);
  if (rentalsError) return { success: false, error: rentalsError.message };

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("franchize_order_notifications")
    .select("order_id,send_status,payload,created_at,doc_file_name")
    .eq("slug", params.slug)
    .eq("payload->>telegramUserId", params.userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (ordersError) return { success: false, error: ordersError.message };

  return {
    success: true,
    data: {
      rentals: (rentals || []).map((r: any) => ({
        rentalId: r.rental_id,
        status: r.status || "unknown",
        vehicleId: r.vehicle_id || "",
        vehicleLabel: `${r.vehicle?.make || "Bike"} ${r.vehicle?.model || ""}`.trim(),
        docLink: `/rentals/${r.rental_id}`,
      })),
      buyOrders: (orders || [])
        .filter((o: any) => ["sale", "mixed"].includes(String(o?.payload?.flowType || "")))
        .map((o: any) => ({
          orderId: o.order_id,
          status: o.send_status || "pending",
          vehicleIds: Array.isArray(o?.payload?.cartLines) ? o.payload.cartLines.map((l: any) => String(l.itemId || "")) : [],
          docLink: `/franchize/${params.slug}/order/${o.order_id}`,
          createdAt: o.created_at,
          docFileName: typeof o.doc_file_name === "string" ? o.doc_file_name : "",
        })),
    },
  };
}
