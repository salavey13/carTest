import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaDownload, FaArrowsRotate } from 'react-icons/fa6';

interface SettingsModalProps {
    isOpen: boolean;
    repoUrl: string;
    setRepoUrl: (url: string) => void;
    token: string;
    setToken: (token: string) => void;
    onFetch: () => void;
    loading: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    repoUrl,
    setRepoUrl,
    token,
    setToken,
    onFetch,
    loading,
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden mb-6 border border-gray-700 rounded-lg p-4 bg-gray-800 shadow-lg"
                >
                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-cyan-300">URL репозитория GitHub</label>
                            <input
                                type="text"
                                value={repoUrl}
                                onChange={(e) => setRepoUrl(e.target.value)}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400"
                                placeholder="https://github.com/username/repository"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-cyan-300">Токен GitHub <span className="text-gray-400">(опционально, для приватных репо)</span></label>
                            <input
                                type="password"
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:border-cyan-500 focus:outline-none transition shadow-inner text-sm text-white placeholder-gray-400"
                                placeholder="Введите ваш Personal Access Token"
                                disabled={loading}
                            />
                        </div>
                        <motion.button
                            onClick={onFetch}
                            disabled={loading || !repoUrl.trim()}
                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-cyan-500 transition-all shadow-[0_0_12px_rgba(0,255,157,0.3)] ${(loading || !repoUrl.trim()) ? "opacity-50 cursor-not-allowed" : "hover:shadow-[0_0_18px_rgba(0,255,157,0.5)]"}`}
                            whileHover={{ scale: (loading || !repoUrl.trim()) ? 1 : 1.05 }}
                            whileTap={{ scale: (loading || !repoUrl.trim()) ? 1 : 0.95 }}
                        >
                            {loading ? <FaArrowsRotate className="animate-spin" /> : <FaDownload />}
                            {loading ? "Извлечение..." : "Извлечь файлы"}
                        </motion.button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SettingsModal;