import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
import type { VprAnswerData } from '@/app/vpr-test/[subjectId]/page'; // Импортируем тип

interface AnswerOptionProps {
    answer: VprAnswerData;
    isSelected: boolean;        // Выбран ли этот ответ
    showCorrectness: boolean;   // Показывать ли зеленую рамку/иконку (если он верный)
    showIncorrectness: boolean; // Показывать ли красную рамку/иконку (если он выбран и неверный)
    isDisabled: boolean;        // Заблокирована ли кнопка (после выбора)
    onClick: (answer: VprAnswerData) => void; // Функция при клике
}

export const AnswerOption = ({
    answer,
    isSelected,
    showCorrectness,
    showIncorrectness,
    isDisabled,
    onClick
}: AnswerOptionProps) => {

    const baseClasses = "w-full text-left p-3 md:p-4 rounded-lg border transition-all duration-200 flex items-center justify-between group text-base md:text-lg";
    const interactionClasses = isDisabled
        ? 'cursor-not-allowed opacity-70'
        : 'hover:bg-gray-50 hover:border-gray-400 cursor-pointer';
    const selectedClasses = isSelected ? 'ring-2 ring-offset-1 ring-blue-400 border-blue-400' : 'border-gray-300';
    const correctClasses = showCorrectness ? 'bg-green-50 border-green-400 ring-green-400 text-green-800' : '';
    const incorrectClasses = showIncorrectness ? 'bg-red-50 border-red-400 ring-red-400 text-red-800' : '';
    const textClasses = (showCorrectness || showIncorrectness) ? 'font-medium' : 'text-gray-700';

    return (
        <motion.button
            onClick={() => onClick(answer)}
            disabled={isDisabled}
            className={`${baseClasses} ${interactionClasses} ${selectedClasses} ${correctClasses} ${incorrectClasses}`}
            whileHover={!isDisabled ? { scale: 1.02, zIndex: 1, boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)' } : {}}
            whileTap={!isDisabled ? { scale: 0.98 } : {}}
            layout // Плавная анимация изменения размера/положения
        >
            <span className={`${textClasses} mr-2`}>
                {answer.text}
            </span>
            {/* Иконки обратной связи */}
            <div className="flex-shrink-0">
                 {showCorrectness && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-green-600" />
                    </motion.div>
                 )}
                 {showIncorrectness && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <XCircle className="h-5 w-5 md:h-6 md:w-6 text-red-600" />
                    </motion.div>
                 )}
            </div>
        </motion.button>
    );
};