import { motion } from "framer-motion";
import { AnswerOption } from "@/components/AnswerOption";
import { VprAnswerData } from "@/app/vpr-test/[subjectId]/page";

interface VprAnswerListProps {
  answers: VprAnswerData[];
  selectedAnswerId: number | null;
  showFeedback: boolean; // For normal feedback display
  timeUpModal: boolean;
  handleAnswer: (answer: VprAnswerData) => void;
  isDummyModeActive: boolean; // <-- NEW PROP
}

export function VprAnswerList({
  answers,
  selectedAnswerId,
  showFeedback,
  timeUpModal,
  handleAnswer,
  isDummyModeActive, // <-- Destructure new prop
}: VprAnswerListProps) {

  const hasRealOptions = answers && answers.some(a => !/^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));

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
      {answers.map((answer) => {
        if (/^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(answer.text)) {
             return null; // Skip non-standard answers
        }

        // Determine state for standard answers
        const isSelected = answer.id === selectedAnswerId;
        const isCorrect = answer.is_correct;

        // --- Dummy Mode Logic ---
        const highlightCorrectInDummy = isDummyModeActive && isCorrect;
        const disableInDummy = isDummyModeActive;

        // --- Normal Feedback Logic ---
        const showCorrectnessInFeedback = showFeedback && isCorrect;
        const showIncorrectnessInFeedback = showFeedback && isSelected && !isCorrect;
        const disableInFeedback = showFeedback;

        // Combine disabling conditions
        const isDisabled = disableInDummy || disableInFeedback || timeUpModal;

        return (
          <AnswerOption
            key={answer.id}
            answer={answer}
            isSelected={isSelected && !isDummyModeActive} // Don't show selection state in dummy mode
            showCorrectness={showCorrectnessInFeedback || highlightCorrectInDummy} // Highlight if correct in feedback OR if dummy mode highlights it
            showIncorrectness={showIncorrectnessInFeedback} // Only show incorrectness in normal feedback
            isDisabled={isDisabled}
            onClick={handleAnswer}
            // Add specific styling for dummy mode highlight if needed
            isDummyHighlighted={highlightCorrectInDummy}
          />
        );
      })}
    </motion.div>
  );
}