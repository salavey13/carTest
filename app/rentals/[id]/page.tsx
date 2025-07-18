"use client";

import { getRentalDetails, addRentalPhoto, confirmVehiclePickup, confirmVehicleReturn } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { Database } from '@/types/database.types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Rental = Database['public']['Tables']['rentals']['Row'] & {
    vehicle: Database['public']['Tables']['cars']['Row'] | null;
    renter: Database['public']['Tables']['users']['Row'] | null;
    owner: Database['public']['Tables']['users']['Row'] | null;
};

type UserRole = 'renter' | 'owner' | 'other';

const getRentalStep = (rental: Rental | null): number => {
    if (!rental) return 0;
    if (rental.payment_status !== 'fully_paid' && rental.payment_status !== 'interest_paid') return 1;
    if (!rental.start_photo_url) return 2;
    if (!rental.pickup_confirmed_at) return 3;
    if (!rental.end_photo_url) return 4;
    if (!rental.return_confirmed_at) return 5;
    return 6; // Completed
};

const StepCard = ({
    title, icon, isCompleted, isCurrent, isLocked, children, content
}: {
    title: string; icon: string; isCompleted: boolean; isCurrent: boolean; isLocked: boolean; children?: React.ReactNode; content?: React.ReactNode;
}) => (
    <div className="flex gap-4">
        <div className="flex flex-col items-center">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                isCompleted ? "bg-brand-green/20 border-brand-green text-brand-green" : "",
                isCurrent ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan animate-pulse" : "",
                isLocked ? "bg-muted/20 border-border text-muted-foreground" : ""
            )}>
                <VibeContentRenderer content={icon} className="text-2xl" />
            </div>
            <div className={cn("w-0.5 grow mt-2",
                isCompleted ? "bg-brand-green" : "bg-border"
            )}></div>
        </div>
        <div className="flex-1 pb-10">
            <h3 className={cn("font-orbitron text-xl pt-3 transition-colors",
                isLocked ? "text-muted-foreground" : "text-foreground"
            )}>{title}</h3>
            <AnimatePresence>
            {(isCurrent || isCompleted) && (
                 <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-card/50 border border-border p-4 rounded-lg mt-2"
                >
                    {isCurrent ? children : content}
                </motion.div>
            )}
            </AnimatePresence>
        </div>
    </div>
);

