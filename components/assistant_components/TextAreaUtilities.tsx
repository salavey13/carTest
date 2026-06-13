"use client";

import React, { useRef } from "react";
import { motion } from "framer-motion";
import { FaCopy, FaPoo, FaRightLeft, FaArrowRight, FaRotate, FaMagnifyingGlass, FaCode, FaUpload } from "react-icons/fa6";

interface TextAreaUtilitiesProps {
    response: string;
    isLoading: boolean;
    onParse: () => void;
    onOpenModal: (mode: 'replace' | 'search') => void;
    onCopy: () => void;
    onClear: () => void;
    onSelectFunction: () => void;
    onFileUpload: (content: string, fileName: string) => void; // <<< ADDED PROP
    isProcessingPR: boolean;
    isParseDisabled: boolean;
}

export const TextAreaUtilities: React.FC<TextAreaUtilitiesProps> = ({
    response,
    isLoading,
    onParse,
    onOpenModal,
    onCopy,
    onClear,
    onSelectFunction,
    onFileUpload, // <<< Destructure prop
    isParseDisabled
}) => {
    const hasResponse = !!response && response.trim().length > 0;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            onFileUpload(content, file.name);
        } catch (err) {
            console.error("Failed to read file:", err);
        }

        // Reset input so the same file can be re-selected
        e.target.value = "";
    };

    return (
        <>
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yaml,.yml,.py,.sh,.bash,.sql,.env,.csv,.log,.svg,.toml,.ini,.cfg,.conf,.gitignore,.prettierrc,.eslintrc,.babelrc,.editorconfig"
                onChange={handleFileChange}
            />

            {/* Right-Side Buttons (Parse) */}
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                 <motion.button
                    className="p-1.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_8px_rgba(0,255,157,0.3)] hover:shadow-[0_0_12px_rgba(0,255,157,0.5)]"
                    onClick={onParse}
                    disabled={isParseDisabled || isLoading}
                    whileHover={{ scale: (isParseDisabled || isLoading) ? 1 : 1.1 }}
                    whileTap={{ scale: (isParseDisabled || isLoading) ? 1 : 0.95 }}
                    title={isLoading ? "Обработка..." : isParseDisabled ? "Введите или получите ответ AI" : "Разобрать ответ AI ➡️"}
                >
                    {isLoading ? <FaRotate size={14} className="animate-spin" /> : <FaArrowRight size={14} />}
                </motion.button>
            </div>

            {/* Left-Side Buttons (Appear on Hover/Focus) */}
            <div className="absolute top-2 right-10 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200 z-10">
                 {/* <<< ADDED: File Upload Button >>> */}
                 <motion.button
                    className="p-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    onClick={handleFileButtonClick}
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={isLoading}
                    whileHover={{ scale: isLoading ? 1 : 1.1 }}
                    whileTap={{ scale: isLoading ? 1 : 0.95 }}
                    title="Загрузить файл в текстовое поле"
                >
                    <FaUpload size={14} />
                </motion.button>
                 <motion.button
                    className="p-1.5 rounded-full bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    onClick={onSelectFunction}
                    onMouseDown={(e) => e.preventDefault()}
                    disabled={!hasResponse || isLoading}
                    whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                    whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    title="Выделить текущую функцию"
                >
                    <FaCode size={14} />
                </motion.button>
                 <motion.button
                    className="p-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    onClick={() => onOpenModal('search')}
                    disabled={!hasResponse || isLoading}
                    whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                    whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    title="Поиск / Magic Swap"
                >
                    <FaMagnifyingGlass size={14} />
                </motion.button>
                 <motion.button
                    className="p-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    onClick={() => onOpenModal('replace')}
                    disabled={!hasResponse || isLoading}
                    whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                    whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    title="Найти и Заменить"
                >
                    <FaRightLeft size={14} />
                </motion.button>
                 <motion.button
                    className="p-1.5 rounded-full bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    onClick={onCopy}
                    disabled={!hasResponse || isLoading}
                    whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                    whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    title="Скопировать все"
                >
                    <FaCopy size={14} />
                </motion.button>
                 <motion.button
                    className="p-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    onClick={onClear}
                    disabled={!hasResponse || isLoading}
                    whileHover={{ scale: (!hasResponse || isLoading) ? 1 : 1.1 }}
                    whileTap={{ scale: (!hasResponse || isLoading) ? 1 : 0.95 }}
                    title="Очистить поле"
                >
                    <FaPoo size={14} />
                </motion.button>
            </div>
        </>
    );
};
TextAreaUtilities.displayName = 'TextAreaUtilities';