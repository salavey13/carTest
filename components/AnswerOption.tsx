import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Circle } from "lucide-react";
import ReactMarkdown from 'react-markdown'; // <--- Import ReactMarkdown
import type { VprAnswerData } from "@/app/vpr-test/[subjectId]/page"; // Adjust import path if needed

interface AnswerOptionProps {
  answer: VprAnswerData;
  isSelected: boolean;
  showCorrectness: boolean;
  showIncorrectness: boolean;
  isDisabled: boolean;
  onClick: (answer: VprAnswerData) => void;
  isDummyHighlighted?: boolean;
}

export function AnswerOption({
  answer,
  isSelected,
  showCorrectness,
  showIncorrectness,
  isDisabled,
  onClick,
  isDummyHighlighted = false,
}: AnswerOptionProps) {

  const getBaseClasses = () => {
    // Adjusted padding slightly for potential markdown content
    let classes = "flex items-start w-full p-3 rounded-lg border transition-all duration-200 cursor-pointer text-left ";
    if (isDisabled) {
        classes += "cursor-not-allowed opacity-70 "; // Added opacity feedback for disabled
    } else {
        classes += "hover:bg-brand-blue/10 ";
    }
    return classes;
  };

  const getVariantClasses = () => {
    if (showCorrectness) {
        return "border-green-500 bg-green-900/30 text-green-200 scale-[1.01]";
    }
    if (showIncorrectness) {
        return "border-red-500 bg-red-900/30 text-red-200";
    }
    if (isDummyHighlighted) {
        return "border-yellow-500 bg-yellow-900/20 ring-2 ring-yellow-500/70 ring-offset-2 ring-offset-dark-card text-yellow-200 scale-[1.01]";
    }
    if (isSelected) {
        return "border-brand-blue bg-brand-blue/20 text-light-text";
    }
    return "border-gray-700 bg-dark-bg/50 hover:border-brand-blue/50 text-gray-300";
  };

  const IconComponent = showCorrectness || isDummyHighlighted
    ? CheckCircle2
    : showIncorrectness
    ? XCircle
    : Circle;

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
        {/* Icon aligned to the top */}
      <IconComponent className={`h-5 w-5 mr-3 mt-1 flex-shrink-0 ${iconColor}`} />
      {/* Use ReactMarkdown for the answer text */}
      {/* Added prose classes for basic styling of potential markdown (like images) */}
      <div className="flex-grow prose prose-sm prose-invert max-w-none text-current prose-p:my-0 prose-img:max-w-[80px] prose-img:max-h-[50px] prose-img:inline-block prose-img:mx-1 prose-img:align-middle prose-img:rounded">
           <ReactMarkdown>{answer.text}</ReactMarkdown>
      </div>
    </motion.button>
  );
}