"use client";

import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useDragControls } from 'framer-motion';
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
    const dragControls = useDragControls();
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    useEffect(() => {
        if (isOpen && mode === 'search' && findText && !isCollapsed) {
            onSearch(findText);
            setIsCollapsed(true);
        }
    }, [isOpen, mode, findText, onSearch, isCollapsed]);

    const handleAction = () => {
        if (!findText) {
            toast.warn("Please enter text to search.");
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
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`fixed inset-0 z-[60] flex items-center justify-center p-4 ${isCollapsed ? 'bg-transparent' : 'bg-black bg-opacity-60 backdrop-blur-sm'}`}
            onClick={!isCollapsed ? onClose : undefined}
        >
            <motion.div
                drag={isCollapsed}
                dragControls={dragControls}
                dragMomentum={false}
                style={{ x, y }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    x: isCollapsed ? 'calc(100vw - 100px)' : 0, // Right side when collapsed
                    y: isCollapsed ? 'calc(50vh - 80px)' : 0, // Center vertically when collapsed
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={`bg-gray-800 p-6 rounded-xl shadow-2xl border border-cyan-500/30 ${isCollapsed ? 'w-20 h-32 flex items-center justify-center' : 'w-full max-w-md'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {isCollapsed ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition"
                            onClick={handlePrev}
                        >
                            <FaArrowLeft size={18} />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition"
                            onClick={handleNext}
                        >
                            <FaArrowRight size={18} />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            className="p-2 bg-gray-700 rounded-full text-white hover:bg-gray-600 transition"
                            onClick={handleUncollapse}
                        >
                            <FaExpand size={18} />
                        </motion.button>
                    </div>
                ) : (
                    <>
                        <h3 className="text-xl font-bold text-cyan-400 mb-4">
                            {mode === 'replace' ? 'Replace Text' : 'Search Text'}
                        </h3>
                        <div className="flex justify-center mb-4 gap-1">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`px-4 py-2 ${mode === 'replace' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'} rounded-full transition`}
                                onClick={() => setMode('replace')}
                            >
                                Replace
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`px-4 py-2 ${mode === 'search' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'} rounded-full transition`}
                                onClick={() => setMode('search')}
                            >
                                Search
                            </motion.button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label htmlFor="find-input" className="block text-sm font-medium mb-1 text-gray-300">Find:</label>
                                <input
                                    id="find-input"
                                    type="text"
                                    value={findText}
                                    onChange={(e) => setFindText(e.target.value)}
                                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm text-white"
                                    placeholder="Text to find"
                                />
                            </div>
                            {mode === 'replace' && (
                                <div>
                                    <label htmlFor="replace-input" className="block text-sm font-medium mb-1 text-gray-300">Replace with:</label>
                                    <input
                                        id="replace-input"
                                        type="text"
                                        value={replaceText}
                                        onChange={(e) => setReplaceText(e.target.value)}
                                        className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none text-sm text-white"
                                        placeholder="New text (leave empty to delete)"
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
                                Cancel
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleAction}
                                className="px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 transition shadow-[0_0_10px_rgba(0,255,157,0.4)]"
                            >
                                {mode === 'replace' ? 'Replace All' : 'Find'}
                            </motion.button>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
};
SwapModal.displayName = 'SwapModal';