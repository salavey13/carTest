"use client";

import { getRentalDetails, addRentalPhoto, confirmVehiclePickup, confirmVehicleReturn, initiateTelegramRentalPhotoUpload } from '@/app/rentals/actions';
import { Loading } from '@/components/Loading';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppContext } from '@/contexts/AppContext';
import { Database } from '@/types/database.types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { uploadSingleImage } from '@/app/rentals/actions';

type Rental = Database['public']['Tables']['rentals']['Row'] & {
    vehicle: Database['public']['Tables']['cars']['Row'] | null;
    renter: Database['public']['Tables']['users']['Row'] | null;
    owner: Database['public']['Tables']['users']['Row'] | null;
    metadata: {
        start_photo_url?: string;
        end_photo_url?: string;
        pickup_confirmed_at?: string; // Ожидаем эти поля в метаданных
        return_confirmed_at?: string; // Ожидаем эти поля в метаданных
        eventLog?: {
            timestamp: string;
            actor: string;
            event: string;
            details?: Record<string, any>;
        }[];
        [key: string]: any;
    } | null;
};

type UserRole = 'renter' | 'owner' | 'other';
type StepState = 'completed' | 'current' | 'locked' | 'skipped';

const PhotoUploader = ({ onUploadConfirmed }: { onUploadConfirmed: (url: string) => void }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) setFile(selectedFile);
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);

        const formData = new FormData();
        formData.append("bucketName", "rentals");
        formData.append("file", file);

        const toastId = toast.loading(`Загрузка ${file.name}...`);
        
        try {
            const result = await uploadSingleImage(formData);
            if (result.success && result.url) {
                toast.success("Файл успешно загружен!", { id: toastId });
                onUploadConfirmed(result.url);
            } else {
                throw new Error(result.error || "Не удалось загрузить файл.");
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Ошибка загрузки.", { id: toastId });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-3">
            <Input 
                id="photo-upload" 
                type="file" 
                accept="image/*" 
                capture="environment" 
                onChange={handleFileChange} 
                className="input-cyber" 
            />
            <Button onClick={handleUpload} disabled={!file || isUploading} className="w-full">
                {isUploading ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> : <VibeContentRenderer content="::FaUpload::" />}
                Подтвердить
            </Button>
        </div>
    );
};

const getRentalStepStates = (rental: Rental | null): [number, StepState[]] => {
    const states: StepState[] = Array(5).fill('locked');
    if (!rental) return [0, states];
    
    // --- ИСПРАВЛЕНИЕ ЗДЕСЬ: Читаем все из metadata ---
    const metadata = (rental.metadata as Record<string, any>) || {};
    const startPhotoUrl = metadata.start_photo_url;
    const endPhotoUrl = metadata.end_photo_url;
    const pickupConfirmedAt = metadata.pickup_confirmed_at;
    const returnConfirmedAt = metadata.return_confirmed_at;

    let currentStep = 1;

    if (rental.payment_status === 'fully_paid' || rental.payment_status === 'interest_paid') {
        states[0] = 'completed';
        currentStep = 2;
    } else {
        states[0] = 'current';
        return [1, states];
    }

    if (startPhotoUrl) {
        states[1] = 'completed';
    } else if (pickupConfirmedAt) {
        states[1] = 'skipped';
    }

    if (pickupConfirmedAt) {
        states[2] = 'completed';
        currentStep = 4;
    } else if (states[0] === 'completed') {
        if (states[1] === 'locked') states[1] = 'current';
        if (states[1] === 'completed' || states[1] === 'skipped') states[2] = 'current';
        return [states[2] === 'current' ? 3 : 2, states];
    }

    if (endPhotoUrl) {
        states[3] = 'completed';
    } else if (returnConfirmedAt) {
        states[3] = 'skipped';
    }

    if (returnConfirmedAt) {
        states[4] = 'completed';
        currentStep = 6;
    } else if (states[2] === 'completed') {
        if (states[3] === 'locked') states[3] = 'current';
        if (states[3] === 'completed' || states[3] === 'skipped') states[4] = 'current';
        return [states[4] === 'current' ? 5 : 4, states];
    }

    return [currentStep, states];
};

