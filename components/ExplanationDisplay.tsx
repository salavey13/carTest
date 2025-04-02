import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { CheckCircle, XCircle, Lightbulb } from 'lucide-react';

// Interface remains the same as current context
interface ExplanationDisplayProps {
    explanation: string | null;
    isCorrect: boolean;
    onNext: () => void;
    isLastQuestion: boolean;
}

export const ExplanationDisplay = ({ explanation, isCorrect, onNext, isLastQuestion }: ExplanationDisplayProps) => {
    if (!explanation) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3 }}
            // New classes for dark theme, border, background, shadow
            className="mt-6 p-4 md:p-6 rounded-xl border-2 border-brand-orange/50 bg-dark-bg shadow-inner shadow-black/20"
        >
            {/* Feedback Title with new colors */}
            <div className={`flex items-center mb-3 ${isCorrect ? 'text-brand-green' : 'text-brand-pink'}`}>
                 {isCorrect ? <CheckCircle className="h-6 w-6 mr-2 flex-shrink-0" /> : <XCircle className="h-6 w-6 mr-2 flex-shrink-0" />}
                <span className="font-semibold text-lg">{isCorrect ? "Правильно!" : "Неверно."}</span>
            </div>

            {/* Explanation Text section */}
             <div className="flex items-start mb-4">
                 <Lightbulb className="h-5 w-5 text-yellow-400 mr-2.5 mt-1 flex-shrink-0" /> {/* Updated color */}
                 {/* Add prose-invert for dark theme markdown */}
                 <div className="prose prose-sm md:prose-base max-w-none text-light-text/90 prose-invert prose-p:my-1 prose-li:my-0.5">
                     <ReactMarkdown>{explanation}</ReactMarkdown>
                 </div>
             </div>

            {/* Next Button with new bright style */}
            <button
                onClick={onNext}
                // New classes for bright button
                className="w-full mt-4 bg-brand-green text-dark-bg px-4 py-2.5 rounded-lg font-bold text-base md:text-lg hover:bg-neon-lime transition-all duration-300 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-neon-lime focus:ring-offset-2 focus:ring-offset-dark-bg shadow-md hover:shadow-lg shadow-brand-green/30"
            >
                {isLastQuestion ? "Завершить тест" : "Следующий вопрос"}
            </button>
        </motion.div>
    );
};