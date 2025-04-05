import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Circle } from "lucide-react";
import type { VprAnswerData } from "@/app/vpr-test/[subjectId]/page"; // Adjust import path if needed

interface AnswerOptionProps {
  answer: VprAnswerData;
  isSelected: boolean;
  showCorrectness: boolean;
  showIncorrectness: boolean;
  isDisabled: boolean;
  onClick: (answer: VprAnswerData) => void;
  isDummyHighlighted?: boolean; // <-- NEW PROP for dummy mode highlight
}

export function AnswerOption({
  answer,
  isSelected,
  showCorrectness,
  showIncorrectness,
  isDisabled,
  onClick,
  isDummyHighlighted = false, // <-- Default value
}: AnswerOptionProps) {

  const getBaseClasses = () => {
    let classes = "flex items-center w-full p-4 rounded-lg border transition-all duration-200 cursor-pointer text-left ";
    if (isDisabled) {
        classes += "cursor-not-allowed ";
    } else {
        classes += "hover:bg-brand-blue/10 ";
    }
    return classes;
  };

  const getVariantClasses = () => {
    if (showCorrectness) {
        return "border-green-500 bg-green-900/30 text-green-200 scale-[1.01]"; // Correct answer shown
    }
    if (showIncorrectness) {
        return "border-red-500 bg-red-900/30 text-red-200"; // Incorrect answer selected
    }
    if (isDummyHighlighted) { // Apply dummy highlight style if correct answer wasn't selected but dummy mode is on
        return "border-yellow-500 bg-yellow-900/20 ring-2 ring-yellow-500/70 ring-offset-2 ring-offset-dark-card text-yellow-200 scale-[1.01]"; // Highlight for dummy mode
    }
    if (isSelected) {
        return "border-brand-blue bg-brand-blue/20 text-light-text"; // Selected but feedback not shown yet
    }
    // Default / Not Selected
    return "border-gray-700 bg-dark-bg/50 hover:border-brand-blue/50 text-gray-300";
  };

  const IconComponent = showCorrectness || isDummyHighlighted
    ? CheckCircle2
    : showIncorrectness
    ? XCircle
    : Circle; // Default or selected but no feedback yet

  const iconColor = showCorrectness || isDummyHighlighted
    ? "text-green-400"
    : showIncorrectness
    ? "text-red-400"
    : isSelected
    ? "text-brand-blue"
    : "text-gray-500";

  return (
    <motion.button
      onClick={() => onClick(answer)}
      disabled={isDisabled}
      className={`${getBaseClasses()} ${getVariantClasses()}`}
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <IconComponent className={`h-5 w-5 mr-3 flex-shrink-0 ${iconColor}`} />
      <span className="flex-grow">{answer.text}</span>
    </motion.button>
  );
}