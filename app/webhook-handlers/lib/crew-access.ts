/**
 * crew-access.ts
 * ==============
 * Shared utility for multi-crew access control in Telegram bot commands.
 *
 * Checks if a Telegram user is a member/owner of any crew, and provides
 * crew selection UI when the user belongs to multiple crews.
 *
 * Used by: /doc, /testdrive, /subrent command handlers
 */

import { logger } from "@/lib/logger";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendComplexMessage, type KeyboardButton } from "../actions/sendComplexMessage";

export interface CrewInfo {
  id: string;
  slug: string;
  name: string;
  isOwner: boolean;
}

/**
 * Get all crews where the given telegram user is an owner or active member.
 * Returns empty array if user has no crew access.
 */
export async function getUserCrews(telegramUserId: string): Promise<CrewInfo[]> {
  try {
    // 1. Find crews where user is owner
    const { data: ownedCrews } = await supabaseAdmin
      .from("crews")
      .select("id, slug, brand_name")
      .eq("owner_id", telegramUserId);

    // 2. Find crews where user is an active member
    const { data: memberships } = await supabaseAdmin
      .from("crew_members")
      .select("crew_id")
      .eq("user_id", telegramUserId)
      .eq("membership_status", "active");

    const memberCrewIds = (memberships || []).map((m) => m.crew_id);

    let memberCrews: { id: string; slug: string; brand_name: string }[] = [];
    if (memberCrewIds.length > 0) {
      const { data: crews } = await supabaseAdmin
        .from("crews")
        .select("id, slug, brand_name")
        .in("id", memberCrewIds);
      memberCrews = (crews || []).filter(
        (c) => !(ownedCrews || []).some((oc) => oc.id === c.id) // don't double-count owned
      );
    }

    const allCrews: CrewInfo[] = [
      ...(ownedCrews || []).map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.brand_name || c.slug,
        isOwner: true,
      })),
      ...memberCrews.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.brand_name || c.slug,
        isOwner: false,
      })),
    ];

    return allCrews;
  } catch (error) {
    logger.error("[crew-access] Error getting user crews:", error);
    return [];
  }
}

/**
 * Get available bikes for a given crew slug.
 * Returns bikes assigned to the crew OR unassigned bikes (crew_id = null).
 */
export async function getCrewBikes(
  crewSlug: string,
): Promise<Array<{ id: string; make: string; model: string; type?: string; specs?: Record<string, any> }>> {
  try {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("id")
      .eq("slug", crewSlug)
      .maybeSingle();

    if (!crew?.id) {
      logger.warn(`[crew-access] Crew not found for slug: ${crewSlug}`);
      return [];
    }

    const { data } = await supabaseAdmin
      .from("cars")
      .select("id, make, model, type, specs")
      .in("type", ["bike", "ebike"])
      .or(`crew_id.eq.${crew.id},crew_id.is.null`)
      .order("make", { ascending: true });

    return (data || []) as Array<{
      id: string;
      make: string;
      model: string;
      type?: string;
      specs?: Record<string, any>;
    }>;
  } catch (error) {
    logger.error(`[crew-access] Error getting bikes for crew ${crewSlug}:`, error);
    return [];
  }
}

/**
 * Get all bikes (regardless of crew) for backup/fallback.
 */
export async function getAllBikes(): Promise<
  Array<{ id: string; make: string; model: string; type?: string; specs?: Record<string, any> }>
> {
  const { data } = await supabaseAdmin
    .from("cars")
    .select("id, make, model, type, specs")
    .in("type", ["bike", "ebike"])
    .order("make", { ascending: true });

  return (data || []) as Array<{
    id: string;
    make: string;
    model: string;
    type?: string;
    specs?: Record<string, any>;
  }>;
}

/**
 * Build a crew selection inline keyboard from a list of crews.
 * Shows owner/member badges when showBadges=true (user has crew access),
 * or plain names when showBadges=false (general public).
 */
export function buildCrewSelectionKeyboard(crews: CrewInfo[], showBadges: boolean = true): KeyboardButton[][] {
  const rows: KeyboardButton[][] = [];
  for (const crew of crews) {
    const label = showBadges && crew.isOwner ? `👑 ${crew.name}` 
      : showBadges ? `👤 ${crew.name}` 
      : `🏍 ${crew.name}`;
    rows.push([{ text: label, callback_data: `crewsel_${crew.slug}` }]);
  }
  rows.push([{ text: "❌ Отменить", callback_data: "crewsel_cancel" }]);
  return rows;
}

/**
 * Get ALL crews in the system (for general public selection).
 * Used when user is not a member of any crew — they can still
 * pick a crew to use its templates/secrets.
 */
