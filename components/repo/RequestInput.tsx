"use client";
import React, { useCallback } from "react"; 
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FaCopy, FaBroom, FaPlus, FaWandMagicSparkles } from "react-icons/fa6";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppToast } from "@/hooks/useAppToast"; 
import { ULTIMATE_VIBE_MASTER_PROMPT } from "./prompt"; 
import { debugLogger as logger } from "@/lib/debugLogger"; 

interface RequestInputProps {
    kworkInputRef: React.RefObject<HTMLTextAreaElement>;
    kworkInputValue: string | undefined; 
    onValueChange: (value: string) => void;
    onCopyToClipboard: () => void; 
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
    const { success: toastSuccess, error: toastError } = useAppToast(); 

    const kworkValueTrimmed = typeof kworkInputValue === 'string' ? kworkInputValue.trim() : '';
    const hasContent = kworkValueTrimmed.length > 0;

    const calculatedIsCopyDisabled = !hasContent || isActionDisabled;
    const calculatedIsClearDisabled = (!hasContent && selectedFetcherFilesCount === 0 && !filesFetched) || isActionDisabled;

    const handleCopySystemPrompt = useCallback(() => {
        try {
            navigator.clipboard.writeText(ULTIMATE_VIBE_MASTER_PROMPT);
            toastSuccess("✨ Системный промпт скопирован! Вставь его боту перед основным запросом.");
            logger.info("[RequestInput] Copied SYSTEM PROMPT to clipboard.");
        } catch (e) {
            logger.error("[RequestInput] System prompt clipboard write error:", e);
            toastError("Ошибка копирования системного промпта");
        }
    }, [toastSuccess, toastError]); // Removed logger from deps as it's stable

    return (
        <TooltipProvider>
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <Textarea
                        ref={kworkInputRef}
                        id="kworkInput"
                        value={kworkInputValue ?? ''} 
                        onChange={(e) => onValueChange(e.target.value)}
                        className="textarea-cyber" 
                        placeholder="4. Напиши свой запрос к AI здесь ИЛИ добавь выбранные файлы как контекст ->"
                        spellCheck="false"
                        disabled={isActionDisabled}
                    />
                    <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleCopySystemPrompt}
                                    disabled={isActionDisabled} 
                                    className="h-7 w-7 text-muted-foreground hover:text-brand-yellow hover:bg-muted disabled:opacity-50" 
                                >
                                    <FaWandMagicSparkles />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-popover text-popover-foreground border-border shadow-lg text-xs p-1.5 rounded max-w-[200px]">Копировать СУПЕР-ПРОМПТ (вставь его боту перед запросом)</TooltipContent>
                        </Tooltip>

                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onCopyToClipboard} disabled={calculatedIsCopyDisabled} className="h-7 w-7 text-muted-foreground hover:text-brand-cyan hover:bg-muted disabled:opacity-50"> 
                                    <FaCopy />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-popover text-popover-foreground border-border shadow-lg text-xs p-1.5 rounded">Скопировать запрос</TooltipContent>
                        </Tooltip>

                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onClearAll} disabled={calculatedIsClearDisabled} className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-muted disabled:opacity-50"> 
                                    <FaBroom />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-popover text-popover-foreground border-border shadow-lg text-xs p-1.5 rounded">Очистить все</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
                 <div className="flex flex-wrap justify-end gap-3">
                     <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="default" 
                                size="sm"
                                onClick={onAddSelected}
                                disabled={isAddSelectedDisabled || isActionDisabled}
                                className="rounded-full shadow-md hover:shadow-lg transition-all disabled:opacity-50 px-4" 
                            >
                                <FaPlus className="mr-2 h-4 w-4" />
                                Добавить Выбранное ({selectedFetcherFilesCount})
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-popover text-popover-foreground border-border shadow-lg text-xs p-1.5 rounded">
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