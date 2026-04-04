"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { crewPaletteForSurface } from "../lib/theme";

interface ItemModalProps {
  item: CatalogItemVM | null;
  theme: FranchizeTheme;
  options: {
    package: string;
    duration: string;
    perk: string;
    auction: string;
  };
  auctionOptions: string[];
  onChangeOption: (key: "package" | "duration" | "perk" | "auction", value: string) => void;
  onClose: () => void;
  onAddToCart: () => void;
}

const packageOptions = ["Базовый", "Комфорт", "Максимум"];
const durationOptions = ["1 день", "3 дня", "7 дней"];
const perkOptions = ["Стандарт", "Шлем + GoPro", "Полный комплект"];

// Helper to safely type CSS custom properties
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
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[var(--item-muted-text)]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option === selected;
          return (
            <button
              key={option}
              type="button"
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

// Extracted Gallery Component
// Note: If you have a shared Gallery component in your project, you can replace this with it.
interface ItemGalleryProps {
  images: string[];
  activeIndex: number;
  onNavigate: (direction: -1 | 1) => void;
  onSelect: (index: number) => void;
  altText: string;
  borderColor: string;
  accentColor: string;
  bgColor: string;
}

function ItemGallery({ images, activeIndex, onNavigate, onSelect, altText, borderColor, accentColor, bgColor }: ItemGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm" style={{ color: "var(--item-muted-text)" }}>
        Изображение байка скоро загрузим
      </div>
    );
  }

  return (
    <>
      <div className="relative aspect-[16/11] w-full bg-black/25 sm:aspect-[16/9] lg:aspect-[2.15/1]">
        <Image src={images[activeIndex]} alt={`${altText} ${activeIndex + 1}`} fill sizes="(max-width: 1024px) 100vw, 42vw" className="object-cover" unoptimized />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => onNavigate(-1)}
              className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Предыдущее фото"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate(1)}
              className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="Следующее фото"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur-sm select-none pointer-events-none">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="border-t px-3 pb-3 pt-3 sm:px-4" style={{ borderColor, backgroundColor: bgColor }}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {images.map((url, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={`${url}-${index}`}
                  type="button"
                  onClick={() => onSelect(index)}
                  aria-pressed={active}
                  className={`relative aspect-[5/4] w-full overflow-hidden rounded-2xl border transition ${active ? "scale-[0.98] opacity-100" : "opacity-85 hover:opacity-100"}`}
                  style={{
                    borderColor: active ? accentColor : borderColor,
                    boxShadow: active ? `0 0 0 2px ${bgColor}, 0 0 0 4px ${accentColor}` : "none",
                  }}
                >
                  <Image src={url} alt={`${altText} ${index + 1}`} fill sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 120px" className="object-cover" unoptimized />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

