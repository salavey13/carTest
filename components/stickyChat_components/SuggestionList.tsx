"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { FaPaperPlane } from 'react-icons/fa6';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'; // Import Tooltip components

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
        <TooltipProvider delayDuration={100}> {/* Provide tooltip context */}
            <motion.div
                variants={listVariants}
                className={clsx("space-y-2 w-full flex-grow", className)} // Apply alignment class
            >
                <AnimatePresence initial={false}>
                    {suggestions.map((suggestion) => (
                        <Tooltip key={suggestion.id}>
                            <TooltipTrigger asChild>
                                <motion.button
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
                                        "flex items-center w-full text-left px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ease-in-out",
                                        "shadow-[0_0_8px_hsl(var(--brand-green)/0.3)] focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:ring-opacity-75", // Use theme colors
                                        { // Conditional classes
                                            "bg-gradient-to-r from-brand-yellow to-brand-orange text-primary-foreground hover:from-brand-yellow/90 hover:to-brand-orange/90": suggestion.isHireMe && !suggestion.disabled, // Use theme colors
                                            "bg-card/80 text-muted-foreground hover:bg-muted/90 hover:text-primary-foreground": !suggestion.isHireMe && !suggestion.disabled, // Use theme colors
                                            "bg-muted/50 text-muted-foreground cursor-not-allowed": suggestion.disabled, // Use theme colors
                                            "hover:shadow-[0_0_14px_hsl(var(--brand-green)/0.6)]": !suggestion.disabled, // Use theme color
                                        }
                                    )}
                                >
                                    {/* Button content */}
                                    {suggestion.icon || <FaPaperPlane className="mr-1.5" />}
                                    <span className="flex-grow">{suggestion.text}</span>
                                </motion.button>
                            </TooltipTrigger>
                            {suggestion.tooltip && (
                                <TooltipContent side="left" className="bg-popover text-popover-foreground border-border text-xs rounded shadow-lg p-2"> {/* Use theme colors */}
                                    <p>{suggestion.tooltip}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    ))}
                </AnimatePresence>
            </motion.div>
        </TooltipProvider>
    );
};

SuggestionList.displayName = 'SuggestionList';
