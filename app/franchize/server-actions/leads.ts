"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";

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
  /** Identity state for UI classification */
  identityState?: 'claimed_user' | 'phone_only' | 'operator_placeholder' | 'merged';
  /** Count of source records merged into this lead */
  sourceCount?: number;
}

export interface LeadTodoRow {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  phone: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  completed_at: string | null;
  assigned_to: string | null;
}

export interface GetFranchizeLeadsResult {
  success: boolean;
  leads?: LeadRow[];
  todos?: LeadTodoRow[];
  error?: string;
}

/**
 * Fetch the set of operator Telegram IDs for a crew (owner + active members).
 * These IDs should never be treated as real renter leads without explicit confirmation.
 */
async function getCrewOperatorIds(slug: string): Promise<Set<string>> {
  const ids = new Set<string>();
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (crew?.owner_id) ids.add(crew.owner_id);

    const { data: members } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crew?.id)
      .eq("membership_status", "active");

    if (members) {
      for (const m of members) {
        if (m.user_id) ids.add(m.user_id);
      }
    }
  } catch (error) {
    logger.warn("[getCrewOperatorIds] Failed to fetch crew operators:", error);
  }
  return ids;
}

/** Check if a chat ID is a numeric Telegram ID (not a phone number or operator). */
function isNumericTelegramId(id: string | null | undefined): boolean {
  if (!id) return false;
  // Telegram IDs are up to 10 digits, not starting with + or 8/7 followed by 10
  return /^\d{1,10}$/.test(id);
}

/** Check if a string looks like a phone number. */
function isPhoneString(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^(\+7|8|7)\d{10}$/.test(id.replace(/[\s\-\(\)]/g, ""));
}

/**
 * Classify identity state for a lead.
 */
function classifyIdentityState(
  lead: { user_id: string; phone: string | null; telegramChatId?: string | null; sourceCount?: number },
  crewOperatorIds: Set<string>
): 'claimed_user' | 'phone_only' | 'operator_placeholder' | 'merged' {
  // If merged from multiple sources, still show the underlying state
  const userId = lead.user_id;
  
  // Check if identity is a crew operator
  if (crewOperatorIds.has(userId)) return 'operator_placeholder';
  
  // Check if identity is a phone number (no Telegram user linked)
  if (isPhoneString(userId) || (lead.phone && userId === lead.phone)) return 'phone_only';
  
  // Has a real Telegram user_id AND it's not an operator
  if (isNumericTelegramId(userId)) return 'claimed_user';
  
  // If merged from multiple source types
  if ((lead.sourceCount || 0) >= 2) return 'merged';
  
  // Fallback: look at telegramChatId
  if (lead.telegramChatId && isNumericTelegramId(lead.telegramChatId) && !crewOperatorIds.has(lead.telegramChatId)) {
    return 'claimed_user';
  }
  
  // Default: phone-only by elimination
  if (lead.phone) return 'phone_only';
  
  return 'operator_placeholder';
}

