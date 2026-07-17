"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  getFranchizeCloserIntents,
  updateFranchizeCloserIntentStage,
  type FranchizeCrewVM,
} from "@/app/franchize/actions";
import {
  focusRingOutlineStyle,
  readablePaletteTextOnColor,
  withAlpha,
} from "@/app/franchize/lib/theme";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";
import {
  FranchizeOperatorLinkButton,
  FranchizeOperatorPanel,
  FranchizeOperatorStatCard,
} from "./FranchizeOperatorSurface";

type CloserIntent = NonNullable<
  Awaited<ReturnType<typeof getFranchizeCloserIntents>>["items"]
>[number];

const closerActionLabels = {
  send_offer: "Отправить оффер",
  reserve_manually: "Резерв вручную",
  offer_alternative_bike: "Предложить замену",
  mark_closed: "Закрыть",
} as const;

type CloserAction = keyof typeof closerActionLabels;

const fallbackCrew: FranchizeCrewVM = {
  id: "",
  slug: "vip-bike",
  name: "VIP BIKE",
  description: "Панель обработки заявок экипажа",
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
  footer: { socialLinks: [], columns: [], textColor: "#16130A" },
};

interface FranchizeCloserDashboardClientProps {
  initialSlug: string;
  initialCrew?: FranchizeCrewVM;
}

