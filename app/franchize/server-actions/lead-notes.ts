"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";
import { logger } from "@/lib/logger";
// NOTE: cookies + telegram-actor-cookie imported DYNAMICALLY inside functions
// to avoid `import "server-only"` poisoning the client bundle.

export type { LeadNote } from "@/app/franchize/[slug]/leads/leads-types";

// ── Auth helper (LR3-002 FIX: was NO auth on any note CRUD) ──────────────────
// Verifies caller has access to the given crew via signed cookie or password auth.
// Same secure pattern as leads.ts verifyCrewAccess — no client-supplied booleans trusted.
async function verifyNoteAccess(
  crewId: string,
  actorUserId?: string,
  isPasswordAuth?: boolean,
): Promise<{ allowed: boolean; error?: string }> {
  // Dynamic imports to avoid module-level server-only chain
  const { cookies } = await import("next/headers");
  const { TELEGRAM_ACTOR_COOKIE, verifyTelegramActorCookieValue } = await import("@/lib/telegram-actor-cookie");

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
 * Get all notes for a specific lead.
 *
 * 2026-09-03: `created_by` (веб-заметки пишут туда user_id оператора) теперь
 * резолвится в человекочитаемое имя (users.full_name || username) — шторка
 * лида и история показывают «Иванов» вместо «413553377». Нечисловые значения
 * (легаси-текст) и null проходят как есть.
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

    // Resolve numeric created_by → display name (single users query).
    const notes = (data || []) as LeadNote[];
    const authorIds = Array.from(
      new Set(
        notes
          .map((n) => n.created_by)
          .filter((v): v is string => !!v && /^\d+$/.test(v)),
      ),
    );
    if (authorIds.length > 0) {
      const { data: authorUsers } = await supabaseAdmin
        .from("users")
        .select("user_id, username, full_name")
        .in("user_id", authorIds);
      const nameMap = new Map<string, string>();
      for (const u of authorUsers ?? []) {
        nameMap.set(u.user_id, u.full_name || u.username || u.user_id);
      }
      for (const n of notes) {
        if (n.created_by && nameMap.has(n.created_by)) {
          n.created_by = nameMap.get(n.created_by)!;
        }
      }
    }
    return { success: true, data: notes };
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
    // 2026-09-03: в БД храним стабильный user_id оператора, но в ответе
    // резолвим его в имя (как getLeadNotes) — шторка сразу показывает
    // «Иванов», а не сырой chat_id.
    if (data?.created_by && /^\d+$/.test(data.created_by)) {
      const { data: author } = await supabaseAdmin
        .from("users")
        .select("username, full_name")
        .eq("user_id", data.created_by)
        .maybeSingle();
      if (author) {
        data.created_by = author.full_name || author.username || data.created_by;
      }
    }
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
