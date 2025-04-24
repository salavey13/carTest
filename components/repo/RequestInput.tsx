"use client";

import React, { MutableRefObject, ChangeEventHandler } from 'react';
import { motion } from 'framer-motion';
import { FaClipboard, FaBroom, FaRobot, FaPlus, FaFileLines, FaArrowsRotate, FaSpinner } from 'react-icons/fa6';
import { toast } from 'sonner';
// --- Импорт промпта ---
import { ULTIMATE_VIBE_MASTER_PROMPT } from './prompt';

interface RequestInputProps {
    kworkInputRef: MutableRefObject<HTMLTextAreaElement | null>;
    onCopyToClipboard: () => void;
    onClearAll: () => void;
    isCopyDisabled: boolean;
    isClearDisabled: boolean;
    onInputChange?: (value: string) => void;
    // Props для AI
    onAskAi: () => Promise<{ success: boolean; requestId?: string; error?: string }>;
    isAskAiDisabled: boolean;
    aiActionLoading: boolean;
    // Props для добавления файлов
    onAddSelected: () => Promise<void>;
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
    // AI Props
    onAskAi,
    isAskAiDisabled,
    aiActionLoading,
    // Add Selected Props
    onAddSelected,
    isAddSelectedDisabled,
    selectedFetcherFilesCount,
}) => {

    const handleChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
        if (onInputChange) {
            onInputChange(e.target.value);
        }
        // Авто-ресайз высоты (опционально, но полезно)
        const textarea = e.target;
        textarea.style.height = 'auto'; // Сбросить высоту
        textarea.style.height = `${textarea.scrollHeight}px`; // Установить по контенту
    };

    // Обработчик копирования инструкций
    const handleCopyInstructions = () => {
        navigator.clipboard.writeText(ULTIMATE_VIBE_MASTER_PROMPT)
            .then(() => {
                toast.success("Инструкции для AI скопированы!");
            })
            .catch(err => {
                console.error("Не удалось скопировать инструкции: ", err);
                toast.error("Ошибка копирования инструкций");
            });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="relative">
                 {/* Строка с инструкциями */}
                 <p className="text-yellow-300/90 mb-2 text-xs md:text-sm">
                     4. Опиши задачу И/ИЛИ добавь файлы (<FaPlus className="inline text-sm mx-px"/>). Затем <FaRobot className="inline text-sm mx-px"/> или <FaClipboard className="inline text-sm mx-px"/>.
                 </p>
                 {/* Textarea */}
                 <textarea
                    id="kwork-input"
                    ref={kworkInputRef}
                    onChange={handleChange}
                    // ИЗМЕНЕНО: overflow-hidden -> overflow-y-auto
                    className="w-full p-3 pr-16 bg-gray-800 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition shadow-inner resize-y min-h-[150px] text-sm placeholder-gray-500 overflow-y-auto" // <<< ИЗМЕНЕНИЕ ЗДЕСЬ
                    placeholder="Опиши здесь вашу задачу... Затем добавь контекст кнопками ИЛИ нажми 'Спросить AI'."
                    disabled={isAskAiDisabled && isCopyDisabled && isClearDisabled}
                    aria-label="Поле ввода запроса для AI"
                    rows={5} // Начальное количество строк, помогает с min-h
                />
                {/* Контейнер кнопок-иконок */}
                <div className="absolute top-8 right-2 flex flex-col gap-2.5">
                     {/* Кнопка "Копировать инструкции" */}
                     <motion.button
                        onClick={handleCopyInstructions}
                        className="p-1.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-md shadow-purple-500/30 transition-all hover:shadow-lg hover:shadow-purple-500/50"
                        whileHover={{ scale: 1.1, rotate: -5 }}
                        whileTap={{ scale: 0.9 }}
                        title="Скопировать инструкции для AI (role prompt)"
                    >
                        <FaFileLines className="text-white text-sm" />
                    </motion.button>
                    {/* Кнопка "Копировать" */}
                    <motion.button
                        onClick={onCopyToClipboard}
                        disabled={isCopyDisabled}
                        className={`p-1.5 bg-gradient-to-br from-cyan-600 to-teal-600 rounded-full shadow-md shadow-cyan-500/30 transition-all ${isCopyDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-teal-500/50'}`}
                        whileHover={{ scale: !isCopyDisabled ? 1.1 : 1, rotate: 5 }}
                        whileTap={{ scale: !isCopyDisabled ? 0.9 : 1 }}
                        title="Скопировать запрос в буфер"
                    >
                        <FaClipboard className="text-white text-sm" />
                    </motion.button>
                    {/* Кнопка "Очистить" */}
                    <motion.button
                        onClick={onClearAll}
                        disabled={isClearDisabled}
                        className={`p-1.5 bg-gradient-to-br from-red-600 to-orange-600 rounded-full shadow-md shadow-orange-500/30 transition-all ${isClearDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-lg hover:shadow-red-500/50'}`}
                        whileHover={{ scale: !isClearDisabled ? 1.1 : 1, rotate: -5 }}
                        whileTap={{ scale: !isClearDisabled ? 0.9 : 1 }}
                        title="Очистить поле ввода и выбор файлов"
                    >
                        <FaBroom className="text-white text-sm" />
                    </motion.button>
                </div>
            </div>
            {/* Кнопки действий под Textarea */}
            <div className="flex flex-col sm:flex-row gap-3">
                 {/* Кнопка "Добавить выбранные" */}
                 <motion.button
                      onClick={onAddSelected}
                      disabled={isAddSelectedDisabled}
                      className={`flex items-center justify-center gap-2 flex-grow px-4 py-2 rounded-full font-semibold text-sm text-white ${
                        isAddSelectedDisabled
                          ? 'bg-gray-600 opacity-60 cursor-not-allowed'
                          : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-md shadow-cyan-500/30 hover:shadow-lg hover:shadow-teal-500/40'
                      } transition-all`}
                      whileHover={{ scale: isAddSelectedDisabled ? 1 : 1.03 }}
                      whileTap={{ scale: isAddSelectedDisabled ? 1 : 0.97 }}
                      title={`Добавить ${selectedFetcherFilesCount} выбранных файлов в поле ввода выше`}
                  >
                      <FaPlus />
                      Добавить файлы ({selectedFetcherFilesCount})
                  </motion.button>

                 {/* Кнопка "Спросить AI" */}
                 <motion.button
                    onClick={onAskAi}
                    disabled={isAskAiDisabled} // Кнопка теперь всегда неактивна
                    className={`flex items-center justify-center gap-2 w-full sm:w-auto flex-grow px-4 py-2 rounded-full font-semibold text-sm text-white ${
                        isAskAiDisabled
                        ? 'bg-gray-600 opacity-60 cursor-not-allowed' // Стиль неактивной кнопки
                        : 'bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-700 hover:to-indigo-600 shadow-md shadow-blue-500/30 hover:shadow-lg hover:shadow-indigo-500/40'
                    } transition-all`}
                    whileHover={{ scale: isAskAiDisabled ? 1 : 1.03 }}
                    whileTap={{ scale: isAskAiDisabled ? 1 : 0.97 }}
                    aria-label="Отправить запрос AI (временно отключено)"
                 >
                    {aiActionLoading ? <FaSpinner className="animate-spin" /> : <FaRobot />}
                    {aiActionLoading ? "Ждем AI..." : "🤖 Спросить AI"}
                 </motion.button>
            </div>
        </div>
    );
};

export default RequestInput;