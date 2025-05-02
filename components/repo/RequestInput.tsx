"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FaCopy, FaBroom, FaPlus } from "react-icons/fa6";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RequestInputProps {
    kworkInputRef: React.RefObject<HTMLTextAreaElement>;
    onCopyToClipboard: () => void;
    onClearAll: () => void;
    onAddSelected: () => void; // Keep Add Selected handler
    isCopyDisabled: boolean;
    isClearDisabled: boolean;
    isAddSelectedDisabled: boolean;
    selectedFetcherFilesCount: number;
    onInputChange: (value: string) => void;
}

const RequestInput: React.FC<RequestInputProps> = ({
    kworkInputRef,
    onCopyToClipboard,
    onClearAll,
    onAddSelected, // Keep Add Selected handler
    isCopyDisabled,
    isClearDisabled,
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
                        onChange={(e) => onInputChange(e.target.value)}
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
                            {/* --- STYLED Add Files Button --- */}
                            <Button
                                variant="default" // More prominent variant
                                size="sm"
                                onClick={onAddSelected}
                                disabled={isAddSelectedDisabled}
                                className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 px-4" // rounded-full, gradient, shadow
                            >
                                <FaPlus className="mr-2 h-4 w-4" />
                                Добавить Выбранное ({selectedFetcherFilesCount})
                            </Button>
                            {/* --- END STYLED Add Files Button --- */}
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="bg-gray-800 text-gray-200 border-gray-700 shadow-lg text-xs p-1.5 rounded">
                            Добавить выбранные файлы в запрос
                        </TooltipContent>
                    </Tooltip>
                     {/* Ask AI button completely removed */}
                 </div>
            </div>
        </TooltipProvider>
    );
};

RequestInput.displayName = 'RequestInput';
export default RequestInput;