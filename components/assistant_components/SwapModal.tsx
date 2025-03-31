"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FaSearch, FaArrowLeft, FaArrowRight, FaExpand } from 'react-icons/fa';

interface SwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwap: (find: string, replace: string) => void;
    onSearch: (searchText: string, isMultiline: boolean) => void;
    initialMode: 'replace' | 'search';
}

export const SwapModal: React.FC<SwapModalProps> = ({ isOpen, onClose, onSwap, onSearch, initialMode }) => {
    const [mode, setMode] = useState<'replace' | 'search'>(initialMode);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false);

    const handleAction = () => {
        if (!findText) {
            toast.warn("Введите текст для поиска.");
            return;
        }
        const isMultiline = findText.includes('\n');
        if (mode === 'replace') {
            onSwap(findText, replaceText);
            onClose();
        } else {
            onSearch(findText, isMultiline);
            if (isMultiline) {
                // For multiline search, we assume the swap happens elsewhere (e.g., in AICodeAssistant)
                onClose();
            } else {
                setIsCollapsed(true); // Collapse for single-line search
            }
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') handleAction();
    };

    if (!isOpen) return null;

    return (
        <div
            className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${
                isCollapsed ? '' : 'bg-black bg-opacity-60 backdrop-blur-sm'
            }`}
            onClick={!isCollapsed ? onClose : undefined}
        >
            <motion.div
                drag={isCollapsed}
                dragMomentum={false}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    x: isCollapsed ? 'calc(100vw - 100px)' : 0,
                    y: isCollapsed ? 'calc(50vh - 80px)' : 0,
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`bg-gray-800 p-6 rounded-xl shadow-2xl border border-cyan-500/30 ${
                    isCollapsed ? 'w-20 h-32 flex items-center justify-center' : 'w-full max-w-md'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {isCollapsed ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onSearch(findText, false)} // Trigger next search
                            className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition"
                            title="Предыдущий"
                        >
                            <FaArrowLeft size={18} />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onSearch(findText, false)} // Trigger next search
                            className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition"
                            title="Следующий"
                        >
                            <FaArrowRight size={18} />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setIsCollapsed(false)}
                            className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition"
                            title="Развернуть"
                        >
                            <FaExpand size={18} />
                        </motion.button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-xl font-bold text-cyan-400 mb-4">
                            {mode === 'replace' ? 'Замена текста' : 'Поиск текста'}
                        </h3>
                        <div className="flex justify-center mb-4 gap-1">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`px-4 py-2 ${
                                    mode === 'replace' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'
                                } rounded-full transition`}
                                onClick={() => setMode('replace')}
                            >
                                Замена
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`px-4 py-2 ${
                                    mode === 'search' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'
                                } rounded-full transition`}
                                onClick={() => setMode('search')}
                            >
                                Поиск
                            </motion.button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label
                                    htmlFor="find-input"
                                    className="block text-sm font-medium mb-1 text-gray-300"
                                >
                                    Найти:
                                </label>
                                <textarea
                                    id="find-input"
                                    value={findText}
                                    onChange={(e) => setFindText(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-white text-sm resize-none"
                                    placeholder="Вставьте функцию для магической замены"
                                    rows={3}
                                />
                            </div>
                            {mode === 'replace' && (
                                <div>
                                    <label
                                        htmlFor="replace-input"
                                        className="block text-sm font-medium mb-1 text-gray-300"
                                    >
                                        Заменить на:
                                    </label>
                                    <textarea
                                        id="replace-input"
                                        value={replaceText}
                                        onChange={(e) => setReplaceText(e.target.value)}
                                        className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-white text-sm resize-none"
                                        placeholder="Новый текст"
                                        rows={3}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onClose}
                                className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-600 hover:bg-gray-500 transition text-white"
                            >
                                Отмена
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleAction}
                                className="px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition shadow-[0_0_10px_rgba(0,255,157,0.4)]"
                            >
                                {mode === 'replace' ? 'Заменить все' : 'Найти'}
                            </motion.button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
};
SwapModal.displayName = 'SwapModal';