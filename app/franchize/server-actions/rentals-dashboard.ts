"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RentalDashboardItem {
  rental_id: string;
  user_id: string;
  vehicle_id: string;
  status: string;
  payment_status: string | null;
  total_cost: number | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  requested_start_date: string | null;
  requested_end_date: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
  vehicle: {
    id: string;
    make: string;
    model: string;
    crew_id: string;
    type: string;
    specs?: Record<string, unknown> | null;
  } | null;
  user: {
    user_id: string;
    full_name: string | null;
    username: string | null;
    metadata: Record<string, unknown>;
  } | null;
  // Document secret for QR generation (latest by created_at)
  documentSecret?: {
    doc_sha256: string | null;
    verification_status: string | null;
    renter_full_name: string | null;
    source_rental_id: string | null;
    created_at?: string; // Timestamp for deduplication
    // QR status tracking fields
    chat_id?: string | null;  // Initially crew_owner_id, changes to renter_user_id when claimed
    is_web_app_flow?: boolean | null;
    qr_generated_at?: string | null;
    qr_first_viewed_at?: string | null;
    qr_claimed_at?: string | null;  // Set when renter claims the secret (primary indicator)
    qr_regeneration_count?: number | null;
    original_doc_sha256?: string | null;
  } | null;
  // Handoff data from rental_handoffs table
  odometerStart?: number | null;
  odometerEnd?: number | null;
  handoutCompleted?: boolean;
  returnCompleted?: boolean;
}

export interface RentalDashboardSummary {
  totalCount: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
}

export interface RentalDashboardResult {
  items: RentalDashboardItem[];
  summary: RentalDashboardSummary;
  selectedDate: string;
}

// ─── Sales Dashboard Types ───────────────────────────────────────────────────────

export interface SaleDashboardItem {
  id: string;
  contract_key: string;
  buyer_full_name: string | null;
  buyer_passport_number: string | null;
  buyer_email: string | null;
  sale_price: string | null;
  price_words: string | null;
  warranty_months: string | null;
  created_at: string;
  vehicle: {
    id: string;
    make: string;
    model: string;
    crew_id: string;
    type: string;
  } | null;
}

export interface SaleDashboardSummary {
  totalCount: number;
  totalRevenue: number;
}

export interface SalesDashboardResult {
  items: SaleDashboardItem[];
  summary: SaleDashboardSummary;
  selectedDate: string;
}

export interface RentalDocumentDetail {
  secret: {
    id: string;
    renter_full_name: string | null;
    renter_passport: string | null;
    renter_passport_issue_date: string | null;
    renter_registration: string | null;
    renter_driver_license: string | null;
    renter_birth_date: string | null;
    renter_phone: string | null;
    renter_email: string | null;
    renter_address: string | null;
    verification_status: string;
    doc_sha256: string;
    source_rental_id: string | null;
    created_at: string;
  } | null;
  contractVerifier: {
    status: string;
    originalSha256: string | null;
    verifiedAt: string | null;
  } | null;
}

// ─── Private Schema Helper ─────────────────────────────────────────────────────

type SupabaseSchemaClient = {
  schema: (schema: string) => {
    from: (table: string) => any;
  };
};

function privateSchema() {
  return (supabaseAdmin as unknown as SupabaseSchemaClient).schema("private");
}

// ─── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Get rentals dashboard data for a specific crew and date.
 * Returns rentals + summary statistics.
 */
