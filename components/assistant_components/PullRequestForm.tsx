// /components/assistant_components/PullRequestForm.tsx
"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from '../AICodeAssistant';
import { FaRotate, FaCog } from 'react-icons/fa6'; // Added FaCog as a default/fallback

interface PullRequestFormProps {
    repoUrl: string;
    prTitle: string;
    selectedFileCount: number;
    isLoading: boolean;
    onRepoUrlChange: (value: string) => void;
    onPrTitleChange: (value: string) => void;
    onCreatePR: () => void;
    // NEW Props for button appearance
    buttonText: string;
    buttonIcon: React.ReactNode;
    isSubmitDisabled: boolean;
}

export const PullRequestForm: React.FC<PullRequestFormProps> = ({
    repoUrl,
    prTitle,
    selectedFileCount,
    isLoading,
    onRepoUrlChange,
    onPrTitleChange,
    onCreatePR,
    // NEW Props
    buttonText,
    buttonIcon,
    isSubmitDisabled
}) => {
    const [showPRDetails, setShowPRDetails] = useState(false);

    return (
        <section id="pr-section" className="mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-2">
                <h2 className="text-lg font-semibold text-cyan-400">
                    {/* Update title based on action? Optional */}
                    {buttonText.includes("Обновить") ? "Обновление Ветки" : "Pull Request"} ({selectedFileCount} файлов)
                </h2>
                <div className="flex gap-2 items-center">
                     {/* Submit Button */}
                    <motion.button
                        className={`px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all ${
                            buttonText.includes("Обновить")
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-[0_0_12px_rgba(249,115,22,0.4)] hover:shadow-[0_0_18px_rgba(249,115,22,0.6)]' // Orange for Update
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.6)]' // Green for Create
                         } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
                        onClick={onCreatePR}
                        disabled={isSubmitDisabled || isLoading} // Use combined disabled state
                        whileHover={{ scale: (isSubmitDisabled || isLoading) ? 1 : 1.05 }}
                        whileTap={{ scale: (isSubmitDisabled || isLoading) ? 1 : 0.95 }}
                        title={buttonText} // Use dynamic title
                    >
                         {isLoading ? <FaRotate className="animate-spin inline mr-1" /> : <span className="inline-flex items-center mr-1">{buttonIcon || <FaCog/>}</span>}
                        {buttonText}
                    </motion.button>
                    {/* Details Toggle Button */}
                    <Tooltip text="Показать/скрыть детали" position="top">
                       <button className="text-blue-400 hover:text-blue-300 transition text-sm p-1" onClick={() => setShowPRDetails(!showPRDetails)}>
                           {showPRDetails ? "Скрыть детали" : "Детали"}
                       </button>
                   </Tooltip>
                </div>
            </div>

            {/* Collapsible PR Details Form (Keep existing) */}
            <AnimatePresence>
                {showPRDetails && (
                    <motion.div /* ... */ >
                        {/* ... Repo URL and PR Title inputs ... */}
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};
PullRequestForm.displayName = 'PullRequestForm';