export default function RentalJourneyPage({ params }: { params: { id: string } }) {
    const { dbUser, isLoading: isAppLoading } = useAppContext();
    const [rental, setRental] = useState<Rental | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshRentalData = useCallback(async () => {
        if (!dbUser?.user_id) return;
        const res = await getRentalDetails(params.id, dbUser.user_id);
        if (res.success && res.data) {
            setRental(res.data as Rental);
        } else {
            setError(res.error || "Failed to refresh data.");
        }
    }, [params.id, dbUser]);

    useEffect(() => {
        if (isAppLoading) return;

        if (!dbUser?.user_id) {
            setLoading(false);
            setError("Пользователь не авторизован.");
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            const res = await getRentalDetails(params.id, dbUser.user_id);
            if (res.success && res.data) {
                setRental(res.data as Rental);
            } else {
                setError(res.error || "Аренда не найдена или у вас нет доступа.");
            }
            setLoading(false);
        };
        fetchData();
    }, [params.id, dbUser, isAppLoading]);
    
    const { currentStep, userRole } = useMemo(() => {
        const step = getRentalStep(rental);
        const role: UserRole = rental?.user_id === dbUser?.user_id ? 'renter' : rental?.owner_id === dbUser?.user_id ? 'owner' : 'other';
        return { currentStep: step, userRole: role };
    }, [rental, dbUser]);
    
    const handleAction = async (action: () => Promise<any>, successMessage: string) => {
        const promise = action();
        toast.promise(promise, {
            loading: 'Выполняется...',
            success: (data) => {
                if(data.success) {
                    refreshRentalData();
                    return successMessage;
                } else {
                    throw new Error(data.error || "Произошла ошибка");
                }
            },
            error: (err) => err.message,
        });
    };

    const steps = [
        {
            title: "Ожидание Оплаты", icon: "::FaFileInvoiceDollar::",
            content: <p className="text-sm text-muted-foreground">Оплата подтверждена {new Date(rental?.updated_at!).toLocaleString()}.</p>,
            action: <p className="text-sm text-brand-yellow">Как только аренда будет оплачена, вы сможете продолжить. Проверьте уведомления в боте.</p>
        },
        {
            title: "Фото 'ДО'", icon: "::FaCameraRetro::",
            content: <Image src={rental?.start_photo_url!} alt="Start Photo" width={150} height={150} className="rounded-lg" />,
            action: userRole === 'renter' ? 
                <Button onClick={() => handleAction(() => addRentalPhoto(params.id, dbUser!.user_id, 'https://placehold.co/600x400/27272a/fff?text=START', 'start'), "Фото 'ДО' успешно добавлено!")}>::FaUpload:: Загрузить фото</Button> :
                <p className="text-sm text-muted-foreground">Ожидаем фото от арендатора...</p>
        },
        {
            title: "Подтверждение Получения", icon: "::FaHandshake::",
            content: <p className="text-sm text-muted-foreground">Транспорт получен {new Date(rental?.pickup_confirmed_at!).toLocaleString()}.</p>,
            action: userRole === 'owner' ? 
                <Button onClick={() => handleAction(() => confirmVehiclePickup(params.id, dbUser!.user_id), "Получение подтверждено! Аренда активна.")}>::FaCheckCircle:: Подтвердить получение</Button> :
                <p className="text-sm text-muted-foreground">Ожидаем подтверждения от владельца...</p>
        },
        {
            title: "Фото 'ПОСЛЕ'", icon: "::FaCamera::",
            content: <Image src={rental?.end_photo_url!} alt="End Photo" width={150} height={150} className="rounded-lg" />,
            action: userRole === 'renter' ? 
                <Button onClick={() => handleAction(() => addRentalPhoto(params.id, dbUser!.user_id, 'https://placehold.co/600x400/27272a/fff?text=END', 'end'), "Фото 'ПОСЛЕ' успешно добавлено!")}>::FaUpload:: Загрузить фото</Button> :
                <p className="text-sm text-muted-foreground">Ожидаем фото от арендатора после завершения поездки.</p>
        },
        {
            title: "Подтверждение Возврата", icon: "::FaFlagCheckered::",
            content: <p className="text-sm text-muted-foreground">Возврат подтвержден {new Date(rental?.return_confirmed_at!).toLocaleString()}.</p>,
            action: userRole === 'owner' ? 
                <Button onClick={() => handleAction(() => confirmVehicleReturn(params.id, dbUser!.user_id), "Возврат подтвержден! Аренда завершена.")}>::FaCheckDouble:: Подтвердить возврат</Button> :
                <p className="text-sm text-muted-foreground">Ожидаем финального подтверждения от владельца.</p>
        },
        {
            title: "Аренда Завершена", icon: "::FaThumbsUp::",
            content: <p className="text-sm text-brand-green">Эта аренда успешно завершена. Спасибо!</p>,
            action: null
        }
    ];

    if (loading) return <Loading text="Загрузка деталей аренды..." />;
    if (error) return <div className="text-center p-8 text-destructive">{error}</div>;
    if (!rental) return <div className="text-center p-8 text-muted-foreground">Аренда не найдена.</div>;

    return (
        <div className="min-h-screen bg-background text-foreground p-4 pt-24">
             <div className="fixed inset-0 z-[-1] opacity-20">
                <Image
                    src={rental.vehicle?.image_url || "/placeholder.svg"}
                    alt="Rental Journey Background"
                    fill
                    className="object-cover animate-pan-zoom"
                />
                <div className="absolute inset-0 bg-background/70 backdrop-blur-sm"></div>
            </div>
            <div className="container mx-auto max-w-2xl relative z-10">
                <div className="bg-card/70 backdrop-blur-xl border border-border p-6 rounded-2xl mb-8">
                     <h1 className="text-3xl font-orbitron text-brand-cyan mb-2">Путь Арендатора</h1>
                    <p className="text-sm font-mono text-muted-foreground mb-6">ID: {rental.rental_id}</p>
                    {rental.vehicle && (
                        <Link href={`/rent/${rental.vehicle.id}`} className="flex items-center gap-4 bg-card/50 p-3 rounded-lg hover:bg-card/80 transition-colors">
                            <Image src={rental.vehicle.image_url || '/placeholder.svg'} alt={rental.vehicle.model || 'Vehicle Image'} width={80} height={80} className="rounded-lg object-cover aspect-square" />
                            <div>
                                <p className="font-bold text-xl">{rental.vehicle.make} {rental.vehicle.model}</p>
                                <p className="text-muted-foreground">{rental.vehicle.type === 'bike' ? 'Мотоцикл' : 'Автомобиль'}</p>
                            </div>
                        </Link>
                    )}
                </div>

                <div className="relative">
                    {steps.map((step, index) => (
                        <StepCard 
                            key={index}
                            title={step.title} 
                            icon={step.icon}
                            isCompleted={currentStep > index + 1}
                            isCurrent={currentStep === index + 1}
                            isLocked={currentStep < index + 1}
                            content={step.content}
                        >
                            {step.action}
                        </StepCard>
                    ))}
                </div>
            </div>
        </div>
    );
}