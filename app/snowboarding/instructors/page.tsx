"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getInstructorsByService, createInstructorLobby } from "../actions";
import { useAppContext } from "@/contexts/AppContext";
import { 
    FaPersonSkiing, FaGamepad, FaGun, FaPaintRoller, 
    FaMapLocationDot, FaStar, FaBolt, FaCircleCheck, 
    FaSnowflake, FaCrosshairs, FaFire, FaChevronLeft,
    FaShieldVirus, FaRobot
} from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";

// --- ACTIVITY CONFIGURATION ---
// Extended list with theme-specific colors and icons
const SERVICE_TYPES = [
    { 
        id: 'snowboard_instructor', label: 'Сноуборд', icon: <FaSnowflake />, 
        theme: {
            primary: 'text-sky-500',
            gradient: 'from-sky-400 to-cyan-300',
            bgGlow: 'shadow-[0_0_50px_-10px_rgba(14,165,233,0.3)]',
            iconBg: 'bg-sky-500/10'
        }
    },
    { 
        id: 'strikeball', label: 'Страйкбол', icon: <FaGun />, 
        theme: {
            primary: 'text-brand-cyan',
            gradient: 'from-brand-cyan to-brand-green',
            bgGlow: 'shadow-[0_0_50px_-10px_rgba(6,182,212,0.2)]',
            iconBg: 'bg-brand-cyan/10'
        }
    },
    { 
        id: 'paintball', label: 'Пейнтбол', icon: <FaPaintRoller />, 
        theme: {
            primary: 'text-brand-red-orange',
            gradient: 'from-brand-red-orange to-pink-500',
            bgGlow: 'shadow-[0_0_50px_-10px_rgba(249,115,22,0.3)]',
            iconBg: 'bg-brand-red-orange/10'
        }
    },
    { 
        id: 'dota2_coach', label: 'Dota 2', icon: <FaGamepad />, 
        theme: {
            primary: 'text-brand-purple',
            gradient: 'from-brand-purple to-pink-600',
            bgGlow: 'shadow-[0_0_50px_-10px_rgba(168,85,247,0.3)]',
            iconBg: 'bg-brand-purple/10'
        }
    },
    { 
        id: 'lazertag', label: 'Лазертаг', icon: <FaBolt />, 
        theme: {
            primary: 'text-yellow-400',
            gradient: 'from-yellow-400 to-orange-500',
            bgGlow: 'shadow-[0_0_50px_-10px_rgba(250,204,21,0.3)]',
            iconBg: 'bg-yellow-400/10'
        }
    }
];

