"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { privateSchema } from "@/lib/private-secrets";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import { computeLeadStage, computeQrStatus, computeAssignee, STAGE_NEXT_ACTION, matchTodosToLead } from "@/app/franchize/[slug]/leads/lib/pipeline-stages";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";

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
  /** Original operator chat id that created this lead (preserved across QR claim).
   *  Sourced from:
   *    - rentals.created_by_operator_chat_id (FK column, set by /doc-manual L1193)
   *    - rental_contract_artifacts.created_by_operator_chat_id (set by /doc-manual L1615)
   *    - franchize_intents.metadata.operatorId (set by /doc-manual L1765 via upsertFranchizeLead)
   *  Lets classifyIdentityState detect an operator-placeholder lead even after the
   *  renter's chat id has replaced the operator in telegram_user_id / user_id. */
  originalOperatorChatId?: string | null;
  /** Pipeline stage key — derived by computeLeadStage(). */
  stageKey?: string;
  /** Assignee — derived from most recent todo's assigned_to. */
  assigneeId?: string | null;
  /** Assignee display name. */
  assigneeName?: string | null;
  /** Owner — the operator who created the lead. */
  ownerId?: string | null;
  /** Owner display name. */
  ownerName?: string | null;
  /** Next action label, derived from stageKey. */
  nextAction?: string | null;
  /** QR claim status. */
  qrStatus?: "unclaimed" | "sent" | "claimed" | "expired";
}

export interface LeadTodoRow {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  phone: string | null;
  rental_id: string | null;
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
 * Fetch the set of operator Telegram IDs for a crew (owner + active members),
 * and return the crew id so callers don't need a separate lookup.
 *
 * BUG FIX (previously): this function selected only `owner_id` from `crews`,
 * then queried `crew_members` with `crew?.id` which was always `undefined` —
 * so only the owner was ever detected as an operator. Active members who are
 * co-owners/admins/mechanics were treated as real renters.
 */
async function getCrewOperatorIds(
  slug: string,
): Promise<{ ids: Set<string>; crewId: string | null; ownerId: string | null }> {
  const ids = new Set<string>();
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id")
      .eq("slug", slug)
      .maybeSingle();

    if (crew?.owner_id) ids.add(crew.owner_id);
    if (crew?.id) {
      const { data: members } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crew.id)
        .eq("membership_status", "active");

      if (members) {
        for (const m of members) {
          if (m.user_id) ids.add(m.user_id);
        }
      }
    }
    return { ids, crewId: crew?.id ?? null, ownerId: crew?.owner_id ?? null };
  } catch (error) {
    logger.warn("[getCrewOperatorIds] Failed to fetch crew operators:", error);
    return { ids, crewId: null, ownerId: null };
  }
}

/** Check if a chat ID is a numeric Telegram ID (not a phone number or operator). */
function isNumericTelegramId(id: string | null | undefined): boolean {
  if (!id) return false;
  // Telegram IDs are up to 10 digits today; allow up to 12 for future-proofing.
  return /^\d{1,12}$/.test(id);
}

/** Check if a string looks like a phone number. */
function isPhoneString(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^(\+7|8|7)\d{10}$/.test(id.replace(/[\s\-\(\)]/g, ""));
}

/**
 * Normalize a phone number to canonical E.164-ish form (+7XXXXXXXXXX for RU).
 * Accepts +7/7/8 prefix, spaces, dashes, parentheses.
 * Returns null if input is empty or unparseable.
 *
 * BUG FIX: previously, leads were keyed by the raw phone string as typed by the
 * operator in /doc-manual ("8 999 123-45-67"), while todos were keyed by the
 * raw leadPhone passed to createLeadFollowupTodos ("+79991234567").
 * Same person → two different lead cards. Normalizing at every read & write
 * path collapses them into one canonical identity.
 */
/**
 * Classify identity state for a lead.
 *
 * BUG FIX: previously, after QR claim overwrote telegram_user_id with the renter's
 * id, the operator origin was lost and the lead was misclassified as 'claimed_user'.
 * Now we consult `originalOperatorChatId` (preserved across QR claim from
 * rentals.created_by_operator_chat_id, rental_contract_artifacts.created_by_operator_chat_id,
 * or franchize_intents.metadata.operatorId) to detect 'merged' state — operator
 * created it, renter claimed it.
 */
