"use client";

import { motion } from "framer-motion";
import { AnswerOption } from "@/components/AnswerOption";
import { VprAnswerData } from "@/app/vpr-test/[subjectId]/page";
import { AlertCircle } from "lucide-react";

interface VprAnswerListProps {
  answers: VprAnswerData[];
  selectedAnswerId: number | null;
  showFeedback: boolean;
  timeUpModal: boolean;
  handleAnswer: (answer: VprAnswerData) => void;
  isDummyModeActive: boolean;
}

export function VprAnswerList({
  answers,
  selectedAnswerId,
  showFeedback,
  timeUpModal,
  handleAnswer,
  isDummyModeActive,
}: VprAnswerListProps) {

  const hasRealOptions = answers && answers.some(a => !/^\[.*\]/.test(a.text));

  if (!hasRealOptions) {
     return (
       <div className="my-6 p-6 rounded-xl border border-dashed border-white/20 bg-white/5 text-center">
         <AlertCircle className="h-8 w-8 mx-auto mb-3 text-white/30" />
         <p className="text-sm text-white/50">
           Для этого вопроса нет вариантов выбора.<br/>
           (Используйте кнопку "Пропустить / Далее")
         </p>
       </div>
      );
  }

  return (
    <div className="grid gap-3 mb-8">
      {answers.map((answer, index) => {
        if (/^\[.*\]/.test(answer.text)) return null;

        const isSelected = answer.id === selectedAnswerId;
        const isCorrect = answer.is_correct;
        const highlightCorrectInDummy = isDummyModeActive && isCorrect;
        const isDisabled = isDummyModeActive || showFeedback || timeUpModal;

        return (
          <motion.div
            key={answer.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <AnswerOption
              answer={answer}
              isSelected={isSelected && !isDummyModeActive}
              showCorrectness={showFeedback && isCorrect || highlightCorrectInDummy}
              showIncorrectness={showFeedback && isSelected && !isCorrect}
              isDisabled={isDisabled}
              onClick={handleAnswer}
              isDummyHighlighted={highlightCorrectInDummy}
            />
          </motion.div>
        );
      })}
    </div>
  );
}