"use client";

import { getAllPublicCrews } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
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
};

function CrewsList() {
    const [crews, setCrews] = useState<Crew[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadCrews() {
            try {
                const result = await getAllPublicCrews();
                if (result.success && result.data) {
                    setCrews(result.data);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {crews.map((crew, index) => (
                <Link href={`/crews/${crew.slug}`} key={crew.id} className="block group">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-card/80 backdrop-blur-sm border border-border p-5 rounded-xl h-full flex flex-col transition-all duration-300 hover:border-brand-lime hover:shadow-2xl hover:shadow-lime-glow/20 transform hover:-translate-y-1 relative overflow-hidden"
                    >
                        <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Background`} fill className="absolute inset-0 object-cover opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300 blur-sm scale-125" />
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-4">
                                <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Logo`} width={64} height={64} className="rounded-full bg-black/50 border-2 border-border group-hover:border-brand-lime transition-colors flex-shrink-0 shadow-lg" />
                                <h2 className="text-2xl font-orbitron text-brand-lime flex-grow group-hover:text-shadow-brand-lime">{crew.name}</h2>
                            </div>
                            <p className="text-neutral-300 font-sans text-sm mt-2 flex-grow min-h-[60px]">{crew.description}</p>
                            <div className="flex gap-4 mt-4 text-sm font-mono text-center border-t border-border/50 pt-4 w-full justify-around">
                                <div className='text-center flex-1'><VibeContentRenderer content="::FaUsers::" className="text-brand-cyan mb-1 mx-auto text-lg" /><p><strong className="text-white font-orbitron">{crew.member_count}</strong> Участников</p></div>
                                <div className='text-center flex-1'><VibeContentRenderer content="::FaWarehouse::" className="text-brand-orange mb-1 mx-auto text-lg" /><p><strong className="text-white font-orbitron">{crew.vehicle_count}</strong> Единиц</p></div>
                            </div>
                        </div>
                    </motion.div>
                </Link>
            ))}
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
            <div className="container mx-auto max-w-6xl px-4 py-12 relative z-20">
                 <Suspense fallback={<Loading variant="bike" text="ЗАГРУЗКА ЭКИПАЖЕЙ..." />}>
                    <CrewsList />
                </Suspense>
            </div>
            <Link href="/crews/create" className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 group">
                <motion.div 
                    className="bg-brand-lime/80 text-background p-4 rounded-full shadow-lg shadow-brand-lime/50 cursor-pointer backdrop-blur-sm hover:bg-brand-lime transition-colors"
                    title="Создать Экипаж"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <VibeContentRenderer content="::FaPlus::" className="h-6 w-6"/>
                </motion.div>
            </Link>
        </div>
    );
}