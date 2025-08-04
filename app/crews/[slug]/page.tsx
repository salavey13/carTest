"use client";

import { getCrewLiveDetails, getMapPresets, getUserCrewCommandDeck, requestToJoinCrew, confirmCrewMember } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import RockstarHeroSection from '@/app/tutorials/RockstarHeroSection';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { VibeMap, MapBounds, PointOfInterest } from '@/components/VibeMap';
import { useAppContext } from '@/contexts/AppContext';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CrewDetails, MapPreset as VibeMapPreset, CommandDeckData } from '@/lib/types';

const FALLBACK_MAP: VibeMapPreset = {
    id: 'fallback-map', name: 'Стандартная Карта', map_image_url: 'https://i.imgur.com/22n6k1V.png',
    bounds: { top: 56.38, bottom: 56.25, left: 43.85, right: 44.15 } as any, is_default: true, created_at: new Date().toISOString(), owner_id: null, points_of_interest: []
};

const CommandDeckStat = ({ value, label, icon }: { value: string | number; label: string; icon: string; }) => (
    <div className="bg-background/30 p-3 rounded-lg text-center">
        <VibeContentRenderer content={icon} className="text-3xl text-accent-text mx-auto mb-1" />
        <p className="text-3xl font-orbitron font-bold text-foreground">{value}</p>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
);

function CrewOwnerCommandDeck({ commandDeckData }: { commandDeckData: CommandDeckData | null }) {
    if (!commandDeckData) return null;
    const completeness = commandDeckData.photo_completeness_percentage || 0;
    return (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 bg-card/70 backdrop-blur-xl border border-accent/50 rounded-2xl shadow-lg shadow-accent/10 p-6">
            <h2 className="text-2xl font-orbitron text-accent mb-4 flex items-center gap-2"><VibeContentRenderer content="::FaSatelliteDish::"/> Командный Мостик</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <CommandDeckStat value={commandDeckData.total_vehicles || 0} label="Единиц в парке" icon="::FaWarehouse::"/>
                <CommandDeckStat value={commandDeckData.vehicles_with_primary_photo || 0} label="С главным фото" icon="::FaCamera::"/>
                <CommandDeckStat value={commandDeckData.vehicles_needing_gallery || 0} label="Нуждаются в галерее" icon="::FaImages::"/>
                <div className="bg-background/30 p-3 rounded-lg text-center col-span-2 md:col-span-1">
                    <VibeContentRenderer content="::FaTasks::" className="text-3xl text-accent-text mx-auto mb-1" />
                    <p className="text-3xl font-orbitron font-bold text-foreground">{completeness}%</p>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Завершено Фото</p>
                    <Progress value={Number(completeness)} className="h-2 [&>div]:bg-accent" />
                </div>
            </div>
            <div className="mt-4 flex justify-end">
                <Link href="/paddock"><Button variant="outline" className="border-accent text-accent hover:bg-accent/10 group"><VibeContentRenderer content="::FaWrench::" className="mr-2 transition-transform group-hover:rotate-12"/>Перейти в Паддок</Button></Link>
            </div>
        </motion.div>
    );
}

const MemberStatusIndicator = ({ status }: { status: string }) => {
    const config = {
        offline: { icon: "::FaMoon::", label: "Не в сети", color: "text-muted-foreground" },
        online: { icon: "::FaSun::", label: "Онлайн", color: "text-brand-green" },
        riding: { icon: "::FaMotorcycle::", label: "На байке", color: "text-brand-yellow animate-pulse" }
    }[status] || { icon: "::FaCircleQuestion::", label: "Неизвестно", color: "text-muted-foreground" };

    return <div className={cn("flex items-center gap-1.5 text-xs font-mono", config.color)}><VibeContentRenderer content={config.icon}/> {config.label}</div>
};

