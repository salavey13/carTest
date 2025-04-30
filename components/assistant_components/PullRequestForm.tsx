"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// --- FIX: Add necessary icon imports ---
import { FaRotate, FaCodeBranch, FaGithub, FaSpinner } from 'react-icons/fa6';

interface PullRequestFormProps {
    id?: string;
    repoUrl: string;
    prTitle: string;
    selectedFileCount: number;
    isLoading: boolean; // Combined loading state for PR/Update process
    isLoadingPrList?: boolean;
    onRepoUrlChange: (value: string) => void;
    onPrTitleChange: (value: string) => void;
    onCreatePR: () => void;
    buttonText: string;
    buttonIcon: React.ReactNode; // Expecting a node (like <FaIcon/> or <FaSpinner/>)
    isSubmitDisabled: boolean;
}

export const PullRequestForm: React.FC<PullRequestFormProps> = ({
    id,
    repoUrl,
    prTitle,
    selectedFileCount,
    isLoading, // Use the general PR/Update loading state
    isLoadingPrList,
    onRepoUrlChange,
    onPrTitleChange,
    onCreatePR,
    buttonText,
    buttonIcon, // Receive the pre-calculated icon node
    isSubmitDisabled
}) => {
    const [showPRDetails, setShowPRDetails] = useState(false);

    return (
        <section id={id || "pr-section"} className="mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-2">
                <h2 className="text-lg font-semibold text-cyan-400">
                    {buttonText.includes("Обновить") ? "Обновление Ветки" : "Pull Request"} ({selectedFileCount} файлов)
                </h2>
                <div className="flex gap-2 items-center">
                    <motion.button
                        className={`px-4 py-2 rounded-lg font-semibold text-sm text-white transition-all ${
                            buttonText.includes("Обновить")
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-[0_0_12px_rgba(249,115,22,0.4)] hover:shadow-[0_0_18px_rgba(249,115,22,0.6)]'
                            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.6)]'
                         } disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`}
                        onClick={onCreatePR}
                        disabled={isSubmitDisabled || isLoading}
                        whileHover={{ scale: (isSubmitDisabled || isLoading) ? 1 : 1.05 }}
                        whileTap={{ scale: (isSubmitDisabled || isLoading) ? 1 : 0.95 }}
                        title={buttonText}
                    >
                         {/* Render the pre-calculated icon passed via props */}
                         <span className="inline-flex items-center mr-1">{buttonIcon}</span>
                        {buttonText}
                    </motion.button>
                    <button className="text-blue-400 hover:text-blue-300 transition text-sm p-1" onClick={() => setShowPRDetails(!showPRDetails)} title="Показать/скрыть детали">
                           {showPRDetails ? "Скрыть детали" : "Детали"}
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {showPRDetails && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-800/60 rounded-lg border border-gray-700">
                            <div>
                                <label htmlFor="repo-url-input" className="block text-xs font-medium text-gray-400 mb-1">URL Репозитория</label>
                                <input
                                    id="repo-url-input" type="text" value={repoUrl} onChange={(e) => onRepoUrlChange(e.target.value)}
                                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-xs text-white disabled:opacity-50"
                                    placeholder="https://github.com/owner/repo" disabled={isLoading}
                                />
                            </div>
                            <div>
                                <label htmlFor="pr-title-input" className="block text-xs font-medium text-gray-400 mb-1">Заголовок PR/Commit</label>
                                <input
                                    id="pr-title-input" type="text" value={prTitle} onChange={(e) => onPrTitleChange(e.target.value)}
                                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-xs text-white disabled:opacity-50"
                                    placeholder="Краткое описание изменений..." disabled={isLoading} maxLength={100}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};
PullRequestForm.displayName = 'PullRequestForm';