"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";
import { logger } from "@/lib/logger";

export interface LeadRentalRow {
  rentalId: string;
  status: string;
  paymentStatus: string;
  startDate: string | null;
  endDate: string | null;
  bikeTitle: string | null;
  totalCost: number;
  metadata?: Record<string, unknown> | null; // Status change history, etc.
  passportMainpagePhoto?: string | null;
  passportRegistrationPhoto?: string | null;
  driversLicenceFrontalPhoto?: string | null;
}

export interface LeadSaleRow {
  saleId: string;
  bikeTitle: string | null;
  salePrice: number;
  createdAt: string;
}

export interface LeadRow {
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  source: string;
  bikeTitle: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  verified: boolean;
  intentType?: string | null;
  intentStage?: string | null;
  urgencyScore?: number | null;
  telegramChatId?: string | null;
  troubled?: boolean;
  troubledReason?: string | null;
  contractCount?: number;
  saleCount?: number;
  lastRentalDate?: string | null;
  totalSpent?: number;
  contractRef?: string | null;
  rentals: LeadRentalRow[];
  sales: LeadSaleRow[];
  sourceRoute?: string | null;
  contactChannel?: string | null;
}

export interface LeadTodoRow {
  id: string;
  lead_id?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  category?: string | null;
  created_at: string;
  completed_at?: string | null;
  assigned_to?: string | null;
}

export interface GetFranchizeLeadsResult {
  success: boolean;
  leads?: LeadRow[];
  todos?: LeadTodoRow[];
  error?: string;
}

