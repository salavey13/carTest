"use client";

import { getRentalDetails, addRentalPhoto, confirmVehiclePickup, confirmVehicleReturn } from '@/app/rentals/actions';
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
        eventLog?: {
            timestamp: string;
            actor: string;
            event: string;
            details?: Record<string, any>;
        }[];
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
            <Input id="photo-upload" type="file" accept="image/*" onChange={handleFileChange} className="input-cyber" />
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
    
    let currentStep = 1;

    // Step 1: Payment
    if (rental.payment_status === 'fully_paid' || rental.payment_status === 'interest_paid') {
        states[0] = 'completed';
        currentStep = 2;
    } else {
        states[0] = 'current';
        return [1, states];
    }

    // Step 2: Start Photo (Optional, can be skipped)
    if (rental.start_photo_url) {
        states[1] = 'completed';
    } else if (rental.pickup_confirmed_at) {
        states[1] = 'skipped';
    }

    // Step 3: Pickup Confirmation
    if (rental.pickup_confirmed_at) {
        states[2] = 'completed';
        currentStep = 4;
    } else if (states[0] === 'completed') { // Unlocks after payment
        if (states[1] === 'locked') states[1] = 'current';
        if (states[1] === 'completed' || states[1] === 'skipped') states[2] = 'current';
        return [states[2] === 'current' ? 3 : 2, states];
    }

    // Step 4: End Photo (Optional, can be skipped)
    if (rental.end_photo_url) {
        states[3] = 'completed';
    } else if (rental.return_confirmed_at) {
        states[3] = 'skipped';
    }

    // Step 5: Return Confirmation
    if (rental.return_confirmed_at) {
        states[4] = 'completed';
        currentStep = 6;
    } else if (states[2] === 'completed') { // Unlocks after pickup
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
        if (res.success && res.data) setRental(res.data as Rental);
        else setError(res.error || "Failed to refresh data.");
    }, [params.id, dbUser]);

    useEffect(() => {
        if (isAppLoading) return;
        if (!dbUser?.user_id) { setLoading(false); setError("Пользователь не авторизован."); return; }
        const fetchData = async () => {
            setLoading(true);
            const res = await getRentalDetails(params.id, dbUser.user_id);
            if (res.success && res.data) setRental(res.data as Rental);
            else setError(res.error || "Аренда не найдена или у вас нет доступа.");
            setLoading(false);
        };
        fetchData();
    }, [params.id, dbUser, isAppLoading, refreshRentalData]);
    
    const [, stepStates] = useMemo(() => getRentalStepStates(rental), [rental]);
    const userRole: UserRole = useMemo(() => rental?.user_id === dbUser?.user_id ? 'renter' : rental?.owner_id === dbUser?.user_id ? 'owner' : 'other', [rental, dbUser]);
    
    const handleAction = async (action: () => Promise<any>, successMessage: string) => {
        const promise = action();
        toast.promise(promise, {
            loading: 'Выполняется...',
            success: (data) => {
                if(data.success) { refreshRentalData(); return successMessage; } 
                else { throw new Error(data.error || "Произошла ошибка"); }
            },
            error: (err) => err.message,
        });
    };
    
    const handlePhotoUpload = (photoUrl: string, photoType: 'start' | 'end') => {
        if (!dbUser?.user_id) return;
        handleAction(() => addRentalPhoto(params.id, dbUser.user_id, photoUrl, photoType), `Фото '${photoType === 'start' ? "ДО" : "ПОСЛЕ"}' успешно добавлено!`);
    };

    if (loading) return <Loading text="Загрузка деталей аренды..." />;
    if (error) return <div className="text-center p-8 text-destructive">{error}</div>;
    if (!rental) return <div className="text-center p-8 text-muted-foreground">Аренда не найдена.</div>;

    const eventLog = rental.metadata?.eventLog || [];
    const stepsConfig = [
        { title: "Оплата", icon: "::FaFileInvoiceDollar::", content: <p className="text-sm">Оплачено <VibeContentRenderer content="::FaCheck::" /></p>, actionContent: <p className="text-sm text-brand-yellow">Проверьте уведомления в боте для оплаты.</p> },
        { title: "Фото 'ДО'", icon: "::FaCameraRetro::", content: rental.start_photo_url ? <Image src={rental.start_photo_url} alt="Start" width={150} height={150} className="rounded-lg"/> : <p className="text-sm">Шаг пропущен.</p>, actionContent: userRole === 'renter' ? <PhotoUploader onUploadConfirmed={(url) => handlePhotoUpload(url, 'start')} /> : <p className="text-sm">Ожидаем фото от арендатора...</p> },
        { title: "Подтверждение Получения", icon: "::FaHandshake::", content: <p className="text-sm">Получено</p>, actionContent: userRole === 'owner' ? <Button onClick={() => handleAction(() => confirmVehiclePickup(params.id, dbUser!.user_id), "Получение подтверждено!")}>::FaCheckCircle:: Подтвердить</Button> : <p className="text-sm">Ожидаем подтверждения от владельца...</p> },
        { title: "Фото 'ПОСЛЕ'", icon: "::FaCamera::", content: rental.end_photo_url ? <Image src={rental.end_photo_url} alt="End" width={150} height={150} className="rounded-lg"/> : <p className="text-sm">Шаг пропущен.</p>, actionContent: userRole === 'renter' ? <PhotoUploader onUploadConfirmed={(url) => handlePhotoUpload(url, 'end')} /> : <p className="text-sm">Ожидаем фото от арендатора.</p> },
        { title: "Подтверждение Возврата", icon: "::FaFlagCheckered::", content: <p className="text-sm">Возвращено</p>, actionContent: userRole === 'owner' ? <Button onClick={() => handleAction(() => confirmVehicleReturn(params.id, dbUser!.user_id), "Возврат подтвержден!")}>::FaCheckDouble:: Подтвердить</Button> : <p className="text-sm">Ожидаем подтверждения от владельца.</p> },
    ];
    
    return (
        <div className="min-h-screen bg-background text-foreground p-4 pt-24"><div className="fixed inset-0 z-[-1] opacity-20"><Image src={rental.vehicle?.image_url || "/placeholder.svg"} alt="BG" fill className="object-cover animate-pan-zoom" /><div className="absolute inset-0 bg-background/70 backdrop-blur-sm"></div></div>
            <div className="container mx-auto max-w-2xl relative z-10">
                <div className="bg-card/70 backdrop-blur-xl border border-border p-6 rounded-2xl mb-8">
                     <h1 className="text-3xl font-orbitron text-brand-cyan mb-2">Путь Арендатора</h1>
                    <p className="text-sm font-mono text-muted-foreground mb-6">ID: {rental.rental_id}</p>
                    {rental.vehicle && (<Link href={`/rent/${rental.vehicle.id}`} className="flex items-center gap-4 bg-card/50 p-3 rounded-lg hover:bg-card/80 transition-colors"><Image src={rental.vehicle.image_url || '/placeholder.svg'} alt={rental.vehicle.model || 'V'} width={80} height={80} className="rounded-lg object-cover aspect-square" /><div><p className="font-bold text-xl">{rental.vehicle.make} {rental.vehicle.model}</p><p className="text-muted-foreground">{rental.vehicle.type === 'bike' ? 'Мотоцикл' : 'Автомобиль'}</p></div></Link>)}
                </div>
                <div className="relative">
                    {stepsConfig.map((step, index) => (
                        <StepCard key={index} title={step.title} icon={step.icon} stepState={stepStates[index]}>
                            {stepStates[index] === 'current' ? step.actionContent : (
                                <div className="text-sm space-y-2 text-muted-foreground">
                                    {stepStates[index] === 'skipped' ? <p>Шаг пропущен</p> : step.content}
                                    {eventLog.filter(e => e.event.toLowerCase().includes(step.title.toLowerCase().split("'")[0])).map(log => (
                                        <p key={log.timestamp} className="text-xs font-mono">
                                            - {new Date(log.timestamp).toLocaleString()}: {log.event} by {log.actor === rental.user_id ? "Арендатор" : "Владелец"}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </StepCard>
                    ))}
                    {stepStates[4] === 'completed' && (<StepCard title="Аренда Завершена" icon="::FaThumbsUp::" stepState="completed" content={<p className="text-sm text-brand-green">Эта аренда успешно завершена!</p>} />)}
                </div>
            </div>
        </div>
    );
}