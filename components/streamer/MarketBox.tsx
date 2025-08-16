"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  price: number;
  short: string;
  perks?: string[];
  image?: string;
  accent?: string;
};

const ITEMS: Item[] = [
  {
    id: "sauna_pack",
    title: "Сауна Пак",
    price: 500,
    short: "Полотенце + шлёпанцы + цифровой бейдж",
    perks: ["Цифровой стикер полотенца", "Шлёпанцы — упоминание в стриме", "VIP-значок (7 дн)"],
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1000&q=80",
    accent: "shadow-yellow-glow",
  },
  {
    id: "flipflops",
    title: "Шлёпанцы",
    price: 200,
    short: "Крутой стикер шлёпанцев",
    perks: ["Стикер", "Имя в оверлее (1x)"],
    image:
      "https://images.unsplash.com/photo-1519741491558-0b3f0c1a3a3a?auto=format&fit=crop&w=1000&q=80",
    accent: "shadow-pink-glow",
  },
  {
    id: "towel",
    title: "Полотенце",
    price: 150,
    short: "Мягкий цифровой стикер полотенца",
    perks: ["Стикер", "Спасибо в чате на стриме"],
    image:
      "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1000&q=80",
    accent: "shadow-blue-glow",
  },
];

export default function MarketBox({ onPick }: { onPick?: (item: Item) => void }) {
  return (
    <div className="p-3 bg-card/80 dark:bg-card rounded-md border border-border backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">Мини-маркет — Сауна</h4>
        <div className="text-xs text-muted-foreground">Прототип</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ITEMS.map((it) => (
          <article
            key={it.id}
            className={cn(
              "p-3 rounded-md border border-border bg-gradient-to-br from-card/60 to-transparent flex flex-col items-start gap-2",
              it.accent ?? ""
            )}
            aria-label={`${it.title} — ${it.price} XTR`}
            role="group"
          >
            <div className="w-full flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                {/* plain img to avoid external host config for next/image */}
                {it.image ? (
                  <img src={it.image} alt={it.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center text-xs">{it.title[0]}</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{it.title}</div>
                <div className="text-xs text-muted-foreground truncate">{it.short}</div>
              </div>

              <div className="text-sm font-semibold">{it.price}★</div>
            </div>

            <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 mb-2">
              {it.perks?.slice(0, 3).map((p, i) => (
                <li key={i} className="truncate">{p}</li>
              ))}
            </ul>

            <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mt-auto">
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => onPick && onPick(it)}
                aria-label={`Купить ${it.title}`}
              >
                Купить
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => alert(it.perks?.join("\n") || it.short)}
              >
                Подробнее
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}