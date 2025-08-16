"use client";
import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  price: number;
  short: string;
  perks?: string[];
  image?: string;
  accent?: string; // tailwind bg class or util
};

const ITEMS: Item[] = [
  {
    id: "sauna_pack",
    title: "Сауна Пак",
    price: 500,
    short: "Полотенце + шлёпки (цифровой бейдж)",
    perks: ["Наклейка полотенца", "Шлёпки-эмоджи в чате", "VIP-метка 7 дней"],
    image: "https://images.unsplash.com/photo-1522770179533-24471fcdba45?auto=format&fit=crop&w=800&q=80", // spa towels
    accent: "shadow-yellow-glow",
  },
  {
    id: "flipflops",
    title: "Шлёпки",
    price: 200,
    short: "Крутые шлёпки-стикер",
    perks: ["Стикер шлёпок", "Имя в оверлее стрима"],
    image: "https://images.unsplash.com/photo-1509099836639-18ba58d36f5d?auto=format&fit=crop&w=800&q=80", // flipflops
    accent: "shadow-pink-glow",
  },
  {
    id: "towel",
    title: "Полотенце",
    price: 150,
    short: "Мягкое цифровое полотенце",
    perks: ["Стикер полотенца", "Спасибо в эфире"],
    image: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80", // towel
    accent: "shadow-blue-glow",
  },
];

export default function MarketBox({ onPick }: { onPick?: (item: Item) => void }) {
  return (
    <div className="p-3 rounded-md border border-border bg-card/70 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold">Мини-маркет: Sauna Pack</h4>
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
              <div className="w-14 h-14 relative rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {it.image ? (
                  <Image src={it.image} alt={it.title} fill style={{ objectFit: "cover" }} />
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

            <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 mb-2 w-full">
              {it.perks?.slice(0, 3).map((p, i) => (
                <li key={i} className="truncate">{p}</li>
              ))}
            </ul>

            <div className="w-full flex items-center justify-between mt-auto gap-2">
              <Button size="sm" onClick={() => onPick && onPick(it)} aria-label={`Купить ${it.title}`} className="flex-1">Купить</Button>
              <Button size="sm" variant="ghost" onClick={() => alert(it.perks?.join("\n") || it.short)}>Подробнее</Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}