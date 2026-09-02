"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from "next/cache";
import { computeLeadStage, computeQrStatus, computeAssignee, STAGE_NEXT_ACTION, matchTodosToLead } from "@/app/franchize/[slug]/leads/lib/pipeline-stages";
import { normalizePhone } from "@/app/franchize/lib/phone-utils";
import type { LeadRentalRow } from "@/app/franchize/[slug]/leads/leads-types";
// NOTE: privateSchema (from @/lib/private-secrets) + cookies + telegram-actor-cookie
// are ALL imported DYNAMICALLY inside functions to avoid `import "server-only"`
// poisoning the client bundle. private-secrets.ts has `import "server-only"` too.

// ── Auth helper ─────────────────────────────────────────────────────────────
// Verifies that the caller has access to the given crew.
// Uses THREE verification paths (all server-side, no client-supplied booleans):
//
// 1. Telegram WebApp: reads TELEGRAM_ACTOR_COOKIE (signed HMAC-SHA256) → gets real userId
//    → checks crew owner / admin / active crew member
// 2. initData fallback (NEW — Telegram Web desktop / Safari): when the browser
//    blocks third-party cookies the actor cookie never reaches the server, so
//    the client forwards the Telegram-signed initData string; we verify its
//    HMAC-SHA256 signature server-side, extract user.id and require it to match
//    the client-claimed actorUserId before running the same crew checks.
// 3. Password auth: caller passes actorUserId (the crew owner's ID from validateAnalyticsPassword)
//    → server verifies actorUserId === crew.owner_id (only the real owner would know this UUID)
//
// LA-001 FIX: was trusting a client-supplied isPasswordAuth boolean — anyone could bypass
// auth by passing isPasswordAuth=true. Now the server verifies identity in all paths.

/** Admin check that covers BOTH storage locations used in production:
 *  top-level users.role/status (salavey13 = role:vprAdmin, status:admin) and
 *  the legacy users.metadata.role/status keys. */
async function isGlobalAdminUser(userId: string): Promise<boolean> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role, status, metadata")
    .eq("user_id", userId)
    .maybeSingle();
  if (!user) return false;
  if (user.role === "admin" || user.role === "vprAdmin" || user.status === "admin") return true;
  const meta = user.metadata as Record<string, unknown> | null;
  return meta?.role === "admin" || meta?.status === "admin";
}

/** Crew access check for a KNOWN userId: owner / global admin / active member. */
async function checkUserCrewAccess(
  userId: string,
  crewId: string,
): Promise<{ allowed: boolean; error?: string }> {
  // Global admin?
  if (await isGlobalAdminUser(userId)) return { allowed: true };

  const { data: crew, error: crewErr } = await supabaseAdmin
    .from("crews")
    .select("owner_id")
    .eq("id", crewId)
    .maybeSingle();
  if (crewErr) logger.warn("[checkUserCrewAccess] crews query failed:", crewErr.message);
  if (crew?.owner_id === userId) return { allowed: true };

  // Check crew member (LR3-006 FIX: filter by membership_status='active' — was missing,
  // so removed/inactive members retained access indefinitely)
  const { data: crewMember, error: memberErr } = await supabaseAdmin
    .from("crew_members")
    .select("user_id")
    .eq("crew_id", crewId)
    .eq("user_id", userId)
    .eq("membership_status", "active")
    .maybeSingle();

  if (memberErr) logger.warn("[checkUserCrewAccess] crew_members query failed:", memberErr.message);
  if (crewMember) return { allowed: true };

  return { allowed: false, error: "Недостаточно прав для просмотра данных этого экипажа." };
}

