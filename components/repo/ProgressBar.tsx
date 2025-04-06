import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
    status: 'idle' | 'loading' | 'success' | 'error';
    progress: number; // Percentage (0-100)
}

const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress }) => {
    let barColorClass = "from-purple-600 to-cyan-500"; // Default/loading
    if (status === 'success') {
        barColorClass = "from-green-500 to-emerald-500";
    } else if (status === 'error') {
        barColorClass = "from-red-500 to-pink-500";
    }

    return (
        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <motion.div
                className={`h-1.5 rounded-full bg-gradient-to-r ${barColorClass} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: status === 'loading' ? 0.1 : 0.5, ease: "linear" }} // Faster update during loading
            />
        </div>
    );
};

export default ProgressBar;