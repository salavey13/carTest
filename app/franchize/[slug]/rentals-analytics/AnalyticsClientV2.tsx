"use client";

// /app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx
//
// Wrapper that bridges the existing v1 auth + theme + data-fetching flow
// into the v2 AnalyticsClient component tree.
//
// What it does:
//   1. Mirrors the v1 auth flow (dbUser from AppContext + password auth fallback).
//   2. Calls the same server actions as v1 (getRentalsDashboard / getSalesDashboard / getCrewTodos).
//   3. Maps the v1 server-action types (RentalDashboardItem / SaleDashboardItem / CrewTodo)
//      to the v2 component types (AnalyticsRentalRow / AnalyticsSaleRow / RentalTodo).
//   4. Builds ThemeTokens via useTheme from the analytics hooks dir.
//   5. Renders AnalyticsClient with all props wired.
//
// Coexists with RentalsAnalyticsClient.tsx behind ?ui=v2 in page.tsx.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAppContext } from "@/contexts/AppContext";
import {
  getRentalsDashboard,
  getSalesDashboard,
  type RentalDashboardItem,
  type SaleDashboardItem,
} from "@/app/franchize/server-actions/rentals-dashboard";
import {
  getCrewTodos,
  type CrewTodo,
} from "@/app/franchize/server-actions/crew-todos";
import { AnalyticsPasswordEntry } from "@/app/franchize/components/AnalyticsPasswordEntry";
import { AnalyticsLoading } from "@/app/franchize/components/AnalyticsLoading";

// Local v2 tree — ../components/* relative to this file (which sits in
// rentals-analytics/ root, next to RentalsAnalyticsClient.tsx).
import { AnalyticsClient } from "./components/AnalyticsClient";
import type {
  AnalyticsRentalRow,
  AnalyticsSaleRow,
  RentalTodo,
  RentalStatus,
} from "./components/types";
import type { ThemeTokens } from "./components/../hooks/useTheme";
import { useTheme } from "./components/../hooks/useTheme";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface CrewThemeLike {
  isAuto?: boolean;
  mode?: "auto" | "light" | "dark";
  palette?: { accentMain?: string; textPrimary?: string; bgBase?: string };
  palettes?: {
    light?: { accentMain?: string; textPrimary?: string; bgBase?: string };
    dark?: { accentMain?: string; textPrimary?: string; bgBase?: string };
  };
}

interface CrewLike {
  id: string;
  name: string;
  theme: CrewThemeLike;
}

interface AnalyticsClientV2Props {
  initialSlug: string;
  initialDate: string;
  crew: CrewLike;
}

// Convert a v1 RentalDashboardItem to the v2 AnalyticsRentalRow shape.
// Injects v1 handoff fields (odometerStart/End, handoutCompleted) into the
// metadata JSONB so the v2 RentalDetailDrawer's handoff section can read
// them via the same `metadata.handoff_at / odometer_before / odometer_after`
// contract used by the v2 web tree.
function toAnalyticsRental(item: RentalDashboardItem): AnalyticsRentalRow {
  const md = (item.metadata || {}) as Record<string, unknown>;
  // Bridge v1 handoff fields into the v2 metadata shape. The v2 drawer
  // reads `metadata.handoff_at` to decide whether to render "Передан" vs
  // "Ожидает", and `metadata.odometer_before/after` for the odometer tiles.
  // The v1 server action already fetches these from `rental_handoffs` and
  // exposes them as top-level fields on RentalDashboardItem.
  const enrichedMd: Record<string, unknown> = {
    ...md,
    handoff_at:
      md.handoff_at ??
      (item.handoutCompleted ? item.agreed_start_date ?? item.created_at : null),
    handoff_by: md.handoff_by ?? null,
    odometer_before: md.odometer_before ?? item.odometerStart ?? null,
    odometer_after: md.odometer_after ?? item.odometerEnd ?? null,
    equipment_checklist: md.equipment_checklist ?? null,
    damage_notes: md.damage_notes ?? null,
  };
  return {
    rental_id: item.rental_id,
    user_id: item.user_id,
    owner_id: item.user_id, // v1 doesn't separate owner_id; use user_id
    vehicle_id: item.vehicle_id,
    status: normalizeRentalStatus(item.status),
    payment_status: item.payment_status || "",
    total_cost: Number(item.total_cost) || 0,
    requested_start_date: item.requested_start_date,
    requested_end_date: item.requested_end_date,
    agreed_start_date: item.agreed_start_date,
    agreed_end_date: item.agreed_end_date,
    created_at: item.created_at,
    metadata: enrichedMd,
    passport_mainpage_photo:
      (md.passport_mainpage_photo as string | null) || null,
    passport_registration_photo:
      (md.passport_registration_photo as string | null) || null,
    drivers_licence_frontal_photo:
      (md.drivers_licence_frontal_photo as string | null) || null,
    crew_id: item.vehicle?.crew_id || null,
    created_by_operator_chat_id: item.created_by_operator_chat_id,
    vehicle: item.vehicle
      ? { make: item.vehicle.make, model: item.vehicle.model }
      : null,
    user: item.user
      ? { full_name: item.user.full_name, username: item.user.username }
      : null,
  };
}

