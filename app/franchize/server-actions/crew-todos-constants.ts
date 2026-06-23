/**
 * Crew Todos Constants
 * Moved from crew-todos.ts to avoid "use server" export restrictions
 */

export type TodoStatus = "pending" | "in_progress" | "done";
export type TodoPriority = "low" | "medium" | "high";

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
  created_by: string;
  updated_at: string | null;
  completed_at: string | null;
  assigned_to_user?: {
    user_id: string;
    full_name: string | null;
    username: string | null;
  };
  created_by_user?: {
    user_id: string;
    full_name: string | null;
    username: string | null;
  };
}

export interface CreateTodoInput {
  crewId: string;
  assignedTo: string | null;
  title: string;
  description?: string;
  category: string;
  priority: TodoPriority;
}

export interface UpdateTodoInput {
  id: string;
  status?: TodoStatus;
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
