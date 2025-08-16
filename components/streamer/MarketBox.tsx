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
    title: "Sauna Pack",
    price: 500,
    short: "Towel + Flipflops (digital badge)",
    perks: ["Digital towel sticker", "Flipflops emoji shoutout", "VIP chat tag (7d)"],
    image: "/assets/sauna-pack.png",
    accent: "shadow-yellow-glow",
  },
  {
    id: "flipflops",
    title: "Flipflops",
    price: 200,
    short: "Cool flipflops sticker",
    perks: ["Sticker", "Name in stream overlay (1x)"],
    image: "/assets/flipflops.png",
    accent: "shadow-pink-glow",
  },
  {
    id: "towel",
    title: "Towel",
    price: 150,
    short: "Soft towel sticker",
    perks: ["Sticker", "Thanks on stream"],
    image: "/assets/towel.png",
    accent: "shadow-blue-glow",
  },
];

export default function MarketBox({ onPick }: { onPick?: (item: Item) => void }) {
  return (
    <div className="p-3 bg-card rounded-md border border-border">
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
              <div className="w-12 h-12 relative rounded-full overflow-hidden bg-muted flex-shrink-0">
                {it.image ? (
                  // these are placeholders, add real assets if you like
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

            <ul className="text-xs text-muted-foreground list-disc list-inside mt-1 mb-2">
              {it.perks?.slice(0, 3).map((p, i) => (
                <li key={i} className="truncate">{p}</li>
              ))}
            </ul>

            <div className="w-full flex items-center justify-between mt-auto">
              <Button size="sm" onClick={() => onPick && onPick(it)} aria-label={`Купить ${it.title}`}>
                Купить
              </Button>
              <Button size="sm" variant="ghost" onClick={() => alert(it.perks?.join("\n") || it.short)}>
                Подробнее
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}