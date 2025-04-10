// /components/assistant_components/PullRequestForm.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from '../AICodeAssistant'; // Adjust path
import { FaRotate } from 'react-icons/fa6'; // Removed FaList

interface PullRequestFormProps {
    repoUrl: string;
    prTitle: string;
    selectedFileCount: number;
    isLoading: boolean; // General loading (e.g., PR creation)
    // isLoadingPrList removed
    onRepoUrlChange: (value: string) => void;
    onPrTitleChange: (value: string) => void;
    onCreatePR: () => void;
    // onGetOpenPRs removed
}

export const PullRequestForm: React.FC<PullRequestFormProps> = ({
    repoUrl,
    prTitle,
    selectedFileCount,
    isLoading,
    // isLoadingPrList, // Removed
    onRepoUrlChange,
    onPrTitleChange,
    onCreatePR,
    // onGetOpenPRs // Removed
}) => {
    const [showPRDetails, setShowPRDetails] = useState(false);

    return (
        <section id="pr-section" className="mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-2">
                <h2 className="text-lg font-semibold text-cyan-400">
                    Pull Request ({selectedFileCount} файлов)
                </h2>
                <div className="flex gap-2 items-center">
                    <motion.button
                        className="px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-green-500 to-emerald-500 transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        onClick={onCreatePR}
                        disabled={isLoading || selectedFileCount === 0 || !prTitle || !repoUrl}
                        whileHover={{ scale: (isLoading || selectedFileCount === 0) ? 1 : 1.05 }}
                        whileTap={{ scale: (isLoading || selectedFileCount === 0) ? 1 : 0.95 }}
                    >
                         {isLoading ? <FaRotate className="animate-spin inline mr-1" /> : null}
                        Создать PR
                    </motion.button>
                    {/* Removed PR List Refresh Button */}
                    <Tooltip text="Показать/скрыть детали PR" position="top">
                       <button className="text-blue-400 hover:text-blue-300 transition text-sm p-1" onClick={() => setShowPRDetails(!showPRDetails)}>
                           {showPRDetails ? "Скрыть детали" : "Показать детали"}
                       </button>
                   </Tooltip>
                </div>
            </div>

            {/* Collapsible PR Details Form */}
            <AnimatePresence>
                {showPRDetails && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mt-2 space-y-3 overflow-hidden bg-gray-800/50 p-4 rounded-lg border border-gray-700"
                    >
                        <p className="text-gray-400 text-xs mb-2">
                            Заголовок PR и URL репозитория. Описание и коммит будут сгенерированы автоматически.
                        </p>
                        <div>
                            <label className="block text-sm font-medium mb-1">URL репозитория</label>
                            <input
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white"
                                value={repoUrl}
                                onChange={(e) => onRepoUrlChange(e.target.value)}
                                placeholder="https://github.com/username/repository"
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Заголовок PR</label>
                            <input
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white"
                                value={prTitle}
                                onChange={(e) => onPrTitleChange(e.target.value)}
                                placeholder="Краткий заголовок для Pull Request (макс 70 симв.)"
                                maxLength={70}
                                disabled={isLoading}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};
PullRequestForm.displayName = 'PullRequestForm';