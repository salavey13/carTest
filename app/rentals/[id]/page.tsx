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
import ImageReplaceTool from '@/components/stickyChat_components/ImageReplaceTool';

type Rental = Database['public']['Tables']['rentals']['Row'] & {
    vehicle: Database['public']['Tables']['cars']['Row'] | null;
    renter: Database['public']['Tables']['users']['Row'] | null;
    owner: Database['public']['Tables']['users']['Row'] | null;
};

type UserRole = 'renter' | 'owner' | 'other';
type StepState = 'completed' | 'current' | 'locked' | 'skipped';

// Smart step derivation
const getRentalStep = (rental: Rental | null): [number, StepState[]] => {
    const states: StepState[] = Array(5).fill('locked');
    if (!rental) return [0, states];
    
    let currentStep = 0;

    // 1. Payment
    if (rental.payment_status === 'fully_paid' || rental.payment_status === 'interest_paid') {
        states[0] = 'completed';
        currentStep = 2;
    } else {
        states[0] = 'current';
        return [1, states];
    }

    // 2. Start Photo
    if (rental.start_photo_url) {
        states[1] = 'completed';
        currentStep = 3;
    } else if (rental.pickup_confirmed_at) { // Skipped if pickup is already confirmed
        states[1] = 'skipped';
        currentStep = 3;
    } else {
        states[1] = 'current';
        return [2, states];
    }
    
    // 3. Pickup Confirmation
    if (rental.pickup_confirmed_at) {
        states[2] = 'completed';
        currentStep = 4;
    } else {
        states[2] = 'current';
        return [3, states];
    }

    // 4. End Photo
    if (rental.end_photo_url) {
        states[3] = 'completed';
        currentStep = 5;
    } else if (rental.return_confirmed_at) { // Skipped if return is already confirmed
        states[3] = 'skipped';
        currentStep = 5;
    } else {
        states[3] = 'current';
        return [4, states];
    }

    // 5. Return Confirmation
    if (rental.return_confirmed_at) {
        states[4] = 'completed';
        currentStep = 6;
    } else {
        states[4] = 'current';
        return [5, states];
    }

    return [currentStep, states];
};

