"use client";

import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { TimerDisplay } from "@/components/TimerDisplay";
import { getVprCheatsheetHref } from "@/lib/vprCheatsheet";

interface VprHeaderProps {
  subjectName: string | undefined;
  variantNumber?: number | null; // <<< Added prop
  showDescriptionButton: boolean;
  isDescriptionShown: boolean;
  onToggleDescription: () => void;
  timerKey: number;
  timeLimit: number;
  onTimeUp: () => void;
  isTimerRunning: boolean;
  subjectSlug?: string;
}

export function VprHeader({
  subjectName,
  variantNumber, // <<< Destructure prop
  showDescriptionButton,
  isDescriptionShown,
  onToggleDescription,
  timerKey,
  timeLimit,
  onTimeUp,
  isTimerRunning,
  subjectSlug = "general",
}: VprHeaderProps) {
  const router = useRouter();
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-3">
      <div className="text-center sm:text-left flex items-baseline gap-2"> {/* Added flex and gap for alignment */}
        <h1 className="text-xl md:text-2xl font-bold text-brand-green">
            {subjectName || "Загрузка..."}
        </h1>
        {/* Display variant number if available */}
        {variantNumber && (
            <span className="text-base md:text-lg font-medium text-gray-400">
                (Вариант {variantNumber})
            </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {showDescriptionButton && (
          <button
            onClick={onToggleDescription}
            className="text-brand-blue hover:text-brand-blue/80 p-1.5 rounded-full bg-dark-bg/50 hover:bg-dark-bg transition-colors"
            title={isDescriptionShown ? "Скрыть описание" : "Показать описание"}
          >
            <Info className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={() => router.push(getVprCheatsheetHref(subjectSlug))}
          className="text-brand-cyan hover:text-brand-cyan/80"
          title="Открыть шпаргалку"
        >
          📋
        </button>
        <TimerDisplay
          key={timerKey}
          initialTime={timeLimit}
          onTimeUp={onTimeUp}
          isRunning={isTimerRunning}
        />
      </div>
    </div>
  );
}