function classifyIdentityState(
  lead: { user_id: string; phone: string | null; telegramChatId?: string | null; sourceCount?: number; originalOperatorChatId?: string | null },
  crewOperatorIds: Set<string>,
): 'claimed_user' | 'phone_only' | 'operator_placeholder' | 'merged' {
  const userId = lead.user_id;
  const originalOp = lead.originalOperatorChatId || null;

  // Operator placeholder: the visible id IS the operator (pre-claim state).
  if (crewOperatorIds.has(userId)) return 'operator_placeholder';

  // Merged: original creator was an operator, but the visible id is now someone else
  // (post-QR-claim). Treat as merged so the UI can show "originally operator-placeholder".
  if (originalOp && crewOperatorIds.has(originalOp) && originalOp !== userId) {
    return 'merged';
  }

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
    // Fetch dynamic operator IDs for this crew (owner + active members).
    // This now also returns crewId, so we skip the duplicate crews lookup below.
    // BUG FIX (previously): getCrewOperatorIds only returned the owner because it
    // didn't select crew.id — the crew_members lookup was a no-op.
    const { ids: crewOperatorIds, crewId } = await getCrewOperatorIds(safeSlug);

    if (!crewId) {
      return { success: false, error: "Экипаж не найден" };
    }

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

    // Cache: rental_id → artifact renter_phone (built from step 2 for step 4 lookups).
    // Stores NORMALIZED phones so rentals step can match against operator-placeholder rentals.
    const artifactPhoneByRentalId = new Map<string, string | null>();
    // Cache: renter_phone (normalized) → set of rental_ids — helps with old artifacts
    // that don't have rental_id backfilled (audit §4).
    const rentalIdsByNormalizedPhone = new Map<string, Set<string>>();
    // Cache: bike_id → bike title — populated from artifacts & sales after main fetch.
    const bikeTitleMap = new Map<string, string>();

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
      // Preserve operator origin across merges — keep the first non-null value we see.
      if (row.originalOperatorChatId && !existing.originalOperatorChatId) {
        existing.originalOperatorChatId = row.originalOperatorChatId;
      }
      // Append rentals/sales from the new row into the existing lead.
      if (row.rentals.length > 0) existing.rentals.push(...row.rentals);
      if (row.sales.length > 0) existing.sales.push(...row.sales);
    };

    // ── Parallel fetch of independent lead sources (steps 1-5) ──
    // NOTE: `users` table is NOT a primary source (no crew filter available).
    // Users are enriched later from public.users by user_id (step 7).
    //
    // BUG FIX (previously): three of these five queries selected columns that do
    // NOT exist in the schema — they silently 400'd, returned null data, and whole
    // sections of the lead map were skipped. Specifically:
    //   - rental_contract_artifacts: bike_make/bike_model/total_amount don't exist
    //     (use requested_bike_id/resolved_bike_id + total_sum)
    //   - sale_contract_artifacts: sale_id/bike_make/bike_model don't exist
    //     (use id + requested_bike_id/resolved_bike_id + total_sum)
    //   - public.users: phone is not a column (it's in metadata->>phone)
    // We also select created_by_operator_chat_id on rentals and rental_contract_artifacts
    // (where the column exists) so classifyIdentityState can detect operator-placeholder
    // leads even after QR claim overwrites user_id. franchize_intents does NOT have this
    // column — for intents, we fall back to metadata.operatorId (set by /doc-manual).
    const [
      intentLeadsResult,
      artifactUsersResult,
      secretUsersResult,
      rentalsResult,
      saleArtifactsResult,
    ] = await Promise.all([
      // 1. franchize_intents (the canonical lead ledger — crew-filtered by slug)
      // NOTE: franchize_intents does NOT have a created_by_operator_chat_id column —
      // that column lives on rentals and rental_contract_artifacts only.
      // For intents created by /doc-manual, the operator id is stored in
      // metadata.operatorId (see /doc-manual.ts ~L1765). We read it as a fallback
      // so classifyIdentityState can still detect operator-origin for intent-only leads.
      supabaseAdmin
        .from("franchize_intents")
        .select("telegram_user_id, phone, intent_type, stage, urgency_score, source_route, contact_channel, last_seen_at, created_at, metadata, bike_id")
        .eq("slug", safeSlug)
        .neq("stage", "dismissed")
        .order("last_seen_at", { ascending: false })
        .limit(800),
      // 2. Rental contract artifacts (crew-filtered by crew_slug).
      // Schema columns: telegram_chat_id, renter_full_name, renter_phone, rental_id,
      //   rent_start_date, rent_end_date, requested_bike_id, resolved_bike_id,
      //   total_sum (numeric), created_at, created_by_operator_chat_id.
      // bike title is resolved later via a cars lookup using requested_bike_id / resolved_bike_id.
      privateSchema()
        .from("rental_contract_artifacts")
        .select("telegram_chat_id, renter_full_name, renter_phone, rental_id, rent_start_date, rent_end_date, requested_bike_id, resolved_bike_id, total_sum, created_at, created_by_operator_chat_id")
        .eq("crew_slug", safeSlug)
        .order("created_at", { ascending: false })
        .limit(300),
      // 3. Rental secrets (crew-filtered by crew_slug)
      privateSchema()
        .from("user_rental_secrets")
        .select("chat_id, renter_full_name, renter_phone, verification_status, source_doc_key, created_at")
        .eq("crew_slug", safeSlug)
        .order("created_at", { ascending: false })
        .limit(300),
      // 4. Active/past rentals (crew-filtered by crew_id). Selects
      // created_by_operator_chat_id so we can detect operator-origin rentals
      // even after the renter's QR claim replaces rentals.user_id.
      supabaseAdmin
        .from("rentals")
        .select("rental_id, user_id, status, payment_status, requested_start_date, requested_end_date, total_cost, metadata, passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo, crew_id, created_by_operator_chat_id, vehicle:cars(make, model)")
        .eq("crew_id", crewId)
        .order("created_at", { ascending: false })
        .limit(500),
      // 5. Sale contract artifacts (crew-filtered by crew_slug).
      // Schema columns: id (uuid PK), telegram_chat_id, buyer_phone, requested_bike_id,
      //   resolved_bike_id, sale_price (text), total_sum (numeric), created_at.
      privateSchema()
        .from("sale_contract_artifacts")
        .select("id, telegram_chat_id, buyer_phone, requested_bike_id, resolved_bike_id, sale_price, total_sum, created_at")
        .eq("crew_slug", safeSlug)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    // Surface query errors so future bugs are visible (previously: silent failures
    // made the matching layer look broken when in fact the queries were 400'ing).
    if (intentLeadsResult.error) logger.error("[getFranchizeLeads] franchize_intents query failed:", intentLeadsResult.error);
    if (artifactUsersResult.error) logger.error("[getFranchizeLeads] rental_contract_artifacts query failed:", artifactUsersResult.error);
    if (secretUsersResult.error) logger.error("[getFranchizeLeads] user_rental_secrets query failed:", secretUsersResult.error);
    if (rentalsResult.error) logger.error("[getFranchizeLeads] rentals query failed:", rentalsResult.error);
    if (saleArtifactsResult.error) logger.error("[getFranchizeLeads] sale_contract_artifacts query failed:", saleArtifactsResult.error);

    const intentLeads = intentLeadsResult.data;
    const artifactUsers = artifactUsersResult.data;
    const secretUsers = secretUsersResult.data;
    const rentals = rentalsResult.data;
    const saleArtifacts = saleArtifactsResult.data;

    // Pre-fetch bike titles for artifacts + sales so we can build human-readable bikeTitle.
    // The rentals step already joins cars via vehicle:cars(make, model), so it doesn't need this.
    //
    // IMPORTANT: this MUST happen BEFORE the artifact/sale ingestion loops below, because
    // those loops call bikeTitleMap.get(bikeId) to set bikeTitle on each rental/sale row.
    // Previously this was deferred to the enrichment phase, which meant bikeTitleMap was
    // empty when artifact rows were built — artifact-based deals showed generic "Байк"
    // instead of the real title, and the later backfill couldn't recover them because
    // the rows only store bikeTitle (not bike_id).
    const artifactBikeIds = new Set<string>();
    for (const a of artifactUsers ?? []) {
      const bid = a.resolved_bike_id || a.requested_bike_id;
      if (bid) artifactBikeIds.add(bid);
    }
    for (const s of saleArtifacts ?? []) {
      const bid = s.resolved_bike_id || s.requested_bike_id;
      if (bid) artifactBikeIds.add(bid);
    }
    if (artifactBikeIds.size > 0) {
      const { data: bikeRows, error: bikeErr } = await supabaseAdmin
        .from("cars")
        .select("id, make, model")
        .in("id", Array.from(artifactBikeIds));
      if (bikeErr) {
        logger.error("[getFranchizeLeads] cars (bike titles) pre-fetch failed:", bikeErr);
      } else if (bikeRows) {
        for (const b of bikeRows) {
          const title = `${b.make || ""} ${b.model || ""}`.trim();
          if (title) bikeTitleMap.set(b.id, title);
        }
      }
    }

    // ── Franchize intents
    if (intentLeads) {
      for (const i of intentLeads) {
        if (!i.telegram_user_id && !i.phone) continue;
        // Normalize phone so a lead keyed by "+79991234567" matches a todo keyed by "89991234567".
        const normalizedIntentPhone = normalizePhone(i.phone) || normalizePhone((i.metadata as any)?.phone);
        const id = i.telegram_user_id || normalizedIntentPhone || "";
        if (!id) continue;
        const meta = i.metadata as Record<string, unknown> | null;
        // franchize_intents has no created_by_operator_chat_id column, but /doc-manual
        // stores the operator id in metadata.operatorId. Read it as a fallback so
        // classifyIdentityState can still detect operator-origin for intent-only leads
        // (leads with no rental/artifact yet).
        const originalOp =
          (meta?.operatorId as string | null) || null;
        addOrMerge({
          user_id: id,
          full_name: (meta?.name as string) || null,
          username: (meta?.username as string) || null,
          phone: normalizedIntentPhone,
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
          originalOperatorChatId: originalOp,
          rentals: [],
          sales: [],
        });
      }
    }

    // 2. Rental contract artifacts (crew-filtered)
    // IMPORTANT: artifact telegram_chat_id is often the OPERATOR's ID (set by /doc-manual).
    // When it matches a known operator, prefer renter_phone as the lead identity key
    // so the lead groups under the real renter's phone, not the operator placeholder.
    //
    // BUG FIX (previously): the query selected bike_make/bike_model/total_amount which
    // don't exist on rental_contract_artifacts, so this entire step silently 400'd and
    // no artifact ever reached leadMap. Now we select the real columns and resolve
    // bike title via the pre-fetched bikeTitleMap.
    if (artifactUsers) {
      for (const a of artifactUsers) {
        if (!a.telegram_chat_id && !a.renter_phone) continue;
        // Normalize phone ("8 999 ..." → "+7999...") so it can match other sources.
        const normalizedArtifactPhone = normalizePhone(a.renter_phone);
        // Cache phone by rental_id for rental-step lookups (use the normalized form).
        if (a.rental_id) {
          artifactPhoneByRentalId.set(a.rental_id, normalizedArtifactPhone);
          // Also index by normalized phone → rental_ids (helps old artifacts without rental_id).
          if (normalizedArtifactPhone) {
            const set = rentalIdsByNormalizedPhone.get(normalizedArtifactPhone) ?? new Set<string>();
            set.add(a.rental_id);
            rentalIdsByNormalizedPhone.set(normalizedArtifactPhone, set);
          }
        }
        // Determine whether this artifact is still in the pre-claim state (operator
        // owns it, renter hasn't scanned QR yet).
        //
        // /doc-manual L1614-1615 sets:
        //   telegram_chat_id = String(userId)              // operator's TG id
        //   created_by_operator_chat_id = String(userId)   // same, preserved forever
        // After QR claim, telegram_chat_id is overwritten with the renter's TG id,
        // but created_by_operator_chat_id is never touched.
        //
        // So: telegram_chat_id === created_by_operator_chat_id ⟺ pre-claim.
        // This is more robust than isOperatorPlaceholder() because it catches
        // operators who are no longer in crew_members, were never added, or were
        // added with membership_status != 'active'. It also catches the case where
        // crewOperatorIds is stale (e.g. owner just changed but old owner still
        // appears on historical artifacts).
        const isPreClaimByOperatorColumn =
          !!a.created_by_operator_chat_id &&
          a.telegram_chat_id === a.created_by_operator_chat_id;
        const isOperatorFromCrew = isOperatorPlaceholder(a.telegram_chat_id);
        const preferPhone =
          (isPreClaimByOperatorColumn || isOperatorFromCrew) && !!normalizedArtifactPhone;
        const id = preferPhone
          ? normalizedArtifactPhone!
          : (a.telegram_chat_id || normalizedArtifactPhone || "");
        if (!id) continue;
        // Resolve bike title from the pre-fetched cars map.
        const bikeId = a.resolved_bike_id || a.requested_bike_id;
        const bikeTitle = (bikeId && bikeTitleMap.get(bikeId)) || null;
        // Preserve the original operator chat id so classifyIdentityState can detect
        // operator-origin even after QR claim replaces telegram_chat_id with renter id.
        const originalOp = a.created_by_operator_chat_id || null;
        const rentalRow: LeadRentalRow = {
          rentalId: a.rental_id || "",
          status: "confirmed",
          paymentStatus: "interest_paid",
          startDate: a.rent_start_date,
          endDate: a.rent_end_date,
          bikeTitle,
          totalCost: Number(a.total_sum) || 0,
        };
        addOrMerge({
          user_id: id,
          full_name: a.renter_full_name,
          username: null,
          phone: normalizedArtifactPhone,
          source: "rental_contract",
          bikeTitle,
          createdAt: a.created_at,
          lastSeenAt: a.created_at,
          verified: true,
          // Store the operator's telegram_chat_id separately (not as lead key)
          telegramChatId: preferPhone ? null : (a.telegram_chat_id || null),
          originalOperatorChatId: originalOp,
          rentals: [rentalRow],
          sales: [],
        });
      }
    }

    // 3. Rental secrets (crew-filtered)
    if (secretUsers) {
      for (const s of secretUsers) {
        if (!s.chat_id) continue;
        const normalizedSecretPhone = normalizePhone(s.renter_phone);
        const existing = leadMap.get(s.chat_id);
        if (!existing) {
          leadMap.set(s.chat_id, {
            user_id: s.chat_id,
            full_name: s.renter_full_name,
            username: null,
            phone: normalizedSecretPhone,
            source: s.source_doc_key === "profile_prefill" ? "profile_prefill" : "rental_secret",
            bikeTitle: null,
            createdAt: s.created_at,
            lastSeenAt: s.created_at,
            verified: s.verification_status === "verified",
            telegramChatId: s.chat_id,
            rentals: [],
            sales: [],
            sourceCount: 1,
          });
        } else {
          existing.sourceCount = (existing.sourceCount || 1) + 1;
          if (s.verification_status === "verified") existing.verified = true;
          if (!existing.full_name) existing.full_name = s.renter_full_name;
          if (!existing.phone && normalizedSecretPhone) existing.phone = normalizedSecretPhone;
        }
      }
    }

    // 4. Active/past rentals (crew-filtered)
    //
    // BUG FIX: previously, when rentals.user_id was the crew owner (placeholder),
    // we tried to re-key the lead by artifact renter_phone — but only when the
    // artifact had a rental_id. For old artifacts without rental_id, the lookup
    // returned nothing and the rental stayed grouped under the operator (and was
    // then hidden client-side by hidePlaceholders=true). Now we also try matching
    // by normalized renter_phone pulled from rental.metadata.renter_phone as a
    // secondary fallback.
    if (rentals) {
      for (const r of rentals) {
        if (!r.user_id) continue;
        // Determine whether this rental is still in the pre-claim state (operator
        // owns it, renter hasn't scanned QR yet).
        //
        // /doc-manual L1191-1193 sets:
        //   user_id = crewOwnerChatId                       // operator's TG id
        //   owner_id = crewOwnerChatId                      // same
        //   created_by_operator_chat_id = crewOwnerChatId   // preserved forever
        // After QR claim, user_id is overwritten with the renter's TG id, but
        // created_by_operator_chat_id is never touched.
        //
        // So: user_id === created_by_operator_chat_id ⟺ pre-claim.
        // More robust than isCrewOwnerId() because it catches former operators,
        // never-added operators, and stale crewOperatorIds caches.
        const rentalCreatedByOp = (r as any).created_by_operator_chat_id || null;
        const isPreClaimByOperatorColumn =
          !!rentalCreatedByOp && r.user_id === rentalCreatedByOp;
        const isOperatorFromCrew = isCrewOwnerId(r.user_id);
        const prefersPhone = isPreClaimByOperatorColumn || isOperatorFromCrew;
        const artifactPhone = artifactPhoneByRentalId.get(r.rental_id) || null;
        // Secondary fallback: pull renter_phone out of rental.metadata (some older
        // rentals were created with it stored there).
        const metaRenterPhone = (r.metadata && typeof r.metadata === 'object')
          ? normalizePhone((r.metadata as Record<string, unknown>).renter_phone as string | undefined)
          : null;
        const effectivePhone = artifactPhone || metaRenterPhone || null;
        const effectiveId = (prefersPhone && effectivePhone) ? effectivePhone : r.user_id;

        const existing = leadMap.get(effectiveId) ||
          // Fallback: try matching by renter_phone from metadata (handles existing rentals
          // whose user_id is telegramUserId while the lead key is phone)
          (metaRenterPhone ? leadMap.get(metaRenterPhone) || null : null);
        const vehicle = r.vehicle as { make?: string; model?: string } | null;
        const bikeTitle = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim() || null;
        // rentals.created_by_operator_chat_id preserves who originally created the rental
        // (the operator). Use it to detect operator-origin even after QR claim replaces
        // rentals.user_id with the renter's id.
        const originalOp = rentalCreatedByOp;
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
            phone: effectivePhone,
            source: "rental",
            bikeTitle,
            createdAt: r.requested_start_date,
            lastSeenAt: r.requested_start_date,
            verified: ["active", "completed", "confirmed"].includes(r.status || ""),
            telegramChatId: /^\d+$/.test(r.user_id) ? r.user_id : null,
            originalOperatorChatId: originalOp,
            rentals: [rentalRow],
            sales: [],
            sourceCount: 1,
          });
        } else {
          existing.sourceCount = (existing.sourceCount || 1) + 1;
          existing.rentals.push(rentalRow);
          if (!existing.phone && effectivePhone) existing.phone = effectivePhone;
          if (originalOp && !existing.originalOperatorChatId) existing.originalOperatorChatId = originalOp;
          if (["active", "completed", "confirmed"].includes(r.status || "")) existing.verified = true;
        }
      }
    }

    // 5. Sale contract artifacts (crew-filtered)
    // Same operator-phone preference: if telegram_chat_id is an operator, use buyer_phone.
    //
    // BUG FIX (previously): the query selected sale_id/bike_make/bike_model which
    // don't exist on sale_contract_artifacts, so sales NEVER appeared on the leads
    // page. Now we use the real columns: `id` (uuid PK), requested_bike_id,
    // resolved_bike_id, total_sum (numeric — preferred over sale_price text).
    if (saleArtifacts) {
      for (const s of saleArtifacts) {
        const normalizedBuyerPhone = normalizePhone(s.buyer_phone);
        // Sale artifacts have NO created_by_operator_chat_id column and NO QR claim
        // flow (audit §10 #5 — open question, currently sales are always operator-
        // created). So telegram_chat_id is always the operator's id, never the
        // buyer's. Always prefer buyer_phone when present — this is safe because:
        //   - If telegram_chat_id is the operator → lead groups under buyer's phone (correct)
        //   - If telegram_chat_id is somehow the buyer (rare edge case) → lead still
        //     groups under buyer's phone (still correct, just keyed differently)
        //   - buyer_phone is a stable identifier that doesn't change post-creation
        // This also catches the case where the operator isn't in crewOperatorIds
        // (former member, never-added, stale cache) — isOperatorPlaceholder would
        // miss those, but we don't need it here.
        const preferPhone = !!normalizedBuyerPhone;
        const id = preferPhone
          ? normalizedBuyerPhone!
          : (s.telegram_chat_id || "");
        if (!id) continue;
        // Resolve bike title from the pre-fetched cars map.
        const bikeId = s.resolved_bike_id || s.requested_bike_id;
        const bikeTitle = (bikeId && bikeTitleMap.get(bikeId)) || null;
        const saleRow: LeadSaleRow = {
          saleId: s.id,  // sale_contract_artifacts.id is the uuid PK; the old "sale_id" column never existed
          bikeTitle,
          salePrice: Number(s.total_sum ?? s.sale_price) || 0,
          createdAt: s.created_at,
        };
        addOrMerge({
          user_id: id,
          full_name: null,
          username: null,
          phone: normalizedBuyerPhone,
          source: "sale_contract",
          bikeTitle,
          createdAt: s.created_at,
          lastSeenAt: s.created_at,
          verified: true,
          telegramChatId: s.telegram_chat_id || null,
          rentals: [],
          sales: [saleRow],
        });
      }
    }

    // ── Parallel enrichment (steps 7-9, 11) ──
    //
    // BUG FIX (previously): three more silent failures here:
    //   - public.users select included `phone` which is NOT a column (it's in metadata->>phone).
    //     The whole query 400'd → no telegram username/full_name enrichment ever happened.
    //   - crew_todos was filtered to category=lead_followup only, dropping rental_verification
    //     todos (passport check, return checklist) which are tied to the same rental_id.
    // Bike titles are now pre-fetched BEFORE the artifact/sale loops (see above), so they
    // are no longer part of this enrichment batch.
    const allUserIds = Array.from(leadMap.keys()).filter((id) => /^\d+$/.test(id));
    const leadPhones = Array.from(leadMap.values()).map((l) => l.phone).filter(Boolean) as string[];

    const [tgUsersResult, secretByPhoneResult, troubledUsersResult, todosResult] = await Promise.all([
      // 7. Enrich from public.users — drop the non-existent `phone` column; phone is in metadata.
      allUserIds.length > 0
        ? supabaseAdmin.from("users").select("user_id, username, full_name, metadata").in("user_id", allUserIds)
        : { data: [], error: null },
      // 8. Enrich from secrets by phone (crew-filtered)
      leadPhones.length > 0
        ? privateSchema().from("user_rental_secrets").select("chat_id, renter_phone").eq("crew_slug", safeSlug).in("renter_phone", leadPhones) as Promise<{ data: Array<{ chat_id: string | null; renter_phone: string | null }> | null }>
        : { data: [], error: null },
      // 9. Troubled users
      supabaseAdmin.from("users").select("user_id, metadata").not("metadata->>troubled", "is", null),
      // 11. Lead-linked todos (filtered by crew_id on DB side).
      // BUG FIX: include both `lead_followup` AND `rental_verification` — the latter
      // covers passport/odometer/return-checklist todos which are tied to the same
      // rental_id and absolutely belong on the lead's card.
      supabaseAdmin
        .from("crew_todos")
        .select("id, lead_id, user_id, phone, rental_id, title, description, status, priority, category, created_at, completed_at, assigned_to")
        .eq("crew_id", crewId)
        .in("category", ["lead_followup", "rental_verification"])
        .order("created_at", { ascending: false }),
    ]);

    // Surface enrichment query errors so future bugs are visible.
    if (tgUsersResult.error) logger.error("[getFranchizeLeads] users enrichment query failed:", tgUsersResult.error);
    if (secretByPhoneResult.error) logger.error("[getFranchizeLeads] secrets-by-phone enrichment query failed:", secretByPhoneResult.error);
    if (troubledUsersResult.error) logger.error("[getFranchizeLeads] troubled-users query failed:", troubledUsersResult.error);
    if (todosResult.error) logger.error("[getFranchizeLeads] crew_todos query failed:", todosResult.error);

    const tgUsers = tgUsersResult.data;
    const secretByPhone = secretByPhoneResult.data;
    const troubledUsers = troubledUsersResult.data;
    const todos = todosResult.data;

    // Backfill top-level bikeTitle on leads that didn't get one set during the
    // artifact/sale step (e.g. leads whose only source is franchize_intents or
    // user_rental_secrets). bikeTitleMap is already fully populated from the
    // pre-fetch above, but rentals/sales rows already carry their own bikeTitle.
    for (const l of leadMap.values()) {
      if (!l.bikeTitle) {
        const firstRentalWithTitle = l.rentals.find((r) => r.bikeTitle);
        const firstSaleWithTitle = l.sales.find((s) => s.bikeTitle);
        if (firstRentalWithTitle) l.bikeTitle = firstRentalWithTitle.bikeTitle;
        else if (firstSaleWithTitle) l.bikeTitle = firstSaleWithTitle.bikeTitle;
      }
    }

    // 7. Enrich telegramChatId and username from public.users.
    // Phone is read from metadata->>phone (the users table has no phone column).
    if (tgUsers) {
      for (const l of leadMap.values()) {
        const match = tgUsers.find((u) => u.user_id === l.user_id);
        if (match) {
          l.telegramChatId = l.user_id;
          if (match.username && !l.username) l.username = match.username;
          if (match.full_name && !l.full_name) l.full_name = match.full_name;
          const meta = match.metadata as Record<string, unknown> | null;
          const metaPhone = normalizePhone(meta?.phone as string | undefined);
          if (metaPhone && !l.phone) l.phone = metaPhone;
        }
      }
    }

    // 8. Enrich telegramChatId from secrets by phone match
    if (secretByPhone) {
      for (const l of leadMap.values()) {
        if (!l.telegramChatId && l.phone) {
          // Compare normalized phones so "8 999..." in secrets matches "+7999..." in leads.
          const match = secretByPhone.find((s) =>
            s.chat_id &&
            s.renter_phone &&
            normalizePhone(s.renter_phone) === l.phone,
          );
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
      // Compute pipeline stage, QR status, next action
      l.stageKey = computeLeadStage(l);
      l.qrStatus = computeQrStatus(l);
      l.nextAction = (STAGE_NEXT_ACTION as Record<string, string>)[l.stageKey] || null;
      l.ownerId = l.originalOperatorChatId || null;
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
     * Extract rental_id from todo (direct column preferred, fall back to description JSON).
     */
    const getTodoRentalId = (t: typeof todos[number]): string | null => {
      // 1. Direct rental_id column (Phase 3c — real FK, no parsing needed)
      if (t.rental_id) return t.rental_id;
      // 2. Legacy: parse from description JSON
      if (!t.description) return null;
      try {
        const desc = JSON.parse(t.description);
        if (desc.rental_id && typeof desc.rental_id === 'string') return desc.rental_id;
      } catch { /* ignore */ }
      return null;
    };

    /**
     * Get the lead identifier from a todo.
     *
     * BUG FIX: previously used /^\d{1,9}$/ which rejects 10-digit Telegram IDs
     * (e.g. 7813830016, one of the operators in the audit). Most modern users have
     * 10-digit IDs, so this regex silently dropped their todos. Now allows up to 12 digits.
     * Also normalizes phones so a todo keyed by "8999..." matches a lead keyed by "+7999...".
     */
    const getTodoLeadId = (t: typeof todos[number]): string | null => {
      // 1. user_id column — canonical Telegram chat_id
      if (t.user_id && /^\d{1,12}$/.test(t.user_id)) return t.user_id;
      // 2. phone column — phone-only leads (normalize for cross-source matching)
      if (t.phone) {
        const normalized = normalizePhone(t.phone);
        if (normalized) return normalized;
      }
      // 3. lead_id column — legacy fallback
      if (t.lead_id) {
        if (/^\d{1,12}$/.test(t.lead_id)) return t.lead_id;
        // Phone-shaped lead_id (legacy) — normalize.
        const normalizedLead = normalizePhone(t.lead_id);
        if (normalizedLead) return normalizedLead;
        if (t.lead_id.includes('-')) return t.lead_id;
      }
      // 4. description JSON — legacy fallback
      if (t.description) {
        try {
          const desc = JSON.parse(t.description);
          if (desc.user_id && typeof desc.user_id === 'string' && /^\d{1,12}$/.test(desc.user_id)) return desc.user_id;
          if (desc.phone && typeof desc.phone === 'string') {
            const normalized = normalizePhone(desc.phone);
            if (normalized) return normalized;
          }
          if (desc.lead_id && typeof desc.lead_id === 'string') {
            if (/^\d{1,12}$/.test(desc.lead_id)) return desc.lead_id;
            const normalizedLead = normalizePhone(desc.lead_id);
            if (normalizedLead) return normalizedLead;
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

    // Compute assignee for each lead from its todos
    const assigneeIds = new Set<string>();
    for (const t of dedupedTodos) {
      if (t.assigned_to) assigneeIds.add(t.assigned_to);
    }
    const assigneeIdsList = Array.from(assigneeIds);
    if (assigneeIdsList.length > 0) {
      const { data: assigneeUsers } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name")
        .in("user_id", assigneeIdsList);
      const assigneeMap = new Map<string, { username: string | null; full_name: string | null }>();
      for (const u of assigneeUsers ?? []) {
        assigneeMap.set(u.user_id, { username: u.username, full_name: u.full_name });
      }
      for (const l of leadMap.values()) {
        l.assigneeId = computeAssignee(l, dedupedTodos);
        if (l.assigneeId) {
          const a = assigneeMap.get(l.assigneeId);
          l.assigneeName = a?.full_name || a?.username || null;
        }
        if (l.ownerId) {
          const o = assigneeMap.get(l.ownerId) || (tgUsers as any[])?.find((u: any) => u.user_id === l.ownerId);
          l.ownerName = (o as any)?.full_name || (o as any)?.username || null;
        }
      }
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