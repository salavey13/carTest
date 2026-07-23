export interface AnalyticsRentalRow {
  rental_id: string;
  user_id: string;
  owner_id: string;
  vehicle_id: string;
  status: "pending_confirmation" | "confirmed" | "active" | "completed" | "cancelled" | "disputed";
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
  vehicle?: { make: string; model: string } | null;
  user?: { full_name: string | null; username: string | null } | null;
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
  vehicle?: { make: string; model: string } | null;
}

export interface AnalyticsKpis {
  totalToday: number;
  revenueToday: number;
  activeCount: number;
  returnsDue: number;
}

export type AnalyticsTab = "rentals" | "sales" | "services";
