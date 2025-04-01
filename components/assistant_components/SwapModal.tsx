"use client";

"use client"

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { FaRightLeft, FaMagnifyingGlass, FaTimes } from 'react-icons/fa6'; // Use Fa6 consistently

interface SwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwap: (find: string, replace: string) => void;
    onSearch: (searchText: string, isMultiline: boolean) => void; // Multiline indicates magic swap
    initialMode: 'replace' | 'search';
}

export const SwapModal: React.FC<SwapModalProps> = ({ isOpen, onClose, onSwap, onSearch, initialMode }) => {
    const [mode, setMode] = useState<'replace' | 'search'>(initialMode);
    const [findText, setFindText] = useState('');
    const [replaceText, setReplaceText] = useState('');

    // Reset state when modal opens or mode changes
    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
            setFindText('');
            setReplaceText('');
        }
    }, [isOpen, initialMode]);

    const handleAction = () => {
        if (!findText) {
            toast.warn("Введите текст для поиска.");
            return;
        }
        const isMultiline = findText.includes('\n'); // Check if find text is multiline

        if (mode === 'replace') {
            onSwap(findText, replaceText); // Standard replace all
            onClose(); // Close after replacing
        } else { // mode === 'search'
            onSearch(findText, isMultiline); // Trigger search/magic swap
            onClose(); // Close after initiating search/swap
        }
    };

    // Allow Enter key submission
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // Allow Shift+Enter for newlines in textarea, otherwise submit
        if (e.key === 'Enter' && !e.shiftKey && mode === 'search' && findText.includes('\n')) {
             e.preventDefault(); // Prevent default newline in textarea
             handleAction();
        } else if (e.key === 'Enter' && mode === 'replace') {
             handleAction();
        } else if (e.key === 'Enter' && mode === 'search' && !findText.includes('\n')) {
             handleAction(); // Allow enter for single line search
        }
    };


    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4"
            onClick={onClose} // Click outside to close
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-md border border-cyan-500/30"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-cyan-400">
                        {mode === 'replace' ? 'Найти и Заменить' : 'Поиск / Magic Swap'}
                    </h3>
                    {/* Mode Toggle Buttons */}
                    <div className="flex gap-1 bg-gray-700 p-0.5 rounded-full">
                         <button
                             onClick={() => setMode('search')}
                             className={`px-3 py-1 rounded-full text-xs transition ${mode === 'search' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                         >
                            <FaMagnifyingGlass className="inline mr-1" size={10}/> Поиск
                         </button>
                         <button
                             onClick={() => setMode('replace')}
                             className={`px-3 py-1 rounded-full text-xs transition ${mode === 'replace' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-600'}`}
                         >
                            <FaRightLeft className="inline mr-1" size={10}/> Замена
                         </button>
                     </div>
                </div>

                {/* Input Fields */}
                <div className="space-y-4 mb-6">
                    <div>
                        <label htmlFor="find-input" className="block text-sm font-medium mb-1 text-gray-300">
                             {mode === 'replace' ? 'Найти:' : 'Найти (или вставьте код для Magic Swap):'}
                        </label>
                        {/* Use textarea for search/magic swap to allow multiline paste */}
                        {mode === 'search' ? (
                             <textarea
                                id="find-input"
                                value={findText}
                                onChange={(e) => setFindText(e.target.value)}
                                onKeyDown={handleKeyPress} // Use onKeyDown for Shift+Enter check
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-white text-sm resize-y min-h-[60px] max-h-[150px] simple-scrollbar"
                                placeholder="Текст для поиска или функция для замены..."
                                rows={findText.includes('\n') ? 3 : 1} // Dynamically adjust rows roughly
                             />
                        ) : (
                             <input
                                id="find-input"
                                type="text"
                                value={findText}
                                onChange={(e) => setFindText(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-white text-sm"
                                placeholder="Текст, который нужно заменить"
                             />
                        )}
                    </div>
                    {/* Only show Replace field in replace mode */}
                    {mode === 'replace' && (
                        <div>
                            <label htmlFor="replace-input" className="block text-sm font-medium mb-1 text-gray-300">
                                Заменить на:
                            </label>
                            <input
                                id="replace-input"
                                type="text"
                                value={replaceText}
                                onChange={(e) => setReplaceText(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-white text-sm"
                                placeholder="Новый текст (оставьте пустым для удаления)"
                            />
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-500 transition text-white"
                    >
                        <FaTimes className="inline mr-1"/> Отмена
                    </button>
                    <button
                        onClick={handleAction}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition shadow-[0_0_10px_rgba(0,255,157,0.4)] ${mode === 'replace' ? 'bg-gradient-to-r from-purple-600 to-indigo-500 hover:from-purple-500 hover:to-indigo-400' : 'bg-gradient-to-r from-cyan-600 to-blue-500 hover:from-cyan-500 hover:to-blue-400'}`}
                    >
                        {mode === 'replace' ? <><FaRightLeft className="inline mr-1"/> Заменить все</> : <><FaMagnifyingGlass className="inline mr-1"/> {findText.includes('\n') ? 'Magic Swap' : 'Найти и Выделить'}</>}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
SwapModal.displayName = 'SwapModal';