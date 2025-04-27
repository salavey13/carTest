import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FaCopy, FaBroom, FaRobot, FaPlus, FaSpinner } from "react-icons/fa6";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RequestInputProps {
    kworkInputRef: React.RefObject<HTMLTextAreaElement>;
    onCopyToClipboard: () => void;
    onClearAll: () => void;
    onAskAi: () => Promise<any>; // Assuming returns promise
    onAddSelected: () => void;
    isCopyDisabled: boolean;
    isClearDisabled: boolean;
    isAskAiDisabled: boolean;
    aiActionLoading: boolean; // Loading state for AI call
    isAddSelectedDisabled: boolean;
    selectedFetcherFilesCount: number; // Changed prop name for clarity
    onInputChange: (value: string) => void; // Added prop to notify parent of change
}

const RequestInput: React.FC<RequestInputProps> = ({
    kworkInputRef,
    onCopyToClipboard,
    onClearAll,
    onAskAi,
    onAddSelected,
    isCopyDisabled,
    isClearDisabled,
    isAskAiDisabled,
    aiActionLoading,
    isAddSelectedDisabled,
    selectedFetcherFilesCount,
    onInputChange
}) => {
    return (
        <TooltipProvider>
            <div className="flex flex-col gap-3">
                <div className="relative group">
                    <Textarea
                        ref={kworkInputRef}
                        id="kworkInput"
                        className="w-full p-3 pr-10 bg-gray-800 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none transition shadow-[0_0_8px_rgba(168,85,247,0.3)] text-sm min-h-[150px] resize-y simple-scrollbar"
                        placeholder="4. Напиши свой запрос к AI здесь ИЛИ добавь выбранные файлы как контекст ->"
                        onChange={(e) => onInputChange(e.target.value)} // Notify parent on change
                        spellCheck="false"
                    />
                    <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onCopyToClipboard} disabled={isCopyDisabled} className="h-7 w-7 text-gray-400 hover:text-cyan-400 hover:bg-gray-700 disabled:opacity-50">
                                    <FaCopy />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded">Скопировать</TooltipContent>
                        </Tooltip>
                        <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={onClearAll} disabled={isClearDisabled} className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-gray-700 disabled:opacity-50">
                                    <FaBroom />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded">Очистить все</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
                 <div className="flex flex-wrap justify-end gap-3">
                     <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onAddSelected}
                                disabled={isAddSelectedDisabled}
                                className="border-purple-500/50 text-purple-300 hover:bg-purple-900/30 hover:text-purple-200 disabled:opacity-50"
                            >
                                <FaPlus className="mr-2 h-4 w-4" />
                                Добавить Выбранное ({selectedFetcherFilesCount})
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded">
                            Добавить выбранные файлы в запрос
                        </TooltipContent>
                    </Tooltip>
                    <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <Button
                                size="sm"
                                onClick={onAskAi}
                                disabled={isAskAiDisabled || aiActionLoading} // Disable if loading
                                className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:brightness-110 disabled:opacity-60"
                            >
                                {aiActionLoading ? (
                                    <FaSpinner className="animate-spin mr-2 h-4 w-4" />
                                ) : (
                                    <FaRobot className="mr-2 h-4 w-4" />
                                )}
                                {aiActionLoading ? "Думаю..." : "Спросить AI"}
                            </Button>
                         </TooltipTrigger>
                         <TooltipContent side="bottom" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded">
                            Отправить запрос и контекст AI
                        </TooltipContent>
                    </Tooltip>
                 </div>
            </div>
        </TooltipProvider>
    );
};

RequestInput.displayName = 'RequestInput';
export default RequestInput;