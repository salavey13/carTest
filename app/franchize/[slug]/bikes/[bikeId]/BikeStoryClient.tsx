"use client";

// /app/franchize/[slug]/bikes/[bikeId]/BikeStoryClient.tsx
// iter28 — the BIKE STORY: a VK-style wall of everything that happened to one
// bike. Rentals (with real photos from the rental-photos bucket), service
// work (metadata.bike linkage), money, odometer progression.
//
// Mobile-first: single column, full-bleed photo grids (VK 1/2/3/4+ rules),
// big touch targets, lightbox for photos.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Bike, CalendarDays, Camera, ChevronLeft,
  Gauge, HandCoins, RefreshCw, Wrench, X,
} from "lucide-react";
import { useAppContext } from "@/contexts/AppContext";
import { getBikeStoryAction } from "@/app/franchize/server-actions/bike-wall";
import {
  aspectStyle,
  coverPhoto,
  dateDividerLabel,
  formatKm,
  formatMoney,
  formatMskShort,
  formatRangeLabel,
  photoGridRecipe,
  statusMeta,
  type BikeWallSummary,
  type WallFeedItem,
  type WallPhoto,
} from "@/app/franchize/lib/bike-wall";
import { AnalyticsPasswordEntry } from "@/app/franchize/[slug]/rentals-analytics/analytics-components/AnalyticsPasswordEntry";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import type { FranchizeCrewVM } from "@/app/franchize/actions";

interface BikeStoryClientProps {
  initialSlug: string;
  initialBikeId: string;
  crew: FranchizeCrewVM;
}

