"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getInstructorsByService, createInstructorLobby } from "../actions";
import { useAppContext } from "@/contexts/AppContext";
import { 
    FaPersonSkiing, FaGamepad, FaMapLocationDot, FaStar, 
    FaBolt, FaCircleCheck, FaSnowflake, FaCrosshairs, FaFire
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SERVICE_TYPES = [
    { id: 'snowboard_instructor', label: 'Сноуборд', icon: <FaSnowflake />, color: 'from-blue-500 to-cyan-400' },
    { id: 'dota2_coach', label: 'Dota 2 / LAN', icon: <FaGamepad />, color: 'from-red-600 to-purple-600' }
];

export default function UniversalInstructorsPage() {
    const { dbUser } = useAppContext();
    const router = useRouter();
    const [instructors, setInstructors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeService, setActiveService] = useState(SERVICE_TYPES[0]);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        setLoading(true);
        getInstructorsByService(activeService.id).then(res => {
            if (res.success) setInstructors(res.data);
            setLoading(false);
        });
    }, [activeService]);

    const handleBooking = (providerId: string, packageId: string) => {
        if (!dbUser?.user_id) return toast.error("ТРЕБУЕТСЯ АВТОРИЗАЦИЯ");

        startTransition(async () => {
            const res = await createInstructorLobby(dbUser.user_id, providerId, packageId, activeService.id);
            if (res.success) {
                toast.success("КОНТРАКТ ИНИЦИИРОВАН", { icon: <FaCircleCheck className="text-brand-gold" /> });
                router.push(`/strikeball/lobbies/${res.lobbyId}`);
            } else {
                toast.error("Ошибка системы", { description: res.error });
            }
        });
    };

    return (
        <div className="pt-28 pb-32 px-4 min-h-screen text-foreground bg-[#050505]">
            <div className="max-w-4xl mx-auto space-y-10">
                
                {/* 1. Class Switcher */}
                <div className="flex justify-center gap-2 flex-wrap">
                    {SERVICE_TYPES.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setActiveService(type)}
                            className={cn(
                                "px-6 py-3 rounded-none font-black font-orbitron uppercase text-[10px] tracking-widest border-2 transition-all flex items-center gap-2",
                                activeService.id === type.id 
                                    ? "bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]" 
                                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600"
                            )}
                        >
                            {type.icon} {type.label}
                        </button>
                    ))}
                </div>

                {/* 2. Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-5xl font-black font-orbitron tracking-tighter uppercase italic">
                        <span className={cn("text-transparent bg-clip-text bg-gradient-to-r", activeService.color)}>
                            {activeService.label} Ops
                        </span>
                    </h1>
                    <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.3em]">
                        Инструкторы
                    </p>
                </div>

                {/* 3. Instructors List */}
                <div className="grid grid-cols-1 gap-6">
                    {loading ? (
                        <div className="py-20 text-center animate-pulse text-zinc-700 font-black">Загрузка...</div>
                    ) : instructors.map((instructor) => (
                        <div key={instructor.id} className="bg-zinc-900/50 border border-zinc-800 rounded-none overflow-hidden hover:border-zinc-500 transition-all">
                            <div className="p-6 flex flex-col md:flex-row gap-8">
                                {/* Avatar */}
                                <div className="w-24 h-24 md:w-32 md:h-32 bg-black border-2 border-zinc-800 shrink-0 relative group">
                                    <img src={instructor.logo_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-all" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                                </div>

                                <div className="flex-1 space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h2 className="text-2xl font-black font-orbitron text-white uppercase italic">{instructor.name}</h2>
                                            <div className="flex items-center gap-1 mt-1 text-brand-gold">
                                                <FaStar size={10} /> <span className="text-xs font-bold">{instructor.rating}</span>
                                                <span className="text-zinc-600 text-[10px] ml-2">[{instructor.reviews} REVIEWS]</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[8px] text-zinc-500 font-mono uppercase">От</div>
                                            <div className="text-xl font-black text-white">{instructor.min_price} ₽</div>
                                        </div>
                                    </div>

                                    <p className="text-xs text-zinc-400 font-mono leading-relaxed border-l-2 border-zinc-800 pl-4 italic">
                                        {instructor.description}
                                    </p>

                                    {/* Packages */}
                                    <div className="grid grid-cols-1 gap-2 pt-4">
                                        {instructor.packages.map((pkg: any) => (
                                            <div key={pkg.id} className="flex justify-between items-center bg-black/40 p-3 border border-zinc-800 hover:border-zinc-700 transition-all group/pkg">
                                                <div className="flex-1">
                                                    <div className="text-[10px] font-black text-white uppercase">{pkg.name}</div>
                                                    <div className="text-[8px] text-zinc-600 font-mono uppercase truncate max-w-[200px]">{pkg.includes}</div>
                                                </div>
                                                <button 
                                                    onClick={() => handleBooking(instructor.id, pkg.id)}
                                                    disabled={isPending}
                                                    className="px-4 py-2 bg-zinc-100 text-black font-black text-[9px] uppercase tracking-widest hover:bg-brand-cyan transition-all"
                                                >
                                                    ГО ПАТИ
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty State */}
                {!loading && instructors.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-zinc-900">
                        <FaCrosshairs className="text-4xl text-zinc-800 mx-auto mb-4" />
                        <h3 className="text-zinc-600 font-black uppercase">ПУСТО</h3>
                        <p className="text-zinc-800 text-[10px] font-mono">Пока никого.</p>
                    </div>
                )}
            </div>
        </div>
    );
}