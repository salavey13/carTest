"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface SpeechBubbleProps {
    message: string;
    variants: any; // Or define specific variant type
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({ message, variants }) => {
    return (
        // REMOVED key={message} from this motion.div
        <motion.div
            variants={variants}
            className="relative mb-3 w-full bg-white bg-opacity-95 p-3 rounded-full shadow-[0_0_15px_rgba(0,255,157,0.6)]"
        >
            {/* Text slightly smaller to fit potentially longer messages */}
            <p className="text-[13px] sm:text-sm text-gray-800 font-semibold text-center sm:text-left">{message}</p>
            {/* Triangle pointer */}
            <div className="absolute -bottom-2 left-1/2 sm:left-16 transform -translate-x-1/2 sm:translate-x-0 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-t-white border-opacity-95" />
        </motion.div>
    );
};

SpeechBubble.displayName = 'SpeechBubble';