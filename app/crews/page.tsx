import { getAllPublicCrews } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import RockstarHeroSection from '@/app/tutorials/RockstarHeroSection';

async function CrewsList() {
    const result = await getAllPublicCrews();

    if (!result.success || !result.data || result.data.length === 0) {
        return (
            <div className="text-center py-10">
                <p className="text-muted-foreground font-mono">
                    {result.error ? `Не удалось загрузить список экипажей: ${result.error}` : "Пока не создано ни одного экипажа. Будь первым!"}
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {result.data.map((crew) => {
                const memberCount = (crew.members as any)[0]?.count ?? 0;
                const vehicleCount = (crew.vehicles as any)[0]?.count ?? 0;
                return (
                    <Link href={`/crews/${crew.id}`} key={crew.id} className="block group">
                        <div className="bg-dark-card/80 border border-border p-6 rounded-xl h-full flex flex-col items-center text-center transition-all duration-300 hover:border-brand-green hover:shadow-2xl hover:shadow-brand-green/20 transform hover:-translate-y-1">
                            <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Logo`} width={80} height={80} className="rounded-full mb-4 bg-black/50 border-2 border-border group-hover:border-brand-green transition-colors" />
                            <h2 className="text-2xl font-orbitron text-brand-green">{crew.name}</h2>
                            <p className="text-muted-foreground font-mono text-sm mt-2 flex-grow min-h-[60px]">{crew.description}</p>
                            <div className="flex gap-4 mt-4 text-xs font-mono text-center border-t border-border/50 pt-3 w-full justify-center">
                                <p><strong className="text-white">{memberCount}</strong> Участников</p>
                                <p><strong className="text-white">{vehicleCount}</strong> Единиц</p>
                            </div>
                        </div>
                    </Link>
                )
            })}
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
            <div id={heroTriggerId} style={{ height: '50vh' }} aria-hidden="true" />
            <div className="container mx-auto max-w-6xl px-4 py-12 relative z-20 bg-background">
                 <Suspense fallback={<Loading text="ЗАГРУЗКА ЭКИПАЖЕЙ..." />}>
                    <CrewsList />
                </Suspense>
            </div>
        </div>
    );
}