import { getAllPublicCrews } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';

async function CrewsList() {
    const result = await getAllPublicCrews();

    if (!result.success || !result.data) {
        return <p className="text-destructive">Не удалось загрузить список экипажей: {result.error}</p>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {result.data.map((crew, index) => (
                <Link href={`/crews/${crew.id}`} key={crew.id}>
                    <div className="bg-dark-card/80 border border-border p-6 rounded-xl h-full flex flex-col items-center text-center transition-all duration-300 hover:border-brand-green hover:shadow-2xl hover:shadow-brand-green/20">
                        <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Logo`} width={80} height={80} className="rounded-full mb-4 bg-black/50" />
                        <h2 className="text-2xl font-orbitron text-brand-green">{crew.name}</h2>
                        <p className="text-muted-foreground font-mono text-sm mt-2 flex-grow">{crew.description}</p>
                        <div className="flex gap-4 mt-4 text-xs font-mono text-center">
                            <p><strong className="text-white">{(crew.members as any)[0].count}</strong> Участников</p>
                            <p><strong className="text-white">{(crew.vehicles as any)[0].count}</strong> Единиц</p>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    );
}


export default function CrewsPage() {
    return (
        <div className="min-h-screen bg-black text-white p-4 pt-24">
            <header className="text-center mb-12">
                <h1 className="text-5xl md:text-7xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-brand-green to-brand-cyan animate-glitch" data-text="ЭКИПАЖИ">
                    ЭКИПАЖИ
                </h1>
                <p className="text-muted-foreground font-mono mt-2">Команды, которые правят улицами.</p>
            </header>
            <div className="container mx-auto max-w-6xl">
                 <Suspense fallback={<Loading text="ЗАГРУЗКА ЭКИПАЖЕЙ..." />}>
                    <CrewsList />
                </Suspense>
            </div>
        </div>
    );
}