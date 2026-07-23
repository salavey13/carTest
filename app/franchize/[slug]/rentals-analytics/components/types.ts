// Analytics types — shared across all analytics v2 components.
// Mirrors the patterns from leads-constants.ts but scoped to the analytics
// operational dashboard (rentals / sales / services).

export type AnalyticsTab = "rentals" | "sales" | "services";

export type RentalStatus =
  | "pending_confirmation"
  | "confirmed"
  | "active"
  | "completed"
  | "cancelled"
  | "disputed";

export interface AnalyticsVehicle {
  make: string | null;
  model: string | null;
}

export interface AnalyticsUser {
  full_name: string | null;
  username: string | null;
}

export interface AnalyticsRentalRow {
  rental_id: string;
  user_id: string;
  owner_id: string;
  vehicle_id: string;
  status: RentalStatus;
  payment_status: string;
  total_cost: number;
  requested_start_date: string | null;
  requested_end_date: string | null;
  agreed_start_date: string | null;
  agreed_end_date: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  passport_mainpage_photo: string | null;
  passport_registration_photo: string | null;
  drivers_licence_frontal_photo: string | null;
  crew_id: string | null;
  created_by_operator_chat_id: string | null;
  vehicle?: AnalyticsVehicle | null;
  user?: AnalyticsUser | null;
}

export interface AnalyticsSaleRow {
  id: string;
  buyer_full_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  sale_price: string | null;
  total_sum: number | null;
  created_at: string;
  resolved_bike_id: string | null;
  vehicle?: AnalyticsVehicle | null;
}

export interface AnalyticsKpis {
  totalToday: number;
  revenueToday: number;
  activeCount: number;
  returnsDue: number;
}

// ── Drawer-only types (Phase 2) ──────────────────────────────────────────────

export type TodoStatus = "pending" | "in_progress" | "done" | "cancelled";
export type TodoPriority = "low" | "medium" | "high";

export interface RentalTodo {
  id: string;
  rental_id: string | null;
  title: string;
  status: TodoStatus;
  priority: TodoPriority;
  due_date: string | null;
  assigned_to: string | null;
  assigned_name?: string | null;
  created_at: string;
}

export interface RentalNote {
  id: string;
  rental_id: string | null;
  text: string;
  created_at: string;
  created_by: string | null;
}

export interface RentalHistoryEvent {
  type: string;
  timestamp: string;
  label: string;
  icon?: string;
  color?: string;
  detail?: string;
}

export interface RentalHandoff {
  handoff_at: string | null;
  handoff_by: string | null;
  odometer_before: number | null;
  odometer_after: number | null;
  equipment_checklist: Record<string, boolean> | null;
  damage_notes: string | null;
}

// ── SLA / status helper types ────────────────────────────────────────────────

export type Tone = "neutral" | "good" | "warning" | "danger";

export interface SlaSignal {
  key: string;
  label: string;
  value: string;
  tone: Tone;
  priority: number;
  detail?: string;
}

export interface DocStatus {
  count: number;
  total: number;
  complete: boolean;
  missing: string[];
}

export type DrawerAction =
  | "activate"
  | "complete"
  | "cancel"
  | "open_rental"
  | "verify_docs"
  | "request_docs"
  | "resend_qr"
  | "call"
  | "telegram"
  | "more";

// ── Drawer row: rental + drawer-only related data ────────────────────────────

export interface DrawerRentalRow extends AnalyticsRentalRow {
  todos: RentalTodo[];
  notes: RentalNote[];
  history: RentalHistoryEvent[];
  handoff: RentalHandoff | null;
}