export function FranchizeCloserDashboardClient({
  initialSlug,
  initialCrew,
}: FranchizeCloserDashboardClientProps) {
  const { dbUser, isLoading } = useAppContext();
  const crew = initialCrew || fallbackCrew;
  const [closerIntents, setCloserIntents] = useState<CloserIntent[]>([]);
  const [loadingCloserIntents, setLoadingCloserIntents] = useState(false);
  const [closerActionIntentId, setCloserActionIntentId] = useState<
    string | null
  >(null);
  const [filterIntentType, setFilterIntentType] = useState<string | null>(null);
  const closerLoadRequestRef = useRef(0);

  const slug = initialSlug?.trim() || "vip-bike";

  const loadCloserIntents = useCallback(async () => {
    if (!dbUser?.user_id) return;
    const requestId = closerLoadRequestRef.current + 1;
    closerLoadRequestRef.current = requestId;
    setLoadingCloserIntents(true);
    try {
      const result = await getFranchizeCloserIntents({ slug });
      if (closerLoadRequestRef.current !== requestId) return;
      if (!result.success) {
        toast.error(result.error || "Не удалось загрузить заявки на обработку");
        return;
      }
      setCloserIntents(result.items || []);
    } catch (error) {
      if (closerLoadRequestRef.current === requestId) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Не удалось загрузить заявки на обработку",
        );
      }
    } finally {
      if (closerLoadRequestRef.current === requestId) {
        setLoadingCloserIntents(false);
      }
    }
  }, [dbUser?.user_id, slug]);

  useEffect(() => {
    void loadCloserIntents();
  }, [loadCloserIntents]);

  const handleCopyTelegramReply = useCallback(async (intent: CloserIntent) => {
    try {
      await navigator.clipboard.writeText(intent.suggestedTelegramReply);
      toast.success("Ответ для Telegram скопирован");
    } catch {
      toast.error("Не удалось скопировать ответ");
    }
  }, []);

  const handleCloserAction = useCallback(
    async (intentId: string, action: CloserAction) => {
      if (!dbUser?.user_id) return;
      setCloserActionIntentId(intentId);
      try {
        const result = await updateFranchizeCloserIntentStage({
          slug,
          intentId,
          action,
        });
        if (!result.success) {
          toast.error(result.error || "Действие по заявке не сохранено");
          return;
        }
        toast.success(`${closerActionLabels[action]} сохранён`);
        void loadCloserIntents();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Действие по заявке не сохранено",
        );
      } finally {
        setCloserActionIntentId(null);
      }
    },
    [dbUser?.user_id, loadCloserIntents, slug],
  );

  const buttonFocus = focusRingOutlineStyle(crew.theme);
  const accentOn = readablePaletteTextOnColor(
    crew.theme.palette.accentMain,
    crew.theme.palette,
  );
  const brandName = crew.header.brandName || crew.name || slug;

  const renderCloserActionPanel = (intent: CloserIntent) => (
    <div
      className="min-w-0 rounded-xl border p-2.5 md:p-3"
      style={{
        borderColor: "var(--fr-dashboard-border)",
        backgroundColor: withAlpha(
          crew.theme.palette.bgBase,
          0.22,
        ),
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)] md:text-xs">
        Следующий шаг
      </p>
      <p className="mt-1 text-sm leading-snug text-[var(--fr-dashboard-text)]">
        {intent.suggestedNextAction}
      </p>
      <div
        className="mt-2 rounded-lg border p-2 md:mt-3"
        style={{ borderColor: "var(--fr-dashboard-border)" }}
      >
        <p className="text-[11px] text-[var(--fr-dashboard-muted)] md:text-xs">
          Ответ в Telegram
        </p>
        <p className="mt-1 break-words text-xs leading-relaxed text-[var(--fr-dashboard-text)]">
          {intent.suggestedTelegramReply}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 md:mt-3">
        <Button
          type="button"
          variant="outline"
          className="h-8 text-xs"
          onClick={() => void handleCopyTelegramReply(intent)}
          style={buttonFocus}
        >
          Скопировать ответ
        </Button>
        {(Object.keys(closerActionLabels) as CloserAction[]).map(
          (action) => (
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
              style={buttonFocus}
            >
              {closerActionLabels[action]}
            </Button>
          ),
        )}
      </div>
    </div>
  );

  const displayedIntents = useMemo(
    () =>
      filterIntentType
        ? closerIntents.filter((i) => i.intentType === filterIntentType)
        : closerIntents,
    [closerIntents, filterIntentType],
  );

  if (isLoading) return <Loading text="Загружаем заявки экипажа..." />;

  return (
    <div
      className="space-y-4"
      style={{
        ["--fr-dashboard-accent" as string]: crew.theme.palette.accentMain,
        ["--fr-dashboard-border" as string]: crew.theme.palette.borderSoft,
        ["--fr-dashboard-text" as string]: crew.theme.palette.textPrimary,
        ["--fr-dashboard-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-[var(--fr-dashboard-accent)]">
            Панель обработки заявок
          </p>
          <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--fr-dashboard-text)]">
            {brandName}: очередь заявок
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--fr-dashboard-muted)]">
            Единая рабочая очередь: заявки на аренду, продажу и сервис защищённо
            собираются на сервере, сортируются по приоритету и сохраняют историю действий.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <FranchizeOperatorLinkButton
            href={`/franchize/${slug}/admin`}
            variant="secondary"
          >
            Админка гаража
          </FranchizeOperatorLinkButton>
          <FranchizeOperatorLinkButton href={`/franchize/${slug}`}>
            Витрина
          </FranchizeOperatorLinkButton>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <FranchizeOperatorStatCard
          label="Аренда"
          value={closerIntents.filter((i) => i.intentType === "rent").length}
          detail="активных"
        />
        <FranchizeOperatorStatCard
          label="Продажа"
          value={closerIntents.filter((i) => i.intentType === "sale").length}
          detail="активных"
        />
        <FranchizeOperatorStatCard
          label="Сервис"
          value={closerIntents.filter((i) => i.intentType === "service").length}
          detail="активных"
        />
      </div>
      <FranchizeOperatorPanel className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--fr-dashboard-text)]">
            Очередь заявок
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => void loadCloserIntents()}
            disabled={loadingCloserIntents}
            style={buttonFocus}
          >
            {loadingCloserIntents ? "Обновляем…" : "Обновить"}
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { id: null, label: `Все (${closerIntents.length})` },
            { id: "rent", label: `Аренда (${closerIntents.filter((i) => i.intentType === "rent").length})` },
            { id: "sale", label: `Продажа (${closerIntents.filter((i) => i.intentType === "sale").length})` },
            { id: "service", label: `Сервис (${closerIntents.filter((i) => i.intentType === "service").length})` },
          ].map((tab) => (
            <button
              key={String(tab.id)}
              type="button"
              onClick={() => setFilterIntentType(tab.id)}
              className="rounded-full px-3 py-1 text-xs font-medium transition"
              style={{
                backgroundColor:
                  filterIntentType === tab.id
                    ? "var(--fr-dashboard-accent)"
                    : withAlpha(crew.theme.palette.bgCard, 0.72),
                color:
                  filterIntentType === tab.id
                    ? accentOn
                    : "var(--fr-dashboard-text)",
                border: "1px solid var(--fr-dashboard-border)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {!displayedIntents.length ? (
          <p
            className="mt-3 rounded-xl border px-3 py-2 text-xs text-[var(--fr-dashboard-muted)]"
            style={{ borderColor: "var(--fr-dashboard-border)" }}
          >
            {filterIntentType
              ? `Заявок типа "${filterIntentType}" пока нет.`
              : "Заявок пока нет. После оформления, возврата к брошенной заявке или предзаказа здесь появятся карточки для обработки."}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {displayedIntents.map((intent) => (
              <article
                key={intent.id}
                className="rounded-2xl border p-2 sm:p-3"
                style={{
                  borderColor:
                    intent.stage === "closed"
                      ? "var(--fr-dashboard-border)"
                      : "var(--fr-dashboard-accent)",
                  backgroundColor:
                    intent.stage === "closed"
                      ? withAlpha(crew.theme.palette.bgCard, 0.72)
                      : withAlpha(crew.theme.palette.accentMain, 0.07),
                }}
              >
                <div className="grid gap-2 md:gap-3 lg:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-full bg-[var(--fr-dashboard-accent)] px-2 py-1 text-xs font-bold"
                        style={{ color: accentOn }}
                      >
                        {intent.urgencyScore}
                      </span>
                      <span
                        className="rounded-full border px-2 py-1 text-xs text-[var(--fr-dashboard-text)]"
                        style={{ borderColor: "var(--fr-dashboard-border)" }}
                      >
                        {intent.intentType} · {intent.stage}
                      </span>
                      <span className="text-xs text-[var(--fr-dashboard-muted)]">
                        обновлено{" "}
                        {intent.updatedAt
                          ? new Date(intent.updatedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm font-semibold text-[var(--fr-dashboard-text)] sm:mt-2 sm:text-base">
                      {intent.bikeLabel}
                    </p>
                    <dl className="mt-2 grid gap-1.5 text-[11px] sm:grid-cols-2 sm:gap-2 sm:text-xs">
                      <div>
                        <dt className="uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)]">
                          Даты
                        </dt>
                        <dd className="mt-1 break-words text-[var(--fr-dashboard-text)]">
                          {intent.selectedDates}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)]">
                          Контакт
                        </dt>
                        <dd className="mt-1 break-words text-[var(--fr-dashboard-text)]">
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
                        <dt className="uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)]">
                          Стоп-фактор
                        </dt>
                        <dd className="mt-1 break-words text-[var(--fr-dashboard-text)]">
                          {intent.lastBlocker}
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)]">
                          Оплата
                        </dt>
                        <dd className="mt-1 break-words text-[var(--fr-dashboard-text)]">
                          {intent.paymentState}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <details className="mt-2 rounded-xl border p-2 md:hidden" style={{ borderColor: "var(--fr-dashboard-border)" }}>
                    <summary className="cursor-pointer text-xs font-semibold text-[var(--fr-dashboard-text)]">
                      Ответ и действия
                    </summary>
                    <div className="mt-2">
                      {renderCloserActionPanel(intent)}
                    </div>
                  </details>
                  <div className="hidden md:block">
                    {renderCloserActionPanel(intent)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </FranchizeOperatorPanel>
    </div>
  );
}