export async function getFranchizeLeads(slug: string): Promise<GetFranchizeLeadsResult> {
  noStore();
  const safeSlug = slug.trim();
  try {
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", safeSlug)
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден" };
    }

    const crewId = crew.id;
    
    // Fetch dynamic operator IDs for this crew (owner + active members)
    const crewOperatorIds = await getCrewOperatorIds(safeSlug);

    /** Check if a chat ID is a crew operator (not a real renter). */
    const isOperatorPlaceholder = (id: string | null | undefined): boolean => {
      if (!id) return false;
      return crewOperatorIds.has(id);
    };

    /** Check if a rental user_id belongs to a crew operator. */
    const isCrewOwnerId = (id: string | null | undefined): boolean => {
      if (!id) return false;
      return crewOperatorIds.has(id);
    };
    type MutableLead = Omit<LeadRow, "rentals" | "sales"> & { rentals: LeadRentalRow[]; sales: LeadSaleRow[] };
    const leadMap = new Map<string, MutableLead>();

    // Cache: rental_id → artifact renter_phone (built from step 2 for step 4 lookups)
    const artifactPhoneByRentalId = new Map<string, string | null>();

    const addOrMerge = (row: MutableLead) => {
      const existing = leadMap.get(row.user_id);
      if (!existing) {
        // First entry for this key — init sourceCount
        leadMap.set(row.user_id, { ...row, sourceCount: 1 });
        return;
      }
      // Merge — increment sourceCount
      existing.sourceCount = (existing.sourceCount || 1) + 1;
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
        .select("telegram_chat_id, buyer_phone, sale_id, bike_make, bike_model, sale_price, created_at")
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
    // IMPORTANT: artifact telegram_chat_id is often the OPERATOR's ID (set by /doc-manual).
    // When it matches a known operator, prefer renter_phone as the lead identity key
    // so the lead groups under the real renter's phone, not the operator placeholder.
    if (artifactUsers) {
      for (const a of artifactUsers) {
        if (!a.telegram_chat_id && !a.renter_phone) continue;
        // Cache phone by rental_id for rental-step lookups
        if (a.rental_id) {
          artifactPhoneByRentalId.set(a.rental_id, a.renter_phone || null);
        }
        // If telegram_chat_id is an operator placeholder, prefer renter_phone
        const preferPhone = isOperatorPlaceholder(a.telegram_chat_id) && a.renter_phone;
        const id = preferPhone ? a.renter_phone! : (a.telegram_chat_id || a.renter_phone || "");
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
            // Store the operator's telegram_chat_id separately (not as lead key)
            telegramChatId: preferPhone ? null : (a.telegram_chat_id || null),
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
        // If rental user_id is a known operator placeholder, try to use the
        // renter's phone from the artifact (cached by rental_id) as identity key.
        const prefersPhone = isCrewOwnerId(r.user_id);
        const artifactPhone = artifactPhoneByRentalId.get(r.rental_id);
        const effectiveId = (prefersPhone && artifactPhone) ? artifactPhone : r.user_id;

        const existing = leadMap.get(effectiveId);
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
          leadMap.set(effectiveId, {
            user_id: effectiveId,
            full_name: null,
            username: null,
            phone: artifactPhone || null,
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
          if (!existing.phone && artifactPhone) existing.phone = artifactPhone;
          if (["active", "completed", "confirmed"].includes(r.status || "")) existing.verified = true;
        }
      }
    }

    // 5. Sale contract artifacts (crew-filtered)
    // Same operator-phone preference: if telegram_chat_id is an operator, use buyer_phone
    if (saleArtifacts) {
      for (const s of saleArtifacts) {
        const preferPhone = isOperatorPlaceholder(s.telegram_chat_id) && s.buyer_phone;
        const id = preferPhone ? s.buyer_phone! : (s.telegram_chat_id || s.buyer_phone || "");
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
            phone: s.buyer_phone || null,
            source: "sale_contract",
            bikeTitle,
            createdAt: s.created_at,
            lastSeenAt: s.created_at,
            verified: true,
            telegramChatId: s.telegram_chat_id || null,
            rentals: [],
            sales: [saleRow],
          });
        } else {
          existing.verified = true;
          if (!existing.phone) existing.phone = s.buyer_phone || null;
          if (!existing.telegramChatId) existing.telegramChatId = s.telegram_chat_id || null;
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
        .select("id, lead_id, user_id, phone, title, description, status, priority, category, created_at, completed_at, assigned_to")
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

    // ── Identity state classification ──
    // Classify each lead so the UI can show operator placeholders, phone-only leads, etc.
    for (const l of leadMap.values()) {
      l.identityState = classifyIdentityState(l, crewOperatorIds);
    }

    // ── Filter out pure operator-placeholder leads with no activity ──
    // If a lead's only source is operator artifacts with no renter phone, no rentals,
    // no todos — it's noise. Keep leads with activity for operator visibility.
    for (const [key, l] of leadMap.entries()) {
      if (
        l.identityState === 'operator_placeholder' &&
        l.rentals.length === 0 &&
        l.sales.length === 0 &&
        (l.sourceCount || 0) <= 1
      ) {
        // Still keep — they'll be filtered on client if user picks "hide placeholders"
        // But flag them explicitly
      }
    }

    // ── Server-side filtering: return todos matching loaded leads ──
    //
    // Matching strategy (Phase 1 identity fix):
    //  1. rental_id from description JSON → if leadMap has a lead whose rental includes this rental_id
    //  2. user_id column (canonical Telegram chat_id)
    //  3. phone column (phone-only leads)
    //  4. lead_id column (legacy)
    //  5. description JSON identity fields (legacy)
    //
    // This ensures operator-created todos (which have user_id=operator in description)
    // can still be matched by rental_id BEFORE the QR claim propagates the real renter ID.
    const leadUserIds = new Set(Array.from(leadMap.keys()));

    // Build rental_id → lead user_id lookup for rental_id-based todo matching
    const rentalIdToLeadId = new Map<string, string>();
    for (const [leadId, lead] of leadMap.entries()) {
      for (const r of lead.rentals) {
        if (r.rentalId) rentalIdToLeadId.set(r.rentalId, leadId);
      }
    }

    /**
     * Extract rental_id from todo description JSON.
     */
    const getTodoRentalId = (t: typeof todos[number]): string | null => {
      if (!t.description) return null;
      try {
        const desc = JSON.parse(t.description);
        if (desc.rental_id && typeof desc.rental_id === 'string') return desc.rental_id;
      } catch { /* ignore */ }
      return null;
    };

    /**
     * Get the lead identifier from a todo.
     */
    const getTodoLeadId = (t: typeof todos[number]): string | null => {
      // 1. user_id column — canonical Telegram chat_id
      if (t.user_id && /^\d{1,9}$/.test(t.user_id)) return t.user_id;
      // 2. phone column — phone-only leads
      if (t.phone) return t.phone;
      // 3. lead_id column — legacy fallback
      if (t.lead_id) {
        if (/^\d{1,9}$/.test(t.lead_id)) return t.lead_id;
        if (t.lead_id.includes('-')) return t.lead_id;
      }
      // 4. description JSON — legacy fallback
      if (t.description) {
        try {
          const desc = JSON.parse(t.description);
          if (desc.user_id && typeof desc.user_id === 'string' && /^\d{1,9}$/.test(desc.user_id)) return desc.user_id;
          if (desc.phone && typeof desc.phone === 'string') return desc.phone;
          if (desc.lead_id && typeof desc.lead_id === 'string') {
            if (/^\d{1,9}$/.test(desc.lead_id)) return desc.lead_id;
            if (desc.lead_id.includes('-')) return desc.lead_id;
          }
        } catch { /* ignore */ }
      }
      return null;
    };

    const filteredTodos = (todos || []).filter((t) => {
      // 1. Match by rental_id from description (strongest link — works before QR claim)
      const todoRentalId = getTodoRentalId(t);
      if (todoRentalId && rentalIdToLeadId.has(todoRentalId)) return true;

      // 2-5. Match by identity fallback chain
      const todoLeadId = getTodoLeadId(t);
      if (todoLeadId && leadUserIds.has(todoLeadId)) return true;

      return false;
    });

    // Deduplicate by todo id — each todo row should appear only once
    const seenTodoId = new Set<string>();
    const dedupedTodos: typeof filteredTodos = [];
    for (const t of filteredTodos) {
      if (t.id && seenTodoId.has(t.id)) continue;
      if (t.id) seenTodoId.add(t.id);
      // Fallback dedup by lead_id|title for todos without id
      const key = `${t.lead_id || '?'}|${t.title}`;
      if (seenTodoId.has(key)) continue;
      seenTodoId.add(key);
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
