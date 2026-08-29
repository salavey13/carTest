"use client";

// /app/franchize/[slug]/rentals-analytics/AnalyticsClientV2.tsx
//
// v2 analytics client — the ONLY UI for the rentals analytics page
// (v1 RentalsAnalyticsClient + AnalyticsUiSwitch were removed, FIX F10).
//
// What it does:
//   1. Auth flow (dbUser from AppContext + password auth fallback).
//   2. Calls the server actions (getRentalsDashboard / getSalesDashboard / getCrewTodos)
//      and enriches items with contract-artifact data (renter identity, deposit).
//   3. Maps the server-action types (RentalDashboardItem / SaleDashboardItem / CrewTodo)
//      to the v2 component types (AnalyticsRentalRow / AnalyticsSaleRow / RentalTodo).
//   4. Builds ThemeTokens via useTheme from the analytics hooks dir.
//   5. Renders AnalyticsClient with all props wired, including CSV export (F9).

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
import { sendAnalyticsCsvToTelegram } from "@/app/franchize/server-actions/analytics-csv-send";

// Local v2 tree — ../components/* relative to this file (which sits in
// rentals-analytics/ root, next to RentalsAnalyticsClient.tsx).
import { AnalyticsClient } from "./components/AnalyticsClient";
import { fetchCsvTextWithError } from "./components/csvFetch";
import type {
  AnalyticsRentalRow,
  AnalyticsSaleRow,
  RentalTodo,
  RentalStatus,
} from "./components/types";
import type { ThemeTokens } from "./hooks/useTheme";
import { useTheme } from "./hooks/useTheme";

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
  /** Deep-link params from URL (Phase 2 of startParamRouter PRD) */
  initialTab?: string;
  initialRentalId?: string;
  initialSaleId?: string;
}

// Convert a v1 RentalDashboardItem to the v2 AnalyticsRentalRow shape.
// Injects v1 handoff fields (odometerStart/End, handoutCompleted) into the
// metadata JSONB so the v2 RentalDetailDrawer's handoff section can read
// them via the same `metadata.handoff_at / odometer_before / odometer_after`
// contract used by the v2 web tree.
// Extract the partner-owner chat id from bike specs (cars.specs.subrenter_chat_id).
// Drives the «Субарендаторам» KPI — rentals of subrented bikes split 50/50.
function subrenterChatIdFromSpecs(
  specs: Record<string, unknown> | null | undefined,
): string | null {
  const raw = specs?.["subrenter_chat_id"];
  if (typeof raw === "string" && raw.trim().length > 0) return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return null;
}

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
    // FIX (iter9): bridge the odometer HINT (recorded at order creation from
    // the bike's last known mileage) so the drawer can show "≈2465 км" in the
    // "Одометр до" tile BEFORE the operator saves the actual pickup freeze.
    // Kept in a SEPARATE key — putting it into odometer_before would flip
    // getHandoffStatus() to "handed out" (it reads metadata.odometer_before).
    odometer_before_hint:
      md.odometer_before_hint ?? md.last_known_odometer ?? null,
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
    subrenterChatId: subrenterChatIdFromSpecs(
      (item.vehicle?.specs ?? null) as Record<string, unknown> | null,
    ),
    subrenterLabel: item.subrenterLabel ?? null,
    vehicle: item.vehicle
      ? { make: item.vehicle.make, model: item.vehicle.model }
      : null,
    user: item.user
      ? { full_name: item.user.full_name, username: item.user.username }
      : null,
    contract: item.contract ?? null,
    operatorName: item.operatorName ?? null,
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
    contract_key: item.contract_key ?? null,
    buyer_full_name: item.buyer_full_name,
    // iter15: getSalesDashboard now selects buyer_phone + delivery context
    buyer_phone: item.buyer_phone ?? null,
    buyer_email: item.buyer_email,
    sale_price: item.sale_price,
    total_sum: item.sale_price ? Number(item.sale_price) || 0 : null,
    created_at: item.created_at,
    resolved_bike_id: item.vehicle?.id || null,
    vehicle: item.vehicle
      ? { make: item.vehicle.make, model: item.vehicle.model }
      : null,
    delivery_method: item.delivery_method ?? null,
    transport_company_name: item.transport_company_name ?? null,
    storage_path: item.storage_path ?? null,
  };
}

