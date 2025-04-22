"use client";

"use client"; // Add "use client" directive

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx"; // Assuming clsx is used, or cn from lib/utils

// Define the Tooltip component
export const Tooltip = ({ children, text, position = 'bottom' }: {
    children: React.ReactNode;
    text: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}) => {
    const [isVisible, setIsVisible] = useState(false);

    // Position classes map - adjust tailwind classes as needed
    const positionClasses = {
        top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-1',
        bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-1',
        left: 'right-full top-1/2 transform -translate-y-1/2 mr-1', // Adjusted transform for better vertical centering
        right: 'left-full top-1/2 transform -translate-y-1/2 ml-1', // Adjusted transform
    };

    return (
        <div className="relative inline-block group">
            {/* Trigger Element */}
            <div
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            >
                {children}
            </div>

            {/* Tooltip Content */}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        className={clsx(
                            "absolute z-[70] p-2 bg-gray-700 text-white text-[13px] rounded-lg shadow-lg w-max max-w-xs whitespace-pre-line", // Ensure z-index is high enough
                            positionClasses[position]
                        )}
                        role="tooltip" // Add role for accessibility
                    >
                        {text}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

Tooltip.displayName = 'Tooltip'; // Keep displayName

// Optional: Export as default if preferred
// export default Tooltip;