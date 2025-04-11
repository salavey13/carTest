// /components/repo/SettingsModal.tsx
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCodeBranch, FaList, FaCheck, FaExternalLinkAlt, FaArrowsRotate } from 'react-icons/fa6'; // Updated icons
import { SimplePullRequest } from '@/contexts/RepoXmlPageContext'; // Import type
import { Tooltip } from '../AICodeAssistant'; // Assuming Tooltip is accessible

interface SettingsModalProps {
    isOpen: boolean;
    // onClose: () => void; // Removed, closure handled by context toggle
    repoUrl: string;
    setRepoUrl: (url: string) => void;
    token: string;
    setToken: (token: string) => void;
    manualBranchName: string;
    setManualBranchName: (name: string) => void;
    currentTargetBranch: string | null; // Effective target branch from context
    // PR Selection Props
    openPrs: SimplePullRequest[];
    loadingPrs: boolean;
    onSelectPrBranch: (branchName: string | null) => void; // Callback for selection
    onLoadPrs: () => void; // Callback to trigger PR loading

    loading: boolean; // General loading (fetch)
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    // onClose,
    repoUrl,
    setRepoUrl,
    token,
    setToken,
    manualBranchName,
    setManualBranchName,
    currentTargetBranch, // This now reflects the *effective* target branch
    // PR Props
    openPrs,
    loadingPrs,
    onSelectPrBranch,
    onLoadPrs,
    loading, // General loading
}) => {

    const getTargetBranchDisplay = () => {
        // Display relies on the `currentTargetBranch` passed from context,
        // which should already factor in manual input vs PR selection.
        if (currentTargetBranch) return `Current Target: ${currentTargetBranch}`;
        return "Current Target: Default Branch";
    };

    // Determine if the "Default" button should be marked as active
    // Active if no PR is selected AND manual input is empty.
    // We need a way to know if currentTargetBranch comes from a PR or manual input.
    // Let's simplify: Active if `currentTargetBranch` is null.
    const isDefaultBranchActive = !currentTargetBranch;

    // Determine if a specific PR's branch is the active target
    const isPrBranchActive = (prBranch: string) => {
         // Active if current target matches PR branch AND manual input is empty
         return currentTargetBranch === prBranch && !manualBranchName.trim();
    };


    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: '0.75rem' }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mb-4 border border-purple-700 rounded-lg p-4 bg-gray-800 shadow-xl z-20 relative" // Added z-index if needed
                >
                    <h3 className="text-lg font-semibold text-purple-300 mb-4">Настройки и Выбор Ветки</h3>

                    <div className="flex flex-col gap-5"> {/* Increased gap */}

                         {/* Current Target Branch Display */}
                        <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-900/50 p-2 rounded-md border border-gray-700">
                            <FaCodeBranch className="text-cyan-400 flex-shrink-0" />
                            <span className="font-semibold text-cyan-300 truncate" title={getTargetBranchDisplay()}>
                                {getTargetBranchDisplay()}
                            </span>
                        </div>

                        {/* --- PR Selection Section --- */}
                        <div className="border border-gray-700 p-3 rounded-lg bg-gray-800/50">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-base font-semibold text-purple-300 flex items-center gap-2">
                                    <FaList /> Выберите PR для извлечения/обновления ветки:
                                </h4>
                                <div className="flex items-center gap-2">
                                    <Tooltip text="Использовать ветку по умолчанию">
                                        <button
                                           onClick={() => onSelectPrBranch(null)}
                                           disabled={loading || loadingPrs}
                                           className={`text-xs px-3 py-1 rounded ${
                                               isDefaultBranchActive && !manualBranchName.trim() // Active if default AND no manual input
                                               ? 'bg-purple-600 ring-2 ring-purple-400 font-semibold'
                                               : 'bg-gray-600 hover:bg-gray-500'} transition text-white disabled:opacity-50`}
                                         >
                                           Default
                                        </button>
                                     </Tooltip>
                                     <Tooltip text="Обновить список PR">
                                          <button onClick={onLoadPrs} disabled={loading || loadingPrs || !repoUrl.includes('github.com')} className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition">
                                              {loadingPrs ? <FaArrowsRotate className="animate-spin"/> : <FaList />}
                                          </button>
                                     </Tooltip>
                                </div>
                            </div>
                            {openPrs.length > 0 ? (
                                <ul className="space-y-1 max-h-48 overflow-y-auto pr-2 simple-scrollbar">
                                   {openPrs.map((pr) => (
                                        <li key={pr.id}>
                                            <button
                                                onClick={() => onSelectPrBranch(pr.head.ref)}
                                                disabled={loading || loadingPrs}
                                                className={`w-full flex items-center justify-between gap-2 p-2 rounded text-left text-sm transition ${
                                                    isPrBranchActive(pr.head.ref) // Check if this PR branch is active
                                                    ? 'bg-purple-700/80 ring-2 ring-purple-400 shadow-md'
                                                    : 'bg-gray-700/50 hover:bg-gray-600/70 disabled:opacity-50'
                                                }`}
                                                title={`Select branch: ${pr.head.ref}\nPR: ${pr.title}`}
                                            >
                                                <div className="flex items-center gap-2 flex-grow min-w-0">
                                                     {isPrBranchActive(pr.head.ref) && <FaCheck className="text-green-400 flex-shrink-0" />}
                                                     <span className="text-purple-300 font-medium flex-shrink-0">#{pr.number}:</span>
                                                     <span className="text-gray-200 truncate flex-grow" title={pr.title}>{pr.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                     <span className="text-xs text-gray-400 ml-2 truncate" title={`Branch: ${pr.head.ref}`}>
                                                         ({pr.head.ref})
                                                     </span>
                                                      <a href={pr.html_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-500 hover:text-blue-400" title="Open PR on GitHub">
                                                           <FaExternalLinkAlt size={12} />
                                                      </a>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-center text-gray-500 py-2">
                                    {loadingPrs ? 'Загрузка PR...' : 'Нет открытых PR или не загружены.'}
                                </p>
                            )}
                        </div>
                        {/* --- End PR Selection Section --- */}


                        {/* Repo URL Input */}
                        <div>
                            <label htmlFor="settings-repo-url" className="block text-sm font-medium mb-1 text-cyan-300">URL репозитория GitHub</label>
                            <input id="settings-repo-url" type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400 disabled:opacity-50" placeholder="https://github.com/username/repository" disabled={loading || loadingPrs} aria-label="URL репозитория GitHub" />
                        </div>

                        {/* GitHub Token Input */}
                        <div>
                            <label htmlFor="settings-token" className="block text-sm font-medium mb-1 text-cyan-300">Токен GitHub <span className="text-gray-400">(опционально)</span></label>
                            <input id="settings-token" type="password" value={token} onChange={(e) => setToken(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400 disabled:opacity-50" placeholder="Personal Access Token" disabled={loading || loadingPrs} aria-label="Токен GitHub" />
                        </div>

                        {/* Manual Branch Name Input */}
                        <div>
                            <label htmlFor="settings-manual-branch" className="block text-sm font-medium mb-1 text-cyan-300">
                                Имя ветки вручную <span className="text-gray-400">(переопределяет выбор PR)</span>
                            </label>
                            <input id="settings-manual-branch" type="text" value={manualBranchName} onChange={(e) => setManualBranchName(e.target.value)} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400 disabled:opacity-50" placeholder="main, dev, feature/..." disabled={loading || loadingPrs} aria-label="Имя ветки вручную" />
                             <p className="text-xs text-gray-400 mt-1">Оставьте пустым для использования ветки из выбранного PR или ветки по умолчанию.</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SettingsModal;