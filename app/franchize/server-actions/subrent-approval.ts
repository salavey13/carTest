// /app/franchize/server-actions/subrent-approval.ts
/**
 * Server actions for approving/declining subrent contract applications
 */

"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Types
export interface SubrentApplicationItem {
  id: string;
  contract_key: string;
  created_at: string;
  owner_full_name: string;
  owner_phone: string;
  owner_email?: string;
  bike_make: string;
  bike_model: string;
  owner_percentage: string;
  min_daily_price_rub: string;
  contract_start_date: string;
  contract_end_date: string;
  status: "pending" | "approved" | "declined";
}

export interface SubrentApplicationsResult {
  items: SubrentApplicationItem[];
  summary: {
    totalCount: number;
    pendingCount: number;
    approvedCount: number;
    declinedCount: number;
  };
}

// ── Get pending subrent applications ─────────────────────────────────────────────

export async function getSubrentApplications(input: {
  slug: string;
  actorUserId: string;
  status?: "pending" | "approved" | "declined" | "all";
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: SubrentApplicationsResult; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      status: z.enum(["pending", "approved", "declined", "all"]).optional(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, status = "all", isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, slug, name")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      console.error("[subrent-applications] Crew not found for slug:", slug);
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
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
    }

    // Access private schema
    const privateSchema = () => (supabaseAdmin as any).schema("private");

    // Query subrent applications - filter by crew_id (which stores crew_slug)
    const query = privateSchema()
      .from("subrent_contract_artifacts")
      .select("*")
      .eq("crew_id", slug);

    // Add status filter if not "all"
    if (status !== "all") {
      // For now, we'll determine status by created_at being recent
      // TODO: Add a proper status column to the table
    }

    const { data: applications, error } = await query
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[subrent-applications] Query error:", error);
      return { success: false, error: error.message };
    }

    // Map to our interface (all are "pending" for now since we don't have a status column)
    const items: SubrentApplicationItem[] = (applications || []).map((app: any) => ({
      id: app.id,
      contract_key: app.contract_key,
      created_at: app.created_at,
      owner_full_name: app.owner_full_name || "",
      owner_phone: app.owner_phone || "",
      owner_email: app.owner_email || undefined,
      bike_make: app.bike_make || "",
      bike_model: app.bike_model || "",
      owner_percentage: app.owner_percentage || "50",
      min_daily_price_rub: app.min_daily_price_rub || "9000",
      contract_start_date: app.contract_start_date || "",
      contract_end_date: app.contract_end_date || "",
      status: "pending" as const, // All new applications are pending
    }));

    const summary: SubrentApplicationsResult["summary"] = {
      totalCount: items.length,
      pendingCount: items.filter(i => i.status === "pending").length,
      approvedCount: items.filter(i => i.status === "approved").length,
      declinedCount: items.filter(i => i.status === "declined").length,
    };

    return {
      success: true,
      data: { items, summary },
    };
  } catch (error) {
    console.error("[subrent-applications] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ── Decline subrent application ────────────────────────────────────────────────────

export async function declineSubrentApplication(input: {
  slug: string;
  actorUserId: string;
  applicationId: string;
  reason?: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      applicationId: z.string().uuid(),
      reason: z.string().optional(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, applicationId, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, slug, name")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check - only allow owners and admins
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

      if (!isOwner && !isAdmin && !isOrudjov) {
        return { success: false, error: "Недостаточно прав для отклонения заявки." };
      }
    }

    // Access private schema and delete the application
    const privateSchema = () => (supabaseAdmin as any).schema("private");

    const { error: deleteError } = await privateSchema()
      .from("subrent_contract_artifacts")
      .delete()
      .eq("id", applicationId);

    if (deleteError) {
      console.error("[decline-subrent] Delete error:", deleteError);
      return { success: false, error: "Ошибка удаления заявки." };
    }

    logger.info("[decline-subrent] Application declined:", {
      crewSlug: slug,
      applicationId,
    });

    return { success: true };
  } catch (error) {
    console.error("[decline-subrent] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ── Approve subrent application (generates contract) ──────────────────────────────

export async function approveSubrentApplication(input: {
  slug: string;
  actorUserId: string;
  applicationId: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; error?: string; data?: { contractNumber: string } }> {
  try {
    const parsed = z.object({
      slug: z.string().trim().min(1),
      actorUserId: z.string().trim().min(1),
      applicationId: z.string().uuid(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { slug, actorUserId, applicationId, isPasswordAuth = false } = parsed.data;

    // Get crew and verify access
    const { data: crew, error: crewError } = await supabaseAdmin
      .from("crews")
      .select("id, owner_id, slug, name")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (crewError || !crew) {
      return { success: false, error: "Экипаж не найден." };
    }

    // Auth check - only allow owners and admins
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

      if (!isOwner && !isAdmin && !isOrudjov) {
        return { success: false, error: "Недостаточно прав для одобрения заявки." };
      }
    }

    // Access private schema
    const privateSchema = () => (supabaseAdmin as any).schema("private");

    // Get the application details
    const { data: application, error: fetchError } = await privateSchema()
      .from("subrent_contract_artifacts")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (fetchError || !application) {
      return { success: false, error: "Заявка не найдена." };
    }

    // Generate contract using the contract generation logic
    // Import the contract generation function
    const { generateSubrentContract } = await import("@/app/franchize/lib/subrent-contract-generator");

    const result = await generateSubrentContract({
      application,
      crewSlug: slug,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Ошибка генерации договора." };
    }

    logger.info("[approve-subrent] Application approved:", {
      crewSlug: slug,
      applicationId,
      contractNumber: result.contractNumber,
    });

    // Delete the application after approval (contract has been generated)
    await privateSchema()
      .from("subrent_contract_artifacts")
      .delete()
      .eq("id", applicationId);

    return {
      success: true,
      data: { contractNumber: result.contractNumber || "" },
    };
  } catch (error) {
    console.error("[approve-subrent] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
