import { motion } from 'framer-motion';
import { CheckCircle, XCircle } from 'lucide-react';
// Import type from the correct location
import type { VprAnswerData } from '@/app/vpr-test/[subjectId]/page';

// Interface remains the same as current context
interface AnswerOptionProps {
    answer: VprAnswerData;
    isSelected: boolean;
    showCorrectness: boolean;
    showIncorrectness: boolean;
    isDisabled: boolean;
    onClick: (answer: VprAnswerData) => void;
}

export const AnswerOption = ({
    answer,
    isSelected,
    showCorrectness,
    showIncorrectness,
    isDisabled,
    onClick
}: AnswerOptionProps) => {

    // --- New class definitions for dark theme ---
    const baseClasses = "w-full text-left p-3.5 md:p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-between group text-base md:text-lg shadow-md";
    const interactionClasses = isDisabled
        ? 'cursor-not-allowed opacity-60' // Adjusted opacity for dark
        : 'hover:bg-brand-blue/10 hover:border-brand-blue cursor-pointer'; // New hover effect
    const selectedClasses = isSelected ? 'ring-2 ring-offset-2 ring-offset-dark-card ring-brand-green border-brand-green' : 'border-gray-600 hover:border-brand-blue'; // New selected styles
    const correctClasses = showCorrectness ? 'bg-green-600/30 border-brand-green text-white' : ''; // New correct style
    const incorrectClasses = showIncorrectness ? 'bg-red-600/30 border-brand-pink text-white' : ''; // New incorrect style
    const textClasses = (showCorrectness || showIncorrectness) ? 'font-semibold' : 'text-light-text/90'; // New text color logic
    // --- End new class definitions ---

    return (
        <motion.button
            onClick={() => onClick(answer)}
            disabled={isDisabled}
            // Combine classes using new logic. Order matters.
            className={`${baseClasses} ${isDisabled ? '' : interactionClasses} ${isSelected ? selectedClasses : 'border-gray-600'} ${correctClasses} ${incorrectClasses}`}
            // New hover/tap animations
            whileHover={!isDisabled ? { scale: 1.03, y: -2, boxShadow: '0 6px 20px rgba(0, 194, 255, 0.2)' } : {}}
            whileTap={!isDisabled ? { scale: 0.97 } : {}}
            layout // Keep layout animation
        >
            <span className={`${textClasses} mr-2`}>
                {answer.text}
            </span>
            {/* Icons with updated colors */}
            <div className="flex-shrink-0">
                 {showCorrectness && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <CheckCircle className="h-6 w-6 text-brand-green" /> {/* New Color */}
                    </motion.div>
                 )}
                 {showIncorrectness && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <XCircle className="h-6 w-6 text-brand-pink" /> {/* New Color */}
                    </motion.div>
                 )}
            </div>
        </motion.button>
    );
};