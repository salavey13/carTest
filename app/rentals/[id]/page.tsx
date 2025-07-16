import { getRentalDetails } from '@/app/rentals/actions';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import React, { Suspense } from 'react';

async function RentalManagementContent({ id }: { id: string }) {
    // This is a simplified auth check for server components.
    // In a real app, you'd use a more robust session management system.
    const userId = headers().get('x-user-id');
    if (!userId) {
        // Or redirect to a login page
        return <p className="text-destructive">Unauthorized.</p>;
    }

    const result = await getRentalDetails(id, userId);

    if (!result.success || !result.data) {
        return (
            <div className="text-center">
                <h2 className="text-2xl font-bold text-destructive">Ошибка Загрузки Аренды</h2>
                <p className="text-muted-foreground">{result.error || "Аренда не найдена или у вас нет доступа."}</p>
            </div>
        );
    }
    
    const { data: rental } = result;
    const { vehicle, renter, owner } = rental;

    return (
        <div className="bg-dark-card/80 backdrop-blur-xl border border-border p-8 rounded-2xl">
            <h1 className="text-3xl font-orbitron text-brand-cyan mb-2">Управление Арендой</h1>
            <p className="text-sm font-mono text-muted-foreground mb-6">ID Сделки: {rental.rental_id}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="font-orbitron text-2xl text-brand-pink mb-4">Детали Транспорта</h2>
                    {vehicle && (
                        <div className="flex items-center gap-4">
                            <Image src={vehicle.image_url || ''} alt={vehicle.model || ''} width={120} height={120} className="rounded-lg object-cover" />
                            <div>
                                <p className="font-bold text-xl">{vehicle.make} {vehicle.model}</p>
                                <p className="text-muted-foreground">{vehicle.type === 'bike' ? 'Мотоцикл' : 'Автомобиль'}</p>
                            </div>
                        </div>
                    )}
                </div>
                 <div>
                    <h2 className="font-orbitron text-2xl text-brand-pink mb-4">Участники Сделки</h2>
                    <p><span className="font-mono text-muted-foreground">Владелец:</span> @{owner?.username || owner?.user_id}</p>
                    <p><span className="font-mono text-muted-foreground">Арендатор:</span> @{renter?.username || renter?.user_id}</p>
                </div>
            </div>
            <div className="mt-8 border-t border-border pt-6">
                <h2 className="font-orbitron text-2xl text-brand-pink mb-4">Статус</h2>
                 <p><span className="font-mono text-muted-foreground">Статус аренды:</span> <span className="font-bold text-brand-yellow">{rental.status}</span></p>
                 <p><span className="font-mono text-muted-foreground">Статус оплаты:</span> <span className="font-bold text-brand-yellow">{rental.payment_status}</span></p>
                 <p className="font-mono text-muted-foreground mt-4">Чат и подтверждение деталей будет здесь...</p>
            </div>
        </div>
    );
}

export default function RentalPage({ params }: { params: { id: string } }) {
    return (
        <div className="min-h-screen bg-black text-white p-4 pt-24">
            <div className="container mx-auto max-w-4xl">
                <Suspense fallback={<Loading text="Загрузка деталей аренды..." />}>
                    <RentalManagementContent id={params.id} />
                </Suspense>
            </div>
        </div>
    );
}