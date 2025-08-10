"use client";

import { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { useAppContext } from "@/contexts/AppContext";
import { getUserRentals } from "./actions";
import type { UserRentalDashboard } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RentalSearchForm } from "./components/RentalSearchForm";
import { Loading } from '@/components/Loading';

// --- 1. Основные компоненты UI ---

const statusConfig = {
  pending_confirmation: { label: "Ожидание", icon: "::FaHourglassHalf::", color: "text-brand-yellow", ring: "ring-brand-yellow/50" },
  active: { label: "Активна", icon: "::FaPlayCircle::", color: "text-brand-green", ring: "ring-brand-green/50" },
  completed: { label: "Завершена", icon: "::FaCircleCheck::", color: "text-muted-foreground", ring: "ring-muted-foreground/30" },
  cancelled: { label: "Отменена", icon: "::FaCircleXmark::", color: "text-destructive", ring: "ring-destructive/40" },
  default: { label: "Неизвестно", icon: "::FaQuestionCircle::", color: "text-muted-foreground", ring: "ring-muted-foreground/30" },
};

const EmptyState = ({ icon, title, description, ctaLink, ctaText }: { icon: string; title: string; description: string; ctaLink?: string; ctaText?: string; }) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center py-12 px-6 bg-card/50 border border-dashed border-border rounded-xl flex flex-col items-center"
    >
        <VibeContentRenderer content={icon} className="text-5xl text-muted-foreground mx-auto mb-4" />
        <h3 className="font-orbitron text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
        {ctaLink && ctaText && (
            <Button asChild className="mt-6">
                <Link href={ctaLink}>
                    <VibeContentRenderer content="::FaArrowRight::" className="mr-2" />
                    {ctaText}
                </Link>
            </Button>
        )}
    </motion.div>
);