// Guard against unknown status strings (CHECK constraint may evolve).
const VALID_RENTAL_STATUSES: RentalStatus[] = [
  "pending_confirmation",
  "confirmed",
  "active",
  "completed",
  "cancelled",
  "disputed",
];
function normalizeRentalStatus(s: string): RentalStatus {
  return VALID_RENTAL_STATUSES.includes(s as RentalStatus)
    ? (s as RentalStatus)
    : "pending_confirmation";
}

function toAnalyticsSale(item: SaleDashboardItem): AnalyticsSaleRow {
  return {
    id: item.id,
    buyer_full_name: item.buyer_full_name,
    buyer_phone: null, // v1 SaleDashboardItem doesn't expose phone; v2 reads it from metadata if needed
    buyer_email: item.buyer_email,
    sale_price: item.sale_price,
    total_sum: item.sale_price ? Number(item.sale_price) || 0 : null,
    created_at: item.created_at,
    resolved_bike_id: item.vehicle?.id || null,
    vehicle: item.vehicle
      ? { make: item.vehicle.make, model: item.vehicle.model }
      : null,
  };
}

function toRentalTodo(todo: CrewTodo): RentalTodo {
  return {
    id: todo.id,
    rental_id: null, // CrewTodo doesn't carry rental_id in v1; we filter by category instead
    title: todo.title,
    status: todo.status === "in_progress" ? "in_progress" : todo.status === "done" ? "done" : "pending",
    priority: todo.priority,
    due_date: todo.due_date,
    assigned_to: todo.assigned_to,
    assigned_name: todo.assigned_to_user?.full_name || todo.assigned_to_user?.username || null,
    created_at: todo.created_at,
  };
}

