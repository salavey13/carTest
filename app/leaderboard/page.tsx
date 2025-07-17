"use client";
import { useEffect, useState } from "react";
import { getTopFleets, getTopCrews } from "@/app/actions";
import { Loading } from "@/components/Loading";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

type Fleet = {
    owner_id: string;
    username: string;
    avatar_url: string;
    total_vehicles: number;
    total_revenue: number;
};

type Crew = {
    crew_id: string;
    name: string;
    logo_url: string;
    total_members: number;
    total_fleet_value: number;
    slug: string;
};


const trophyColors = ["text-yellow-400", "text-gray-400", "text-yellow-600"];

export default function LeaderboardPage() {
    const [topFleets, setTopFleets] = useState<Fleet[]>([]);
    const [topCrews, setTopCrews] = useState<Crew[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadLeaderboards() {
            setLoading(true);
            const [fleetsResult, crewsResult] = await Promise.all([
                getTopFleets(),
                getTopCrews()
            ]);
            if (fleetsResult.success) setTopFleets(fleetsResult.data || []);
            if (crewsResult.success) setTopCrews(crewsResult.data || []);
            setLoading(false);
        }
        loadLeaderboards();
    }, []);

    if (loading) {
        return <Loading variant="bike" text="ЗАГРУЗКА РЕЙТИНГОВ..." />;
    }

    return (
        <div className="min-h-screen text-foreground p-4 pt-24 relative overflow-hidden">
             <div className="fixed inset-0 z-[-1] opacity-20">
                <Image
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
                alt="Leaderboard Background"
                fill
                className="object-cover animate-pan-zoom"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent"></div>
            </div>

            <div className="container mx-auto max-w-5xl">
                <motion.h1 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-5xl font-orbitron text-center mb-12 gta-vibe-text-effect"
                >
                    ЗАЛ СЛАВЫ
                </motion.h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <LeaderboardSection title="Топ Экипажи" icon="::FaUsers::" actionLink="/crews" actionText="Все экипажи">
                        {topCrews.length > 0 ? topCrews.map((crew, index) => (
                           <Link href={`/crews/${crew.slug}`} key={crew.crew_id} className="block w-full">
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="flex items-center gap-4 p-3 bg-card/70 border border-border rounded-lg hover:bg-card hover:border-brand-lime transition-all duration-300"
                                >
                                    <span className={`text-2xl font-bold w-8 text-center ${trophyColors[index] || "text-muted-foreground"}`}>{index + 1}</span>
                                    <Image src={crew.logo_url || '/placeholder.svg'} alt={crew.name} width={48} height={48} className="rounded-full flex-shrink-0 bg-muted" />
                                    <div className="flex-grow">
                                        <p className="font-semibold text-brand-lime">{crew.name ?? 'N/A'}</p>
                                        <p className="text-xs text-muted-foreground">{(crew.total_members ?? 0)} участников</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-mono font-bold text-brand-yellow">{(crew.total_fleet_value ?? 0).toLocaleString()} XTR</p>
                                        <p className="text-xs text-muted-foreground">Стоимость</p>
                                    </div>
                                </motion.div>
                            </Link>
                        )) : <p className="text-muted-foreground text-center col-span-full">Нет данных</p>}
                        <Link href="/crews/create" className="block text-center text-sm text-brand-cyan hover:underline mt-4">Создать свой экипаж</Link>
                    </LeaderboardSection>

                    <LeaderboardSection title="Топ Владельцы" icon="::FaUserSecret::">
                        {topFleets.length > 0 ? topFleets.map((fleet, index) => (
                             <motion.div
                                key={fleet.owner_id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex items-center gap-4 p-3 bg-card/70 border border-border rounded-lg"
                            >
                                <span className={`text-2xl font-bold w-8 text-center ${trophyColors[index] || "text-muted-foreground"}`}>{index + 1}</span>
                                <Image src={fleet.avatar_url || '/placeholder.svg'} alt={fleet.username || 'avatar'} width={48} height={48} className="rounded-full flex-shrink-0 bg-muted" />
                                <div className="flex-grow">
                                    <p className="font-semibold text-brand-lime">@{fleet.username ?? 'N/A'}</p>
                                    <p className="text-xs text-muted-foreground">{(fleet.total_vehicles ?? 0)} ед. транспорта</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="font-mono font-bold text-brand-yellow">{(fleet.total_revenue ?? 0).toLocaleString()} XTR</p>
                                    <p className="text-xs text-muted-foreground">Доход</p>
                                </div>
                            </motion.div>
                        )) : <p className="text-muted-foreground text-center col-span-full">Нет данных</p>}
                    </LeaderboardSection>
                </div>
            </div>
        </div>
    );
}

const LeaderboardSection = ({ title, icon, children, actionLink, actionText }: { title: string, icon: string, children: React.ReactNode, actionLink?: string, actionText?: string }) => (
    <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-card/50 backdrop-blur-sm border border-brand-purple/50 p-6 rounded-2xl shadow-lg shadow-brand-purple/10"
    >
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-orbitron text-brand-purple flex items-center gap-3">
                <VibeContentRenderer content={icon} /> {title}
            </h2>
            {actionLink && actionText && (
                <Link href={actionLink} className="text-xs font-mono text-brand-cyan hover:underline">
                    {actionText} →
                </Link>
            )}
        </div>
        <div className="space-y-3">
            {children}
        </div>
    </motion.div>
);