"use client";

import Image from "next/image";
import { Info, X } from "lucide-react";
import type { CatalogItemVM, FranchizeTheme } from "../actions";

interface ItemModalProps {
  item: CatalogItemVM | null;
  theme: FranchizeTheme;
  options: {
    package: string;
    duration: string;
    perk: string;
  };
  onChangeOption: (key: "package" | "duration" | "perk", value: string) => void;
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
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  accentColor: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = option === selected;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className="rounded-full border px-3 py-1.5 text-xs transition"
              style={{
                borderColor: isActive ? accentColor : undefined,
                backgroundColor: isActive ? accentColor : undefined,
                color: isActive ? "#16130A" : undefined,
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

export function ItemModal({ item, theme, options, onChangeOption, onClose, onAddToCart }: ItemModalProps) {
  if (!item) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 md:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card">
        <div className="relative h-52 w-full">
          {item.imageUrl ? (
            <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 768px) 100vw, 520px" className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">Изображение байка скоро загрузим</div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div>
            <h3 className="text-lg font-semibold">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.subtitle}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description || "Подходит для городских поездок и коротких туров. Быстрый старт и полный контроль на дороге."}</p>
          </div>

          <div className="rounded-2xl border border-border bg-background/50 p-3 text-xs">
            <p className="inline-flex items-center gap-1 font-medium" style={{ color: theme.palette.accentMain }}>
              <Info className="h-3.5 w-3.5" /> Quick spec
            </p>
            <p className="mt-1 text-muted-foreground">Оплата при получении, быстрая выдача, можно добавить аксессуары в один тап.</p>
          </div>

          <OptionChips title="Пакет" options={packageOptions} selected={options.package} onSelect={(v) => onChangeOption("package", v)} accentColor={theme.palette.accentMain} />
          <OptionChips title="Срок" options={durationOptions} selected={options.duration} onSelect={(v) => onChangeOption("duration", v)} accentColor={theme.palette.accentMain} />
          <OptionChips title="Комплект" options={perkOptions} selected={options.perk} onSelect={(v) => onChangeOption("perk", v)} accentColor={theme.palette.accentMain} />
        </div>

        <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-border bg-card p-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-3 py-2 text-sm font-medium">
            Закрыть
          </button>
          <button
            type="button"
            onClick={onAddToCart}
            className="rounded-xl px-3 py-2 text-sm font-semibold"
            style={{ backgroundColor: theme.palette.accentMain, color: "#16130A" }}
          >
            Добавить • {item.pricePerDay} ₽
          </button>
        </div>
      </div>
    </div>
  );
}
