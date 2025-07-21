"use client";

import { getAllPublicCrews } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { VibeMap, MapPoint } from '@/components/VibeMap';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState, useMemo } from 'react';
import RockstarHeroSection from '@/app/tutorials/RockstarHeroSection';
import { motion } from 'framer-motion';

type Crew = {
    id: string;
    name: string;
    slug: string;
    description: string;
    logo_url: string;
    owner_username: string;
    member_count: number;
    vehicle_count: number;
    hq_location?: string;
    // Augmented on client
    avg_fleet_value?: number;
    influence?: number;
    mission_success_rate?: number;
};

const MetricItem = ({ icon, value, label }: { icon: string; value: string | number; label:string; }) => (
    <div className='text-center p-2 rounded-lg bg-black/20'>
        <VibeContentRenderer content={icon} className="mb-1 mx-auto text-xl text-brand-cyan" />
        <p className="font-mono text-xs">
            <strong className={`block text-2xl font-orbitron text-foreground`}>{value}</strong>
            <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
        </p>
    </div>
);

function CrewsList() {
    const [crews, setCrews] = useState<Crew[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [highlightedCrewId, setHighlightedCrewId] = useState<string | null>(null);

    useEffect(() => {
        async function loadCrews() {
            try {
                const result = await getAllPublicCrews();
                if (result.success && result.data) {
                    const augmentedCrews = result.data.map(crew => ({
                        ...crew,
                        avg_fleet_value: crew.vehicle_count > 0 ? Math.floor(Math.random() * 45000 + 20000) : 0,
                        influence: Math.floor(Math.random() * 800 + 150),
                        mission_success_rate: Math.floor(Math.random() * 30 + 65)
                    }));
                    setCrews(augmentedCrews);
                } else {
                    setError(result.error || "Не удалось загрузить список экипажей.");
                }
            } catch (e: any) {
                setError(e.message || "Неизвестная ошибка на клиенте.");
            } finally {
                setLoading(false);
            }
        }
        loadCrews();
    }, []);
    
    const mapPoints: MapPoint[] = useMemo(() =>
        crews
            .filter(crew => crew.hq_location)
            .map(crew => {
                const [lat, lon] = crew.hq_location!.split(',').map(Number);
                return {
                    id: crew.id,
                    name: crew.name,
                    coordinates: [lat, lon],
                    icon: '::FaSkullCrossbones::',
                    color: 'bg-brand-pink'
                };
            })
    , [crews]);


    if (loading) {
        return <Loading variant="bike" text="ЗАГРУЗКА ЭКИПАЖЕЙ..." />;
    }

    if (error || crews.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-muted-foreground font-mono">
                    {error || "Пока не создано ни одного экипажа. Будь первым!"}
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="lg:h-[80vh] lg:overflow-y-auto simple-scrollbar pr-4 space-y-6">
                 {crews.map((crew, index) => (
                    <Link href={`/crews/${crew.slug}`} key={crew.id} className="block group" onMouseEnter={() => setHighlightedCrewId(crew.id)} onMouseLeave={() => setHighlightedCrewId(null)}>
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="bg-card/80 backdrop-blur-sm border border-border p-5 rounded-xl h-full flex flex-col transition-all duration-300 hover:border-brand-lime hover:shadow-2xl hover:shadow-lime-glow transform hover:-translate-y-1 relative overflow-hidden"
                        >
                            <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Background`} fill className="absolute inset-0 object-cover opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300 blur-sm scale-125" />
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex items-start gap-4 mb-4">
                                    <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Logo`} width={64} height={64} className="rounded-full bg-black/50 border-2 border-border group-hover:border-brand-lime transition-colors flex-shrink-0 shadow-lg" />
                                    <div className="flex-grow">
                                        <h2 className="text-2xl font-orbitron text-brand-lime group-hover:text-shadow-brand-lime">{crew.name}</h2>
                                        <p className="text-xs text-muted-foreground font-mono">by @{crew.owner_username}</p>
                                    </div>
                                </div>
                                <p className="text-neutral-300 dark:text-neutral-400 font-sans text-sm mt-2 flex-grow min-h-[50px]">{crew.description}</p>
                                
                                <div className="grid grid-cols-3 gap-2 mt-4 border-t border-border/50 pt-4">
                                   <MetricItem icon="::FaUsers::" value={crew.member_count} label="Участников" />
                                   <MetricItem icon="::FaWarehouse::" value={crew.vehicle_count} label="Единиц" />
                                   <MetricItem icon="::FaBullseye::" value={`${crew.mission_success_rate ?? 0}%`} label="Успех" />
                                </div>
                            </div>
                        </motion.div>
                    </Link>
                ))}
            </div>
            <div className="lg:sticky lg:top-24 h-[60vh] lg:h-auto">
                <VibeMap points={mapPoints} highlightedPointId={highlightedCrewId} />
            </div>
        </div>
    );
}

export default function CrewsPage() {
    const heroTriggerId = "crews-hero-trigger";
    return (
        <div className="relative min-h-screen bg-background">
            <RockstarHeroSection
                title="ЭКИПАЖИ"
                subtitle="Команды, которые правят улицами. Найди своих или брось им вызов."
                triggerElementSelector={`#${heroTriggerId}`}
            />
            <div id={heroTriggerId} style={{ height: '100vh' }} aria-hidden="true" />
            <div className="container mx-auto max-w-7xl px-4 py-12 relative z-20">
                 <Suspense fallback={<Loading variant="bike" text="ЗАГРУЗКА ЭКИПАЖЕЙ..." />}>
                    <CrewsList />
                </Suspense>
            </div>
            <Link href="/crews/create" className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 group">
                <motion.div 
                    className="w-16 h-16 flex items-center justify-center bg-brand-lime/80 text-background rounded-full shadow-lg shadow-brand-lime/50 cursor-pointer backdrop-blur-sm hover:bg-brand-lime transition-colors"
                    title="Создать Экипаж"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <VibeContentRenderer content="::FaCirclePlus::" className="h-8 w-8"/>
                </motion.div>
            </Link>
        </div>
    );
}