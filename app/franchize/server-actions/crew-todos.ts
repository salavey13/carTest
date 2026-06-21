"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";
import { randomUUID } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TodoStatus = "pending" | "in_progress" | "done";
export type TodoPriority = "low" | "medium" | "high";

// Raw database type with joined fields as arrays (Supabase response format)
interface CrewTodoDBRow {
  id: string;
  crew_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  category: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  completed_at: string | null;
  assigned_to_user?: Array<{
    user_id: string;
    full_name: string | null;
    username: string | null;
  }>;
  created_by_user?: Array<{
    user_id: string;
    full_name: string | null;
    username: string | null;
  }>;
}

// Clean type for frontend use
export interface CrewTodo {
  id: string;
  crew_id: string;
  assigned_to: string | null;
  title: string;
  description: string | null;
  category: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  completed_at: string | null;
  // Joined fields
  assigned_to_user?: {
    user_id: string;
    full_name: string | null;
    username: string | null;
  } | null;
  created_by_user?: {
    user_id: string;
    full_name: string | null;
    username: string | null;
  } | null;
}

// Helper to convert DB row to clean type
function toCrewTodo(row: CrewTodoDBRow): CrewTodo {
  return {
    ...row,
    assigned_to_user: row.assigned_to_user?.[0] || null,
    created_by_user: row.created_by_user?.[0] || null,
  };
}

export interface CreateTodoInput {
  crewId: string;
  assignedTo: string | null;
  title: string;
  description?: string;
  category?: string;
  priority?: TodoPriority;
  dueDate?: string;
}

export interface UpdateTodoInput {
  id: string;
  assignedTo?: string | null;
  title?: string;
  description?: string | null;
  category?: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  dueDate?: string | null;
}

// Default todo categories based on franchize operations
export const DEFAULT_TODO_CATEGORIES = [
  { id: "orders", label: "Заказы", icon: "shopping-cart" },
  { id: "maintenance", label: "Обслуживание", icon: "wrench" },
  { id: "documents", label: "Документы", icon: "file-text" },
  { id: "followup", label: "Связь с клиентами", icon: "phone" },
  { id: "inventory", label: "Инвентарь", icon: "package" },
  { id: "general", label: "Общее", icon: "list" },
];

// ─── Server Actions ─────────────────────────────────────────────────────────────

/**
 * Get all todos for a specific crew, optionally filtered by status or assignee.
 */
