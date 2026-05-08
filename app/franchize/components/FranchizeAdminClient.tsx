"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/Loading";
import { useAppContext } from "@/contexts/AppContext";
import { getEditableVehiclesForUser } from "@/app/rentals/actions";
import {
  getFranchizeBySlug,
  getFranchizeCloserIntents,
  getFranchizeOrderNotificationFailures,
  getFranchizeRentalReviewsForModeration,
  moderateRentalReview,
  retryFranchizeOrderNotification,
  updateFranchizeCloserIntentStage,
  type FranchizeCrewVM,
  type RentalReviewVM,
} from "@/app/franchize/actions";
import {
  crewPaletteForSurface,
  focusRingOutlineStyle,
} from "@/app/franchize/lib/theme";
import { CarSubmissionForm } from "@/components/CarSubmissionForm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Database } from "@/types/database.types";

type Vehicle = Database["public"]["Tables"]["cars"]["Row"];

type CloserIntent = {
  id: string;
  intentType: string;
  stage: string;
  urgencyScore: number;
  bikeId: string | null;
  bikeLabel: string;
  selectedDates: string;
  contactChannel: string;
  lastBlocker: string;
  paymentState: string;
  telegramUserId: string | null;
  telegramUsername: string | null;
  suggestedNextAction: string;
  suggestedTelegramReply: string;
  updatedAt: string;
};

type CloserAction =
  | "send_offer"
  | "reserve_manually"
  | "offer_alternative_bike"
  | "mark_closed";

const closerActionLabels: Record<CloserAction, string> = {
  send_offer: "Send offer",
  reserve_manually: "Reserve manually",
  offer_alternative_bike: "Offer alternative bike",
  mark_closed: "Mark closed",
};

const normalizeVin = (value: unknown) =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const VIN_ALLOWED = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";

const buildSyntheticVin = (vehicle: Vehicle) => {
  const raw =
    `${vehicle.make ?? ""}${vehicle.model ?? ""}${vehicle.year ?? ""}${vehicle.id ?? ""}`.toUpperCase();
  const mapped = raw
    .replace(/I/g, "1")
    .replace(/O/g, "0")
    .replace(/Q/g, "0")
    .replace(/[^A-Z0-9]/g, "");
  const normalized = mapped
    .split("")
    .map((char) => (VIN_ALLOWED.includes(char) ? char : "X"))
    .join("");
  return (normalized + "CARTESTVIN00000000").slice(0, 17);
};

