"use client";

import React, { useState } from "react";
import { createCheckpoint } from "../actions/domination";
import { toast } from "sonner";
import { FaPlus, FaQrcode } from "react-icons/fa6";
import { motion, AnimatePresence } from "framer-motion";

const QRModal = ({ value, title, onClose }: any) => (
    <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white p-6 text-center max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}&color=000&bgcolor=fff&margin=1`} 
                className="w-full h-auto mb-4 border border-black" 
                alt="Tactical QR"
            />
            <div className="text-black font-mono font-black text-sm uppercase tracking-tighter mb-1">{title}</div>
            <div className="text-[10px] text-zinc-500 font-mono break-all uppercase">UID: {value.split('_')[1]}</div>
            <button onClick={onClose} className="mt-6 w-full bg-black text-white py-3 font-mono font-bold uppercase tracking-widest">CLOSE_OBJECTIVE</button>
        </div>
    </div>
);

export const AdminCheckpointPanel = ({ lobbyId, onLoad }: { lobbyId: string, onLoad: () => void }) => {
    const [name, setName] = useState("");
    const [viewQr, setViewQr] = useState<{id: string, name: string} | null>(null);

    const handleCreate = async () => {
        if (!name) return;
        const res = await createCheckpoint(lobbyId, name);
        if (res.success) {
            setName("");
            onLoad();
            toast.success("OBJECTIVE_DEPLOYED");
        }
    };

    return (
        <div className="bg-[#000000] border border-zinc-800 p-4 mt-8">
            <h3 className="font-mono text-zinc-500 mb-4 text-[10px] font-bold uppercase tracking-[0.4em]">FIELD_ENGINEERING</h3>
            
            <div className="flex gap-2">
                <input 
                    value={name} onChange={e => setName(e.target.value)} 
                    placeholder="SIGNAL_TAG (e.g. ALPHA)" 
                    className="flex-1 bg-black border border-zinc-800 p-3 text-white text-xs font-mono focus:border-white outline-none rounded-none"
                />
                <button onClick={handleCreate} className="bg-zinc-800 text-white px-6 font-mono font-bold text-xs hover:bg-white hover:text-black transition-colors">
                    DEPLOY
                </button>
            </div>

            <AnimatePresence>
                {viewQr && (
                    <QRModal 
                        value={`capture_${viewQr.id}`} 
                        title={`OBJECTIVE_${viewQr.name}`} 
                        onClose={() => setViewQr(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
};