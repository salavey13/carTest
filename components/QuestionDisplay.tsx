import { motion } from 'framer-motion';

// Interface remains the same as current context
interface QuestionDisplayProps {
    questionText: string | undefined;
    questionNumber: number;
    totalQuestions: number;
}

export const QuestionDisplay = ({ questionText, questionNumber, totalQuestions }: QuestionDisplayProps) => {
    if (!questionText) return null;

    return (
        <motion.div
            key={questionNumber} // Keep key for animation
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            // New classes for dark theme, gradient, border, shadow
            className="mb-6 md:mb-8 p-5 md:p-6 bg-gradient-to-br from-dark-card to-gray-800 rounded-xl border border-brand-purple/40 shadow-lg shadow-brand-purple/10"
        >
            {/* New text color */}
            <p className="text-sm text-brand-blue font-medium mb-3">
                Вопрос {questionNumber} из {totalQuestions}
            </p>
            {/* New text color, keep pre formatting */}
            <pre className="text-lg md:text-xl leading-relaxed text-light-text whitespace-pre-wrap font-sans">
                {questionText}
            </pre>
        </motion.div>
    );
};