"use client"
import React from "react";
import { motion } from "framer-motion";
import { FaCopy, FaPoo, FaRightLeft, FaArrowRight, FaRotate, FaMagnifyingGlass, FaCode } from "react-icons/fa6"; // Added FaCode
import { Tooltip } from "../AICodeAssistant";

interface TextAreaUtilitiesProps {
    response: string;
    isLoading: boolean;
    onParse: () => void;
    onOpenModal: (mode: 'replace' | 'search') => void;
    onCopy: () => void;
    onClear: () => void;
    onSelectFunction: () => void; // <<< ADDED PROP
}

export const TextAreaUtilities: React.FC<TextAreaUtilitiesProps> = ({
    response,
    isLoading,
    onParse,
    onOpenModal,
    onCopy,
    onClear,
    onSelectFunction // <<< Destructure prop
}) => {
    const hasResponse = !!response;

    return (
        <>
            {/* Right-Side Buttons (Parse) */}
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                <Tooltip text="Разобрать и Проверить Ответ AI" position="left">
                     <motion.button
                        className="p-1.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_12px_rgba(0,255,157,0.5)]"
                        onClick={onParse}
                        disabled={isLoading || !hasResponse}
                        whileHover={{ scale: (isLoading || !hasResponse) ? 1 : 1.1 }}
                        whileTap={{ scale: (isLoading || !hasResponse) ? 1 : 0.95 }}
                    >
                        {isLoading ? <FaRotate size={14} className="animate-spin" /> : <FaArrowRight size={14} />}
                    </motion.button>
                </Tooltip>
            </div>

            {/* Left-Side Buttons (Appear on Hover/Focus) */}
            <div className="absolute top-2 right-10 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 z-10">
                 <Tooltip text="Выделить текущую функцию" position="left">
                    <motion.button
                        className="p-1.5 rounded-full bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        onClick={onSelectFunction} // <<< Use the new handler
                        onMouseDown={(e) => e.preventDefault()} // <<< Prevent focus loss on click start
                        disabled={!hasResponse || isLoading}
                        whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                        whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    >
                        <FaCode size={14} />
                    </motion.button>
                </Tooltip>
                <Tooltip text="Поиск / Magic Swap" position="left">
                    <motion.button
                        className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        onClick={() => onOpenModal('search')} // <<< Open modal in search mode
                        disabled={!hasResponse || isLoading}
                        whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                        whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    >
                        <FaMagnifyingGlass size={14} />
                    </motion.button>
                </Tooltip>
                <Tooltip text="Найти и Заменить" position="left">
                    <motion.button
                        className="p-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        onClick={() => onOpenModal('replace')} // <<< Open modal in replace mode
                        disabled={!hasResponse || isLoading}
                        whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                        whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    >
                        <FaRightLeft size={14} />
                    </motion.button>
                </Tooltip>
                <Tooltip text="Скопировать все" position="left">
                    <motion.button
                        className="p-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        onClick={onCopy}
                        disabled={!hasResponse || isLoading}
                        whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                        whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    >
                        <FaCopy size={14} />
                    </motion.button>
                </Tooltip>
                <Tooltip text="Очистить поле" position="left">
                    <motion.button
                        className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        onClick={onClear}
                        disabled={!hasResponse || isLoading}
                        whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                        whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    >
                        <FaPoo size={14} />
                    </motion.button>
                </Tooltip>
            </div>
        </>
    );
};
TextAreaUtilities.displayName = 'TextAreaUtilities';