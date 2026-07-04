"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";

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

export type FranchizeNotificationPreferences = {
  orderUpdates: boolean;
  mapRidersAlerts: boolean;
  marketingDigest: boolean;
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

const DEFAULT_NOTIFICATION_PREFERENCES: FranchizeNotificationPreferences = {
  orderUpdates: true,
  mapRidersAlerts: true,
  marketingDigest: false,
};

function normalizeSlug(slug: string): string {
  return (slug || "vip-bike").trim().toLowerCase() || "vip-bike";
}

function asRecord(value: unknown): Record<string, any> {
  return typeof value === "object" && value ? (value as Record<string, any>) : {};
}

function normalizeNotificationPreferences(value: unknown): FranchizeNotificationPreferences {
  const raw = typeof value === "object" && value ? (value as Partial<FranchizeNotificationPreferences>) : {};
  return {
    orderUpdates: typeof raw.orderUpdates === "boolean" ? raw.orderUpdates : DEFAULT_NOTIFICATION_PREFERENCES.orderUpdates,
    mapRidersAlerts:
      typeof raw.mapRidersAlerts === "boolean" ? raw.mapRidersAlerts : DEFAULT_NOTIFICATION_PREFERENCES.mapRidersAlerts,
    marketingDigest: typeof raw.marketingDigest === "boolean" ? raw.marketingDigest : DEFAULT_NOTIFICATION_PREFERENCES.marketingDigest,
  };
}

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

export async function getFranchizeNotificationPreferencesAction(params: {
  userId: string;
  slug: string;
}): Promise<{ success: boolean; data?: FranchizeNotificationPreferences; error?: string }> {
  if (!params.userId) return { success: false, error: "userId is required" };
  const slug = normalizeSlug(params.slug);

  const { data: user, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", params.userId).maybeSingle();
  if (error) return { success: false, error: error.message };

  const metadata = asRecord(user?.metadata);
  const notificationPreferences = asRecord(metadata.franchizeNotificationPreferences);
  const slugPreferences = notificationPreferences[slug];
  const defaultPreferences = notificationPreferences.default;

  return {
    success: true,
    data: normalizeNotificationPreferences(slugPreferences ?? defaultPreferences),
  };
}

export async function saveFranchizeNotificationPreferencesAction(params: {
  userId: string;
  slug: string;
  preferences: FranchizeNotificationPreferences;
}): Promise<{ success: boolean; error?: string }> {
  if (!params.userId) return { success: false, error: "userId is required" };
  const slug = normalizeSlug(params.slug);

  const { data: user, error } = await supabaseAdmin.from("users").select("metadata").eq("user_id", params.userId).maybeSingle();
  if (error) return { success: false, error: error.message };

  const metadata = asRecord(user?.metadata);
  const currentNotificationPreferences = asRecord(metadata.franchizeNotificationPreferences);
  const normalized = normalizeNotificationPreferences(params.preferences);
  const next = {
    ...metadata,
    franchizeNotificationPreferences: {
      ...currentNotificationPreferences,
      [slug]: normalized,
    },
  };

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ metadata: next, updated_at: new Date().toISOString() })
    .eq("user_id", params.userId);

  return updateError ? { success: false, error: updateError.message } : { success: true };
}