export async function getAllCrews(): Promise<CrewInfo[]> {
  try {
    const { data: crews } = await supabaseAdmin
      .from("crews")
      .select("id, slug, brand_name")
      .order("brand_name", { ascending: true });

    return (crews || []).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.brand_name || c.slug,
      isOwner: false, // general public is never owner
    }));
  } catch (error) {
    logger.error("[crew-access] Error getting all crews:", error);
    return [];
  }
}

/**
 * Get all crew slugs for a user (for the command handler to pre-check).
 * Returns a list of unique crew slugs.
 */
export async function getUserCrewSlugs(telegramUserId: string): Promise<string[]> {
  const crews = await getUserCrews(telegramUserId);
  return crews.map((c) => c.slug);
}

/**
 * Check if a user has access to ANY crew.
 */
export async function userHasCrewAccess(telegramUserId: string): Promise<boolean> {
  const crews = await getUserCrews(telegramUserId);
  return crews.length > 0;
}

/**
 * Load crew secrets for contract defaults from crew_secrets table.
 * Handles both JSON and raw object formats.
 */
export async function loadCrewSecrets(
  crewSlug: string,
  fallbacks: Record<string, string>,
): Promise<Record<string, string>> {
  try {
    const { data: secretsData } = await supabaseAdmin
      .from("crew_secrets")
      .select("contract_defaults")
      .eq("crew_slug", crewSlug)
      .maybeSingle();

    let cd: Record<string, any> = {};
    if (secretsData?.contract_defaults) {
      cd =
        typeof secretsData.contract_defaults === "string"
          ? JSON.parse(secretsData.contract_defaults)
          : secretsData.contract_defaults;
    }

    // Merge: actual values override fallbacks
    const result: Record<string, string> = { ...fallbacks };
    for (const [key, val] of Object.entries(cd)) {
      if (val && typeof val === "string") {
        result[key] = val;
      }
    }
    return result;
  } catch (error) {
    logger.warn(`[crew-access] Failed to load crew_secrets for ${crewSlug}, using fallbacks:`, error);
    return { ...fallbacks };
  }
}

// ── Crew-specific template loading ─────────────────────────────────────────

import { readFileSync } from "fs";
import { join } from "path";

const CREW_DOCS_DIR = "docs/crewDocs";
const GENERAL_DOCS_DIR = "docs";

/**
 * Template names mapped to their file names.
 */
const TEMPLATE_FILES: Record<string, string> = {
  rental: "RENTAL_DEAL_TEMPLATE.html",
  sale: "SALE_DEAL_TEMPLATE.html",
  testdrive: "TESTDRIVE_DEAL_TEMPLATE.html",
  subrental: "SUBRENTAL_DEAL_TEMPLATE.html",
  commercial_proposal: "COMMERCIAL_PROPOSAL_TEMPLATE.html",
};

/**
 * Load a contract template, checking for crew-specific version first.
 *
 * Priority:
 *   1. `docs/crewDocs/{crewSlug}_{templateFile}` — crew-specific override
 *   2. `docs/{templateFile}` — general fallback
 *
 * @param templateKey — one of "rental", "sale", "testdrive", "subrental", "commercial_proposal"
 * @param crewSlug — crew slug (e.g. "vip-bike", "custom-bobber-virus")
 * @returns template HTML string
 * @throws if neither file exists
 */
export function loadTemplateForCrew(templateKey: string, crewSlug?: string): string {
  const templateFile = TEMPLATE_FILES[templateKey];
  if (!templateFile) {
    throw new Error(`[crew-access] Unknown template key: ${templateKey}`);
  }

  // 1. Try crew-specific template
  if (crewSlug) {
    const crewPath = join(process.cwd(), CREW_DOCS_DIR, `${crewSlug}_${templateFile}`);
    try {
      const crewTemplate = readFileSync(crewPath, "utf8");
      if (crewTemplate.trim().length > 0) {
        logger.info(`[crew-access] Using crew-specific template: ${crewSlug}_${templateFile}`);
        return crewTemplate;
      }
    } catch {
      logger.info(`[crew-access] No crew-specific template for ${crewSlug}, using general: ${templateFile}`);
    }
  }

  // 2. Fall back to general template
  const generalPath = join(process.cwd(), GENERAL_DOCS_DIR, templateFile);
  try {
    const generalTemplate = readFileSync(generalPath, "utf8");
    if (generalTemplate.trim().length > 0) {
      return generalTemplate;
    }
  } catch {
    // continue to error
  }

  throw new Error(
    `[crew-access] Template not found: ${templateFile} (crew: ${crewSlug || "none"})`,
  );
}
