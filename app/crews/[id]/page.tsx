import { getPublicCrewInfo } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

async function CrewDetailContent({ id }: { id: string }) {
    const result = await getPublicCrewInfo(id);

    if (!result.success || !result.data) {
        return <p className="text-destructive text-center">{result.error || "Экипаж не найден."}</p>;
    }
    
    const { data: crew } = result;

    return (
        <div className="space-y-8">
            <header className="text-center border-b border-border pb-8">
                <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Logo`} width={120} height={120} className="rounded-full mx-auto mb-4 bg-black/50 border-2 border-brand-purple" />
                <h1 className="text-5xl font-orbitron text-brand-purple">{crew.name}</h1>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">{crew.description}</p>
                <p className="text-xs text-muted-foreground mt-4">Владелец: @{crew.owner?.username}</p>
            </header>

            <div>
                <h2 className="text-3xl font-orbitron text-brand-cyan mb-4">Гараж Экипажа</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(crew.vehicles as any[])?.map(vehicle => (
                        <Link href={`/rent/${vehicle.id}`} key={vehicle.id} className="bg-dark-card/50 p-4 rounded-lg hover:bg-dark-card transition-colors">
                            <Image src={vehicle.image_url} alt={vehicle.model} width={300} height={200} className="w-full h-40 object-cover rounded-md mb-2"/>
                            <h3 className="font-semibold">{vehicle.make} {vehicle.model}</h3>
                        </Link>
                    ))}
                </div>
            </div>

             <div>
                <h2 className="text-3xl font-orbitron text-brand-cyan mb-4">Участники</h2>
                 <div className="flex flex-wrap gap-4">
                    {(crew.members as any[])?.map(({ user }) => (
                        <div key={user.user_id} className="flex items-center gap-2 bg-dark-card/50 p-2 rounded-full">
                             <Image src={user.avatar_url || '/placeholder.svg'} alt={user.username} width={40} height={40} className="rounded-full" />
                            <span className="font-mono">@{user.username}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function CrewPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-black text-white p-4 pt-24">
      <div className="container mx-auto max-w-5xl">
        <Suspense fallback={<Loading text="ЗАГРУЗКА ДАННЫХ ЭКИПАЖА..." />}>
          <CrewDetailContent id={params.id} />
        </Suspense>
      </div>
    </div>
  );
}