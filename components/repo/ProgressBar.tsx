"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { FetchStatus } from '@/contexts/RepoXmlPageContext'; 
import { cn } from '@/lib/utils';

interface ProgressBarProps {
    status: FetchStatus | 'idle' | 'loading' | 'success' | 'error' | 'retrying' | 'failed_retries';
    progress: number; 
}

const ProgressBar: React.FC<ProgressBarProps> = ({ status, progress }) => {
    let barColorClasses = "from-brand-purple to-brand-cyan"; // Default/loading/retrying
    
    if (status === 'success') {
        barColorClasses = "from-brand-green to-emerald-500"; // emerald-500 is a Tailwind default
    } else if (status === 'error' || status === 'failed_retries') {
        barColorClasses = "from-destructive to-pink-500"; // destructive is from our theme, pink-500 is Tailwind default
    } else if (status === 'idle') {
         return null; 
    }

    return (
        <div className={cn(
            "w-full rounded-full h-1.5 overflow-hidden my-1",
            "bg-muted/70 dark:bg-muted/30" // Track background
        )}>
            <motion.div
                className={cn(
                    `h-1.5 rounded-full bg-gradient-to-r shadow-md shadow-ring/50`,
                    barColorClasses
                )}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{
                    duration: (status === 'loading' || status === 'retrying') ? 0.2 : 0.3, 
                    ease: "linear"
                 }}
            />
        </div>
    );
};

export default ProgressBar;