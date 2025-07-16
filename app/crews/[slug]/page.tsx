import { getPublicCrewInfo } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import RockstarHeroSection from '@/app/tutorials/RockstarHeroSection';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';

async function CrewDetailContent({ slug }: { slug: string }) {
    const result = await getPublicCrewInfo(slug);

    if (!result.success || !result.data) {
        return <p className="text-destructive text-center">{result.error || "Экипаж не найден."}</p>;
    }
    
    const { data: crew } = result;
    const heroTriggerId = `crew-detail-hero-${crew.id}`;

    return (
        <>
            <RockstarHeroSection
                title={crew.name}
                subtitle={crew.description || ''}
                mainBackgroundImageUrl={(crew.vehicles as any[])?.[0]?.image_url || "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"}
                backgroundImageObjectUrl={crew.logo_url || undefined}
                triggerElementSelector={`#${heroTriggerId}`}
            />
            <div id={heroTriggerId} style={{ height: '50vh' }} aria-hidden="true" />

            <div className="container mx-auto max-w-5xl px-4 py-12 relative z-20 bg-background space-y-12">
                 <div>
                    <h2 className="text-3xl font-orbitron text-brand-cyan mb-4 flex items-center gap-3"><VibeContentRenderer content="::FaMotorcycle::" />Гараж Экипажа</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(crew.vehicles as any[])?.map(vehicle => (
                            <Link href={`/rent/${vehicle.id}`} key={vehicle.id} className="bg-dark-card/50 p-4 rounded-lg hover:bg-dark-card transition-colors group">
                                <div className="relative w-full h-40 rounded-md mb-3 overflow-hidden">
                                    <Image src={vehicle.image_url} alt={vehicle.model} fill className="object-cover group-hover:scale-105 transition-transform duration-300"/>
                                </div>
                                <h3 className="font-semibold">{vehicle.make} {vehicle.model}</h3>
                            </Link>
                        ))}
                        {(crew.vehicles as any[]).length === 0 && <p className="text-muted-foreground font-mono col-span-full">Гараж этого экипажа пока пуст.</p>}
                    </div>
                </div>

                 <div>
                    <h2 className="text-3xl font-orbitron text-brand-cyan mb-4 flex items-center gap-3"><VibeContentRenderer content="::FaUsers::"/>Участники</h2>
                     <div className="flex flex-wrap gap-4">
                        {(crew.members as any[])?.map(({ user }) => (
                            <div key={user.user_id} className="flex items-center gap-3 bg-dark-card/50 p-2 pr-4 rounded-full border border-border">
                                 <Image src={user.avatar_url || '/placeholder.svg'} alt={user.username || user.user_id} width={40} height={40} className="rounded-full" />
                                <span className="font-mono">@{user.username}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}

export default function CrewPage({ params }: { params: { slug: string } }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
        <Suspense fallback={<Loading text="ЗАГРУЗКА ДАННЫХ ЭКИПАЖА..." />}>
          <CrewDetailContent slug={params.slug} />
        </Suspense>
    </div>
  );
}