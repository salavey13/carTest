"use client"; // Keep client directive if needed
import { motion } from "framer-motion";
// Removed Check, X imports as status logic isn't in the new version

// Interface remains the same as current context (basic version)
interface VprProgressIndicatorProps {
    current: number; // Индекс текущего вопроса (0-based)
    total: number;   // Общее количество вопросов
}

export const VprProgressIndicator = ({ current, total }: VprProgressIndicatorProps) => {
    if (total === 0) return null;

    return (
        // Styling adjusted per new version
        <div className="flex justify-center items-center gap-2 md:gap-3 mb-6 md:mb-8 px-4">
            {Array.from({ length: total }).map((_, index) => {
                const isCurrent = index === current;
                const isPast = index < current;

                return (
                    <motion.div
                        key={index}
                        // New classes for dark theme, glow, pulse
                        className={`relative w-3 h-3 md:w-4 md:h-4 rounded-full transition-all duration-300 ease-in-out border-2
                            ${isCurrent ? 'bg-brand-green border-brand-green shadow-glow-sm [--glow-color:rgb(0_255_157)] animate-subtle-pulse' : ''}
                            ${isPast ? 'bg-brand-blue border-brand-blue/50' : 'bg-gray-600 border-gray-500'}
                            `}
                        // New animation properties
                        animate={{
                            scale: isCurrent ? 1.5 : 1, // Увеличиваем текущий
                            boxShadow: isCurrent ? '0 0 8px rgba(0, 255, 157, 0.6)' : 'none', // Добавляем тень текущему
                            transition: { type: "spring", stiffness: 400, damping: 15 },
                        }}
                        title={`Вопрос ${index + 1}`}
                    />
                );
            })}
        </div>
    );
};