"use client";

import { getPublicCrewInfo } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import RockstarHeroSection from '@/app/tutorials/RockstarHeroSection';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Define a comprehensive type for the crew details
type CrewDetails = {
    id: string;
    name: string;
    slug: string;
    description: string;
    logo_url: string;
    created_at: string;
    owner: { user_id: string; username: string };
    members: { user_id: string; username: string; avatar_url: string; role: string }[];
    vehicles: { id: string; make: string; model: string; image_url: string }[];
};

function CrewDetailContent({ slug }: { slug: string }) {
    const [crew, setCrew] = useState<CrewDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadCrewDetails() {
            try {
                const result = await getPublicCrewInfo(slug);
                if (result.success && result.data) {
                    setCrew(result.data);
                } else {
                    setError(result.error || "Не удалось загрузить данные экипажа.");
                }
            } catch (e: any) {
                setError(e.message || "Неизвестная ошибка на клиенте.");
            } finally {
                setLoading(false);
            }
        }
        loadCrewDetails();
    }, [slug]);

    if (loading) {
        return <Loading variant="bike" text="ЗАГРУЗКА ДАННЫХ ЭКИПАЖА..." />;
    }

    if (error || !crew) {
        return <p className="text-destructive text-center py-20">{error || "Экипаж не найден."}</p>;
    }
    
    const heroTriggerId = `crew-detail-hero-${crew.id}`;
    const hasVehicles = crew.vehicles && crew.vehicles.length > 0;
    const hasMembers = crew.members && crew.members.length > 0;

    return (
        <>
            <RockstarHeroSection
                title={crew.name}
                subtitle={crew.description || ''}
                mainBackgroundImageUrl={hasVehicles ? crew.vehicles[0].image_url : "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"}
                backgroundImageObjectUrl={crew.logo_url || undefined}
                triggerElementSelector={`#${heroTriggerId}`}
            />
            <div id={heroTriggerId} style={{ height: '50vh' }} aria-hidden="true" />

            <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="container mx-auto max-w-6xl px-4 py-12 relative z-20 bg-background grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
                {/* Left Column: Manifesto */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-dark-card/70 border border-border p-6 rounded-xl sticky top-24">
                         <h2 className="text-2xl font-orbitron text-brand-pink mb-4">Манифест</h2>
                        <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Logo`} width={96} height={96} className="rounded-full mx-auto mb-4 border-2 border-brand-pink shadow-lg shadow-brand-pink/30" />
                        <h3 className="text-3xl font-orbitron text-center text-brand-green">{crew.name}</h3>
                        <p className="text-sm text-muted-foreground font-mono mt-3 text-center">{crew.description}</p>
                         <div className="mt-4 border-t border-border/50 pt-3 text-center">
                            <p className="text-xs text-muted-foreground font-mono">Владелец:</p>
                            <p className="font-semibold text-brand-cyan">@{crew.owner.username}</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Assets */}
                <div className="lg:col-span-2">
                     <Tabs defaultValue="garage" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-dark-card/50">
                            <TabsTrigger value="garage">Гараж ({crew.vehicles?.length || 0})</TabsTrigger>
                            <TabsTrigger value="roster">Состав ({crew.members?.length || 0})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="garage" className="mt-6">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {hasVehicles ? crew.vehicles.map((vehicle) => (
                                    <Link href={`/rent/${vehicle.id}`} key={vehicle.id} className="bg-dark-card/50 p-4 rounded-lg hover:bg-dark-card transition-colors group">
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
                                    <div key={member.user_id} className="flex items-center gap-4 bg-dark-card/50 p-3 rounded-lg border border-border">
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
        </>
    );
}

export default function CrewPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
        <Suspense fallback={<Loading variant="bike" text="ЗАГРУЗКА ДАННЫХ ЭКИПАЖА..." />}>
          <CrewDetailContent slug={params.slug} />
        </Suspense>
    </div>
  );
}