export async function getFranchizeLeads(slug: string): Promise<GetFranchizeLeadsResult> {
  const safeSlug = slug.trim();
  try {
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", safeSlug)
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден" };
    }

    const crewId = crew.id;
    type MutableLead = Omit<LeadRow, "rentals" | "sales"> & { rentals: LeadRentalRow[]; sales: LeadSaleRow[] };
    const leadMap = new Map<string, MutableLead>();

    const addOrMerge = (row: MutableLead) => {
      const existing = leadMap.get(row.user_id);
      if (!existing) {
        leadMap.set(row.user_id, row);
        return;
      }
      if (row.verified) existing.verified = true;
      if (row.full_name && !existing.full_name) existing.full_name = row.full_name;
      if (row.username && !existing.username) existing.username = row.username;
      if (row.phone && !existing.phone) existing.phone = row.phone;
      if (row.bikeTitle && !existing.bikeTitle) existing.bikeTitle = row.bikeTitle;
      if (row.intentType && !existing.intentType) existing.intentType = row.intentType;
      if (row.intentStage && !existing.intentStage) existing.intentStage = row.intentStage;
      if ((row.urgencyScore ?? 0) > (existing.urgencyScore ?? 0)) existing.urgencyScore = row.urgencyScore;
      if (row.createdAt && (!existing.createdAt || row.createdAt > existing.createdAt)) existing.createdAt = row.createdAt;
      if (row.lastSeenAt && (!existing.lastSeenAt || row.lastSeenAt > existing.lastSeenAt)) existing.lastSeenAt = row.lastSeenAt;
      if (row.telegramChatId && !existing.telegramChatId) existing.telegramChatId = row.telegramChatId;
      if (row.sourceRoute && !existing.sourceRoute) existing.sourceRoute = row.sourceRoute;
      if (row.contactChannel && !existing.contactChannel) existing.contactChannel = row.contactChannel;
    };

    // ── Parallel fetch of independent lead sources (steps 1-5) ──
    // NOTE: `users` table is NOT a primary source (no crew filter available).
    // Users are enriched later from public.users by user_id (step 7).
    const [
      intentLeadsResult,
      artifactUsersResult,
      secretUsersResult,
      rentalsResult,
      saleArtifactsResult,
    ] = await Promise.all([
      // 1. franchize_intents (the canonical lead ledger — crew-filtered by slug)
      supabaseAdmin
        .from("franchize_intents")
        .select("telegram_user_id, phone, intent_type, stage, urgency_score, source_route, contact_channel, last_seen_at, created_at, metadata, bike_id")
        .eq("slug", safeSlug)
        .neq("stage", "dismissed")
        .order("last_seen_at", { ascending: false })
        .limit(800),
      // 2. Rental contract artifacts (crew-filtered) (crew-filtered by crew_slug)
      privateSchema()
        .from("rental_contract_artifacts")
        .select("telegram_chat_id, renter_full_name, renter_phone, rental_id, rent_start_date, rent_end_date, bike_make, bike_model, total_amount, created_at")
        .eq("crew_slug", safeSlug)
        .order("created_at", { ascending: false })
        .limit(300),
      // 3. Rental secrets (crew-filtered) (crew-filtered by crew_slug)
      privateSchema()
        .from("user_rental_secrets")
        .select("chat_id, renter_full_name, renter_phone, verification_status, source_doc_key, created_at")
        .eq("crew_slug", safeSlug)
        .order("created_at", { ascending: false })
        .limit(300),
      // 4. Active/past rentals (crew-filtered) (crew-filtered by crew_id)
      supabaseAdmin
        .from("rentals")
        .select("rental_id, user_id, status, payment_status, requested_start_date, requested_end_date, total_cost, metadata, passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo, crew_id, vehicle:cars(make, model)")
        .eq("crew_id", crewId)
        .order("created_at", { ascending: false })
        .limit(500),
      // 5. Sale contract artifacts (crew-filtered) (crew-filtered by crew_slug)
      privateSchema()
        .from("sale_contract_artifacts")
        .select("buyer_phone, sale_id, bike_make, bike_model, sale_price, created_at")
        .eq("crew_slug", safeSlug)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const intentLeads = intentLeadsResult.data;
    const artifactUsers = artifactUsersResult.data;
    const secretUsers = secretUsersResult.data;
    const rentals = rentalsResult.data;
    const saleArtifacts = saleArtifactsResult.data;

    // ── Franchize intents
    if (intentLeads) {
      for (const i of intentLeads) {
        if (!i.telegram_user_id && !i.phone) continue;
        const id = i.telegram_user_id || i.phone || "";
        const meta = i.metadata as Record<string, unknown> | null;
        addOrMerge({
          user_id: id,
          full_name: (meta?.name as string) || null,
          username: (meta?.username as string) || null,
          phone: i.phone || (meta?.phone as string) || null,
          source: i.intent_type || "unknown",
          bikeTitle: (meta?.bikeTitle as string) || null,
          createdAt: i.created_at,
          lastSeenAt: i.last_seen_at,
          verified: ["rent", "sale", "test_drive"].includes(i.intent_type || "") && i.stage === "contract_generated",
          intentType: i.intent_type,
          intentStage: i.stage,
          urgencyScore: i.urgency_score ?? undefined,
          telegramChatId: i.telegram_user_id || null,
          sourceRoute: i.source_route,
          contactChannel: i.contact_channel,
          rentals: [],
          sales: [],
        });
      }
    }

    // 2. Rental contract artifacts (crew-filtered)
    if (artifactUsers) {
      for (const a of artifactUsers) {
        if (!a.telegram_chat_id && !a.renter_phone) continue;
        const id = a.telegram_chat_id || a.renter_phone || "";
        const existing = leadMap.get(id);
        const bikeTitle = `${a.bike_make || ""} ${a.bike_model || ""}`.trim() || null;
        if (!existing) {
          leadMap.set(id, {
            user_id: id,
            full_name: a.renter_full_name,
            username: null,
            phone: a.renter_phone || null,
            source: "rental_contract",
            bikeTitle,
            createdAt: a.created_at,
            lastSeenAt: a.created_at,
            verified: true,
            telegramChatId: a.telegram_chat_id || null,
            rentals: [{
              rentalId: a.rental_id || "",
              status: "confirmed",
              paymentStatus: "interest_paid",
              startDate: a.rent_start_date,
              endDate: a.rent_end_date,
              bikeTitle,
              totalCost: Number(a.total_amount) || 0,
            }],
            sales: [],
          });
        } else {
          existing.verified = true;
          if (!existing.full_name) existing.full_name = a.renter_full_name;
          if (!existing.phone) existing.phone = a.renter_phone || null;
          existing.rentals.push({
            rentalId: a.rental_id || "",
            status: "confirmed",
            paymentStatus: "interest_paid",
            startDate: a.rent_start_date,
            endDate: a.rent_end_date,
            bikeTitle,
            totalCost: Number(a.total_amount) || 0,
          });
        }
      }
    }

    // 3. Rental secrets (crew-filtered)
    if (secretUsers) {
      for (const s of secretUsers) {
        if (!s.chat_id) continue;
        const existing = leadMap.get(s.chat_id);
        if (!existing) {
          leadMap.set(s.chat_id, {
            user_id: s.chat_id,
            full_name: s.renter_full_name,
            username: null,
            phone: s.renter_phone || null,
            source: s.source_doc_key === "profile_prefill" ? "profile_prefill" : "rental_secret",
            bikeTitle: null,
            createdAt: s.created_at,
            lastSeenAt: s.created_at,
            verified: s.verification_status === "verified",
            telegramChatId: s.chat_id,
            rentals: [],
            sales: [],
          });
        } else {
          if (s.verification_status === "verified") existing.verified = true;
          if (!existing.full_name) existing.full_name = s.renter_full_name;
          if (!existing.phone) existing.phone = s.renter_phone || null;
        }
      }
    }

    // 4. Active/past rentals (crew-filtered)
    if (rentals) {
      for (const r of rentals) {
        if (!r.user_id) continue;
        const existing = leadMap.get(r.user_id);
        const vehicle = r.vehicle as { make?: string; model?: string } | null;
        const bikeTitle = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim() || null;
        const rentalRow: LeadRentalRow = {
          rentalId: r.rental_id,
          status: r.status || "pending_confirmation",
          paymentStatus: r.payment_status || "interest_paid",
          startDate: r.requested_start_date,
          endDate: r.requested_end_date,
          bikeTitle,
          totalCost: Number(r.total_cost) || 0,
          metadata: r.metadata ? (r.metadata as Record<string, unknown>) : null,
          passportMainpagePhoto: (r as any).passport_mainpage_photo || null,
          passportRegistrationPhoto: (r as any).passport_registration_photo || null,
          driversLicenceFrontalPhoto: (r as any).drivers_licence_frontal_photo || null,
        };
        if (!existing) {
          leadMap.set(r.user_id, {
            user_id: r.user_id,
            full_name: null,
            username: null,
            phone: null,
            source: "rental",
            bikeTitle,
            createdAt: r.requested_start_date,
            lastSeenAt: r.requested_start_date,
            verified: ["active", "completed", "confirmed"].includes(r.status || ""),
            telegramChatId: /^\d+$/.test(r.user_id) ? r.user_id : null,
            rentals: [rentalRow],
            sales: [],
          });
        } else {
          existing.rentals.push(rentalRow);
          if (["active", "completed", "confirmed"].includes(r.status || "")) existing.verified = true;
        }
      }
    }

    // 5. Sale contract artifacts (crew-filtered)
    if (saleArtifacts) {
      for (const s of saleArtifacts) {
        const id = s.buyer_phone || "";
        if (!id) continue;
        const existing = leadMap.get(id);
        const bikeTitle = `${s.bike_make || ""} ${s.bike_model || ""}`.trim() || null;
        const saleRow: LeadSaleRow = {
          saleId: s.sale_id,
          bikeTitle,
          salePrice: Number(s.sale_price) || 0,
          createdAt: s.created_at,
        };
        if (!existing) {
          leadMap.set(id, {
            user_id: id,
            full_name: null,
            username: null,
            phone: s.buyer_phone,
            source: "sale_contract",
            bikeTitle,
            createdAt: s.created_at,
            lastSeenAt: s.created_at,
            verified: true,
            telegramChatId: null,
            rentals: [],
            sales: [saleRow],
          });
        } else {
          existing.verified = true;
          if (!existing.phone) existing.phone = s.buyer_phone;
          existing.sales.push(saleRow);
        }
      }
    }

    // ── Parallel enrichment (steps 7-9, 11) ──
    const allUserIds = Array.from(leadMap.keys()).filter((id) => /^\d+$/.test(id));
    const leadPhones = Array.from(leadMap.values()).map((l) => l.phone).filter(Boolean) as string[];

    const [tgUsersResult, secretByPhoneResult, troubledUsersResult, todosResult] = await Promise.all([
      // 7. Enrich from public.users
      allUserIds.length > 0
        ? supabaseAdmin.from("users").select("user_id, username, full_name, phone").in("user_id", allUserIds)
        : { data: [], error: null },
      // 8. Enrich from secrets by phone (crew-filtered)
      leadPhones.length > 0
        ? privateSchema().from("user_rental_secrets").select("chat_id, renter_phone").eq("crew_slug", safeSlug).in("renter_phone", leadPhones) as Promise<{ data: Array<{ chat_id: string | null; renter_phone: string | null }> | null }>
        : { data: [], error: null },
      // 9. Troubled users
      supabaseAdmin.from("users").select("user_id, metadata").not("metadata->>troubled", "is", null),
      // 11. Lead-linked todos (filtered by crew_id + category on DB side)
      supabaseAdmin
        .from("crew_todos")
        .select("id, lead_id, title, description, status, priority, category, created_at, completed_at, assigned_to")
        .eq("crew_id", crewId)
        .eq("category", "lead_followup")
        .order("created_at", { ascending: false }),
    ]);

    const tgUsers = tgUsersResult.data;
    const secretByPhone = secretByPhoneResult.data;
    const troubledUsers = troubledUsersResult.data;
    const todos = todosResult.data;

    // 7. Enrich telegramChatId and username from public.users
    if (tgUsers) {
      for (const l of leadMap.values()) {
        const match = tgUsers.find((u) => u.user_id === l.user_id);
        if (match) {
          l.telegramChatId = l.user_id;
          if (match.username && !l.username) l.username = match.username;
          if (match.full_name && !l.full_name) l.full_name = match.full_name;
          if (match.phone && !l.phone) l.phone = match.phone;
        }
      }
    }

    // 8. Enrich telegramChatId from secrets by phone match
    if (secretByPhone) {
      for (const l of leadMap.values()) {
        if (!l.telegramChatId && l.phone) {
          const match = secretByPhone.find((s) => s.renter_phone === l.phone && s.chat_id);
          if (match) l.telegramChatId = match.chat_id;
        }
      }
    }

    // 9. Troubled users
    const troubledMap = new Map<string, string | null>();
    if (troubledUsers) {
      for (const u of troubledUsers) {
        const meta = u.metadata as Record<string, unknown> | null;
        if (meta?.troubled === true) {
          troubledMap.set(u.user_id, (meta.troubled_reason as string) || null);
        }
      }
    }
    for (const l of leadMap.values()) {
      if (troubledMap.has(l.user_id)) {
        l.troubled = true;
        l.troubledReason = troubledMap.get(l.user_id) || null;
      }
    }

    // 10. Aggregate totals and refs
    for (const l of leadMap.values()) {
      l.contractCount = l.rentals.length;
      l.saleCount = l.sales.length;
      const rentalTotal = l.rentals.reduce((s, r) => s + (Number(r.totalCost) || 0), 0);
      const saleTotal = l.sales.reduce((s, sale) => s + (Number(sale.salePrice) || 0), 0);
      l.totalSpent = rentalTotal + saleTotal;
      const lastRental = l.rentals
        .filter((r) => r.startDate)
        .sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime())[0];
      l.lastRentalDate = lastRental?.startDate || null;
      l.contractRef = lastRental?.rentalId || l.sales[0]?.saleId || null;
    }

    // ── Server-side filtering: only return todos matching loaded leads ──
    const leadUserIds = new Set(Array.from(leadMap.keys()));
    const leadPhonesSet = new Set(
      Array.from(leadMap.values()).map((l) => l.phone).filter(Boolean) as string[]
    );

    const filteredTodos = (todos || []).filter((t) => {
      // Check lead_id column
      if (t.lead_id && leadUserIds.has(t.lead_id)) return true;
      if (t.lead_id && leadPhonesSet.has(t.lead_id)) return true;
      // Fallback: check description JSON
      if (t.description) {
        try {
          const desc = JSON.parse(t.description);
          if (desc.lead_id && (leadUserIds.has(desc.lead_id) || leadPhonesSet.has(desc.lead_id))) return true;
          if (desc.lead_phone && leadPhonesSet.has(desc.lead_phone)) return true;
        } catch { /* ignore */ }
      }
      return false;
    });

    // Deduplicate by title + lead_id — same todo was created multiple times
    const seenTodoKey = new Set<string>();
    const dedupedTodos: typeof filteredTodos = [];
    for (const t of filteredTodos) {
      const key = `${t.lead_id}|${t.title}`;
      if (seenTodoKey.has(key)) continue;
      seenTodoKey.add(key);
      dedupedTodos.push(t);
    }

    return {
      success: true,
      leads: Array.from(leadMap.values()),
      todos: dedupedTodos.map((t) => ({ ...t, description: t.description })),
    };
  } catch (error) {
    logger.error("[getFranchizeLeads] failed:", error);
    return { success: false, error: "Не удалось загрузить лиды" };
  }
}