const StepCard = ({ title, icon, stepState, children, content }: { title: string; icon: string; stepState: StepState; children?: React.ReactNode; content?: React.ReactNode; }) => (
    <div className="flex gap-4">
        <div className="flex flex-col items-center">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all",
                stepState === 'completed' && "bg-brand-green/10 border-brand-green/30 text-brand-green",
                stepState === 'current' && "bg-brand-cyan/20 border-brand-cyan text-brand-cyan shadow-lg shadow-brand-cyan/30 animate-pulse",
                stepState === 'locked' && "bg-muted/10 border-border/50 text-muted-foreground",
                stepState === 'skipped' && "bg-muted/20 border-dashed border-border text-muted-foreground"
            )}>
                <VibeContentRenderer content={icon} className="text-2xl" />
            </div>
            <div className={cn("w-0.5 grow mt-2", stepState === 'completed' ? "bg-brand-green/50" : "bg-border/50")}></div>
        </div>
        <div className="flex-1 pb-10">
            <h3 className={cn("font-orbitron text-xl pt-3 transition-colors", stepState === 'locked' ? "text-muted-foreground opacity-70" : "text-foreground")}>{title}</h3>
            <AnimatePresence>
            {(stepState !== 'locked') && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className={cn("border p-4 rounded-lg mt-2 transition-all",
                            stepState === 'current' ? "bg-card/80 border-brand-cyan/50" : "bg-card/50 border-border/70 opacity-80"
                        )}
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
        if (!dbUser?.user_id) { setLoading(false); setError("Пользователь не авторизован."); return; }
        
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
    
    const [currentStep, stepStates] = useMemo(() => getRentalStepStates(rental), [rental]);
    const userRole: UserRole = useMemo(() => {
        if (!dbUser || !rental) return 'other';
        if (rental.user_id === dbUser.user_id) return 'renter';
        if (rental.owner_id === dbUser.user_id) return 'owner';
        return 'other';
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
    
    const handlePhotoUpload = (photoUrl: string, photoType: 'start' | 'end') => {
        if (!dbUser?.user_id) return;
        handleAction(() => addRentalPhoto(params.id, dbUser!.user_id, photoUrl, photoType), `Фото '${photoType === 'start' ? "ДО" : "ПОСЛЕ"}' успешно добавлено!`);
    };

    const startTelegramPhotoMode = async (photoType: 'start' | 'end') => {
        if (!dbUser?.user_id) return;
        const toastId = toast.loading('Подготавливаем режим Telegram...');
        const result = await initiateTelegramRentalPhotoUpload(params.id, dbUser.user_id, photoType);

        if (!result.success) {
            toast.error(result.error || 'Не удалось открыть Telegram-режим.', { id: toastId });
            return;
        }

        toast.success(`Готово. Отправьте фото '${photoType === 'start' ? 'ДО' : 'ПОСЛЕ'}' в бота за 15 минут.`, { id: toastId });

        if (result.deepLink && typeof window !== 'undefined') {
            window.open(result.deepLink, '_blank');
        }
    };

    if (loading) return <Loading text="Загрузка деталей аренды..." />;
    if (error) return <div className="text-center p-8 text-destructive">{error}</div>;
    if (!rental) return <div className="text-center p-8 text-muted-foreground">Аренда не найдена.</div>;

    const metadata = (rental.metadata as Record<string, any>) || {};
    const startPhotoUrl = metadata.start_photo_url;
    const endPhotoUrl = metadata.end_photo_url;

    const stepsConfig = [
        {
            title: "Оплата",
            icon: "::FaFileInvoiceDollar::",
            content: <p className="text-sm">Оплачено <VibeContentRenderer content="::FaCheck::" /></p>,
            actionContent: <p className="text-sm text-brand-yellow">Проверьте уведомления в боте для оплаты.</p>
        },
        {
            title: "Фото 'ДО'",
            icon: "::FaCameraRetro::",
            content: startPhotoUrl ? <Image src={startPhotoUrl} alt="Start" width={150} height={150} className="rounded-lg"/> : <p className="text-sm">Фото пока не загружено.</p>,
            actionContent: userRole === 'renter' ? (
                <div className="space-y-3">
                    <PhotoUploader onUploadConfirmed={(url) => handlePhotoUpload(url, 'start')} />
                    <Button variant="outline" className="w-full" onClick={() => startTelegramPhotoMode('start')}>
                        <VibeContentRenderer content="::FaTelegram::" className="mr-2" /> Отправить через Telegram-бота
                    </Button>
                </div>
            ) : <p className="text-sm">Ожидаем фото от арендатора...</p>
        },
        {
            title: "Подтверждение Получения",
            icon: "::FaHandshake::",
            content: <p className="text-sm">Получено</p>,
            actionContent: userRole === 'owner'
                ? <Button onClick={() => handleAction(() => confirmVehiclePickup(params.id, dbUser!.user_id), "Получение подтверждено!")}><VibeContentRenderer content="::FaCheckCircle::" className="mr-2"/>Подтвердить</Button>
                : <p className="text-sm">Ожидаем подтверждения от владельца...</p>
        },
        {
            title: "Фото 'ПОСЛЕ'",
            icon: "::FaCamera::",
            content: endPhotoUrl ? <Image src={endPhotoUrl} alt="End" width={150} height={150} className="rounded-lg"/> : <p className="text-sm">Фото пока не загружено.</p>,
            actionContent: userRole === 'renter' ? (
                <div className="space-y-3">
                    <PhotoUploader onUploadConfirmed={(url) => handlePhotoUpload(url, 'end')} />
                    <Button variant="outline" className="w-full" onClick={() => startTelegramPhotoMode('end')}>
                        <VibeContentRenderer content="::FaTelegram::" className="mr-2" /> Отправить через Telegram-бота
                    </Button>
                </div>
            ) : <p className="text-sm">Ожидаем фото от арендатора.</p>
        },
        {
            title: "Подтверждение Возврата",
            icon: "::FaFlagCheckered::",
            content: <p className="text-sm">Возвращено</p>,
            actionContent: userRole === 'owner'
                ? <Button onClick={() => handleAction(() => confirmVehicleReturn(params.id, dbUser!.user_id), "Возврат подтвержден!")}><VibeContentRenderer content="::FaCheckDouble::" className="mr-2"/>Подтвердить</Button>
                : <p className="text-sm">Ожидаем подтверждения от владельца.</p>
        },
    ];

    return (
        <div className="relative min-h-screen overflow-hidden bg-background px-4 pb-12 pt-24 text-foreground dark">
            <div className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.16),transparent_40%),radial-gradient(circle_at_95%_20%,rgba(74,89,255,0.16),transparent_42%)]" />
            <div className="fixed inset-0 z-[-3] opacity-20">
                <Image src={rental.vehicle?.image_url || "/placeholder.svg"} alt="BG" fill className="object-cover" />
                <div className="absolute inset-0 bg-background/75 backdrop-blur-sm" />
            </div>
            <div className="container relative z-10 mx-auto max-w-3xl">
                <div className="mb-8 rounded-3xl border border-border/70 bg-card/55 p-6 backdrop-blur-xl">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs text-white/90">
                        <VibeContentRenderer content="::FaRoute::" className="text-primary" /> RENTAL EXECUTION FLOW
                    </div>
                    <h1 className="mb-2 font-orbitron text-3xl">Путь аренды</h1>
                    <p className="mb-6 text-sm font-mono text-muted-foreground">ID: {rental.rental_id}</p>
                    {rental.vehicle && (
                        <Link href={`/rent/${rental.vehicle.id}`} className="flex items-center gap-4 rounded-xl border border-border/60 bg-card/60 p-3 transition-colors hover:bg-card/80">
                            <Image src={rental.vehicle.image_url || '/placeholder.svg'} alt={rental.vehicle.model || 'V'} width={80} height={80} className="aspect-square rounded-lg object-cover" />
                            <div>
                                <p className="text-xl font-bold">{rental.vehicle.make} {rental.vehicle.model}</p>
                                <p className="text-muted-foreground">{rental.vehicle.type === 'bike' ? 'Мотоцикл' : 'Автомобиль'}</p>
                            </div>
                        </Link>
                    )}
                </div>
                <div className="relative rounded-3xl border border-border/70 bg-card/45 p-5 backdrop-blur-sm">
                    {stepsConfig.map((step, index) => (
                        <StepCard key={index} title={step.title} icon={step.icon} stepState={stepStates[index]} content={stepsConfig[index].content}>
                            {stepStates[index] === 'current' && stepsConfig[index].actionContent}
                        </StepCard>
                    ))}
                    {stepStates[4] === 'completed' && (<StepCard title="Аренда Завершена" icon="::FaThumbsUp::" stepState="completed" content={<p className="text-sm text-brand-green">Эта аренда успешно завершена!</p>} />)}
                </div>
            </div>
        </div>
    );
}