export function ItemModal({ item, theme, options, auctionOptions, onChangeOption, onClose, onAddToCart }: ItemModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

  // Memoize expensive/derived values
  const gallery = useMemo(() => {
    if (!item) return [];
    const urls = item.mediaUrls?.length ? item.mediaUrls : item.imageUrl ? [item.imageUrl] : [];
    return Array.from(new Set(urls.filter(Boolean) as string[]));
  }, [item?.mediaUrls, item?.imageUrl]);

  const descriptionText = useMemo(() => {
    return item?.description || "Этот байк уже подготовлен к аренде: технический чек выполнен, документы готовы, выдача без очереди.";
  }, [item?.description]);

  const surface = useMemo(() => crewPaletteForSurface(theme), [theme]);
  const themeVars = useMemo(() => getModalThemeVars(theme), [theme]);

  // Reset internal state when item changes
  useEffect(() => {
    setDescriptionExpanded(false);
    setActiveMediaIndex(0);
  }, [item?.id]);

  // Focus management, Escape key, Body scroll lock, Keyboard gallery nav
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
      }
      if (gallery.length > 1) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setActiveMediaIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setActiveMediaIndex((prev) => (prev + 1) % gallery.length);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Focus trap target
    modalRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [item, gallery.length, onClose]);

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
    [isAdding, onAddToCart]
  );

  const changeMedia = useCallback(
    (direction: -1 | 1) => {
      setActiveMediaIndex((prev) => (prev + direction + gallery.length) % gallery.length);
    },
    [gallery.length]
  );

  if (!item) return null;

  const fallbackSpecs = [
    { label: "Категория", value: item.category },
    { label: "Тариф", value: `${item.pricePerDay.toLocaleString("ru-RU")} ₽ / день` },
    { label: "Статус", value: "Готов к выдаче" },
  ];

  const normalizedSpecs = item.specs.length > 0 ? item.specs : fallbackSpecs;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-hidden bg-black/60 p-2 pb-4 outline-none sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={`item-modal-title-${item.id}`}
      tabIndex={-1}
      style={themeVars}
    >
      <div className="mt-2 flex w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-[1.75rem] border shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:my-auto sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-3xl lg:max-h-[88vh] max-h-[calc(100dvh-2rem)]" style={surface.card}>
        {/* Header / Gallery */}
        <div className="relative flex w-full shrink-0 flex-col border-b" style={{ borderColor: theme.palette.borderSoft }}>
          <ItemGallery
            images={gallery}
            activeIndex={activeMediaIndex}
            onNavigate={changeMedia}
            onSelect={setActiveMediaIndex}
            altText={item.title}
            borderColor={theme.palette.borderSoft}
            accentColor={theme.palette.accentMain}
            bgColor={theme.palette.bgBase}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] [touch-action:pan-y] sm:p-5">
            <div>
              <h3 id={`item-modal-title-${item.id}`} className="text-lg font-semibold sm:text-xl">{item.title}</h3>
              <p className="text-sm" style={surface.mutedText}>{item.subtitle}</p>
              <p className={`mt-2 text-sm leading-6 ${descriptionExpanded ? "" : "line-clamp-4"}`} style={surface.mutedText}>
                {descriptionText}
              </p>
              {descriptionText.length > 200 && (
                <button
                  type="button"
                  className="mt-1 text-sm font-medium text-[var(--item-accent)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
                  onClick={() => setDescriptionExpanded((prev) => !prev)}
                >
                  {descriptionExpanded ? "Скрыть" : "Показать ещё..."}
                </button>
              )}
            </div>

            <div className="rounded-2xl border p-3 text-xs" style={surface.subtleCard}>
              <p className="inline-flex items-center gap-1 font-medium text-[var(--item-accent)]">
                <Info className="h-3.5 w-3.5" /> Характеристики и условия
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2" style={surface.mutedText}>
                {normalizedSpecs.map((spec) => (
                  <div key={`${spec.label}-${spec.value}`} className="min-w-0 rounded-lg border px-2.5 py-2" style={surface.subtleCard}>
                    <p className="text-[10px] uppercase tracking-[0.08em]">{spec.label}</p>
                    <p className="mt-1 break-words text-sm text-[var(--item-text)]">{spec.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <OptionChips title="Пакет" options={packageOptions} selected={options.package} onSelect={(v) => onChangeOption("package", v)} />
            <OptionChips title="Срок" options={durationOptions} selected={options.duration} onSelect={(v) => onChangeOption("duration", v)} />
            <OptionChips title="Комплект" options={perkOptions} selected={options.perk} onSelect={(v) => onChangeOption("perk", v)} />
            <OptionChips title="Аукцион / тик" options={auctionOptions} selected={options.auction} onSelect={(v) => onChangeOption("auction", v)} />
          </div>

          {/* Footer */}
          <div className="grid shrink-0 grid-cols-1 gap-2 border-t p-3 sm:grid-cols-2" style={{ ...surface.card, borderColor: theme.palette.borderSoft }}>
            <button type="button" onClick={onClose} className="rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-90 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]" style={surface.subtleCard}>
              Закрыть
            </button>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAdding}
              className="rounded-xl bg-[var(--item-accent)] px-3 py-2 text-sm font-semibold text-[var(--item-accent-contrast)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
            >
              {isAdding ? "Добавляем..." : `Добавить • ${item.pricePerDay.toLocaleString("ru-RU")} ₽`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}