"use client";

import React, { useState } from "react";
import { createCheckpoint } from "../actions/domination";
import { toast } from "sonner";
import { FaPlus, FaQrcode } from "react-icons/fa6";
import { motion, AnimatePresence } from "framer-motion";

// Helper for QR Modal (Reusing/Duplicating for simplicity or import if shared)
const QRModal = ({ value, title, onClose }: any) => (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
        <div className="bg-white p-4 rounded-lg text-center" onClick={e => e.stopPropagation()}>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}`} className="w-64 h-64 mx-auto" />
            <div className="text-black font-black mt-4 text-xl uppercase">{title}</div>
            <div className="text-xs text-gray-500 mt-1 break-all">ID ЦЕЛИ: {value.split('_')[1]?.slice(0,8)}</div>
            <button onClick={onClose} className="mt-4 w-full bg-black text-white py-3 font-bold uppercase">ЗАКРЫТЬ</button>
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
            toast.success(`Точка "${name}" успешно создана`);
            setName("");
            onLoad();
        } else {
            toast.error(res.error);
        }
    };

    // The QR Code payload format: "capture_{checkpointId}"
    // The Admin Scanner will need to handle this prefix, OR the user's generic scanner.

    return (
        <div className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl mt-4">
            <h3 className="font-orbitron text-amber-500 mb-4 text-sm font-bold uppercase">ПОЛЕВАЯ ИНЖЕНЕРИЯ</h3>
            
            <div className="flex gap-2 mb-4">
                <input 
                    value={name} onChange={e => setName(e.target.value)} 
                    placeholder="Название точки (напр. Альфа)" 
                    className="flex-1 bg-black border border-zinc-700 p-2 text-white text-xs font-mono focus:border-amber-500 outline-none placeholder:text-zinc-600"
                />
                <button onClick={handleCreate} className="bg-amber-600 text-black px-4 font-bold text-xs hover:bg-amber-500">
                    <FaPlus />
                </button>
            </div>

            <AnimatePresence>
                {viewQr && (
                    <QRModal 
                        value={`capture_${viewQr.id}`} 
                        title={`ЗАХВАТ: ${viewQr.name}`} 
                        onClose={() => setViewQr(null)} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
};