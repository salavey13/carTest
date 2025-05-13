"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { FaScrewdriverWrench, FaLink, FaPlus, FaRobot, FaImage, FaBook, FaDatabase, FaRocket, FaCode } from 'react-icons/fa6';

interface LinkItem {
    name: string;
    url: string;
    icon?: JSX.Element;
}

interface ToolsMenuProps {
    customLinks: LinkItem[];
    onAddCustomLink: () => void;
    disabled?: boolean; // Added disabled prop
}

// Moved predefined links here as they are static presentation data
const predefinedLinks: LinkItem[] = [
    { name: "aiStudio", url: "https://aistudio.google.com", icon: <FaRobot className="text-purple-300 font-bold drop-shadow-lg" />  },
    { name: "ChatGPT", url: "https://chatgpt.com", icon: <FaImage className="text-blue-300 font-bold drop-shadow-md" /> },
    { name: "Grok", url: "https://grok.com", icon: <FaRobot className="text-yellow-400 font-bold drop-shadow-md" /> },
    { name: "QwenLM", url: "https://qwenlm.ai", icon: <FaImage className="text-blue-500" /> },
    { name: "NotebookLM", url: "https://notebooklm.google.com", icon: <FaBook className="text-yellow-500" /> },
    { name: "Supabase", url: "https://supabase.com/dashboard", icon: <FaDatabase className="text-teal-500" /> },
    { name: "Vercel", url: "https://vercel.com", icon: <FaRocket className="text-black" /> },
    { name: "Coze", url: "https://coze.com", icon: <FaCode className="text-purple-500" /> },
];

export const ToolsMenu: React.FC<ToolsMenuProps> = ({ customLinks, onAddCustomLink, disabled = false }) => {
    const [showToolsMenu, setShowToolsMenu] = useState(false);

    return (
        <div className="relative inline-block">
            <button
                className={clsx(
                    "flex items-center gap-2 px-3 py-2 bg-card rounded-full hover:bg-muted transition shadow-[0_0_12px_hsl(var(--brand-green)/0.3)]", // Use theme colors
                    showToolsMenu && "bg-muted ring-1 ring-brand-cyan", // Use theme colors
                    disabled && "opacity-50 cursor-not-allowed" // Apply disabled style
                )}
                onClick={() => !disabled && setShowToolsMenu(!showToolsMenu)} // Disable click if disabled
                disabled={disabled} // Add disabled attribute
            >
                <FaScrewdriverWrench className="text-muted-foreground" /> {/* Use theme color */}
                <span className="text-sm text-foreground">Инструменты</span> {/* Use theme color */}
            </button>
            {showToolsMenu && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className="absolute left-0 bottom-full mb-2 w-56 bg-card rounded-lg shadow-lg z-20 border border-border overflow-hidden" // Use theme colors
                    onMouseLeave={() => setShowToolsMenu(false)} // Close on mouse leave
                >
                    {/* Predefined Links Section */}
                    <div className="py-1">
                        {predefinedLinks.map((link) => (
                             <a href={link.url} target="_blank" rel="noopener noreferrer" key={link.name} title={link.url} className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted text-sm transition text-foreground group"> {/* Use theme colors */}
                                  <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                       {link.icon ?? <FaLink className="text-muted-foreground group-hover:text-foreground" />} {/* Use theme colors */}
                                  </span>
                                  <span className="flex-grow truncate">{link.name}</span>
                              </a>
                        ))}
                    </div>
                    {/* Custom Links Section (if any) */}
                    {customLinks.length > 0 && <hr className="border-border" />} {/* Use theme color */}
                    {customLinks.length > 0 && (
                         <div className="py-1">
                            {customLinks.map((link) => (
                                 <a href={link.url} target="_blank" rel="noopener noreferrer" key={link.name} title={link.url} className="flex items-center gap-2.5 px-4 py-2 hover:bg-muted text-sm transition text-foreground group"> {/* Use theme colors */}
                                       <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                                           <FaLink className="text-muted-foreground group-hover:text-foreground" /> {/* Use theme colors */}
                                       </span>
                                       <span className="flex-grow truncate">{link.name}</span>
                                  </a>
                            ))}
                         </div>
                    )}
                    {/* Add Link Button */}
                     <hr className="border-border" /> {/* Use theme color */}
                    <button className="flex items-center gap-2.5 w-full text-left px-4 py-2 hover:bg-muted text-sm text-brand-cyan transition group" onClick={onAddCustomLink}> {/* Use theme colors */}
                        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                             <FaPlus className="text-brand-cyan group-hover:text-brand-cyan/80" /> {/* Use theme color */}
                        </span>
                         Добавить свою ссылку
                    </button>
                </motion.div>
            )}
        </div>
    );
};
ToolsMenu.displayName = 'ToolsMenu';