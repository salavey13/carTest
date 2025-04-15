"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { FaPaperPlane } from 'react-icons/fa6';
import { Tooltip } from '@/components/AICodeAssistant'; // Assuming Tooltip is exported or importable

interface Suggestion {
    id: string;
    text: string;
    link?: string;
    action?: () => void | Promise<void>;
    icon?: React.ReactNode;
    isHireMe?: boolean;
    isFixAction?: boolean;
    disabled?: boolean;
    tooltip?: string; // Added tooltip prop
}

interface SuggestionListProps {
    suggestions: Suggestion[];
    onSuggestionClick: (suggestion: Suggestion) => void;
    listVariants: any; // Or define specific variant type
    itemVariants: any; // Or define specific variant type
    className?: string; // Allow custom class for alignment
}

export const SuggestionList: React.FC<SuggestionListProps> = ({
    suggestions,
    onSuggestionClick,
    listVariants,
    itemVariants,
    className = ''
}) => {
    return (
        <motion.div
            variants={listVariants}
            className={clsx("space-y-2 w-full flex-grow", className)} // Apply alignment class
        >
            <AnimatePresence initial={false}>
                {suggestions.map((suggestion) => (
                    <motion.button
                        key={suggestion.id}
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        layout
                        onClick={() => onSuggestionClick(suggestion)}
                        disabled={suggestion.disabled}
                        whileHover={!suggestion.disabled ? { scale: 1.03, x: 3 } : {}} // Add subtle hover effect
                        whileTap={!suggestion.disabled ? { scale: 0.98 } : {}}     // Add subtle tap effect
                        className={clsx( // Dynamically apply classes
                            "flex items-center w-full text-left px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ease-in-out", // Changed to rounded-lg
                            "shadow-[0_0_8px_rgba(0,255,157,0.3)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-opacity-75",
                            { // Conditional classes
                                "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-400 hover:to-orange-400": suggestion.isHireMe && !suggestion.disabled,
                                "bg-gray-700 bg-opacity-80 text-cyan-400 hover:bg-opacity-90 hover:text-cyan-300": !suggestion.isHireMe && !suggestion.disabled,
                                "bg-gray-600 bg-opacity-50 text-gray-400 cursor-not-allowed": suggestion.disabled,
                                "hover:shadow-[0_0_14px_rgba(0,255,157,0.6)]": !suggestion.disabled,
                            }
                        )}
                    >
                        {/* Wrap button content in Tooltip if tooltip text exists */}
                        {suggestion.tooltip ? (
                            <Tooltip text={suggestion.tooltip} position="right">
                                <div className="flex items-center w-full">
                                    {suggestion.icon || <FaPaperPlane className="mr-1.5" />}
                                    <span className="flex-grow">{suggestion.text}</span>
                                </div>
                            </Tooltip>
                        ) : (
                            <div className="flex items-center w-full">
                                {suggestion.icon || <FaPaperPlane className="mr-1.5" />}
                                <span className="flex-grow">{suggestion.text}</span>
                            </div>
                        )}
                    </motion.button>
                ))}
            </AnimatePresence>
        </motion.div>
    );
};

SuggestionList.displayName = 'SuggestionList';