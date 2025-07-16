import { getRentalDetails } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import { headers } from 'next/headers';
import React, { Suspense } from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';

async function RentalManagementContent({ id }: { id: string }) {
    const userId = headers().get('x-user-id') || "";
    const result = await getRentalDetails(id);

    if (!result.success || !result.data) {
        return (
            <div className="text-center bg-dark-card/80 p-8 rounded-lg">
                <h2 className="text-2xl font-bold text-destructive">::FaLock:: Ошибка Доступа</h2>
                <p className="text-muted-foreground mt-2">{result.error || "Аренда не найдена или у вас нет доступа."}</p>
                 <Button asChild className="mt-6"><Link href="/rent-bike">В Гараж</Link></Button>
            </div>
        );
    }
    
    const { data: rental } = result;
    const { vehicle, renter, owner } = rental;

    return (
        <div className="bg-dark-card/80 backdrop-blur-xl border border-border p-6 md:p-8 rounded-2xl">
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

export default function RentalPage({ params }: { params: { id: string } }) {
    return (
        <div className="min-h-screen bg-black text-white p-4 pt-24">
             <div className="fixed inset-0 z-[-1] opacity-20">
                <Image
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
                alt="Rental Management Background"
                fill
                className="object-cover animate-pan-zoom"
                />
                <div className="absolute inset-0 bg-black/70"></div>
            </div>
            <div className="container mx-auto max-w-4xl">
                <Suspense fallback={<Loading text="Загрузка деталей аренды..." />}>
                    <RentalManagementContent id={params.id} />
                </Suspense>
            </div>
        </div>
    );
}