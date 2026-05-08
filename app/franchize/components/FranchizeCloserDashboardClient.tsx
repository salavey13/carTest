"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getFranchizeBySlug,
  getFranchizeCloserIntents,
  updateFranchizeCloserIntentStage,
  type FranchizeCrewVM,
} from "@/app/franchize/actions";
import {
  crewPaletteForSurface,
  focusRingOutlineStyle,
} from "@/app/franchize/lib/theme";
import { Loading } from "@/components/Loading";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/contexts/AppContext";

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

const fallbackCrew: FranchizeCrewVM = {
  id: "",
  slug: "vip-bike",
  name: "VIP BIKE",
  description: "Crew closer dashboard",
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

interface FranchizeCloserDashboardClientProps {
  initialSlug: string;
}

export function FranchizeCloserDashboardClient({
  initialSlug,
}: FranchizeCloserDashboardClientProps) {
  const { dbUser, isLoading } = useAppContext();
  const [crew, setCrew] = useState<FranchizeCrewVM>(fallbackCrew);
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

  useEffect(() => {
    void loadCrewTheme();
  }, [loadCrewTheme]);

  useEffect(() => {
    void loadCloserIntents();
  }, [loadCloserIntents]);

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

  const surface = crewPaletteForSurface(crew.theme);
  const buttonFocus = focusRingOutlineStyle(crew.theme);
  const accentOn = "#16130A";
  const brandName = crew.header.brandName || crew.name || slug;

  if (isLoading) return <Loading text="FRANCHIZE DASHBOARD INIT..." />;

  return (
    <section
      className="min-h-screen overflow-x-hidden px-3 pb-10 pt-24 sm:px-4"
      style={{
        ...surface.page,
        ["--fr-dashboard-accent" as string]: crew.theme.palette.accentMain,
        ["--fr-dashboard-border" as string]: crew.theme.palette.borderSoft,
        ["--fr-dashboard-text" as string]: crew.theme.palette.textPrimary,
        ["--fr-dashboard-muted" as string]: crew.theme.palette.textSecondary,
      }}
    >
      <div
        className="mx-auto max-w-6xl overflow-hidden rounded-3xl border p-4 sm:p-6"
        style={surface.card}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--fr-dashboard-accent)]">
              operator closer dashboard
            </p>
            <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--fr-dashboard-text)]">
              {brandName.toUpperCase()} — HOT LEADS
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--fr-dashboard-muted)]">
              Отдельная franchize dashboard page для sales/closer работы. Лиды
              читаются из server-only intent ledger, ранжируются по urgency
              score и сохраняют историю действий в metadata.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              className="h-9 text-xs"
              style={buttonFocus}
            >
              <Link href={`/franchize/${slug}/admin`}>Garage admin</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-9 text-xs"
              style={buttonFocus}
            >
              <Link href={`/franchize/${slug}`}>Storefront</Link>
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div
            className="rounded-2xl border p-3"
            style={{
              ...surface.subtleCard,
              borderColor: "var(--fr-dashboard-border)",
            }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--fr-dashboard-muted)]">
              hot leads
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--fr-dashboard-text)]">
              {hotCloserCount}
            </p>
          </div>
          <div
            className="rounded-2xl border p-3"
            style={{
              ...surface.subtleCard,
              borderColor: "var(--fr-dashboard-border)",
            }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--fr-dashboard-muted)]">
              all intents
            </p>
            <p className="mt-2 text-3xl font-semibold text-[var(--fr-dashboard-text)]">
              {closerIntents.length}
            </p>
          </div>
          <div
            className="rounded-2xl border p-3"
            style={{
              ...surface.subtleCard,
              borderColor: "var(--fr-dashboard-border)",
            }}
          >
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--fr-dashboard-muted)]">
              mode
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--fr-dashboard-text)]">
              copy-first · manual close
            </p>
          </div>
        </div>

        <div
          className="mt-4 rounded-2xl border p-3"
          style={{
            ...surface.subtleCard,
            borderColor: "var(--fr-dashboard-border)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--fr-dashboard-text)]">
              Ranked closer queue
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void loadCloserIntents()}
              disabled={loadingCloserIntents}
              style={buttonFocus}
            >
              {loadingCloserIntents ? "Loading…" : "Refresh"}
            </Button>
          </div>

          {!closerIntents.length ? (
            <p
              className="mt-3 rounded-xl border px-3 py-2 text-xs text-[var(--fr-dashboard-muted)]"
              style={{ borderColor: "var(--fr-dashboard-border)" }}
            >
              Hot leads пока не найдены. После checkout/recovery/prebuy сигналов
              здесь появятся карточки для закрытия.
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
                        ? "var(--fr-dashboard-border)"
                        : "var(--fr-dashboard-accent)",
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
                          updated{" "}
                          {intent.updatedAt
                            ? new Date(intent.updatedAt).toLocaleString()
                            : "—"}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-base font-semibold text-[var(--fr-dashboard-text)]">
                        {intent.bikeLabel}
                      </p>
                      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)]">
                            dates
                          </dt>
                          <dd className="mt-1 break-words text-[var(--fr-dashboard-text)]">
                            {intent.selectedDates}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)]">
                            contact
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
                            last blocker
                          </dt>
                          <dd className="mt-1 break-words text-[var(--fr-dashboard-text)]">
                            {intent.lastBlocker}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)]">
                            payment
                          </dt>
                          <dd className="mt-1 break-words text-[var(--fr-dashboard-text)]">
                            {intent.paymentState}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div
                      className="min-w-0 rounded-xl border p-3"
                      style={{
                        borderColor: "var(--fr-dashboard-border)",
                        backgroundColor: "rgba(0,0,0,0.16)",
                      }}
                    >
                      <p className="text-xs uppercase tracking-[0.14em] text-[var(--fr-dashboard-muted)]">
                        suggested next action
                      </p>
                      <p className="mt-1 text-sm text-[var(--fr-dashboard-text)]">
                        {intent.suggestedNextAction}
                      </p>
                      <div
                        className="mt-3 rounded-lg border p-2"
                        style={{ borderColor: "var(--fr-dashboard-border)" }}
                      >
                        <p className="text-xs text-[var(--fr-dashboard-muted)]">
                          Telegram reply
                        </p>
                        <p className="mt-1 break-words text-xs leading-relaxed text-[var(--fr-dashboard-text)]">
                          {intent.suggestedTelegramReply}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => void handleCopyTelegramReply(intent)}
                          style={buttonFocus}
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
                            style={buttonFocus}
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
      </div>
    </section>
  );
}
