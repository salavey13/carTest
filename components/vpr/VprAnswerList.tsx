import { AnswerOption } from "@/components/AnswerOption"; // Keep original AnswerOption component
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
  // Check if answers exist and contain more than just placeholder(s)
  const hasRealOptions = answers && answers.some(a => !/^\[(Рисунок|Ввод текста)\].*/.test(a.text));

  // If no answers or only placeholder answers, show message (adjust as needed for free response UI)
  if (!hasRealOptions) {
     // For free-response questions or loading state if needed
     return (
       <div className="text-light-text/70 text-center my-4 p-4 bg-dark-bg/30 rounded-md border border-dashed border-gray-600">
         Нет стандартных вариантов ответа.
         <br/>
         (Возможно, требуется нарисовать, ввести текст или выбрать на изображении).
       </div>
      );
  }

  return (
    <div className="space-y-3 mb-6">
      {answers.map((answer) => {
        const isSelected = answer.id === selectedAnswerId;
        const showCorrectness = showFeedback && answer.is_correct;
        const showIncorrectness = showFeedback && isSelected && !answer.is_correct;

        // Check if it's a placeholder for non-clickable items
        if (/^\[(Рисунок|Ввод текста)\].*/.test(answer.text)) {
             // Don't render button for drawing/input placeholders in this list
             return null;
        }

        return (
          <AnswerOption
            key={answer.id}
            answer={answer}
            isSelected={isSelected}
            showCorrectness={showCorrectness}
            showIncorrectness={showIncorrectness}
            // Disable if feedback is shown OR if the time is up modal is active
            isDisabled={showFeedback || timeUpModal}
            onClick={handleAnswer}
          />
        );
      })}
    </div>
  );
}