import React from 'react';
import { motion } from 'framer-motion';
import { FetchStatus } from '@/contexts/RepoXmlPageContext'; // Import FetchStatus if needed for typing

interface ProgressBarProps {
    // Use a union including the specific fetch statuses for better type safety
    status: FetchStatus | 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
    progress: number; // Percentage (0-100)
}

const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress }) => {
    let barColorClass = "from-purple-600 to-cyan-500"; // Default/loading/retrying
    let shouldAnimate = true;

    if (status === 'success') {
        barColorClass = "from-green-500 to-emerald-500";
    } else if (status === 'error' || status === 'failed_retries') {
        barColorClass = "from-red-500 to-pink-500";
        // Optional: Stop animation on error? Or let it complete to current progress?
        // For error, we usually want it to be static (at 0 or last known progress)
        // Let's make it static at the current 'progress' value passed (likely 0 on error reset)
        shouldAnimate = false; // Don't animate width on error states
    } else if (status === 'idle') {
         // Don't show or animate if idle
         return null; // Or return an empty div if needed for layout consistency
    }

    return (
        <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden my-1"> {/* Added margin */}
            <motion.div
                className={`h-1.5 rounded-full bg-gradient-to-r ${barColorClass} shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
                initial={{ width: 0 }}
                // Animate only if not in error state
                animate={{ width: `${progress}%` }}
                transition={{
                    duration: (status === 'loading' || status === 'retrying') ? 0.2 : 0.5, // Faster updates during loading/retrying simulation ticks
                    ease: "linear"
                 }}
            />
        </div>
    );
};

export default ProgressBar;