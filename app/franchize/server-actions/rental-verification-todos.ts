"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RentalVerificationTodoType =
  | "passport_mainpage"
  | "passport_registration"
  | "drivers_license"
  | "odometer"
  | "dates";

export interface RentalVerificationTodo {
  id: string;
  rental_id: string;
  todo_type: RentalVerificationTodoType;
  title: string;
  status: "pending" | "in_progress" | "done";
  created_at: string;
  completed_at: string | null;
}

export interface CheckAllTodosCompletedResult {
  allCompleted: boolean;
  completedCount: number;
  totalCount: number;
  todos: RentalVerificationTodo[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VERIFICATION_TODO_TEMPLATES: Array<{
  type: RentalVerificationTodoType;
  title: string;
  priority: "low" | "medium" | "high";
}> = [
  {
    type: "passport_mainpage",
    title: "Верифицировать паспорт (главная страница)",
    priority: "high",
  },
  {
    type: "passport_registration",
    title: "Верифицировать паспорт (страница с пропиской)",
    priority: "high",
  },
  {
    type: "drivers_license",
    title: "Верифицировать водительское удостоверение",
    priority: "high",
  },
  {
    type: "odometer",
    title: "Подтвердить начальный одометр",
    priority: "medium",
  },
  {
    type: "dates",
    title: "Подтвердить даты аренды",
    priority: "medium",
  },
];

// ─── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Создаёт 5 verification todos при создании аренды.
 * Вызывается из actions-runtime.ts после успешного insert в rentals.
 */
export async function createRentalVerificationTodos(
  rentalId: string,
  crewId: string,
  leadId?: string | null
): Promise<{ success: boolean; created: number; error?: string }> {
  try {
    if (!rentalId) {
      return { success: false, created: 0, error: "rentalId is required" };
    }

    console.log(`[rental-verification-todos] Creating todos for rental ${rentalId}${leadId ? `, lead ${leadId}` : ""}`);

    const todosToInsert = VERIFICATION_TODO_TEMPLATES.map((template) => ({
      id: randomUUID(),
      crew_id: crewId,
      lead_id: leadId || null,
      title: template.title,
      description: JSON.stringify({
        rental_id: rentalId,
        todo_type: template.type,
        source: "rental_verification_system",
        lead_id: leadId || null,
      }),
      category: "rental_verification",
      status: "pending",
      priority: template.priority,
      assigned_to: null,
      created_by: "system",
    }));

    const { error } = await supabaseAdmin.from("crew_todos").insert(todosToInsert);

    if (error) {
      console.error("[rental-verification-todos] Insert error:", error);
      return { success: false, created: 0, error: error.message };
    }

    console.log(`[rental-verification-todos] Created ${todosToInsert.length} todos for rental ${rentalId}`);
    return { success: true, created: todosToInsert.length };
  } catch (error) {
    console.error("[rental-verification-todos] Error:", error);
    return {
      success: false,
      created: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Помечает конкретный verification todo как выполненный.
 * Вызывается из verify-rental-checklist API при верификации документа.
 */
export async function completeRentalVerificationTodo(
  rentalId: string,
  todoType: RentalVerificationTodoType,
  crewId?: string
): Promise<{ success: boolean; completed: boolean; error?: string }> {
  try {
    if (!rentalId || !todoType) {
      return { success: false, completed: false, error: "rentalId and todoType are required" };
    }

    console.log(`[rental-verification-todos] Completing todo ${todoType} for rental ${rentalId}`);

    // Find the todo by rental_id in description JSON and todo_type
    let query = supabaseAdmin
      .from("crew_todos")
      .select("id, status, description")
      .eq("category", "rental_verification")
      .eq("status", "pending");

    if (crewId) {
      query = query.eq("crew_id", crewId);
    }

    const { data: todos, error: findError } = await query;

    if (findError) {
      console.error("[rental-verification-todos] Find error:", findError);
      return { success: false, completed: false, error: findError.message };
    }

    // Filter todos by rental_id and todo_type in description
    const matchingTodo = todos?.find((todo) => {
      try {
        const desc = JSON.parse(todo.description || "{}");
        return desc.rental_id === rentalId && desc.todo_type === todoType;
      } catch {
        return false;
      }
    });

    if (!matchingTodo) {
      console.warn(`[rental-verification-todos] Todo ${todoType} not found for rental ${rentalId}`);
      return { success: true, completed: false }; // Not an error — todo might not exist
    }

    if (matchingTodo.status === "done") {
      console.log(`[rental-verification-todos] Todo ${todoType} already completed for rental ${rentalId}`);
      return { success: true, completed: true };
    }

    // Update todo status to done
    const { error: updateError } = await supabaseAdmin
      .from("crew_todos")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", matchingTodo.id);

    if (updateError) {
      console.error("[rental-verification-todos] Update error:", updateError);
      return { success: false, completed: false, error: updateError.message };
    }

    console.log(`[rental-verification-todos] Completed todo ${todoType} for rental ${rentalId}`);
    return { success: true, completed: true };
  } catch (error) {
    console.error("[rental-verification-todos] Error:", error);
    return {
      success: false,
      completed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Проверяет, все ли 5 verification todos выполнены для данной аренды.
 */
export async function checkAllTodosCompleted(
  rentalId: string,
  crewId?: string
): Promise<{ success: boolean; data?: CheckAllTodosCompletedResult; error?: string }> {
  try {
    if (!rentalId) {
      return { success: false, error: "rentalId is required" };
    }

    console.log(`[rental-verification-todos] Checking completion for rental ${rentalId}`);

    // Fetch all verification todos for this rental
    let query = supabaseAdmin
      .from("crew_todos")
      .select("id, status, description, created_at, completed_at")
      .eq("category", "rental_verification");

    if (crewId) {
      query = query.eq("crew_id", crewId);
    }

    const { data: allTodos, error: fetchError } = await query;

    if (fetchError) {
      console.error("[rental-verification-todos] Fetch error:", fetchError);
      return { success: false, error: fetchError.message };
    }

    // Filter by rental_id in description
    const rentalTodos = (allTodos || []).filter((todo) => {
      try {
        const desc = JSON.parse(todo.description || "{}");
        return desc.rental_id === rentalId;
      } catch {
        return false;
      }
    });

    const completedCount = rentalTodos.filter((t) => t.status === "done").length;
    const totalCount = rentalTodos.length;
    const allCompleted = totalCount > 0 && completedCount === totalCount;

    const result: CheckAllTodosCompletedResult = {
      allCompleted,
      completedCount,
      totalCount,
      todos: rentalTodos.map((t) => {
        const desc = JSON.parse(t.description || "{}");
        return {
          id: t.id,
          rental_id: rentalId,
          todo_type: desc.todo_type as RentalVerificationTodoType,
          title: VERIFICATION_TODO_TEMPLATES.find((tpl) => tpl.type === desc.todo_type)?.title || "Unknown",
          status: t.status,
          created_at: t.created_at,
          completed_at: t.completed_at,
        };
      }),
    };

    console.log(`[rental-verification-todos] Rental ${rentalId}: ${completedCount}/${totalCount} completed`);
    return { success: true, data: result };
  } catch (error) {
    console.error("[rental-verification-todos] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Получает все verification todos для данной аренды (для UI).
 */
export async function getRentalVerificationTodos(
  rentalId: string,
  crewId?: string
): Promise<{ success: boolean; data?: RentalVerificationTodo[]; error?: string }> {
  try {
    if (!rentalId) {
      return { success: false, error: "rentalId is required" };
    }

    let query = supabaseAdmin
      .from("crew_todos")
      .select("id, title, status, description, created_at, completed_at")
      .eq("category", "rental_verification")
      .order("created_at", { ascending: true });

    if (crewId) {
      query = query.eq("crew_id", crewId);
    }

    const { data: allTodos, error: fetchError } = await query;

    if (fetchError) {
      console.error("[rental-verification-todos] Fetch error:", fetchError);
      return { success: false, error: fetchError.message };
    }

    // Filter by rental_id in description
    const rentalTodos = (allTodos || [])
      .filter((todo) => {
        try {
          const desc = JSON.parse(todo.description || "{}");
          return desc.rental_id === rentalId;
        } catch {
          return false;
        }
      })
      .map((t) => {
        const desc = JSON.parse(t.description || "{}");
        return {
          id: t.id,
          rental_id: rentalId,
          todo_type: desc.todo_type as RentalVerificationTodoType,
          title: t.title,
          status: t.status,
          created_at: t.created_at,
          completed_at: t.completed_at,
        };
      });

    return { success: true, data: rentalTodos };
  } catch (error) {
    console.error("[rental-verification-todos] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
