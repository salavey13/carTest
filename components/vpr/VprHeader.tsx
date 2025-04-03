import { Info } from "lucide-react";
import { TimerDisplay } from "@/components/TimerDisplay"; // Assuming TimerDisplay is separate, e.g., /components/TimerDisplay.tsx

interface VprHeaderProps {
  subjectName: string | undefined;
  showDescriptionButton: boolean;
  isDescriptionShown: boolean;
  onToggleDescription: () => void;
  timerKey: number;
  timeLimit: number;
  onTimeUp: () => void;
  isTimerRunning: boolean;
}

export function VprHeader({
  subjectName,
  showDescriptionButton,
  isDescriptionShown,
  onToggleDescription,
  timerKey,
  timeLimit,
  onTimeUp,
  isTimerRunning,
}: VprHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center mb-5 gap-3">
      <div className="text-center sm:text-left">
        <h1 className="text-xl md:text-2xl font-bold text-brand-green">{subjectName || "Загрузка..."}</h1>
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