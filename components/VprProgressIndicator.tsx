"use client";
import { motion } from "framer-motion";
import { Check, X } from 'lucide-react'; // Иконки для статуса

interface AnswerStatus {
    questionIndex: number;
    isCorrect: boolean;
}

interface VprProgressIndicatorProps {
    current: number; // Индекс текущего вопроса (0-based)
    total: number;   // Общее количество вопросов
    // Массив статусов отвеченных вопросов (необязательно для базовой версии)
    // answerStatuses?: AnswerStatus[];
}

export const VprProgressIndicator = ({ current, total }: VprProgressIndicatorProps) => {
    if (total === 0) return null;

    return (
        <div className="flex justify-center items-center gap-2 md:gap-3 mb-6 px-4">
            {Array.from({ length: total }).map((_, index) => {
                const isCurrent = index === current;
                const isPast = index < current;
                // const status = answerStatuses?.find(s => s.questionIndex === index);

                return (
                    <motion.div
                        key={index}
                        className={`relative w-3 h-3 md:w-4 md:h-4 rounded-full transition-colors duration-300
                            ${isCurrent ? 'bg-blue-500 scale-125 ring-2 ring-blue-300 ring-offset-1' : ''}
                            ${isPast ? 'bg-blue-300' : 'bg-gray-300'}
                            `}
                        // Анимация для текущего элемента (небольшое увеличение)
                        animate={{
                            scale: isCurrent ? 1.4 : 1,
                            transition: { type: "spring", stiffness: 400, damping: 15 },
                        }}
                        title={`Вопрос ${index + 1}`} // Подсказка
                    >
                        {/* Опционально: иконка статуса для пройденных вопросов */}
                        {/* {isPast && status && (
                            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2">
                                {status.isCorrect
                                    ? <Check className="w-4 h-4 text-green-600" />
                                    : <X className="w-4 h-4 text-red-600" />
                                }
                            </div>
                        )} */}
                    </motion.div>
                );
            })}
        </div>
    );
};