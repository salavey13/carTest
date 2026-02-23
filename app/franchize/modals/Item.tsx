"use client";

import Image from "next/image";
import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { CatalogItemVM, FranchizeTheme } from "../actions";
import { crewPaletteForSurface, focusRingOutlineStyle } from "../lib/theme";

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
  accentColor,
  mutedTextColor,
  focusRingStyle,
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor: string;
  mutedTextColor: string;
  focusRingStyle: { outlineColor: string };
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em]" style={{ color: mutedTextColor }}>{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option === selected;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className="rounded-full border px-3 py-1.5 text-xs transition hover:opacity-90 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{
                borderColor: isActive ? accentColor : undefined,
                backgroundColor: isActive ? accentColor : undefined,
                color: isActive ? "#16130A" : undefined,
                ...focusRingStyle,
              }}
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

  useEffect(() => {
    setDescriptionExpanded(false);
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

  const handleAddButtonPress = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onAddToCart();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/60 p-3 md:items-center" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border" style={surface.card}>
        <div className="relative h-52 w-full shrink-0">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 100vw, 520px" className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm" style={surface.mutedText}>Изображение байка скоро загрузим</div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            aria-label="Close"
            style={focusRingOutlineStyle(theme)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 [-webkit-overflow-scrolling:touch]">
          <div>
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="text-sm" style={surface.mutedText}>{item.subtitle}</p>
            <p className={`mt-2 text-sm leading-6 ${descriptionExpanded ? "" : "line-clamp-3"}`} style={surface.mutedText}>{descriptionText}</p>
            {descriptionText.length > 120 && (
              <button
                type="button"
                className="mt-1 text-sm font-medium transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ color: theme.palette.accentMain, ...focusRingOutlineStyle(theme) }}
                onClick={() => setDescriptionExpanded((prev) => !prev)}
              >
                {descriptionExpanded ? "Скрыть" : "Показать ещё..."}
              </button>
            )}
          </div>

          <div className="rounded-2xl border p-3 text-xs" style={surface.subtleCard}>
            <p className="inline-flex items-center gap-1 font-medium" style={{ color: theme.palette.accentMain }}>
              <Info className="h-3.5 w-3.5" /> Характеристики и условия
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2" style={surface.mutedText}>
              {normalizedSpecs.map((spec) => (
                <div key={`${spec.label}-${spec.value}`} className="rounded-lg border px-2.5 py-2" style={surface.subtleCard}>
                  <p className="text-[10px] uppercase tracking-[0.08em]">{spec.label}</p>
                  <p className="mt-1 text-sm" style={{ color: theme.palette.textPrimary }}>{spec.value}</p>
                </div>
              ))}
            </div>
          </div>

          <OptionChips title="Пакет" options={packageOptions} selected={options.package} onSelect={(v) => onChangeOption("package", v)} accentColor={theme.palette.accentMain} mutedTextColor={theme.palette.textSecondary} focusRingStyle={focusRingOutlineStyle(theme)} />
          <OptionChips title="Срок" options={durationOptions} selected={options.duration} onSelect={(v) => onChangeOption("duration", v)} accentColor={theme.palette.accentMain} mutedTextColor={theme.palette.textSecondary} focusRingStyle={focusRingOutlineStyle(theme)} />
          <OptionChips title="Комплект" options={perkOptions} selected={options.perk} onSelect={(v) => onChangeOption("perk", v)} accentColor={theme.palette.accentMain} mutedTextColor={theme.palette.textSecondary} focusRingStyle={focusRingOutlineStyle(theme)} />
          <OptionChips title="Аукцион / тик" options={auctionOptions} selected={options.auction} onSelect={(v) => onChangeOption("auction", v)} accentColor={theme.palette.accentMain} mutedTextColor={theme.palette.textSecondary} focusRingStyle={focusRingOutlineStyle(theme)} />
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 border-t p-3" style={surface.card}>
          <button type="button" onClick={onClose} className="rounded-xl border px-3 py-2 text-sm font-medium transition hover:opacity-90 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...surface.subtleCard, ...focusRingOutlineStyle(theme) }}>
            Закрыть
          </button>
          <button
            type="button"
            onClick={handleAddButtonPress}
            className="rounded-xl px-3 py-2 text-sm font-semibold transition hover:brightness-105 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: theme.palette.accentMain, color: "#16130A", ...focusRingOutlineStyle(theme) }}
          >
            Добавить • {item.pricePerDay} ₽
          </button>
        </div>
      </div>
    </div>
  );
}
