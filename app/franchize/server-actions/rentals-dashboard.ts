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
  verificationStatus?: "verified" | "pending" | "revoked" | "all";
}): Promise<{ success: boolean; data?: RentalDashboardResult; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      verificationStatus: z.enum(["verified", "pending", "revoked", "all"]).optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, date, verificationStatus } = parsed.data;

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
      .select("metadata, username")
      .eq("user_id", actorUserId)
      .maybeSingle();

    const userMetadata = userRoles?.metadata as Record<string, unknown> | null;
    const userUsername = userRoles?.username as string | null;
    const isAdmin = userMetadata?.role === "admin";
    // Special case: orudjov (and variations) always have access
    const isOrudjov = userUsername?.toLowerCase().includes("orud");

    if (!isOwner && !isAdmin && !isOrudjov) {
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
        .select("source_rental_id, doc_sha256, verification_status, renter_full_name, renter_passport, created_at")
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
          } as RentalDashboardItem["documentSecret"] & { created_at: string });
        }
      }
    }

    // Attach document secrets to items
    items = items.map(item => ({
      ...item,
      documentSecret: secretsByRentalId.get(item.rental_id),
    }));

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
      .select("metadata, username")
      .eq("user_id", actorUserId)
      .maybeSingle();

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const userUsername = user?.username as string | null;
    const isAdmin = userMetadata?.role === "admin";
    const isOrudjov = userUsername?.toLowerCase().includes("orud");

    if (!isOwner && !isAdmin && !isOrudjov) {
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
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate: string; // ISO date string (YYYY-MM-DD)
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

    // Check access (owner or admin)
    const isOwner = crew.owner_id === actorUserId;
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
        .select("source_rental_id, verification_status, created_at")
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
 * Temporary password-based access for PC version (no Telegram context).
 * Password maps to crew slug - initially hardcoded for "vip-bike".
 * TODO: Implement dynamic password-to-slug mapping via crew metadata/config table.
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

    // TEMPORARY: Hardcode "vip-bike" with default password
    // Password format: "vip-bike-YYYY-MM-DD" for daily passwords
    // Or "vip-bike-master" for permanent access
    const VIP_BIKE_SLUG = "vip-bike";
    const todaysPassword = `${VIP_BIKE_SLUG}-${new Date().toISOString().split("T")[0]}`;
    const masterPassword = `${VIP_BIKE_SLUG}-master`;

    if (password === todaysPassword || password === masterPassword) {
      // Get crew ID and owner_id for the slug
      const { data: crew, error: crewError } = await supabaseAdmin
        .from("crews")
        .select("id, slug, owner_id")
        .eq("slug", VIP_BIKE_SLUG)
        .maybeSingle();

      if (crewError || !crew) {
        console.error("[analytics-password] Crew not found for slug:", VIP_BIKE_SLUG);
        return { success: false, error: "Экипаж не найден." };
      }

      return {
        success: true,
        slug: crew.slug,
        crewId: crew.id,
        ownerId: crew.owner_id || undefined,
      };
    }

    return { success: false, error: "Неверный пароль." };
  } catch (error) {
    console.error("[analytics-password] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}