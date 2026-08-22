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
    // const [propsString, setPropsString] = useState(""); // Props string removed for simplicity for now

    const normalizeIconName = useCallback((name: string): string => {
        let processingName = name.trim();
        if (!processingName) return "";

        // 1. Handle fa-kebab-case (e.g., fa-magic-wand -> FaMagicWand)
        if (processingName.toLowerCase().startsWith("fa-")) {
            const parts = processingName.substring(3).split('-');
            // Ensure each part after "fa-" is PascalCased
            processingName = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
            return "Fa" + processingName;
        }

        // 2. Strip any "Fa" or "fa" prefix to get the core name
        // This helps to avoid "FaFaMagicWand" if input is "FaMagicWand" or "famagicwand"
        if (processingName.toLowerCase().startsWith("fa")) {
            processingName = processingName.substring(2);
        }

        // 3. Ensure the core name is PascalCased (e.g. "magicWand" -> "MagicWand")
        if (processingName.length > 0) {
            processingName = processingName.charAt(0).toUpperCase() + processingName.slice(1);
        } else {
            // This case means the input was likely just "fa" or "Fa" before stripping
            return ""; 
        }
        
        // 4. Prepend "Fa" to the PascalCased core name
        return "Fa" + processingName;
    }, []);

    const handleConfirm = useCallback(() => {
        const normalizedOldIcon = normalizeIconName(oldIcon);
        const normalizedNewIcon = normalizeIconName(newIcon);

        if (!normalizedOldIcon || !normalizedNewIcon) {
            toast.error("Укажите имя старой и новой иконки (например, FaBeer или beer).");
            return;
        }
        
        // Basic check, VibeContentRenderer will handle actual validation later
        // This warning is mostly for user feedback during input.
        if (!normalizedOldIcon.startsWith("Fa") || !normalizedOldIcon.charAt(2).match(/[A-Z]/) || 
            !normalizedNewIcon.startsWith("Fa") || !normalizedNewIcon.charAt(2).match(/[A-Z]/)
           ) {
             toast.warning("Имя иконки должно быть в PascalCase и начинаться с 'Fa' (например, FaBeer). Попробовал нормализовать. Проверьте результат.");
        }
        onReplaceConfirmed({ oldIconName: normalizedOldIcon, newIconName: normalizedNewIcon });
    }, [oldIcon, newIcon, onReplaceConfirmed, normalizeIconName]);

    const canConfirm = oldIcon.trim().length > 0 && newIcon.trim().length > 0;

    return (
        <motion.div
            variants={childVariants}
            className="w-full mt-2 p-3 pb-4 bg-gray-700/80 backdrop-blur-sm border border-cyan-500/50 rounded-lg shadow-lg flex flex-col gap-3"
        >
            <p className="text-xs text-gray-300 font-semibold flex items-center gap-1">
                <VibeContentRenderer content="::FaIcons::" /> Замена Иконки (Fa6)
            </p>
            
            <div>
                <label htmlFor="old-icon-input" className="block text-xs text-gray-400 mb-0.5">Старая иконка (напр. FaBeer, beer, fa-beer):</label>
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
                <label htmlFor="new-icon-input" className="block text-xs text-gray-400 mb-0.5">Новая иконка (напр. FaCoffee, coffee, fa-coffee):</label>
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
                    className="text-xs bg-cyan-600 hover:bg-cyan-500 flex items-center"
                >
                    <VibeContentRenderer content="::FaPaperPlane className='mr-1.5 text-xs'::" />
                    <span>Заменить Иконку</span>
                </Button>
            </div>
        </motion.div>
    );
};

export default IconReplaceTool;