async function verifyCrewAccess(
  crewId: string,
  initDataFallback?: string,
  fallbackActorUserId?: string,
): Promise<{ allowed: boolean; actorUserId?: string; error?: string }> {
  // Dynamic imports to avoid module-level server-only chain
  const { cookies } = await import("next/headers");
  const { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } = await import("@/lib/telegram-actor-cookie");

  // Path 1: Telegram WebApp — read signed cookie
  const cookieUserId = verifyTelegramActorCookieValue(
    (await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (cookieUserId) {
    const check = await checkUserCrewAccess(cookieUserId, crewId);
    if (check.allowed) return { allowed: true, actorUserId: cookieUserId };
    return { allowed: false, error: check.error };
  }

  // Path 2 (NEW): no cookie — verify the Telegram-signed initData forwarded by
  // the client. Only trusted because we validate the HMAC-SHA256 signature
  // against the bot token ourselves; the client cannot forge it.
  if (initDataFallback && fallbackActorUserId) {
    try {
      const { computeTelegramWebAppHash } = await import("@/lib/telegram-webapp-auth");
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        const validation = await computeTelegramWebAppHash(initDataFallback, botToken);
        if (validation.isValid) {
          const params = new URLSearchParams(initDataFallback);
          let tgUserId: string | null = null;
          try {
            const userJson = params.get("user");
            if (userJson) tgUserId = String((JSON.parse(userJson) as { id?: number | string }).id ?? "");
          } catch {
            tgUserId = null;
          }
          if (tgUserId && tgUserId === String(fallbackActorUserId).trim()) {
            const check = await checkUserCrewAccess(tgUserId, crewId);
            if (check.allowed) {
              logger.info("[verifyCrewAccess] initData fallback accepted for user", { userId: tgUserId });
              return { allowed: true, actorUserId: tgUserId };
            }
            return { allowed: false, error: check.error };
          }
          logger.warn("[verifyCrewAccess] initData user does not match claimed actorUserId — rejecting");
        } else {
          logger.warn("[verifyCrewAccess] initData fallback signature invalid — rejecting");
        }
      }
    } catch (initDataErr) {
      logger.warn("[verifyCrewAccess] initData fallback failed:", initDataErr instanceof Error ? initDataErr.message : String(initDataErr));
    }
  }

  // Path 3: No Telegram cookie / initData — not authenticated via WebApp
  // (Password auth is handled by the caller passing actorUserId, which is verified
  //  by checking actorUserId === crew.owner_id. This is done in the calling function
  //  because it needs the crew owner_id which is fetched there.)
  return { allowed: false, error: "Не авторизован." };
}

// ── Auth helper for password-authenticated users ────────────────────────────
// Verifies that the provided actorUserId is the OWNER of the given crew.
// This is the password-auth path: validateAnalyticsPassword returns the crew owner's
// ID, and only the real owner would know this UUID. We verify ownership server-side.
async function verifyCrewOwnerAccess(
  actorUserId: string,
  crewId: string,
): Promise<{ allowed: boolean; error?: string }> {
  const { data: crew, error: crewErr } = await supabaseAdmin
    .from("crews")
    .select("owner_id")
    .eq("id", crewId)
    .maybeSingle();

  if (crewErr) logger.warn("[verifyCrewOwnerAccess] crews query failed:", crewErr.message);
  if (!crew) return { allowed: false, error: "Экипаж не найден." };

  if (crew.owner_id === actorUserId) {
    return { allowed: true };
  }

  // Also check if actorUserId is a global admin (in case the password was
  // generated by an admin for a crew they don't own) — top-level role/status
  // plus the legacy metadata keys.
  if (await isGlobalAdminUser(actorUserId)) {
    return { allowed: true };
  }

  return { allowed: false, error: "Недостаточно прав для просмотра данных этого экипажа." };
}

// Re-export types from the shared leads-types.ts (no server-only imports).
// Client components should import types from leads-types.ts directly to avoid
// pulling in server-only code. Server code can still import from here.
export type { LeadRentalRow, LeadSaleRow, LeadRow, LeadTodoRow, GetFranchizeLeadsResult, DocVerificationData, GetRentalDocVerificationResult } from "@/app/franchize/[slug]/leads/leads-types";

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
 * Build a stable per-renter identity key from a full name, e.g.
 * "Рудометов Михаил Сергеевич." → "name:рудометов михаил сергеевич".
 *
 * WHY: when an operator creates a contract via /doc-manual and SKIPS the optional
 * client phone, the lead used to be keyed by the operator's telegram_chat_id.
 * That collapsed ALL of one operator's renters into a single franchize_intents /
 * lead row (last write wins on name), so only ONE renter was ever visible on the
 * leads page and the other 44+ were invisible. Keying by normalized name instead
 * gives every renter a distinct, stable lead identity even without a phone.
 *
 * Normalization is intentionally minimal (lowercase, strip trailing dots/punct,
 * collapse whitespace) and MUST stay identical here and in leads-query.mjs so the
 * web page and the text skill surface the same identities. Returns "" for empty.
 */
function nameIdentityKey(fullName: string | null | undefined): string {
  const n = (fullName || "")
    .trim()
    .toLowerCase()
    .replace(/[.\s]+/g, " ")
    .replace(/[.]/g, "")
    .trim();
  return n ? `name:${n}` : "";
}

/**
 * Classify identity state for a lead.
 * (Phone normalization note: phones are canonicalized via normalizePhone()
 * from phone-utils at every read & write path — raw "8 999 123-45-67" typed by
 * the operator and the todo key "+79991234567" collapse into one identity.)
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
): 'claimed_user' | 'phone_only' | 'operator_placeholder' | 'merged' | 'avito_only' {
  const userId = lead.user_id;
  const originalOp = lead.originalOperatorChatId || null;

  // Avito chat lead: keyed by the synthetic "avito:<chat_id>" identity (the
  // webhook creates intents with neither phone nor telegram_user_id). Must be
  // checked FIRST — otherwise the fallback below labels it operator_placeholder
  // and the UI shows a misleading «Оператор» badge on a real Avito buyer.
  if (userId.startsWith("avito:")) return 'avito_only';

  // IDENTITY MATCHING FIX (2026-09-02): per-row synthetic keys ("opdoc:<intent_id>",
  // "oprental:<rental_id>", "opsale:<id>", "optestdrive:<id>", "opsecret:<doc_key>")
  // are assigned to operator-created rows whose renter has NEITHER phone NOR ФИО
  // recorded. The renter identity is unknown → honest "операторская заглушка" state.
  if (
    userId.startsWith("opdoc:") ||
    userId.startsWith("oprental:") ||
    userId.startsWith("opsale:") ||
    userId.startsWith("optestdrive:") ||
    userId.startsWith("opsecret:")
  ) {
    return 'operator_placeholder';
  }

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

export async function getFranchizeLeads(
  slug: string,
  actorUserId?: string,
  isPasswordAuth?: boolean,
  /**
   * Telegram WebApp initData (raw query string). OPTIONAL fallback for
   * browsers that block third-party cookies (Telegram Web on desktop, Safari)
   * where the signed actor cookie never reaches the server. Verified by
   * HMAC-SHA256 against the bot token inside verifyCrewAccess — never trusted
   * by itself.
   */
  initData?: string,
  /**
   * Analytics password (browser password-auth path). 2026-09-01 fix: the leads
   * page's password gate stored the password but never forwarded it here, so
   * password users always got «Не авторизован» after passing the gate.
   * Verified server-side against the analytics_passwords RPC — never trusted
   * by itself.
   */
  authPassword?: string,
): Promise<GetFranchizeLeadsResult> {
  noStore();
  const safeSlug = slug.trim();
  try {
    const { privateSchema } = await import("@/lib/private-secrets");
    // ── Auth check (LA-001 FIX: no more trusting isPasswordAuth boolean) ──
    // Path 1: Telegram WebApp — verifyCrewAccess reads the signed cookie
    // Path 1b: initData fallback — same checks, Telegram-signed identity
    // Path 2: Password auth — verify actorUserId is the crew owner (server-side)
    // Previously: NO auth at all, then isPasswordAuth boolean bypass — both fixed.
    const { ids: crewOperatorIds, crewId } = await getCrewOperatorIds(safeSlug);
    if (!crewId) {
      return { success: false, error: "Экипаж не найден" };
    }

    // Try Telegram cookie auth first (then signed initData fallback)
    const access = await verifyCrewAccess(crewId, initData, actorUserId);
    if (!access.allowed) {
      // Cookie auth failed — try password auth (actorUserId must be crew owner)
      if (actorUserId && isPasswordAuth) {
        const ownerAccess = await verifyCrewOwnerAccess(actorUserId, crewId);
        if (!ownerAccess.allowed) {
          return { success: false, error: ownerAccess.error || "Недостаточно прав." };
        }
        // Password auth OK — proceed with actorUserId
      } else if (authPassword && authPassword.trim().length > 0) {
        // 2026-09-01: browser password-auth path — verify the password against
        // analytics_passwords (RPC checks expiry) and require this crew's slug.
        const rpc = await supabaseAdmin.rpc("validate_analytics_password", {
          p_password: authPassword.trim(),
        });
        if (rpc.error) {
          return { success: false, error: "Ошибка проверки пароля." };
        }
        const row = Array.isArray(rpc.data) ? rpc.data[0] : null;
        if (!row || !row.is_valid || (row.slug && row.slug !== safeSlug)) {
          return { success: false, error: "Не авторизован (пароль)." };
        }
        // Password OK — proceed (owner identity not needed for the read path)
      } else {
        return { success: false, error: access.error || "Не авторизован." };
      }
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
    // renter_full_name by rental_id — lets the rentals step fall back to a NAME
    // identity key (nameIdentityKey) for operator-placeholder rentals that have no
    // phone, so they merge with the matching artifact lead instead of collapsing
    // under the crew-owner placeholder user_id.
    const artifactNameByRentalId = new Map<string, string | null>();
    // Cache: renter_phone (normalized) → set of rental_ids — helps with old artifacts
    // that don't have rental_id backfilled (audit §4).
    const rentalIdsByNormalizedPhone = new Map<string, Set<string>>();
    // Cache: bike_id → bike title — populated from artifacts & sales after main fetch.
    const bikeTitleMap = new Map<string, string>();

    /**
     * Avito channel block from an intent's metadata — only meaningful when the
     * intent came from the Avito webhook or assistant-bot forward. Fields are
     * written by /api/webhooks/avito (sourceUrl, avitoChatId, avitoItemId,
     * avitoProfile, lastMessage).
     */
    const avitoBlockFromMeta = (
      meta: Record<string, unknown> | null | undefined,
    ): LeadRow["avito"] => {
      if (!meta) return null;
      const str = (key: string): string | null => {
        const v = meta[key];
        return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
      };
      // M3 fix: only https: URLs survive into the UI — the webhook stores
      // client-controlled values and the sheet renders them as href, so a
      // javascript:/data: payload would execute in the operator's session.
      const safeHttpUrl = (v: string | null): string | null => {
        if (!v) return null;
        try {
          const u = new URL(v);
          return u.protocol === "https:" ? u.toString() : null;
        } catch {
          return null;
        }
      };
      const chatId = str("avitoChatId");
      const itemUrl = safeHttpUrl(str("sourceUrl"));
      const profileUrl = safeHttpUrl(str("avitoProfile"));
      const itemIdRaw = meta["avitoItemId"];
      const itemId =
        (typeof itemIdRaw === "number" && Number.isFinite(itemIdRaw)) ? String(itemIdRaw)
          : typeof itemIdRaw === "string" && itemIdRaw.trim() ? itemIdRaw.trim()
            : null;
      const lastMessage = str("lastMessage");
      if (!chatId && !itemUrl && !profileUrl && !itemId && !lastMessage) return null;
      return { chatId, itemUrl, profileUrl, itemId, lastMessage };
    };

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
      // Avito deep-link metadata — keep the first non-empty block (the webhook
      // enriches it on repeat messages, so any captured copy is the good one).
      if (row.avito && !existing.avito) existing.avito = row.avito;
      // Preserve operator origin across merges — keep the first non-null value we see.
      if (row.originalOperatorChatId && !existing.originalOperatorChatId) {
        existing.originalOperatorChatId = row.originalOperatorChatId;
      }
      // Append rentals/sales from the new row into the existing lead.
      // RENTAL DEDUP (2026-09-03): several artifact rows can reference the SAME
      // rental (contract regenerated, web retry) — keep the first, skip the
      // rest, so one rental = one deal row on the lead.
      if (row.rentals.length > 0) {
        const seenRentalIds = new Set(existing.rentals.map((r) => r.rentalId).filter(Boolean));
        for (const r of row.rentals) {
          if (r.rentalId && seenRentalIds.has(r.rentalId)) continue;
          existing.rentals.push(r);
          if (r.rentalId) seenRentalIds.add(r.rentalId);
        }
      }
      if (row.sales.length > 0) {
        const seenSaleIds = new Set(existing.sales.map((s) => s.saleId).filter(Boolean));
        for (const s of row.sales) {
          if (s.saleId && seenSaleIds.has(s.saleId)) continue;
          existing.sales.push(s);
          if (s.saleId) seenSaleIds.add(s.saleId);
        }
      }
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
      testdriveArtifactsResult,
    ] = await Promise.all([
      // 1. franchize_intents (the canonical lead ledger — crew-filtered by slug)
      // NOTE: franchize_intents does NOT have a created_by_operator_chat_id column —
      // that column lives on rentals and rental_contract_artifacts only.
      // For intents created by /doc-manual, the operator id is stored in
      // metadata.operatorId (see /doc-manual.ts ~L1765). We read it as a fallback
      // so classifyIdentityState can still detect operator-origin for intent-only leads.
      supabaseAdmin
        .from("franchize_intents")
        .select("id, telegram_user_id, phone, intent_type, stage, urgency_score, source_route, contact_channel, last_seen_at, created_at, metadata, bike_id")
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
        .select("rental_id, user_id, status, payment_status, requested_start_date, requested_end_date, total_cost, metadata, passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo, crew_id, created_by_operator_chat_id, created_at, vehicle:cars(make, model)")
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
      // 6. Testdrive contract artifacts (crew-filtered by crew_slug).
      // Schema columns: id (uuid PK), telegram_chat_id, customer_phone, customer_full_name,
      //   requested_bike_id, resolved_bike_id, testdrive_date, total_sum (numeric),
      //   created_at, created_by_operator_chat_id, license_categories, original_sha256.
      // original_sha256 is needed to back-link to the franchize_intent (whose
      // metadata.docSha256 matches) so we can read metadata.rentalId and attach
      // the converted rental to the testdrive lead.
      privateSchema()
        .from("testdrive_contract_artifacts")
        .select("id, telegram_chat_id, customer_phone, customer_full_name, requested_bike_id, resolved_bike_id, testdrive_date, total_sum, created_at, created_by_operator_chat_id, license_categories, customer_passport, customer_driver_license, original_sha256")
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
    if (testdriveArtifactsResult.error) logger.error("[getFranchizeLeads] testdrive_contract_artifacts query failed:", testdriveArtifactsResult.error);

    const intentLeads = intentLeadsResult.data;
    const artifactUsers = artifactUsersResult.data;
    const secretUsers = secretUsersResult.data;
    const rentals = rentalsResult.data;
    const saleArtifacts = saleArtifactsResult.data;
    const testdriveArtifacts = testdriveArtifactsResult.data;

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
    for (const t of testdriveArtifacts ?? []) {
      const bid = t.resolved_bike_id || t.requested_bike_id;
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
        const meta = i.metadata as Record<string, unknown> | null;
        // Avito chat leads (webhook / bot forwards) have NEITHER telegram_user_id
        // NOR phone — the old `if (!i.telegram_user_id && !i.phone) continue`
        // silently dropped every one of them from the leads page (the buyer is
        // reachable only through the Avito chat link). Key them by the Avito
        // chat id: "avito:<chat_id>" — stable, unique, deduped by the webhook.
        const avitoChatId =
          typeof meta?.avitoChatId === "string" && meta.avitoChatId.trim()
            ? meta.avitoChatId.trim()
            : null;
        if (!i.telegram_user_id && !i.phone && !avitoChatId) continue;
        // Normalize phone so a lead keyed by "+79991234567" matches a todo keyed by "89991234567".
        const normalizedIntentPhone = normalizePhone(i.phone) || normalizePhone(meta?.phone as string | undefined);
        // franchize_intents has no created_by_operator_chat_id column, but /doc-manual
        // (and /doc-vlm) stores the operator id in metadata.operatorId. Read it FIRST
        // so the identity fix below can detect operator-created intents.
        const originalOp =
          (meta?.operatorId as string | null) || null;
        // ── IDENTITY MATCHING FIX (2026-09-02) ──
        // /doc bot commands store the OPERATOR's TG id in telegram_user_id (the
        // renter hasn't scanned the QR yet). Keying the lead by that operator id
        // collapsed EVERY renter the operator ever served into one "lead" card,
        // and notes/todos/history written under that key cross-contaminated them
        // all (the "bogus bunch of unrelated leads" bug). Now: when the telegram
        // id belongs to a crew operator, the lead is keyed by renter phone →
        // renter ФИО (name key) → per-intent synthetic key instead — NEVER by the
        // operator's chat_id. The operator id is still preserved in
        // originalOperatorChatId for attribution/assignee display.
        const isOperatorKey =
          !!i.telegram_user_id &&
          (crewOperatorIds.has(i.telegram_user_id) || i.telegram_user_id === originalOp);
        const intentNameKey = meta?.name
          ? nameIdentityKey(meta.name as string)
          : "";
        const id = isOperatorKey
          ? (normalizedIntentPhone ||
             intentNameKey ||
             (avitoChatId ? `avito:${avitoChatId}` : "") ||
             `opdoc:${i.id}`)
          : (i.telegram_user_id || normalizedIntentPhone || (avitoChatId ? `avito:${avitoChatId}` : "") || "");
        if (!id) continue;
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
          // Operator's own TG id must NEVER be exposed as the lead's contact —
          // pre-claim intents have no renter TG identity, so telegramChatId is null.
          telegramChatId: isOperatorKey ? null : (i.telegram_user_id || null),
          sourceRoute: i.source_route,
          contactChannel: i.contact_channel,
          avito: avitoBlockFromMeta(meta),
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
          artifactNameByRentalId.set(a.rental_id, a.renter_full_name || null);
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
        // When operator placeholder + no phone, use the NORMALIZED renter name as
        // the identity key so each renter is a distinct lead (not collapsed under
        // the operator's chat id). Normalization matters: "…Кириллович." (trailing
        // dot) and "…Кириллович" must resolve to the SAME key, otherwise the same
        // person shows up twice. See nameIdentityKey().
        const fallbackName = (!preferPhone && !normalizedArtifactPhone && a.renter_full_name)
          ? nameIdentityKey(a.renter_full_name)
          : null;
        const id = preferPhone
          ? normalizedArtifactPhone!
          : (fallbackName || a.telegram_chat_id || normalizedArtifactPhone || "");
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
          // goodmorning-fixes: set intentType so mode filter ("rent") includes artifact leads.
          // Was: no intentType → mode filter rejected them → leads list empty.
          intentType: "rent",
          // Store the operator's telegram_chat_id separately (not as lead key)
          telegramChatId: preferPhone ? null : (a.telegram_chat_id || null),
          originalOperatorChatId: originalOp,
          rentals: [rentalRow],
          sales: [],
        });
      }
    }

    // 3. Rental secrets (crew-filtered)
    //
    // ── IDENTITY MATCHING FIX (2026-09-02, round 2) ──
    // user_rental_secrets.chat_id is normally the RENTER's TG id (set at QR
    // claim). But /doc-created rows that the renter never claimed keep the
    // OPERATOR's chat_id (35 such rows in vip-bike at audit time: the operator
    // opened the doc/QR flow, so the row is keyed by his chat). Keying a lead
    // by the operator's id would (a) show a bogus "operator" lead and (b)
    // cross-contaminate todos/notes/history with that operator's other work.
    // When chat_id is a crew operator, key by renter phone → renter ФИО →
    // per-row synthetic key instead — never by the operator's chat_id.
    if (secretUsers) {
      for (const s of secretUsers) {
        if (!s.chat_id) continue;
        const normalizedSecretPhone = normalizePhone(s.renter_phone);
        const isOperatorSecret = isOperatorPlaceholder(s.chat_id);
        const secretNameKey =
          isOperatorSecret && !normalizedSecretPhone && s.renter_full_name
            ? nameIdentityKey(s.renter_full_name)
            : "";
        const secretId = isOperatorSecret
          ? (normalizedSecretPhone || secretNameKey || `opsecret:${s.source_doc_key}`)
          : s.chat_id;
        const existing = leadMap.get(secretId);
        if (!existing) {
          leadMap.set(secretId, {
            user_id: secretId,
            full_name: s.renter_full_name,
            username: null,
            phone: normalizedSecretPhone,
            source: s.source_doc_key === "profile_prefill" ? "profile_prefill" : "rental_secret",
            bikeTitle: null,
            createdAt: s.created_at,
            lastSeenAt: s.created_at,
            verified: s.verification_status === "verified",
            // goodmorning-fixes: set intentType so mode filter ("rent") includes secret leads.
            intentType: "rent",
            // Operator's chat_id must never be offered as the renter's TG contact.
            telegramChatId: isOperatorSecret ? null : s.chat_id,
            // Keep operator attribution for the «Оператор» origin badge.
            originalOperatorChatId: isOperatorSecret ? s.chat_id : null,
            rentals: [],
            sales: [],
            sourceCount: 1,
          });
        } else {
          existing.sourceCount = (existing.sourceCount || 1) + 1;
          if (s.verification_status === "verified") existing.verified = true;
          if (!existing.full_name) existing.full_name = s.renter_full_name;
          if (!existing.phone && normalizedSecretPhone) existing.phone = normalizedSecretPhone;
          if (isOperatorSecret && !existing.originalOperatorChatId) existing.originalOperatorChatId = s.chat_id;
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
        // Identity for this rental: phone if we have one; otherwise, for operator-
        // placeholder (pre-claim) rentals, fall back to the renter NAME (looked up
        // via the artifact for this rental_id) so the rental merges with the
        // matching artifact lead instead of collapsing under the crew-owner
        // placeholder user_id (which hid 22 operator-created rentals behind one id).
        const rentalName = (r.rental_id && artifactNameByRentalId.get(r.rental_id)) || null;
        const rentalNameKey = prefersPhone ? nameIdentityKey(rentalName) : "";
        // ── IDENTITY MATCHING FIX (2026-09-02) ──
        // When an operator-created rental has NEITHER renter phone NOR ФИО, the
        // old fallback keyed the lead by r.user_id — which IS the operator's
        // chat_id, so every such rental collapsed into one contaminated
        // "operator lead". Key it by its own rental_id instead: each unidentified
        // renter gets a separate, clean lead card (badge: «Оператор» placeholder).
        const effectiveId = (prefersPhone && effectivePhone)
          ? effectivePhone
          : (rentalNameKey || (prefersPhone && r.rental_id ? `oprental:${r.rental_id}` : r.user_id));

        const existing = leadMap.get(effectiveId) ||
          // Fallback: try matching by renter_phone from metadata (handles existing rentals
          // whose user_id is telegramUserId while the lead key is phone)
          (metaRenterPhone ? leadMap.get(metaRenterPhone) || null : null) ||
          // Fallback: try matching by name key (rental merged to artifact by name)
          (rentalNameKey ? leadMap.get(rentalNameKey) || null : null);
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
            full_name: rentalName || null,
            username: null,
            phone: effectivePhone,
            source: "rental",
            bikeTitle,
            // REAL creation time, not requested_start_date: a future-dated
            // rental start (booked for next week) used to become the lead's
            // "first contact" — freshness computed a NEGATIVE age → 0, so the
            // lead looked «⚡ свежий» (age 0) and topped the priority queue
            // until the rental actually started. Fall back for legacy rows.
            createdAt: (r as { created_at?: string | null }).created_at || r.requested_start_date,
            lastSeenAt: (r as { created_at?: string | null }).created_at || r.requested_start_date,
            verified: ["active", "completed", "confirmed"].includes(r.status || ""),
            // goodmorning-fixes: set intentType so mode filter ("rent") includes rental leads.
            intentType: "rent",
            // BUG 4+5 fix: default sourceRoute/contactChannel for /doc-flow leads.
            // These leads don't have a matching franchize_intent (different identity key),
            // so sourceRoute and contactChannel are null. For /doc-flow leads (detected
            // via originalOperatorChatId), default to "/doc-manual" and "telegram_bot".
            sourceRoute: originalOp ? "/doc-manual" : null,
            contactChannel: originalOp ? "telegram_bot" : null,
            // Operator's chat_id must not be offered as the renter's TG contact
            // (the "Написать в TG"/"Уведомить" actions would target the OPERATOR).
            telegramChatId: prefersPhone ? null : (/^\d+$/.test(r.user_id) ? r.user_id : null),
            originalOperatorChatId: originalOp,
            rentals: [rentalRow],
            sales: [],
            sourceCount: 1,
          });
        } else {
          existing.sourceCount = (existing.sourceCount || 1) + 1;
          // ── RENTAL DEDUP FIX (2026-09-03) ──
          // Step 2 (rental_contract_artifacts) attaches a STUB row for every
          // artifact: status hardcoded "confirmed", no photos/metadata. The
          // rentals-table row for the SAME rental_id is the source of truth
          // (real status: active/pending/…, photos, checklist, contract_verifier).
          // Appending both made the SAME rental show up TWICE in the lead's
          // deals list with different statuses, and the "confirmed" stub could
          // shadow the real row in rentals[0]-based logic → false
          // «Документы отсутствуют», wrong verification badge, doubled
          // rental count. REPLACE the stub in place instead of appending.
          const stubIdx = r.rental_id
            ? existing.rentals.findIndex((x) => x.rentalId === r.rental_id)
            : -1;
          if (stubIdx >= 0) {
            existing.rentals[stubIdx] = rentalRow;
          } else {
            existing.rentals.push(rentalRow);
          }
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
        // ── IDENTITY MATCHING FIX (2026-09-02) ── sale artifacts are ALWAYS
        // operator-created (telegram_chat_id = operator's id, no QR claim flow —
        // audit §10 #5). Never key such a lead by a chat_id and never expose it
        // as the buyer's TG contact: use buyer phone → per-row synthetic key.
        // This also catches operators who are NOT in crewOperatorIds (former
        // members, never-added, stale roster) — isOperatorPlaceholder would
        // miss those, so we simply never trust chat_ids on sales.
        const id = preferPhone
          ? normalizedBuyerPhone!
          : `opsale:${s.id}`;
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
          // goodmorning-fixes: set intentType so mode filter ("sale") includes sale leads.
          intentType: "sale",
          // Sale artifacts' telegram_chat_id is ALWAYS the operator's id — the
          // buyer has no TG identity on this path. Never expose it as contact.
          telegramChatId: null,
          rentals: [],
          sales: [saleRow],
        });
      }
    }

    // 6. Testdrive contract artifacts (crew-filtered)
    // Testdrive artifacts use customer_* field naming (not renter_*).
    // telegram_chat_id starts as the operator's chat_id and is updated to the
    // renter's chat_id when they scan the QR (via claim_testdrive_by_qr RPC).
    // The lead appears on /leads with intentType "test_drive" and a bikeTitle
    // so operators can see who test-drove what.
    if (testdriveArtifacts) {
      for (const t of testdriveArtifacts) {
        if (!t.telegram_chat_id && !t.customer_phone) continue;
        const normalizedCustomerPhone = normalizePhone(t.customer_phone);
        // Prefer customer_phone as the lead identity key when the artifact is
        // still in pre-claim state (telegram_chat_id is the operator).
        // ── IDENTITY MATCHING FIX (2026-09-02) ── additionally: when an
        // operator-created testdrive has no phone at all, key it by a synthetic
        // per-row key (never the operator's chat_id) so unidentified customers
        // don't collapse into one contaminated "operator lead".
        const isOperator =
          (!!t.created_by_operator_chat_id && t.telegram_chat_id === t.created_by_operator_chat_id) ||
          (!!t.telegram_chat_id && crewOperatorIds.has(t.telegram_chat_id));
        const preferPhone = !!normalizedCustomerPhone && isOperator;
        const id = preferPhone
          ? normalizedCustomerPhone!
          : (!isOperator && t.telegram_chat_id)
            ? t.telegram_chat_id
            : (normalizedCustomerPhone || `optestdrive:${t.id}`);
        if (!id) continue;
        const bikeId = t.resolved_bike_id || t.requested_bike_id;
        const bikeTitle = (bikeId && bikeTitleMap.get(bikeId)) || null;
        addOrMerge({
          user_id: id,
          full_name: t.customer_full_name || null,
          username: null,
          phone: normalizedCustomerPhone,
          source: "testdrive_contract",
          bikeTitle,
          createdAt: t.created_at,
          lastSeenAt: t.created_at,
          verified: true,
          intentType: "test_drive",
          intentStage: "contract_generated",
          // Pre-claim: operator's chat_id is not the customer's contact — don't expose it.
          telegramChatId: isOperator ? null : (t.telegram_chat_id || null),
          originalOperatorChatId: t.created_by_operator_chat_id || null,
          rentals: [],
          sales: [],
        });
      }
    }

    // 6.5. Backfill: attach converted rental to testdrive leads via metadata.rentalId
    //
    // When /doc-manual converts a testdrive into a real rental, linkTestdriveIntentsToRental()
    // (called from /doc-manual.ts) writes `metadata.rentalId` onto the matching test_drive
    // franchize_intent. This step reads that back-link and attaches the rental to the
    // testdrive artifact lead — robust against phone-format mismatches between the
    // /testdrive and /doc operators.
    //
    // Without this backfill, the testdrive lead on /leads would show "no rentals"
    // even though a rental exists, just because the phones were stored in different
    // formats (e.g. "+7999..." vs "8999...").
    if (testdriveArtifacts && rentals && intentLeads) {
      // Map docSha256 → rentalId, extracted from test_drive franchize_intents.
      const rentalIdByDocSha256 = new Map<string, string>();
      for (const i of intentLeads) {
        if (i.intent_type !== "test_drive") continue;
        const meta = (i.metadata as Record<string, unknown> | null) || {};
        const sha = typeof meta.docSha256 === "string" ? meta.docSha256 : null;
        const rid = typeof meta.rentalId === "string" ? meta.rentalId : null;
        if (sha && rid) rentalIdByDocSha256.set(sha, rid);
      }

      // Map rental_id → rental row (for direct lookup).
      const rentalById = new Map<string, typeof rentals[number]>();
      for (const r of rentals) {
        if (r.rental_id) rentalById.set(r.rental_id, r);
      }

      if (rentalIdByDocSha256.size > 0) {
        for (const t of testdriveArtifacts) {
          const sha = t.original_sha256 || null;
          if (!sha) continue;
          const rid = rentalIdByDocSha256.get(sha);
          if (!rid) continue;
          const rentalRow = rentalById.get(rid);
          if (!rentalRow) continue;
          // Find the lead this testdrive artifact was merged into (keyed by phone
          // when pre-claim, or by telegram_chat_id otherwise — same logic as step 6).
          const normalizedCustomerPhone = normalizePhone(t.customer_phone);
          const isOperator =
            (!!t.created_by_operator_chat_id && t.telegram_chat_id === t.created_by_operator_chat_id) ||
            (!!t.telegram_chat_id && crewOperatorIds.has(t.telegram_chat_id));
          const preferPhone = !!normalizedCustomerPhone && isOperator;
          const leadKey = preferPhone
            ? normalizedCustomerPhone!
            : (!isOperator && t.telegram_chat_id)
              ? t.telegram_chat_id
              : (normalizedCustomerPhone || `optestdrive:${t.id}`);
          const lead = leadMap.get(leadKey);
          if (!lead) continue;
          // Dedupe by rentalId — don't push if already attached (e.g. via phone match).
          if (lead.rentals.some((r: LeadRentalRow) => r.rentalId === rid)) continue;
          const vehicle = rentalRow.vehicle as { make?: string; model?: string } | null;
          const bikeTitle = `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim() || null;
          lead.rentals.push({
            rentalId: rentalRow.rental_id,
            status: rentalRow.status || "pending_confirmation",
            paymentStatus: rentalRow.payment_status || "interest_paid",
            startDate: rentalRow.requested_start_date,
            endDate: rentalRow.requested_end_date,
            bikeTitle,
            totalCost: Number(rentalRow.total_cost) || 0,
            metadata: rentalRow.metadata ? (rentalRow.metadata as Record<string, unknown>) : null,
            passportMainpagePhoto: (rentalRow as any).passport_mainpage_photo || null,
            passportRegistrationPhoto: (rentalRow as any).passport_registration_photo || null,
            driversLicenceFrontalPhoto: (rentalRow as any).drivers_licence_frontal_photo || null,
          });
          // Mark the lead so we can see in the UI/inspector that the link came from
          // the explicit metadata backfill (vs phone matching).
          if (!lead.intentType) lead.intentType = "test_drive";
        }
      }
    }

    // ── 6.7. Alias merge: one human under multiple lead keys ──
    //
    // ── IDENTITY MATCHING FIX (2026-09-02, round 3) ──
    // The same person can appear as TWO leads: renter claimed one contract via
    // QR (that lead is keyed by his TG id) while other contracts/intents for
    // the SAME phone are keyed by phone (operator-created, pre-claim). Live
    // case: Лобанов Михаил — leads "5008436733" and "+79991370307", same human,
    // same phone, two cards, split history/todos. Union all leads that share a
    // STRONG alias (same normalized phone, or one lead's key IS the other's
    // non-operator telegramChatId) and merge each group into ONE lead.
    //
    // Canonical key preference: a non-operator numeric TG id (claimed identity
    // → users-table enrichment + TG contact), else a phone key, else the group
    // root. Name keys / synthetic keys are never unioned (no strong alias).
    {
      const entries = Array.from(leadMap.entries());
      const parent = new Map<string, string>();
      const find = (k: string): string => {
        let r = parent.get(k) ?? k;
        while (parent.has(r) && parent.get(r) !== r) r = parent.get(r)!;
        return r;
      };
      const union = (a: string, b: string) => {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
      };
      for (const [k] of entries) parent.set(k, k);

      // Strong alias 1: same normalized phone
      const byPhone = new Map<string, string>();
      for (const [k, l] of entries) {
        if (!l.phone) continue;
        const prev = byPhone.get(l.phone);
        if (prev && prev !== k) union(prev, k);
        else if (!prev) byPhone.set(l.phone, k);
      }
      // Strong alias 2: a lead's non-operator telegramChatId equals another
      // lead's key (or another lead's telegramChatId — same claimed identity)
      const byTg = new Map<string, string>();
      for (const [k, l] of entries) {
        const tg = l.telegramChatId && !crewOperatorIds.has(l.telegramChatId)
          ? l.telegramChatId : null;
        if (!tg) continue;
        const prev = byTg.get(tg);
        if (prev && prev !== k) union(prev, k);
        else if (!prev) byTg.set(tg, k);
        if (leadMap.has(tg) && tg !== k) union(tg, k);
      }

      // Group keys by union root
      const groups = new Map<string, string[]>();
      for (const [k] of entries) {
        const root = find(k);
        const arr = groups.get(root) ?? [];
        arr.push(k);
        groups.set(root, arr);
      }

      const mergeOtherInto = (target: MutableLead, other: MutableLead): void => {
        // Same union semantics as addOrMerge's field updates
        target.sourceCount = (target.sourceCount || 1) + (other.sourceCount || 1);
        if (other.verified) target.verified = true;
        if (other.full_name && !target.full_name) target.full_name = other.full_name;
        if (other.username && !target.username) target.username = other.username;
        if (other.phone && !target.phone) target.phone = other.phone;
        if (other.bikeTitle && !target.bikeTitle) target.bikeTitle = other.bikeTitle;
        if (other.intentType && !target.intentType) target.intentType = other.intentType;
        if (other.intentStage && !target.intentStage) target.intentStage = other.intentStage;
        if ((other.urgencyScore ?? 0) > (target.urgencyScore ?? 0)) target.urgencyScore = other.urgencyScore;
        if (other.createdAt && (!target.createdAt || other.createdAt > target.createdAt)) target.createdAt = other.createdAt;
        if (other.lastSeenAt && (!target.lastSeenAt || other.lastSeenAt > target.lastSeenAt)) target.lastSeenAt = other.lastSeenAt;
        if (!target.telegramChatId && other.telegramChatId && !crewOperatorIds.has(other.telegramChatId)) target.telegramChatId = other.telegramChatId;
        if (other.sourceRoute && !target.sourceRoute) target.sourceRoute = other.sourceRoute;
        if (other.contactChannel && !target.contactChannel) target.contactChannel = other.contactChannel;
        if (other.originalOperatorChatId && !target.originalOperatorChatId) target.originalOperatorChatId = other.originalOperatorChatId;
        // Rentals concat with dedupe by rentalId
        const seenRentalIds = new Set(target.rentals.map((r) => r.rentalId).filter(Boolean));
        for (const r of other.rentals) {
          if (r.rentalId && seenRentalIds.has(r.rentalId)) continue;
          target.rentals.push(r);
          if (r.rentalId) seenRentalIds.add(r.rentalId);
        }
        // Sales concat with dedupe by saleId
        const seenSaleIds = new Set(target.sales.map((s) => s.saleId).filter(Boolean));
        for (const s of other.sales) {
          if (s.saleId && seenSaleIds.has(s.saleId)) continue;
          target.sales.push(s);
          if (s.saleId) seenSaleIds.add(s.saleId);
        }
      };

      let mergedCount = 0;
      for (const keys of groups.values()) {
        if (keys.length <= 1) continue;
        // Canonical key: non-operator numeric TG id > phone key > root
        const tgKey = keys.find((k) => /^\d{1,12}$/.test(k) && !crewOperatorIds.has(k));
        const phoneKey = keys.find((k) => isPhoneString(k));
        const canonical = tgKey || phoneKey || keys[0];
        const canonicalLead = leadMap.get(canonical)!;
        for (const k of keys) {
          if (k === canonical) continue;
          const other = leadMap.get(k)!;
          mergeOtherInto(canonicalLead, other);
          leadMap.delete(k);
          mergedCount++;
        }
      }
      if (mergedCount > 0) {
        logger.info(`[getFranchizeLeads] alias merge: collapsed ${mergedCount} duplicate lead key(s) into canonical identities`);
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

    // privateSchema already dynamically imported at line 270 (same function scope)
    const [tgUsersResult, secretByPhoneResult, troubledUsersResult, todosResult, notesResult] = await Promise.all([
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
      // 2026-09-02 (merge): ALSO include `lead_handling` — «Отработан» / «Перезвонить
      // в …» rows live in the same table (see lib/lead-handling.ts). Without this,
      // handling state loaded fine after an action (touched rows are appended
      // client-side) but VANISHED on page reload — the server query is the only
      // path that hydrates todosState on load.
      supabaseAdmin
        .from("crew_todos")
        .select("id, lead_id, user_id, phone, rental_id, title, description, status, priority, category, created_at, completed_at, assigned_to, due_date")
        .eq("crew_id", crewId)
        .in("category", ["lead_followup", "rental_verification", "lead_handling"])
        .order("created_at", { ascending: false }),
      // 12. Notes counts per lead (lead_notes) — один агрегатный запрос на экипаж,
      // питает флажок «Прочитать заметки» прямо в списке лидов. Заметки хранятся
      // в отдельной таблице и подгружаются лениво в шторке; счётчик же нужен
      // сразу для всех лидов, поэтому считаем его здесь (lead_id — TEXT без FK,
      // заметки сделок с ключами "sale:…" просто не совпадут с ключами лидов и
      // отфильтруются при маппинге ниже).
      // 2026-09-03: добавлен created_by — автор последней заметки становится
      // «последним оператором, трогавшим лида» (lastTouchedBy) для карточки.
      supabaseAdmin
        .from("lead_notes")
        .select("lead_id, created_at, created_by")
        .eq("crew_id", crewId),
    ]);

    // Surface enrichment query errors so future bugs are visible.
    if (tgUsersResult.error) logger.error("[getFranchizeLeads] users enrichment query failed:", tgUsersResult.error);
    if (secretByPhoneResult.error) logger.error("[getFranchizeLeads] secrets-by-phone enrichment query failed:", secretByPhoneResult.error);
    if (troubledUsersResult.error) logger.error("[getFranchizeLeads] troubled-users query failed:", troubledUsersResult.error);
    if (todosResult.error) logger.error("[getFranchizeLeads] crew_todos query failed:", todosResult.error);
    if (notesResult.error) logger.error("[getFranchizeLeads] lead_notes counts query failed:", notesResult.error);

    const tgUsers = tgUsersResult.data;
    const secretByPhone = secretByPhoneResult.data;
    const troubledUsers = troubledUsersResult.data;
    const todos = todosResult.data;

    // Numeric user_id → { username, full_name } map — used by the enrichment
    // step below AND by the ownerName/lastTouchedBy name resolution at the end
    // of this function. Previously three separate O(n·m) `.find()` scans over
    // the users array; with hundreds of leads × hundreds of users that added
    // up to real time on every page load.
    const tgUserMap = new Map<string, { username: string | null; full_name: string | null }>();
    if (tgUsers) {
      for (const u of tgUsers) {
        tgUserMap.set(u.user_id, { username: u.username, full_name: u.full_name });
      }
    }

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
        const match = tgUserMap.get(l.user_id);
        if (match) {
          // IDENTITY MATCHING FIX (2026-09-02, round 2): a numeric lead key that
          // belongs to a crew operator must NEVER be exposed as the lead's TG
          // contact ("Написать в TG"/"Уведомить" would message the OPERATOR).
          l.telegramChatId = crewOperatorIds.has(l.user_id) ? null : l.user_id;
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
          // IDENTITY MATCHING FIX (2026-09-02, round 2): skip operator chat_ids —
          // a secret row keyed by an operator (pre-claim / operator-scanned QR)
          // must not become the renter's TG contact.
          if (match && !crewOperatorIds.has(match.chat_id)) l.telegramChatId = match.chat_id;
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

    // ── 9.5. Final rental dedup pass (safety net) ──
    // The same rental can reach a lead through several ingestion paths
    // (artifact stub + rentals row + testdrive backfill). Each path dedupes
    // on its own, but legacy/cached rows can still slip a twin through —
    // collapse by rentalId one last time, preferring the row with the most
    // real data (rentals-table rows carry metadata + photos; artifact stubs
    // don't). Rows without rentalId (old artifacts) are kept as-is.
    for (const l of leadMap.values()) {
      if (l.rentals.length <= 1) continue;
      const byId = new Map<string, LeadRentalRow>();
      const noId: LeadRentalRow[] = [];
      for (const r of l.rentals) {
        if (!r.rentalId) {
          noId.push(r);
          continue;
        }
        const prev = byId.get(r.rentalId);
        if (!prev) {
          byId.set(r.rentalId, r);
          continue;
        }
        const richness = (x: LeadRentalRow): number =>
          (x.metadata ? 2 : 0) +
          (x.passportMainpagePhoto || x.passportRegistrationPhoto || x.driversLicenceFrontalPhoto ? 1 : 0);
        if (richness(r) > richness(prev)) byId.set(r.rentalId, r);
      }
      l.rentals = Array.from(byId.values()).concat(noId);
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

    // 12b. Attach notes counts (флажок «Прочитать заметки» в списке лидов).
    // Один проход по заметкам экипажа: lead_id → {count, lastAt, lastBy}.
    // Ключи, не совпадающие с ключами лидов (например "sale:<contract>" заметки
    // сделок), просто игнорируются — это чужая доменная область.
    if (notesResult.data) {
      const notesAgg = new Map<string, { count: number; lastAt: string | null; lastBy: string | null }>();
      for (const n of notesResult.data) {
        const key = typeof n.lead_id === "string" ? n.lead_id : null;
        if (!key) continue;
        const prev = notesAgg.get(key);
        const at = typeof n.created_at === "string" ? n.created_at : null;
        // created_by хранит user_id (chat_id) автора — числовой строкой; в
        // легаси-записях может быть свободный текст или null.
        const by = typeof (n as { created_by?: unknown }).created_by === "string" && (n as { created_by?: string }).created_by
          ? (n as { created_by: string }).created_by
          : null;
        if (!prev) {
          notesAgg.set(key, { count: 1, lastAt: at, lastBy: by });
        } else {
          prev.count += 1;
          if (at && (!prev.lastAt || at > prev.lastAt)) {
            prev.lastAt = at;
            prev.lastBy = by;
          }
        }
      }
      for (const l of leadMap.values()) {
        const agg = notesAgg.get(l.user_id);
        l.notesCount = agg?.count ?? 0;
        l.lastNoteAt = agg?.lastAt ?? null;
        // Сырое значение (id или имя) — имя подставим после резолва ниже.
        l.lastTouchedBy = agg?.lastBy ?? null;
      }
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

    // NOTE: pure operator-placeholder leads (no rentals/sales/todos) are NOT
    // dropped server-side — the toolbar's «Скрыть заглушки» toggle hides them
    // on the client (filterLeads → hidePlaceholders), so operators can still
    // peek at them when needed.

    // ── Server-side filtering: return todos matching loaded leads ──
    //
    // Matching strategy (2026-09-02 identity fix):
    //  1. rental_id (direct column or description JSON) → lead that owns the rental
    //  2. ANY identity candidate: user_id / phone / lead_id / description fields
    //     (raw + phone-normalized variants) — see getTodoLeadIds.
    //
    // Operator-created todos (user_id = operator, phone = renter) match the
    // renter's phone-keyed lead via the phone candidate; the operator chat_id
    // candidate matches nothing because leads are never keyed by operator ids.
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
     * Get ALL lead-identifier candidates from a todo.
     *
     * ── IDENTITY MATCHING FIX (2026-09-02, round 2) ──
     * The old version returned the FIRST matching column in priority order
     * (user_id → phone → lead_id → description). That single-candidate chain
     * had a fatal flaw for operator-created todos: the bot's /doc flow writes
     * user_id = OPERATOR's chat_id AND phone = RENTER's phone on the same row.
     * user_id won the priority race, matched no lead (leads are no longer keyed
     * by operator ids), and the REAL renter's todo silently disappeared from
     * the leads page. The same applied to notes/history attached to the lead.
     *
     * Now we return EVERY candidate (user_id, phone, lead_id, description
     * fields — raw AND phone-normalized variants) and the caller matches if
     * ANY candidate belongs to a loaded lead. Operator chat_ids are harmless
     * here: no lead is ever keyed by an operator id, so those candidates
     * simply never match, while the renter's phone candidate does.
     *
     * Also: phone-shaped 11-digit values ("89960430155", "7904…") stored in
     * user_id by older bot flows are normalized to E.164 as additional
     * candidates so they match phone-keyed leads.
     *
     * BUG FIX (previously, kept): /^\d{1,9}$/ rejected 10-digit Telegram IDs
     * (e.g. 7813830016). Now allows up to 12 digits.
     */
    const getTodoLeadIds = (t: typeof todos[number]): string[] => {
      const ids: string[] = [];
      const push = (v: string | null | undefined): void => {
        if (v && v.length > 0 && !ids.includes(v)) ids.push(v);
      };
      // push a value AND its normalized-phone form (both are candidates)
      const pushWithPhone = (v: string | null | undefined): void => {
        if (!v) return;
        push(v);
        const n = normalizePhone(v);
        if (n) push(n);
      };

      // 1. user_id column — Telegram chat_id, or a phone-shaped legacy value
      if (t.user_id && /^\d{1,12}$/.test(t.user_id)) {
        push(t.user_id);
        if (/^[78]\d{10}$/.test(t.user_id)) push(normalizePhone(t.user_id));
      }
      // 2. phone column — phone-only leads
      pushWithPhone(t.phone);
      // 3. lead_id column — legacy fallback
      if (t.lead_id) {
        if (/^\d{1,12}$/.test(t.lead_id)) {
          push(t.lead_id);
          if (/^[78]\d{10}$/.test(t.lead_id)) push(normalizePhone(t.lead_id));
        } else {
          pushWithPhone(t.lead_id);
          if (t.lead_id.includes("-")) push(t.lead_id);
        }
      }
      // 4. description JSON — legacy fallback
      if (t.description) {
        try {
          const desc = JSON.parse(t.description);
          if (desc.user_id && typeof desc.user_id === "string" && /^\d{1,12}$/.test(desc.user_id)) {
            push(desc.user_id);
            if (/^[78]\d{10}$/.test(desc.user_id)) push(normalizePhone(desc.user_id));
          }
          if (desc.phone && typeof desc.phone === "string") pushWithPhone(desc.phone);
          if (desc.lead_id && typeof desc.lead_id === "string") {
            if (/^\d{1,12}$/.test(desc.lead_id)) {
              push(desc.lead_id);
              if (/^[78]\d{10}$/.test(desc.lead_id)) push(normalizePhone(desc.lead_id));
            } else {
              pushWithPhone(desc.lead_id);
              if (desc.lead_id.includes("-")) push(desc.lead_id);
            }
          }
        } catch { /* ignore */ }
      }
      return ids;
    };

    const filteredTodos = (todos || []).filter((t) => {
      // 1. Match by rental_id (strongest link — works before QR claim)
      const todoRentalId = getTodoRentalId(t);
      if (todoRentalId && rentalIdToLeadId.has(todoRentalId)) return true;

      // 2-5. Match by ANY identity candidate (see getTodoLeadIds)
      const todoLeadIds = getTodoLeadIds(t);
      if (todoLeadIds.some((id) => leadUserIds.has(id))) return true;

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

    // Compute assignee/owner for each lead.
    // FIX: this whole block used to run ONLY when some todo had assigned_to —
    // crews without assigned todos got ownerId set but ownerName stayed null,
    // so the «Ответственный» dropdown on /leads was empty and the filter
    // looked broken. Now names are ALWAYS resolved (assignees ∪ owners).
    const assigneeIds = new Set<string>();
    for (const t of dedupedTodos) {
      if (t.assigned_to) assigneeIds.add(t.assigned_to);
    }
    for (const l of leadMap.values()) {
      if (l.ownerId) assigneeIds.add(l.ownerId);
    }
    // Авторы заметок (created_by = user_id оператора) — их имена тоже нужны
    // для плашки «последний трогал» на карточке лида.
    for (const l of leadMap.values()) {
      if (l.lastTouchedBy && /^\d+$/.test(l.lastTouchedBy)) assigneeIds.add(l.lastTouchedBy);
    }
    const assigneeIdsList = Array.from(assigneeIds);
    const assigneeMap = new Map<string, { username: string | null; full_name: string | null }>();
    if (assigneeIdsList.length > 0) {
      const { data: assigneeUsers } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name")
        .in("user_id", assigneeIdsList);
      for (const u of assigneeUsers ?? []) {
        assigneeMap.set(u.user_id, { username: u.username, full_name: u.full_name });
      }
    }
    for (const l of leadMap.values()) {
      l.assigneeId = computeAssignee(l, dedupedTodos);
      if (l.assigneeId) {
        const a = assigneeMap.get(l.assigneeId);
        l.assigneeName = a?.full_name || a?.username || null;
      }
      if (l.ownerId) {
        const o = assigneeMap.get(l.ownerId) || tgUserMap.get(l.ownerId);
        l.ownerName = o?.full_name || o?.username || null;
      }
      // «Последний оператор»: created_by (user_id) → человекочитаемое имя.
      // Нечисловые значения считаем уже готовым именем (легаси-текст).
      if (l.lastTouchedBy && /^\d+$/.test(l.lastTouchedBy)) {
        const a = assigneeMap.get(l.lastTouchedBy) || tgUserMap.get(l.lastTouchedBy);
        if (a) l.lastTouchedBy = a.full_name || a.username || l.lastTouchedBy;
      }
    }

    // iter35: resolve todo assignee names — the sheet used to render the raw
    // numeric chat_id («356282674») on every todo row.
    for (const t of dedupedTodos) {
      if (t.assigned_to && /^\d+$/.test(t.assigned_to)) {
        const a = assigneeMap.get(t.assigned_to) || tgUserMap.get(t.assigned_to);
        t.assignedToName = a?.full_name || a?.username || null;
      } else {
        t.assignedToName = t.assigned_to || null;
      }
    }

    return {
      success: true,
      leads: Array.from(leadMap.values()),
      todos: dedupedTodos,
    };
  } catch (error) {
    logger.error("[getFranchizeLeads] failed:", error);
    return { success: false, error: "Не удалось загрузить лиды" };
  }
}

// ── Document Verification ──────────────────────────────────────────────────────
// Types (DocVerificationData, GetRentalDocVerificationResult) are re-exported
// from leads-types.ts at the top of this file.

/**
 * Get document verification data for a rental.
 * Returns signed URLs for photos, OCR data from user_rental_secrets, and checklist status.
 * Auth: actorUserId must be the rental owner, a crew operator, or a global admin
 * (or authenticated via analytics password).
 */
export async function getRentalDocVerification(
  rentalId: string,
  actorUserId?: string,
  isPasswordAuth?: boolean,
): Promise<GetRentalDocVerificationResult> {
  const { privateSchema } = await import("@/lib/private-secrets");
  noStore();
  if (!rentalId) {
    return { success: false, error: "rentalId is required" };
  }

  try {
    // 1. Fetch rental with photo paths and metadata
    const { data: rental, error: rentalError } = await supabaseAdmin
      .from("rentals")
      .select("rental_id, user_id, crew_id, owner_id, metadata, passport_mainpage_photo, passport_registration_photo, drivers_licence_frontal_photo")
      .eq("rental_id", rentalId)
      .single();

    if (rentalError || !rental) {
      return { success: false, error: "Rental not found" };
    }

    // ── Auth check (LA-002 FIX: no more isPasswordAuth boolean bypass) ──
    // Dynamic imports to avoid module-level server-only chain
    const { cookies } = await import("next/headers");
    const { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } = await import("@/lib/telegram-actor-cookie");
    const cookieUserId = verifyTelegramActorCookieValue(
      (await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value,
    );

    if (cookieUserId) {
      // Telegram auth — check if this is the rental owner or renter
      const isRentalOwner = rental.owner_id === cookieUserId;
      const isRenter = rental.user_id === cookieUserId;

      if (!isRentalOwner && !isRenter && rental.crew_id) {
        // Not their rental — verify crew access
        const access = await verifyCrewAccess(rental.crew_id);
        if (!access.allowed) {
          return { success: false, error: access.error || "Недостаточно прав." };
        }
      } else if (!isRentalOwner && !isRenter) {
        return { success: false, error: "Недостаточно прав." };
      }
    } else if (actorUserId && isPasswordAuth) {
      // LR3-008 FIX: check rental ownership FIRST (handles null crew_id case).
      // Was: only checked crew_id, so rentals with null crew_id always failed
      // even for the legitimate owner.
      const isRentalOwner = rental.owner_id === actorUserId;
      const isRenter = rental.user_id === actorUserId;

      if (isRentalOwner || isRenter) {
        // Owner/renter always has access — proceed
      } else if (rental.crew_id) {
        // Not the owner — verify crew ownership
        const ownerAccess = await verifyCrewOwnerAccess(actorUserId, rental.crew_id);
        if (!ownerAccess.allowed) {
          return { success: false, error: ownerAccess.error || "Недостаточно прав." };
        }
      } else {
        return { success: false, error: "Недостаточно прав." };
      }
    } else {
      // No valid auth
      return { success: false, error: "Не авторизован." };
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