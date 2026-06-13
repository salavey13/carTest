"use client";

import { Calendar, Info, Swords, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { hasRentPrice, hasSalePrice, ruPluralDays } from "../lib/catalog-utils";
import {
  CATALOG_VS_SPECS,
  VsSpecRow,
  getCatalogVsSpecValue,
} from "@/components/franchize/VsSpecRow";
import {
  getCatalogPropulsionLabel,
  getCatalogPropulsionSegment,
  isSameCatalogPropulsion,
} from "@/app/franchize/lib/catalog-propulsion";
import { ItemGallery } from "../components/ItemGallery";
import { buildCatalogRentalStrip } from "../lib/catalog-rental-strip";
import { crewPaletteForSurface } from "../lib/theme";
import { FRANCHIZE_MODAL_CLOSE_SAFE_AREA_STYLE } from "../lib/route-cta-policy";

// ─────────────────────────────────────────────────────
// Item Modal — generalized for rental & order flows
// ─────────────────────────────────────────────────────
// flowType controls which sections appear:
//   "rental" → full rental UI (packages, duration, perks, auction,
//              rental strip, deposit/tariff info, "Забронировать" CTA)
//   "order"  → order-only UI (no rental options, simple "Выбрать" CTA,
//              no rental strip, no deposit info)
//
// Default is "rental" for backward compatibility with vip-bike.
// ─────────────────────────────────────────────────────

export type FlowType = "rental" | "order";

interface ItemModalProps {
  item: CatalogItemVM | null;
  items: CatalogItemVM[];
  slug: string;
  theme: FranchizeTheme;
  pickupAddress?: string;
  workingHours?: string;
  /** Crew business flow type — "rental" shows rental options, "order" hides them */
  flowType?: FlowType;
  options: {
    package: string;
    duration: string;
    perk: string;
    auction: string;
    /** Rental start date (ISO string yyyy-MM-dd) */
    rentStartDate?: string;
    /** Rental end date (ISO string yyyy-MM-dd) */
    rentEndDate?: string;
  };
  auctionOptions: string[];
  onChangeOption: (
    key: "package" | "duration" | "perk" | "auction" | "rentStartDate" | "rentEndDate",
    value: string,
  ) => void;
  onClose: () => void;
  onAddToCart: () => void | Promise<void>;
  /** Called when "Купить" (buy) CTA is clicked for sale-only flow */
  onBuyItem?: () => void | Promise<void>;
}

const packageOptions = ["Базовый", "Комфорт", "Максимум"];
const durationOptions = ["1 день", "3 дня", "7 дней"];
const perkOptions = ["Стандарт", "Шлем + GoPro", "Полный комплект"];
const modalFocusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const getModalThemeVars = (theme: FranchizeTheme) =>
  ({
    "--item-accent": theme.palette.accentMain,
    "--item-border": theme.palette.borderSoft,
    "--item-muted-text": theme.palette.textSecondary,
    "--item-text": theme.palette.textPrimary,
    "--item-accent-contrast": "#16130A",
  }) as React.CSSProperties;

function OptionChips({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--item-muted-text)]">
        {title}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={title}>
        {options.map((option) => {
          const isActive = option === selected;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(option)}
              className={`rounded-full border px-3 py-1.5 text-xs transition hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)] ${
                isActive
                  ? "border-[var(--item-accent)] bg-[var(--item-accent)] text-[var(--item-accent-contrast)]"
                  : "border-[var(--item-border)] text-[var(--item-text)]"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Date picker row for rental start/end dates */
function RentalDatePickers({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  borderColor,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  borderColor: string;
}) {
  // Compute min date: today (computed inline to avoid stale memo after midnight)
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // End date min = start date (or today if no start)
  const endMin = startDate || today;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/15 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-[var(--item-muted-text)]">
        <Calendar className="h-3.5 w-3.5" />
        Даты аренды
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[var(--item-muted-text)]">
            Дата начала
          </label>
          <input
            type="date"
            value={startDate}
            min={today}
            onChange={(e) => onStartChange(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-2 text-sm text-[var(--item-text)] transition focus:outline-none focus:ring-2 focus:ring-[var(--item-accent)]"
            style={{
              backgroundColor: "rgba(0,0,0,0.25)",
              borderColor,
              colorScheme: "dark",
            }}
            aria-label="Дата начала аренды"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[var(--item-muted-text)]">
            Дата окончания
          </label>
          <input
            type="date"
            value={endDate}
            min={endMin}
            onChange={(e) => onEndChange(e.target.value)}
            className="w-full rounded-lg border px-2.5 py-2 text-sm text-[var(--item-text)] transition focus:outline-none focus:ring-2 focus:ring-[var(--item-accent)]"
            style={{
              backgroundColor: "rgba(0,0,0,0.25)",
              borderColor,
              colorScheme: "dark",
            }}
            aria-label="Дата окончания аренды"
          />
        </div>
      </div>
      {/* Quick duration hint */}
      {startDate && endDate && (
        <p className="mt-2 text-[11px] text-[var(--item-muted-text)]">
          {(() => {
            // Parse as local midnight to avoid UTC vs local off-by-one
            const start = new Date(startDate + "T00:00:00");
            const end = new Date(endDate + "T00:00:00");
            const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
            return `${days} ${ruPluralDays(days)} аренды`;
          })()}
        </p>
      )}
    </div>
  );
}

export function ItemModal({
  item,
  items,
  slug,
  theme,
  pickupAddress = "",
  workingHours = "",
  flowType = "rental",
  options,
  auctionOptions,
  onChangeOption,
  onClose,
  onAddToCart,
  onBuyItem,
}: ItemModalProps) {
  const isRental = flowType === "rental";
  const modalRef = useRef<HTMLDivElement>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [vsBike, setVsBike] = useState<CatalogItemVM | null>(null);

  // Determine which CTAs to show (safe optional chaining — item may be null during close transition)
  const showRentCta = isRental && (item ? hasRentPrice(item) : false);
  const showBuyCta = item?.saleAvailable === true;

  const gallery = useMemo(() => {
    if (!item) return [];
    const urls = item.mediaUrls?.length
      ? item.mediaUrls
      : item.imageUrl
        ? [item.imageUrl]
        : [];
    return Array.from(new Set(urls.filter(Boolean) as string[]));
  }, [item]);

  const descriptionText = useMemo(() => {
    if (item?.description) return item.description;
    // Generalized fallback — no bike-specific language
    return isRental
      ? "Позиция готова к аренде: технический чек выполнен, документы готовы, выдача без очереди."
      : "Позиция доступна для заказа. Оставьте заявку, и менеджер свяжется с вами для уточнения деталей.";
  }, [item?.description, isRental]);

  const surface = useMemo(() => crewPaletteForSurface(theme), [theme]);
  const themeVars = useMemo(() => getModalThemeVars(theme), [theme]);

  useEffect(() => {
    setDescriptionExpanded(false);
    setActiveMediaIndex(0);
    setVsBike(null);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;

    const originalOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>(modalFocusableSelector) ?? [])
        .filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusable.length === 0) {
        e.preventDefault();
        modalRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const focusDialog = window.requestAnimationFrame(() => modalRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [item, onClose]);

  const handleAddToCart = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isAdding) return;

      setIsAdding(true);
      try {
        const result = onAddToCart();
        if (result instanceof Promise) {
          result.finally(() => setIsAdding(false));
        } else {
          setIsAdding(false);
        }
      } catch {
        setIsAdding(false);
      }
    },
    [isAdding, onAddToCart],
  );

  const handleBuyItem = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (isBuying) return;

      setIsBuying(true);
      try {
        const result = onBuyItem?.();
        if (result instanceof Promise) {
          result.finally(() => setIsBuying(false));
        } else {
          setIsBuying(false);
        }
      } catch {
        setIsBuying(false);
      }
    },
    [isBuying, onBuyItem],
  );

  const changeMedia = useCallback(
    (direction: -1 | 1) => {
      setActiveMediaIndex(
        (prev) => (prev + direction + gallery.length) % gallery.length,
      );
    },
    [gallery.length],
  );

  const propulsionSegment = useMemo(
    () => (item ? getCatalogPropulsionSegment(item) : "unknown"),
    [item],
  );
  const propulsionLabel = getCatalogPropulsionLabel(propulsionSegment);

  const rentalStrip = useMemo(() => {
    if (!item || !isRental) return null;
    return buildCatalogRentalStrip(item, {
      hqLocation: pickupAddress,
      contacts: { address: pickupAddress, workingHours },
    });
  }, [item, isRental, pickupAddress, workingHours]);

  const comparableBikes = useMemo(() => {
    if (!item) return [];
    return items
      .filter(
        (candidate) =>
          candidate.id !== item.id &&
          candidate.availabilityStatus === "available" &&
          isSameCatalogPropulsion(item, candidate),
      )
      .slice(0, 6);
  }, [item, items]);

  if (!item) return null;

  // Generalized fallback specs — rental vs order
  const fallbackSpecs = isRental
    ? [
        { label: "Категория", value: item.category },
        { label: "Тариф аренды", value: item.rentPriceLabel },
        ...(item.saleAvailable && item.salePrice
          ? [
              {
                label: "Цена покупки",
                value: `${item.salePrice.toLocaleString("ru-RU")} ₽`,
              },
            ]
          : []),
        { label: "Статус", value: "Готов к выдаче" },
      ]
    : [
        { label: "Категория", value: item.category },
        ...(item.salePrice
          ? [
              {
                label: "Цена",
                value: `${item.salePrice.toLocaleString("ru-RU")} ₽`,
              },
            ]
          : []),
        { label: "Статус", value: "Доступно для заказа" },
      ];

  const normalizedSpecs = item.specs.length > 0 ? item.specs : fallbackSpecs;

  // ── CTA label logic ──
  // When both rent + sale are available, we show two separate buttons.
  // When only one is available, we show a single CTA.
  const rentCtaLabel = isAdding ? "Бронируем..." : "Забронировать";
  const buyCtaLabel = isBuying ? "Покупаем..." : "Купить";
  const singleCtaLabel = isAdding
    ? "Добавляем..."
    : showRentCta
      ? rentCtaLabel
      : "Выбрать";

  // Determine footer grid layout
  const footerCols = showRentCta && showBuyCta ? 3 : 2;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/60 p-2 pb-4 outline-none sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`item-modal-title-${item.id}`}
      aria-describedby={`item-modal-description-${item.id}`}
      tabIndex={-1}
      style={themeVars}
    >
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:my-auto sm:rounded-3xl max-h-[calc(100dvh-1.5rem)]"
        style={surface.card}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
          {/* Quick Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
            style={FRANCHIZE_MODAL_CLOSE_SAFE_AREA_STYLE}
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Gallery Component — rentalbikes-style portrait hero */}
          <ItemGallery
            images={gallery}
            activeIndex={activeMediaIndex}
            onNavigate={changeMedia}
            onSelect={setActiveMediaIndex}
            altText={item.title}
            borderColor={theme.palette.borderSoft}
            accentColor={theme.palette.accentMain}
            bgColor={theme.palette.bgBase}
            mainAspectRatio="16/11"
            disableKeyboardNav={false}
          />

          {/* Content — rentalbikes-inspired layout */}
          <div className="space-y-4 p-4 sm:p-5">
            {/* Title + characteristics row (rentalbikes-style) */}
            <div>
              <h3
                id={`item-modal-title-${item.id}`}
                className="text-lg font-bold sm:text-xl"
              >
                {item.title}
              </h3>
              <p className="text-sm" style={surface.mutedText}>
                {item.subtitle}
              </p>

              {/* Spec chips row — rentalbikes-style inline icons (speed, engine, weight) */}
              {normalizedSpecs.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {normalizedSpecs.slice(0, 4).map((spec) => (
                    <span
                      key={`${spec.label}-${spec.value}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-[var(--item-accent)]"
                    >
                      <span className="text-[10px] opacity-70">{spec.label}</span>
                      <span className="text-white">{spec.value}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Availability badge + sale badge */}
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold ${
                    rentalStrip?.isAvailable ?? item.availabilityStatus === "available"
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                      : "border-amber-400/40 bg-amber-500/15 text-amber-200"
                  }`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${rentalStrip?.isAvailable ?? item.availabilityStatus === "available" ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {isRental
                    ? `Сегодня: ${rentalStrip?.todayLabel ?? "Уточним в Telegram"}`
                    : item.availabilityStatus === "available"
                      ? "Доступно для заказа"
                      : "Уточните наличие"}
                </span>
                {item.saleAvailable && (
                  <span className="inline-flex rounded-full border border-amber-300/60 bg-amber-400/20 px-2.5 py-1 font-semibold text-amber-100">
                    {isRental ? "Аренда + покупка" : "Доступно к покупке"}
                  </span>
                )}
              </div>
            </div>

            {/* Rental strip — only for rental flow */}
            {isRental && rentalStrip ? (
              <div
                className="grid gap-2 rounded-2xl border border-white/10 bg-black/15 p-3 text-xs sm:grid-cols-3"
                aria-label={`Быстрая аренда ${item.title}`}
              >
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--item-muted-text)]">Ближайшее окно</p>
                  <p className="mt-1 font-semibold text-[var(--item-text)]">{rentalStrip.nearestStartWindow}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--item-muted-text)]">Выдача</p>
                  <p className="mt-1 font-semibold text-[var(--item-text)]">{rentalStrip.pickupHint}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--item-muted-text)]">Залог / тариф</p>
                  <p className="mt-1 font-semibold text-[var(--item-text)]">{rentalStrip.priceTeaser}</p>
                </div>
              </div>
            ) : null}

              <p
                id={`item-modal-description-${item.id}`}
                className={`mt-2 text-sm leading-6 ${descriptionExpanded ? "" : "line-clamp-4"}`}
                style={surface.mutedText}
              >
                {descriptionText}
              </p>
              {descriptionText.length > 200 && (
                <button
                  type="button"
                  className="mt-1 text-sm font-medium text-[var(--item-accent)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                  aria-expanded={descriptionExpanded}
                  aria-controls={`item-modal-description-${item.id}`}
                  onClick={() => setDescriptionExpanded((prev) => !prev)}
                >
                  {descriptionExpanded ? "Скрыть" : "Показать ещё..."}
                </button>
              )}

            {/* Full specs grid — rentalbikes-style dark cards */}
            <div
              className="rounded-2xl border p-3 text-xs"
              style={surface.subtleCard}
            >
              <p className="inline-flex items-center gap-1 font-medium text-[var(--item-accent)]">
                <Info className="h-3.5 w-3.5" /> Характеристики{isRental ? " и условия" : ""}
              </p>
              <div
                className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2"
                style={surface.mutedText}
              >
                {normalizedSpecs.map((spec) => (
                  <div
                    key={`${spec.label}-${spec.value}`}
                    className="min-w-0 rounded-lg border px-2.5 py-2"
                    style={surface.subtleCard}
                  >
                    <p className="text-[10px] uppercase tracking-[0.08em]">
                      {spec.label}
                    </p>
                    <p className="mt-1 break-words text-sm text-[var(--item-text)]">
                      {spec.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {item.reviewSummary.count > 0 && (
              <section
                className="rounded-2xl border p-3"
                style={surface.subtleCard}
                aria-label={isRental ? "Отзывы арендаторов" : "Отзывы"}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--item-text)]">Отзывы</p>
                  <span className="rounded-full bg-[var(--item-accent)] px-2.5 py-1 text-xs font-bold text-[var(--item-accent-contrast)]">
                    ★ {item.reviewSummary.average.toFixed(1)} · {item.reviewSummary.count}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {item.reviewSummary.reviews.slice(0, 6).map((review) => (
                    <article key={review.id} className="rounded-xl border px-3 py-2" style={surface.subtleCard}>
                      <p className="text-xs font-semibold text-[var(--item-accent)]">{`★`.repeat(review.rating)}<span className="text-[var(--item-muted-text)]"> / 5</span></p>
                      {review.text && <p className="mt-1 text-sm leading-5" style={surface.mutedText}>{review.text}</p>}
                    </article>
                  ))}
                </div>
              </section>
            )}

            {item.saleAvailable && (
              <Link
                href={`/franchize/${slug}/market/${item.id}/buy`}
                className="inline-flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                aria-label={`Открыть страницу покупки ${item.title}`}
                style={surface.subtleCard}
              >
                Открыть страницу покупки
              </Link>
            )}

            {/* ── Rental-only options (hidden for order flow) ── */}
            {isRental && (
              <>
                {/* ── Date picker for rental dates ── */}
                <RentalDatePickers
                  startDate={options.rentStartDate ?? ""}
                  endDate={options.rentEndDate ?? ""}
                  onStartChange={(v) => onChangeOption("rentStartDate", v)}
                  onEndChange={(v) => onChangeOption("rentEndDate", v)}
                  borderColor={theme.palette.borderSoft}
                />

                <OptionChips
                  title="Пакет"
                  options={packageOptions}
                  selected={options.package}
                  onSelect={(v) => onChangeOption("package", v)}
                />
                <OptionChips
                  title="Срок"
                  options={durationOptions}
                  selected={options.duration}
                  onSelect={(v) => onChangeOption("duration", v)}
                />
                <OptionChips
                  title="Комплект"
                  options={perkOptions}
                  selected={options.perk}
                  onSelect={(v) => onChangeOption("perk", v)}
                />
                <OptionChips
                  title="Аукцион / тик"
                  options={auctionOptions}
                  selected={options.auction}
                  onSelect={(v) => onChangeOption("auction", v)}
                />
              </>
            )}

            {comparableBikes.length ? (
              <details
                className="rounded-2xl border p-3"
                style={surface.subtleCard}
              >
                <summary className="cursor-pointer list-none text-sm font-semibold">
                  Сравнить с другой моделью
                  <span className="ml-2 text-xs font-normal opacity-60">
                    {propulsionLabel}
                  </span>
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {comparableBikes.map((bike) => (
                    <button
                      key={bike.id}
                      type="button"
                      onClick={() => setVsBike(bike)}
                      aria-pressed={vsBike?.id === bike.id}
                      className="rounded-xl border p-2 text-left text-xs transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                      style={surface.subtleCard}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="line-clamp-2">{bike.title}</span>
                        <Swords className="h-3.5 w-3.5 shrink-0" />
                      </span>
                    </button>
                  ))}
                </div>
                {vsBike ? (
                  <div
                    className="mt-3 rounded-2xl border border-white/10 p-3"
                    style={surface.subtleCard}
                  >
                    <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-xs font-semibold">
                      <span>
                        {item.title}
                        <span className="mt-0.5 block text-[10px] uppercase tracking-[0.12em] opacity-55">
                          {propulsionLabel}
                        </span>
                      </span>
                      <Swords className="h-5 w-5 text-[var(--item-accent)]" />
                      <span>{vsBike.title}</span>
                    </div>
                    <div className="space-y-2">
                      {CATALOG_VS_SPECS.map((spec) => (
                        <VsSpecRow
                          key={spec.label}
                          label={spec.label}
                          valueA={getCatalogVsSpecValue(
                            item.rawSpecs,
                            spec.keys,
                          )}
                          valueB={getCatalogVsSpecValue(
                            vsBike.rawSpecs,
                            spec.keys,
                          )}
                          unit={spec.unit}
                          lowerIsBetter={spec.lowerIsBetter}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </details>
            ) : null}
          </div>

          {/* Footer Buttons — dual CTA when both rent + sale available */}
          <div
            className={`grid shrink-0 gap-2 border-t p-3 grid-cols-2 ${footerCols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            style={{ ...surface.card, borderColor: theme.palette.borderSoft }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть карточку товара"
              className="rounded-xl border-2 border-white/20 px-3 py-2 text-sm font-medium transition hover:border-white/40 hover:opacity-90 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
              style={surface.subtleCard}
            >
              Закрыть
            </button>

            {/* Rent CTA — shown when item has rental pricing */}
            {showRentCta && (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAdding}
                aria-busy={isAdding}
                aria-label="Забронировать аренду"
                className="rounded-xl border-2 border-[var(--item-accent)] bg-[var(--item-accent)] px-3 py-2 text-sm font-bold uppercase tracking-[0.04em] text-[var(--item-accent-contrast)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
              >
                {rentCtaLabel}
              </button>
            )}

            {/* Buy CTA — shown when item is available for sale */}
            {showBuyCta && (
              <button
                type="button"
                onClick={handleBuyItem}
                disabled={isBuying}
                aria-busy={isBuying}
                aria-label="Купить"
                className={`rounded-xl border-2 px-3 py-2 text-sm font-bold uppercase tracking-[0.04em] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)] ${
                  showRentCta
                    ? "border-[var(--item-accent)] text-[var(--item-accent)] hover:bg-[var(--item-accent)] hover:text-[var(--item-accent-contrast)]"
                    : "border-[var(--item-accent)] bg-[var(--item-accent)] text-[var(--item-accent-contrast)]"
                }`}
              >
                {buyCtaLabel}
              </button>
            )}

            {/* Fallback CTA — when neither rent nor sale is flagged */}
            {!showRentCta && !showBuyCta && (
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isAdding}
                aria-busy={isAdding}
                className="rounded-xl border-2 border-[var(--item-accent)] bg-[var(--item-accent)] px-3 py-2 text-sm font-bold uppercase tracking-[0.04em] text-[var(--item-accent-contrast)] transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
              >
                {singleCtaLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}