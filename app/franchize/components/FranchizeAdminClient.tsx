"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/Loading";
import { useAppContext } from "@/contexts/AppContext";
import { useTheme } from "next-themes";
import { getEditableVehiclesForUser } from "@/app/rentals/actions";
import { getCrewVehicles } from "@/app/franchize/server-actions/get-crew-vehicles";
import {
  getFranchizeOrderNotificationFailures,
  getFranchizeRentalReviewsForModeration,
  getFranchizeSuccessfulRentals,
  moderateRentalReview,
  retryFranchizeOrderNotification,
  type FranchizeCrewVM,
  type FranchizeSuccessfulRentalVM,
  type RentalReviewVM,
} from "@/app/franchize/actions";
import {
  focusRingOutlineStyle,
  readablePaletteTextOnColor,
  withAlpha,
} from "@/app/franchize/lib/theme";
import { fallbackCrew } from "@/app/franchize/lib/fallback-crew";
import { CarSubmissionForm } from "@/components/CarSubmissionForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/types/database.types";
import {
  FranchizeOperatorLinkButton,
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
} from "./FranchizeOperatorSurface";

type Vehicle = Database["public"]["Tables"]["cars"]["Row"];

const normalizeVin = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const VIN_ALLOWED = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

const formatRentalDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(date);
};

const formatRentalRange = (startDate: string | null, endDate: string | null) => {
  const start = formatRentalDate(startDate);
  const end = formatRentalDate(endDate);
  if (start === "—" && end === "—") return "—";
  if (end === "—") return `с ${start}`;
  if (start === "—") return `до ${end}`;
  return `${start} — ${end}`;
};

const contractStatusLabel = (status: string) => {
  switch (status) {
    case "verified":
      return "проверен";
    case "pending":
      return "ожидает";
    case "revoked":
      return "аннулирован";
    case "none":
      return "нет данных";
    default:
      return status;
  }
};

const rentalStatusLabel = (status: string) => {
  switch (status) {
    case "confirmed":
      return "подтверждена";
    case "active":
      return "активна";
    case "completed":
      return "завершена";
    default:
      return status || "—";
  }
};

const readVehicleSpecs = (vehicle: Vehicle): Record<string, unknown> =>
  vehicle.specs && typeof vehicle.specs === "object" && !Array.isArray(vehicle.specs)
    ? (vehicle.specs as Record<string, unknown>)
    : {};

interface FranchizeAdminClientProps {
  initialSlug: string;
  editId?: string;
  initialCrew?: FranchizeCrewVM;
}