export async function getRentalsDashboard(input: {
  slug: string;
  actorUserId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  verificationStatus?: "verified" | "pending" | "revoked" | "all";
  isPasswordAuth?: boolean; // Flag to indicate password-based auth (no Telegram user)
}): Promise<{ success: boolean; data?: RentalDashboardResult; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      verificationStatus: z.enum(["verified", "pending", "revoked", "all"]).optional(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, date, verificationStatus, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      console.error("[rentals-dashboard] Crew not found for slug:", slug);
      return { success: false, error: "Экипаж не найден." };
    }

    console.log("[rentals-dashboard] Auth check:", {
      actorUserId,
      isPasswordAuth,
      crewOwnerId: crew.owner_id,
      slug,
    });

    if (isPasswordAuth) {
      // Password auth grants full access - skip user checks
      // Fall through to data loading
    } else {
      // Telegram auth: check user roles and username
      // Fetch user data for permission checks
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("metadata, username")
        .eq("user_id", actorUserId)
        .maybeSingle();

      const userMetadata = user?.metadata as Record<string, unknown> | null;
      const userUsername = user?.username as string | null;
      const isAdmin = userMetadata?.role === "admin";
      const isOwner = crew.owner_id === actorUserId;
      // Special case: orudjov (and variations) always have access
      const isOrudjov = userUsername?.toLowerCase().includes("orud");

      // Check if user is a crew member
      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      const isCrewMember = !!crewMember;

      if (!isOwner && !isAdmin && !isOrudjov && !isCrewMember) {
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
    }

    // Parse date boundaries for the selected day (UTC to avoid timezone issues)
    const startOfDay = new Date(`${date}T00:00:00.000Z`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59.999Z`).toISOString();

    // Query rentals for the day
    // FIX: Previously filtered only by created_at BETWEEN startOfDay/endOfDay,
    // which hid rentals created on a different day (e.g. booked Monday for Friday).
    // Now uses OR logic: a rental shows up on the selected day if EITHER:
    //   1. It was created on that day (new booking), OR
    //   2. Its rental period overlaps that day (active rental)
    // We fetch by both conditions and dedupe by rental_id since Supabase REST
    // doesn't support SQL OR across different columns.
    console.log("[rentals-dashboard] Querying rentals for crew:", crew.id, "date:", date, "range:", { startOfDay, endOfDay });

    const baseSelect = `
      rental_id,
      user_id,
      vehicle_id,
      status,
      payment_status,
      total_cost,
      agreed_start_date,
      agreed_end_date,
      requested_start_date,
      requested_end_date,
      created_at,
      metadata,
      vehicle:cars!inner(id, make, model, crew_id, type, specs),
      user:users!rentals_user_id_fkey(user_id, full_name, username, metadata)
    `;

    // Query 1: rentals created today
    const [createdTodayResult, periodOverlappingResult] = await Promise.all([
      supabaseAdmin
        .from("rentals")
        .select(baseSelect)
        .eq("vehicle.crew_id", crew.id)
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .order("created_at", { ascending: false }),
      // Query 2: rentals whose PERIOD overlaps the selected day
      // (start <= endOfDay AND end >= startOfDay)
      supabaseAdmin
        .from("rentals")
        .select(baseSelect)
        .eq("vehicle.crew_id", crew.id)
        .lte("requested_start_date", endOfDay)
        .gte("requested_end_date", startOfDay)
        .order("created_at", { ascending: false }),
    ]);

    // Merge + dedupe by rental_id (period rentals win over created-today
    // because they're more relevant to the selected day)
    const rentalMap = new Map<string, any>();
    for (const r of (createdTodayResult.data || []) as any[]) {
      rentalMap.set(r.rental_id, r);
    }
    for (const r of (periodOverlappingResult.data || []) as any[]) {
      rentalMap.set(r.rental_id, r);
    }
    const rentals = Array.from(rentalMap.values());
    const rentalsError = createdTodayResult.error || periodOverlappingResult.error;

    if (rentalsError) {
      console.error("[rentals-dashboard] Query error:", rentalsError);
      return { success: false, error: rentalsError.message };
    }

    console.log("[rentals-dashboard] Found rentals:", rentals?.length || 0);

    // DEDUPLICATION: Handle multiple rental generations for same transaction
    // When user re-uploads documents (same date, same bike, same dude), a NEW rental_id
    // is created each time. We keep only the LATEST rental for each (user_id + vehicle_id).
    // Results are already ordered by created_at DESC, so first occurrence is the latest.
    const seenUserVehiclePairs = new Set<string>();
    let items: RentalDashboardItem[] = [];
    for (const rental of (rentals || []) as RentalDashboardItem[]) {
      const dedupeKey = `${rental.user_id}::${rental.vehicle_id}`;
      if (!seenUserVehiclePairs.has(dedupeKey)) {
        seenUserVehiclePairs.add(dedupeKey);
        items.push({ ...rental, documentSecret: null });
      }
      // Skip duplicate (user, vehicle) pairs - older rental generations
    }

    // Filter by verification status if specified - DEDUPLICATED per rental
    // Uses same dedupe logic: only latest document (by created_at) counts
    if (verificationStatus && verificationStatus !== "all") {
      const rentalIds = items.map(r => r.rental_id);
      if (rentalIds.length > 0) {
        // Get all document secrets for these rentals, ordered by created_at DESC
        const { data: secrets } = await privateSchema()
          .from("user_rental_secrets")
          .select("source_rental_id, verification_status, created_at")
          .in("source_rental_id", rentalIds)
          .order("created_at", { ascending: false });

        // Dedupe: only latest verification_status per rental counts
        const latestStatusByRental = new Map<string, string>();
        const seenRentals = new Set<string>();
        for (const secret of secrets || []) {
          const rentalId = secret.source_rental_id || "";
          // Only add if we haven't seen this rental yet (latest document wins)
          if (!seenRentals.has(rentalId)) {
            seenRentals.add(rentalId);
            latestStatusByRental.set(rentalId, secret.verification_status);
          }
        }

        items = items.filter(item => {
          const itemStatus = latestStatusByRental.get(item.rental_id);
          return itemStatus === verificationStatus;
        });
      }
    }

    // Enrich items with document secrets (for QR codes) - DEDUPLICATED per rental
    // Multiple document uploads can occur for same rental (same date, same bike, same dude)
    // We keep ONLY the latest version by created_at for each unique source_rental_id
    const rentalIds = items.map(r => r.rental_id);
    const secretsByRentalId = new Map<string, RentalDashboardItem["documentSecret"]>();

    if (rentalIds.length > 0) {
      // Fetch all secrets ordered by created_at DESC (newest first)
      const { data: secrets } = await privateSchema()
        .from("user_rental_secrets")
        .select("source_rental_id, doc_sha256, verification_status, renter_full_name, renter_passport, created_at, chat_id, is_web_app_flow, qr_generated_at, qr_first_viewed_at, qr_claimed_at, qr_regeneration_count, original_doc_sha256")
        .in("source_rental_id", rentalIds)
        .order("created_at", { ascending: false });

      // Dedupe: keep only first (latest) secret for each source_rental_id
      // Since results are ordered by created_at DESC, first occurrence is the latest
      const seenRentals = new Set<string>();
      for (const secret of secrets || []) {
        const rentalId = secret.source_rental_id || "";
        // Only set if we haven't seen this rental yet (latest document wins)
        if (!seenRentals.has(rentalId)) {
          seenRentals.add(rentalId);
          secretsByRentalId.set(rentalId, {
            doc_sha256: secret.doc_sha256,
            verification_status: secret.verification_status,
            renter_full_name: secret.renter_full_name,
            source_rental_id: secret.source_rental_id,
            created_at: secret.created_at,
            chat_id: secret.chat_id,
            is_web_app_flow: secret.is_web_app_flow,
            qr_generated_at: secret.qr_generated_at,
            qr_first_viewed_at: secret.qr_first_viewed_at,
            qr_claimed_at: secret.qr_claimed_at,
            qr_regeneration_count: secret.qr_regeneration_count,
            original_doc_sha256: secret.original_doc_sha256,
          } as RentalDashboardItem["documentSecret"] & { created_at: string });
        }
      }
    }

    // Attach document secrets to items
    items = items.map(item => ({
      ...item,
      documentSecret: secretsByRentalId.get(item.rental_id),
    }));

    // Enrich items with handoff data (odometer, equipment, etc.)
    // Use PostgreSQL function for efficient batch lookup
    if (rentalIds.length > 0) {
      const { data: handoffs } = await supabaseAdmin.rpc("get_rental_handoff_summary", {
        p_rental_id: null,  // We'll fetch per rental below
      });

      // For each rental, fetch its handoff summary
      const handoffDataByRental = new Map<string, {
        odometerStart: number | null;
        odometerEnd: number | null;
        handoutCompleted: boolean;
        returnCompleted: boolean;
      }>();

      // Batch fetch handoffs for all rentals
      const { data: allHandoffs } = await supabaseAdmin
        .from("rental_handoffs")
        .select("rental_id, phase, odometer_start, odometer_end, completed_at")
        .in("rental_id", rentalIds);

      for (const handoff of allHandoffs || []) {
        const existing = handoffDataByRental.get(handoff.rental_id) || {
          odometerStart: null,
          odometerEnd: null,
          handoutCompleted: false,
          returnCompleted: false,
        };

        if (handoff.phase === "handout") {
          existing.odometerStart = handoff.odometer_start;
          existing.handoutCompleted = !!handoff.completed_at;
        } else if (handoff.phase === "return") {
          existing.odometerEnd = handoff.odometer_end;
          existing.returnCompleted = !!handoff.completed_at;
        }

        handoffDataByRental.set(handoff.rental_id, existing);
      }

      // Merge handoff data into items
      items = items.map(item => {
        const handoff = handoffDataByRental.get(item.rental_id);
        return {
          ...item,
          odometerStart: handoff?.odometerStart ?? null,
          odometerEnd: handoff?.odometerEnd ?? null,
          handoutCompleted: handoff?.handoutCompleted ?? false,
          returnCompleted: handoff?.returnCompleted ?? false,
        };
      });
    }

    // Calculate summary statistics
    const summary: RentalDashboardSummary = {
      totalCount: items.length,
      totalRevenue: items.reduce((sum, r) => sum + (r.total_cost || 0), 0),
      byStatus: {},
      byPaymentStatus: {},
    };

    // Count by status
    for (const item of items) {
      const status = item.status || "unknown";
      summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;

      const paymentStatus = item.payment_status || "unknown";
      summary.byPaymentStatus[paymentStatus] = (summary.byPaymentStatus[paymentStatus] || 0) + 1;
    }

    console.log("[rentals-dashboard] Returning result:", {
      itemsCount: items.length,
      summary: { totalCount: summary.totalCount, totalRevenue: summary.totalRevenue },
      selectedDate: date,
    });

    return {
      success: true,
      data: {
        items,
        summary,
        selectedDate: date,
      },
    };
  } catch (error) {
    console.error("[rentals-dashboard] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get sales dashboard data for a specific crew and date.
 * Returns sales + summary statistics from private.sale_contract_artifacts.
 */
export async function getSalesDashboard(input: {
  slug: string;
  actorUserId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: SalesDashboardResult; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, date, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      console.error("[sales-dashboard] Crew not found for slug:", slug);
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check (same logic as rentals)
    if (!isPasswordAuth) {
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

      // Check if user is a crew member
      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      const isCrewMember = !!crewMember;

      if (!isOwner && !isAdmin && !isOrudjov && !isCrewMember) {
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
    }

    // Parse date boundaries for the selected day (UTC)
    const startOfDay = new Date(`${date}T00:00:00.000Z`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59.999Z`).toISOString();

    // Pre-fetch this crew's bike IDs for filtering
    const { data: crewBikes } = await supabaseAdmin
      .from("cars")
      .select("id")
      .eq("crew_id", crew.id);
    const crewBikeIds = (crewBikes || []).map(b => b.id);

    // Query sales from private.sale_contract_artifacts (crew-filtered by resolved_bike_id)
    const { data: sales, error: salesError } = await privateSchema()
      .from("sale_contract_artifacts")
      .select(`
        id,
        contract_key,
        buyer_full_name,
        buyer_passport_number,
        buyer_email,
        sale_price,
        price_words,
        warranty_months,
        created_at,
        resolved_bike_id
      `)
      .in("resolved_bike_id", crewBikeIds.length ? crewBikeIds : ["__none__"])
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });

    if (salesError) {
      console.error("[sales-dashboard] Query error:", salesError);
      return { success: false, error: salesError.message };
    }

    // Fetch bike details for all sales
    const bikeIds = (sales || []).map(s => s.resolved_bike_id).filter(Boolean) as string[];
    const bikeDetailsBy_id = new Map<string, { id: string; make: string; model: string; crew_id: string; type: string }>();

    if (bikeIds.length > 0) {
      const { data: bikes } = await supabaseAdmin
        .from("cars")
        .select("id, make, model, crew_id, type")
        .in("id", bikeIds);

      for (const bike of bikes || []) {
        bikeDetailsBy_id.set(bike.id, bike);
      }
    }

    // DEDUPLICATION: Handle multiple sales for same transaction
    // Same buyer, same bike = same transaction, keep latest by created_at
    const seenBuyerBikePairs = new Set<string>();
    let items: SaleDashboardItem[] = [];

    for (const sale of sales || []) {
      const bikeId = sale.resolved_bike_id || "";
      const bike = bikeDetailsBy_id.get(bikeId);

      // Dedupe key: buyer_name + bike_id (using buyer_full_name as identifier)
      const dedupeKey = `${sale.buyer_full_name || "unknown"}::${bikeId}`;
      if (!seenBuyerBikePairs.has(dedupeKey)) {
        seenBuyerBikePairs.add(dedupeKey);
        items.push({
          id: sale.id,
          contract_key: sale.contract_key,
          buyer_full_name: sale.buyer_full_name,
          buyer_passport_number: sale.buyer_passport_number,
          buyer_email: sale.buyer_email,
          sale_price: sale.sale_price,
          price_words: sale.price_words,
          warranty_months: sale.warranty_months,
          created_at: sale.created_at,
          vehicle: bike || null,
        });
      }
    }

    // Calculate summary statistics
    const summary: SaleDashboardSummary = {
      totalCount: items.length,
      totalRevenue: items.reduce((sum, s) => {
        // Parse sale_price (format: "390 000" -> 390000)
        const priceStr = (s.sale_price || "0").replace(/\s/g, "");
        const price = parseInt(priceStr, 10) || 0;
        return sum + price;
      }, 0),
    };

    return {
      success: true,
      data: {
        items,
        summary,
        selectedDate: date,
      },
    };
  } catch (error) {
    console.error("[sales-dashboard] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get rental document details from private.user_rental_secrets.
 * This extracts sensitive rental info for the detailed modal.
 */
export async function getRentalDocumentDetails(input: {
  actorUserId: string;
  rentalId: string;
}): Promise<{ success: boolean; data?: RentalDocumentDetail; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, rentalId } = parsed.data;

    // Verify user has access (admin or crew owner)
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata, role")
      .eq("user_id", actorUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = user?.role === "admin" || userMetadata?.role === "admin";

    // Get rental to verify crew ownership
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select("vehicle:cars!inner(crew_id)")
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (rentalError || !rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    const rentalVehicle = rental.vehicle as { crew_id: string } | null;
    if (!rentalVehicle) {
      return { success: false, error: "Техника не найдена." };
    }

    // Check crew ownership
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", rentalVehicle.crew_id)
      .maybeSingle();

    const isCrewOwner = crew?.owner_id === actorUserId;

    if (!isAdmin && !isCrewOwner) {
      return { success: false, error: "Недостаточно прав для просмотра." };
    }

    // Get rental secret from private.user_rental_secrets by source_rental_id
    const { data: secret, error: secretError } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("source_rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (secretError) {
      console.error("[rental-document-details] Secret query error:", secretError);
    }

    // Get contract verifier info from rental metadata
    const { data: rentalWithMetadata } = await supabaseAdmin
      .from("rentals")
      .select("metadata")
      .eq("rental_id", rentalId)
      .maybeSingle();

    const metadata = rentalWithMetadata?.metadata as Record<string, unknown> | null;
    const contractVerifier = metadata?.contract_verifier as Record<string, unknown> | null;

    const verifierData = contractVerifier ? {
      status: typeof contractVerifier.status === "string" ? contractVerifier.status : "none",
      originalSha256: typeof contractVerifier.originalSha256 === "string" ? contractVerifier.originalSha256 : null,
      verifiedAt: typeof contractVerifier.verifiedAt === "string" ? contractVerifier.verifiedAt : null,
    } : null;

    return {
      success: true,
      data: {
        secret: secret ? {
          id: secret.id,
          renter_full_name: secret.renter_full_name,
          renter_passport: secret.renter_passport,
          renter_passport_issue_date: secret.renter_passport_issue_date,
          renter_registration: secret.renter_registration,
          renter_driver_license: secret.renter_driver_license,
          renter_birth_date: secret.renter_birth_date,
          renter_phone: secret.renter_phone,
          renter_email: secret.renter_email,
          renter_address: secret.renter_address,
          verification_status: secret.verification_status,
          doc_sha256: secret.doc_sha256,
          source_rental_id: secret.source_rental_id,
          created_at: secret.created_at,
        } : null,
        contractVerifier: verifierData,
      },
    };
  } catch (error) {
    console.error("[rental-document-details] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get rentals date range (for date picker min/max).
 * Returns the first and last rental dates for a crew.
 */
export async function getRentalsDateRange(input: {
  slug: string;
  actorUserId: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: { minDate: string; maxDate: string } | null; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, isPasswordAuth = false } = parsed.data;

    // Get crew
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (!crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    console.log("[getRentalsDateRange] Auth check:", {
      actorUserId,
      isPasswordAuth,
      crewOwnerId: crew.owner_id,
      slug,
    });

    if (isPasswordAuth) {
      // Password auth grants full access
    } else {
      // Telegram auth: check permissions
      const isOwner = crew.owner_id === actorUserId;
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("metadata, username")
        .eq("user_id", actorUserId)
        .maybeSingle();

      const userMetadata = user?.metadata as Record<string, unknown> | null;
      const userUsername = user?.username as string | null;
      const isAdmin = userMetadata?.role === "admin";
      const isOrudjov = userUsername?.toLowerCase().includes("orud");

      // Check if user is a crew member
      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      const isCrewMember = !!crewMember;

      if (!isOwner && !isAdmin && !isOrudjov && !isCrewMember) {
        return { success: false, error: "Недостаточно прав." };
      }
    }

    // Get min/max dates
    // First, get all car IDs for this crew
    const { data: crewCars, error: carsError } = await supabaseAdmin
      .from("cars")
      .select("id")
      .eq("crew_id", crew.id);

    if (carsError) {
      console.error("[getRentalsDateRange] Cars query error:", carsError);
      return { success: false, error: carsError.message };
    }

    console.log("[getRentalsDateRange] Found cars:", crewCars?.length || 0);

    if (!crewCars || crewCars.length === 0) {
      return { success: true, data: null };
    }

    const carIds = crewCars.map((c) => c.id);

    // Get min date
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("created_at")
      .in("vehicle_id", carIds)
      .not("created_at", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      console.error("[getRentalsDateRange] Rentals min query error:", error);
      return { success: false, error: error.message };
    }

    console.log("[getRentalsDateRange] Min date data:", data?.length || 0);

    if (!data || data.length === 0) {
      return { success: true, data: null };
    }

    const minDate = new Date(data[0].created_at).toISOString().split("T")[0];

    // Get max date
    const { data: maxData } = await supabaseAdmin
      .from("rentals")
      .select("created_at")
      .in("vehicle_id", carIds)
      .not("created_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const maxDate = maxData && maxData.length > 0
      ? new Date(maxData[0].created_at).toISOString().split("T")[0]
      : minDate;

    console.log("[getRentalsDateRange] Returning:", { minDate, maxDate });

    return {
      success: true,
      data: { minDate, maxDate },
    };
  } catch (error) {
    console.error("[rentals-date-range] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Resend rental contract + QR via forward-telegram API.
 * This action regenerates the contract and forwards it to the specified chat.
 */
export async function resendRentalContract(input: {
  actorUserId: string;
  rentalId: string;
  telegramChatId: string; // Target chat ID to send to
}): Promise<{ success: boolean; data?: { message: string }; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      telegramChatId: z.string().trim().min(1),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, rentalId, telegramChatId } = parsed.data;

    // Verify user has access (admin or crew owner)
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata, role")
      .eq("user_id", actorUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = user?.role === "admin" || userMetadata?.role === "admin";

    // Get rental to verify crew ownership
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id,
        agreed_start_date,
        agreed_end_date,
        total_cost,
        vehicle:cars!inner(id, make, model, specs, type, crew_id),
        user:users!rentals_user_id_fkey(user_id, full_name, username)
      `)
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (rentalError || !rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    // Check crew ownership and get crew metadata for bot username
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id, metadata")
      .eq("id", rental.vehicle?.crew_id || "")
      .maybeSingle();

    const isCrewOwner = crew?.owner_id === actorUserId;

    // Extract crew bot username from metadata
    const crewBotUsername = crew?.metadata?.franchize?.contacts?.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME;
    const botUsername = crewBotUsername || "oneBikePlsBot"; // Fallback for compatibility

    if (!isAdmin && !isCrewOwner) {
      return { success: false, error: "Недостаточно прав для отправки." };
    }

    // Get document secret from private.user_rental_secrets
    const { data: secret } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("source_rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!secret) {
      return { success: false, error: "Документ не найден. Необходимо создать новый договор." };
    }

    // Get vehicle details
    const vehicle = rental.vehicle as any;
    const renter = rental.user as any;
    const secretData = secret as any;

    // Generate new DOCX contract
    const { buildFranchizeDocxFromTemplate } = await import("@/app/franchize/lib/docx-capability");
    const { createHash } = await import("crypto");
    const { readFileSync } = await import("fs");
    const { join } = await import("path");

    const now = new Date();
    const vars: Record<string, string> = {
      contract_number: `${now.getDate()}.${now.getMonth() + 1}/${vehicle.id}`,
      day: String(now.getDate()).padStart(2, "0"),
      month: now.toLocaleString("ru-RU", { month: "long" }),
      month_num: String(now.getMonth() + 1).padStart(2, "0"),
      year: String(now.getFullYear()),
      renter_full_name: secretData.renter_full_name || renter?.full_name || "",
      renter_birth_date: secretData.renter_birth_date || "",
      renter_phone: secretData.renter_phone || "",
      renter_email: secretData.renter_email || "",
      renter_address: secretData.renter_address || secretData.renter_registration || "",
      renter_driver_license: secretData.renter_driver_license || "",
      renter_passport: secretData.renter_passport || "",
      renter_passport_issue_date: secretData.renter_passport_issue_date || "",
      renter_registration: secretData.renter_registration || "",
      bike_make_model: `${vehicle.make || ""} ${vehicle.model || ""}`.trim(),
      bike_make: vehicle.make || "уточняется",
      bike_model: vehicle.model || "уточняется",
      bike_vin: vehicle.specs?.vin || vehicle.specs?.frame || "уточняется",
      bike_category: vehicle.specs?.category || "A/L3",
      rent_start_date: rental.agreed_start_date?.split("T")[0] || now.toISOString().split("T")[0],
      rent_end_date: rental.agreed_end_date?.split("T")[0] || now.toISOString().split("T")[0],
      daily_price_rub: String(rental.total_cost || "10000"),
      deposit_rub: String(vehicle.specs?.deposit_rub || "20000"),
      document_key: secretData.source_doc_key || `rental-${vehicle.id}-${Date.now()}`,
      bike_vehicle_type_label: vehicle.type === "ebike" ? "ЭЛЕКТРОМОТОЦИКЛА" : "МОТОЦИКЛА",
      // Add other required fields...
      bike_plate: vehicle.specs?.plate || "уточняется",
      bike_color: vehicle.specs?.color || "уточняется",
      bike_year: vehicle.specs?.year || "уточняется",
      signature_timestamp: now.toLocaleString("ru-RU"),
      renter_signature: "повторная отправка",
    };

    // Load rental HTML template
    const templatePath = join(process.cwd(), "docs", "RENTAL_DEAL_TEMPLATE.html");
    let htmlTemplate: string;
    try {
      htmlTemplate = readFileSync(templatePath, "utf8");
    } catch (readErr) {
      console.error("[rentals-dashboard] Failed to read rental HTML template", readErr);
      return { success: false, error: "Шаблон договора не найден." };
    }

    const docFileName = `rental-contract-${vehicle.make}-${vehicle.model}-${now.toISOString().split("T")[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    // Generate DOCX via the shared docx-capability pipeline
    const docResult = await buildFranchizeDocxFromTemplate({
      integrationScope: "dashboard-rental-resend",
      uploadedBy: "dashboard",
      documentKey: vars.document_key,
      fileName: docFileName,
      template: htmlTemplate,
      variables: vars,
      flowType: "rental",
      templateMode: "html",
    });

    const docxBuf = docResult.bytes;
    const docSha256 = docResult.sha256;

    // Generate QR code with crew-specific bot username
    const qrDeepLink = `https://t.me/${botUsername}/app?startapp=rent_${vehicle.id}_${docSha256}`;
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff&margin=1`;

    let qrPngBuffer: Buffer | null = null;
    try {
      const qrRes = await fetch(qrPngUrl, { signal: AbortSignal.timeout(8000) });
      if (qrRes.ok) {
        qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
      }
    } catch {}

    // Send via forward-telegram API
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
    const forwardUrl = `${siteUrl}/api/forward-telegram`;

    if (qrPngBuffer) {
      // Send DOCX + QR as media group
      const formData = new FormData();
      formData.append("chat_id", telegramChatId);
      formData.append("method", "sendMediaGroup");

      const mediaItems = [
        { type: "document", media: "attach://docx" },
        { type: "photo", media: "attach://qr", caption: `📲 <b>QR для быстрой аренды</b>\n🔗 ${qrDeepLink}`, parse_mode: "HTML" },
      ];
      formData.append("payload", JSON.stringify({ media: mediaItems }));

      const docxBlob = new Blob([docxBuf], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      formData.append("files", JSON.stringify({
        docx: { data: docxBuf.toString("base64"), filename: docFileName, contentType: docxBlob.type },
        qr: { data: qrPngBuffer.toString("base64"), filename: `qr-${vehicle.id}.png`, contentType: "image/png" },
      }));

      const response = await fetch(forwardUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          method: "sendMediaGroup",
          payload: {
            media: [
              { type: "document", media: "attach://docx", parse_mode: "HTML" },
              { type: "photo", media: "attach://qr", caption: `📲 <b>QR для быстрой аренды</b>\n🔗 ${qrDeepLink}`, parse_mode: "HTML" },
            ],
          },
          files: {
            docx: { data: docxBuf.toString("base64"), filename: docFileName, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
            qr: { data: qrPngBuffer.toString("base64"), filename: `qr-${vehicle.id}.png`, contentType: "image/png" },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[resend-contract] Forward API error:", errorText);
        return { success: false, error: "Не удалось отправить через forward-telegram API." };
      }
    } else {
      // Send DOCX only
      const response = await fetch(forwardUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          method: "sendDocument",
          payload: {
            caption: `Договор аренды: ${vehicle.make} ${vehicle.model}\n\n🔗 Быстрая аренда:\n${qrDeepLink}`,
            parse_mode: "HTML",
          },
          files: {
            document: { data: docxBuf.toString("base64"), filename: docFileName, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[resend-contract] Forward API error:", errorText);
        return { success: false, error: "Не удалось отправить через forward-telegram API." };
      }
    }

    return {
      success: true,
      data: { message: "Договор успешно отправлен." },
    };
  } catch (error) {
    console.error("[resend-contract] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get rentals for Excel export with date range.
 * Returns simplified data suitable for export including rentals, checklist status, and todos.
 */
export async function getRentalsForExport(input: {
  slug: string;
  actorUserId: string;
  startDate?: string; // ISO date string (YYYY-MM-DD) — optional, defaults to today
  endDate?: string; // ISO date string (YYYY-MM-DD) — optional, defaults to today
  date?: string; // Alternative: single date (YYYY-MM-DD), used by RentalsAnalyticsClient
}): Promise<{ success: boolean; data?: Array<{
  // Rental info
  rental_id: string;
  created_at: string;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  requested_start_date: string | null;
  requested_end_date: string | null;
  total_cost: number | null;
  status: string;
  payment_status: string | null;
  // Vehicle info
  vehicle_make: string;
  vehicle_model: string;
  vehicle_type: string;
  // User info
  user_full_name: string | null;
  user_username: string | null;
  // Checklist status
  checklist_status: string;
  checklist_updated_at: string | null;
  // Document verification
  document_verified: boolean;
}> | null; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, startDate, endDate } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    // Check access (owner or admin or password auth or orudjov)
    const isOwner = crew.owner_id === actorUserId;
    const isPasswordAuth = isOwner; // Password auth sets actorUserId to owner_id

    if (isPasswordAuth) {
      // Password auth grants full access
    } else {
      const { data: userRoles } = await supabaseAdmin
        .from("users")
        .select("metadata, username")
        .eq("user_id", actorUserId)
        .maybeSingle();

      const userMetadata = userRoles?.metadata as Record<string, unknown> | null;
      const userUsername = userRoles?.username as string | null;
      const isAdmin = userMetadata?.role === "admin";
      const isOrudjov = userUsername?.toLowerCase().includes("orud");

      if (!isOwner && !isAdmin && !isOrudjov) {
        return { success: false, error: "Недостаточно прав для экспорта." };
      }
    }

    // Parse date boundaries (UTC to avoid timezone issues)
    const startOfDay = new Date(`${startDate}T00:00:00.000Z`).toISOString();
    const endOfDay = new Date(`${endDate}T23:59:59.999Z`).toISOString();

    // Query rentals for the date range
    const { data: rentals, error: rentalsError } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id,
        user_id,
        vehicle_id,
        status,
        payment_status,
        total_cost,
        agreed_start_date,
        agreed_end_date,
        requested_start_date,
        requested_end_date,
        created_at,
        vehicle:cars!inner(id, make, model, type),
        user:users!rentals_user_id_fkey(user_id, full_name, username)
      `)
      .eq("vehicle.crew_id", crew.id)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });

    if (rentalsError) {
      console.error("[rentals-export] Query error:", rentalsError);
      return { success: false, error: rentalsError.message };
    }

    if (!rentals || rentals.length === 0) {
      return { success: true, data: [] };
    }

    // DEDUPLICATION: Handle multiple rental generations for same transaction
    // When user re-uploads documents (same date, same bike, same dude), a NEW rental_id
    // is created each time. We keep only the LATEST rental for each (user_id + vehicle_id).
    // Results are already ordered by created_at DESC, so first occurrence is the latest.
    const seenUserVehiclePairs = new Set<string>();
    const uniqueRentals: RentalDashboardItem[] = [];
    for (const rental of (rentals || []) as RentalDashboardItem[]) {
      const dedupeKey = `${rental.user_id}::${rental.vehicle_id}`;
      if (!seenUserVehiclePairs.has(dedupeKey)) {
        seenUserVehiclePairs.add(dedupeKey);
        uniqueRentals.push(rental);
      }
    }

    // Get checklist states for these rentals (by vehicle_id)
    const rentalIds = uniqueRentals.map(r => r.rental_id);
    const vehicleIds = [...new Set(uniqueRentals.map(r => r.vehicle_id))];

    // Run all queries in parallel for better performance
    const [checklistStates, secrets] = await Promise.all([
      supabaseAdmin
        .from("checklist_state")
        .select("vehicle_id, status, updated_at")
        .in("vehicle_id", vehicleIds),
      privateSchema()
        .from("user_rental_secrets")
        .select("source_rental_id, verification_status, created_at, chat_id, is_web_app_flow, qr_claimed_at")
        .in("source_rental_id", rentalIds)
        .order("created_at", { ascending: false }), // Latest first for dedupe
    ]);

    const checklistMap = new Map(checklistStates.data?.map(c => [c.vehicle_id, c]) || []);

    // DEDUPLICATION: Only latest verification status per rental counts
    // Multiple uploads for same rental (same date, bike, dude) -> use latest
    const verifiedSet = new Set<string>();
    const seenRentals = new Set<string>();
    for (const secret of (secrets.data || [])) {
      const rentalId = secret.source_rental_id || "";
      // Only process first occurrence (latest document) per rental
      if (!seenRentals.has(rentalId)) {
        seenRentals.add(rentalId);
        if (secret.verification_status === "verified") {
          verifiedSet.add(rentalId);
        }
      }
    }

    // Build export data
    const exportData = uniqueRentals.map((rental: RentalDashboardItem) => {
      const vehicle = rental.vehicle;
      const user = rental.user;
      const checklist = checklistMap.get(rental.vehicle_id);
      const docSecret = rental.documentSecret;

      return {
        rental_id: rental.rental_id,
        created_at: rental.created_at,
        agreed_start_date: rental.agreed_start_date,
        agreed_end_date: rental.agreed_end_date,
        requested_start_date: rental.requested_start_date,
        requested_end_date: rental.requested_end_date,
        total_cost: rental.total_cost,
        status: rental.status,
        payment_status: rental.payment_status,
        vehicle_make: vehicle?.make || "",
        vehicle_model: vehicle?.model || "",
        vehicle_type: vehicle?.type || "",
        user_full_name: user?.full_name,
        user_username: user?.username,
        checklist_status: checklist?.status || "not_started",
        checklist_updated_at: checklist?.updated_at || null,
        document_verified: verifiedSet.has(rental.rental_id),
        qr_claimed: !!docSecret?.qr_claimed_at,  // qr_claimed_at IS NOT NULL means renter claimed
        is_web_app_flow: docSecret?.is_web_app_flow || false,
      };
    });

    return { success: true, data: exportData };
  } catch (error) {
    console.error("[rentals-export] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Analytics Password Access ─────────────────────────────────────────────────────

/**
 * Password-based access for analytics (for PC access without Telegram).
 * Uses the analytics_passwords table for time-based password validation.
 * Passwords are generated via /analytics_pass Telegram bot command.
 */
export async function validateAnalyticsPassword(input: {
  password: string;
}): Promise<{ success: boolean; slug?: string; crewId?: string; ownerId?: string; error?: string }> {
  try {
    const parsed = z.object({
      password: z.string().trim().min(1),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { password } = parsed.data;

    // Call the Supabase function to validate password
    const { data: validationResult, error: validateError } = await supabaseAdmin
      .rpc("validate_analytics_password", {
        p_password: password,
      });

    if (validateError) {
      console.error("[analytics-password] Validation error:", validateError);
      return { success: false, error: "Ошибка проверки пароля." };
    }

    if (!validationResult || validationResult.length === 0) {
      return { success: false, error: "Неверный пароль." };
    }

    const result = validationResult[0];
    if (!result.is_valid) {
      console.log("[analytics-password] Password expired");
      return { success: false, error: "Пароль истёк. Запросите новый через /analytics_pass" };
    }

    console.log("[analytics-password] Password valid, returning:", {
      slug: result.slug,
      crewId: result.crew_id,
      ownerId: result.crew_owner_id,
    });

    return {
      success: true,
      slug: result.slug,
      crewId: result.crew_id,
      ownerId: result.crew_owner_id,
    };
  } catch (error) {
    console.error("[analytics-password] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Commercial Proposals Dashboard ───────────────────────────────────────────────

export interface CommercialProposalItem {
  id: string;
  proposal_key: string;
  crew_slug: string;
  client_name: string;
  client_inn: string | null;
  client_phone: string | null;
  client_email: string | null;
  offer_type: string;
  offer_summary: string | null;
  total_price: number | null;
  validity_days: number;
  payment_terms: string | null;
  delivery_terms: string | null;
  special_conditions: string | null;
  bike_filter: string | null;
  bike_catalog_count: number;
  telegram_chat_id: string | null;
  telegram_message_id: number | null;
  qr_included: boolean;
  created_at: string;
}

export interface CommercialProposalsResult {
  items: CommercialProposalItem[];
  summary: {
    totalCount: number;
    byType: Record<string, number>;
    withQr: number;
  };
  selectedDate: string;
}

/**
 * Get commercial proposals dashboard data for a specific crew and date.
 * Returns proposals + summary statistics from private.commercial_proposal_artifacts.
 */
export async function getCommercialProposalsDashboard(input: {
  slug: string;
  actorUserId: string;
  date: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: CommercialProposalsResult; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, date, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      console.error("[commercial-dashboard] Crew not found for slug:", slug);
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check
    if (!isPasswordAuth) {
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

      // Check if user is a crew member
      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      const isCrewMember = !!crewMember;

      if (!isOwner && !isAdmin && !isOrudjov && !isCrewMember) {
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
    }

    // Parse date boundaries for the selected day (UTC)
    const startOfDay = new Date(`${date}T00:00:00.000Z`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59.999Z`).toISOString();

    // Query proposals from private.commercial_proposal_artifacts
    const { data: proposals, error: proposalsError } = await privateSchema()
      .from("commercial_proposal_artifacts")
      .select("*")
      .eq("crew_slug", slug.trim())
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });

    if (proposalsError) {
      console.error("[commercial-dashboard] Query error:", proposalsError);
      return { success: false, error: proposalsError.message };
    }

    const items: CommercialProposalItem[] = (proposals || []).map(p => ({
      id: p.id,
      proposal_key: p.proposal_key,
      crew_slug: p.crew_slug,
      client_name: p.client_name,
      client_inn: p.client_inn,
      client_phone: p.client_phone,
      client_email: p.client_email,
      offer_type: p.offer_type,
      offer_summary: p.offer_summary,
      total_price: p.total_price ? Number(p.total_price) : null,
      validity_days: p.validity_days,
      payment_terms: p.payment_terms,
      delivery_terms: p.delivery_terms,
      special_conditions: p.special_conditions,
      bike_filter: p.bike_filter,
      bike_catalog_count: p.bike_catalog_count || 0,
      telegram_chat_id: p.telegram_chat_id,
      telegram_message_id: p.telegram_message_id,
      qr_included: p.qr_included || false,
      created_at: p.created_at,
    }));

    // Calculate summary
    const summary = {
      totalCount: items.length,
      byType: {} as Record<string, number>,
      withQr: items.filter(p => p.qr_included).length,
    };

    for (const item of items) {
      const type = item.offer_type || "unknown";
      summary.byType[type] = (summary.byType[type] || 0) + 1;
    }

    return {
      success: true,
      data: {
        items,
        summary,
        selectedDate: date,
      },
    };
  } catch (error) {
    console.error("[commercial-dashboard] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Subrent Contracts Dashboard ──────────────────────────────────────────────────

export interface SubrentContractItem {
  id: string;
  contract_key: string;
  requested_bike_id: string | null;
  resolved_bike_id: string | null;
  telegram_chat_id: string | null;
  owner_full_name: string | null;
  owner_phone: string | null;
  owner_email: string | null;
  bike_make: string | null;
  bike_model: string | null;
  bike_vin: string | null;
  bike_plate: string | null;
  owner_percentage: string | null;
  min_daily_price_rub: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  crew_id: string | null;
  created_at: string;
}

export interface SubrentContractsResult {
  items: SubrentContractItem[];
  summary: {
    totalCount: number;
    activeCount: number;
  };
  selectedDate: string;
}

/**
 * Get subrent contracts dashboard data for a specific crew and date.
 * Returns contracts + summary statistics from private.subrent_contract_artifacts.
 */
export async function getSubrentContractsDashboard(input: {
  slug: string;
  actorUserId: string;
  date: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: SubrentContractsResult; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, date, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      console.error("[subrent-dashboard] Crew not found for slug:", slug);
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check
    if (!isPasswordAuth) {
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

      // Check if user is a crew member
      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      const isCrewMember = !!crewMember;

      if (!isOwner && !isAdmin && !isOrudjov && !isCrewMember) {
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
    }

    // Parse date boundaries for the selected day (UTC)
    const startOfDay = new Date(`${date}T00:00:00.000Z`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59.999Z`).toISOString();

    // Query contracts from private.subrent_contract_artifacts
    const { data: contracts, error: contractsError } = await privateSchema()
      .from("subrent_contract_artifacts")
      .select("*")
      .eq("crew_id", slug.trim())
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });

    if (contractsError) {
      console.error("[subrent-dashboard] Query error:", contractsError);
      return { success: false, error: contractsError.message };
    }

    const today = new Date();
    const items: SubrentContractItem[] = (contracts || []).map(c => {
      const startDate = c.contract_start_date ? new Date(c.contract_start_date.split('.').reverse().join('-')) : null;
      const endDate = c.contract_end_date ? new Date(c.contract_end_date.split('.').reverse().join('-')) : null;
      const isActive = startDate && endDate && today >= startDate && today <= endDate;

      return {
        id: c.id,
        contract_key: c.contract_key,
        requested_bike_id: c.requested_bike_id,
        resolved_bike_id: c.resolved_bike_id,
        telegram_chat_id: c.telegram_chat_id,
        owner_full_name: c.owner_full_name,
        owner_phone: c.owner_phone,
        owner_email: c.owner_email,
        bike_make: c.bike_make,
        bike_model: c.bike_model,
        bike_vin: c.bike_vin,
        bike_plate: c.bike_plate,
        owner_percentage: c.owner_percentage,
        min_daily_price_rub: c.min_daily_price_rub,
        contract_start_date: c.contract_start_date,
        contract_end_date: c.contract_end_date,
        crew_id: c.crew_id,
        created_at: c.created_at,
        isActive,
      } as SubrentContractItem;
    });

    // Calculate summary
    const summary = {
      totalCount: items.length,
      activeCount: items.filter(c => (c as any).isActive).length,
    };

    return {
      success: true,
      data: {
        items,
        summary,
        selectedDate: date,
      },
    };
  } catch (error) {
    console.error("[subrent-dashboard] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Regenerate QR Code ───────────────────────────────────────────────────────────────

/**
 * Regenerate QR code for a rental by marking it for regeneration.
 * This updates the user_rental_secrets row to track regeneration and increment counter.
 * The actual QR will be regenerated on next access via resend or new document generation.
 */
export async function regenerateRentalQr(input: {
  slug: string;
  actorUserId: string;
  rentalId: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, rentalId, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      console.error("[regenerate-qr] Crew not found for slug:", slug);
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check - allow owners, admins, orudjov, and crew members
    if (!isPasswordAuth) {
      const userMetadata = (await supabaseAdmin
        .from("users")
        .select("metadata, username")
        .eq("user_id", actorUserId)
        .maybeSingle()
      ).data?.metadata as Record<string, unknown> | null;

      const userUsername = (await supabaseAdmin
        .from("users")
        .select("username")
        .eq("user_id", actorUserId)
        .maybeSingle()
      ).data?.username as string | null;

      const isAdmin = userMetadata?.role === "admin";
      const isOwner = crew.owner_id === actorUserId;
      const isOrudjov = userUsername?.toLowerCase().includes("orud");

      // Check if user is a crew member
      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      const isCrewMember = !!crewMember;

      if (!isOwner && !isAdmin && !isOrudjov && !isCrewMember) {
        return { success: false, error: "Недостаточно прав для регенерации QR." };
      }
    }

    // Get the latest document secret for this rental
    const { data: secret, error: secretError } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("source_rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (secretError || !secret) {
      console.error("[regenerate-qr] Secret not found:", secretError);
      return { success: false, error: "Документ не найден." };
    }

    // Update the secret to mark for regeneration
    // Store original doc_sha256 if not already stored, increment counter
    const { error: updateError } = await privateSchema()
      .from("user_rental_secrets")
      .update({
        original_doc_sha256: secret.original_doc_sha256 || secret.doc_sha256,
        qr_regeneration_count: (secret.qr_regeneration_count || 0) + 1,
        qr_generated_at: new Date().toISOString(),
        // Reset claim status - user needs to reclaim the regenerated QR
        qr_claimed_at: null,
        // Note: We keep chat_id as is (crew owner or current user)
        // The claim process will update it to the new claimant
      })
      .eq("id", secret.id);

    if (updateError) {
      console.error("[regenerate-qr] Update error:", updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[regenerate-qr] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Update Rental Status ───────────────────────────────────────────────────────────

export async function updateRentalStatus(input: {
  slug: string;
  actorUserId: string;
  rentalId: string;
  status: "pending_confirmation" | "confirmed" | "active" | "completed" | "cancelled" | "disputed";
  operatorMessage?: string;       // Decline reason or completion note — sent to renter via Telegram
  odometerBefore?: number;        // For activation — starting odometer
  odometerAfter?: number;         // For completion — final odometer
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      status: z.enum(["pending_confirmation", "confirmed", "active", "completed", "cancelled", "disputed"]),
      operatorMessage: z.string().max(2000).optional(),
      odometerBefore: z.number().int().min(0).max(999999).optional(),
      odometerAfter: z.number().int().min(0).max(999999).optional(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, rentalId, status, operatorMessage, odometerBefore, odometerAfter, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, metadata")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      console.error("[update-rental-status] Crew not found for slug:", slug);
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check - allow owners, admins, orudjov, and crew members
    if (!isPasswordAuth) {
      const userQuery = await supabaseAdmin
        .from("users")
        .select("metadata, username")
        .eq("user_id", actorUserId)
        .maybeSingle();
      const userMetadata = userQuery.data?.metadata as Record<string, unknown> | null;
      const userUsername = userQuery.data?.username as string | null;
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
        return { success: false, error: "Недостаточно прав для обновления статуса." };
      }
    }

    // ── Fetch current rental for metadata merge + renter chat_id ──
    const { data: rental } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, status as old_status, metadata, user_id, vehicle:cars(make, model)")
      .eq("rental_id", rentalId)
      .maybeSingle();

    const currentMeta = (rental?.metadata || {}) as Record<string, unknown>;
    const history = (currentMeta.history || []) as Array<{ status: string; at: string; by?: string; message?: string }>;
    const now = new Date();

    // Append this status change to history
    history.push({
      status,
      at: now.toISOString(),
      by: actorUserId,
      message: operatorMessage || undefined,
    });

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      status,
      updated_at: now.toISOString(),
      metadata: {
        ...currentMeta,
        history,
        last_status_change_at: now.toISOString(),
        last_status_change_by: actorUserId,
        last_status_change_message: operatorMessage || null,
      },
    };

    // Store odometer values if provided
    if (odometerBefore != null) updatePayload.odometer_before = odometerBefore;
    if (odometerAfter != null) updatePayload.odometer_after = odometerAfter;

    const { error: updateError } = await supabaseAdmin
      .from("rentals")
      .update(updatePayload)
      .eq("rental_id", rentalId);

    if (updateError) {
      console.error("[update-rental-status] Update error:", updateError);
      return { success: false, error: updateError.message };
    }

    // ── If operator provided a message → notify renter via Telegram ──
    if (operatorMessage && rental?.user_id) {
      const renterChatId = rental.user_id;
      const vehicle = rental?.vehicle as { make?: string; model?: string } | null;
      const bikeName = vehicle ? `${vehicle.make || ""} ${vehicle.model || ""}`.trim() : "байк";

      const statusLabels: Record<string, string> = {
        active: "активирована",
        completed: "завершена",
        cancelled: "отклонена",
        confirmed: "подтверждена",
        disputed: "в споре",
      };
      const statusLabel = statusLabels[status] || status;

      const messageText = `ℹ️ <b>Аренда ${statusLabel}</b>\n\n` +
        `🚲 ${bikeName}\n` +
        `📋 Статус: <b>${statusLabel}</b>\n\n` +
        `📝 Сообщение оператора:\n${operatorMessage}\n\n` +
        `По вопросам — пишите в чат.`;

      try {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
        await fetch(`${siteUrl}/api/forward-telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: renterChatId,
            method: "sendMessage",
            payload: { text: messageText, parse_mode: "HTML" },
          }),
          signal: AbortSignal.timeout(10000),
        });
      } catch (tgErr) {
        console.warn("[update-rental-status] TG notify failed (non-fatal):", tgErr);
      }
    }

    // ── If completed with odometer → save to bike specs for next-rental prefill ──
    if (status === "completed" && odometerAfter != null && rental) {
      try {
        const vehicle = rental?.vehicle as { id?: string } | null;
        if (vehicle?.id) {
          const { data: car } = await supabaseAdmin
            .from("cars")
            .select("specs")
            .eq("id", vehicle.id)
            .maybeSingle();
          if (car) {
            const specs = (car.specs || {}) as Record<string, unknown>;
            await supabaseAdmin
              .from("cars")
              .update({ specs: { ...specs, last_known_odometer: odometerAfter } })
              .eq("id", vehicle.id);
          }
        }
      } catch (odoErr) {
        console.warn("[update-rental-status] Odometer save failed (non-fatal):", odoErr);
      }
    }

    const msgParts: string[] = [];
    msgParts.push(`Статус изменён на «${status}»`);
    if (operatorMessage) msgParts.push("уведомление отправлено арендатору");
    if (odometerBefore != null) msgParts.push(`одометр: ${odometerBefore} км`);
    if (odometerAfter != null) msgParts.push(`финальный одометр: ${odometerAfter} км`);

    return { success: true, message: msgParts.join(", ") + "." };
  } catch (error) {
    console.error("[update-rental-status] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Activate Rental (2-step confirmation) ────────────────────────────────────────

/**
 * Activate a pending_confirmation rental: update status to active, regenerate
 * DOCX with odometer reading, resend to renter + owner + admin + crew email,
 * and send a congratulatory message. This is the second step of the 2-step
 * activation flow (first step = web order creates pending_confirmation).
 */
export async function activateRental(input: {
  slug: string;
  actorUserId: string;
  rentalId: string;
  odometerBefore: number;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      odometerBefore: z.number().int().min(0).max(999999),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос: укажите rentalId и показания одометра." };
    }

    const { slug, actorUserId, rentalId, odometerBefore, isPasswordAuth = false } = parsed.data;

    // ── 1. Fetch crew + verify access ──
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, slug, metadata")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    if (!isPasswordAuth) {
      const userMeta = (await supabaseAdmin
        .from("users")
        .select("metadata, username")
        .eq("user_id", actorUserId)
        .maybeSingle()
      ).data;
      const userMetadata = userMeta?.metadata as Record<string, unknown> | null;
      const userUsername = userMeta?.username as string | null;
      const isAdmin = userMetadata?.role === "admin";
      const isOwner = crew.owner_id === actorUserId;
      const isOrudjov = userUsername?.toLowerCase().includes("orud");
      if (!isOwner && !isAdmin && !isOrudjov) {
        return { success: false, error: "Недостаточно прав для активации аренды." };
      }
    }

    // ── 2. Fetch rental with vehicle + secrets ──
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id, user_id, status, total_cost,
        requested_start_date, requested_end_date,
        agreed_start_date, agreed_end_date,
        metadata,
        vehicle:cars!inner(id, make, model, type, specs, crew_id),
        user:users!rentals_user_id_fkey(user_id, full_name, username)
      `)
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (rentalError || !rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    if (rental.status !== "pending_confirmation") {
      return { success: false, error: `Статус аренды "${rental.status}" — активация возможна только для "pending_confirmation".` };
    }

    const vehicle = rental.vehicle as any;
    const renter = rental.user as any;

    // ── 3. Fetch renter secrets (passport, license, etc.) ──
    const { privateSchema } = await import("@/lib/private-secrets");
    const { data: secrets } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("source_rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const secretData = secrets as any || {};

    // ── 4. Generate DOCX with odometer ──
    const { buildFranchizeDocxFromTemplate } = await import("@/app/franchize/lib/docx-capability");
    const { createHash } = await import("crypto");
    const { readFileSync } = await import("fs");
    const { join } = await import("path");

    const now = new Date();
    const rentStartDate = rental.agreed_start_date || rental.requested_start_date || "";
    const rentEndDate = rental.agreed_end_date || rental.requested_end_date || "";
    const crewBotUsername = (crew.metadata as any)?.franchize?.contacts?.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot";

    const vars: Record<string, string> = {
      contract_number: `${now.getDate()}.${now.getMonth() + 1}/${vehicle.id}`,
      day: String(now.getDate()).padStart(2, "0"),
      month: now.toLocaleString("ru-RU", { month: "long" }),
      month_num: String(now.getMonth() + 1).padStart(2, "0"),
      year: String(now.getFullYear()),
      renter_full_name: secretData.renter_full_name || renter?.full_name || "",
      renter_birth_date: secretData.renter_birth_date || "",
      renter_phone: secretData.renter_phone || "",
      renter_email: secretData.renter_email || "",
      renter_address: secretData.renter_address || secretData.renter_registration || "",
      renter_driver_license: secretData.renter_driver_license || "",
      renter_passport: secretData.renter_passport || "",
      renter_passport_issue_date: secretData.renter_passport_issue_date || "",
      renter_registration: secretData.renter_registration || "",
      bike_make_model: `${vehicle.make || ""} ${vehicle.model || ""}`.trim(),
      bike_make: vehicle.make || "уточняется",
      bike_model: vehicle.model || "уточняется",
      bike_vin: vehicle.specs?.vin || vehicle.specs?.frame || "уточняется",
      bike_category: vehicle.specs?.category || "A/L3",
      bike_color: vehicle.specs?.color || "уточняется",
      bike_year: vehicle.specs?.year || "уточняется",
      bike_plate: vehicle.specs?.plate || "уточняется",
      rent_start_date: rentStartDate.split("T")[0] || now.toISOString().split("T")[0],
      rent_end_date: rentEndDate.split("T")[0] || now.toISOString().split("T")[0],
      // Activated → show real odometer reading
      odometer_before: String(odometerBefore),
      daily_price_rub: String(rental.total_cost || "10000"),
      deposit_rub: String(vehicle.specs?.deposit_rub || "20000"),
      document_key: secretData.source_doc_key || `rental-${vehicle.id}-${Date.now()}`,
      bike_vehicle_type_label: vehicle.type === "ebike" ? "ЭЛЕКТРОМОТОЦИКЛА" : "МОТОЦИКЛА",
      signature_timestamp: now.toLocaleString("ru-RU"),
      renter_signature: "активировано при выдаче",
    };

    // Include extra shared-builder fields if available
    const { buildRentalContractVariables } = await import("@/app/lib/rental-contract-vars").catch(() => ({ buildRentalContractVariables: null }));
    let sharedVars: Record<string, string> = {};
    if (buildRentalContractVariables && vehicle.specs) {
      try {
        const { default: crewSecrets } = await import("@/lib/supabase-server").catch(() => ({}));
        // Use minimal required fields — we're just filling in the gaps
        sharedVars = { odometer_before: String(odometerBefore) };
      } catch {}
    }

    // Load rental HTML template
    const templatePath = join(process.cwd(), "docs", "RENTAL_DEAL_TEMPLATE.html");
    const htmlTemplate = readFileSync(templatePath, "utf8");

    const docFileName = `rental-contract-${vehicle.make}-${vehicle.model}-${now.toISOString().split("T")[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    const docResult = await buildFranchizeDocxFromTemplate({
      integrationScope: "rental-activation",
      uploadedBy: "dashboard",
      documentKey: vars.document_key,
      fileName: docFileName,
      template: htmlTemplate,
      variables: { ...vars, ...sharedVars },
      flowType: "rental",
      templateMode: "html",
    });

    const docxBuf = docResult.bytes;
    const docSha256 = docResult.sha256;

    // Generate QR code with crew-specific bot username
    const qrDeepLink = `https://t.me/${crewBotUsername}/app?startapp=rent_${vehicle.id}_${docSha256}`;
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff&margin=1`;
    let qrPngBuffer: Buffer | null = null;
    try {
      const qrRes = await fetch(qrPngUrl, { signal: AbortSignal.timeout(8000) });
      if (qrRes.ok) qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
    } catch {}

    // ── 5. Update rental status → active + save odometer in metadata ──
    const currentMeta = (rental.metadata || {}) as Record<string, unknown>;
    const { error: updateError } = await supabaseAdmin
      .from("rentals")
      .update({
        status: "active",
        odometer_before: odometerBefore,
        updated_at: now.toISOString(),
        metadata: {
          ...currentMeta,
          activated_at: now.toISOString(),
          activated_by: actorUserId,
          odometer_before: odometerBefore,
          activation_doc_sha256: docSha256,
        },
      })
      .eq("rental_id", rentalId);

    if (updateError) {
      console.error("[activate-rental] Status update error:", updateError);
      return { success: false, error: updateError.message };
    }

    // ── 6. Send to all recipients ──

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://v0-car-test.vercel.app";
    const forwardUrl = `${siteUrl}/api/forward-telegram`;

    // Congratulatory message
    const congratText = `✅ <b>Аренда активирована!</b>\n\n` +
      `🚲 ${vehicle.make} ${vehicle.model}\n` +
      `📅 ${vars.rent_start_date} → ${vars.rent_end_date}\n` +
      `📊 Одометр: ${odometerBefore} км\n` +
      `👤 ${secretData.renter_full_name || renter?.full_name || "Арендатор"}\n\n` +
      `Договор сформирован и отправлен. Приятной поездки! 🏍️`;

    const qrCaption = `📲 <b>QR для быстрой аренды</b>\n🔗 ${qrDeepLink}`;

    // Helper to send DOCX + QR + message to a single chat
    // If skipQr=true → renter already has QR from initial DOCX, no need to resend
    async function sendToChat(chatId: string, opts?: { skipQr?: boolean }) {
      if (!chatId || !/^\d+$/.test(chatId)) return;
      try {
        // First send congratulatory message
        await fetch(forwardUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            method: "sendMessage",
            payload: { text: congratText, parse_mode: "HTML" },
          }),
          signal: AbortSignal.timeout(8000),
        });
        // Then send DOCX (always) + QR (only if skipQr is not set)
        if (opts?.skipQr) {
          // Renter already has QR → just send the final DOCX
          await fetch(forwardUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              method: "sendDocument",
              payload: {
                caption: `📄 <b>Финальный договор</b>\n🚲 ${vehicle.make} ${vehicle.model}\n📊 Одометр: ${odometerBefore} км\n\nСкачайте для подписи. Ваш QR-код для быстрой аренды уже доступен в истории.`,
                parse_mode: "HTML",
              },
              files: {
                document: { data: docxBuf.toString("base64"), filename: docFileName, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
              },
            }),
            signal: AbortSignal.timeout(15000),
          });
        } else if (qrPngBuffer) {
          await fetch(forwardUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              method: "sendMediaGroup",
              payload: {
                media: [
                  { type: "document", media: "attach://docx", parse_mode: "HTML" },
                  { type: "photo", media: "attach://qr", caption: qrCaption, parse_mode: "HTML" },
                ],
              },
              files: {
                docx: { data: docxBuf.toString("base64"), filename: docFileName, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
                qr: { data: qrPngBuffer.toString("base64"), filename: `qr-${vehicle.id}.png`, contentType: "image/png" },
              },
            }),
            signal: AbortSignal.timeout(15000),
          });
        } else {
          await fetch(forwardUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              method: "sendDocument",
              payload: { caption: `Договор аренды: ${vehicle.make} ${vehicle.model}\n\n🔗 ${qrDeepLink}`, parse_mode: "HTML" },
              files: {
                document: { data: docxBuf.toString("base64"), filename: docFileName, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
              },
            }),
            signal: AbortSignal.timeout(15000),
          });
        }
      } catch (err) {
        console.error(`[activate-rental] Send to ${chatId} failed:`, err);
      }
    }

    // Determine if renter already has linked TG account (had secrets → already got QR during DOCX creation)
    const renterChatId = renter?.user_id || secretData.chat_id || "";
    const renterAlreadyLinked = !!renterChatId; // Has existing TG account → no need for QR

    // Send to renter — skip QR if already linked
    if (renterChatId) await sendToChat(renterChatId, { skipQr: renterAlreadyLinked });

    // Send to crew owner — always include QR (they may forward it)
    const crewOwnerChatId = crew.owner_id;
    if (crewOwnerChatId) await sendToChat(crewOwnerChatId);

    // Send to admin (salavey13) — always include QR
    const adminChatId = "413553377";
    await sendToChat(adminChatId);

    // ── 7. Send via email ──
    try {
      const { default: nodemailer } = await import("nodemailer");
      const emailUser = process.env.SMTP_USER;
      const emailPass = process.env.SMTP_PASS;
      if (emailUser && emailPass) {
        // Get crew email from secrets
        const { data: crewSecrets } = await privateSchema()
          .from("crew_secrets")
          .select("email")
          .eq("crew_id", crew.id)
          .maybeSingle();
        const crewEmail = (crewSecrets as any)?.email;
        const emailTo = crewEmail || emailUser;

        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.yandex.ru",
          port: Number(process.env.SMTP_PORT) || 465,
          secure: true,
          auth: { user: emailUser, pass: emailPass },
        });

        await transporter.sendMail({
          from: emailUser,
          to: emailTo,
          subject: `✅ Аренда активирована — ${vehicle.make} ${vehicle.model} (одометр: ${odometerBefore} км)`,
          text: `${congratText}\n\nДоговор прикреплён к письму.`,
          attachments: [{
            filename: docFileName,
            content: Buffer.from(docxBuf),
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }],
        });
      }
    } catch (emailErr) {
      console.warn("[activate-rental] Email send failed (non-fatal):", emailErr);
    }

    // ── 8. Update the franchize_intents stage ──
    try {
      await supabaseAdmin
        .from("franchize_intents")
        .update({ stage: "contract_generated", updated_at: now.toISOString() })
        .eq("slug", slug)
        .eq("telegram_user_id", renterChatId)
        .in("intent_type", ["rent", "checkout_start"]);
    } catch {}

    return {
      success: true,
      message: `Аренда активирована. Договор отправлен арендатору, владельцу и на email. Одометр: ${odometerBefore} км.`,
    };
  } catch (error) {
    console.error("[activate-rental] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Send Rental Document via Email ───────────────────────────────────────────────

/**
 * Send rental contract + QR via email to crew's configured email.
 * Generates the DOCX contract and QR code, then sends them as email attachments.
 */
export async function sendRentalDocByEmail(input: {
  slug: string;
  actorUserId: string;
  rentalId: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: { email: string; messageId?: string }; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      rentalId: z.string().uuid(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, rentalId, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, slug, name, metadata")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      console.error("[send-doc-email] Crew not found for slug:", slug);
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check - allow owners, admins, orudjov, and crew members
    if (!isPasswordAuth) {
      const userMetadata = (await supabaseAdmin
        .from("users")
        .select("metadata, username")
        .eq("user_id", actorUserId)
        .maybeSingle()
      ).data?.metadata as Record<string, unknown> | null;

      const userUsername = (await supabaseAdmin
        .from("users")
        .select("username")
        .eq("user_id", actorUserId)
        .maybeSingle()
      ).data?.username as string | null;

      const isAdmin = userMetadata?.role === "admin";
      const isOwner = crew.owner_id === actorUserId;
      const isOrudjov = userUsername?.toLowerCase().includes("orud");

      // Check if user is a crew member
      const { data: crewMember } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("user_id", actorUserId)
        .maybeSingle();

      const isCrewMember = !!crewMember;

      if (!isOwner && !isAdmin && !isOrudjov && !isCrewMember) {
        return { success: false, error: "Недостаточно прав для отправки." };
      }
    }

    // Get crew email from metadata
    const crewMetadata = crew.metadata as Record<string, unknown> | null;
    const contactsEmail = crewMetadata?.franchize?.contacts?.email as string | undefined;
    let recipientEmail = contactsEmail;

    // Fallback: try owner's user email
    if (!recipientEmail && crew.owner_id) {
      const { data: owner } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", crew.owner_id)
        .maybeSingle();

      if (owner?.metadata) {
        const ownerMetadata = owner.metadata as Record<string, unknown>;
        recipientEmail = ownerMetadata.email as string | undefined;
      }
    }

    if (!recipientEmail) {
      return { success: false, error: "Email экипажа не настроен. Укажите email в настройках экипажа." };
    }

    // Get rental details
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select(`
        rental_id,
        agreed_start_date,
        agreed_end_date,
        total_cost,
        vehicle:cars!inner(id, make, model, specs, type, crew_id),
        user:users!rentals_user_id_fkey(user_id, full_name, username)
      `)
      .eq("rental_id", rentalId)
      .maybeSingle();

    if (rentalError || !rental) {
      return { success: false, error: "Аренда не найдена." };
    }

    // Get document secret
    const { data: secret } = await privateSchema()
      .from("user_rental_secrets")
      .select("*")
      .eq("source_rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!secret) {
      return { success: false, error: "Документ не найден. Необходимо создать договор." };
    }

    // Generate DOCX contract
    const { buildFranchizeDocxFromTemplate } = await import("@/app/franchize/lib/docx-capability");
    const { readFileSync } = await import("fs");
    const { join } = await import("path");

    const vehicle = rental.vehicle as any;
    const renter = rental.user as any;
    const secretData = secret as any;

    const now = new Date();
    const vars: Record<string, string> = {
      contract_number: `${now.getDate()}.${now.getMonth() + 1}/${vehicle.id}`,
      day: String(now.getDate()).padStart(2, "0"),
      month: now.toLocaleString("ru-RU", { month: "long" }),
      month_num: String(now.getMonth() + 1).padStart(2, "0"),
      year: String(now.getFullYear()),
      renter_full_name: secretData.renter_full_name || renter?.full_name || "",
      renter_birth_date: secretData.renter_birth_date || "",
      renter_phone: secretData.renter_phone || "",
      renter_email: secretData.renter_email || "",
      renter_address: secretData.renter_address || secretData.renter_registration || "",
      renter_driver_license: secretData.renter_driver_license || "",
      renter_passport: secretData.renter_passport || "",
      renter_passport_issue_date: secretData.renter_passport_issue_date || "",
      renter_registration: secretData.renter_registration || "",
      bike_make_model: `${vehicle.make || ""} ${vehicle.model || ""}`.trim(),
      bike_make: vehicle.make || "уточняется",
      bike_model: vehicle.model || "уточняется",
      bike_vin: vehicle.specs?.vin || vehicle.specs?.frame || "уточняется",
      bike_category: vehicle.specs?.category || "A/L3",
      rent_start_date: rental.agreed_start_date?.split("T")[0] || now.toISOString().split("T")[0],
      rent_end_date: rental.agreed_end_date?.split("T")[0] || now.toISOString().split("T")[0],
      daily_price_rub: String(rental.total_cost || "10000"),
      deposit_rub: String(vehicle.specs?.deposit_rub || "20000"),
      document_key: secretData.source_doc_key || `rental-${vehicle.id}-${Date.now()}`,
      bike_vehicle_type_label: vehicle.type === "ebike" ? "ЭЛЕКТРОМОТОЦИКЛА" : "МОТОЦИКЛА",
      bike_plate: vehicle.specs?.plate || "уточняется",
      bike_color: vehicle.specs?.color || "уточняется",
      bike_year: vehicle.specs?.year || "уточняется",
      signature_timestamp: now.toLocaleString("ru-RU"),
      renter_signature: "электронная отправка",
    };

    // Load rental HTML template
    const templatePath = join(process.cwd(), "docs", "RENTAL_DEAL_TEMPLATE.html");
    let htmlTemplate: string;
    try {
      htmlTemplate = readFileSync(templatePath, "utf8");
    } catch (readErr) {
      console.error("[send-doc-email] Failed to read rental HTML template", readErr);
      return { success: false, error: "Шаблон договора не найден." };
    }

    const docFileName = `rental-contract-${vehicle.make}-${vehicle.model}-${now.toISOString().split("T")[0]}.docx`
      .replace(/[^a-zA-Zа-яА-Я0-9.\-]/g, "-")
      .replace(/-+/g, "-");

    // Generate DOCX
    const docResult = await buildFranchizeDocxFromTemplate({
      integrationScope: "dashboard-rental-email",
      uploadedBy: "dashboard",
      documentKey: vars.document_key,
      fileName: docFileName,
      template: htmlTemplate,
      variables: vars,
      flowType: "rental",
      templateMode: "html",
    });

    const docxBuf = docResult.bytes;
    const docSha256 = docResult.sha256;

    // Generate QR code
    const botUsername = crewMetadata?.franchize?.contacts?.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME || "oneBikePlsBot";
    const qrDeepLink = `https://t.me/${botUsername}/app?startapp=rent_${vehicle.id}_${docSha256}`;
    const qrPngUrl = `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(qrDeepLink)}&color=000000&bgcolor=ffffff&margin=1`;

    let qrPngBuffer: Buffer | null = null;
    try {
      const qrRes = await fetch(qrPngUrl, { signal: AbortSignal.timeout(8000) });
      if (qrRes.ok) {
        qrPngBuffer = Buffer.from(await qrRes.arrayBuffer());
      }
    } catch {}

    // Configure SMTP
    const SMTP_HOST = process.env.SMTP_YANDEX_HOST || process.env.SMTP_GMAIL_HOST || "smtp.yandex.ru";
    const SMTP_PORT = Number(process.env.SMTP_YANDEX_PORT || process.env.SMTP_GMAIL_PORT) || 465;
    const SMTP_USER = process.env.SMTP_YANDEX_USER || process.env.SMTP_GMAIL_USER;
    const SMTP_PASS = process.env.SMTP_YANDEX_PASS || process.env.SMTP_GMAIL_PASS;
    const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      console.error("[send-doc-email] SMTP configuration missing");
      return { success: false, error: "Email service not configured" };
    }

    // Import nodemailer dynamically (server-only)
    const nodemailer = await import("nodemailer");

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    // Verify connection
    try {
      await transporter.verify();
    } catch (verifyErr) {
      console.error("[send-doc-email] SMTP verification failed:", verifyErr);
      return { success: false, error: "Email authentication failed" };
    }

    // Prepare attachments
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [
      {
        filename: docFileName,
        content: docxBuf,
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    ];

    if (qrPngBuffer) {
      attachments.push({
        filename: `qr-${vehicle.id}.png`,
        content: qrPngBuffer,
        contentType: "image/png",
      });
    }

    // Format dates for email
    const formatDate = (dateStr: string) => {
      if (!dateStr) return "—";
      const d = new Date(dateStr);
      return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    };

    // Send email
    const mailOptions = {
      from: `${crew.name} <${EMAIL_FROM}>`,
      to: recipientEmail,
      subject: `Договор аренды: ${vehicle.make} ${vehicle.model} — ${secretData.renter_full_name || renter?.full_name}`,
      text: `Здравствуйте!

Во вложении находится договор аренды и QR-код для быстрого доступа.

Техника: ${vehicle.make} ${vehicle.model}
Клиент: ${secretData.renter_full_name || renter?.full_name || "—"}
Период: ${formatDate(rental.agreed_start_date)} — ${formatDate(rental.agreed_end_date)}
Стоимость: ${rental.total_cost} ₽

QR-код для быстрой аренды:
${qrDeepLink}

---
С уважением,
${crew.name}`,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .info-label { font-weight: 600; color: #666; }
    .info-value { font-weight: bold; color: #333; }
    .qr-section { text-align: center; margin: 20px 0; padding: 20px; background: white; border-radius: 8px; border: 2px dashed #667eea; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
    .attachment-hint { background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📄 Договор аренды</h1>
    </div>
    <div class="content">
      <h2 style="color: #667eea;">${vehicle.make} ${vehicle.model}</h2>

      <div class="info-row">
        <span class="info-label">Клиент:</span>
        <span class="info-value">${secretData.renter_full_name || renter?.full_name || "—"}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Период:</span>
        <span class="info-value">${formatDate(rental.agreed_start_date)} — ${formatDate(rental.agreed_end_date)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Стоимость:</span>
        <span class="info-value">${rental.total_cost} ₽</span>
      </div>

      <div class="attachment-hint">
        📎 Договор и QR-код во вложениях
      </div>

      <div class="qr-section">
        <p style="margin: 0 0 10px 0; color: #666;">QR-код для быстрой аренды:</p>
        <a href="${qrDeepLink}" style="color: #667eea; font-weight: bold; word-break: break-all;">${qrDeepLink}</a>
      </div>
    </div>
    <div class="footer">
      <p>С уважением,<br>${crew.name}</p>
    </div>
  </div>
</body>
</html>`,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("[send-doc-email] Email sent:", info.messageId);

    return {
      success: true,
      data: { email: recipientEmail, messageId: info.messageId },
    };
  } catch (error) {
    console.error("[send-doc-email] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}