// (No changes needed based on the request)
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Removed fetch-related icons/props from here

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void; // Added for potential external close triggers
    repoUrl: string;
    setRepoUrl: (url: string) => void;
    token: string;
    setToken: (token: string) => void;
    loading: boolean; // To disable inputs during fetch
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    repoUrl,
    setRepoUrl,
    token,
    setToken,
    loading, // Receive loading state
    // onClose, // Destructure if needed
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: 'auto', opacity: 1, marginTop: '0.75rem' }} // Add margin when open
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mb-4 border border-gray-700 rounded-lg p-4 bg-gray-800 shadow-lg" // Keep bottom margin
                >
                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-cyan-300">URL репозитория GitHub</label>
                            <input
                                type="text"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400 disabled:opacity-50"
                                placeholder="https://github.com/username/repository"
                                disabled={loading} // Disable input when loading
                                aria-label="URL репозитория GitHub"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-cyan-300">Токен GitHub <span className="text-gray-400">(опционально, для приватных репо)</span></label>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400 disabled:opacity-50"
                                placeholder="Введите ваш Personal Access Token"
                                disabled={loading} // Disable input when loading
                                aria-label="Токен GitHub"
                            />
                        </div>
                        {/* Fetch button removed from here */}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SettingsModal;