export function FranchizeAdminClient({
  initialSlug,
  editId,
  initialCrew,
}: FranchizeAdminClientProps) {
  const { dbUser, isLoading, userCrewMemberships } = useAppContext();
  const crew = initialCrew || fallbackCrew;
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterType, setFilterType] = useState<"all" | "bike" | "car">("all");
  const [loadingFleet, setLoadingFleet] = useState(false);
  // U1: track last refresh time for "обновлено Xс назад" display
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  // U2: track whether fleet load has completed (for empty state)
  const [fleetLoaded, setFleetLoaded] = useState(false);
  // M4: debounced fleet search
  const [fleetSearch, setFleetSearch] = useState("");
  const [debouncedFleetSearch, setDebouncedFleetSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFleetSearch(fleetSearch), 300);
    return () => clearTimeout(t);
  }, [fleetSearch]);
  const [failedNotifications, setFailedNotifications] = useState<
    Array<{
      orderId: string;
      sendTo: string;
      lastError: string;
      createdAt: string;
    }>
  >([]);
  const [reviews, setReviews] = useState<RentalReviewVM[]>([]);
  const [successfulRentals, setSuccessfulRentals] = useState<FranchizeSuccessfulRentalVM[]>([]);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const [moderatingReviewId, setModeratingReviewId] = useState<string | null>(
    null,
  );

  const slug = initialSlug?.trim() || "vip-bike";

  // Is current user a crew admin (can edit fleet)?
  const isCrewFleetAdmin = useMemo(() => {
    if (!crew?.slug) return false;
    return userCrewMemberships.some(
      (m) => m.slug === crew.slug && ["owner", "admin", "co_owner"].includes(m.role)
    );
  }, [userCrewMemberships, crew?.slug]);

  const loadFleet = useCallback(async () => {
    if (!dbUser?.user_id || !crew?.slug) return;
    setLoadingFleet(true);

    // Crew admins see ALL vehicles belonging to the crew
    // Others fall back to personal editable vehicles
    const res = isCrewFleetAdmin
      ? await getCrewVehicles(crew.slug)
      : await getEditableVehiclesForUser(dbUser.user_id);

    setLoadingFleet(false);

    if (!res.success) {
      toast.error(res.error || "Не удалось загрузить технику");
      return;
    }

    const scoped = (res.data || []).filter(
      (item) => item.type === "bike" || item.type === "car" || item.type === "equipment" || item.type === "service",
    );

    setFleet(scoped);
    setFleetLoaded(true); // U2: fleet load complete, can show empty state if 0

    if (editId) {
      const found = scoped.find((item) => item.id === editId) || null;
      setSelectedVehicle(found);
      if (!found) {
        toast.info(
          "Карточка из edit-параметра не найдена в текущем crew scope.",
        );
      }
    }
  }, [crew?.id, crew?.slug, dbUser?.user_id, editId, isCrewFleetAdmin]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const loadFailedNotifications = useCallback(async () => {
    if (!dbUser?.user_id) return;
    const result = await getFranchizeOrderNotificationFailures({
      slug,
      actorUserId: dbUser.user_id,
    });
    if (!result.success) {
      // M4 fix: surface silent loader failures with toast + retry
      toast.error("Не удалось загрузить уведомления", {
        action: { label: "Попробовать снова", onClick: () => loadFailedNotifications() },
      });
      return;
    }
    setFailedNotifications(result.items || []);
  }, [dbUser?.user_id, slug]);

  const handleRetryNotification = useCallback(
    async (orderId: string) => {
      if (!dbUser?.user_id) return;
      setRetryingOrderId(orderId);
      const result = await retryFranchizeOrderNotification({
        slug,
        orderId,
        actorUserId: dbUser.user_id,
      });
      setRetryingOrderId(null);
      if (!result.success) {
        toast.error(result.error || "Retry не выполнен");
        return;
      }
      toast.success(`Retry отправлен для заказа #${orderId}`);
      void loadFailedNotifications();
    },
    [dbUser?.user_id, loadFailedNotifications, slug],
  );
  const loadSuccessfulRentals = useCallback(async () => {
    if (!dbUser?.user_id) return;
    const result = await getFranchizeSuccessfulRentals({
      slug,
      actorUserId: dbUser.user_id,
    });
    if (!result.success) {
      // M4 fix: surface silent loader failures with toast + retry
      toast.error("Не удалось загрузить завершённые аренды", {
        action: { label: "Попробовать снова", onClick: () => loadSuccessfulRentals() },
      });
      return;
    }
    setSuccessfulRentals(result.items || []);
    setLastRefreshedAt(Date.now()); // U1: track refresh time
  }, [dbUser?.user_id, slug]);

  const loadReviews = useCallback(async () => {
    if (!dbUser?.user_id) return;
    const result = await getFranchizeRentalReviewsForModeration({
      slug,
      actorUserId: dbUser.user_id,
    });
    if (!result.success) {
      // M4 fix: surface silent loader failures with toast + retry
      toast.error("Не удалось загрузить отзывы", {
        action: { label: "Попробовать снова", onClick: () => loadReviews() },
      });
      return;
    }
    setReviews(result.items || []);
  }, [dbUser?.user_id, slug]);

  const handleModerateReview = useCallback(
    async (reviewId: string, hidden: boolean) => {
      if (!dbUser?.user_id) return;
      setModeratingReviewId(reviewId);
      const result = await moderateRentalReview({
        slug,
        actorUserId: dbUser.user_id,
        reviewId,
        hidden,
      });
      setModeratingReviewId(null);
      if (!result.success) {
        toast.error(result.error || "Не удалось обновить отзыв");
        return;
      }
      toast.success(hidden ? "Отзыв скрыт" : "Отзыв возвращён");
      void loadReviews();
    },
    [dbUser?.user_id, loadReviews, slug],
  );

  useEffect(() => {
    void loadFailedNotifications();
  }, [loadFailedNotifications]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  useEffect(() => {
    void loadSuccessfulRentals();
    const intervalId = window.setInterval(() => {
      void loadSuccessfulRentals();
    }, 60_000);
    // U1: tick every 15s so "обновлено Xс назад" stays fresh
    const tickId = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => {
      window.clearInterval(intervalId);
      window.clearInterval(tickId);
    };
  }, [loadSuccessfulRentals]);

  const visible = useMemo(
    () =>
      fleet.filter((item) => {
        if (filterType !== "all" && item.type !== filterType) return false;
        // M4: debounced fleet search — match on make/model/vin/id
        if (debouncedFleetSearch.trim()) {
          const q = debouncedFleetSearch.toLowerCase();
          const make = (item.make || "").toLowerCase();
          const model = (item.model || "").toLowerCase();
          const id = (item.id || "").toLowerCase();
          const specs = item.specs as Record<string, unknown> | null;
          const vin = String(specs?.vin || "").toLowerCase();
          return make.includes(q) || model.includes(q) || id.includes(q) || vin.includes(q);
        }
        return true;
      }),
    [fleet, filterType, debouncedFleetSearch],
  );

  const vinAudit = useMemo(() => {
    const target = fleet.filter(
      (item) => item.type === "bike" || item.type === "car",
    );
    const missing = target.filter((item) => !normalizeVin(readVehicleSpecs(item).vin));
    return {
      total: target.length,
      withVin: target.length - missing.length,
      missing,
    };
  }, [fleet]);

  // VIN quick-edit: clicking a bike in the missing-VIN list selects it for editing
  // in the CarSubmissionForm below. No bogus VIN generation — the operator must
  // enter the real VIN manually.
  //
  // FIX v2: User requested the scroll be brought back but more precise.
  // Original bug: `block: "center"` forced a full scroll that put the form
  // in the middle of the viewport — but the form was FAR down the page, so
  // the user had to scroll back UP past the entire fleet table to find context.
  // v1 fix removed the scroll entirely, but user missed the scroll.
  //
  // v2 strategy: use `block: "nearest"` so it only scrolls if the form is
  // NOT already visible. Combined with a brief highlight ring so the eye is
  // drawn to the right place after scroll settles.
  const handleQuickEditMissingVin = useCallback((vehicleId: string) => {
    const vehicle = fleet.find((v) => v.id === vehicleId) ?? null;
    setSelectedVehicle(vehicle);
    setTimeout(() => {
      const formEl = document.getElementById("vehicle-edit-form");
      if (formEl) {
        formEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        // Briefly highlight the form so the user notices it after scroll settles
        setTimeout(() => {
          formEl.classList.add("ring-2", "ring-amber-400/60", "ring-offset-2", "ring-offset-transparent");
          setTimeout(() => {
            formEl.classList.remove("ring-2", "ring-amber-400/60", "ring-offset-2", "ring-offset-transparent");
          }, 1500);
        }, 250);
      }
    }, 50);
  }, [fleet]);

  const { theme: globalTheme } = useTheme();
  const isLightMode = globalTheme === "light";
  // Resolve palette: use light palette when global theme is light AND crew has a light palette
  const resolvedPalette = (isLightMode && crew.theme.palettes?.light)
    ? crew.theme.palettes.light
    : crew.theme.palette;

  const buttonFocus = focusRingOutlineStyle(crew.theme);
  const accentOn = readablePaletteTextOnColor(
    resolvedPalette.accentMain,
    resolvedPalette,
  );

  if (isLoading) return <Loading text="Загружаем гараж экипажа..." />;

  // U6: "Login required" state when dbUser is null (not authed via TG WebApp)
  if (!dbUser?.user_id) {
    return (
      <div className="rounded-2xl border-2 border-dashed p-8 text-center"
        style={{ borderColor: "var(--fr-admin-border, #333)" }}>
        <p className="text-2xl mb-2">🔐</p>
        <p className="text-sm font-semibold" style={{ color: "var(--fr-admin-text, #fff)" }}>
          Нужна авторизация
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--fr-admin-muted, #999)" }}>
          Откройте эту страницу через Telegram WebApp — панель управления доступна только авторизованным участникам экипажа.
        </p>
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      style={{
        ["--fr-admin-accent" as string]: resolvedPalette.accentMain,
        ["--fr-admin-accent-hover" as string]:
          resolvedPalette.accentMainHover || resolvedPalette.accentMain,
        ["--fr-admin-border" as string]: resolvedPalette.borderSoft,
        ["--fr-admin-text" as string]: resolvedPalette.textPrimary,
        ["--fr-admin-muted" as string]: resolvedPalette.textSecondary,
        // B1 fix: was missing → fleet search input had transparent background
        ["--fr-admin-bg" as string]: resolvedPalette.bgBase,
      }}
    >
      <p className="text-xs font-medium tracking-wide text-[var(--fr-admin-accent)]">
        Панель владельца экипажа
      </p>
      <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--fr-admin-text)]">
        {crew.header.brandName || crew.name || slug}: админка гаража
      </h1>
      <p className="mt-2 max-w-3xl break-words text-sm leading-relaxed text-[var(--fr-admin-muted)]">
        Переключатель экипажа:{" "}
        <span className="font-semibold text-[var(--fr-admin-accent)]">
          {slug}
        </span>
        . Редактируй карточки техники, добавляй VIN и проверяй документы заявки
        в той же визуальной системе, что каталог и аренды.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { id: "all", label: `Все (${fleet.length})` },
          {
            id: "bike",
            label: `Байки (${fleet.filter((v) => v.type === "bike").length})`,
          },
          {
            id: "car",
            label: `Авто (${fleet.filter((v) => v.type === "car").length})`,
          },
          {
            id: "equipment",
            label: `Экипировка (${fleet.filter((v) => v.type === "equipment").length})`,
          },
          {
            id: "service",
            label: `Услуги (${fleet.filter((v) => v.type === "service").length})`,
          },
        ].map((filter) => {
          const active = filterType === filter.id;
          return (
            <Button
              key={filter.id}
              type="button"
              onClick={() => setFilterType(filter.id as "all" | "bike" | "car")}
              className="h-10 border text-sm font-semibold"
              style={{
                borderColor: "var(--fr-admin-border)",
                color: active ? accentOn : "var(--fr-admin-text)",
                backgroundColor: active
                  ? "var(--fr-admin-accent)"
                  : "transparent",
                ...buttonFocus,
              }}
            >
              {filter.label}
            </Button>
          );
        })}
      </div>

      {/* M4: debounced fleet search */}
      <div className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={fleetSearch}
          onChange={(e) => setFleetSearch(e.target.value)}
          placeholder="Поиск по технике: марка, модель, VIN, ID..."
          className="h-9 flex-1 rounded-lg border px-3 text-sm outline-none"
          style={{
            borderColor: "var(--fr-admin-border)",
            backgroundColor: "var(--fr-admin-bg)",
            color: "var(--fr-admin-text)",
          }}
        />
        {fleetSearch && (
          <button
            type="button"
            onClick={() => setFleetSearch("")}
            className="text-xs opacity-50 hover:opacity-100"
            style={{ color: "var(--fr-admin-text)" }}
          >
            Очистить
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <FranchizeOperatorStatCard label="Всего в зоне" value={fleet.length} />
        <FranchizeOperatorStatCard
          label="Байки"
          value={fleet.filter((v) => v.type === "bike").length}
        />
        <FranchizeOperatorStatCard
          label="Авто"
          value={fleet.filter((v) => v.type === "car").length}
        />
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <FranchizeOperatorStatCard
          label="Экипировка"
          value={fleet.filter((v) => v.type === "equipment").length}
        />
        <FranchizeOperatorStatCard
          label="Услуги"
          value={fleet.filter((v) => v.type === "service").length}
        />
      </div>

      {/* U1: "Last refreshed" + manual refresh button */}
      {lastRefreshedAt && (
        <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "var(--fr-admin-muted)" }}>
          <span>
            {(() => {
              const secs = Math.floor((nowTick - lastRefreshedAt) / 1000);
              if (secs < 60) return `Обновлено ${secs}с назад`;
              const mins = Math.floor(secs / 60);
              return `Обновлено ${mins}м назад`;
            })()}
          </span>
          <button
            type="button"
            onClick={() => { void loadSuccessfulRentals(); void loadFleet(); }}
            className="underline-offset-2 hover:underline"
            style={{ color: "var(--fr-admin-accent)" }}
          >
            Обновить сейчас
          </button>
        </div>
      )}

      {/* U2: Empty state when fleet is loaded but empty */}
      {fleetLoaded && fleet.length === 0 && !loadingFleet && (
        <div className="mt-4 rounded-2xl border-2 border-dashed p-8 text-center"
          style={{ borderColor: "var(--fr-admin-border)" }}>
          <p className="text-2xl mb-2">🏍️</p>
          <p className="text-sm font-semibold" style={{ color: "var(--fr-admin-text)" }}>
            В каталоге пока нет техники
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--fr-admin-muted)" }}>
            Добавьте первый байк или автомобиль — он сразу появится здесь
          </p>
        </div>
      )}

      <FranchizeOperatorPanel className="mt-4 text-sm leading-relaxed">
        <p className="break-words text-[var(--fr-admin-text)]">
          Для шаблона документов используй характеристики: <code>vin</code>,{" "}
          <code>plate</code>, <code>frame</code>.
        </p>
        <p className="mt-1 text-xs text-[var(--fr-admin-muted)]">
          Доступно записей по фильтру:{" "}
          <span className="font-semibold text-[var(--fr-admin-accent)]">
            {visible.length}
          </span>
          .{loadingFleet ? " Обновляем список..." : ""}
        </p>
        <div
          className="mt-2 rounded-xl border px-3 py-2"
          style={{
            borderColor: "var(--fr-admin-border)",
            backgroundColor: withAlpha(resolvedPalette.accentMain, 0.08),
          }}
        >
          <p className="text-xs text-[var(--fr-admin-text)]">
            VIN аудит: <span className="font-semibold">{vinAudit.withVin}</span>{" "}
            / {vinAudit.total} заполнено
          </p>
          {vinAudit.missing.length > 0 && (
            <>
              <p className="mt-1 text-xs text-amber-300">
                Пустых VIN: {vinAudit.missing.length} — нажмите на байк чтобы ввести VIN:
              </p>
              <div className="mt-2 space-y-1">
                {vinAudit.missing.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => handleQuickEditMissingVin(vehicle.id)}
                    className="flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition hover:opacity-80"
                    style={{
                      borderColor: "var(--fr-admin-border)",
                      backgroundColor: withAlpha(resolvedPalette.accentMain, 0.06),
                      color: "var(--fr-admin-text)",
                    }}
                  >
                    <span className="shrink-0 text-amber-400">⚠</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                      <span className="ml-1 opacity-60">({vehicle.id})</span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold" style={{ color: resolvedPalette.accentMain }}>
                      Ввести VIN →
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
              Успешные аренды
            </p>
            <p className="mt-1 text-xs text-[var(--fr-admin-muted)]">
              Последние активные и завершённые аренды с проверкой договора.
            </p>
          </div>
          <span
            className="rounded-full border px-2 py-1 text-xs text-[var(--fr-admin-muted)]"
            style={{ borderColor: "var(--fr-admin-border)" }}
          >
            {successfulRentals.length}
          </span>
        </div>
        {!successfulRentals.length ? (
          <p className="mt-3 text-xs text-[var(--fr-admin-muted)]">
            Успешных аренд пока нет.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: "var(--fr-admin-border)" }}>
            <div className="hidden grid-cols-[1.2fr_1fr_1fr_0.9fr] gap-3 border-b px-3 py-2 text-xs font-semibold text-[var(--fr-admin-muted)] md:grid" style={{ borderColor: "var(--fr-admin-border)" }}>
              <span>Мотоцикл</span>
              <span>Арендатор</span>
              <span>Даты</span>
              <span>Статус договора</span>
            </div>
            <div className="divide-y" style={{ borderColor: "var(--fr-admin-border)" }}>
              {successfulRentals.slice(0, 10).map((rental) => (
                <div
                  key={rental.rentalId}
                  className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[1.2fr_1fr_1fr_0.9fr] md:items-center"
                  style={{ borderColor: "var(--fr-admin-border)" }}
                >
                  <div>
                    <p className="font-semibold text-[var(--fr-admin-text)]">
                      {rental.bikeName}
                    </p>
                    <p className="text-xs text-[var(--fr-admin-muted)]">
                      {rentalStatusLabel(rental.status)} · #{rental.rentalId.slice(0, 8)}
                    </p>
                  </div>
                  <p className="text-[var(--fr-admin-text)]">
                    <span className="md:hidden text-xs text-[var(--fr-admin-muted)]">Арендатор: </span>
                    {rental.renterName}
                  </p>
                  <p className="text-[var(--fr-admin-text)]">
                    <span className="md:hidden text-xs text-[var(--fr-admin-muted)]">Даты: </span>
                    {formatRentalRange(rental.startDate, rental.endDate)}
                  </p>
                  <span
                    className="w-fit rounded-full border px-2 py-1 text-xs font-semibold text-[var(--fr-admin-text)]"
                    style={{
                      borderColor: "var(--fr-admin-border)",
                      backgroundColor: withAlpha(resolvedPalette.accentMain, rental.contractStatus === "verified" ? 0.16 : 0.06),
                    }}
                  >
                    {contractStatusLabel(rental.contractStatus)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel className="mt-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr),auto] sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
              Панель заявок вынесена
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fr-admin-muted)]">
              Админка гаража остаётся для карточек техники, VIN, отзывов и
              документов заявки. Горячие заявки, ответы в Telegram и ручные
              действия вынесены в отдельную панель.
            </p>
          </div>
          <Button
            asChild
            className="h-9 text-xs font-semibold"
            style={{
              ...buttonFocus,
              backgroundColor: "var(--fr-admin-accent)",
              color: accentOn,
            }}
          >
            <Link href={`/franchize/${slug}/dashboard`}>Открыть заявки</Link>
          </Button>
        </div>
        <div className="mt-3">
          <Button asChild variant="outline" className="h-9 text-xs font-semibold">
            <Link href={`/franchize/${slug}/admin/prices`}>
              Быстрая правка цен
            </Link>
          </Button>
        </div>
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel className="mt-4">
        {isCrewFleetAdmin ? (
          <>
            <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr),auto]">
              <Select
                value={selectedVehicle?.id ?? "new"}
                onValueChange={(value) =>
                  setSelectedVehicle(
                    value === "new"
                      ? null
                      : (visible.find((vehicle) => vehicle.id === value) ?? null),
                  )
                }
              >
                <SelectTrigger
                  className="w-full border text-left"
                  style={{
                    borderColor: "var(--fr-admin-border)",
                    color: "var(--fr-admin-text)",
                    backgroundColor: resolvedPalette.bgBase,
                  }}
                >
                  <SelectValue placeholder="Выбери запись для редактирования" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Создать новую запись</SelectItem>
                  {visible.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.type === "car" ? "🚗" : "🏍️"} {vehicle.make}{" "}
                      {vehicle.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedVehicle(null)}
                className="w-full sm:w-auto"
              >
                Новая запись
              </Button>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {visible.slice(0, 8).map((vehicle) => (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedVehicle(vehicle)}
                  className="max-w-full rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-90"
                  style={{
                    borderColor:
                      selectedVehicle?.id === vehicle.id
                        ? "var(--fr-admin-accent)"
                        : "var(--fr-admin-border)",
                    color:
                      selectedVehicle?.id === vehicle.id
                        ? accentOn
                        : "var(--fr-admin-text)",
                    backgroundColor:
                      selectedVehicle?.id === vehicle.id
                        ? "var(--fr-admin-accent)"
                        : "transparent",
                  }}
                >
                  <span className="block max-w-[220px] truncate">
                    {vehicle.make} {vehicle.model}
                  </span>
                </button>
              ))}
            </div>
            <div
              id="vehicle-edit-form"
              // FIX: Override Tailwind's CSS vars locally so CarSubmissionForm
              // (which uses bg-card/border-border/text-foreground classes) picks
              // up the crew's palette instead of the default dark theme.
              // Without this, the form was rendered with default colors that
              // clashed with the rest of the admin page.
              style={{
                ["--background" as string]: resolvedPalette.bgBase,
                ["--foreground" as string]: resolvedPalette.textPrimary,
                ["--card" as string]: resolvedPalette.bgCard ?? resolvedPalette.bgBase,
                ["--card-foreground" as string]: resolvedPalette.textPrimary,
                ["--border" as string]: resolvedPalette.borderSoft,
                ["--input" as string]: resolvedPalette.borderSoft,
                ["--primary" as string]: resolvedPalette.accentMain,
                ["--primary-foreground" as string]: accentOn,
                ["--muted" as string]: resolvedPalette.bgCard ?? resolvedPalette.bgBase,
                ["--muted-foreground" as string]: resolvedPalette.textSecondary,
                ["--accent" as string]: resolvedPalette.accentMain,
                ["--accent-foreground" as string]: accentOn,
                ["--ring" as string]: resolvedPalette.accentMain,
                borderRadius: "0.75rem",
              } as React.CSSProperties}
            >
              <CarSubmissionForm
                ownerId={dbUser?.user_id}
                vehicleToEdit={selectedVehicle}
                onSuccess={() => loadFleet()}
              />
            </div>
          </>
        ) : (
          <div className="py-3 text-sm text-muted-foreground text-center">
            Только администратор экипажа может редактировать технику.
          </div>
        )}
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
            Модерация отзывов аренды
          </p>
          <span
            className="rounded-full border px-2 py-1 text-xs text-[var(--fr-admin-muted)]"
            style={{ borderColor: "var(--fr-admin-border)" }}
          >
            {reviews.length}
          </span>
        </div>
        {!reviews.length ? (
          <p className="mt-2 text-xs text-[var(--fr-admin-muted)]">
            Отзывов пока нет.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {reviews.slice(0, 8).map((review) => (
              <div
                key={review.id}
                className="rounded-xl border p-2"
                style={{
                  borderColor: "var(--fr-admin-border)",
                  opacity: review.hiddenAt ? 0.62 : 1,
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-[var(--fr-admin-accent)]">
                    ★ {review.rating} / 5
                  </p>
                  <Button
                    type="button"
                    className="h-8 text-xs"
                    variant="outline"
                    onClick={() =>
                      handleModerateReview(review.id, !review.hiddenAt)
                    }
                    disabled={moderatingReviewId === review.id}
                  >
                    {review.hiddenAt ? "Показать" : "Скрыть"}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-[var(--fr-admin-muted)]">
                  техника: {review.bikeId} · пользователь: {review.userId}
                </p>
                {review.text && (
                  <p className="mt-2 text-sm text-[var(--fr-admin-text)]">
                    {review.text}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </FranchizeOperatorPanel>

      <FranchizeOperatorPanel className="mt-4">
        <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
          Сбои отправки документов
        </p>
        {!failedNotifications.length ? (
          <p className="mt-2 text-xs text-[var(--fr-admin-muted)]">
            Сбоев отправки не найдено.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {failedNotifications.map((item) => (
              <div
                key={`${item.orderId}-${item.sendTo}-${item.createdAt}`}
                className="rounded-xl border p-2"
                style={{ borderColor: "var(--fr-admin-border)" }}
              >
                <p className="text-xs text-[var(--fr-admin-text)]">
                  Заказ #{item.orderId} → {item.sendTo || "не указан"}
                </p>
                <p className="mt-1 text-xs text-rose-300">
                  {item.lastError || "ошибка не указана"}
                </p>
                <Button
                  type="button"
                  className="mt-2 h-8 text-xs"
                  onClick={() => handleRetryNotification(item.orderId)}
                  disabled={retryingOrderId === item.orderId}
                >
                  {retryingOrderId === item.orderId
                    ? "Повторяем..."
                    : "Повторить отправку"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </FranchizeOperatorPanel>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <FranchizeOperatorLinkButton href="/admin" variant="secondary">
          ← Общий админ
        </FranchizeOperatorLinkButton>
        <FranchizeOperatorLinkButton href={`/franchize/${slug}`}>
          Открыть витрину
        </FranchizeOperatorLinkButton>
      </div>
    </div>
  );
}
