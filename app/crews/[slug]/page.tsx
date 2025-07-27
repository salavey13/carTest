"use client";

import { getPublicCrewInfo, getMapPresets, getUserCrewCommandDeck } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import RockstarHeroSection from '@/app/tutorials/RockstarHeroSection';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { VibeMap, MapBounds } from '@/components/VibeMap';
import { Database } from '@/types/database.types';
import { useAppContext } from '@/contexts/AppContext';
import { Progress } from '@/components/ui/progress';

type CrewDetails = Database['public']['Views']['crew_details']['Row'];
type MapPreset = Database['public']['Tables']['maps']['Row'];
type CommandDeckData = Awaited<ReturnType<typeof getUserCrewCommandDeck>>['data'];

const FALLBACK_MAP: MapPreset = {
    id: 'fallback-map',
    name: 'Стандартная Карта',
    map_image_url: 'https://i.imgur.com/22n6k1V.png',
    bounds: { top: 56.38, bottom: 56.25, left: 43.85, right: 44.15 } as any,
    is_default: true,
    created_at: new Date().toISOString(),
    owner_id: null,
    points_of_interest: []
};

const CommandDeckStat = ({ value, label, icon }: { value: string | number; label: string; icon: string; }) => (
    <div className="bg-black/30 p-3 rounded-lg text-center">
        <VibeContentRenderer content={icon} className="text-3xl text-brand-cyan mx-auto mb-1" />
        <p className="text-3xl font-orbitron font-bold text-foreground">{value}</p>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
);

function CrewOwnerCommandDeck({ commandDeckData }: { commandDeckData: CommandDeckData }) {
    if (!commandDeckData) return null;
    
    const completeness = commandDeckData.photo_completeness_percentage || 0;

    return (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 bg-card/70 backdrop-blur-xl border border-brand-yellow/50 rounded-2xl shadow-lg shadow-brand-yellow/10 p-6"
        >
            <h2 className="text-2xl font-orbitron text-brand-yellow mb-4 flex items-center gap-2">
                <VibeContentRenderer content="::FaSatelliteDish::"/> Командный Мостик
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CommandDeckStat value={commandDeckData.total_vehicles || 0} label="Единиц в парке" icon="::FaWarehouse::"/>
                <CommandDeckStat value={commandDeckData.vehicles_with_primary_photo || 0} label="С главным фото" icon="::FaCamera::"/>
                <CommandDeckStat value={commandDeckData.vehicles_needing_gallery || 0} label="Нуждаются в галерее" icon="::FaImages::"/>
                <div className="bg-black/30 p-3 rounded-lg text-center col-span-2 md:col-span-1">
                    <VibeContentRenderer content="::FaTasks::" className="text-3xl text-brand-cyan mx-auto mb-1" />
                     <p className="text-3xl font-orbitron font-bold text-foreground">{completeness}%</p>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Завершено Фото</p>
                    <Progress value={Number(completeness)} className="h-2 [&>div]:bg-brand-cyan" />
                </div>
            </div>
             <div className="mt-4 flex justify-end">
                <Link href="/paddock">
                    <button className="group inline-flex items-center justify-center px-4 py-2 border border-brand-cyan bg-brand-cyan/10 text-brand-cyan rounded-lg font-orbitron text-sm tracking-wider transition-all duration-300 hover:bg-brand-cyan hover:text-black hover:shadow-cyan-glow">
                        <VibeContentRenderer content="::FaWrench::" className="mr-2 transition-transform group-hover:rotate-12"/>
                        Перейти в Паддок
                    </button>
                </Link>
            </div>
        </motion.div>
    );
}


