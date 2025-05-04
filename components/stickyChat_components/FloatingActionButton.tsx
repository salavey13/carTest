"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FaRobot } from 'react-icons/fa6'; // Keep FaRobot as main icon

interface FloatingActionButtonProps {
    onClick: () => void;
    variants?: any; // Variants are optional now
    icon?: React.ReactNode; // Allow custom icon
    className?: string; // Allow custom styling from parent
    'aria-label'?: string; // Allow custom aria-label
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
    onClick,
    variants, // Receive variants but apply conditionally
    icon = <FaRobot className="text-2xl" aria-hidden="true" />, // Default icon
    className = '',
    'aria-label': ariaLabel = "Открыть меню помощи Xuinity",
}) => {
    // Base classes for appearance and interaction, *without* positioning
    const baseClasses = `
        p-3.5 rounded-full
        shadow-[0_0_15px_rgba(0,255,157,0.7)] hover:shadow-[0_0_20px_rgba(0,255,157,0.9)]
        transition-all duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900
    `; // Removed positioning and specific bg/text color

    // Default styling (can be overridden by className)
    const defaultStyleClasses = `
        bg-cyan-600 hover:bg-cyan-500 text-white
    `;

    // Use motion.button only if variants are provided
    const ButtonComponent = variants ? motion.button : 'button';
    const commonProps = {
        'aria-label': ariaLabel,
        onClick: onClick,
        className: `${baseClasses} ${defaultStyleClasses} ${className}`, // Apply default styles first, then allow override
    };
    const motionProps = variants ? {
        key: "fab", // Keep key for AnimatePresence if using motion
        variants: variants,
        initial: "hidden",
        animate: "visible",
        exit: "exit",
        whileHover: { scale: 1.1 },
        whileTap: { scale: 0.95 },
    } : {};


    return (
        <ButtonComponent {...commonProps} {...motionProps}>
            {icon}
        </ButtonComponent>
    );
};

FloatingActionButton.displayName = 'FloatingActionButton';