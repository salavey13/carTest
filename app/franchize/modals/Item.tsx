"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import { useEffect, useState } from "react";
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

const packageOptions = ["Base", "Pro", "Ultra"];
const durationOptions = ["1 day", "3 days", "7 days"];
const perkOptions = ["Стандарт", "Шлем+GoPro", "Full gear"];

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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  useEffect(() => {
    setDescriptionExpanded(false);
    setActiveMediaIndex(0);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [item]);

  if (!item) {
    return null;
  }

  const fallbackSpecs = [
    { label: "Категория", value: item.category },
    { label: "Тариф", value: `${item.pricePerDay.toLocaleString("ru-RU")} ₽ / day` },
    { label: "Статус", value: "Ready to ride" },
  ];

  const normalizedSpecs = item.specs.length > 0 ? item.specs : fallbackSpecs;
  const surface = crewPaletteForSurface(theme);
  const descriptionText =
    item.description ||
    "Этот байк уже подготовлен к аренде: технический чек выполнен, документы готовы, выдача без очереди.";
  const gallery = Array.from(new Set((item.mediaUrls?.length ? item.mediaUrls : item.imageUrl ? [item.imageUrl] : []).filter(Boolean)));
  const activeImage = gallery[activeMediaIndex] || gallery[0] || "";

  const handleAddButtonPress = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onAddToCart();
  };

  const changeMedia = (direction: -1 | 1) => {
    if (!gallery.length) return;
    setActiveMediaIndex((prev) => (prev + direction + gallery.length) % gallery.length);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-2 sm:items-center sm:p-3"
      role="dialog"
      aria-modal="true"
      style={{
        ["--item-accent" as string]: theme.palette.accentMain,
        ["--item-border" as string]: theme.palette.borderSoft,
        ["--item-muted-text" as string]: theme.palette.textSecondary,
        ["--item-text" as string]: theme.palette.textPrimary,
        ["--item-accent-contrast" as string]: "#16130A",
      }}
    >
      <div className="my-auto flex w-full max-w-4xl flex-col overflow-y-auto rounded-3xl border shadow-[0_30px_80px_rgba(0,0,0,0.35)] lg:max-h-[88vh] lg:flex-row lg:overflow-hidden" style={surface.card}>
        <div className="relative flex min-h-[220px] max-h-[36vh] w-full shrink-0 flex-col border-b lg:min-h-full lg:max-h-none lg:w-[48%] lg:border-b-0 lg:border-r" style={{ borderColor: theme.palette.borderSoft }}>
          <div className="relative flex-1 bg-black/25">
            {activeImage ? (
              <>
                <Image src={activeImage} alt={item.title} fill sizes="(max-width: 1024px) 100vw, 42vw" className="object-cover" unoptimized />
                {gallery.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => changeMedia(-1)}
                      className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                      aria-label="Предыдущее фото"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => changeMedia(1)}
                      className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                      aria-label="Следующее фото"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm" style={surface.mutedText}>Изображение байка скоро загрузим</div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {gallery.length > 1 ? (
              <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white backdrop-blur-sm">
                {activeMediaIndex + 1} / {gallery.length}
              </div>
            ) : null}
          </div>

          {gallery.length > 1 ? (
            <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: theme.palette.borderSoft, backgroundColor: theme.palette.bgBase }}>
              <div className="mb-2 text-[11px] uppercase tracking-[0.14em]" style={{ color: theme.palette.textSecondary }}>
                Галерея • свайп по миниатюрам
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {gallery.map((url, index) => {
                  const active = index === activeMediaIndex;
                  return (
                    <button
                      key={`${url}-${index}`}
                      type="button"
                      onClick={() => setActiveMediaIndex(index)}
                      className={`relative h-16 w-20 shrink-0 overflow-hidden rounded-2xl border transition ${active ? "scale-[0.98]" : "opacity-80 hover:opacity-100"}`}
                      style={{ borderColor: active ? theme.palette.accentMain : theme.palette.borderSoft }}
                    >
                      <Image src={url} alt={`${item.title} ${index + 1}`} fill sizes="80px" className="object-cover" unoptimized />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 p-4 lg:overflow-y-auto lg:overscroll-contain [-webkit-overflow-scrolling:touch] sm:p-5">
            <div>
              <h3 className="text-lg font-semibold sm:text-xl">{item.title}</h3>
              <p className="text-sm" style={surface.mutedText}>{item.subtitle}</p>
              <p className={`mt-2 text-sm leading-6 ${descriptionExpanded ? "" : "line-clamp-4"}`} style={surface.mutedText}>{descriptionText}</p>
              {descriptionText.length > 120 && (
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

          <div className="grid shrink-0 grid-cols-1 gap-2 border-t p-3 sm:grid-cols-2" style={{ ...surface.card, borderColor: theme.palette.borderSoft }}>
            <button type="button" onClick={onClose} className="rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-90 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]" style={surface.subtleCard}>
              Закрыть
            </button>
            <button
              type="button"
              onClick={handleAddButtonPress}
              className="rounded-xl bg-[var(--item-accent)] px-3 py-2 text-sm font-semibold text-[var(--item-accent-contrast)] transition hover:brightness-105 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--item-accent)]"
            >
              Добавить • {item.pricePerDay} ₽
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
