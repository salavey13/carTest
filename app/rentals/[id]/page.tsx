"use client";

import { getRentalDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';

type RentalDetailsResult = Awaited<ReturnType<typeof getRentalDetails>>;

export default function RentalPage({ params }: { params: { id: string } }) {
    const { dbUser, isLoading: isAppLoading } = useAppContext();
    const [result, setResult] = useState<RentalDetailsResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isAppLoading) {
            setLoading(true);
            return;
        }

        if (!dbUser?.user_id) {
            setLoading(false);
            setResult({ success: false, error: "Пользователь не авторизован. Войдите, чтобы продолжить." });
            return;
        }
        
        const fetchData = async () => {
            setLoading(true);
            const res = await getRentalDetails(params.id, dbUser.user_id);
            setResult(res);
            setLoading(false);
        };

        fetchData();

    }, [params.id, dbUser, isAppLoading]);

    const renderContent = () => {
        if (loading) {
            return <Loading text="Загрузка деталей аренды..." />;
        }

        if (!result?.success || !result.data) {
            return (
                <div className="text-center bg-card/80 p-8 rounded-lg">
                    <h2 className="text-2xl font-bold text-destructive flex items-center justify-center gap-2">
                        <VibeContentRenderer content="::FaLock::" /> Ошибка Доступа
                    </h2>
                    <p className="text-muted-foreground mt-2">{result?.error || "Аренда не найдена или у вас нет доступа."}</p>
                    <Button asChild className="mt-6"><Link href="/rent-bike">В Гараж</Link></Button>
                </div>
            );
        }

        const { data: rental } = result;
        const { vehicle, renter, owner } = rental;

        return (
            <div className="bg-card/80 backdrop-blur-xl border border-border p-6 md:p-8 rounded-2xl">
                <h1 className="text-3xl font-orbitron text-brand-cyan mb-2">Управление Арендой</h1>
                <p className="text-sm font-mono text-muted-foreground mb-6">ID СДЕЛКИ: {rental.rental_id}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h2 className="font-orbitron text-2xl text-brand-pink">Детали Транспорта</h2>
                        {vehicle && (
                            <Link href={`/rent/${vehicle.id}`} className="flex items-center gap-4 bg-black/30 p-4 rounded-lg hover:bg-black/50 transition-colors">
                                <Image src={vehicle.image_url || '/placeholder.svg'} alt={vehicle.model || 'Vehicle Image'} width={100} height={100} className="rounded-lg object-cover aspect-square" />
                                <div>
                                    <p className="font-bold text-xl">{vehicle.make} {vehicle.model}</p>
                                    <p className="text-muted-foreground">{vehicle.type === 'bike' ? 'Мотоцикл' : 'Автомобиль'}</p>
                                </div>
                            </Link>
                        )}
                    </div>
                     <div className="space-y-4">
                        <h2 className="font-orbitron text-2xl text-brand-pink">Участники Сделки</h2>
                         <div className="bg-black/30 p-4 rounded-lg space-y-2">
                            <p><span className="font-mono text-muted-foreground">Владелец:</span> @{owner?.username || owner?.user_id}</p>
                            <p><span className="font-mono text-muted-foreground">Арендатор:</span> @{renter?.username || renter?.user_id}</p>
                         </div>
                    </div>
                </div>
                <div className="mt-8 border-t border-border pt-6">
                    <h2 className="font-orbitron text-2xl text-brand-pink mb-4">Статус</h2>
                     <p className="text-lg"><span className="font-mono text-muted-foreground">Статус аренды:</span> <span className="font-bold text-brand-yellow uppercase">{rental.status}</span></p>
                     <p className="text-lg"><span className="font-mono text-muted-foreground">Статус оплаты:</span> <span className="font-bold text-brand-yellow uppercase">{rental.payment_status}</span></p>
                     <p className="font-mono text-muted-foreground mt-4 text-sm">Здесь будет чат и кнопки для подтверждения/отмены сделки...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 pt-24">
             <div className="fixed inset-0 z-[-1] opacity-20">
                <Image
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
                alt="Rental Management Background"
                fill
                className="object-cover animate-pan-zoom"
                />
                <div className="absolute inset-0 bg-background/70 backdrop-blur-sm"></div>
            </div>
            <div className="container mx-auto max-w-4xl relative z-10">
                {renderContent()}
            </div>
        </div>
    );
}