const StepCard = ({
    title, icon, stepState, children, content, onAction, actionInProgress
}: {
    title: string; icon: string; stepState: StepState; children?: React.ReactNode; content?: React.ReactNode; onAction?: (url: string) => void; actionInProgress?: boolean;
}) => (
    <div className="flex gap-4">
        <div className="flex flex-col items-center">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                stepState === 'completed' && "bg-brand-green/20 border-brand-green text-brand-green",
                stepState === 'current' && "bg-brand-cyan/20 border-brand-cyan text-brand-cyan animate-pulse",
                stepState === 'locked' && "bg-muted/20 border-border text-muted-foreground",
                stepState === 'skipped' && "bg-muted/30 border-dashed border-border text-muted-foreground"
            )}>
                <VibeContentRenderer content={icon} className="text-2xl" />
            </div>
            <div className={cn("w-0.5 grow mt-2",
                stepState === 'completed' ? "bg-brand-green" : "bg-border"
            )}></div>
        </div>
        <div className="flex-1 pb-10">
            <h3 className={cn("font-orbitron text-xl pt-3 transition-colors",
                stepState === 'locked' ? "text-muted-foreground" : "text-foreground"
            )}>{title}</h3>
            <AnimatePresence>
            {(stepState !== 'locked') && (
                 <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-card/50 border border-border p-4 rounded-lg mt-2"
                >
                    {stepState === 'current' ? children : content}
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
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);

    const refreshRentalData = useCallback(async () => {
        if (!dbUser?.user_id) return;
        const res = await getRentalDetails(params.id, dbUser.user_id);
        if (res.success && res.data) setRental(res.data as Rental);
        else setError(res.error || "Failed to refresh data.");
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
            if (res.success && res.data) setRental(res.data as Rental);
            else setError(res.error || "Аренда не найдена или у вас нет доступа.");
            setLoading(false);
        };
        fetchData();
    }, [params.id, dbUser, isAppLoading]);
    
    const [currentStep, stepStates] = useMemo(() => getRentalStep(rental), [rental]);
    const userRole: UserRole = useMemo(() => 
        rental?.user_id === dbUser?.user_id ? 'renter' : rental?.owner_id === dbUser?.user_id ? 'owner' : 'other',
        [rental, dbUser]
    );
    
    const handleAction = async (action: () => Promise<any>, successMessage: string, actionKey: string) => {
        setActionInProgress(actionKey);
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
            finally: () => setActionInProgress(null),
        });
    };

    const handlePhotoUpload = (photoUrl: string, photoType: 'start' | 'end') => {
        if (!dbUser?.user_id) return;
        handleAction(
            () => addRentalPhoto(params.id, dbUser.user_id, photoUrl, photoType),
            `Фото '${photoType === 'start' ? "ДО" : "ПОСЛЕ"}' успешно добавлено!`,
            `photo-${photoType}`
        );
    }
    
    if (loading) return <Loading text="Загрузка деталей аренды..." />;
    if (error) return <div className="text-center p-8 text-destructive">{error}</div>;
    if (!rental) return <div className="text-center p-8 text-muted-foreground">Аренда не найдена.</div>;

    const stepsConfig = [
        {
            title: "Оплата", icon: "::FaFileInvoiceDollar::",
            content: <p className="text-sm text-muted-foreground">Оплачено {new Date(rental.updated_at!).toLocaleString()}.</p>,
            actionContent: <p className="text-sm text-brand-yellow">Как только аренда будет оплачена, вы сможете продолжить. Проверьте уведомления в боте.</p>
        },
        {
            title: "Фото 'ДО'", icon: "::FaCameraRetro::",
            content: rental.start_photo_url ? <Image src={rental.start_photo_url} alt="Start" width={150} height={150} className="rounded-lg"/> : <p className="text-sm text-muted-foreground">Шаг пропущен.</p>,
            actionContent: userRole === 'renter' ? 
                <ImageReplaceTool oldImageUrl={""} onReplaceConfirmed={(url) => handlePhotoUpload(url, 'start')} onCancel={() => {}} /> : 
                <p className="text-sm text-muted-foreground">Ожидаем фото от арендатора...</p>
        },
        {
            title: "Подтверждение Получения", icon: "::FaHandshake::",
            content: <p className="text-sm text-muted-foreground">Получено {new Date(rental.pickup_confirmed_at!).toLocaleString()}.</p>,
            actionContent: userRole === 'owner' ? 
                <Button onClick={() => handleAction(() => confirmVehiclePickup(params.id, dbUser!.user_id), "Получение подтверждено!", "pickup")} disabled={actionInProgress === 'pickup'}>::FaCheckCircle:: Подтвердить</Button> :
                <p className="text-sm text-muted-foreground">Ожидаем подтверждения от владельца...</p>
        },
        {
            title: "Фото 'ПОСЛЕ'", icon: "::FaCamera::",
            content: rental.end_photo_url ? <Image src={rental.end_photo_url} alt="End" width={150} height={150} className="rounded-lg"/> : <p className="text-sm text-muted-foreground">Шаг пропущен.</p>,
            actionContent: userRole === 'renter' ? 
                <ImageReplaceTool oldImageUrl={""} onReplaceConfirmed={(url) => handlePhotoUpload(url, 'end')} onCancel={() => {}} /> : 
                <p className="text-sm text-muted-foreground">Ожидаем фото от арендатора.</p>
        },
        {
            title: "Подтверждение Возврата", icon: "::FaFlagCheckered::",
            content: <p className="text-sm text-muted-foreground">Возвращено {new Date(rental.return_confirmed_at!).toLocaleString()}.</p>,
            actionContent: userRole === 'owner' ? 
                <Button onClick={() => handleAction(() => confirmVehicleReturn(params.id, dbUser!.user_id), "Возврат подтвержден!", "return")} disabled={actionInProgress === 'return'}>::FaCheckDouble:: Подтвердить</Button> :
                <p className="text-sm text-muted-foreground">Ожидаем подтверждения от владельца.</p>
        },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground p-4 pt-24">
             <div className="fixed inset-0 z-[-1] opacity-20"><Image src={rental.vehicle?.image_url || "/placeholder.svg"} alt="BG" fill className="object-cover animate-pan-zoom" /><div className="absolute inset-0 bg-background/70 backdrop-blur-sm"></div></div>
            <div className="container mx-auto max-w-2xl relative z-10">
                <div className="bg-card/70 backdrop-blur-xl border border-border p-6 rounded-2xl mb-8">
                     <h1 className="text-3xl font-orbitron text-brand-cyan mb-2">Путь Арендатора</h1>
                    <p className="text-sm font-mono text-muted-foreground mb-6">ID: {rental.rental_id}</p>
                    {rental.vehicle && (
                        <Link href={`/rent/${rental.vehicle.id}`} className="flex items-center gap-4 bg-card/50 p-3 rounded-lg hover:bg-card/80 transition-colors">
                            <Image src={rental.vehicle.image_url || '/placeholder.svg'} alt={rental.vehicle.model || 'V'} width={80} height={80} className="rounded-lg object-cover aspect-square" />
                            <div><p className="font-bold text-xl">{rental.vehicle.make} {rental.vehicle.model}</p><p className="text-muted-foreground">{rental.vehicle.type === 'bike' ? 'Мотоцикл' : 'Автомобиль'}</p></div>
                        </Link>
                    )}
                </div>

                <div className="relative">
                    {stepsConfig.map((step, index) => (
                        <StepCard key={index} title={step.title} icon={step.icon} stepState={stepStates[index]}>
                            {stepStates[index] === 'current' ? step.actionContent : step.content}
                        </StepCard>
                    ))}
                    {currentStep >= 6 && (
                        <StepCard title="Аренда Завершена" icon="::FaThumbsUp::" stepState="completed" content={<p className="text-sm text-brand-green">Эта аренда успешно завершена. Спасибо!</p>} />
                    )}
                </div>
            </div>
        </div>
    );
}