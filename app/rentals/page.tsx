"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import Image from "next/image";
import { motion } from "framer-motion";
import { getUserRentals } from './actions';
import { useAppContext } from '@/contexts/AppContext';
import { Loading } from '@/components/Loading';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Database } from '@/types/database.types';

type RentalDashboardItem = (Database['public']['Views']['rentals_view']['Row']) & {
    user_role: 'renter' | 'owner' | 'crew_owner';
};

const statusConfig = {
    pending: { label: "Ожидание", icon: "::FaHourglassHalf::", color: "text-brand-yellow" },
    active: { label: "Активна", icon: "::FaPlayCircle::", color: "text-brand-green" },
    completed: { label: "Завершена", icon: "::FaCheckCircle::", color: "text-muted-foreground" },
    cancelled: { label: "Отменена", icon: "::FaTimesCircle::", color: "text-destructive" },
    default: { label: "Неизвестно", icon: "::FaQuestionCircle::", color: "text-muted-foreground" },
};

const RentalListItem = ({ rental }: { rental: RentalDashboardItem }) => {
    const config = statusConfig[rental.status as keyof typeof statusConfig] || statusConfig.default;
    const roleText = rental.user_role === 'renter' ? 'Вы арендатор' : rental.user_role === 'owner' ? 'Вы владелец' : 'Экипаж';
    
    return (
        <Link href={`/rentals/${rental.rental_id}`} className="block">
            <motion.div 
                whileHover={{ scale: 1.02, y: -2 }}
                className="bg-card/50 p-3 rounded-lg flex items-center gap-4 border border-border hover:border-brand-cyan transition-colors"
            >
                <Image src={rental.vehicle_image_url || '/placeholder.svg'} alt={rental.vehicle_model || "Vehicle"} width={64} height={64} className="rounded-md object-cover aspect-square" />
                <div className="flex-grow">
                    <p className="font-bold">{rental.vehicle_make} {rental.vehicle_model}</p>
                    <p className="text-xs text-muted-foreground font-mono">{roleText}</p>
                </div>
                <div className={cn("flex items-center gap-2 text-sm font-mono", config.color)}>
                    <VibeContentRenderer content={config.icon} />
                    <span>{config.label}</span>
                </div>
            </motion.div>
        </Link>
    );
};

export default function FindRentalPage() {
    const [rentalId, setRentalId] = useState('');
    const router = useRouter();
    const { dbUser, isLoading: isAppLoading } = useAppContext();
    const [rentals, setRentals] = useState<RentalDashboardItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isAppLoading) return;
        if (!dbUser) { setLoading(false); return; }
        
        async function loadRentals() {
            const result = await getUserRentals(dbUser.user_id);
            if (result.success && result.data) {
                setRentals(result.data as RentalDashboardItem[]);
            }
            setLoading(false);
        }
        loadRentals();
    }, [dbUser, isAppLoading]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (rentalId.trim()) {
            router.push(`/rentals/${rentalId.trim()}`);
        }
    };
    
    const categorizedRentals = {
        asRenter: rentals.filter(r => r.user_role === 'renter'),
        asOwner: rentals.filter(r => r.user_role === 'owner'),
        asCrewOwner: rentals.filter(r => r.user_role === 'crew_owner'),
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-4 pt-24">
             <div className="fixed inset-0 z-[-1] opacity-20"><Image src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg" alt="BG" fill className="object-cover animate-pan-zoom" /><div className="absolute inset-0 bg-background/70 backdrop-blur-sm"></div></div>
            <div className="container mx-auto max-w-2xl">
                <motion.div
                    initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="w-full bg-card/70 backdrop-blur-xl border border-brand-purple/30 rounded-2xl shadow-lg shadow-brand-purple/10 p-6 mb-8"
                >
                    <div className="text-center mb-6">
                        <VibeContentRenderer content="::FaTicket::" className="text-5xl text-brand-cyan mx-auto mb-4" />
                        <h1 className="text-3xl font-orbitron text-foreground">Найти Аренду</h1>
                        <p className="text-muted-foreground mt-2 font-mono text-sm">Введите ID для поиска или выберите из списка ниже.</p>
                    </div>
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <Input type="text" value={rentalId} onChange={(e) => setRentalId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="input-cyber h-12 text-center text-base tracking-wider flex-grow" />
                        <Button type="submit" className="h-12 text-lg font-orbitron" disabled={!rentalId.trim()} size="icon"><VibeContentRenderer content="::FaMagnifyingGlass::" /></Button>
                    </form>
                </motion.div>

                {loading ? <Loading text="Загрузка ваших аренд..." /> : (
                    <div className="space-y-6">
                        {categorizedRentals.asRenter.length > 0 && (
                            <section>
                                <h2 className="font-orbitron text-xl mb-3 text-brand-pink">::FaKey:: Мои Аренды</h2>
                                <div className="space-y-2">{categorizedRentals.asRenter.map(r => <RentalListItem key={r.rental_id} rental={r} />)}</div>
                            </section>
                        )}
                        {categorizedRentals.asOwner.length > 0 && (
                            <section>
                                <h2 className="font-orbitron text-xl mb-3 text-brand-lime">::FaCar:: Мой Транспорт в Аренде</h2>
                                <div className="space-y-2">{categorizedRentals.asOwner.map(r => <RentalListItem key={r.rental_id} rental={r} />)}</div>
                            </section>
                        )}
                        {categorizedRentals.asCrewOwner.length > 0 && (
                            <section>
                                <h2 className="font-orbitron text-xl mb-3 text-brand-orange">::FaUsers:: Аренды Экипажа</h2>
                                <div className="space-y-2">{categorizedRentals.asCrewOwner.map(r => <RentalListItem key={r.rental_id} rental={r} />)}</div>
                            </section>
                        )}
                         {rentals.length === 0 && !loading && (
                            <p className="text-center text-muted-foreground font-mono py-8">Активных аренд не найдено.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}