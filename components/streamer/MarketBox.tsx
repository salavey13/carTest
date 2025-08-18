"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type Item = { id: string; title: string; price: number; short: string; perks?: string[]; image?: string; accent?: string; };

const ITEMS: Item[] = [
  {
    id: "sauna_pack",
    title: "Сауна Пак",
    price: 500,
    short: "Полотенце + шлёпки",
    perks: ["Наклейка полотенца","Эмоджи-шлёпки","VIP 7д"],
    image: "https://images.unsplash.com/photo-1522770179533-24471fcdba45?auto=format&fit=crop&w=800&q=80",
    accent: "shadow-yellow-glow",
  },
  {
    id: "flipflops",
    title: "Шлёпки",
    price: 200,
    short: "Крутые шлёпки-стикер",
    perks: ["Стикер","Имя в оверлее"],
    image: "https://images.unsplash.com/photo-1509099836639-18ba58d36f5d?auto=format&fit=crop&w=800&q=80",
    accent: "shadow-pink-glow",
  },
  {
    id: "towel",
    title: "Полотенце",
    price: 150,
    short: "Мягкое полотенце-стикер",
    perks: ["Стикер","Спасибо в эфире"],
    image: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=800&q=80",
    accent: "shadow-blue-glow",
  },
];

export default function MarketBox({ onPick }: { onPick?: (item: Item) => void }) {
  const [flipped, setFlipped] = useState<string | null>(null);

  return (
    <div className="p-3 rounded-md border border-border bg-gray-800/80 backdrop-blur-sm"> {/* Darker bg */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-white">Мини-маркет: Sauna Pack</h4> {/* White text */}
        <div className="text-xs text-gray-300">Прототип</div> {/* Light gray */}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ITEMS.map((it) => {
          const isFlipped = flipped === it.id;
          return (
            <motion.article
              key={it.id}
              className={cn("relative perspective-800 p-0", it.accent ?? "")}
              whileHover={{ y: -6 }}
            >
              <div className={`flip-card ${isFlipped ? "is-flipped" : ""}`}>
                <div className="flip-card-face flip-card-front p-3 rounded-md border border-border bg-gradient-to-br from-gray-900/60 to-transparent flex flex-col h-full"> {/* Darker bg */}
                  <div className="w-full flex items-center gap-3 mb-2">
                    <div className="w-14 h-14 relative rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <Image src={it.image!} alt={it.title} fill style={{ objectFit: "cover" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate text-white">{it.title}</div> {/* White text */}
                      <div className="text-xs text-gray-300 truncate">{it.short}</div> {/* Light gray */}
                    </div>
                    <div className="text-sm font-semibold text-white">{it.price}★</div> {/* White text */}
                  </div>
                  <ul className="text-xs text-gray-300 list-disc list-inside mt-1 mb-2 flex-1"> {/* Light gray */}
                    {it.perks?.slice(0,3).map((p,i) => <li key={i}>{p}</li>)}
                  </ul>

                  <div className="w-full flex items-center justify-between mt-auto gap-2">
                    <Button size="sm" onClick={() => onPick && onPick(it)} className="flex-1">Купить</Button>
                    <Button size="sm" variant="ghost" onClick={() => setFlipped(isFlipped ? null : it.id)}>Подробнее</Button>
                  </div>
                </div>

                <div className="flip-card-face flip-card-back p-3 rounded-md border border-border bg-gradient-to-tr from-gray-900/80 to-transparent flex flex-col items-start justify-between"> {/* Darker bg */}
                  <div className="text-sm font-semibold mb-2 text-white">{it.title} — детали</div> {/* White text */}
                  <div className="text-xs text-gray-300 mb-4">
                    Товар: {it.title}. Цена: {it.price} XTR.
                    <br />
                    Перки: {it.perks?.join(", ")}
                  </div> {/* Light gray */}
                  <div className="w-full flex items-center gap-2">
                    <Button size="sm" onClick={() => { onPick && onPick(it); setFlipped(null); }}>Купить сейчас</Button>
                    <Button size="sm" variant="ghost" onClick={() => setFlipped(null)}>Назад</Button>
                  </div>
                </div>
              </div>
              <style jsx>{`
                .perspective-800 { perspective: 900px; }
                .flip-card { position: relative; height: 170px; transform-style: preserve-3d; transition: transform 0.6s; }
                .flip-card-face { backface-visibility: hidden; position: absolute; inset: 0; }
                .flip-card-front { transform: rotateY(0deg); }
                .flip-card-back { transform: rotateY(180deg); display:flex; flex-direction:column; justify-content:space-between; }
                .flip-card.is-flipped { transform: rotateY(180deg); }
                @media (max-width:640px) { .flip-card { height: auto; } .flip-card-face { position:relative; transform:none; } .flip-card.is-flipped { transform:none; } }
              `}</style>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}