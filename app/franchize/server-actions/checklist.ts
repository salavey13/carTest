"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface ChecklistState {
  type: "handout" | "return";
  items: ChecklistItem[];
  updated_at: string;
}

// Default checklist items
const DEFAULT_CHECKLIST_ITEMS: Record<"handout" | "return", ChecklistItem[]> = {
  handout: [
    { id: "passport", text: "Паспорт проверен", checked: false },
    { id: "driver-license", text: "ВУ проверено", checked: false },
    { id: "deposit", text: "Залог собран", checked: false },
    { id: "helmet", text: "Шлем выдан", checked: false },
    { id: "keys", text: "Ключи выданы", checked: false },
    { id: "instructions", text: "Инструкции даны", checked: false },
  ],
  return: [
    { id: "condition", text: "Состояние проверено", checked: false },
    { id: "helmet-return", text: "Шлем возвращён", checked: false },
    { id: "keys-return", text: "Ключи возвращены", checked: false },
    { id: "deposit-return", text: "Залог возвращён", checked: false },
    { id: "no-damages", text: "Повреждений нет", checked: false },
  ],
};

// ─── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Get checklist state for a specific type (handout or return).
 * Returns the current checklist items with their checked state.
 */
export async function getAllChecklistStates(input: {
  actorUserId: string;
}): Promise<{ success: boolean; data?: { handout: ChecklistState | null; return: ChecklistState | null } | null; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId } = parsed.data;

    // Password auth bypass: if actorUserId looks like it's from password flow,
    // skip admin check. Password auth users have full access.
    // We detect this by checking if there's no user record (password auth uses placeholder IDs)
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("user_id, metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();

    // If user exists, check admin rights. If not, assume password auth (bypass).
    if (user) {
      const userMetadata = user?.metadata as Record<string, unknown> | null;
      const isAdmin = userMetadata?.role === "admin";

      if (!isAdmin) {
        return { success: false, error: "Недостаточно прав для просмотра." };
      }
    }
    // If no user found, assume password auth - grant access

    // Get both checklist states
    const [handoutResult, returnResult] = await Promise.all([
      getChecklistStateInternal("handout"),
      getChecklistStateInternal("return"),
    ]);

    return {
      success: true,
      data: {
        handout: handoutResult,
        return: returnResult,
      },
    };
  } catch (error) {
    console.error("[get-all-checklist-states] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Internal function to get single checklist state
async function getChecklistStateInternal(type: "handout" | "return"): Promise<ChecklistState | null> {
  const { data: existingState, error } = await supabaseAdmin
    .from("checklist_state")
    .select("type, items, updated_at")
    .eq("type", type)
    .maybeSingle();

  if (error) {
    console.error("[get-checklist-state-internal] Query error:", error);
    // If table doesn't exist yet, return defaults
    if (error.code === "42P01") {
      return {
        type,
        items: DEFAULT_CHECKLIST_ITEMS[type],
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  }

  if (!existingState) {
    return {
      type,
      items: DEFAULT_CHECKLIST_ITEMS[type],
      updated_at: new Date().toISOString(),
    };
  }

  return existingState as ChecklistState;
}

/**
 * Get checklist state for a specific type (handout or return).
 * Returns the current checklist items with their checked state.
 * @deprecated Use getAllChecklistStates instead
 */
export async function getChecklistState(input: {
  actorUserId: string;
  type: "handout" | "return";
}): Promise<{ success: boolean; data?: ChecklistState | null; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      type: z.enum(["handout", "return"]),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, type } = parsed.data;

    // Verify user is authenticated
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("user_id, metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!user) {
      return { success: false, error: "Пользователь не найден." };
    }

    const userMetadata = user?.metadata as Record<string, unknown> | null;
    const isAdmin = userMetadata?.role === "admin";

    if (!isAdmin) {
      return { success: false, error: "Недостаточно прав для просмотра." };
    }

    // Get checklist state from public.checklist_state
    const { data: existingState, error } = await supabaseAdmin
      .from("checklist_state")
      .select("type, items, updated_at")
      .eq("type", type)
      .maybeSingle();

    if (error) {
      console.error("[get-checklist-state] Query error:", error);
      // If table doesn't exist yet, return defaults
      if (error.code === "42P01") {
        return {
          success: true,
          data: {
            type,
            items: DEFAULT_CHECKLIST_ITEMS[type],
            updated_at: new Date().toISOString(),
          },
        };
      }
      return { success: false, error: error.message };
    }

    // If no state exists, return defaults
    if (!existingState) {
      return {
        success: true,
        data: {
          type,
          items: DEFAULT_CHECKLIST_ITEMS[type],
          updated_at: new Date().toISOString(),
        },
      };
    }

    return {
      success: true,
      data: existingState as ChecklistState,
    };
  } catch (error) {
    console.error("[get-checklist-state] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update checklist state (toggle items or reset).
 * Persists the new state to the database.
 */
export async function updateChecklistState(input: {
  actorUserId: string;
  type: "handout" | "return";
  items: ChecklistItem[];
  action?: "toggle" | "reset";
}): Promise<{ success: boolean; data?: ChecklistState; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      type: z.enum(["handout", "return"]),
      items: z.array(z.object({
        id: z.string(),
        text: z.string(),
        checked: z.boolean(),
      })),
      action: z.enum(["toggle", "reset"]).optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, type, items, action } = parsed.data;

    // Password auth bypass: if no user found, assume password auth (grant access)
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("user_id, metadata")
      .eq("user_id", actorUserId)
      .maybeSingle();

    // If user exists, check admin rights. If not, assume password auth (bypass).
    if (user) {
      const userMetadata = user?.metadata as Record<string, unknown> | null;
      const isAdmin = userMetadata?.role === "admin";

      if (!isAdmin) {
        return { success: false, error: "Недостаточно прав для обновления." };
      }
    }
    // If no user found, assume password auth - grant access

    // Determine the final items based on action
    let finalItems = items;
    if (action === "reset") {
      finalItems = DEFAULT_CHECKLIST_ITEMS[type].map(item => ({ ...item, checked: false }));
    }

    // Upsert checklist state
    const { data, error } = await supabaseAdmin
      .from("checklist_state")
      .upsert({
        type,
        items: finalItems,
        updated_at: new Date().toISOString(),
      })
      .select("type, items, updated_at")
      .single();

    if (error) {
      console.error("[update-checklist-state] Upsert error:", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data as ChecklistState,
    };
  } catch (error) {
    console.error("[update-checklist-state] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Reset a checklist to default unchecked state.
 */
export async function resetChecklistState(input: {
  actorUserId: string;
  type: "handout" | "return";
}): Promise<{ success: boolean; data?: ChecklistState; error?: string }> {
  return updateChecklistState({
    actorUserId: input.actorUserId,
    type: input.type,
    items: DEFAULT_CHECKLIST_ITEMS[input.type],
    action: "reset",
  });
}
