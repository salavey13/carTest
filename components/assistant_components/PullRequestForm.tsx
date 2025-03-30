import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from '../AICodeAssistant'; // Adjust import path if Tooltip is moved outside
import { FaList, FaRotate, FaAngleDown, FaAngleUp } from 'react-icons/fa6'; // Using fa6 icons

interface PullRequestFormProps {
    repoUrl: string;
    prTitle: string;
    selectedFileCount: number;
    isLoading: boolean; // Is PR creation in progress?
    isLoadingPrList: boolean; // Is fetching PR list in progress?
    onRepoUrlChange: (value: string) => void;
    onPrTitleChange: (value: string) => void;
    onCreatePR: () => void;
    onGetOpenPRs: () => void;
}

export const PullRequestForm: React.FC<PullRequestFormProps> = ({
    repoUrl,
    prTitle,
    selectedFileCount,
    isLoading,
    isLoadingPrList,
    onRepoUrlChange,
    onPrTitleChange,
    onCreatePR,
    onGetOpenPRs
}) => {
    const [showPRDetails, setShowPRDetails] = useState(false); // State to toggle form visibility

    return (
        <section id="pr-section" className="mb-4">
            {/* Header Row */}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-3 gap-2">
                <h2 className="text-lg font-semibold text-cyan-400">
                    Pull Request ({selectedFileCount} файлов)
                </h2>
                {/* Action Buttons */}
                <div className="flex gap-2 items-center">
                    {/* Create PR Button - NOW ROUNDED */}
                    <motion.button
                        className="px-5 py-2 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-green-500 to-emerald-500 transition-all shadow-[0_0_12px_rgba(16,185,129,0.4)] hover:shadow-[0_0_18px_rgba(16,185,129,0.6)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none" // Use rounded-full
                        onClick={onCreatePR}
                        disabled={isLoading || selectedFileCount === 0 || !prTitle || !repoUrl}
                        whileHover={{ scale: (isLoading || selectedFileCount === 0 || !prTitle || !repoUrl) ? 1 : 1.05 }}
                        whileTap={{ scale: (isLoading || selectedFileCount === 0 || !prTitle || !repoUrl) ? 1 : 0.95 }}
                        title={selectedFileCount === 0 ? "Сначала выберите файлы" : !prTitle ? "Введите заголовок PR" : !repoUrl ? "Введите URL репозитория" : "Создать Pull Request"}
                    >
                         {isLoading ? <FaRotate className="animate-spin inline mr-1" /> : null}
                        Создать PR
                    </motion.button>
                    {/* Refresh PR List Button */}
                    <Tooltip text="Обновить список открытых PR" position="top">
                        <button className="p-2 text-gray-400 hover:text-white transition disabled:opacity-50" onClick={onGetOpenPRs} disabled={isLoadingPrList || !repoUrl}>
                            {isLoadingPrList ? <FaRotate className="animate-spin"/> : <FaList />}
                        </button>
                    </Tooltip>
                    {/* Toggle Details Button */}
                    <Tooltip text="Показать/скрыть детали PR" position="top">
                       <button
                            className="text-blue-400 hover:text-blue-300 transition text-sm p-1 flex items-center gap-1"
                            onClick={() => setShowPRDetails(!showPRDetails)}
                        >
                           {showPRDetails ? "Скрыть" : "Детали"}
                           {showPRDetails ? <FaAngleUp size={12} /> : <FaAngleDown size={12} />}
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
                            Заголовок PR и URL репозитория. Описание и коммит будут сгенерированы автоматически из текста AI и выбранных файлов.
                        </p>
                        {/* Repo URL Input */}
                        <div>
                            <label htmlFor="pr-repo-url" className="block text-sm font-medium mb-1 text-gray-300">URL репозитория</label>
                            <input
                                id="pr-repo-url"
                                type="text"
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white"
                                value={repoUrl}
                                onChange={(e) => onRepoUrlChange(e.target.value)}
                                placeholder="https://github.com/username/repository"
                                disabled={isLoading}
                            />
                        </div>
                        {/* PR Title Input */}
                        <div>
                            <label htmlFor="pr-title" className="block text-sm font-medium mb-1 text-gray-300">Заголовок PR</label>
                            <input
                                id="pr-title"
                                type="text"
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