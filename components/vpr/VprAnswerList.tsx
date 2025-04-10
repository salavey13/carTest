"use client";

import { useMemo } from "react"; // <-- Import useMemo
import { motion } from "framer-motion";
import { AnswerOption } from "@/components/AnswerOption";
import { VprAnswerData } from "@/app/vpr-test/[subjectId]/page";

interface VprAnswerListProps {
  answers: VprAnswerData[];
  selectedAnswerId: number | null;
  showFeedback: boolean; // For normal feedback display
  timeUpModal: boolean;
  handleAnswer: (answer: VprAnswerData) => void;
  isDummyModeActive: boolean;
}

// --- Helper: Fisher-Yates (Knuth) Shuffle ---
// Creates a shuffled *copy* of the array
function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]; // Create a shallow copy
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; // Swap elements
    }
    return shuffled;
}
// --- End Helper ---

export function VprAnswerList({
  answers,
  selectedAnswerId,
  showFeedback,
  timeUpModal,
  handleAnswer,
  isDummyModeActive,
}: VprAnswerListProps) {

  // --- Memoize the shuffled, standard answers ---
  const shuffledStandardAnswers = useMemo(() => {
    // Filter out non-standard answers *first*
    const standardAnswers = answers.filter(
      (answer) => !/^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(answer.text)
    );
    // Shuffle the filtered list
    return shuffleArray(standardAnswers);
  }, [answers]); // <-- Dependency array: re-shuffle ONLY when `answers` prop changes
  // --- End Memoization ---

  // Check if there are any options left after filtering
  const hasRealOptions = shuffledStandardAnswers.length > 0;

  if (!hasRealOptions) {
     return (
       <div className="text-light-text/70 text-center my-4 p-4 bg-dark-bg/30 rounded-md border border-dashed border-gray-600">
         Нет стандартных вариантов ответа.
         <br/>
         (Нажмите "Пропустить / Далее", если доступно).
       </div>
      );
  }

  return (
    <motion.div
        className="space-y-3 mb-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
    >
      {/* --- Map over the SHUFFLED standard answers --- */}
      {shuffledStandardAnswers.map((answer) => {
        // Logic remains mostly the same, but operates on the `answer` from the shuffled list
        const isSelected = answer.id === selectedAnswerId;
        const isCorrect = answer.is_correct;

        const highlightCorrectInDummy = isDummyModeActive && isCorrect;
        const disableInDummy = isDummyModeActive;

        const showCorrectnessInFeedback = showFeedback && isCorrect;
        const showIncorrectnessInFeedback = showFeedback && isSelected && !isCorrect;
        const disableInFeedback = showFeedback;

        const isDisabled = disableInDummy || disableInFeedback || timeUpModal;

        return (
          <AnswerOption
            // Use answer.id as the key - it's unique to the answer data
            key={answer.id}
            answer={answer}
            isSelected={isSelected && !isDummyModeActive}
            showCorrectness={showCorrectnessInFeedback || highlightCorrectInDummy}
            showIncorrectness={showIncorrectnessInFeedback}
            isDisabled={isDisabled}
            onClick={handleAnswer}
            isDummyHighlighted={highlightCorrectInDummy}
          />
        );
      })}
      {/* --- End Map --- */}
    </motion.div>
  );
}