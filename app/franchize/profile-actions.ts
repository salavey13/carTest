"use server";

import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";
import { isCrewMember } from "@/app/lib/user-rental-secrets";
import { logger } from "@/lib/logger";

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
  rentals: Array<{ rentalId: string; status: string; paymentStatus: string; isTestRide: boolean; vehicleId: string; vehicleLabel: string; vehicleImage: string | null; agreedStartDate: string | null; agreedEndDate: string | null; docLink: string }>;
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
  return slug.trim().toLowerCase();
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
  return getCatalogBySlug(slug.trim().toLowerCase());
}

export async function getFranchizeProfileBySlugAction(params: {
  slug: string;
  userId: string;
}): Promise<{ success: boolean; data?: FranchizeProfileState; error?: string; catalog?: FranchizeAchievementDefinition[] }> {
  const slug = params.slug.trim().toLowerCase();
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
  const slug = params.slug.trim().toLowerCase();
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
    .select("rental_id,status,payment_status,vehicle_id,agreed_start_date,agreed_end_date,metadata,vehicle:cars(make,model,image_url)")
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
        vehicleImage: r.vehicle?.image_url || null,
        agreedStartDate: r.agreed_start_date || null,
        agreedEndDate: r.agreed_end_date || null,
        docLink: `/franchize/${params.slug}/rental/${r.rental_id}`,
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
 * Get ALL rentals for a crew — used by /franchize/{slug}/rentals page.
 * Accessible via password auth (operators) or TG auth (crew members/owners).
 */
export async function getFranchizeCrewRentalsListAction(params: {
  slug: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
  /** When true, filter by the actorUserId (only return rentals created by this user) */
  myOnly?: boolean;
}): Promise<{
  success: boolean;
  data?: FranchizeActivityDigest["rentals"];
  error?: string;
}> {
  try {
    const { slug, actorUserId, isPasswordAuth = false, myOnly = false } = params;

    // Get crew
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (!crew) return { success: false, error: "Экипаж не найден." };

    // Password auth: full access
    if (!isPasswordAuth) {
      // TG auth: check permissions
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("metadata, username")
        .eq("user_id", actorUserId)
        .maybeSingle();

      const userMetadata = user?.metadata as Record<string, unknown> | null;
      const userUsername = user?.username as string | null;
      const isAdmin = userMetadata?.role === "admin";
      const isOwner = crew.owner_id === actorUserId;
      const isOrudjov = userUsername?.toLowerCase().includes("orud");

      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (!isOwner && !isAdmin && !isOrudjov && !crewMember) {
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
    }

    // Fetch rentals for the crew's vehicles
    let query = supabaseAdmin
      .from("rentals")
      .select("rental_id,status,payment_status,vehicle_id,agreed_start_date,agreed_end_date,created_at,metadata,user_id,vehicle:cars!inner(id,make,model,crew_id,image_url)")
      .eq("vehicle.crew_id", crew.id);

    // "Мои аренды" — filter by the current Telegram user (not password auth)
    if (myOnly && actorUserId && !isPasswordAuth) {
      query = query.eq("user_id", actorUserId);
    }

    const { data: rentals } = await query
      .order("created_at", { ascending: false })
      .limit(50);

    const now = Date.now();
    const RENTAL_END_GRACE_MS = 24 * 60 * 60 * 1000; // 24h grace (matches actions-runtime.ts)
    const result = (rentals || []).map((r: any) => {
      // Date-aware status: if agreed_end_date is past (plus 24h grace) and status
      // is "active"/"confirmed", override to "expired" so the UI doesn't show past
      // rentals as active. The grace period absorbs the bare-date-as-midnight quirk
      // and timezone fuzz between client entry and server interpretation.
      const agreedEndTs = r.agreed_end_date ? Date.parse(r.agreed_end_date) : Number.NaN;
      let effectiveStatus = r.status || "unknown";
      if ((effectiveStatus === "active" || effectiveStatus === "confirmed") && !Number.isNaN(agreedEndTs) && (agreedEndTs + RENTAL_END_GRACE_MS < now)) {
        effectiveStatus = "expired";
      }

      return {
        rentalId: r.rental_id,
        status: effectiveStatus,
        paymentStatus: r.payment_status || "",
        isTestRide: r.metadata?.flowType === "sale" || r.payment_status === "interest_paid",
        vehicleId: r.vehicle_id || "",
        vehicleLabel: `${r.vehicle?.make || "Bike"} ${r.vehicle?.model || ""}`.trim(),
        vehicleImage: r.vehicle?.image_url || null,
        agreedStartDate: r.agreed_start_date || null,
        agreedEndDate: r.agreed_end_date || null,
        docLink: `/franchize/${slug}/rental/${r.rental_id}`,
      };
    });

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
      birthDate: string;
      licenseExpiryDate: string;
      licenseCategories: string;
    };
  };
  error?: string;
}> {
  try {
    // SECURITY: crew members/operators must never load renter data as their own.
    // When an operator creates a contract via /doc, the secret is saved with
    // chat_id=NULL (or historically with the operator's chat_id as a placeholder).
    // Only the operator's own profile_prefill (source_doc_key='profile_prefill')
    // should be returned to them.
    const userIsCrewMember = await isCrewMember(params.userId, params.slug);

    // 1. Check user_rental_secrets (claimed secrets via QR, always has data)
    let secretsQuery = privateSchema()
      .from("user_rental_secrets")
      .select("renter_full_name,renter_phone,renter_passport,renter_driver_license,renter_birth_date,license_expiry_date,license_categories,created_at,source_doc_key")
      .eq("chat_id", params.userId)
      .eq("crew_slug", params.slug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1);

    if (userIsCrewMember) {
      secretsQuery = secretsQuery.eq("source_doc_key", "profile_prefill");
    }

    const { data: rentalSecret, error: secretError } = await secretsQuery.maybeSingle();

    if (secretError && secretError.code !== "PGRST116") {
      return { success: false, error: secretError.message };
    }

    // 2. Fallback to rental_contract_artifacts (if no claimed secret)
    // Crew members are NOT allowed to fallback to artifacts — those rows may
    // contain renter data keyed under the operator's telegram_chat_id.
    if (!rentalSecret && !userIsCrewMember) {
      const { data: artifact } = await privateSchema()
        .from("rental_contract_artifacts")
        .select("renter_full_name,renter_phone,renter_passport,renter_driver_license,renter_birth_date,license_categories,license_expiry_date,created_at")
        .eq("telegram_chat_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!artifact) {
        return {
          success: true,
          data: {
            hasPreviousRentals: false,
            savedData: {
              fullName: "", phone: "", passport: "",
              driverLicense: "", birthDate: "",
              licenseExpiryDate: "", licenseCategories: "",
            },
          },
        };
      }

      return {
        success: true,
        data: {
          hasPreviousRentals: true,
          lastRentalDate: artifact.created_at ? new Date(artifact.created_at).toISOString().split("T")[0] : undefined,
          savedData: {
            fullName: artifact.renter_full_name || "",
            phone: artifact.renter_phone || "",
            passport: artifact.renter_passport || "",
            driverLicense: artifact.renter_driver_license || "",
            birthDate: artifact.renter_birth_date || "",
            licenseExpiryDate: artifact.license_expiry_date || "",
            licenseCategories: artifact.license_categories || "",
          },
        },
      };
    }

    return {
      success: true,
      data: {
        hasPreviousRentals: true,
        lastRentalDate: rentalSecret.created_at ? new Date(rentalSecret.created_at).toISOString().split("T")[0] : undefined,
        savedData: {
          fullName: rentalSecret.renter_full_name || "",
          phone: rentalSecret.renter_phone || "",
          passport: rentalSecret.renter_passport || "",
          driverLicense: rentalSecret.renter_driver_license || "",
          birthDate: rentalSecret.renter_birth_date || "",
          licenseExpiryDate: rentalSecret.license_expiry_date || "",
          licenseCategories: rentalSecret.license_categories || "",
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

    // 2. Compute real SHA-256 hash as doc_sha256
    //    For prefill records (no actual DOCX), hash the identifier string.
    //    This gives a valid 64-char hex hash that won't collide with
    //    operator-created records (those hash the actual contract file).
    const hashInput = `profile_prefill_${chatId}_${params.slug}`;
    const docSha256 = createHash("sha256").update(hashInput).digest("hex");

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
      license_categories: params.licenseCategories ?? null,
      license_expiry_date: params.licenseExpiryDate ?? null,
      source_doc_key: "profile_prefill",
      verification_status: "pending" as const,
      template_version: 1,
    };

    // Check if a prefill row already exists (by source_doc_key, not by hash)
    const { data: existing } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", chatId)
      .eq("crew_slug", params.slug)
      .eq("source_doc_key", "profile_prefill")
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
        license_categories: upsertData.license_categories ?? existing.license_categories,
        license_expiry_date: upsertData.license_expiry_date ?? existing.license_expiry_date,
        renter_birth_date: upsertData.renter_birth_date ?? existing.renter_birth_date,
        renter_phone: upsertData.renter_phone ?? existing.renter_phone,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await privateSchema()
        .from("user_rental_secrets")
        .update(merged)
        .eq("chat_id", chatId)
        .eq("crew_slug", params.slug)
        .eq("source_doc_key", "profile_prefill");

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

    // ── Sync fullName + phone to franchizeFormPrefill ────────────────────────
    // This ensures that the "Данные для заявок" prefill (used by the order
    // page for recipient name + contact phone) always matches the rental
    // docs the user just entered. Without this sync, the user could enter
    // their name in the RentalDocsForm on the profile page and still see
    // empty recipient/phone fields on the order page if they never filled
    // the "Данные для заявок" section separately.
    if (params.fullName || params.phone) {
      try {
        const { data: freshUser } = await supabaseAdmin
          .from("users")
          .select("metadata")
          .eq("user_id", params.userId)
          .maybeSingle();

        const freshMeta = ((freshUser?.metadata || {}) as Record<string, any>) || {};
        const existingPrefill = (freshMeta.franchizeFormPrefill?.[params.slug] ?? freshMeta.franchizeFormPrefill?.default ?? {}) as Record<string, unknown>;
        const mergedPrefill: FranchizeFormPrefill = {
          fullName: (params.fullName ?? (typeof existingPrefill.fullName === "string" ? existingPrefill.fullName : "")) ?? "",
          phone: (params.phone ?? (typeof existingPrefill.phone === "string" ? existingPrefill.phone : "")) ?? "",
          preferredTime: (typeof existingPrefill.preferredTime === "string" ? existingPrefill.preferredTime : "") ?? "",
          deliveryMode: (existingPrefill.deliveryMode === "delivery" ? "delivery" : "pickup"),
          comment: (typeof existingPrefill.comment === "string" ? existingPrefill.comment : "") ?? "",
        };
        const syncedMetadata = {
          ...freshMeta,
          franchizeFormPrefill: {
            ...(freshMeta.franchizeFormPrefill || {}),
            [params.slug]: mergedPrefill,
          },
        };
        await supabaseAdmin
          .from("users")
          .update({ metadata: syncedMetadata, updated_at: new Date().toISOString() })
          .eq("user_id", params.userId);
      } catch (syncErr) {
        // Non-fatal — best-effort sync to avoid blocking the rental docs save
        logger.warn("[saveRentalDocsPrefill] prefill sync failed:", syncErr);
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
 * Auto-verify user's self-entered docs if they have completed rentals.
 *
 * Checks two sources:
 *   1. private.rental_contract_artifacts WHERE telegram_chat_id = chatId
 *   2. public.rentals WHERE user_id = chatId
 *
 * If either has at least one row, upgrades the prefill record from
 * "pending" → "verified" and copies authoritative data from the
 * most recent artifact (operator-verified data beats self-entered).
 *
 * Returns true if verification was performed (or was already verified).
 */
export async function tryVerifyUserRentalDocs(chatId: string, crewSlug: string): Promise<boolean> {
  try {
    // SECURITY: crew members must not auto-verify their prefill using renter data.
    // Rental_contract_artifacts keyed under an operator's telegram_chat_id contain
    // the renter's personal data, not the operator's.
    const userIsCrewMember = await isCrewMember(chatId, crewSlug);
    if (userIsCrewMember) return false;

    // 1. Check private.rental_contract_artifacts for contracts created for this user
    const { data: artifact } = await privateSchema()
      .from("rental_contract_artifacts")
      .select("renter_full_name, renter_passport, renter_passport_issued_by, renter_passport_issue_date, renter_registration, renter_driver_license, renter_birth_date, license_categories, created_at")
      .eq("telegram_chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 2. Check public.rentals for rental records
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("rental_id")
      .eq("user_id", chatId)
      .limit(1)
      .maybeSingle();

    const hasContract = !!artifact;
    const hasRental = !!rental;

    if (!hasContract && !hasRental) return false;

    // 3. Find the prefill record (by source_doc_key, not by fake hash)
    const { data: prefillRow } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", chatId)
      .eq("crew_slug", crewSlug)
      .eq("source_doc_key", "profile_prefill")
      .maybeSingle();

    if (!prefillRow) return false;
    if (prefillRow.verification_status === "verified") return true;

    // 4. Upgrade to verified, enriching with authoritative data from artifact
    const updateData: Record<string, unknown> = {
      verification_status: "verified",
      updated_at: new Date().toISOString(),
    };

    // If we have a contract artifact, copy its data (operator-verified beats self-entered)
    if (artifact) {
      if (artifact.renter_full_name) updateData.renter_full_name = artifact.renter_full_name;
      if (artifact.renter_passport) updateData.renter_passport = artifact.renter_passport;
      if (artifact.renter_passport_issued_by) updateData.renter_passport_issued_by = artifact.renter_passport_issued_by;
      if (artifact.renter_passport_issue_date) updateData.renter_passport_issue_date = artifact.renter_passport_issue_date;
      if (artifact.renter_registration) updateData.renter_registration = artifact.renter_registration;
      if (artifact.renter_driver_license) updateData.renter_driver_license = artifact.renter_driver_license;
      if (artifact.renter_birth_date) updateData.renter_birth_date = artifact.renter_birth_date;
      if (artifact.license_categories) updateData.license_categories = artifact.license_categories;
      if (artifact.license_expiry_date) updateData.license_expiry_date = artifact.license_expiry_date;
    }

    const { error: updateError } = await privateSchema()
      .from("user_rental_secrets")
      .update(updateData)
      .eq("chat_id", chatId)
      .eq("crew_slug", crewSlug)
      .eq("source_doc_key", "profile_prefill")
      .eq("verification_status", "pending"); // only upgrade pending → verified

    if (updateError) {
      console.error("[tryVerifyUserRentalDocs] update failed:", updateError);
      return false;
    }

    console.log("[tryVerifyUserRentalDocs] upgraded prefill to verified", {
      chatId, crewSlug, hasContract, hasRental,
    });
    return true;
  } catch (error) {
    console.error("[tryVerifyUserRentalDocs] exception:", error);
    return false;
  }
}

/**
 * Get profile document photos status (passport, license).
 * Checks private.user_rental_secrets for profile_${userId} rental_id.
 */
export async function getProfileDocsStatusAction(params: {
  userId: string;
  slug: string;
}): Promise<{
  success: boolean;
  data?: {
    passportMainpage: { uploaded: boolean; verified: boolean };
    passportRegistration: { uploaded: boolean; verified: boolean };
    driversLicence: { uploaded: boolean; verified: boolean };
  };
}> {
  try {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("user_id", params.userId)
      .maybeSingle();

    if (!user) return { success: false };

    const chatId = user.user_id;
    const profileRentalId = `profile_${chatId}`;

    // Check user_rental_secrets for profile documents
    const { data: profileSecrets } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("source_rental_id", profileRentalId)
      .maybeSingle();

    const status = {
      passportMainpage: {
        uploaded: Boolean(profileSecrets?.passport_mainpage_photo),
        verified: profileSecrets?.verification_status === "verified" && Boolean(profileSecrets?.passport_mainpage_photo),
      },
      passportRegistration: {
        uploaded: Boolean(profileSecrets?.passport_registration_photo),
        verified: profileSecrets?.verification_status === "verified" && Boolean(profileSecrets?.passport_registration_photo),
      },
      driversLicence: {
        uploaded: Boolean(profileSecrets?.drivers_licence_frontal_photo),
        verified: profileSecrets?.verification_status === "verified" && Boolean(profileSecrets?.drivers_licence_frontal_photo),
      },
    };

    return { success: true, data: status };
  } catch (error) {
    console.error("[getProfileDocsStatusAction] error:", error);
    return { success: false };
  }
}

/**
 * Get user-entered passport/license data for pre-fill.
 * Reads from private.user_rental_secrets WHERE source_doc_key = "profile_prefill".
 *
 * Also auto-verifies: if the user has completed rentals (in rental_contract_artifacts
 * or public.rentals), their prefill record is upgraded from "pending" to "verified"
 * and enriched with operator-verified data.
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
    const docSha256 = createHash("sha256")
      .update(`profile_prefill_${chatId}_${params.slug}`)
      .digest("hex");

    // SECURITY: crew members must not load renter data keyed under their chat_id.
    const userIsCrewMember = await isCrewMember(chatId, params.slug);

    // 2. Auto-verify: check if user has completed rentals
    //    If yes, upgrade prefill from "pending" to "verified" with authoritative data.
    //    Skipped for crew members — rental_contract_artifacts keyed under their
    //    telegram_chat_id contain renter data, not their own.
    if (!userIsCrewMember) {
      await tryVerifyUserRentalDocs(chatId, params.slug);
    }

    // 3. Try to get the (now possibly verified) prefill record
    const { data: prefillRow } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("doc_sha256", docSha256)
      .maybeSingle();

    // 4. Also check for other verified data from previous rentals
    //    (separate rows created by operator during contract generation)
    //    Skipped for crew members — those rows contain renter data, not their own.
    let verifiedRow: any = null;
    if (!userIsCrewMember) {
      const { data: foundVerified } = await privateSchema()
        .from("user_rental_secrets")
        .select("*")
        .eq("chat_id", chatId)
        .eq("crew_slug", params.slug)
        .eq("verification_status", "verified")
        .neq("doc_sha256", docSha256) // exclude the prefill row (already fetched above)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      verifiedRow = foundVerified;
    }

    // 5. Merge: prefer verified data from either source
    const prefillVerified = prefillRow?.verification_status === "verified";
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
        licenseCategories: source.license_categories || undefined,
        licenseExpiryDate: source.license_expiry_date || undefined,
        verificationStatus: source.verification_status,
        hasVerifiedData: prefillVerified || !!verifiedRow,
      },
    };
  } catch {
    return { success: false };
  }
}

/**
 * Get latest rental data with source tracking for pre-fill indicators.
 * Returns data from the most recent verified rental with source metadata.
 */
export async function getLatestRentalDataWithSource(params: {
  userId: string;
  slug: string;
}): Promise<{
  success: boolean;
  data?: {
    hasData: boolean;
    source: "previous_rental" | "ocr" | "profile_prefill" | null;
    lastRentalDate?: string;
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
    hasLicense?: boolean;
    // Per-field source tracking
    fieldSources?: Record<string, "previous_rental" | "ocr" | "profile_prefill">;
  };
}> {
  try {
    const userIsCrewMember = await isCrewMember(params.userId, params.slug);

    // Query for the most recent verified rental data
    let query = privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("chat_id", params.userId)
      .eq("crew_slug", params.slug)
      .eq("verification_status", "verified")
      .order("created_at", { ascending: false })
      .limit(1);

    if (userIsCrewMember) {
      query = query.eq("source_doc_key", "profile_prefill");
    }

    const { data: latestSecret, error } = await query.maybeSingle();

    if (error && error.code !== "PGRST116") {
      return { success: false };
    }

    if (!latestSecret) {
      return {
        success: true,
        data: {
          hasData: false,
          source: null,
        },
      };
    }

    // Determine source based on source_doc_key and metadata
    let source: "previous_rental" | "ocr" | "profile_prefill" = "previous_rental";
    if (latestSecret.source_doc_key === "profile_prefill") {
      source = "profile_prefill";
    } else if (latestSecret.source_doc_key?.startsWith("ocr_") || latestSecret.metadata?.ocr_provider) {
      source = "ocr";
    }

    // Parse passport and license strings
    const passportParts = (latestSecret.renter_passport || "").trim().split(/\s+/);
    const licenseParts = (latestSecret.renter_driver_license || "").trim().split(/\s+/);

    const hasLicense = !!(licenseParts[0] || licenseParts[1] || latestSecret.license_categories);

    // Build field-level source tracking
    const fieldSources: Record<string, "previous_rental" | "ocr" | "profile_prefill"> = {};
    const fields = [
      "fullName", "phone", "birthDate", "passportSeries", "passportNumber",
      "passportIssuedBy", "passportIssueDate", "registrationAddress",
      "licenseSeries", "licenseNumber", "licenseCategories", "licenseExpiryDate"
    ];
    fields.forEach(field => {
      fieldSources[field] = source;
    });

    return {
      success: true,
      data: {
        hasData: true,
        source,
        lastRentalDate: latestSecret.created_at
          ? new Date(latestSecret.created_at).toISOString().split("T")[0]
          : undefined,
        fullName: latestSecret.renter_full_name || undefined,
        phone: latestSecret.renter_phone || undefined,
        birthDate: latestSecret.renter_birth_date || undefined,
        passportSeries: passportParts[0] || undefined,
        passportNumber: passportParts[1] || undefined,
        passportIssuedBy: latestSecret.renter_passport_issued_by || undefined,
        passportIssueDate: latestSecret.renter_passport_issue_date || undefined,
        registrationAddress: latestSecret.renter_registration || undefined,
        licenseSeries: licenseParts[0] || undefined,
        licenseNumber: licenseParts[1] || undefined,
        licenseCategories: latestSecret.license_categories || undefined,
        licenseExpiryDate: latestSecret.license_expiry_date || undefined,
        hasLicense,
        fieldSources,
      },
    };
  } catch {
    return { success: false };
  }
}