function toRentalTodo(todo: CrewTodo): RentalTodo {
  return {
    id: todo.id,
    rental_id: todo.rental_id ?? null, // linked via crew_todos.rental_id (F12)
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
  initialTab,
  initialRentalId,
  initialSaleId,
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

  // ─── Timeout helper ────────────────────────────────────────────────────────
  // Wraps a promise with a timeout. When Supabase returns 525 (SSL handshake
  // failed — transient Cloudflare issue), the server action can hang for 10+
  // seconds, triggering Vercel's Runtime Timeout. This wrapper ensures we
  // surface the error to the user within 8 seconds instead of hanging.
  const withTimeout = <T,>(promise: Promise<T>, ms = 8000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout after ${ms}ms`));
      }, ms);
      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  };

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
        const result = await withTimeout(
          getRentalsDashboard({
            slug: initialSlug.trim(),
            actorUserId,
            date,
            isPasswordAuth: !!passwordAuthOwnerId,
          }),
          8000,
        );
        if (result.success && result.data) {
          setRentals(result.data.items.map(toAnalyticsRental));
        } else if (!result.success) {
          toast.error(result.error || "Не удалось загрузить аренды");
        }
      } catch (error) {
        console.error("[AnalyticsV2] loadRentals:", error);
        // Don't spam toast on timeout — the loading state will clear and
        // the user can retry by changing the date.
        toast.error("Ошибка загрузки аренд (таймаут Supabase?)");
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
        const result = await withTimeout(
          getSalesDashboard({
            slug: initialSlug.trim(),
            actorUserId,
            date,
            isPasswordAuth: !!passwordAuthOwnerId,
          }),
          8000,
        );
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
      const result = await withTimeout(
        getCrewTodos({
          actorUserId,
          crewId: crew.id,
          isPasswordAuth: !!passwordAuthOwnerId,
        }),
        8000,
      );
      if (result.success && result.data) {
        setTodos(result.data.map(toRentalTodo));
      }
    } catch (error) {
      console.error("[AnalyticsV2] loadTodos:", error);
    }
  }, [getActorUserId, crew.id, passwordAuthOwnerId]);

  // ── FIX (F9): CSV export over the operator finance-sheet format ─────────
  // GET /api/franchize/rentals-csv-export?slug=...&from=...&to=...
  // Mirrors the v1 export flow (auth via x-telegram-user-id header) but lives
  // in the v2 tree and is reachable from the always-visible mobile button.
  //
  // FIX (F15, iter2): the iter1 implementation relied on `URL.createObjectURL`
  // + `<a download>` which works on desktop browsers but is silently blocked
  // in the Telegram WebApp iframe sandbox on iOS / Android. In TG context we
  // now fall back to opening the URL via `tg.openLink()` (which pops out to
  // the system browser where Content-Disposition triggers a native download),
  // and as a final fallback we copy the API URL to the clipboard with a toast
  // prompting the operator to open it in their browser.
  //
  // FIX (F9 iter3): the modal now also wants the CSV TEXT itself (so it can
  // render the table preview). `fetchCsvText` is the same fetch but yields
  // `resp.text()` instead of blob+anchor.
  const buildCsvApiUrl = useCallback(
    (from: string, to: string) =>
      `/api/franchize/rentals-csv-export?slug=${encodeURIComponent(initialSlug.trim())}` +
      `&from=${from}&to=${to}`,
    [initialSlug],
  );

  const fetchCsvText = useCallback(
    async (from: string, to: string): Promise<string> => {
      const actorUserId = getActorUserId();
      if (!actorUserId) throw new Error("no actor user id");
      // FIX (iter6): use the shared helper so the thrown error carries the REAL
      // API error text (JSON `{error}` body) instead of a bare "http 500".
      return fetchCsvTextWithError(buildCsvApiUrl(from, to), {
        "x-telegram-user-id": actorUserId,
      });
    },
    [buildCsvApiUrl, getActorUserId],
  );

  const exportCsv = useCallback(
    async (from: string, to: string) => {
      const actorUserId = getActorUserId();
      if (!actorUserId) {
        toast.error("Не удалось определить пользователя для экспорта");
        return;
      }
      const csvApiUrl = buildCsvApiUrl(from, to);
      const filename = `${initialSlug.trim()}-rentals-${from}-to-${to}.csv`;
      // Detect Telegram WebApp context (the SDK sets window.Telegram.WebApp).
      const tgWebApp =
        typeof window !== "undefined" &&
        (window as { Telegram?: { WebApp?: { platform?: string; openLink?: (url: string) => void } } })
          .Telegram?.WebApp;
      const isTelegram = !!tgWebApp && typeof tgWebApp.openLink === "function";

      try {
        // Always try the blob+anchor flow first (works on desktop + Android TG).
        const resp = await fetch(csvApiUrl, {
          headers: { "x-telegram-user-id": actorUserId },
        });
        if (!resp.ok) {
          toast.error("Ошибка экспорта CSV");
          return;
        }
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        if (!isTelegram) {
          toast.success("CSV скачан");
          return;
        }
        // TG WebApp: the blob click may have been silently dropped by the
        // iframe sandbox. Offer a fallback — copy the API URL to the
        // clipboard so the operator can open it in their system browser,
        // where Content-Disposition will trigger a real download.
        try {
          const absoluteUrl = `${window.location.origin}${csvApiUrl}`;
          await navigator.clipboard.writeText(absoluteUrl);
          toast.success(
            "CSV подготовлен. Если файл не сохранился — ссылка скопирована, откройте её в браузере.",
            { duration: 6000 },
          );
        } catch {
          toast.success("CSV подготовлен");
        }
      } catch (error) {
        console.error("[AnalyticsV2] exportCsv:", error);
        // Last-ditch fallback: open the URL via tg.openLink so the system
        // browser handles the download (auth via signed cookie may fail in
        // the system browser — if so, the operator will see a 401 page; the
        // clipboard fallback above is the safer path).
        if (isTelegram && tgWebApp!.openLink) {
          try {
            tgWebApp!.openLink!(`${window.location.origin}${csvApiUrl}`);
            toast.info("Открываю CSV в браузере…");
            return;
          } catch {
            // fall through to error toast
          }
        }
        toast.error("Ошибка экспорта CSV");
      }
    },
    [getActorUserId, buildCsvApiUrl, initialSlug],
  );

  // ── FIX (iter4): send the same CSV to the operator's Telegram chat ──────
  // via the bot. Uses the sendAnalyticsCsvToTelegram server-action which:
  //   • builds the CSV server-side (no client-side blob)
  //   • calls sendTelegramDocument(actorUserId, csvBuffer, filename)
  //   • returns a toast-friendly summary
  const sendCsvToTelegram = useCallback(
    async (from: string, to: string) => {
      const actorUserId = getActorUserId();
      if (!actorUserId) {
        toast.error("Не удалось определить пользователя для отправки");
        return;
      }
      try {
        const result = await sendAnalyticsCsvToTelegram({
          slug: initialSlug.trim(),
          from,
          to,
          actorUserId,
          variant: "rentals",
          format: "csv",
        });
        if (!result.success) {
          toast.error(result.error || "Не удалось отправить CSV в Telegram");
          return;
        }
        const s = result.summary;
        if (s) {
          toast.success(
            `Отправлено в Telegram: ${s.rentals ?? 0} аренд, ` +
            `${s.totalRevenue.toLocaleString("ru-RU")} ₽`,
            { duration: 5000 },
          );
        } else {
          toast.success("CSV отправлен в Telegram");
        }
      } catch (err) {
        console.error("[AnalyticsV2] sendCsvToTelegram:", err);
        toast.error("Ошибка отправки в Telegram");
      }
    },
    [getActorUserId, initialSlug],
  );

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
      initialTab={initialTab}
      initialRentalId={initialRentalId}
      initialSaleId={initialSaleId}
      onExportCsv={exportCsv}
      onFetchCsvText={fetchCsvText}
      onSendCsvToTelegram={sendCsvToTelegram}
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