function CrewDetailContent({ slug }: { slug: string }) {
    const { dbUser } = useAppContext();
    const [crew, setCrew] = useState<CrewDetails | null>(null);
    const [commandDeckData, setCommandDeckData] = useState<CommandDeckData | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [defaultMap, setDefaultMap] = useState<MapPreset>(FALLBACK_MAP);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const crewResult = await getPublicCrewInfo(slug);

                if (crewResult.success && crewResult.data) {
                    const crewData = crewResult.data;
                    setCrew(crewData);
                    
                    const ownerCheck = dbUser?.user_id === crewData.owner.user_id;
                    setIsOwner(ownerCheck);

                    if (ownerCheck) {
                        const deckResult = await getUserCrewCommandDeck(dbUser.user_id);
                        if (deckResult.success) {
                            setCommandDeckData(deckResult.data);
                        }
                    }

                } else {
                    setError(crewResult.error || "Не удалось загрузить данные экипажа.");
                }

                const mapsResult = await getMapPresets();
                if (mapsResult.success && mapsResult.data && mapsResult.data.length > 0) {
                    const foundDefault = mapsResult.data.find(m => m.is_default);
                    if (foundDefault) setDefaultMap(foundDefault);
                }
            } catch (e: any) {
                setError(e.message || "Неизвестная ошибка на клиенте.");
            } finally {
                setLoading(false);
            }
        }
        if (dbUser) { // Only run when dbUser is available
            loadData();
        }
    }, [slug, dbUser]);

    if (loading) return <Loading variant="bike" text="ЗАГРУЗКА ДАННЫХ ЭКИПАЖА..." />;
    if (error || !crew) return <p className="text-destructive text-center py-20">{error || "Экипаж не найден."}</p>;
    
    const heroTriggerId = `crew-detail-hero-${crew.id}`;
    const hasVehicles = crew.vehicles && crew.vehicles.length > 0;
    const hasMembers = crew.members && crew.members.length > 0;

    const hqPoint = crew.hq_location ? {
        id: crew.id,
        name: `${crew.name} HQ`,
        coordinates: (crew.hq_location as string).split(',').map(Number) as [number, number],
        icon: '::FaSkullCrossbones::',
        color: 'bg-brand-pink'
    } : null;

    return (
        <>
            <RockstarHeroSection
                title={crew.name}
                subtitle={crew.description || ''}
                mainBackgroundImageUrl={hasVehicles ? crew.vehicles[0].image_url : "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"}
                backgroundImageObjectUrl={crew.logo_url || undefined}
                triggerElementSelector={`#${heroTriggerId}`}
            />
            <div id={heroTriggerId} style={{ height: '100vh' }} aria-hidden="true" />

            <div className="container mx-auto max-w-6xl px-4 py-12 relative z-20">
                {isOwner && <CrewOwnerCommandDeck commandDeckData={commandDeckData}/>}
                
                <motion.div 
                    initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                    className="bg-background grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card/70 backdrop-blur-sm border border-border p-6 rounded-xl sticky top-24">
                            <h2 className="text-2xl font-orbitron text-brand-pink mb-4">Манифест</h2>
                            <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Logo`} width={96} height={96} className="rounded-full mx-auto mb-4 border-2 border-brand-pink shadow-lg shadow-brand-pink/30" />
                            <h3 className="text-3xl font-orbitron text-center text-brand-green">{crew.name}</h3>
                            <p className="text-sm text-muted-foreground font-mono mt-3 text-center">{crew.description}</p>
                            <div className="mt-4 border-t border-border/50 pt-3 text-center">
                                <p className="text-xs text-muted-foreground font-mono">Владелец:</p>
                                <p className="font-semibold text-brand-cyan">@{crew.owner.username}</p>
                            </div>
                            {hqPoint && (
                                <div className="mt-4 border-t border-border/50 pt-3">
                                    <h4 className="text-center font-mono text-xs text-muted-foreground mb-2">Штаб-квартира</h4>
                                    <VibeMap points={[hqPoint]} bounds={defaultMap.bounds as MapBounds} imageUrl={defaultMap.map_image_url} className="h-48"/>
                                    <p className="text-center text-xs font-mono text-muted-foreground mt-2">{crew.hq_location as string}</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                         <Tabs defaultValue="garage" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-card/50">
                                <TabsTrigger value="garage">Гараж ({crew.vehicles?.length || 0})</TabsTrigger>
                                <TabsTrigger value="roster">Состав ({crew.members?.length || 0})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="garage" className="mt-6">
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {hasVehicles ? crew.vehicles.map((vehicle) => (
                                        <Link href={`/rent/${vehicle.id}`} key={vehicle.id} className="bg-card/50 p-4 rounded-lg hover:bg-card transition-colors group">
                                            <div className="relative w-full h-40 rounded-md mb-3 overflow-hidden">
                                                <Image src={vehicle.image_url} alt={vehicle.model} fill className="object-cover group-hover:scale-105 transition-transform duration-300"/>
                                            </div>
                                            <h3 className="font-semibold">{vehicle.make} {vehicle.model}</h3>
                                        </Link>
                                    )) : <p className="text-muted-foreground font-mono col-span-full text-center py-8">Гараж этого экипажа пока пуст.</p>}
                                </div>
                            </TabsContent>
                            <TabsContent value="roster" className="mt-6">
                                <div className="space-y-3">
                                    {hasMembers ? crew.members.map((member) => (
                                        <div key={member.user_id} className="flex items-center gap-4 bg-card/50 p-3 rounded-lg border border-border">
                                            <Image src={member.avatar_url || '/placeholder.svg'} alt={member.username || member.user_id} width={48} height={48} className="rounded-full" />
                                            <div className="flex-grow">
                                                <span className="font-mono font-semibold">@{member.username}</span>
                                                <p className="text-xs text-brand-cyan uppercase font-mono">{member.role}</p>
                                            </div>
                                        </div>
                                    )) : <p className="text-muted-foreground font-mono text-center py-8">В этом экипаже пока никого нет.</p>}
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </motion.div>
            </div>
        </>
    );
}

export default function CrewPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen text-foreground">
        <Suspense fallback={<Loading variant="bike" text="ЗАГРУЗКА ДАННЫХ ЭКИПАЖА..." />}>
          <CrewDetailContent slug={params.slug} />
        </Suspense>
    </div>
  );
}