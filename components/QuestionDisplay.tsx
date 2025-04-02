import { motion } from 'framer-motion';

interface QuestionDisplayProps {
    questionText: string | undefined; // Текст вопроса
    questionNumber: number; // Номер текущего вопроса (1-based)
    totalQuestions: number; // Общее число вопросов
}

export const QuestionDisplay = ({ questionText, questionNumber, totalQuestions }: QuestionDisplayProps) => {
    if (!questionText) return null;

    return (
        <motion.div
            key={questionNumber} // Анимация при смене вопроса
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 md:mb-8 p-4 md:p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 shadow-sm"
        >
            <p className="text-sm text-indigo-600 font-medium mb-2">
                Вопрос {questionNumber} из {totalQuestions}
            </p>
            {/* Используем <pre> для сохранения форматирования, если в тексте вопроса есть переносы строк */}
            <pre className="text-lg md:text-xl leading-relaxed text-gray-800 whitespace-pre-wrap font-sans">
                {questionText}
            </pre>
        </motion.div>
    );
};