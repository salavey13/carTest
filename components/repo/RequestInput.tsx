// /components/repo/RequestInput.tsx
"use client";

import React, { MutableRefObject, ChangeEventHandler } from 'react';
import { motion } from 'framer-motion';
import { FaClipboard, FaBroom, FaRobot, FaPlus } from 'react-icons/fa6'; // Added FaRobot, FaPlus

interface RequestInputProps {
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    onCopyToClipboard: () => void;
    onClearAll: () => void;
    isCopyDisabled: boolean;
    isClearDisabled: boolean;
    onInputChange?: (value: string) => void; // Optional callback for parent
    initialValue?: string; // Optional initial value
    // New props for Ask AI button
    onAskAi: () => Promise<void>;
    isAskAiDisabled: boolean;
    aiActionLoading: boolean;
    // New prop for Add Selected
    onAddSelected: (autoAsk?: boolean) => Promise<void>;
    isAddSelectedDisabled: boolean;
    selectedFetcherFilesCount: number;
}

const RequestInput: React.FC<RequestInputProps> = ({
    kworkInputRef,
    onCopyToClipboard,
    onClearAll,
    isCopyDisabled,
    isClearDisabled,
    onInputChange,
    initialValue = "",
    // New props
    onAskAi,
    isAskAiDisabled,
    aiActionLoading,
    onAddSelected,
    isAddSelectedDisabled,
    selectedFetcherFilesCount,
}) => {

    const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
        if (onInputChange) {
            onInputChange(e.target.value);
        }
    };

    return (
        <div className="flex flex-col gap-3"> {/* Changed to flex-col */}
            <div className="relative">
                <p className="text-yellow-400 mb-2 text-xs md:text-sm"> 4. Опиши задачу И/ИЛИ добавь файлы кнопкой <FaPlus className="inline text-base mx-1"/>. Затем <FaRobot className="inline text-base mx-1"/> или <FaClipboard className="inline text-base mx-1"/>. </p>
                <textarea
                    id="kwork-input"
                    ref={kworkInputRef}
                    defaultValue={initialValue} // Use defaultValue for uncontrolled with ref
                    onChange={handleChange} // Notify parent on change
                    className="w-full p-3 pr-14 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition shadow-[0_0_8px_rgba(0,255,157,0.3)] resize-y min-h-[120px] text-sm placeholder-gray-500"
                    placeholder="Опиши здесь вашу задачу... Затем добавь контекст кнопками ИЛИ нажми 'Спросить AI'."
                    disabled={isAskAiDisabled && isCopyDisabled && isClearDisabled} // Disable textarea if all actions are disabled
                />
                <div className="absolute top-8 right-2 flex flex-col gap-2">
                    {/* Copy Button */}
                    <motion.button
                        onClick={onCopyToClipboard}
                        disabled={isCopyDisabled}
                        className={`p-1.5 bg-gradient-to-r from-cyan-600 to-teal-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.3)] transition-all ${isCopyDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(6,182,212,0.5)]'}`}
                        whileHover={{ scale: !isCopyDisabled ? 1.1 : 1 }}
                        whileTap={{ scale: !isCopyDisabled ? 0.9 : 1 }}
                        title="Скопировать запрос в буфер (для ручной вставки в AI)"
                    >
                        <FaClipboard className="text-white text-base" />
                    </motion.button>
                    {/* Clear Button */}
                    <motion.button
                        onClick={onClearAll}
                        disabled={isClearDisabled}
                        className={`p-1.5 bg-gradient-to-r from-red-600 to-orange-500 rounded-full shadow-[0_0_8px_rgba(220,38,38,0.3)] transition-all ${isClearDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-[0_0_12px_rgba(220,38,38,0.5)]'}`}
                        whileHover={{ scale: !isClearDisabled ? 1.1 : 1 }}
                        whileTap={{ scale: !isClearDisabled ? 0.9 : 1 }}
                        title="Очистить поле ввода и выбор файлов"
                    >
                        <FaBroom className="text-white text-base" />
                    </motion.button>
                </div>
            </div>
            {/* Action Buttons below Textarea */}
            <div className="flex flex-col sm:flex-row gap-3">
                 {/* Add Selected Button */}
                 <motion.button
                      onClick={() => onAddSelected()}
                      disabled={isAddSelectedDisabled}
                      className={`flex items-center justify-center gap-2 flex-grow px-4 py-2 rounded-lg font-semibold text-sm text-white ${
                        isAddSelectedDisabled
                          ? 'bg-gray-600 opacity-60 cursor-not-allowed'
                          : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-md shadow-cyan-500/30 hover:shadow-lg hover:shadow-teal-500/40'
                      } transition-all`}
                      whileHover={{ scale: isAddSelectedDisabled ? 1 : 1.03 }}
                      whileTap={{ scale: isAddSelectedDisabled ? 1 : 0.97 }}
                      title={`Добавить ${selectedFetcherFilesCount} выбранных файлов в запрос`}
                  >
                      <FaPlus />
                      Добавить файлы ({selectedFetcherFilesCount})
                  </motion.button>

                 {/* Ask AI Button */}
                 <motion.button
                    onClick={onAskAi}
                    disabled={isAskAiDisabled}
                    className={`flex items-center justify-center gap-2 w-full sm:w-auto flex-grow px-4 py-2 rounded-lg font-semibold text-sm text-white ${
                        isAskAiDisabled
                        ? 'bg-gray-600 opacity-60 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-indigo-500/40'
                    } transition-all`}
                    whileHover={{ scale: isAskAiDisabled ? 1 : 1.03 }}
                    whileTap={{ scale: isAskAiDisabled ? 1 : 0.97 }}
                 >
                    {aiActionLoading ? <FaArrowsRotate className="animate-spin" /> : <FaRobot />}
                    {aiActionLoading ? "Спрашиваю..." : "🤖 Спросить AI"}
                 </motion.button>
            </div>
        </div>
    );
};

export default RequestInput;