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

    // Determine user_id from leadId if it's a Telegram ID
    const todoUserId = leadId && /^\d{1,12}$/.test(leadId) ? leadId : null;

    const todosToInsert = VERIFICATION_TODO_TEMPLATES.map((template) => ({
      id: randomUUID(),
      crew_id: crewId,
      lead_id: leadId || null,
      user_id: todoUserId,
      rental_id: rentalId,  // Phase 3c: FK to rentals
      title: template.title,
      description: JSON.stringify({
        rental_id: rentalId,
        todo_type: template.type,
        source: "rental_verification_system",
        lead_id: leadId || null,
        user_id: todoUserId,
      }),
      category: "rental_verification",
      status: "pending",
      priority: template.priority,
      assigned_to: null,
      // goodmorning-fixes BUG 10: removed created_by: "system" — FK constraint on
      // crew_todos.created_by REFERENCES users(user_id). "system" doesn't exist in users
      // table → FK violation → 0 verification todos created. Leave unset (NULL) like
      // createLeadFollowupTodos does.
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

// ============================================================================
// createRentalClosureTodos — mirror of createRentalVerificationTodos but for
// the CLOSURE side (return / completion).
//
// BUG C fix: previously the system created 5 START verification todos
// (passport, license, odometer_start, dates) but NO closure todos. Operators
// had reminders for rental START but nothing for rental END — returns were
// forgotten, rentals stayed "active" forever, deposits weren't refunded,
// bikes weren't inspected.
//
// This function creates 5 closure todos:
//   1. "Осмотреть байк на повреждения при возврате"
//   2. "Зафиксировать финальный одометр"
//   3. "Вернуть депозит арендатору"
//   4. "Запросить отзыв у арендатора"
//   5. "Пометить аренду завершённой в дашборде"
//
// Should be called from confirmVehiclePickup() when rental becomes active
// so the closure todos appear in the operator's todo list throughout the
// rental period.
// ============================================================================

export type RentalClosureTodoType =
  | "inspect_damage"
  | "odometer_final"
  | "deposit_refund"
  | "review_request"
  | "mark_completed";

export interface RentalClosureTodo {
  id: string;
  rental_id: string;
  todo_type: RentalClosureTodoType;
  title: string;
  status: "pending" | "in_progress" | "done";
  created_at: string;
  completed_at: string | null;
}

const CLOSURE_TODO_TEMPLATES: Array<{
  type: RentalClosureTodoType;
  title: string;
  priority: "low" | "medium" | "high";
}> = [
  {
    type: "inspect_damage",
    title: "Осмотреть байк на повреждения при возврате",
    priority: "high",
  },
  {
    type: "odometer_final",
    title: "Зафиксировать финальный одометр",
    priority: "high",
  },
  {
    type: "deposit_refund",
    title: "Вернуть депозит арендатору",
    priority: "medium",
  },
  {
    type: "review_request",
    title: "Запросить отзыв у арендатора",
    priority: "low",
  },
  {
    type: "mark_completed",
    title: "Пометить аренду завершённой в дашборде",
    priority: "medium",
  },
];

export async function createRentalClosureTodos(
  rentalId: string,
  crewId: string,
  leadId?: string | null
): Promise<{ success: boolean; created: number; error?: string }> {
  try {
    if (!rentalId) {
      return { success: false, created: 0, error: "rentalId is required" };
    }

    console.log(`[rental-closure-todos] Creating closure todos for rental ${rentalId}${leadId ? `, lead ${leadId}` : ""}`);

    // Determine user_id from leadId if it's a Telegram ID
    const todoUserId = leadId && /^\d{1,12}$/.test(leadId) ? leadId : null;

    // Idempotency check: skip if closure todos already exist for this rental
    // (avoids duplicates if confirmVehiclePickup is called twice).
    const { data: existing } = await supabaseAdmin
      .from("crew_todos")
      .select("id, description")
      .eq("crew_id", crewId)
      .eq("rental_id", rentalId)
      .eq("category", "rental_closure")
      .limit(1);
    if (existing && existing.length > 0) {
      console.log(`[rental-closure-todos] Closure todos already exist for rental ${rentalId} — skipping`);
      return { success: true, created: 0 };
    }

    const todosToInsert = CLOSURE_TODO_TEMPLATES.map((template) => ({
      id: randomUUID(),
      crew_id: crewId,
      lead_id: leadId || null,
      user_id: todoUserId,
      rental_id: rentalId,
      title: template.title,
      description: JSON.stringify({
        rental_id: rentalId,
        todo_type: template.type,
        source: "rental_closure_system",
        lead_id: leadId || null,
        user_id: todoUserId,
      }),
      category: "rental_closure",
      status: "pending",
      priority: template.priority,
      assigned_to: null,
      // goodmorning-fixes BUG 10: removed created_by: "system" — FK constraint on
      // crew_todos.created_by REFERENCES users(user_id). "system" doesn't exist in users
      // table → FK violation → 0 verification todos created. Leave unset (NULL) like
      // createLeadFollowupTodos does.
    }));

    const { error } = await supabaseAdmin.from("crew_todos").insert(todosToInsert);

    if (error) {
      console.error("[rental-closure-todos] Insert error:", error);
      return { success: false, created: 0, error: error.message };
    }

    console.log(`[rental-closure-todos] Created ${todosToInsert.length} closure todos for rental ${rentalId}`);
    return { success: true, created: todosToInsert.length };
  } catch (error) {
    console.error("[rental-closure-todos] Error:", error);
    return {
      success: false,
      created: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Помечает конкретный closure todo как выполненный.
 * Mirror of completeRentalVerificationTodo but for closure category.
 */
export async function completeRentalClosureTodo(
  todoId: string,
  actorUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!todoId) {
      return { success: false, error: "todoId is required" };
    }
    if (!actorUserId) {
      return { success: false, error: "actorUserId is required" };
    }

    // CRITICAL FIX (code review 2026-07-30): previously this function had NO
    // auth check — any user who could guess a todo UUID could mark any crew's
    // closure todos as done. Now we:
    // 1. Fetch the todo to get its crew_id
    // 2. Check the actor is a member of that crew with owner/admin/co_owner role
    // 3. Only then allow the update
    const { data: todo, error: fetchErr } = await supabaseAdmin
      .from("crew_todos")
      .select("crew_id, category")
      .eq("id", todoId)
      .eq("category", "rental_closure")
      .maybeSingle();

    if (fetchErr) {
      console.error("[rental-closure-todos] Fetch error:", fetchErr);
      return { success: false, error: fetchErr.message };
    }
    if (!todo) {
      return { success: false, error: "Todo not found or not a closure todo." };
    }

    // Auth check: actor must be a crew member with operator role
    const { data: membership } = await supabaseAdmin
      .from("crew_members")
      .select("role, membership_status")
      .eq("crew_id", todo.crew_id)
      .eq("user_id", actorUserId)
      .maybeSingle();

    const isCrewOperator = membership?.membership_status === "active"
      && ["owner", "admin", "co_owner"].includes(membership.role);

    // Also allow global admins
    let isGlobalAdmin = false;
    if (!isCrewOperator) {
      const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", actorUserId)
        .maybeSingle();
      const userMeta = userRow?.metadata as Record<string, unknown> | null;
      isGlobalAdmin = userMeta?.role === "admin" || userMeta?.status === "admin";
    }

    if (!isCrewOperator && !isGlobalAdmin) {
      return { success: false, error: "Недостаточно прав для выполнения этого действия." };
    }

    const { error } = await supabaseAdmin
      .from("crew_todos")
      .update({
        status: "done",
        completed_at: new Date().toISOString(),
      })
      .eq("id", todoId)
      .eq("category", "rental_closure");  // Safety: never update other categories

    if (error) {
      console.error("[rental-closure-todos] Complete error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[rental-closure-todos] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