const fallbackCrew: FranchizeCrewVM = {
  id: "",
  slug: "vip-bike",
  name: "VIP BIKE",
  description: "Crew admin panel",
  logoUrl: "",
  hqLocation: "",
  isFound: false,
  theme: {
    mode: "pepperolli_dark",
    palette: {
      bgBase: "#0B0C10",
      bgCard: "#111217",
      accentMain: "#D99A00",
      accentMainHover: "#E2A812",
      textPrimary: "#F2F2F3",
      textSecondary: "#A7ABB4",
      borderSoft: "#24262E",
    },
  },
  header: {
    brandName: "VIP BIKE",
    tagline: "Ride the vibe",
    logoUrl: "",
    logoHref: "",
    menuLinks: [],
  },
  contacts: {
    phone: "",
    email: "",
    address: "",
    telegram: "",
    workingHours: "",
    map: {
      gps: "",
      publicTransport: "",
      carDirections: "",
      imageUrl: "",
      bounds: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  },
  catalog: {
    categories: [],
    quickLinks: [],
    tickerItems: [],
    promoBanners: [],
    adCards: [],
    showcaseGroups: [],
  },
  ratingSummary: { average: 0, count: 0 },
  footer: { socialLinks: [], textColor: "#16130A" },
};

interface FranchizeAdminClientProps {
  initialSlug: string;
  editId?: string;
}

export function FranchizeAdminClient({
  initialSlug,
  editId,
}: FranchizeAdminClientProps) {
  const { dbUser, isLoading } = useAppContext();
  const [crew, setCrew] = useState<FranchizeCrewVM>(fallbackCrew);
  const [fleet, setFleet] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [filterType, setFilterType] = useState<"all" | "bike" | "car">("all");
  const [loadingFleet, setLoadingFleet] = useState(false);
  const [failedNotifications, setFailedNotifications] = useState<
    Array<{
      orderId: string;
      sendTo: string;
      lastError: string;
      createdAt: string;
    }>
  >([]);
  const [reviews, setReviews] = useState<RentalReviewVM[]>([]);
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const [isBulkFillingVin, setIsBulkFillingVin] = useState(false);
  const [moderatingReviewId, setModeratingReviewId] = useState<string | null>(
    null,
  );
  const [closerIntents, setCloserIntents] = useState<CloserIntent[]>([]);
  const [loadingCloserIntents, setLoadingCloserIntents] = useState(false);
  const [closerActionIntentId, setCloserActionIntentId] = useState<
    string | null
  >(null);

  const slug = initialSlug?.trim() || "vip-bike";

  const loadCrewTheme = useCallback(async () => {
    const { crew: loaded } = await getFranchizeBySlug(slug);
    setCrew(loaded || fallbackCrew);
  }, [slug]);

  const loadFleet = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setLoadingFleet(true);
    const res = await getEditableVehiclesForUser(dbUser.user_id);
    setLoadingFleet(false);

    if (!res.success) {
      toast.error(res.error || "Не удалось загрузить технику");
      return;
    }

    const scoped = (res.data || []).filter(
      (item) =>
        (item.type === "bike" || item.type === "car") &&
        (!crew.id ||
          item.crew_id === crew.id ||
          item.owner_id === dbUser.user_id),
    );

    setFleet(scoped);

    if (editId) {
      const found = scoped.find((item) => item.id === editId) || null;
      setSelectedVehicle(found);
      if (!found) {
        toast.info(
          "Карточка из edit-параметра не найдена в текущем crew scope.",
        );
      }
    }
  }, [crew.id, dbUser?.user_id, editId]);

  useEffect(() => {
    loadCrewTheme();
  }, [loadCrewTheme]);

  useEffect(() => {
    loadFleet();
  }, [loadFleet]);

  const loadFailedNotifications = useCallback(async () => {
    if (!dbUser?.user_id) return;
    const result = await getFranchizeOrderNotificationFailures({
      slug,
      actorUserId: dbUser.user_id,
    });
    if (!result.success) return;
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
  const loadReviews = useCallback(async () => {
    if (!dbUser?.user_id) return;
    const result = await getFranchizeRentalReviewsForModeration({
      slug,
      actorUserId: dbUser.user_id,
    });
    if (!result.success) return;
    setReviews(result.items || []);
  }, [dbUser?.user_id, slug]);

  const loadCloserIntents = useCallback(async () => {
    if (!dbUser?.user_id) return;
    setLoadingCloserIntents(true);
    const result = await getFranchizeCloserIntents({
      slug,
      actorUserId: dbUser.user_id,
    });
    setLoadingCloserIntents(false);
    if (!result.success) {
      toast.error(result.error || "Не удалось загрузить closer intents");
      return;
    }
    setCloserIntents((result.items || []) as CloserIntent[]);
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
    void loadCloserIntents();
  }, [loadCloserIntents]);

  const visible = useMemo(
    () =>
      fleet.filter((item) =>
        filterType === "all" ? true : item.type === filterType,
      ),
    [fleet, filterType],
  );

  const hotCloserCount = useMemo(
    () => closerIntents.filter((item) => item.stage !== "closed").length,
    [closerIntents],
  );

  const handleCopyTelegramReply = useCallback(async (intent: CloserIntent) => {
    try {
      await navigator.clipboard.writeText(intent.suggestedTelegramReply);
      toast.success("Telegram reply скопирован");
    } catch {
      toast.error("Не удалось скопировать reply");
    }
  }, []);

  const handleCloserAction = useCallback(
    async (intentId: string, action: CloserAction) => {
      if (!dbUser?.user_id) return;
      setCloserActionIntentId(intentId);
      const result = await updateFranchizeCloserIntentStage({
        slug,
        actorUserId: dbUser.user_id,
        intentId,
        action,
      });
      setCloserActionIntentId(null);
      if (!result.success) {
        toast.error(result.error || "Closer action не сохранён");
        return;
      }
      toast.success(`${closerActionLabels[action]} сохранён`);
      void loadCloserIntents();
    },
    [dbUser?.user_id, loadCloserIntents, slug],
  );

  const vinAudit = useMemo(() => {
    const target = fleet.filter(
      (item) => item.type === "bike" || item.type === "car",
    );
    const missing = target.filter((item) => !normalizeVin(item.specs?.vin));
    return {
      total: target.length,
      withVin: target.length - missing.length,
      missing,
    };
  }, [fleet]);

  const handleBulkFillVin = useCallback(async () => {
    if (!vinAudit.missing.length) return;
    setIsBulkFillingVin(true);
    try {
      for (const vehicle of vinAudit.missing) {
        const response = await fetch("/api/cars", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...vehicle,
            specs: {
              ...(vehicle.specs || {}),
              vin: buildSyntheticVin(vehicle),
            },
          }),
        });
        if (!response.ok)
          throw new Error(
            `VIN bulk-fill failed for ${vehicle.make} ${vehicle.model}`,
          );
      }
      toast.success(`VIN заполнен для ${vinAudit.missing.length} карточек`);
      await loadFleet();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось выполнить bulk-fill VIN",
      );
    } finally {
      setIsBulkFillingVin(false);
    }
  }, [vinAudit.missing, loadFleet]);

  const surface = crewPaletteForSurface(crew.theme);
  const buttonFocus = focusRingOutlineStyle(crew.theme);
  const accentOn = "#16130A";

  if (isLoading) return <Loading text="FRANCHIZE ADMIN INIT..." />;

  return (
    <section
      className="min-h-screen overflow-x-hidden px-3 pb-10 pt-24 sm:px-4"
      style={{
        ...surface.page,
        ["--fr-admin-accent" as string]: crew.theme.palette.accentMain,
        ["--fr-admin-accent-hover" as string]:
          crew.theme.palette.accentMainHover,
        ["--fr-admin-border" as string]: crew.theme.palette.borderSoft,
        ["--fr-admin-text" as string]: crew.theme.palette.textPrimary,
        ["--fr-admin-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      <div
        className="mx-auto max-w-5xl overflow-hidden rounded-3xl border p-4 sm:p-6"
        style={surface.card}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--fr-admin-accent)]">
          crew owner console
        </p>
        <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--fr-admin-text)]">
          {(crew.header.brandName || crew.name || slug).toUpperCase()} — ADMIN
          GARAGE
        </h1>
        <p className="mt-2 max-w-3xl break-words text-sm leading-relaxed text-[var(--fr-admin-muted)]">
          Переключатель экипажа:{" "}
          <span className="font-semibold text-[var(--fr-admin-accent)]">
            {slug}
          </span>
          . Редактируй bike/car карточки, добавляй VIN и формируй корректные
          checkout документы без контрастных артефактов темы.
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
          ].map((filter) => {
            const active = filterType === filter.id;
            return (
              <Button
                key={filter.id}
                type="button"
                onClick={() =>
                  setFilterType(filter.id as "all" | "bike" | "car")
                }
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

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div
            className="min-w-0 rounded-2xl border p-3"
            style={{
              ...surface.subtleCard,
              borderColor: "var(--fr-admin-border)",
            }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--fr-admin-muted)]">
              Всего в scope
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--fr-admin-text)]">
              {fleet.length}
            </p>
          </div>
          <div
            className="min-w-0 rounded-2xl border p-3"
            style={{
              ...surface.subtleCard,
              borderColor: "var(--fr-admin-border)",
            }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--fr-admin-muted)]">
              Байки
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--fr-admin-text)]">
              {fleet.filter((v) => v.type === "bike").length}
            </p>
          </div>
          <div
            className="min-w-0 rounded-2xl border p-3"
            style={{
              ...surface.subtleCard,
              borderColor: "var(--fr-admin-border)",
            }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--fr-admin-muted)]">
              Авто
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--fr-admin-text)]">
              {fleet.filter((v) => v.type === "car").length}
            </p>
          </div>
        </div>
        <div
          className="mt-4 rounded-2xl border p-3 text-sm leading-relaxed"
          style={{
            ...surface.subtleCard,
            borderColor: "var(--fr-admin-border)",
          }}
        >
          <p className="break-words text-[var(--fr-admin-text)]">
            Для doc-шаблона используй specs: <code>vin</code>,{" "}
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
              backgroundColor: "rgba(217,154,0,0.08)",
            }}
          >
            <p className="text-xs text-[var(--fr-admin-text)]">
              VIN аудит:{" "}
              <span className="font-semibold">{vinAudit.withVin}</span> /{" "}
              {vinAudit.total} заполнено
            </p>
            {vinAudit.missing.length > 0 && (
              <p className="mt-1 text-xs text-amber-300">
                Пустых VIN: {vinAudit.missing.length}
              </p>
            )}
            {vinAudit.missing.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="mt-2 h-8 text-xs"
                onClick={() => void handleBulkFillVin()}
                disabled={isBulkFillingVin}
              >
                {isBulkFillingVin ? "Заполняю VIN…" : "Bulk-fill VIN"}
              </Button>
            )}
          </div>
        </div>

        <div
          className="mt-4 rounded-2xl border p-3"
          style={{
            ...surface.subtleCard,
            borderColor: "var(--fr-admin-border)",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
                Operator closer dashboard
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--fr-admin-muted)]">
                Горячие franchize_intents отсортированы по urgency score и
                последнему обновлению. История не удаляется: actions меняют
                stage и дописывают metadata.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full border px-2 py-1 text-xs font-semibold text-[var(--fr-admin-accent)]"
                style={{ borderColor: "var(--fr-admin-border)" }}
              >
                hot {hotCloserCount}
              </span>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => void loadCloserIntents()}
                disabled={loadingCloserIntents}
              >
                {loadingCloserIntents ? "Loading…" : "Refresh"}
              </Button>
            </div>
          </div>

          {!closerIntents.length ? (
            <p
              className="mt-3 rounded-xl border px-3 py-2 text-xs text-[var(--fr-admin-muted)]"
              style={{ borderColor: "var(--fr-admin-border)" }}
            >
              Hot leads пока не найдены. После checkout/recovery сигналов здесь
              появятся карточки для закрытия.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {closerIntents.map((intent) => (
                <article
                  key={intent.id}
                  className="rounded-2xl border p-3"
                  style={{
                    borderColor:
                      intent.stage === "closed"
                        ? "var(--fr-admin-border)"
                        : "var(--fr-admin-accent)",
                    backgroundColor:
                      intent.stage === "closed"
                        ? "rgba(255,255,255,0.02)"
                        : "rgba(217,154,0,0.07)",
                  }}
                >
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full bg-[var(--fr-admin-accent)] px-2 py-1 text-xs font-bold"
                          style={{ color: accentOn }}
                        >
                          {intent.urgencyScore}
                        </span>
                        <span
                          className="rounded-full border px-2 py-1 text-xs text-[var(--fr-admin-text)]"
                          style={{ borderColor: "var(--fr-admin-border)" }}
                        >
                          {intent.intentType} · {intent.stage}
                        </span>
                        <span className="text-xs text-[var(--fr-admin-muted)]">
                          updated{" "}
                          {intent.updatedAt
                            ? new Date(intent.updatedAt).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-base font-semibold text-[var(--fr-admin-text)]">
                        {intent.bikeLabel}
                      </p>
                      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="uppercase tracking-[0.14em] text-[var(--fr-admin-muted)]">
                            dates
                          </dt>
                          <dd className="mt-1 break-words text-[var(--fr-admin-text)]">
                            {intent.selectedDates}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-[0.14em] text-[var(--fr-admin-muted)]">
                            contact
                          </dt>
                          <dd className="mt-1 break-words text-[var(--fr-admin-text)]">
                            {intent.contactChannel}
                            {intent.telegramUsername
                              ? ` · @${intent.telegramUsername}`
                              : ""}
                            {intent.telegramUserId
                              ? ` · tg:${intent.telegramUserId}`
                              : ""}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-[0.14em] text-[var(--fr-admin-muted)]">
                            last blocker
                          </dt>
                          <dd className="mt-1 break-words text-[var(--fr-admin-text)]">
                            {intent.lastBlocker}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-[0.14em] text-[var(--fr-admin-muted)]">
                            payment
                          </dt>
                          <dd className="mt-1 break-words text-[var(--fr-admin-text)]">
                            {intent.paymentState}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div
                      className="min-w-0 rounded-xl border p-3"
                      style={{
                        borderColor: "var(--fr-admin-border)",
                        backgroundColor: "rgba(0,0,0,0.16)",
                      }}
                    >
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--fr-admin-muted)]">
                        suggested next action
                      </p>
                      <p className="mt-1 text-sm text-[var(--fr-admin-text)]">
                        {intent.suggestedNextAction}
                      </p>
                      <div
                        className="mt-3 rounded-lg border p-2"
                        style={{ borderColor: "var(--fr-admin-border)" }}
                      >
                        <p className="text-xs text-[var(--fr-admin-muted)]">
                          Telegram reply
                        </p>
                        <p className="mt-1 break-words text-xs leading-relaxed text-[var(--fr-admin-text)]">
                          {intent.suggestedTelegramReply}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => void handleCopyTelegramReply(intent)}
                        >
                          Copy Telegram reply
                        </Button>
                        {(
                          Object.keys(closerActionLabels) as CloserAction[]
                        ).map((action) => (
                          <Button
                            key={action}
                            type="button"
                            className="h-8 text-xs"
                            variant={
                              action === "mark_closed" ? "outline" : "default"
                            }
                            onClick={() =>
                              void handleCloserAction(intent.id, action)
                            }
                            disabled={closerActionIntentId === intent.id}
                          >
                            {closerActionLabels[action]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div
          className="mt-4 rounded-2xl border p-3"
          style={{
            ...surface.subtleCard,
            borderColor: "var(--fr-admin-border)",
          }}
        >
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
                  backgroundColor: surface.page.backgroundColor,
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
          <CarSubmissionForm
            ownerId={dbUser?.user_id}
            vehicleToEdit={selectedVehicle}
            onSuccess={() => loadFleet()}
          />
        </div>

        <div
          className="mt-4 rounded-2xl border p-3"
          style={{
            ...surface.subtleCard,
            borderColor: "var(--fr-admin-border)",
          }}
        >
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
                    байк: {review.bikeId} · пользователь: {review.userId}
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
        </div>

        <div
          className="mt-4 rounded-2xl border p-3"
          style={{
            ...surface.subtleCard,
            borderColor: "var(--fr-admin-border)",
          }}
        >
          <p className="text-sm font-semibold text-[var(--fr-admin-text)]">
            Failed doc notifications
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
                    Заказ #{item.orderId} → {item.sendTo || "unknown"}
                  </p>
                  <p className="mt-1 text-xs text-rose-300">
                    {item.lastError || "unknown error"}
                  </p>
                  <Button
                    type="button"
                    className="mt-2 h-8 text-xs"
                    onClick={() => handleRetryNotification(item.orderId)}
                    disabled={retryingOrderId === item.orderId}
                  >
                    {retryingOrderId === item.orderId
                      ? "Retry..."
                      : "Retry send"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            className="underline underline-offset-4 text-[var(--fr-admin-accent)]"
            href="/admin"
          >
            ← Общий admin
          </Link>
          <Link
            className="underline underline-offset-4 text-[var(--fr-admin-accent)]"
            href={`/franchize/${slug}`}
          >
            Открыть storefront
          </Link>
        </div>
      </div>
    </section>
  );
}
