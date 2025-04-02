import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { CheckCircle, XCircle, Lightbulb } from 'lucide-react';

interface ExplanationDisplayProps {
    explanation: string | null; // Текст объяснения (может быть Markdown)
    isCorrect: boolean;        // Был ли ответ пользователя верным
    onNext: () => void;        // Функция для перехода к следующему вопросу/результату
    isLastQuestion: boolean;   // Это последний вопрос?
}

export const ExplanationDisplay = ({ explanation, isCorrect, onNext, isLastQuestion }: ExplanationDisplayProps) => {
    if (!explanation) return null; // Не показываем, если нет объяснения

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-6 p-4 md:p-6 rounded-lg border bg-white shadow-inner" // Немного другой фон для выделения
        >
            {/* Заголовок обратной связи */}
            <div className={`flex items-center mb-3 ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                {isCorrect ? <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" /> : <XCircle className="h-5 w-5 mr-2 flex-shrink-0" />}
                <span className="font-semibold text-lg">{isCorrect ? "Правильно!" : "Неверно."}</span>
            </div>

            {/* Текст объяснения с иконкой */}
             <div className="flex items-start mb-4">
                 <Lightbulb className="h-5 w-5 text-yellow-500 mr-2 mt-1 flex-shrink-0" />
                 {/* Используем ReactMarkdown для рендеринга */}
                 <div className="prose prose-sm md:prose-base max-w-none text-gray-700">
                     <ReactMarkdown>{explanation}</ReactMarkdown>
                 </div>
             </div>

            {/* Кнопка "Далее" */}
            <button
                onClick={onNext}
                className="w-full mt-4 bg-blue-600 text-white px-4 py-2.5 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium text-base md:text-lg"
            >
                {isLastQuestion ? "Завершить тест" : "Следующий вопрос"}
            </button>
        </motion.div>
    );
};