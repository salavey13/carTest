"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FaSearch, FaArrowLeft, FaArrowRight, FaExpand } from 'react-icons/fa';

interface SwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwap: (find: string, replace: string) => void;
    onSearch: (searchText: string, direction?: 'next' | 'prev') => void;
    initialMode: 'replace' | 'search';
}

export const SwapModal: React.FC<SwapModalProps> = ({ isOpen, onClose, onSwap, onSearch, initialMode }) => {
    const [mode, setMode] = useState<'replace' | 'search'>(initialMode);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Trigger search and collapse on first search
    useEffect(() => {
        if (isOpen && mode === 'search' && findText && !isCollapsed) {
            onSearch(findText);
            setIsCollapsed(true);
        }
    }, [isOpen, mode, findText, onSearch, isCollapsed]);

    const handleAction = () => {
        if (!findText) {
            toast.warn("Введите текст для поиска.");
            return;
        }
        if (mode === 'replace') {
            onSwap(findText, replaceText);
            onClose();
        } else {
            onSearch(findText);
            setIsCollapsed(true);
        }
    };

    const handleNext = () => {
        onSearch(findText, 'next');
    };

    const handlePrev = () => {
        onSearch(findText, 'prev');
    };

    const handleUncollapse = () => {
        setIsCollapsed(false);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex bg-black bg-opacity-60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    x: isCollapsed ? 'calc(50vw - 50px)' : 0, // Move to right side in collapsed mode
                    y: isCollapsed ? 'calc(50vh - 80px)' : 0, // Center vertically when collapsed
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
                        <button onClick={handlePrev} className="text-white hover:text-cyan-400 transition">
                            <FaArrowLeft size={18} />
                        </button>
                        <button onClick={handleNext} className="text-white hover:text-cyan-400 transition">
                            <FaArrowRight size={18} />
                        </button>
                        <button onClick={handleUncollapse} className="text-white hover:text-cyan-400 transition">
                            <FaExpand size={18} />
                        </button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-xl font-bold text-cyan-400 mb-4">
                            {mode === 'replace' ? 'Замена текста' : 'Поиск текста'}
                        </h3>
                        <div className="flex justify-center mb-4 gap-1">
                            <button
                                className={`px-4 py-2 ${mode === 'replace' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'} rounded-l-md transition`}
                                onClick={() => setMode('replace')}
                            >
                                Замена
                            </button>
                            <button
                                className={`px-4 py-2 ${mode === 'search' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'} rounded-r-md transition`}
                                onClick={() => setMode('search')}
                            >
                                Поиск
                            </button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label htmlFor="find-input" className="block text-sm font-medium mb-1 text-gray-300">Найти:</label>
                                <input
                                    id="find-input"
                                    type="text"
                                    value={findText}
                                    onChange={(e) => setFindText(e.target.value)}
                                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm text-white"
                                    placeholder="Текст, который нужно найти"
                                />
                            </div>
                            {mode === 'replace' && (
                                <div>
                                    <label htmlFor="replace-input" className="block text-sm font-medium mb-1 text-gray-300">Заменить на:</label>
                                    <input
                                        id="replace-input"
                                        type="text"
                                        value={replaceText}
                                        onChange={(e) => setReplaceText(e.target.value)}
                                        className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm text-white"
                                        placeholder="Новый текст (оставьте пустым для удаления)"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-500 transition text-white">Отмена</button>
                            <button onClick={handleAction} className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition shadow-[0_0_10px_rgba(0,255,157,0.4)]">
                                {mode === 'replace' ? 'Заменить все' : 'Найти'}
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
};
SwapModal.displayName = 'SwapModal';