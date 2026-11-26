"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { AnswerOption } from "@/components/AnswerOption";
import { VprAnswerData } from "@/app/vpr-test/[subjectId]/page";
import { AlertCircle } from "lucide-react";

/**
 * task217: в БД (и в seed-скриптах) верный ответ всегда вставлен ПЕРВЫМ
 * (см. seed_vpr_data_8th_grade.sql: (q_id, '360°', true), (q_id, '180°', false)...),
 * а фетк `vpr_answers ( * )` не задаёт порядок → PostgREST возвращает в порядке
 * вставки, и игрок заучил бы «первый вариант всегда верный». Перемешиваем
 * детерминированно по question_id (LCG-seed): порядок стабилен во время
 * ретраев/ререндеров вопроса, но разный между вопросами.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = (seed % 2147483647) || 1;
  const rand = () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  // визуальный порядок: реальные (не [Рисунок]-заглушки) варианты перемешаны
  const displayAnswers = useMemo(() => {
    const real = (answers || []).filter(a => !/^\[.*\]/.test(a.text));
    return seededShuffle(real, real[0]?.question_id || 1);
  }, [answers]);

  if (!hasRealOptions) {
     return (
       <div className="my-6 p-6 rounded-xl border border-dashed border-white/20 bg-white/5 text-center">
         <AlertCircle className="h-8 w-8 mx-auto mb-3 text-white/30" />
         <p className="text-sm text-white/50">
           Для этого вопроса нет вариантов выбора.<br/>
           (Используйте кнопку «Пропустить / Далее»)
         </p>
       </div>
      );
  }

  return (
    <div className="grid gap-3 mb-8">
      {displayAnswers.map((answer, index) => {
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