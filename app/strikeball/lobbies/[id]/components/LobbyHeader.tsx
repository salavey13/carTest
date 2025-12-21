"use client";

import { FaShareNodes, FaFilePdf, FaSpinner } from "react-icons/fa6";

interface LobbyHeaderProps {
    name: string;
    mode: string;
    status: string;
    onPdf: () => void;
    onShare: () => void;
    loading: boolean;
}

export function LobbyHeader({ name, mode, status, onPdf, onShare, loading }: LobbyHeaderProps) {
    return (
        <div className="text-center mb-10 relative">
            <div className="absolute top-0 right-0 flex gap-3">
                <button 
                    onClick={onPdf} 
                    disabled={loading} 
                    className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95"
                >
                    {loading ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
                </button>
                <button 
                    onClick={onShare} 
                    className="p-2 border border-zinc-800 text-zinc-600 hover:text-white transition-all active:scale-95"
                >
                    <FaShareNodes />
                </button>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-[0.2em]">{name}</h1>
            <div className="text-[9px] text-zinc-600 mt-1 uppercase tracking-widest">{mode} // {status}</div>
        </div>
    );
}