// Resolve ThemeTokens from a crew theme object.
function resolveThemeTokens(theme: CrewThemeLike): Parameters<typeof useTheme>[0] {
  const isAuto = theme.isAuto ?? true;
  // For non-auto themes, resolve "auto" mode against prefers-color-scheme
  // (client-side only; on the server we default to dark which matches the
  // Telegram WebApp dark theme — the most common case for this app).
  let resolvedMode: "light" | "dark" = "dark";
  if (theme.mode && theme.mode !== "auto") {
    resolvedMode = theme.mode;
  } else if (typeof window !== "undefined" && window.matchMedia) {
    resolvedMode = window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  const isLightTheme = resolvedMode === "light";
  // Pick palette by resolved mode. Fall back to `theme.palette` (legacy
  // single-palette shape) before {} (which useTheme will fall back to
  // sensible defaults for the chosen isLightTheme).
  const palette = isLightTheme
    ? theme.palettes?.light || theme.palette || {}
    : theme.palettes?.dark || theme.palette || {};
  const accent = palette.accentMain || "#22c55e";
  const text = palette.textPrimary || "#ffffff";
  const bg = palette.bgBase || "#0a0a0a";
  return {
    isAuto,
    isLightTheme,
    textColor: text,
    bgColor: bg,
    accentColor: accent,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AnalyticsClientV2({
  initialSlug,
  initialDate,
  crew,
}: AnalyticsClientV2Props) {
  const { dbUser, isLoading: authLoading } = useAppContext();

  // Auth state
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);
  const shouldShowPassword = !authLoading && !dbUser && !passwordAuthOwnerId;

  // Data state
  const [rentals, setRentals] = useState<AnalyticsRentalRow[]>([]);
  const [sales, setSales] = useState<AnalyticsSaleRow[]>([]);
  const [todos, setTodos] = useState<RentalTodo[]>([]);
  const [loading, setLoading] = useState(true);

  // Controlled date state — lifted here so we can refetch on date change.
  // The v2 AnalyticsClient receives `date` + `onDateChange` props and emits
  // changes when the user taps ← / → / Сегодня in AnalyticsDateNav.
  const [date, setDate] = useState(initialDate);

  const themeArgs = useMemo(() => resolveThemeTokens(crew.theme), [crew.theme]);
  const T: ThemeTokens = useTheme(themeArgs);

  const getActorUserId = useCallback((): string | null => {
    return dbUser?.user_id || passwordAuthOwnerId;
  }, [dbUser?.user_id, passwordAuthOwnerId]);

  // ─── Data loaders ──────────────────────────────────────────────────────────

  const loadRentals = useCallback(
    async (date: string) => {
      const actorUserId = getActorUserId();
      if (!actorUserId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await getRentalsDashboard({
          slug: initialSlug.trim(),
          actorUserId,
          date,
          isPasswordAuth: !!passwordAuthOwnerId,
        });
        if (result.success && result.data) {
          setRentals(result.data.items.map(toAnalyticsRental));
        } else if (!result.success) {
          toast.error(result.error || "Не удалось загрузить аренды");
        }
      } catch (error) {
        console.error("[AnalyticsV2] loadRentals:", error);
        toast.error("Ошибка загрузки аренд");
      } finally {
        setLoading(false);
      }
    },
    [getActorUserId, initialSlug, passwordAuthOwnerId],
  );

  const loadSales = useCallback(
    async (date: string) => {
      const actorUserId = getActorUserId();
      if (!actorUserId) return;
      try {
        const result = await getSalesDashboard({
          slug: initialSlug.trim(),
          actorUserId,
          date,
          isPasswordAuth: !!passwordAuthOwnerId,
        });
        if (result.success && result.data) {
          setSales(result.data.items.map(toAnalyticsSale));
        }
      } catch (error) {
        console.error("[AnalyticsV2] loadSales:", error);
      }
    },
    [getActorUserId, initialSlug, passwordAuthOwnerId],
  );

  const loadTodos = useCallback(async () => {
    const actorUserId = getActorUserId();
    if (!actorUserId || !crew.id) return;
    try {
      const result = await getCrewTodos({
        actorUserId,
        crewId: crew.id,
        isPasswordAuth: !!passwordAuthOwnerId,
      });
      if (result.success && result.data) {
        setTodos(result.data.map(toRentalTodo));
      }
    } catch (error) {
      console.error("[AnalyticsV2] loadTodos:", error);
    }
  }, [getActorUserId, crew.id, passwordAuthOwnerId]);

  // Initial load + refetch on date change. v1 has the same pattern
  // (lines 807-827): useEffect on [selectedDate] triggers loadRentals +
  // loadSales. We mirror that here.
  useEffect(() => {
    if (!getActorUserId()) return;
    void loadRentals(date);
    void loadSales(date);
    // Todos are not date-scoped — only load once on mount.
    if (todos.length === 0) {
      void loadTodos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getActorUserId, date, loadRentals, loadSales]);

  // ─── Loading / password gate ───────────────────────────────────────────────

  const accentMain = T.accent;
  const bgBase = T.bg;

  if (authLoading) {
    return <AnalyticsLoading accentMain={accentMain} bgBase={bgBase} />;
  }

  if (shouldShowPassword) {
    return (
      <AnalyticsPasswordEntry
        crewName={crew.name}
        slug={initialSlug.trim()}
        onAuthenticated={(ownerId) => setPasswordAuthOwnerId(ownerId)}
      />
    );
  }

  // ─── Render v2 tree ────────────────────────────────────────────────────────

  return (
    <AnalyticsClient
      initialSlug={initialSlug}
      initialDate={initialDate}
      crew={crew}
      T={T}
      rentals={rentals}
      sales={sales}
      todos={todos}
      loading={loading}
      mechanicMap={buildMechanicMap(rentals, todos)}
      date={date}
      onDateChange={setDate}
    />
  );
}

// Build a rentalId → mechanicName map for the services tab.
// v1 CrewTodo doesn't carry rental_id, so we fall back to assigning the
// most recent todo's assignee name as the "mechanic" for service rentals
// where the assignee matches the rental's operator chat id.
function buildMechanicMap(
  rentals: AnalyticsRentalRow[],
  todos: RentalTodo[],
): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const rental of rentals) {
    // Find any todo assigned to this rental's operator (best-effort match).
    const match = todos.find(
      (t) => t.assigned_to === rental.created_by_operator_chat_id,
    );
    map[rental.rental_id] = match?.assigned_name ?? null;
  }
  return map;
}
