"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FaRobot } from 'react-icons/fa6';

interface FloatingActionButtonProps {
    onClick: () => void;
    variants: any; // Or define specific variant type
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick, variants }) => {
    return (
        <motion.button
            key="fab" // Keep key for AnimatePresence
            aria-label="Открыть меню помощи Xuinity"
            onClick={onClick}
            className="fixed bottom-6 right-6 sm:bottom-8 sm:right-16 bg-cyan-600 hover:bg-cyan-500 text-white p-3.5 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.7)] hover:shadow-[0_0_20px_rgba(0,255,157,0.9)] transition-all duration-200 ease-in-out z-40 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900"
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

FloatingActionButton.displayName = 'FloatingActionButton'; // Good practice