// ── Document Verification ──────────────────────────────────────────────────────

export interface DocVerificationData {
  rentalId: string;
  photos: {
    passportMainpage: { path: string | null; signedUrl: string | null };
    passportRegistration: { path: string | null; signedUrl: string | null };
    driversLicence: { path: string | null; signedUrl: string | null };
  };
  ocrData: {
    fullName: string | null;
    passport: string | null;
    passportIssuedBy: string | null;
    passportIssueDate: string | null;
    birthDate: string | null;
    registration: string | null;
    driverLicense: string | null;
  };
  checklist: {
    passportVerified: boolean;
    licenseVerified: boolean;
    equipmentHandover: boolean;
    odometerBefore: boolean;
    datesConfirmed: boolean;
    paymentVerified: boolean;
  };
}

export interface GetRentalDocVerificationResult {
  success: boolean;
  data?: DocVerificationData;
  error?: string;
}

/**
 * Get document verification data for a rental.
 * Returns signed URLs for photos, OCR data from user_rental_secrets, and checklist status.
 */
export async function getRentalDocVerification(rentalId: string): Promise<GetRentalDocVerificationResult> {
  if (!rentalId) {
    return { success: false, error: "rentalId is required" };
  }

  try {
    // 1. Fetch rental with photo paths and metadata
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, user_id, metadata, passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo")
      .eq("rental_id", rentalId)
      .single();

    if (rentalError || !rental) {
      return { success: false, error: "Rental not found" };
    }

    // 2. Generate signed URLs for photos (5 min expiry)
    const photoPaths = {
      passportMainpage: (rental as any).passport_mainpage_photo as string | null,
      passportRegistration: (rental as any).passport_registration_photo as string | null,
      driversLicence: (rental as any).drivers_licence_frontal_photo as string | null,
    };

    const signedUrls: Record<string, string | null> = {};
    for (const [key, path] of Object.entries(photoPaths)) {
      if (path) {
        const { data: urlData, error: urlError } = await supabaseAdmin.storage
          .from("docpix")
          .createSignedUrl(path, 300); // 5 minutes
        if (urlError || !urlData?.signedUrl) {
          logger.warn(`[getRentalDocVerification] Failed to create signed URL for ${key}: ${urlError?.message || "no URL"}`);
          signedUrls[key] = null;
        } else {
          signedUrls[key] = urlData.signedUrl;
        }
      } else {
        signedUrls[key] = null;
      }
    }

    // 3. Fetch OCR data from user_rental_secrets
    const { data: secrets } = await privateSchema()
      .from("user_rental_secrets")
      .select("renter_full_name, renter_passport, renter_passport_issued_by, renter_passport_issue_date, renter_birth_date, renter_registration, renter_driver_license")
      .eq("source_rental_id", rentalId)
      .maybeSingle();

    // 4. Extract checklist from metadata
    const metadata = (rental.metadata || {}) as Record<string, any>;
    const checklist = metadata.checklist || {};

    return {
      success: true,
      data: {
        rentalId,
        photos: {
          passportMainpage: { path: photoPaths.passportMainpage, signedUrl: signedUrls.passportMainpage || null },
          passportRegistration: { path: photoPaths.passportRegistration, signedUrl: signedUrls.passportRegistration || null },
          driversLicence: { path: photoPaths.driversLicence, signedUrl: signedUrls.driversLicence || null },
        },
        ocrData: {
          fullName: secrets?.renter_full_name || null,
          passport: secrets?.renter_passport || null,
          passportIssuedBy: secrets?.renter_passport_issued_by || null,
          passportIssueDate: secrets?.renter_passport_issue_date || null,
          birthDate: secrets?.renter_birth_date || null,
          registration: secrets?.renter_registration || null,
          driverLicense: secrets?.renter_driver_license || null,
        },
        checklist: {
          passportVerified: !!checklist.passport_verified,
          licenseVerified: !!checklist.license_verified,
          equipmentHandover: !!(checklist.equipment_handover?.keys && checklist.equipment_handover?.helmet),
          odometerBefore: !!checklist.odometer_before,
          datesConfirmed: !!checklist.dates_confirmed,
          paymentVerified: !!checklist.payment_verified,
        },
      },
    };
  } catch (error) {
    logger.error("[getRentalDocVerification] failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
