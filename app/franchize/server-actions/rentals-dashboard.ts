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
}): Promise<{ success: boolean; data?: RentalDashboardResult; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, date } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    // Check access (owner or admin)
    const isOwner = crew.owner_id === actorUserId;
    const { data: userRoles } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();

    const userMetadata = userRoles?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin";

    if (!isOwner && !isAdmin) {
      return { success: false, error: "Недостаточно прав для просмотра." };
    }

    // Parse date boundaries for the selected day (UTC to avoid timezone issues)
    const startOfDay = new Date(`${date}T00:00:00.000Z`).toISOString();
    const endOfDay = new Date(`${date}T23:59:59.999Z`).toISOString();

    // Query rentals for the day
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
        metadata,
        vehicle:cars!inner(id, make, model, crew_id, type, specs),
        user:users!rentals_user_id_fkey(user_id, full_name, username, metadata)
      `)
      .eq("vehicle.crew_id", crew.id)
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });

    if (rentalsError) {
      console.error("[rentals-dashboard] Query error:", rentalsError);
      return { success: false, error: rentalsError.message };
    }

    const items = (rentals || []) as RentalDashboardItem[];

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
}): Promise<{ success: boolean; data?: { minDate: string; maxDate: string } | null; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId } = parsed.data;

    // Get crew
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (!crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    // Check access
    const isOwner = crew.owner_id === actorUserId;
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin";

    if (!isOwner && !isAdmin) {
      return { success: false, error: "Недостаточно прав." };
    }

    // Get min/max dates
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("created_at")
      .innerJoin("cars", "rentals.vehicle_id = cars.id")
      .eq("cars.crew_id", crew.id)
      .not("created_at", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, data: null };
    }

    const minDate = new Date(data[0].created_at).toISOString().split("T")[0];

    // Get max date
    const { data: maxData } = await supabaseAdmin
      .from("rentals")
      .select("created_at")
      .innerJoin("cars", "rentals.vehicle_id = cars.id")
      .eq("cars.crew_id", crew.id)
      .not("created_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const maxDate = maxData && maxData.length > 0
      ? new Date(maxData[0].created_at).toISOString().split("T")[0]
      : minDate;

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
