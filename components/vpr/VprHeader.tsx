import { Info } from "lucide-react";
// Ensure TimerDisplay path is correct relative to your project structure
import { TimerDisplay } from "@/components/TimerDisplay"; // Assuming this is the correct path for TimerDisplay

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
}: VprHeaderProps) {
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
        <TimerDisplay // Using TimerDisplay as per your original code
          key={timerKey}
          initialTime={timeLimit}
          onTimeUp={onTimeUp}
          isRunning={isTimerRunning}
        />
      </div>
    </div>
  );
}