function CrewDetailContent({ slug }: { slug: string }) {
    const { dbUser, isAuthenticating } = useAppContext();
    const searchParams = useSearchParams();
    const router = useRouter();
    const [crew, setCrew] = useState<CrewDetails | null>(null);
    const [commandDeckData, setCommandDeckData] = useState<CommandDeckData | null>(null);
    const [isOwner, setIsOwner] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [defaultMap, setDefaultMap] = useState<VibeMapPreset>(FALLBACK_MAP);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const targetMemberIdFromUrl = searchParams.get('confirm_member');
    const action = searchParams.get('join_crew') ? 'join' : targetMemberIdFromUrl ? 'confirm' : null;
    const [activeTab, setActiveTab] = useState(action === 'confirm' ? "roster" : "garage");

    const loadData = useCallback(async () => {
        if (isAuthenticating) return;
        setLoading(true);
        setError(null);
        try {
            const crewResult = await getCrewLiveDetails(slug);
            if (!crewResult.success || !crewResult.data) { throw new Error(crewResult.error || "Экипаж не найден."); }
            const crewData = crewResult.data;
            setCrew(crewData);
            
            if (dbUser) {
                const ownerCheck = dbUser.user_id === crewData.owner.user_id;
                setIsOwner(ownerCheck);
                const membersArray = Array.isArray(crewData.members) ? crewData.members : [];
                setIsPending(!!membersArray.some(m => m.user_id === dbUser.user_id && m.join_status === 'pending'));
                if (ownerCheck) {
                    const deckResult = await getUserCrewCommandDeck(dbUser.user_id);
                    if (deckResult.success) setCommandDeckData(deckResult.data);
                }
            } else {
                setIsOwner(false);
                setIsPending(false);
            }
            
            const mapsResult = await getMapPresets();
            if (mapsResult.success && mapsResult.data?.length) {
                setDefaultMap(mapsResult.data.find(m => m.is_default) || mapsResult.data[0] || FALLBACK_MAP);
            }
        } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    }, [slug, dbUser, isAuthenticating]);

    useEffect(() => { if (!isAuthenticating) { loadData(); } }, [isAuthenticating, loadData]);

    const handleJoinRequest = async () => {
        if (!dbUser || !crew) return;
        toast.promise(requestToJoinCrew(dbUser.user_id, dbUser.username || 'unknown', crew.id), {
            loading: 'Отправка заявки...',
            success: (res) => { if (res.success) { setIsPending(true); loadData(); return "Заявка отправлена!"; } throw new Error(res.error); }, error: (err) => err.message,
        });
    };

    const handleConfirmation = async (accept: boolean, memberIdToConfirm: string) => {
        if (!dbUser || !crew) return;
        toast.promise(confirmCrewMember(dbUser.user_id, memberIdToConfirm, crew.id, accept), {
            loading: 'Обработка заявки...',
            success: (res) => {
                if (res.success) {
                    if (memberIdToConfirm === targetMemberIdFromUrl) {
                        router.replace(`/crews/${slug}`, { scroll: false });
                    }
                    loadData();
                    return `Заявка ${accept ? 'принята' : 'отклонена'}.`;
                }
                throw new Error(res.error);
            }, error: (err) => err.message,
        });
    };
    
    const members = Array.isArray(crew?.members) ? crew.members : [];
    const vehicles = Array.isArray(crew?.vehicles) ? crew.vehicles : [];

    const mapPoints = useMemo((): PointOfInterest[] => {
        if (!crew) return [];
        const points: PointOfInterest[] = [];
        if (crew.hq_location && typeof crew.hq_location === 'string' && crew.hq_location.includes(',')) {
            points.push({ id: crew.id, name: `${crew.name} HQ`, type: 'point', coords: [(crew.hq_location as string).split(',').map(Number) as [number, number]], icon: '::FaSkullCrossbones::', color: 'bg-primary' });
        }
        members.forEach(member => {
            if (member.live_status === 'riding' && member.last_location) {
                try {
                    const parsedLocation = JSON.parse(member.last_location);
                    if (parsedLocation && parsedLocation.type === 'Point' && Array.isArray(parsedLocation.coordinates)) {
                         points.push({
                            id: member.user_id, name: `@${member.username}`, type: 'point',
                            coords: [[parsedLocation.coordinates[1], parsedLocation.coordinates[0]]], // GeoJSON is [lon, lat], we need [lat, lon]
                            icon: `image:${member.avatar_url || '/placeholder.svg'}`,
                            color: '' // Color is not used for image icons
                        });
                    }
                } catch (e) { console.error(`Failed to parse location for member ${member.username}:`, e); }
            }
        });
        return points;
    }, [crew, members]);


    if (loading || isAuthenticating) return <Loading variant="bike" text="СИНХРОНИЗАЦИЯ С КОМАНДНЫМ ЦЕНТРОМ..." />;
    if (error) return <p className="text-destructive text-center py-20 font-mono text-lg">{error}</p>;
    if (!crew || !crew.owner) return <p className="text-destructive text-center py-20 font-mono text-lg">НЕ УДАЛОСЬ ЗАГРУЗИТЬ ДАННЫЕ ЭКИПАЖА</p>;
    
    const heroTriggerId = `crew-detail-hero-${crew.id}`;
    const pendingMemberFromUrl = action === 'confirm' ? members.find(m => m.user_id === targetMemberIdFromUrl) : null;
    const isCurrentUserMember = members.some(m => m.user_id === dbUser?.user_id && m.join_status === 'active');
    
    let heroTitle = crew.name;
    let heroSubtitle = crew.description || `Под предводительством @${crew.owner.username}`;
    let heroMainBg = vehicles.length > 0 && vehicles[0].image_url ? vehicles[0].image_url : "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg";
    let heroObjectBg = crew.logo_url || undefined;
    
    if (action === 'join') { heroTitle = "Приглашение в Экипаж"; heroSubtitle = `Вы были приглашены присоединиться к '${crew.name}'.`; } 
    else if (action === 'confirm' && pendingMemberFromUrl) { heroTitle = "Заявка на Вступление"; heroSubtitle = `@${pendingMemberFromUrl.username} хочет присоединиться.`; heroObjectBg = pendingMemberFromUrl.avatar_url || undefined; }

    return (
        <>
            <RockstarHeroSection title={heroTitle} subtitle={heroSubtitle} mainBackgroundImageUrl={heroMainBg} backgroundImageObjectUrl={heroObjectBg} triggerElementSelector={`#${heroTriggerId}`} />
            <div id={heroTriggerId} style={{ height: '100vh' }} aria-hidden="true" />
            <div className="container mx-auto max-w-6xl px-4 py-12 relative z-20">
                {isOwner && <CrewOwnerCommandDeck commandDeckData={commandDeckData}/>}
                
                {action === 'join' && dbUser && !isCurrentUserMember && !isOwner && (
                    <motion.div initial={{opacity:0, y:-20}} animate={{opacity:1, y:0}} className="mb-6 bg-secondary/20 border border-secondary text-center p-4 rounded-lg">
                        <h3 className="font-bold text-lg">Присоединиться к '{crew.name}'?</h3>
                        {isPending ? <p className="text-sm text-accent mt-2">Ваша заявка уже на рассмотрении.</p> : <Button onClick={handleJoinRequest} className="mt-2">Подать заявку</Button>}
                    </motion.div>
                )}
                {action === 'confirm' && isOwner && pendingMemberFromUrl && (
                     <motion.div initial={{opacity:0, y:-20}} animate={{opacity:1, y:0}} className="mb-6 bg-green-500/20 border border-green-500 text-center p-4 rounded-lg">
                        <h3 className="font-bold text-lg">Подтвердить нового участника?</h3>
                        <p className="text-sm mb-4">Пользователь <span className="font-mono bg-background/50 p-1 rounded">@{pendingMemberFromUrl.username}</span> хочет присоединиться.</p>
                        <div className="flex justify-center gap-4">
                            <Button onClick={() => handleConfirmation(true, pendingMemberFromUrl.user_id)} className="bg-green-600 hover:bg-green-500">Принять</Button>
                            <Button onClick={() => handleConfirmation(false, pendingMemberFromUrl.user_id)} variant="destructive">Отклонить</Button>
                        </div>
                    </motion.div>
                )}
                
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-card/70 backdrop-blur-sm border border-border p-4 rounded-xl sticky top-24">
                            <h2 className="text-2xl font-orbitron text-secondary mb-4 flex items-center gap-2"><VibeContentRenderer content="::FaMapMarkedAlt::"/> Карта Экипажа</h2>
                            <VibeMap points={mapPoints} bounds={defaultMap.bounds as MapBounds} imageUrl={defaultMap.map_image_url} className="h-96"/>
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 bg-card/50">
                                <TabsTrigger value="roster">Состав ({members.length})</TabsTrigger>
                                <TabsTrigger value="garage">Гараж ({vehicles.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="roster" className="mt-6">
                                <div className="space-y-3">
                                    {members.length > 0 ? members.map((member) => (
                                        <div key={member.user_id} className="flex items-center gap-4 bg-card/50 p-3 rounded-lg border border-border/80">
                                            <Image src={member.avatar_url || '/placeholder.svg'} alt={member.username || 'member'} width={48} height={48} className="rounded-full" />
                                            <div className="flex-grow">
                                                <span className="font-mono font-semibold">@{member.username}</span>
                                                <p className="text-xs text-accent-text uppercase font-mono">{member.role}</p>
                                            </div>
                                            {member.join_status === 'pending' && isOwner ? (
                                                <div className="flex gap-2 shrink-0">
                                                    <Button onClick={() => handleConfirmation(true, member.user_id)} size="sm" className="bg-green-600 hover:bg-green-500 h-8 px-3">Принять</Button>
                                                    <Button onClick={() => handleConfirmation(false, member.user_id)} size="sm" variant="destructive" className="h-8 px-2">Откл.</Button>
                                                </div>
                                            ) : member.join_status === 'pending' ? (
                                                <span className="text-xs font-mono bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full shrink-0">Ожидает</span>
                                            ) : (
                                                <div className="shrink-0">
                                                    <MemberStatusIndicator status={member.live_status} />
                                                </div>
                                            )}
                                        </div>
                                    )) : <p className="text-muted-foreground font-mono text-center py-8">В этом экипаже пока никого нет.</p>}
                                </div>
                            </TabsContent>
                            <TabsContent value="garage" className="mt-6">
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {vehicles.length > 0 ? vehicles.map((vehicle) => ( <Link href={`/rent/${vehicle.id}`} key={vehicle.id} className="bg-card/50 p-4 rounded-lg hover:bg-card transition-colors group"> <div className="relative w-full h-40 rounded-md mb-3 overflow-hidden"> <Image src={vehicle.image_url!} alt={vehicle.model!} fill className="object-cover group-hover:scale-105 transition-transform duration-300"/> </div> <h3 className="font-semibold">{vehicle.make} {vehicle.model}</h3> </Link> )) : <p className="text-muted-foreground font-mono col-span-full text-center py-8">Гараж этого экипажа пока пуст.</p>}
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
    <div className="min-h-screen text-foreground dark">
        <Suspense fallback={<Loading variant="bike" text="ЗАГРУЗКА ДАННЫХ ЭКИПАЖА..." />}>
          <CrewDetailContent slug={params.slug} />
        </Suspense>
    </div>
  );
}