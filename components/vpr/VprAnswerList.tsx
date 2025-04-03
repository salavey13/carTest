import { AnswerOption } from "@/components/AnswerOption"; // Assuming path is correct
import { VprAnswerData } from "@/app/vpr-test/[subjectId]/page"; // Import type

interface VprAnswerListProps {
  answers: VprAnswerData[];
  selectedAnswerId: number | null;
  showFeedback: boolean;
  timeUpModal: boolean;
  handleAnswer: (answer: VprAnswerData) => void;
}

export function VprAnswerList({
  answers,
  selectedAnswerId,
  showFeedback,
  timeUpModal,
  handleAnswer,
}: VprAnswerListProps) {
  // Check if there are any answers that are NOT placeholders
  const hasRealOptions = answers && answers.some(a => !/^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(a.text));

  // If no answers array or only placeholder answers, show a message
  if (!hasRealOptions) {
     return (
       <div className="text-light-text/70 text-center my-4 p-4 bg-dark-bg/30 rounded-md border border-dashed border-gray-600">
         Нет стандартных вариантов ответа.
         <br/>
         (Нажмите "Пропустить / Далее", если доступно).
       </div>
      );
  }

  // Render clickable AnswerOption components only for non-placeholder answers
  return (
    <div className="space-y-3 mb-6">
      {answers.map((answer) => {
        // Skip rendering if it's a placeholder type
        if (/^\[(Рисунок|Ввод текста|Диаграмма|Изображение|Площадь)\].*/.test(answer.text)) {
             return null;
        }

        // Render standard answer options
        const isSelected = answer.id === selectedAnswerId;
        const showCorrectness = showFeedback && answer.is_correct;
        const showIncorrectness = showFeedback && isSelected && !answer.is_correct;

        return (
          <AnswerOption
            key={answer.id}
            answer={answer}
            isSelected={isSelected}
            showCorrectness={showCorrectness}
            showIncorrectness={showIncorrectness}
            isDisabled={showFeedback || timeUpModal} // Disable when feedback shown or time's up
            onClick={handleAnswer}
          />
        );
      })}
    </div>
  );
}