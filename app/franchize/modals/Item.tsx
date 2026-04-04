"use client";

import { Info, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { ItemGallery } from "../components/ItemGallery";
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

export function ItemModal({ item, theme, options, auctionOptions, onChangeOption, onClose, onAddToCart }: ItemModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);

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

  useEffect(() => {
    setDescriptionExpanded(false);
    setActiveMediaIndex(0);
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
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    modalRef.current?.focus();

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
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
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[1.75rem] border shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:my-auto sm:rounded-3xl max-h-[calc(100dvh-1.5rem)]" style={surface.card}>
        
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] [touch-action:pan-y]">
          
          {/* Gallery Component */}
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

          {/* Quick Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Content */}
          <div className="space-y-4 p-4 sm:p-5">
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

          {/* Footer Buttons */}
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