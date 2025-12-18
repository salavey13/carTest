"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { getUserCombatStats } from "../actions/stats";
import { getUserPurchases } from "../actions/market";
import { motion, AnimatePresence } from "framer-motion";
import { FaSkull, FaCrosshairs, FaMedal, FaClock, FaBoxOpen, FaQrcode } from "react-icons/fa6";
import Image from "next/image";
import { cn } from "@/lib/utils";

const DEFAULT_STATS = { matches: 0, wins: 0, kd: "-", accuracy: "-" };

const StatCard = ({ label, value, icon: Icon, color, delay }: any) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="bg-zinc-900/80 border border-zinc-800 p-4 flex items-center justify-between group hover:border-red-500/50 transition-colors"
    >
        <div>
            <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-1">{label}</div>
            <div className={cn("text-2xl font-black font-orbitron", color)}>{value}</div>
        </div>
        <div className="p-3 bg-black/50 rounded-sm border border-zinc-800 group-hover:border-red-500/30">
            <Icon className={cn("w-6 h-6", color)} />
        </div>
    </motion.div>
);

// Helper for QR Modal
const QRModal = ({ value, onClose }: { value: string, onClose: () => void }) => (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
        <div className="bg-white p-4 rounded-lg shadow-2xl max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            {/* Fallback to API since qrcode.react might need install, but if installed prefer <QRCodeSVG value={value} /> */}
            <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}`} 
                alt="QR Code" 
                className="w-full h-auto"
            />
            <p className="text-black font-mono font-bold mt-4 uppercase text-xs">Покажите администратору</p>
            <div className="text-gray-500 text-[10px] mt-1 break-all">{value}</div>
            <button onClick={onClose} className="mt-4 w-full bg-black text-white py-3 font-bold uppercase font-orbitron hover:bg-zinc-800 transition-colors">Закрыть</button>
        </div>
    </div>
);

export default function StatsPage() {
    const { user, userCrewInfo, dbUser } = useAppContext();
    const [stats, setStats] = useState(DEFAULT_STATS);
    const [purchases, setPurchases] = useState<any[]>([]);
    const [showProfileQR, setShowProfileQR] = useState(false);
    const [itemQrValue, setItemQrValue] = useState<string | null>(null);

    useEffect(() => {
        if(dbUser?.user_id) {
            // Fetch Combat Stats
            getUserCombatStats(dbUser.user_id).then(res => {
                if(res.success && res.data) {
                    setStats({
                        matches: res.data.matches,
                        wins: res.data.wins,
                        kd: res.data.kd,
                        accuracy: res.data.accuracy
                    });
                }
            });

            // Fetch Inventory (Stash)
            getUserPurchases(dbUser.user_id).then(res => {
                if(res.success) setPurchases(res.data || []);
            });
        }
    }, [dbUser?.user_id]);

    const myProfileQr = `user_${dbUser?.user_id}`;

    return (
        <div className="pt-28 pb-32 px-4 min-h-screen text-white font-orbitron">
            <AnimatePresence>
                {/* Generic Profile QR */}
                {showProfileQR && <QRModal value={myProfileQr} onClose={() => setShowProfileQR(false)} />}
                
                {/* Specific Item QR */}
                {itemQrValue && <QRModal value={itemQrValue} onClose={() => setItemQrValue(null)} />}
            </AnimatePresence>

            {/* Header */}
            <div className="text-center mb-10 relative">
                <button 
                    onClick={() => setShowProfileQR(true)}
                    className="absolute top-0 right-0 p-3 bg-zinc-800 rounded-full text-white hover:bg-zinc-700 transition-colors border border-zinc-600 shadow-lg"
                    title="Show Profile QR"
                >
                    <FaQrcode />
                </button>

                <h1 className="text-4xl font-black text-red-600 tracking-tighter uppercase drop-shadow-lg">
                    ЛИЧНОЕ ДЕЛО
                </h1>
                <div className="text-[10px] font-mono text-zinc-500 bg-zinc-900/80 inline-block px-4 py-1 mt-2 border border-zinc-800">
                    ID: {user?.id || "UNKNOWN"} // STATUS: ACTIVE
                </div>
            </div>

            {/* Operator Card */}
            <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-2xl mx-auto bg-black/60 backdrop-blur-md border-2 border-zinc-800 p-6 mb-8 relative overflow-hidden"
            >
                <motion.div 
                    className="absolute top-0 left-0 right-0 h-1 bg-red-500/50 blur-sm z-0"
                    animate={{ top: ["0%", "100%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />

                <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-24 h-24 bg-zinc-900 border-2 border-red-900 flex-shrink-0 relative">
                        {user?.photo_url ? (
                            <Image src={user.photo_url} alt="User" fill className="object-cover grayscale hover:grayscale-0 transition-all" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-700 text-4xl">?</div>
                        )}
                        <div className="absolute bottom-0 right-0 bg-red-600 text-white text-[9px] font-bold px-1">LVL 1</div>
                    </div>
                    
                    <div className="text-center sm:text-left">
                        <h2 className="text-2xl font-bold text-zinc-100">{user?.username || "OPERATOR"}</h2>
                        <div className="text-sm font-mono text-red-400 mt-1">
                            {userCrewInfo ? `ОТРЯД: ${userCrewInfo.name.toUpperCase()}` : "БЕЗ ОТРЯДА"}
                        </div>
                        <div className="flex gap-2 mt-3 justify-center sm:justify-start">
                            <span className="px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">ШТУРМОВИК</span>
                            <span className="px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-400 border border-zinc-700">РАЗВЕДКА</span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="max-w-2xl mx-auto grid grid-cols-2 gap-3 mb-8">
                <StatCard label="МАТЧЕЙ" value={stats.matches} icon={FaClock} color="text-zinc-300" delay={0.1} />
                <StatCard label="ПОБЕД" value={stats.wins} icon={FaMedal} color="text-amber-500" delay={0.2} />
                <StatCard label="K/D" value={stats.kd} icon={FaSkull} color="text-red-500" delay={0.3} />
                <StatCard label="ТОЧНОСТЬ" value={stats.accuracy} icon={FaCrosshairs} color="text-cyan-500" delay={0.4} />
            </div>

            {/* MY STASH (Inventory) */}
            <div className="max-w-2xl mx-auto mb-8">
                <h3 className="text-sm font-bold text-zinc-500 mb-4 uppercase tracking-widest flex items-center gap-2 border-b border-zinc-800 pb-2">
                    <FaBoxOpen className="text-emerald-500" /> МОЙ ИНВЕНТАРЬ ({purchases.length})
                </h3>
                
                <div className="space-y-3">
                    {purchases.length === 0 && (
                        <div className="p-4 border border-dashed border-zinc-800 text-center text-zinc-600 font-mono text-xs rounded">
                            ПУСТО. ПОСЕТИТЕ АРСЕНАЛ.
                        </div>
                    )}
                    
                    {purchases.map((p, i) => (
                        <motion.div 
                            key={p.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="bg-zinc-900/60 border border-zinc-800 p-3 flex justify-between items-center rounded-lg hover:border-emerald-500/30 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-black relative border border-zinc-700 rounded-sm overflow-hidden">
                                    {p.metadata?.image_url ? (
                                        <Image src={p.metadata.image_url} alt="Item" fill className="object-cover opacity-80" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-zinc-700 font-bold">?</div>
                                    )}
                                </div>
                                <div>
                                    <div className="font-bold text-zinc-200 text-sm">{p.metadata?.item_name || "Unknown Item"}</div>
                                    <div className="text-[10px] text-zinc-500 font-mono flex gap-2 mt-0.5">
                                       <span className={cn(
                                           "uppercase font-bold",
                                           p.status === 'paid' ? "text-emerald-500" :
                                           p.status === 'returned' ? "text-zinc-600" : "text-amber-500"
                                       )}>
                                           {p.status}
                                       </span>
                                       <span className="text-zinc-700">|</span>
                                       <span>{new Date(p.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                                <div className="text-xs font-mono text-emerald-500 font-bold">{p.total_price} XTR</div>
                                {p.status === 'paid' && (
                                    <button 
                                        onClick={() => setItemQrValue(`purchase_${p.id}`)}
                                        className="bg-zinc-100 text-black px-3 py-1 rounded text-[10px] font-bold font-orbitron hover:bg-white hover:scale-105 transition-all flex items-center gap-1"
                                    >
                                        <FaQrcode size={10} /> QR
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Performance Graph Placeholder */}
            <div className="max-w-2xl mx-auto">
                <div className="bg-zinc-900/40 border border-zinc-800 p-4 relative rounded-lg">
                    <h3 className="text-xs font-mono text-zinc-500 mb-4 uppercase">Боевая Эффективность (Симуляция)</h3>
                    
                    <div className="h-32 flex items-end gap-1">
                        {[...Array(20)].map((_, i) => {
                            const height = Math.floor(Math.random() * 80) + 10;
                            return (
                                <motion.div 
                                    key={i}
                                    initial={{ height: 0 }}
                                    animate={{ height: `${height}%` }}
                                    transition={{ delay: i * 0.05, duration: 0.5 }}
                                    className="flex-1 bg-red-900/50 hover:bg-red-500 transition-colors border-t border-red-500/30 rounded-t-sm"
                                />
                            )
                        })}
                    </div>
                    <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_20px]" />
                </div>
                <p className="text-[10px] text-zinc-600 font-mono mt-2 text-center">
                    * Данные обновляются после подтверждения результатов командиром лобби.
                </p>
            </div>
        </div>
    );
}