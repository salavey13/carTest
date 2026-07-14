"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  type TodoStatus,
  type TodoPriority,
  type CrewTodo,
  type CreateTodoInput,
  type UpdateTodoInput,
  DEFAULT_TODO_CATEGORIES,
} from "./crew-todos-constants";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  created_by_user?: {
    user_id: string;
    full_name: string | null;
    username: string | null;
  };
}

// Helper to convert DB row to clean type
function toCrewTodo(row: CrewTodoDBRow, assigneeUser?: { full_name: string | null; username: string | null }): CrewTodo {
  return {
    id: row.id,
    crew_id: row.crew_id,
    assigned_to: row.assigned_to,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    priority: row.priority,
    due_date: row.due_date,
    created_at: row.created_at,
    created_by: row.created_by,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    assigned_to_user: assigneeUser ? { user_id: row.assigned_to || "", ...assigneeUser } : null,
    created_by_user: row.created_by_user,
  };
}

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
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: CrewTodo[]; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
      status: z.enum(["pending", "in_progress", "done", "all"]).optional(),
      assignedTo: z.string().optional(),
      category: z.string().optional(),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, crewId, status, assignedTo, category, isPasswordAuth = false } = parsed.data;

    // Password auth bypass - grant full access
    if (!isPasswordAuth) {
      // Telegram auth: verify crew membership
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (user) {
        const { data: memberCheck } = await supabaseAdmin
          .from("crew_members")
          .select("role")
          .eq("crew_id", crewId)
          .eq("user_id", actorUserId)
          .maybeSingle();

        if (!memberCheck) {
          return { success: false, error: "Нет доступа к экипажу." };
        }
      }
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

    // Get assignee users separately to avoid relationship errors
    const assigneeIds = [...new Set((data || []).map(t => t.assigned_to).filter(Boolean))] as string[];
    const assigneesMap = new Map<string, { full_name: string | null; username: string | null }>();

    if (assigneeIds.length > 0) {
      const { data: assignees } = await supabaseAdmin
        .from("users")
        .select("user_id, full_name, username")
        .in("user_id", assigneeIds);

      for (const a of assignees || []) {
        assigneesMap.set(a.user_id, { full_name: a.full_name, username: a.username });
      }
    }

    return {
      success: true,
      data: (data || []).map(row => toCrewTodo(
        row as CrewTodoDBRow,
        row.assigned_to ? assigneesMap.get(row.assigned_to) : undefined
      )),
    };
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
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; data?: Array<{ user_id: string; full_name: string | null; username: string | null }>; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, crewId, isPasswordAuth = false } = parsed.data;

    // Password auth bypass - grant full access
    if (!isPasswordAuth) {
      // Telegram auth: verify crew membership
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (user) {
        const { data: memberCheck } = await supabaseAdmin
          .from("crew_members")
          .select("role")
          .eq("crew_id", crewId)
          .eq("user_id", actorUserId)
          .maybeSingle();

        if (!memberCheck) {
          return { success: false, error: "Нет доступа к экипажу." };
        }
      }
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
  isPasswordAuth?: boolean;
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
        leadId: z.string().nullable().optional(),
      }),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, todo, isPasswordAuth = false } = parsed.data;

    // Password auth bypass - grant full access
    if (!isPasswordAuth) {
      // Telegram auth: verify crew membership
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (user) {
        const { data: memberCheck } = await supabaseAdmin
          .from("crew_members")
          .select("role")
          .eq("crew_id", todo.crewId)
          .eq("user_id", actorUserId)
          .maybeSingle();

        if (!memberCheck) {
          return { success: false, error: "Нет доступа к созданию задач." };
        }
      }
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
      lead_id: todo.leadId || null,
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
        created_by_user:users!crew_todos_created_by_fkey (
          user_id,
          full_name,
          username
        )
      `)
      .maybeSingle();

    if (error) {
      console.error("[create-crew-todo] Insert error:", error);
      return { success: false, error: error.message };
    }

    // Get assignee user if any
    let assigneeUser;
    if (newTodo.assigned_to) {
      const { data: assignee } = await supabaseAdmin
        .from("users")
        .select("full_name, username")
        .eq("user_id", newTodo.assigned_to)
        .maybeSingle();
      assigneeUser = assignee;
    }

    return {
      success: true,
      data: data ? toCrewTodo(data as CrewTodoDBRow, assigneeUser) : undefined,
    };
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
  isPasswordAuth?: boolean;
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
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, crewId, todo, isPasswordAuth = false } = parsed.data;

    // Password auth bypass - grant full access
    if (!isPasswordAuth) {
      // Telegram auth: verify crew membership
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (user) {
        const { data: memberCheck } = await supabaseAdmin
          .from("crew_members")
          .select("role")
          .eq("crew_id", crewId)
          .eq("user_id", actorUserId)
          .maybeSingle();

        if (!memberCheck) {
          return { success: false, error: "Нет доступа к обновлению задач." };
        }
      }
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
        created_by_user:users!crew_todos_created_by_fkey (
          user_id,
          full_name,
          username
        )
      `)
      .maybeSingle();

    if (error) {
      console.error("[update-crew-todo] Update error:", error);
      return { success: false, error: error.message };
    }

    // Get assignee user if any
    let assigneeUser;
    if (data?.assigned_to) {
      const { data: assignee } = await supabaseAdmin
        .from("users")
        .select("full_name, username")
        .eq("user_id", data.assigned_to)
        .maybeSingle();
      assigneeUser = assignee;
    }

    return {
      success: true,
      data: data ? toCrewTodo(data as CrewTodoDBRow, assigneeUser) : undefined,
    };
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
  isPasswordAuth?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = z.object({
      actorUserId: z.string().trim().min(1),
      todoId: z.string().trim().min(1),
      crewId: z.string().trim().min(1),
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, todoId, crewId, isPasswordAuth = false } = parsed.data;

    // Password auth bypass - grant full access
    if (!isPasswordAuth) {
      // Telegram auth: verify crew membership
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (user) {
        const { data: memberCheck } = await supabaseAdmin
          .from("crew_members")
          .select("role")
          .eq("crew_id", crewId)
          .eq("user_id", actorUserId)
          .maybeSingle();

        if (!memberCheck) {
          return { success: false, error: "Нет доступа к удалению задач." };
        }
      }
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
  isPasswordAuth?: boolean;
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
      isPasswordAuth: z.boolean().optional(),
    }).safeParse(input);

    if (!parsed.success) {
      return { success: false, error: "Некорректный запрос." };
    }

    const { actorUserId, crewId, isPasswordAuth = false } = parsed.data;

    // Password auth bypass - grant full access
    if (!isPasswordAuth) {
      // Telegram auth: verify crew membership
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("user_id")
        .eq("user_id", actorUserId)
        .maybeSingle();

      if (user) {
        const { data: memberCheck } = await supabaseAdmin
          .from("crew_members")
          .select("role")
          .eq("crew_id", crewId)
          .eq("user_id", actorUserId)
          .maybeSingle();

        if (!memberCheck) {
          return { success: false, error: "Нет доступа к экипажу." };
        }
      }
    }

    const { data, error } = await supabaseAdmin
      .from("crew_todos")
      .select("status, assigned_to, due_date")
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

    // Get all unique assignees
    const assigneeIds = [...new Set(todos.map(t => t.assigned_to).filter(Boolean))] as string[];
    const assigneesMap = new Map<string, { full_name: string | null; username: string | null }>();

    if (assigneeIds.length > 0) {
      const { data: assignees } = await supabaseAdmin
        .from("users")
        .select("user_id, full_name, username")
        .in("user_id", assigneeIds);

      for (const a of assignees || []) {
        assigneesMap.set(a.user_id, { full_name: a.full_name, username: a.username });
      }
    }

    // Group by assignee
    const byAssigneeMap = new Map<string, { userId: string; userName: string | null; pending: number; inProgress: number; done: number }>();

    for (const todo of todos) {
      const userId = todo.assigned_to || "unassigned";
      const assignee = userId !== "unassigned" ? assigneesMap.get(userId) : null;
      const userName = assignee?.full_name || assignee?.username || "Не назначен";

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

/**
 * Create lead followup todos with idempotency check.
 * Centralizes the logic used by /doc, /doc-manual, and rental verification.
 */
export async function createLeadFollowupTodos(input: {
  crewId: string;
  leadId: string;
  leadPhone?: string;
  leadName?: string;
  bikeId?: string;
  todos: Array<{ title: string; priority: "low" | "medium" | "high" }>;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; created: number; skipped: number; error?: string }> {
  try {
    const { crewId, leadId, leadPhone, leadName, bikeId, todos, assignedTo, metadata } = input;

    // Idempotency: check if todos already exist for this lead
    const { data: existingTodos } = await supabaseAdmin
      .from("crew_todos")
      .select("id, title")
      .eq("crew_id", crewId)
      .eq("lead_id", leadId)
      .eq("category", "lead_followup")
      .eq("status", "pending");

    const existingTitles = new Set((existingTodos || []).map((t: any) => t.title));
    const newTodos = todos.filter((t) => !existingTitles.has(t.title));

    if (newTodos.length === 0) {
      return { success: true, created: 0, skipped: todos.length };
    }

    const todoPromises = newTodos.map((todo) => {
      const todoId = `todo-${randomUUID()}`;
      return supabaseAdmin.from("crew_todos").insert({
        id: todoId,
        crew_id: crewId,
        lead_id: leadId,
        title: todo.title,
        status: "pending",
        priority: todo.priority,
        assigned_to: assignedTo || null,
        category: "lead_followup",
        description: JSON.stringify({
          lead_id: leadId,
          lead_phone: leadPhone || "",
          lead_name: leadName || "",
          bike_id: bikeId || null,
          ...(metadata || {}),
        }),
      }).then(({ error }: any) => {
        if (error) {
          console.warn("[createLeadFollowupTodos] Failed to create todo:", todo.title, error);
          return false;
        }
        return true;
      });
    });

    const results = await Promise.all(todoPromises);
    const created = results.filter(Boolean).length;

    return {
      success: true,
      created,
      skipped: todos.length - newTodos.length,
    };
  } catch (error) {
    console.error("[createLeadFollowupTodos] Error:", error);
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
