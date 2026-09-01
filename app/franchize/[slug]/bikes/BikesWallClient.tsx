"use client";

// /app/franchize/[slug]/bikes/BikesWallClient.tsx
// iter28 — «Мотопарк»: fleet wall index. Mobile-first: single column of photo
// cards, every bike with its live stats. Tap a card → the bike's story wall.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Bike, ChevronLeft, ChevronRight, HandCoins, RefreshCw, Wrench } from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { getBikesWallAction } from "@/app/franchize/server-actions/bike-wall";
import { getTelegramInitData } from "@/lib/telegram-webapp-init-data";
import type { BikeWallSummary } from "@/app/franchize/lib/bike-wall";
import { formatMoney, monthLabelRu, monthLabelShort } from "@/app/franchize/lib/bike-wall";
import { AnalyticsPasswordEntry } from "@/app/franchize/[slug]/rentals-analytics/analytics-components/AnalyticsPasswordEntry";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import type { FranchizeCrewVM } from "@/app/franchize/actions";

interface BikesWallClientProps {
  initialSlug: string;
  crew: FranchizeCrewVM;
}

type SortMode = "earned" | "recent" | "name";

export function BikesWallClient({ initialSlug, crew }: BikesWallClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const params = useParams<{ slug: string }>();
  const slug = initialSlug || params?.slug || "vip-bike";

  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);
  const [bikes, setBikes] = useState<BikeWallSummary[]>([]);
  const [viewerIsSubrenter, setViewerIsSubrenter] = useState(false);
  const [fleetEarnedTotal, setFleetEarnedTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("earned");
  // Month selector (2026-09-01): null = all-time tiles; a "YYYY-MM" key scopes
  // each card's money/rental tiles + the fleet header total to that month.
  const [month, setMonth] = useState<string | null>(null);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  useFranchizeTheme(crew?.theme || { mode: "auto", isAuto: true });
  const T = useCrewTokens(crew?.theme || { mode: "auto", isAuto: true });

  const isAuthed = !!(dbUser?.user_id || passwordAuthOwnerId);
  const getActorUserId = useCallback(
    (): string | null => dbUser?.user_id || passwordAuthOwnerId,
    [dbUser?.user_id, passwordAuthOwnerId],
  );

  useEffect(() => {
    if (!authLoading && !dbUser && !passwordAuthOwnerId) {
      setShowPasswordEntry(true);
      setIsLoading(false);
    }
  }, [authLoading, dbUser, passwordAuthOwnerId]);

  const fetchWall = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getBikesWallAction({
        slug,
        actorUserId: getActorUserId() || undefined,
        isPasswordAuth: !!passwordAuthOwnerId,
        initData: getTelegramInitData(),
        month,
      });
      if (result.success && result.data) {
        setBikes(result.data.bikes);
        setViewerIsSubrenter(result.data.viewerIsSubrenter);
        setFleetEarnedTotal(result.data.fleetEarnedTotal);
        setAvailableMonths(result.data.availableMonths ?? []);
      } else {
        setError(result.error || "Не удалось загрузить мотопарк.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  }, [slug, getActorUserId, passwordAuthOwnerId, month]);

  useEffect(() => {
    if (!isAuthed || authLoading) return;
    void fetchWall();
  }, [isAuthed, authLoading, fetchWall]);

  const handlePasswordAuth = (ownerId: string | null) => {
    if (!ownerId) return;
    setPasswordAuthOwnerId(ownerId);
    setShowPasswordEntry(false);
  };

  const sortedBikes = useMemo(() => {
    const copy = [...bikes];
    if (sortMode === "earned") {
      // m10 fix: when a month is selected, rank by THAT month's earnings —
      // the cards show earnedThisMonth, so all-time ordering contradicted
      // the numbers on screen.
      const key = (s: BikeWallSummary["stats"]) => (month ? s.earnedThisMonth : s.earnedTotal);
      copy.sort((a, b) => key(b.stats) - key(a.stats));
    }
    else if (sortMode === "recent") {
      copy.sort((a, b) => {
        const at = Date.parse(a.stats.lastRentalAt || a.stats.lastServiceAt || "");
        const bt = Date.parse(b.stats.lastRentalAt || b.stats.lastServiceAt || "");
        return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
      });
    } else copy.sort((a, b) => a.label.localeCompare(b.label, "ru"));
    return copy;
  }, [bikes, sortMode]);

  if (showPasswordEntry) {
    return <AnalyticsPasswordEntry crewName={crew?.name || "Экипаж"} slug={slug} onAuthenticated={handlePasswordAuth} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin" style={{ color: T.accent }} />
          <p className="text-sm" style={{ color: T.textMuted }}>Загружаем мотопарк...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border p-6 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <p className="text-sm" style={{ color: T.text }}>{error}</p>
          <button onClick={() => void fetchWall()} className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-85" style={T.styles.ctaPrimary}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  const totalActive = bikes.filter((b) => b.onRentNow).length;

  return (
    <div className="space-y-4">
      {/* header band */}
      <div className="rounded-2xl border p-4 sm:p-5" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.accent }}>
              Стена мото · {viewerIsSubrenter ? "мои мото" : "весь парк"}
            </p>
            <h1 className="mt-1 text-xl font-bold sm:text-2xl" style={{ color: T.text }}>Мотопарк</h1>
            <p className="mt-1 text-sm" style={{ color: T.textMuted }}>
              {bikes.length} мото · {totalActive} в аренде сейчас
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide" style={{ color: T.textMuted }}>
              {month ? `Заработал парк · ${monthLabelRu(month)}` : "Заработал парк"}
            </p>
            <p className="text-xl font-bold sm:text-2xl" style={{ color: T.accent }}>{formatMoney(fleetEarnedTotal)}</p>
          </div>
        </div>

        {/* month selector — [Всё время] ↔ [текущий] ↔ [прошлые месяцы] */}
        {(() => {
          const timeline: Array<string | null> = [null, ...availableMonths];
          // n1 fix: if the selected key is not in availableMonths (e.g. the
          // refetch narrowed the list), clamp to «Всё время» instead of
          // desyncing the arrows from the label.
          const rawIndex = month == null ? 0 : 1 + availableMonths.indexOf(month);
          const index = rawIndex <= 0 ? 0 : Math.min(rawIndex, timeline.length - 1);
          const canBack = index < timeline.length - 1;
          const canForward = index > 0;
          const step = (delta: 1 | -1) => setMonth(timeline[Math.min(Math.max(index + delta, 0), timeline.length - 1)]);
          return (
            <div className="mt-3 flex items-center justify-between gap-1.5 rounded-xl border px-2 py-1.5" style={{ borderColor: T.borderSoft, backgroundColor: T.bgElevated }}>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={!canBack}
                aria-label="Предыдущий месяц"
                className="flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-30"
                style={{ backgroundColor: T.bgCard, color: T.text }}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="truncate text-sm font-semibold" style={{ color: month ? T.accent : T.text }}>
                  {month ? monthLabelRu(month) : "Всё время"}
                </p>
                <p className="mt-0.5 truncate text-[10px]" style={{ color: T.textFaint }}>
                  {month ? "выручка и аренды за месяц" : "выручка за всё время"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={!canForward}
                aria-label="Следующий месяц или всё время"
                className="flex h-11 w-11 items-center justify-center rounded-xl transition active:scale-95 disabled:opacity-30"
                style={{ backgroundColor: T.bgCard, color: T.text }}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          );
        })()}

        {/* sort pills */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {([
            { id: "earned", label: "По выручке" },
            { id: "recent", label: "По активности" },
            { id: "name", label: "По названию" },
          ] as const).map((mode) => (
            <button
              key={mode.id}
              onClick={() => setSortMode(mode.id)}
              className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition"
              style={
                sortMode === mode.id
                  ? { ...T.styles.accentPill, borderColor: T.accent }
                  : { borderColor: T.borderSoft, color: T.textMuted, backgroundColor: T.bgElevated }
              }
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* bike cards — 1 col mobile / 2 sm / 3 lg */}
      {sortedBikes.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <Bike className="mx-auto h-8 w-8" style={{ color: T.textFaint }} />
          <p className="mt-3 text-sm" style={{ color: T.textMuted }}>
            {viewerIsSubrenter ? "У вас пока нет мото в этом экипаже." : "В парке пока нет мото."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sortedBikes.map((bike) => (
            <BikeCard key={bike.bikeId} bike={bike} slug={slug} T={T} month={month} />
          ))}
        </div>
      )}
    </div>
  );
}

function BikeCard({
  bike,
  slug,
  T,
  month,
}: {
  bike: BikeWallSummary;
  slug: string;
  T: ReturnType<typeof useCrewTokens>;
  /** null = all-time; "YYYY-MM" = month-scoped money/rental tiles. */
  month: string | null;
}) {
  const s = bike.stats;
  return (
    <Link
      href={`/franchize/${slug}/bikes/${encodeURIComponent(bike.bikeId)}`}
      className="group block overflow-hidden rounded-2xl border transition active:scale-[0.985]"
      style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}
    >
      {/* photo */}
      <div className="relative aspect-[16/10] w-full overflow-hidden" style={{ backgroundColor: T.bgElevated }}>
        {bike.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bike.image}
            alt={bike.label}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Bike className="h-10 w-10" style={{ color: T.textFaint }} />
          </div>
        )}
        {/* top badges */}
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
          {bike.onRentNow ? (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={T.styles.accentPill}>
              ● в аренде
            </span>
          ) : (
            <span />
          )}
          {bike.isPartnerBike ? (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={T.styles.accentBadge}>
              партнёр
            </span>
          ) : null}
        </div>
      </div>

      {/* body */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold leading-tight" style={{ color: T.text }}>
              {bike.label}
            </h3>
            <p className="mt-0.5 truncate text-xs" style={{ color: T.textMuted }}>
              {[bike.year, bike.plate, bike.engineType === "Electric" ? "электро" : bike.engineType === "ICE" ? "бензин" : null]
                .filter(Boolean)
                .join(" · ") || `${bike.dailyPrice ? formatMoney(bike.dailyPrice) + "/сутки" : "—"}`}
            </p>
          </div>
          <ChevronRight className="mt-1 h-4 w-4 shrink-0" style={{ color: T.textFaint }} />
        </div>

        {/* stats strip — month-scoped when a month is selected */}
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-xl px-1 py-2" style={{ backgroundColor: T.bgElevated }}>
            <p className="text-[13px] font-bold leading-none" style={{ color: T.accent }}>
              {formatMoney(month ? s.earnedThisMonth : s.earnedTotal)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: T.textMuted }}>
              {month ? `за ${monthLabelShort(month)}` : "выручка"}
            </p>
          </div>
          <div className="rounded-xl px-1 py-2" style={{ backgroundColor: T.bgElevated }}>
            <p className="text-[13px] font-bold leading-none" style={{ color: T.text }}>{month ? s.monthRentals : s.totalCount - s.cancelledCount}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: T.textMuted }}>{month ? "аренд · мес" : "аренд"}</p>
          </div>
          <div className="rounded-xl px-1 py-2" style={{ backgroundColor: T.bgElevated }}>
            <p className="text-[13px] font-bold leading-none" style={{ color: s.serviceCount > 0 ? T.text : T.textFaint }}>
              {s.serviceCount > 0 ? formatMoney(s.serviceTotal) : "—"}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: T.textMuted }}>сервис</p>
          </div>
        </div>

        {/* sub-line */}
        <div className="mt-2.5 flex items-center gap-3 text-[11px]" style={{ color: T.textFaint }}>
          <span className="inline-flex items-center gap-1">
            <HandCoins className="h-3 w-3" /> ср. чек {formatMoney(s.avgCheck)}
          </span>
          {s.serviceCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Wrench className="h-3 w-3" /> {s.serviceCount} сервис
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
