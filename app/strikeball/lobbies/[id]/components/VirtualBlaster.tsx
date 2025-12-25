"use client";

import { FaFistRaised, FaGun, FaSkull } from "react-icons/fa6";
import { useState } from "react";
import { useGameSounds } from "../hooks/useGameSounds";
import { cn } from "@/lib/utils";

interface VirtualBlasterProps {
  onHit: () => void;
  onDeath?: () => void; // если хотите отдельно обработать "death" звук
}

export function VirtualBlaster({ onHit, onDeath }: VirtualBlasterProps) {
  const sounds = useGameSounds();
  const [mode, setMode] = useState<"ranged" | "melee">("ranged");

  const toggleMode = () => {
    setMode(prev => prev === "ranged" ? "melee" : "ranged");
  };

  const handleAction = () => {
    if (mode === "ranged") {
      sounds.fire();
    } else {
      sounds.meleeAttack();
    }
  };

  return (
    <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 shadow-[0_0_50px_rgba(34,211,238,0.2)] pointer-events-auto">
      {/* Кнопка атаки (переключается между blaster / melee) */}
      <button
        onClick={handleAction}
        onContextMenu={(e) => {
          e.preventDefault();
          toggleMode();
        }}
        className={cn(
          "font-black py-10 uppercase tracking-[0.2em] flex flex-col items-center justify-center transition-colors",
          mode === "ranged"
            ? "bg-brand-cyan text-black active:bg-white"
            : "bg-amber-600 text-black active:bg-amber-400"
        )}
      >
        {mode === "ranged" ? (
          <>
            <FaGun className="text-4xl mb-2 animate-pulse" />
            <span>ОГОНЬ</span>
          </>
        ) : (
          <>
            <FaFistRaised className="text-4xl mb-2 animate-bounce" />
            <span>УДАР</span>
          </>
        )}
      </button>

      {/* Кнопка "Я УБИТ" */}
      <button
        onClick={() => {
          sounds.death(); // death3.mp3
          onHit?.();
          onDeath?.();
        }}
        className="bg-red-600 text-white font-black py-10 uppercase tracking-[0.2em] flex flex-col items-center justify-center active:bg-red-400 transition-colors"
      >
        <FaSkull className="text-4xl mb-2 animate-pulse" />
        <span>Я УБИТ</span>
      </button>
    </div>
  );
}