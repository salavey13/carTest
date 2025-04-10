// /components/repo/SettingsModal.tsx
"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCodeBranch } from 'react-icons/fa6'; // Import icon

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    repoUrl: string;
    setRepoUrl: (url: string) => void;
    token: string;
    setToken: (token: string) => void;
    manualBranchName: string; // New: manual branch input value
    setManualBranchName: (name: string) => void; // New: handler for manual branch
    currentTargetBranch: string | null; // New: display the final target branch
    loading: boolean; // To disable inputs during fetch
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    repoUrl,
    setRepoUrl,
    token,
    setToken,
    manualBranchName, // New prop
    setManualBranchName, // New prop
    currentTargetBranch, // New prop
    loading,
    // onClose, // Destructure if needed
}) => {

    // Determine the display text for the target branch
    const getTargetBranchDisplay = () => {
        if (manualBranchName.trim()) {
            return `Manual: ${manualBranchName.trim()}`;
        }
        if (currentTargetBranch) {
            // Assume if currentTargetBranch is set and manual is empty, it came from a PR
            // (This could be more explicit if needed, e.g., passing a 'source' prop)
            return `From PR: ${currentTargetBranch}`;
        }
        return "Default Branch"; // Fallback
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: '0.75rem' }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mb-4 border border-gray-700 rounded-lg p-4 bg-gray-800 shadow-lg"
                >
                    <div className="flex flex-col gap-4"> {/* Increased gap */}
                        {/* Current Target Branch Display */}
                        <div className="flex items-center gap-2 text-sm text-gray-300 bg-gray-700/50 p-2 rounded-md">
                            <FaCodeBranch className="text-cyan-400 flex-shrink-0" />
                            <span>Целевая ветка:</span>
                            <span className="font-semibold text-cyan-300 truncate" title={getTargetBranchDisplay()}>
                                {getTargetBranchDisplay()}
                            </span>
                        </div>

                        {/* Repo URL Input */}
                        <div>
                            <label className="block text-sm font-medium mb-1 text-cyan-300">URL репозитория GitHub</label>
                            <input
                                type="text"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400 disabled:opacity-50"
                                placeholder="https://github.com/username/repository"
                                disabled={loading}
                                aria-label="URL репозитория GitHub"
                            />
                        </div>

                        {/* GitHub Token Input */}
                        <div>
                            <label className="block text-sm font-medium mb-1 text-cyan-300">Токен GitHub <span className="text-gray-400">(опционально, для приватных репо)</span></label>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400 disabled:opacity-50"
                                placeholder="Введите ваш Personal Access Token"
                                disabled={loading}
                                aria-label="Токен GitHub"
                            />
                        </div>

                        {/* Manual Branch Name Input */}
                        <div>
                            <label className="block text-sm font-medium mb-1 text-cyan-300">
                                Имя ветки вручную <span className="text-gray-400">(переопределяет выбор PR)</span>
                            </label>
                            <input
                                type="text"
                                value={manualBranchName}
                                onChange={(e) => setManualBranchName(e.target.value)}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400 disabled:opacity-50"
                                placeholder="Например: main, dev, feature/my-feature"
                                disabled={loading}
                                aria-label="Имя ветки вручную"
                            />
                             <p className="text-xs text-gray-400 mt-1">Оставьте пустым для использования ветки из выбранного PR или ветки по умолчанию.</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SettingsModal;