const RentalListItem = ({ rental }: { rental: UserRentalDashboard }) => {
    const config = statusConfig[rental.status as keyof typeof statusConfig] || statusConfig.default;
    const roleText = rental.user_role === 'renter' ? 'Вы арендатор' : rental.user_role === 'owner' ? 'Вы владелец' : 'Экипаж';
    const startDate = rental.agreed_start_date || rental.requested_start_date;

    // Анимационные варианты для каждого элемента списка
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
    };

    return (
        <motion.div variants={itemVariants}>
            <Link href={`/rentals/${rental.rental_id}`} className="block group">
                <div
                    className={cn(
                        "bg-card/80 p-4 rounded-xl flex items-start gap-4 border border-border transition-all duration-300",
                        "hover:border-primary hover:bg-card hover:-translate-y-1 hover:shadow-yellow-glow"
                    )}
                >
                    <Image 
                        src={rental.vehicle_image_url || '/placeholder.svg'} 
                        alt={rental.vehicle_model || "Vehicle"} 
                        width={80} height={80} 
                        className="rounded-lg object-cover aspect-square border border-border" 
                    />
                    <div className="flex-grow">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-lg leading-tight">{rental.vehicle_make} {rental.vehicle_model}</p>
                                <p className="text-xs text-muted-foreground font-mono mt-1">{roleText}</p>
                            </div>
                            <div className={cn("hidden sm:flex items-center gap-2 text-sm font-mono whitespace-nowrap py-1 px-2.5 rounded-full ring-1 ring-inset", config.color, config.ring)}>
                                <VibeContentRenderer content={config.icon} />
                                <span className="font-semibold">{config.label}</span>
                            </div>
                        </div>
                        {startDate && (
                            <div className="mt-3 pt-2 border-t border-dashed border-border text-sm text-muted-foreground flex items-center gap-2">
                                <VibeContentRenderer content="::FaCalendar::" />
                                <span>Начало: {formatDate(startDate)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </Link>
        </motion.div>
    );
};


// --- 2. Главный компонент страницы ---

export default function RentalsPage() {
    const { dbUser, isLoading: isAppLoading } = useAppContext();
    const [rentals, setRentals] = useState<UserRentalDashboard[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    useEffect(() => {
        if (isAppLoading) return;
        if (!dbUser) { setIsLoadingData(false); return; }

        const loadRentals = async () => {
            setIsLoadingData(true);
            const result = await getUserRentals(dbUser.user_id);
            if (result.success && result.data) {
                setRentals(result.data as UserRentalDashboard[]);
            } else {
                console.error("Ошибка загрузки аренд:", result.error);
            }
            setIsLoadingData(false);
        };
        loadRentals();
    }, [dbUser, isAppLoading]);
    
    // Анимационные варианты для контейнера списка
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
    };

    if (isAppLoading) {
        return <Loading text="Инициализация приложения..." />;
    }

    if (!dbUser) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center text-center p-4">
                <EmptyState 
                    icon="::FaLock::"
                    title="Доступ ограничен"
                    description="Пожалуйста, войдите в систему, чтобы просмотреть свои аренды."
                />
            </main>
        );
    }

    const asRenter = rentals.filter(r => r.user_role === 'renter');
    const asOwner = rentals.filter(r => r.user_role === 'owner' || r.user_role === 'crew_owner');

    return (
        <main className="min-h-screen bg-background text-foreground p-4 pt-24">
            <div className="fixed inset-0 z-[-1] bg-grid-pattern opacity-50" />
            <div className="fixed inset-0 z-[-2] bg-gradient-to-br from-background via-muted to-background" />
            
            <div className="container mx-auto max-w-3xl">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full bg-card/70 backdrop-blur-xl border border-border rounded-2xl shadow-lg shadow-primary/10 p-6 mb-8"
                >
                    <div className="text-center mb-6">
                        <VibeContentRenderer content="::FaTicket::" className="text-5xl text-primary mx-auto mb-4 text-shadow-brand-yellow" />
                        <h1 className="text-3xl font-orbitron text-foreground">Центр Управления</h1>
                        <p className="text-muted-foreground mt-2 font-mono text-sm">Найдите сделку по ID или просмотрите свои списки.</p>
                    </div>
                    <RentalSearchForm />
                </motion.div>

                {isLoadingData ? (
                    <Loading text="Загрузка ваших аренд..." />
                ) : (
                    <Tabs defaultValue="renter" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="renter"><VibeContentRenderer content="::FaKey::" className="mr-2"/>Мои Аренды</TabsTrigger>
                            <TabsTrigger value="owner"><VibeContentRenderer content="::FaMotorcycle::" className="mr-2"/>Мой Транспорт</TabsTrigger>
                        </TabsList>

                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                            <TabsContent value="renter" className="mt-6">
                                {asRenter.length > 0 ? (
                                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                                        {asRenter.map(r => <RentalListItem key={r.rental_id} rental={r} />)}
                                    </motion.div>
                                ) : (
                                    <EmptyState 
                                        icon="::FaSearchDollar::" 
                                        title="Вы пока ничего не арендовали" 
                                        description="Найдите подходящий транспорт и начните свое приключение."
                                        ctaLink="/vipbikerental"
                                        ctaText="К выбору транспорта"
                                    />
                                )}
                            </TabsContent>
                            <TabsContent value="owner" className="mt-6">
                                {asOwner.length > 0 ? (
                                    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                                        {asOwner.map(r => <RentalListItem key={r.rental_id} rental={r} />)}
                                    </motion.div>
                                ) : (
                                    <EmptyState 
                                        icon="::FaPlusCircle::" 
                                        title="Ваш транспорт еще не сдавался" 
                                        description="Добавьте свой транспорт в систему, чтобы начать зарабатывать."
                                        ctaLink="/account/vehicles/new" // Предполагаемый путь
                                        ctaText="Добавить транспорт"
                                    />
                                )}
                            </TabsContent>
                        </motion.div>
                    </Tabs>
                )}
            </div>
        </main>
    );
}