"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation"; // Import useRouter for navigation
import { createSnowboardLobby } from "../actions"; // Import the new 1-click creation action
import { useAppContext } from "@/contexts/AppContext";
import { 
    FaPersonSkiing, FaMapLocationDot, FaClock, FaStar, 
    FaArrowRight, FaCircleCheck, FaHourglassHalf, FaSnowflake, 
    FaPaperPlane, FaSpinner 
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function SnowboardInstructorsPage() {
    const { dbUser } = useAppContext();
    const router = useRouter();
    const [instructors, setInstructors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        getSnowboardInstructors().then(res => {
            if (res.success) setInstructors(res.data);
            setLoading(false);
        });
    }, []);

    const handleBooking = (providerId: string, packageId: string, packageName: string) => {
        if (!dbUser?.user_id) {
            return toast.error("ТРЕБУЕТСЯ АВТОРИЗАЦИЯ", { description: "Пожалуйста войдите для создания лобби." });
        }

        startTransition(async () => {
            // Call the new createSnowboardLobby action
            // It expects: clientUserId, providerId, packageId
            const res = await createSnowboardLobby(providerId, packageId, dbUser.user_id);
            
            if (res.success) {
                toast.success("ЛОББИ СОЗДАНО!", {
                    description: "Вы были перемещены в лобби урока. Пожалуйста, проверьте детали во вкладке планирования.",
                    icon: <FaCircleCheck className="text-brand-gold" />,
                    duration: 3000
                });
                
                // Redirect to the newly created lobby immediately
                if (res.lobbyId) {
                    router.push(`/strikeball/lobbies/${res.lobbyId}`);
                }
            } else {
                toast.error("Ошибка создания лобби", { description: res.error });
            }
        });
    };

    if (loading) return (
        <div className="pt-28 pb-32 px-4 min-h-screen text-white font-orbitron bg-background">
            <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-gold"></div>
                <p className="mt-4 text-brand-gold text-sm tracking-widest animate-pulse">SCANNING SLOPES...</p>
            </div>
        </div>
    );

    return (
        <div className="pt-28 pb-32 px-4 min-h-screen text-foreground bg-background">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center border-b border-border pb-6">
                    <h1 className="text-4xl md:text-5xl font-black font-orbitron tracking-tighter uppercase mb-2">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-brand-gold text-shadow-cyber">
                            Snowboard Ops
                        </span>
                    </h1>
                    <p className="text-muted-foreground font-mono text-sm max-w-lg mx-auto">
                        Выберите инструктора и пакет для автоматического создания лобби и подключения.
                    </p>
                </div>

                {/* Instructors List */}
                <div className="space-y-8">
                    {instructors.map((instructor) => (
                        <div key={instructor.id} className="relative group">
                            {/* Decorative glow */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-cyan to-brand-red-orange rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur-sm"></div>
                            
                            {/* Card Main */}
                            <div className="relative bg-card border border-border rounded-xl overflow-hidden">
                                {/* Instructor Header */}
                                <div className="p-6 flex flex-col md:flex-row gap-6 border-b border-border bg-zinc-900/30">
                                    <div className="relative w-24 h-24 md:w-32 md:h-32 shrink-0">
                                        <div className="absolute inset-0 bg-brand-cyan/20 blur-md rounded-full"></div>
                                        <div className="relative w-full h-full bg-zinc-950 border-2 border-brand-cyan/50 rounded-lg overflow-hidden">
                                            {instructor.logo_url ? (
                                                <img src={instructor.logo_url} alt={instructor.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-zinc-600">
                                                    <FaPersonSkiing className="text-3xl" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h2 className="text-2xl font-bold font-orbitron text-white flex items-center gap-2">
                                                    {instructor.name}
                                                    <span className="text-[10px] border border-brand-gold text-brand-gold px-1.5 py-0.5 rounded uppercase tracking-wider">Pro</span>
                                                </h2>
                                                <div className="flex items-center gap-1 mt-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <FaStar key={i} className={cn(i < instructor.rating ? "text-brand-gold fill-brand-gold" : "text-zinc-700")} />
                                                    ))}
                                                    <span className="text-xs text-muted-foreground ml-2">({instructor.reviews})</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <p className="text-sm text-muted-foreground leading-relaxed border-l-2 border-brand-red-orange pl-3">
                                            {instructor.description}
                                        </p>

                                        <div className="flex flex-wrap gap-4 text-xs font-mono text-zinc-400 mt-3">
                                            <span className="flex items-center gap-1.5"><FaMapLocationDot /> {instructor.location}</span>
                                            <span className="flex items-center gap-1.5"><FaClock /> {instructor.working_hours}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Service Selection Grid */}
                                <div className="p-4 bg-black/20">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-cyan mb-3 font-orbitron">
                                        Available Protocols
                                    </h3>
                                    <div className="grid grid-cols-1 gap-3">
                                        {instructor.packages.map((pkg: any) => (
                                            <div 
                                                key={pkg.id}
                                                className="group/pkg relative bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg hover:border-brand-gold/50 transition-all"
                                            >
                                                <div className="flex flex-col md:flex-row justify-between gap-4">
                                                    {/* Package Info */}
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="font-bold text-white uppercase">{pkg.name}</h4>
                                                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded flex items-center gap-1">
                                                                <FaHourglassHalf /> {pkg.duration} мин
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-zinc-500 line-clamp-2">{pkg.includes}</p>
                                                    </div>

                                                    {/* Price & Action */}
                                                    <div className="flex items-center justify-between md:justify-end gap-4">
                                                        <div className="text-right">
                                                            <div className="text-xl font-black font-orbitron text-brand-gold">
                                                                {pkg.price} ₽
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleBooking(instructor.id, pkg.id, pkg.name)}
                                                            disabled={isPending}
                                                            className="shrink-0 px-4 py-2 bg-brand-deep-indigo hover:bg-brand-cyan hover:text-black border border-brand-cyan text-brand-cyan text-xs font-black uppercase tracking-widest transition-all rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group-hover/pkg:shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                                                        >
                                                            {isPending ? (
                                                                <>
                                                                    CREATING... <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full" />
                                                                </>
                                                            ) : (
                                                                <>
                                                                    BOOK <FaPaperPlane className="text-[10px]" />
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {instructors.length === 0 && (
                    <div className="text-center py-20 border border-dashed border-zinc-800 rounded-xl">
                        <FaSnowflake className="text-6xl text-zinc-800 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-zinc-500">NO ACTIVE OPERATORS</h3>
                        <p className="text-zinc-600 mt-2">No instructors found on this frequency.</p>
                    </div>
                )}
            </div>
        </div>
    );
}