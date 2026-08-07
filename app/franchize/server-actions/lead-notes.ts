"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } from "@/lib/telegram-actor-cookie";

export interface LeadNote {
  id: string;
  lead_id: string;
  crew_id: string;
  text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Auth helper (LR3-002 FIX: was NO auth on any note CRUD) ──────────────────
// Verifies caller has access to the given crew via signed cookie or password auth.
// Same secure pattern as leads.ts verifyCrewAccess — no client-supplied booleans trusted.
async function verifyNoteAccess(
  crewId: string,
  actorUserId?: string,
  isPasswordAuth?: boolean,
): Promise<{ allowed: boolean; error?: string }> {
  // Path 1: Telegram WebApp — read signed cookie
  const cookieUserId = verifyTelegramActorCookieValue(
    (await cookies()).get(TELEGRAM_ACTOR_COOKIE)?.value,
  );

  if (cookieUserId) {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", crewId)
      .maybeSingle();
    const isOwner = crew?.owner_id === cookieUserId;

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", cookieUserId)
      .maybeSingle();
    const userMeta = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMeta?.role === "admin" || userMeta?.status === "admin";

    const { data: member } = await supabaseAdmin
      .from("crew_members")
      .select("user_id")
      .eq("crew_id", crewId)
      .eq("user_id", cookieUserId)
      .eq("membership_status", "active")
      .maybeSingle();
    const isMember = !!member;

    if (isOwner || isAdmin || isMember) return { allowed: true };
    return { allowed: false, error: "Недостаточно прав." };
  }

  // Path 2: Password auth — verify actorUserId is crew owner
  if (actorUserId && isPasswordAuth) {
    const { data: crew } = await supabaseAdmin
      .from("crews")
      .select("owner_id")
      .eq("id", crewId)
      .maybeSingle();
    if (!crew) return { allowed: false, error: "Экипаж не найден." };
    if (crew.owner_id === actorUserId) return { allowed: true };

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();
    const userMeta = user?.metadata as Record<string, unknown> | null;
    if (userMeta?.role === "admin" || userMeta?.status === "admin") return { allowed: true };

    return { allowed: false, error: "Недостаточно прав." };
  }

  return { allowed: false, error: "Не авторизован." };
}

/**
 * Get all notes for a specific lead
 */
export async function getLeadNotes(
  leadId: string,
  crewId: string,
  actorUserId?: string,
  isPasswordAuth?: boolean,
): Promise<{ success: boolean; data?: LeadNote[]; error?: string }> {
  try {
    const access = await verifyNoteAccess(crewId, actorUserId, isPasswordAuth);
    if (!access.allowed) return { success: false, error: access.error };

    const { data, error } = await supabaseAdmin
      .from("lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data || [] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Create a new note for a lead
 */
export async function createLeadNote(input: {
  leadId: string;
  crewId: string;
  text: string;
  createdBy?: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: LeadNote; error?: string }> {
  try {
    const parsed = z.object({
      leadId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
      text: z.string().trim().min(1).max(5000),
      createdBy: z.string().optional(),
      actorUserId: z.string().optional(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { leadId, crewId, text, createdBy, actorUserId, isPasswordAuth } = parsed.data;

    // LR3-002 FIX: verify crew access before writing
    const access = await verifyNoteAccess(crewId, actorUserId, isPasswordAuth);
    if (!access.allowed) return { success: false, error: access.error };

    const { data, error } = await supabaseAdmin
      .from("lead_notes")
      .insert({ lead_id: leadId, crew_id: crewId, text, created_by: createdBy || null })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Update an existing note
 * LR3-002 FIX: now verifies crew access via the note's crew_id before updating.
 */
export async function updateLeadNote(
  noteId: string,
  text: string,
  actorUserId?: string,
  isPasswordAuth?: boolean,
): Promise<{ success: boolean; data?: LeadNote; error?: string }> {
  try {
    // Fetch the note's crew_id first for auth check
    const { data: existingNote } = await supabaseAdmin
      .from("lead_notes")
      .select("crew_id")
      .eq("id", noteId)
      .maybeSingle();

    if (!existingNote) return { success: false, error: "Note not found" };

    const access = await verifyNoteAccess(existingNote.crew_id, actorUserId, isPasswordAuth);
    if (!access.allowed) return { success: false, error: access.error };

    const { data, error } = await supabaseAdmin
      .from("lead_notes")
      .update({ text, updated_at: new Date().toISOString() })
      .eq("id", noteId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Delete a note
 * LR3-002 FIX: now verifies crew access via the note's crew_id before deleting.
 */
export async function deleteLeadNote(
  noteId: string,
  actorUserId?: string,
  isPasswordAuth?: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the note's crew_id first for auth check
    const { data: existingNote } = await supabaseAdmin
      .from("lead_notes")
      .select("crew_id")
      .eq("id", noteId)
      .maybeSingle();

    if (!existingNote) return { success: false, error: "Note not found" };

    const access = await verifyNoteAccess(existingNote.crew_id, actorUserId, isPasswordAuth);
    if (!access.allowed) return { success: false, error: access.error };

    const { error } = await supabaseAdmin
      .from("lead_notes")
      .delete()
      .eq("id", noteId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
