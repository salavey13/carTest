import { motion } from "framer-motion";
import ReactMarkdown from 'react-markdown';
import { Lightbulb, XOctagon, CheckCircle, ArrowRight } from "lucide-react"; // Added icons

interface ExplanationDisplayProps {
  explanation: string | null;
  isCorrect: boolean;
  onNext: () => void;
  isLastQuestion: boolean;
  isDummyModeExplanation?: boolean; // <-- NEW PROP
}

export function ExplanationDisplay({
  explanation,
  isCorrect,
  onNext,
  isLastQuestion,
  isDummyModeExplanation = false, // <-- Default value
}: ExplanationDisplayProps) {

  const borderColor = isDummyModeExplanation ? 'border-yellow-500/50' : isCorrect ? 'border-green-500/50' : 'border-red-500/50';
  const bgColor = isDummyModeExplanation ? 'bg-yellow-900/20' : isCorrect ? 'bg-green-900/20' : 'bg-red-900/20';
  const iconColor = isDummyModeExplanation ? 'text-yellow-400' : isCorrect ? 'text-green-400' : 'text-red-400';
  const Icon = isDummyModeExplanation ? Lightbulb : isCorrect ? CheckCircle : XOctagon;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className={`mt-6 p-4 rounded-lg border ${borderColor} ${bgColor} overflow-hidden`}
    >
      <div className="flex items-start mb-3">
          <Icon className={`h-6 w-6 mr-3 flex-shrink-0 ${iconColor}`} />
          <h3 className={`text-lg font-semibold ${iconColor}`}>
              {isDummyModeExplanation ? "Подсказка" : (isCorrect ? "Верно!" : "Неверно")}
          </h3>
      </div>
      <div className="prose prose-invert prose-sm max-w-none text-light-text/90 mb-4 prose-p:my-1">
           {explanation ? (
             <ReactMarkdown>{explanation}</ReactMarkdown>
           ) : (
             <p>Объяснение отсутствует.</p>
           )}
      </div>
      <button
        onClick={onNext}
        className="w-full sm:w-auto float-right bg-brand-blue hover:bg-brand-blue/80 text-white px-5 py-2 rounded-md font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
      >
        {isLastQuestion ? "Завершить тест" : "Следующий вопрос"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}