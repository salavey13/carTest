"use client";

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import VibeContentRenderer from '@/components/VibeContentRenderer';
import Link from 'next/link';

const childVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.4 } }, exit: { opacity: 0, transition: { duration: 0.2 } }, };

interface IconReplaceToolProps {
    oldIconNameInput?: string; 
    onReplaceConfirmed: (details: { oldIconName: string; newIconName: string; componentProps?: string }) => void;
    onCancel: () => void;
}

export const IconReplaceTool: React.FC<IconReplaceToolProps> = ({ oldIconNameInput = "", onReplaceConfirmed, onCancel }) => {
    const [oldIcon, setOldIcon] = useState(oldIconNameInput);
    const [newIcon, setNewIcon] = useState("");
    // Props string removed for simplicity for now
    // const [propsString, setPropsString] = useState("");

    const normalizeIconName = (name: string): string => {
        let n = name.trim();
        if (n.toLowerCase().startsWith("fa-")) {
            // Convert fa-kebab-case to FaPascalCase
            return "Fa" + n.substring(3).split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
        }
        if (n.length > 0 && !n.startsWith("Fa")) {
            return "Fa" + n.charAt(0).toUpperCase() + n.slice(1);
        }
        return n;
    };

    const handleConfirm = useCallback(() => {
        const normalizedOldIcon = normalizeIconName(oldIcon);
        const normalizedNewIcon = normalizeIconName(newIcon);

        if (!normalizedOldIcon || !normalizedNewIcon) {
            toast.error("Укажите имя старой и новой иконки (например, FaBeer или beer).");
            return;
        }
        // Basic check, VibeContentRenderer will handle actual validation
        if (!normalizedOldIcon.startsWith("Fa") || !normalizedNewIcon.startsWith("Fa")) {
             toast.warning("Имя иконки должно быть в PascalCase и начинаться с 'Fa' (например, FaBeer). Попробую нормализовать...");
        }
        onReplaceConfirmed({ oldIconName: normalizedOldIcon, newIconName: normalizedNewIcon });
    }, [oldIcon, newIcon, onReplaceConfirmed]);

    const canConfirm = oldIcon.trim().length > 0 && newIcon.trim().length > 0;

    return (
        <motion.div
            variants={childVariants}
            className="w-full mt-2 p-3 pb-4 bg-gray-700/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg shadow-lg flex flex-col gap-3"
        >
            <p className="text-xs text-gray-300 font-semibold flex items-center gap-1">
                <VibeContentRenderer content="::FaExchangeAlt::" /> Замена Иконки (Fa6)
            </p>
            
            <div>
                <label htmlFor="old-icon-input" className="block text-xs text-gray-400 mb-0.5">Старая иконка (напр. FaBeer или beer):</label>
                <Input
                    id="old-icon-input"
                    type="text"
                    value={oldIcon}
                    onChange={(e) => setOldIcon(e.target.value)}
                    placeholder="FaOldIconName"
                    className="w-full p-1.5 text-xs h-8 bg-gray-600 border-gray-500 placeholder-gray-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-white"
                />
            </div>

            <div>
                <label htmlFor="new-icon-input" className="block text-xs text-gray-400 mb-0.5">Новая иконка (напр. FaCoffee или coffee):</label>
                <Input
                    id="new-icon-input"
                    type="text"
                    value={newIcon}
                    onChange={(e) => setNewIcon(e.target.value)}
                    placeholder="FaNewIconName"
                    className="w-full p-1.5 text-xs h-8 bg-gray-600 border-gray-500 placeholder-gray-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-white"
                />
            </div>
            <div className="text-xs text-gray-400">
                Искать иконки: {' '}
                <Link href="https://react-icons.github.io/react-icons/search/#q=Fa" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
                    React Icons (Fa6) <VibeContentRenderer content="::FaArrowUpRightFromSquare className='h-2.5 w-2.5'::" />
                </Link>
            </div>
            
            {/* Props input removed for simplicity
            <div>
                <label htmlFor="icon-props-input" className="block text-xs text-gray-400 mb-0.5">
                    Пропсы новой иконки (опционально)
                     <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="ml-1 text-gray-500 hover:text-gray-300"><VibeContentRenderer content="::FaCircleInfo::" /></button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="bg-popover text-popover-foreground border-border shadow-lg text-xs p-1.5 rounded max-w-[250px]">
                                <p>Напр: `className='text-red-500 mr-2' size={20}`</p>
                                <p>Будет применено к новому компоненту иконки.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </label>
                <Input
                    id="icon-props-input"
                    type="text"
                    value={propsString}
                    onChange={(e) => setPropsString(e.target.value)}
                    placeholder="className='text-green-500' size={16}"
                    className="w-full p-1.5 text-xs h-8 bg-gray-600 border-gray-500 placeholder-gray-400/70 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-white"
                />
            </div>
            */}

            <div className="flex justify-end gap-2 mt-2">
                <Button
                    onClick={onCancel}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                >
                    Отмена
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={!canConfirm}
                    size="sm"
                    className="text-xs bg-cyan-600 hover:bg-cyan-500"
                >
                    <VibeContentRenderer content="::FaPaperPlane className='mr-1.5 text-xs'::" />
                    <span className="ml-1">Заменить Иконку</span>
                </Button>
            </div>
        </motion.div>
    );
};

export default IconReplaceTool;