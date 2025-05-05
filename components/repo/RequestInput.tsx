"use client";
import React, { useCallback } from "react"; // Добавлен useCallback
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
// Добавлена FaWandMagicSparkles
import { FaCopy, FaBroom, FaPlus, FaWandMagicSparkles } from "react-icons/fa6";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppToast } from "@/hooks/useAppToast"; // Импортируем хук для тостов
import { ULTIMATE_VIBE_MASTER_PROMPT } from "./prompt"; // Импортируем сам промпт
import { debugLogger as logger } from "@/lib/debugLogger"; // Импортируем логгер

interface RequestInputProps {
    kworkInputRef: React.RefObject<HTMLTextAreaElement>;
    kworkInputValue: string | undefined; // Допускаем undefined
    onValueChange: (value: string) => void;
    onCopyToClipboard: () => void; // Оставляем для копирования *текущего* запроса
    onClearAll: () => void;
    onAddSelected: () => void;
    isAddSelectedDisabled: boolean;
    selectedFetcherFilesCount: number;
    isActionDisabled?: boolean;
    filesFetched?: boolean;
}

const RequestInput: React.FC<RequestInputProps> = ({
    kworkInputRef,
    kworkInputValue,
    onValueChange,
    onCopyToClipboard,
    onClearAll,
    onAddSelected,
    isAddSelectedDisabled,
    selectedFetcherFilesCount,
    isActionDisabled = false,
    filesFetched = false,
}) => {
    const { success: toastSuccess, error: toastError } = useAppToast(); // Получаем функции тостов

    // --- Безопасное вычисление зависимых состояний ---
    // Используем typeof для проверки и trim(), если это строка, иначе пустая строка
    const kworkValueTrimmed = typeof kworkInputValue === 'string' ? kworkInputValue.trim() : '';
    const hasContent = kworkValueTrimmed.length > 0;

    // Кнопка копирования активна, если есть контент и действия не заблокированы
    const calculatedIsCopyDisabled = !hasContent || isActionDisabled;
    // Кнопка очистки активна, если есть контент ИЛИ выбраны файлы ИЛИ файлы были загружены (чтобы можно было очистить даже пустой инпут после загрузки), и действия не заблокированы
    const calculatedIsClearDisabled = (!hasContent && selectedFetcherFilesCount === 0 && !filesFetched) || isActionDisabled;
    // --- Конец безопасного вычисления ---

    // --- НОВЫЙ ОБРАБОТЧИК для копирования системного промпта ---
    const handleCopySystemPrompt = useCallback(() => {
        try {
            navigator.clipboard.writeText(ULTIMATE_VIBE_MASTER_PROMPT);
            toastSuccess("✨ Системный промпт скопирован! Вставь его боту перед основным запросом.");
            logger.info("[RequestInput] Copied SYSTEM PROMPT to clipboard.");
        } catch (e) {
            logger.error("[RequestInput] System prompt clipboard write error:", e);
            toastError("Ошибка копирования системного промпта");
        }
    }, [toastSuccess, toastError, logger]); // Зависимости только от тостов и логгера

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-3">
                <div className="relative group">
                    <Textarea
                        ref={kworkInputRef}
                        id="kworkInput"
                        value={kworkInputValue ?? ''} // Гарантируем строку здесь
                        onChange={(e) => onValueChange(e.target.value)}
                        className="w-full p-3 pr-10 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition shadow-[0_0_8px_rgba(168,85,247,0.3)] text-sm min-h-[150px] resize-y simple-scrollbar"
                        placeholder="4. Напиши свой запрос к AI здесь ИЛИ добавь выбранные файлы как контекст ->"
                        spellCheck="false"
                        disabled={isActionDisabled}
                    />
                    {/* --- Блок кнопок утилиты --- */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                        {/* НОВАЯ КНОПКА: Копировать Системный Промпт */}
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCopySystemPrompt}
                                    disabled={isActionDisabled} // Дизейблим вместе с остальными
                                    className="h-7 w-7 text-gray-400 hover:text-yellow-400 hover:bg-gray-700 disabled:opacity-50"
                                >
                                    <FaWandMagicSparkles />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded max-w-[200px]">Копировать СУПЕР-ПРОМПТ (вставь его боту перед запросом)</TooltipContent>
                        </Tooltip>

                        {/* Копировать ТЕКУЩИЙ Запрос */}
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onCopyToClipboard} disabled={calculatedIsCopyDisabled} className="h-7 w-7 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 disabled:opacity-50">
                                    <FaCopy />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded">Скопировать запрос</TooltipContent>
                        </Tooltip>

                        {/* Очистить Все */}
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onClearAll} disabled={calculatedIsClearDisabled} className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-gray-700 disabled:opacity-50">
                                    <FaBroom />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded">Очистить все</TooltipContent>
                        </Tooltip>
                    </div>
                    {/* --- Конец блока кнопок --- */}
                </div>
                 <div className="flex flex-wrap justify-end gap-3">
                     {/* Добавить Выбранное */}
                     <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={onAddSelected}
                                disabled={isAddSelectedDisabled || isActionDisabled}
                                className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 px-4"
                            >
                                <FaPlus className="mr-2 h-4 w-4" />
                                Добавить Выбранное ({selectedFetcherFilesCount})
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded">
                            Добавить выбранные файлы в запрос
                        </TooltipContent>
                    </Tooltip>
                 </div>
            </div>
        </TooltipProvider>
    );
};

RequestInput.displayName = 'RequestInput';
export default RequestInput;