export async function getFranchizeActivityDigestAction(params: { userId: string; slug: string }): Promise<{ success: boolean; data?: FranchizeActivityDigest; error?: string }> {
  const { data: rentals, error: rentalsError } = await supabaseAdmin
    .from("rentals")
    .select("rental_id,status,payment_status,vehicle_id,metadata,vehicle:cars(make,model)")
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
        paymentStatus: r.payment_status || "",
        isTestRide: r.metadata?.flowType === "sale" || r.payment_status === "interest_paid",
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

/**
 * Get user's verified rental secrets (passport, license) from previous rentals
 * Used for returning user pre-fill (WOW effect)
 */
export async function getFranchizeUserRentalSecretsAction(params: {
  userId: string;
  slug: string;
}): Promise<{
  success: boolean;
  data?: {
    hasPreviousRentals: boolean;
    lastRentalDate?: string;
    savedData?: {
      fullName: string;
      phone: string;
      passport: string;
      driverLicense: string;
    };
  };
  error?: string;
}> {
  try {
    // Check for previous rentals in rental_contract_artifacts
    const { data: artifacts, error: artifactsError } = await privateSchema()
      .from("rental_contract_artifacts")
      .select("created_at,renter_full_name,renter_phone,renter_passport,renter_driver_license")
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (artifactsError && artifactsError.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine (no previous rentals)
      return { success: false, error: artifactsError.message };
    }

    const hasPreviousRentals = !!artifacts;
    const lastRentalDate = artifacts?.created_at ? new Date(artifacts.created_at).toISOString().split("T")[0] : undefined;

    return {
      success: true,
      data: {
        hasPreviousRentals,
        lastRentalDate,
        savedData: {
          fullName: artifacts?.renter_full_name || "",
          phone: artifacts?.renter_phone || "",
          passport: artifacts?.renter_passport || "",
          driverLicense: artifacts?.renter_driver_license || "",
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Sync profile preset data to rental secrets
 * Called when user manually updates form prefill in profile
 */
export async function updateRentalSecretsFromProfileAction(params: {
  userId: string;
  slug: string;
  prefill: FranchizeFormPrefill;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", params.userId)
      .maybeSingle();

    if (userError || !user) {
      return { success: false, error: userError?.message || "User not found" };
    }

    const metadata = (user?.metadata || {}) as Record<string, any>;
    const currentSecrets = metadata.rentalSecrets || {};

    // Sync phone and fullName from profile prefill to rental secrets
    const nextSecrets = {
      ...currentSecrets,
      phone: params.prefill.phone || currentSecrets.phone || "",
      fullName: params.prefill.fullName || currentSecrets.fullName || "",
      updatedAt: new Date().toISOString(),
      source: `profile_sync_${params.slug}`,
    };

    const nextMetadata = {
      ...metadata,
      rentalSecrets: nextSecrets,
    };

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("user_id", params.userId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Save user-entered passport/license data to private.user_rental_secrets.
 *
 * Stored with:
 *   chat_id = user's Telegram user_id (NOT null — user self-entered)
 *   verification_status = "pending" (self-entered, not operator-verified)
 *   source_doc_key = "profile_prefill"
 *   doc_sha256 = deterministic hash (prefill_<userId>_<crewSlug>)
 *
 * On subsequent saves, the existing prefill row is updated (UPSERT by doc_sha256).
 */
export async function saveRentalDocsPrefillAction(params: {
  userId: string;
  slug: string;
  fullName?: string;
  phone?: string;
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssuedBy?: string;
  passportIssueDate?: string;
  registrationAddress?: string;
  licenseSeries?: string;
  licenseNumber?: string;
  licenseCategories?: string;
  licenseExpiryDate?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Get user's chat_id (= Telegram user_id) from users table
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_id, metadata")
      .eq("user_id", params.userId)
      .maybeSingle();

    if (userError || !user) {
      return { success: false, error: userError?.message || "User not found" };
    }

    const chatId = user.user_id; // Telegram user_id is the chat_id in this table

    // 2. Build deterministic doc_sha256 for prefill record
    //    Format: prefill_<chatId>_<crewSlug> — stable across saves
    const docSha256 = `prefill_${chatId}_${params.slug}`;

    // 3. Build combined passport string (series + number)
    const passportStr = [params.passportSeries, params.passportNumber]
      .filter(Boolean)
      .join(" ");

    // 4. Build combined license string (series + number)
    const licenseStr = [params.licenseSeries, params.licenseNumber]
      .filter(Boolean)
      .join(" ");

    // 5. UPSERT into private.user_rental_secrets
    //    Using merge=true so existing columns are preserved if not overwritten
    const upsertData = {
      chat_id: chatId,
      crew_slug: params.slug,
      doc_sha256: docSha256,
      renter_full_name: params.fullName ?? null,
      renter_passport: passportStr || null,
      renter_passport_issue_date: params.passportIssueDate ?? null,
      renter_passport_issued_by: params.passportIssuedBy ?? null,
      renter_registration: params.registrationAddress ?? null,
      renter_driver_license: licenseStr || null,
      renter_birth_date: params.birthDate ?? null,
      renter_phone: params.phone ?? null,
      source_doc_key: "profile_prefill",
      verification_status: "pending" as const,
      template_version: 1,
    };

    // Check if a prefill row already exists
    const { data: existing } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("doc_sha256", docSha256)
      .maybeSingle();

    if (existing) {
      // UPDATE existing prefill row — merge new values over existing
      const merged = {
        ...upsertData,
        renter_full_name: upsertData.renter_full_name ?? existing.renter_full_name,
        renter_passport: upsertData.renter_passport ?? existing.renter_passport,
        renter_passport_issue_date: upsertData.renter_passport_issue_date ?? existing.renter_passport_issue_date,
        renter_passport_issued_by: upsertData.renter_passport_issued_by ?? existing.renter_passport_issued_by,
        renter_registration: upsertData.renter_registration ?? existing.renter_registration,
        renter_driver_license: upsertData.renter_driver_license ?? existing.renter_driver_license,
        renter_birth_date: upsertData.renter_birth_date ?? existing.renter_birth_date,
        renter_phone: upsertData.renter_phone ?? existing.renter_phone,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await privateSchema()
        .from("user_rental_secrets")
        .update(merged)
        .eq("doc_sha256", docSha256);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    } else {
      // INSERT new prefill row
      const { error: insertError } = await privateSchema()
        .from("user_rental_secrets")
        .insert({
          ...upsertData,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user-entered passport/license data for pre-fill.
 * Reads from private.user_rental_secrets WHERE source_doc_key = "profile_prefill".
 *
 * Also checks for any verified records (from completed rentals) that might
 * have more complete data.
 */
export async function getRentalDocsPrefillAction(params: {
  userId: string;
  slug: string;
}): Promise<{
  success: boolean;
  data?: {
    fullName?: string;
    phone?: string;
    birthDate?: string;
    passportSeries?: string;
    passportNumber?: string;
    passportIssuedBy?: string;
    passportIssueDate?: string;
    registrationAddress?: string;
    licenseSeries?: string;
    licenseNumber?: string;
    licenseCategories?: string;
    licenseExpiryDate?: string;
    verificationStatus?: string;
    hasVerifiedData?: boolean;
  };
}> {
  try {
    // 1. Get user's chat_id
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("user_id", params.userId)
      .maybeSingle();

    if (!user) return { success: false };

    const chatId = user.user_id;
    const docSha256 = `prefill_${chatId}_${params.slug}`;

    // 2. Try to get the self-entered prefill record first
    const { data: prefillRow } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("doc_sha256", docSha256)
      .maybeSingle();

    // 3. Also check for verified data from previous rentals
    const { data: verifiedRow } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", chatId)
      .eq("crew_slug", params.slug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 4. Merge: prefer verified data, fall back to prefill
    const source = verifiedRow || prefillRow;
    if (!source) return { success: true };

    // Parse passport string back to series + number
    const passportParts = (source.renter_passport || "").trim().split(/\s+/);
    const licenseParts = (source.renter_driver_license || "").trim().split(/\s+/);

    return {
      success: true,
      data: {
        fullName: source.renter_full_name || undefined,
        phone: source.renter_phone || undefined,
        birthDate: source.renter_birth_date || undefined,
        passportSeries: passportParts[0] || undefined,
        passportNumber: passportParts[1] || undefined,
        passportIssuedBy: source.renter_passport_issued_by || undefined,
        passportIssueDate: source.renter_passport_issue_date || undefined,
        registrationAddress: source.renter_registration || undefined,
        licenseSeries: licenseParts[0] || undefined,
        licenseNumber: licenseParts[1] || undefined,
        licenseCategories: undefined, // not stored in user_rental_secrets
        licenseExpiryDate: undefined, // not stored in user_rental_secrets
        verificationStatus: source.verification_status,
        hasVerifiedData: !!verifiedRow,
      },
    };
  } catch {
    return { success: false };
  }
}
