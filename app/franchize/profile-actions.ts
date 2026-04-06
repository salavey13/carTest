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