export default function UniversalInstructorsPage() {
    const { dbUser } = useAppContext();
    const router = useRouter();
    const [instructors, setInstructors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeService, setActiveService] = useState(SERVICE_TYPES[0]);
    const [isPending, startTransition] = useTransition();
    const [isLoaded, setIsLoaded] = useState(false);

    // Animation trigger for initial load
    useEffect(() => setIsLoaded(true), []);

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

    const currentTheme = activeService.theme;

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300 selection:bg-primary selection:text-primary-foreground relative">
            
            {/* BACKGROUND AMBIENCE */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                 <motion.div 
                    className={cn("absolute -top-[20%] -right-[10%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 dark:opacity-10", currentTheme.bgGlow)}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                 />
            </div>

            {/* 1. STICKY NAVIGATION HEADER */}
            <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link 
                        href="/strikeball" 
                        className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-muted transition-colors group"
                    >
                        <FaChevronLeft className="text-muted-foreground group-hover:text-foreground transition-colors" size={14} />
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors hidden sm:block">Тактический Центр</span>
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors sm:hidden">Назад</span>
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground hidden md:block">
                        VIBE.OS v2.4
                    </span>
                    <ThemeToggleButton size="sm" />
                </div>
            </nav>

            <div className="max-w-5xl mx-auto pt-8 pb-32 px-4 relative z-10 space-y-12">
                
                {/* 2. DYNAMIC HERO SECTION */}
                <AnimatePresence mode="wait">
                    <motion.div 
                        key={activeService.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.3 }}
                        className="text-center space-y-4"
                    >
                        <motion.div 
                            className="inline-flex items-center justify-center p-4 rounded-2xl mb-4"
                            style={{ boxShadow: `0 0 40px -10px hsla(var(--primary), 0.3)` }}
                        >
                            <span className={cn("text-5xl md:text-6xl", currentTheme.primary)}>
                                {activeService.icon}
                            </span>
                        </motion.div>
                        
                        <h1 className="text-5xl md:text-7xl font-black font-orbitron tracking-tighter uppercase italic">
                            <span className={cn("text-transparent bg-clip-text bg-gradient-to-r", currentTheme.gradient)}>
                                {activeService.label}
                            </span>
                            <span className="text-foreground dark:text-white"> Ops</span>
                        </h1>
                        
                        <p className="text-muted-foreground font-mono text-xs md:text-sm uppercase tracking-[0.3em] max-w-lg mx-auto">
                            Выберите элитного оператора для вашей миссии
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* 3. ACTIVITY SWITCHER (Segmented Control) */}
                <div className="flex justify-center">
                    <div className="inline-flex bg-muted/50 border border-border p-1 rounded-full backdrop-blur-sm">
                        {SERVICE_TYPES.map((type) => (
                            <button
                                key={type.id}
                                onClick={() => setActiveService(type)}
                                className={cn(
                                    "relative px-4 py-2 rounded-full text-xs md:text-sm font-black font-orbitron uppercase tracking-wider transition-all duration-200 flex items-center gap-2",
                                    activeService.id === type.id 
                                        ? "bg-foreground text-background shadow-lg" 
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                                )}
                            >
                                <span className={activeService.id === type.id ? type.theme.primary : ""}>
                                    {type.icon}
                                </span>
                                <span>{type.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 4. INSTRUCTORS LIST */}
                <div className="grid grid-cols-1 gap-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="font-mono text-muted-foreground text-sm animate-pulse">SCANNING DATABASE...</p>
                        </div>
                    ) : instructors.length > 0 ? (
                        instructors.map((instructor, index) => (
                            <motion.div
                                key={instructor.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className={cn(
                                    "group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-2xl bg-card",
                                    "hover:border-primary/50"
                                )}
                            >
                                {/* Hover Glow Effect */}
                                <div className={cn(
                                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                                    "bg-gradient-to-r from-transparent via-primary/5 to-transparent"
                                )} />

                                <div className="relative p-6 md:p-8 flex flex-col md:flex-row gap-8">
                                    {/* Avatar */}
                                    <div className={cn(
                                        "w-full md:w-48 h-48 shrink-0 rounded-xl overflow-hidden relative border",
                                        "border-border group-hover:border-primary transition-colors"
                                    )}>
                                        <img 
                                            src={instructor.logo_url} 
                                            alt={instructor.name}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                                        <div className="absolute bottom-4 left-4">
                                            <span className={cn("text-xs font-bold px-2 py-1 rounded bg-background/90 backdrop-blur border border-border", currentTheme.primary)}>
                                                TOP RATED
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col justify-between space-y-6">
                                        {/* Header Info */}
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h2 className="text-2xl md:text-3xl font-black font-orbitron uppercase text-foreground tracking-tight">
                                                        {instructor.name}
                                                    </h2>
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <div className="flex items-center gap-1 text-brand-gold">
                                                            <FaStar size={12} className="fill-current" /> 
                                                            <span className="text-sm font-bold">{instructor.rating}</span>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground font-mono uppercase border-l border-border pl-3">
                                                            [{instructor.reviews} REVIEWS]
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Starting at</div>
                                                    <div className={cn("text-2xl font-black font-orbitron", currentTheme.primary)}>
                                                        {instructor.min_price} ₽
                                                    </div>
                                                </div>
                                            </div>

                                            <p className="text-sm md:text-base text-foreground/70 leading-relaxed mt-4 font-light">
                                                {instructor.description}
                                            </p>
                                        </div>

                                        {/* Packages */}
                                        <div className="space-y-3">
                                            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                                Available Protocols
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {instructor.packages.map((pkg: any) => (
                                                    <div 
                                                        key={pkg.id} 
                                                        className="flex flex-col gap-2 p-4 rounded-xl bg-muted/30 border border-border hover:border-primary/30 transition-all hover:bg-muted/50 group/pkg cursor-pointer"
                                                        onClick={() => !isPending && handleBooking(instructor.id, pkg.id)}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <h3 className="font-bold text-xs md:text-sm uppercase tracking-wide text-foreground">
                                                                {pkg.name}
                                                            </h3>
                                                            <span className="text-xs font-mono text-muted-foreground">
                                                                {pkg.duration}m
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground line-clamp-2">
                                                            {pkg.includes}
                                                        </p>
                                                        <button 
                                                            disabled={isPending}
                                                            className={cn(
                                                                "mt-2 w-full py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                                                "bg-foreground text-background hover:opacity-90 active:scale-95",
                                                                isPending && "opacity-50 cursor-not-allowed"
                                                            )}
                                                        >
                                                            {isPending ? 'PROCESSING...' : 'INITIATE CONTRACT'}
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    ) : (
                        /* Empty State */
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="py-20 border border-dashed border-border rounded-3xl text-center space-y-4 bg-muted/10"
                        >
                            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto">
                                <FaCrosshairs className="text-muted-foreground text-2xl" />
                            </div>
                            <h3 className="text-foreground font-black uppercase tracking-widest">NO OPERATORS FOUND</h3>
                            <p className="text-muted-foreground text-sm font-mono">Please check back later or select another sector.</p>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}