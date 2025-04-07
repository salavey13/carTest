// /components/stickyChat_components/FloatingActionButton.tsx
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FaRobot } from 'react-icons/fa6';

interface FloatingActionButtonProps {
    onClick: () => void;
    variants: any; // Or define specific variant type
    // Optional: Add className prop if you want *extra* styling from parent
    // className?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
    onClick,
    variants,
    // className: extraClassName = '', // Uncomment if using optional className prop
}) => {
    // Base classes for appearance and interaction, *without* positioning
    const baseClasses = `
        bg-cyan-600 hover:bg-cyan-500 text-white
        p-3.5 rounded-full
        shadow-[0_0_15px_rgba(0,255,157,0.7)] hover:shadow-[0_0_20px_rgba(0,255,157,0.9)]
        transition-all duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900
    `; // Removed: fixed, bottom-*, right-*, sm:bottom-*, sm:right-*, z-40

    return (
        <motion.button
            key="fab" // Keep key for AnimatePresence
            aria-label="Открыть меню помощи Xuinity"
            onClick={onClick}
            // Combine base classes with any optional extra classes
            // className={`${baseClasses} ${extraClassName}`} // Use this if you add optional className prop
            className={baseClasses} // Use this simpler version if no extra className prop needed
            variants={variants}
            initial="hidden"
            animate="visible"
            exit="exit"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
        >
            <FaRobot className="text-2xl" aria-hidden="true" />
        </motion.button>
    );
};

FloatingActionButton.displayName = 'FloatingActionButton';