export function BikeStoryClient({ initialSlug, initialBikeId, crew }: BikeStoryClientProps) {
  const { dbUser, isLoading: authLoading } = useAppContext();
  const params = useParams<{ slug: string; bikeId: string }>();
  const slug = initialSlug || params?.slug || "vip-bike";
  const bikeId = initialBikeId || params?.bikeId || "";

  const [showPasswordEntry, setShowPasswordEntry] = useState(false);
  const [passwordAuthOwnerId, setPasswordAuthOwnerId] = useState<string | null>(null);
  const [bike, setBike] = useState<BikeWallSummary | null>(null);
  const [feed, setFeed] = useState<WallFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: WallPhoto[]; index: number } | null>(null);

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

  const fetchStory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getBikeStoryAction({
        slug,
        bikeId,
        actorUserId: getActorUserId() || undefined,
        isPasswordAuth: !!passwordAuthOwnerId,
      });
      if (result.success && result.data) {
        setBike(result.data.bike);
        setFeed(result.data.feed);
      } else {
        setError(result.error || "Не удалось загрузить историю мото.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setIsLoading(false);
    }
  }, [slug, bikeId, getActorUserId, passwordAuthOwnerId]);

  useEffect(() => {
    if (!isAuthed || authLoading) return;
    void fetchStory();
  }, [isAuthed, authLoading, fetchStory]);

  const handlePasswordAuth = (ownerId: string | null) => {
    if (!ownerId) return;
    setPasswordAuthOwnerId(ownerId);
    setShowPasswordEntry(false);
  };

  // keyboard nav in lightbox
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : lb));
      if (e.key === "ArrowRight") setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : lb));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // date dividers between cards (VK wall)
  const divided = useMemo(() => {
    const out: Array<{ divider: string | null; item: WallFeedItem }> = [];
    let lastDivider = "";
    for (const item of feed) {
      const label = dateDividerLabel(item.start || item.createdAt);
      if (label && label !== lastDivider) {
        out.push({ divider: label, item });
        lastDivider = label;
      } else {
        out.push({ divider: null, item });
      }
    }
    return out;
  }, [feed]);

  if (showPasswordEntry) {
    return <AnalyticsPasswordEntry crewName={crew?.name || "Экипаж"} slug={slug} onAuthenticated={handlePasswordAuth} />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin" style={{ color: T.accent }} />
          <p className="text-sm" style={{ color: T.textMuted }}>Читаем историю мото...</p>
        </div>
      </div>
    );
  }

  if (error || !bike) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border p-6 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <p className="text-sm" style={{ color: T.text }}>{error || "Мото не найдено."}</p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link href={`/franchize/${slug}/bikes`} className="rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-85" style={T.styles.ctaSecondary}>
              В мотопарк
            </Link>
            <button onClick={() => void fetchStory()} className="rounded-xl px-4 py-2 text-sm font-semibold transition hover:opacity-85" style={T.styles.ctaPrimary}>
              Ещё раз
            </button>
          </div>
        </div>
      </div>
    );
  }

  const s = bike.stats;
  const rentalCount = s.totalCount - s.cancelledCount;
  const kpis: Array<{ label: string; value: string; accent?: boolean }> = [
    { label: "Заработал", value: formatMoney(s.earnedTotal), accent: true },
    { label: "Этот месяц", value: formatMoney(s.earnedThisMonth) },
    { label: "Аренд", value: String(rentalCount) },
    { label: "Ср. чек", value: formatMoney(s.avgCheck) },
    { label: "Дней в аренде", value: String(s.daysInRent) },
    { label: "Пробег по арендам", value: formatKm(s.distanceTotal) },
    { label: "Одометр", value: formatKm(s.odometerLatest) },
    { label: "Сервис", value: s.serviceCount > 0 ? `${formatMoney(s.serviceTotal)} · ${s.serviceCount}` : "—" },
  ];

  return (
    <div className="space-y-4">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
        <div className="relative aspect-[16/9] w-full overflow-hidden" style={{ backgroundColor: T.bgElevated }}>
          {bike.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bike.image} alt={bike.label} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Bike className="h-12 w-12" style={{ color: T.textFaint }} />
            </div>
          )}
          <Link
            href={`/franchize/${slug}/bikes`}
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur"
            style={{ backgroundColor: "rgba(15,15,15,0.55)", color: "#fff" }}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Мотопарк
          </Link>
          {bike.onRentNow ? (
            <span className="absolute right-2 top-2 rounded-full px-3 py-1.5 text-xs font-semibold" style={T.styles.accentPill}>
              ● в аренде
            </span>
          ) : null}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-bold sm:text-2xl" style={{ color: T.text }}>{bike.label}</h1>
            {bike.isPartnerBike ? (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={T.styles.accentBadge}>партнёрское мото</span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              bike.year && `${bike.year} год`,
              bike.plate && `№ ${bike.plate}`,
              bike.engineType === "Electric" ? "электро" : bike.engineType === "ICE" ? "бензин" : null,
              bike.dailyPrice ? `${formatMoney(bike.dailyPrice)}/сутки` : null,
              bike.vin && `VIN ${bike.vin.slice(-6)}`,
            ]
              .filter(Boolean)
              .map((chip, i) => (
                <span key={i} className="rounded-full px-2.5 py-1 text-[11px]" style={{ backgroundColor: T.bgElevated, color: T.textMuted }}>
                  {chip}
                </span>
              ))}
          </div>
        </div>
      </div>

      {/* ── KPI BAND (horizontal scroll on mobile) ────────────── */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2" style={{ minWidth: "max-content" }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-2xl border px-3.5 py-2.5" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard, minWidth: 108 }}>
              <p className="text-[15px] font-bold leading-tight" style={{ color: kpi.accent ? T.accent : T.text }}>{kpi.value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide" style={{ color: T.textMuted }}>{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── THE WALL ──────────────────────────────────────────── */}
      {feed.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
          <CalendarDays className="mx-auto h-8 w-8" style={{ color: T.textFaint }} />
          <p className="mt-3 text-sm" style={{ color: T.textMuted }}>История пуста — с этим мото ещё ничего не происходило.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {divided.map(({ divider, item }, idx) => (
            <div key={item.rentalId + String(idx)}>
              {divider ? (
                <div className="sticky top-0 z-10 -mx-1 mb-2 mt-1 px-1 py-1">
                  <span
                    className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold backdrop-blur"
                    style={{ backgroundColor: T.isAuto ? "color-mix(in srgb, var(--franchize-shell-card) 82%, transparent)" : T.bgCard, color: T.textMuted }}
                  >
                    {divider}
                  </span>
                </div>
              ) : null}
              {item.kind === "service" ? (
                <ServiceCard item={item} slug={slug} T={T} />
              ) : (
                <RentalCard item={item} slug={slug} T={T} onOpenPhoto={(photos, index) => setLightbox({ photos, index })} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── LIGHTBOX ──────────────────────────────────────────── */}
      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            className="absolute right-3 top-3 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
          {lightbox.photos.length > 1 ? (
            <>
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((lb) => (lb ? { ...lb, index: (lb.index - 1 + lb.photos.length) % lb.photos.length } : lb));
                }}
                aria-label="Предыдущее фото"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((lb) => (lb ? { ...lb, index: (lb.index + 1) % lb.photos.length } : lb));
                }}
                aria-label="Следующее фото"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
          <div className="flex max-h-full w-full flex-col items-center justify-center px-12" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.photos[lightbox.index].url}
              alt={`Фото ${lightbox.index + 1} из ${lightbox.photos.length}`}
              className="max-h-[78vh] w-auto max-w-full rounded-lg object-contain"
            />
            <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-1">
                <Camera className="h-3.5 w-3.5" />
                {lightbox.photos[lightbox.index].photoType === "start" ? "ДО выдачи" : "ПОСЛЕ возврата"} · {lightbox.index + 1}/{lightbox.photos.length}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Rental card ───────────────────────────────────────────────────────────────

function RentalCard({
  item,
  slug,
  T,
  onOpenPhoto,
}: {
  item: WallFeedItem;
  slug: string;
  T: ReturnType<typeof useCrewTokens>;
  onOpenPhoto: (photos: WallPhoto[], index: number) => void;
}) {
  const meta = statusMeta(item.status);
  const isCancelled = item.status === "cancelled";
  const grid = photoGridRecipe(item.photos.length);
  const cover = coverPhoto(item.photos);

  const toneColor =
    meta.tone === "positive" ? "#22c55e"
    : meta.tone === "accent" ? T.accent
    : meta.tone === "warning" ? "#f59e0b"
    : meta.tone === "danger" ? "#ef4444"
    : T.textFaint;

  return (
    <article
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard, opacity: isCancelled ? 0.62 : 1 }}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: toneColor }} />
          <h3 className="truncate text-[15px] font-semibold" style={{ color: T.text, textDecoration: isCancelled ? "line-through" : "none" }}>
            {item.renterName}
          </h3>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color: toneColor,
            backgroundColor: `color-mix(in srgb, ${toneColor} 14%, transparent)`,
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* date + range */}
      <p className="px-3.5 pt-1.5 text-xs" style={{ color: T.textMuted }}>
        {formatRangeLabel(item.start, item.end)}
      </p>

      {/* money row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5">
        <span className="inline-flex items-center gap-1.5 text-[15px] font-bold" style={{ color: isCancelled ? T.textFaint : T.accent }}>
          <HandCoins className="h-4 w-4" />
          {item.totalCost > 0 ? formatMoney(item.totalCost) : "цена не указана"}
        </span>
        {item.partnerRub > 0 ? (
          <span className="text-xs" style={{ color: T.textMuted }}>
            партнёру {formatMoney(item.partnerRub)} · компании {formatMoney(item.companyRub)}
          </span>
        ) : null}
        {item.depositAmount > 0 ? (
          <span className="text-xs" style={{ color: T.textMuted }}>
            залог {formatMoney(item.depositAmount)}
            {item.depositReturned ? " · возвращён" : item.status === "completed" ? " · не возвращён" : ""}
          </span>
        ) : null}
      </div>

      {/* odometer + equipment */}
      {(item.odometerAfter != null || item.equipment.length > 0 || item.odometerDelta > 0) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 px-3.5">
          {item.odometerAfter != null ? (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]" style={{ backgroundColor: T.bgElevated, color: T.textMuted }}>
              <Gauge className="h-3 w-3" />
              {item.odometerBefore != null ? `${item.odometerBefore.toLocaleString("ru-RU")} → ` : ""}
              {item.odometerAfter.toLocaleString("ru-RU")} км
              {item.odometerDelta > 0 ? ` (+${item.odometerDelta.toLocaleString("ru-RU")})` : ""}
            </span>
          ) : null}
          {item.equipment.map((eq) => (
            <span key={eq.label} className="rounded-full px-2.5 py-1 text-[11px]" style={{ backgroundColor: T.bgElevated, color: T.textMuted }}>
              {eq.label}{eq.count > 1 ? ` ×${eq.count}` : ""}
            </span>
          ))}
        </div>
      )}

      {/* operator line */}
      {item.operatorName ? (
        <p className="px-3.5 pt-2 text-[11px]" style={{ color: T.textFaint }}>оператор: {item.operatorName}</p>
      ) : null}

      {/* photo grid — VK attachment rules */}
      {item.photos.length > 0 && grid.visible > 0 ? (
        <div className={`mt-3 ${grid.className}`} onClick={() => onOpenPhoto(item.photos, 0)}>
          {item.photos.slice(0, grid.visible).map((photo, i) => {
            const isLast = i === grid.visible - 1;
            return (
              <button
                key={photo.photoId}
                type="button"
                className="relative overflow-hidden"
                style={{ backgroundColor: T.bgElevated, aspectRatio: item.photos.length === 1 ? undefined : "1 / 1" }}
                onClick={(e) => { e.stopPropagation(); onOpenPhoto(item.photos, i); }}
                aria-label={`Фото ${i + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.photoType === "start" ? "Фото до выдачи" : "Фото после возврата"}
                  loading="lazy"
                  className="h-full w-full object-cover"
                  style={item.photos.length === 1 ? { ...aspectStyle(photo.width, photo.height), width: "100%" } : undefined}
                />
                {isLast && grid.overflow > 0 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold text-white">
                    +{grid.overflow}
                  </span>
                ) : null}
                {item.photos.length > 1 && i === 0 && photo.photoType === "start" ? (
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">ДО</span>
                ) : null}
                {item.photos.length > 1 && photo.photoType === "end" && (isLast || item.photos.length <= 4) ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">ПОСЛЕ</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : cover ? null : null}

      {/* footer link */}
      <Link
        href={`/franchize/${slug}/rental/${item.rentalId}`}
        className="flex items-center justify-between border-t px-3.5 py-2.5 text-xs font-medium transition active:opacity-70"
        style={{ borderColor: T.borderSoft, color: T.accent }}
      >
        <span>{isCancelled ? "Отменённая аренда · детали" : "Открыть аренду · договор, фото, чек"}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

// ── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({
  item,
  T,
}: {
  item: WallFeedItem;
  slug: string;
  T: ReturnType<typeof useCrewTokens>;
}) {
  const svc = item.service;
  if (!svc) return null;
  return (
    <article className="rounded-2xl border px-3.5 py-3" style={{ borderColor: T.borderSoft, backgroundColor: T.bgCard }}>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `color-mix(in srgb, ${T.accent} 12%, transparent)`, color: T.accent }}
        >
          <Wrench className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold leading-snug" style={{ color: T.text }}>{svc.serviceName}</h3>
            <span className="shrink-0 text-[14px] font-bold" style={{ color: T.text }}>
              {svc.cost > 0 ? formatMoney(svc.cost) : "—"}
            </span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: T.textFaint }}>
            Сервисная работа{svc.masterName ? ` · ${svc.masterName}` : ""} · {formatMskShort(svc.performedAt)}
          </p>
        </div>
      </div>
    </article>
  );
}