export async function getCrewTodos(input: {
  actorUserId: string;
  crewId: string;
  status?: TodoStatus | "all";
  assignedTo?: string | "all";
  category?: string | "all";
}): Promise<{ success: boolean; data?: CrewTodo[]; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
      status: z.enum(["pending", "in_progress", "done", "all"]).optional(),
      assignedTo: z.string().optional(),
      category: z.string().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, crewId, status, assignedTo, category } = parsed.data;

    // Verify user is authenticated and has access to this crew
    const { data: memberCheck } = await supabaseAdmin
      .from("crew_members")
      .select("role")
      .eq("crew_id", crewId)
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: "Нет доступа к экипажу." };
    }

    let query = supabaseAdmin
      .from("crew_todos")
      .select(`
        id,
        crew_id,
        assigned_to,
        title,
        description,
        category,
        status,
        priority,
        due_date,
        created_at,
        created_by,
        updated_at,
        completed_at,
        assigned_to_user:users!crew_todos_assigned_to_fkey (
          user_id,
          full_name,
          username
        ),
        created_by_user:users!crew_todos_created_by_fkey (
          user_id,
          full_name,
          username
        )
      `)
      .eq("crew_id", crewId)
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (assignedTo && assignedTo !== "all") {
      if (assignedTo === "unassigned") {
        query = query.is("assigned_to", null);
      } else {
        query = query.eq("assigned_to", assignedTo);
      }
    }

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist yet, return empty array
      if (error.code === "42P01") {
        return { success: true, data: [] };
      }
      console.error("[get-crew-todos] Query error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(toCrewTodo) };
  } catch (error) {
    console.error("[get-crew-todos] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get crew members for assignment dropdown.
 */
export async function getCrewMembersForTodos(input: {
  actorUserId: string;
  crewId: string;
}): Promise<{ success: boolean; data?: Array<{ user_id: string; full_name: string | null; username: string | null }>; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, crewId } = parsed.data;

    // Verify user has access to this crew
    const { data: memberCheck } = await supabaseAdmin
      .from("crew_members")
      .select("role")
      .eq("crew_id", crewId)
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: "Нет доступа к экипажу." };
    }

    const { data, error } = await supabaseAdmin
      .from("crew_members")
      .select("user_id, users!inner (full_name, username)")
      .eq("crew_id", crewId)
      .eq("membership_status", "active");

    if (error) {
      console.error("[get-crew-members-for-todos] Query error:", error);
      return { success: false, error: error.message };
    }

    const members = (data || []).map((m: any) => ({
      user_id: m.user_id,
      full_name: m.users?.full_name,
      username: m.users?.username,
    }));

    return { success: true, data: members };
  } catch (error) {
    console.error("[get-crew-members-for-todos] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a new todo for a crew.
 */
export async function createCrewTodo(input: {
  actorUserId: string;
  todo: CreateTodoInput;
}): Promise<{ success: boolean; data?: CrewTodo; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      todo: z.object({
        crewId: z.string().trim().min(1),
        assignedTo: z.string().nullable(),
        title: z.string().trim().min(1).max(200),
        description: z.string().optional(),
        category: z.string().default("general"),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        dueDate: z.string().optional(),
      }),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, todo } = parsed.data;

    // Verify user is a member of this crew
    const { data: memberCheck } = await supabaseAdmin
      .from("crew_members")
      .select("role")
      .eq("crew_id", todo.crewId)
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: "Нет доступа к созданию задач." };
    }

    // If assignedTo is provided, verify they are also a member
    if (todo.assignedTo) {
      const { data: assigneeCheck } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", todo.crewId)
        .eq("user_id", todo.assignedTo)
        .eq("membership_status", "active")
        .maybeSingle();

      if (!assigneeCheck) {
        return { success: false, error: "Назначаемый пользователь не является членом экипажа." };
      }
    }

    const newTodo = {
      id: randomUUID(),
      crew_id: todo.crewId,
      assigned_to: todo.assignedTo,
      title: todo.title,
      description: todo.description || null,
      category: todo.category,
      status: "pending" as TodoStatus,
      priority: todo.priority,
      due_date: todo.dueDate || null,
      created_by: actorUserId,
    };

    const { data, error } = await supabaseAdmin
      .from("crew_todos")
      .insert(newTodo)
      .select(`
        id,
        crew_id,
        assigned_to,
        title,
        description,
        category,
        status,
        priority,
        due_date,
        created_at,
        created_by,
        updated_at,
        completed_at,
        assigned_to_user:users!crew_todos_assigned_to_fkey (
          user_id,
          full_name,
          username
        ),
        created_by_user:users!crew_todos_created_by_fkey (
          user_id,
          full_name,
          username
        )
      `)
      .single();

    if (error) {
      console.error("[create-crew-todo] Insert error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: toCrewTodo(data as CrewTodoDBRow) };
  } catch (error) {
    console.error("[create-crew-todo] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update an existing todo.
 */
export async function updateCrewTodo(input: {
  actorUserId: string;
  todo: UpdateTodoInput;
  crewId: string;
}): Promise<{ success: boolean; data?: CrewTodo; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
      todo: z.object({
        id: z.string().trim().min(1),
        assignedTo: z.string().nullable().optional(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().nullable().optional(),
        category: z.string().optional(),
        status: z.enum(["pending", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueDate: z.string().nullable().optional(),
      }),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, crewId, todo } = parsed.data;

    // Verify user is a member of this crew
    const { data: memberCheck } = await supabaseAdmin
      .from("crew_members")
      .select("role")
      .eq("crew_id", crewId)
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: "Нет доступа к обновлению задач." };
    }

    // If assignedTo is being changed, verify the new assignee is a member
    if (todo.assignedTo !== undefined && todo.assignedTo !== null) {
      const { data: assigneeCheck } = await supabaseAdmin
        .from("crew_members")
        .select("user_id")
        .eq("crew_id", crewId)
        .eq("user_id", todo.assignedTo)
        .eq("membership_status", "active")
        .maybeSingle();

      if (!assigneeCheck) {
        return { success: false, error: "Назначаемый пользователь не является членом экипажа." };
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (todo.assignedTo !== undefined) updateData.assigned_to = todo.assignedTo;
    if (todo.title !== undefined) updateData.title = todo.title;
    if (todo.description !== undefined) updateData.description = todo.description;
    if (todo.category !== undefined) updateData.category = todo.category;
    if (todo.status !== undefined) updateData.status = todo.status;
    if (todo.priority !== undefined) updateData.priority = todo.priority;
    if (todo.dueDate !== undefined) updateData.due_date = todo.dueDate;

    const { data, error } = await supabaseAdmin
      .from("crew_todos")
      .update(updateData)
      .eq("id", todo.id)
      .eq("crew_id", crewId)
      .select(`
        id,
        crew_id,
        assigned_to,
        title,
        description,
        category,
        status,
        priority,
        due_date,
        created_at,
        created_by,
        updated_at,
        completed_at,
        assigned_to_user:users!crew_todos_assigned_to_fkey (
          user_id,
          full_name,
          username
        ),
        created_by_user:users!crew_todos_created_by_fkey (
          user_id,
          full_name,
          username
        )
      `)
      .single();

    if (error) {
      console.error("[update-crew-todo] Update error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: toCrewTodo(data as CrewTodoDBRow) };
  } catch (error) {
    console.error("[update-crew-todo] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Delete a todo.
 */
export async function deleteCrewTodo(input: {
  actorUserId: string;
  todoId: string;
  crewId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      todoId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, todoId, crewId } = parsed.data;

    // Verify user is a member of this crew
    const { data: memberCheck } = await supabaseAdmin
      .from("crew_members")
      .select("role")
      .eq("crew_id", crewId)
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: "Нет доступа к удалению задач." };
    }

    const { error } = await supabaseAdmin
      .from("crew_todos")
      .delete()
      .eq("id", todoId)
      .eq("crew_id", crewId);

    if (error) {
      console.error("[delete-crew-todo] Delete error:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("[delete-crew-todo] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get todo statistics for a crew.
 */
export async function getCrewTodoStats(input: {
  actorUserId: string;
  crewId: string;
}): Promise<{
  success: boolean;
  data?: {
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    byAssignee: Array<{ userId: string; userName: string | null; pending: number; inProgress: number; done: number }>;
    overdue: number;
  };
  error?: string;
}> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, crewId } = parsed.data;

    // Verify user has access to this crew
    const { data: memberCheck } = await supabaseAdmin
      .from("crew_members")
      .select("role")
      .eq("crew_id", crewId)
      .eq("user_id", actorUserId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: "Нет доступа к экипажу." };
    }

    const { data, error } = await supabaseAdmin
      .from("crew_todos")
      .select("status, assigned_to, due_date, assigned_to_user (user_id, full_name, username)")
      .eq("crew_id", crewId);

    if (error) {
      console.error("[get-crew-todo-stats] Query error:", error);
      return { success: false, error: error.message };
    }

    const todos = data || [];
    const now = new Date();

    // Count by status
    const total = todos.length;
    const pending = todos.filter(t => t.status === "pending").length;
    const inProgress = todos.filter(t => t.status === "in_progress").length;
    const done = todos.filter(t => t.status === "done").length;

    // Count overdue
    const overdue = todos.filter(t => {
      if (t.status === "done" || !t.due_date) return false;
      return new Date(t.due_date) < now;
    }).length;

    // Group by assignee
    const byAssigneeMap = new Map<string, { userId: string; userName: string | null; pending: number; inProgress: number; done: number }>();

    for (const todo of todos) {
      const userId = todo.assigned_to || "unassigned";
      // assigned_to_user is an array in Supabase joins
      const userArray = todo.assigned_to_user as Array<{ user_id: string; full_name: string | null; username: string | null }> | null;
      const userName = userArray?.[0]?.full_name || userArray?.[0]?.username || "Не назначен";

      if (!byAssigneeMap.has(userId)) {
        byAssigneeMap.set(userId, {
          userId,
          userName,
          pending: 0,
          inProgress: 0,
          done: 0,
        });
      }

      const stats = byAssigneeMap.get(userId)!;
      if (todo.status === "pending") stats.pending++;
      else if (todo.status === "in_progress") stats.inProgress++;
      else if (todo.status === "done") stats.done++;
    }

    const byAssignee = Array.from(byAssigneeMap.values()).sort((a, b) =>
      b.pending + b.inProgress - a.pending - a.inProgress
    );

    return {
      success: true,
      data: {
        total,
        pending,
        inProgress,
        done,
        byAssignee,
        overdue,
      },
    };
  } catch (error) {
    console.error("[get-crew-todo-stats] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
