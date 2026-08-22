"use client";

import { cn } from "@/lib/utils";
import { FaUsers, FaGamepad, FaMapLocationDot, FaCar, FaClipboardCheck } from "react-icons/fa6";

export function LobbyTabs({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) {
    const tabs = [
        { id: 'roster', icon: FaUsers, label: 'ОТРЯД' },
        { id: 'game', icon: FaGamepad, label: 'ХАД_БОЯ' },
        { id: 'map', icon: FaMapLocationDot, label: 'СЕТКА' },
        { id: 'logistics', icon: FaCar, label: 'ЛОГИ' },
        { id: 'safety', icon: FaClipboardCheck, label: 'БРИФ' }
    ];

    return (
        <div className="flex justify-center gap-px bg-zinc-900 border border-zinc-900 mb-8 overflow-x-auto no-scrollbar">
            {tabs.map(tab => (
                <button 
                    key={tab.id} 
                    onClick={() => setActiveTab(tab.id)} 
                    className={cn(
                        "flex-1 min-w-[70px] py-4 text-[9px] font-black flex flex-col items-center gap-1 transition-all uppercase",
                        activeTab === tab.id ? "bg-white text-black" : "bg-black text-zinc-600 hover:bg-zinc-950"
                    )}
                >
                    <tab.icon className="text-base" /> 
                    <span>{tab.label}</span>
                </button>
            ))}
        </div>
    );
}