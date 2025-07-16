import { getAllPublicCrews } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import RockstarHeroSection from '@/app/tutorials/RockstarHeroSection';
import { motion } from 'framer-motion';

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
            {result.data.map((crew, index) => (
                <Link href={`/crews/${crew.slug}`} key={crew.id} className="block group">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-dark-card/80 border border-border p-5 rounded-xl h-full flex flex-col transition-all duration-300 hover:border-brand-green hover:shadow-2xl hover:shadow-brand-green/20 transform hover:-translate-y-1 relative overflow-hidden"
                    >
                        <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Background`} fill className="absolute inset-0 object-cover opacity-5 group-hover:opacity-10 transition-opacity duration-300 blur-sm scale-125" />
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-4">
                                <Image src={crew.logo_url || '/placeholder.svg'} alt={`${crew.name} Logo`} width={64} height={64} className="rounded-full bg-black/50 border-2 border-border group-hover:border-brand-green transition-colors flex-shrink-0" />
                                <h2 className="text-2xl font-orbitron text-brand-green flex-grow">{crew.name}</h2>
                            </div>
                            <p className="text-muted-foreground font-mono text-sm mt-2 flex-grow min-h-[60px]">{crew.description}</p>
                            <div className="flex gap-4 mt-4 text-xs font-mono text-center border-t border-border/50 pt-4 w-full justify-around">
                                <div className='text-center'><VibeContentRenderer content="::FaUsers::" className="text-brand-cyan mb-1 mx-auto" /><p><strong className="text-white">{crew.member_count}</strong> Участников</p></div>
                                <div className='text-center'><VibeContentRenderer content="::FaWarehouse::" className="text-brand-orange mb-1 mx-auto" /><p><strong className="text-white">{crew.vehicle_count}</strong> Единиц</p></div>
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
            <div id={heroTriggerId} style={{ height: '50vh' }} aria-hidden="true" />
            <div className="container mx-auto max-w-6xl px-4 py-12 relative z-20 bg-background">
                 <Suspense fallback={<Loading variant="bike" text="ЗАГРУЗКА ЭКИПАЖЕЙ..." />}>
                    <CrewsList />
                </Suspense>
            </div>
        </div>
    );
}