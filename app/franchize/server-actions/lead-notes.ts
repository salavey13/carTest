"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";

export interface LeadNote {
  id: string;
  lead_id: string;
  crew_id: string;
  text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get all notes for a specific lead
 */
export async function getLeadNotes(
  leadId: string,
  crewId: string
): Promise<{ success: boolean; data?: LeadNote[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
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
}): Promise<{ success: boolean; data?: LeadNote; error?: string }> {
  try {
    const parsed = z.object({
      leadId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
      text: z.string().trim().min(1).max(5000),
      createdBy: z.string().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }

    const { leadId, crewId, text, createdBy } = parsed.data;

    const { data, error } = await supabaseAdmin
      .from("lead_notes")
      .insert({
        lead_id: leadId,
        crew_id: crewId,
        text,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update an existing note
 */
export async function updateLeadNote(
  noteId: string,
  text: string
): Promise<{ success: boolean; data?: LeadNote; error?: string }> {
  try {
    const parsed = z.object({
      noteId: z.string().trim().min(1),
      text: z.string().trim().min(1).max(5000),
    }).safeParse({ noteId, text });

    if (!parsed.success) {
      return { success: false, error: "Invalid input" };
    }

    const { data, error } = await supabaseAdmin
      .from("lead_notes")
      .update({ text, updated_at: new Date().toISOString() })
      .eq("id", noteId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Delete a note
 */
export async function deleteLeadNote(
  noteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("lead_notes")
      .delete()
      .eq("id", noteId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
