"use client"

import { useState, useEffect } from 'react';
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

import { useAppContext } from "@/contexts/AppContext";
import { getUserRentals } from "./actions"; // <-- ВАШ ПРАВИЛЬНЫЙ СЕРВЕРНЫЙ ЭКШЕН
import type { UserRentalDashboard } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RentalSearchForm } from "./components/RentalSearchForm";
import { Loading } from '@/components/Loading';

// --- КОНФИГУРАЦИЯ СТАТУСОВ ---
const statusConfig = {
  pending_confirmation: { label: "Ожидание", icon: "::FaHourglassHalf::", color: "text-brand-yellow", ring: "ring-brand-yellow/50" },
  active: { label: "Активна", icon: "::FaPlayCircle::", color: "text-brand-green", ring: "ring-brand-green/50" },
  completed: { label: "Завершена", icon: "::FaCheckCircle::", color: "text-muted-foreground", ring: "ring-muted-foreground/30" },
  cancelled: { label: "Отменена", icon: "::FaCircleXmark::", color: "text-destructive", ring: "ring-destructive/40" },
  default: { label: "Неизвестно", icon: "::FaQuestionCircle::", color: "text-muted-foreground", ring: "ring-muted-foreground/30" },
};

// --- КОМПОНЕНТ ДЛЯ ПУСТОГО СОСТОЯНИЯ ---
const EmptyState = ({ icon, title, description }: { icon: string; title: string; description: string; }) => (
    <div className="text-center py-12 px-6 bg-card/50 border border-dashed border-border rounded-xl">
        <VibeContentRenderer content={icon} className="text-5xl text-muted-foreground mx-auto mb-4" />
        <h3 className="font-orbitron text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
);

// --- ОБНОВЛЕННЫЙ КОМПОНЕНТ КАРТОЧКИ АРЕНДЫ ---
const RentalListItem = ({ rental }: { rental: UserRentalDashboard }) => {
    const config = statusConfig[rental.status as keyof typeof statusConfig] || statusConfig.default;
    const roleText = rental.user_role === 'renter' ? 'Вы арендатор' : rental.user_role === 'owner' ? 'Вы владелец' : 'Экипаж';
    const startDate = rental.agreed_start_date || rental.requested_start_date;

    return (
        <Link href={`/rentals/${rental.rental_id}`} className="block group">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, boxShadow: "var(--shadow-yellow-glow)" }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className={cn(
                    "bg-card/80 p-4 rounded-xl flex items-start gap-4 border border-border transition-all duration-300",
                    "group-hover:border-primary"
                )}
            >
                <Image 
                    src={rental.vehicle_image_url || '/placeholder.svg'} 
                    alt={rental.vehicle_model || "Vehicle"} 
                    width={80} 
                    height={80} 
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
                             <VibeContentRenderer content="::FaCalendarAlt::" />
                             <span>Начало: {formatDate(startDate)}</span>
                        </div>
                    )}
                </div>
            </motion.div>
        </Link>
    );
};

// --- ОСНОВНОЙ КОМПОНЕНТ СТРАНИЦЫ ---
export default function RentalsPage() {
    // 1. Получаем пользователя и статус загрузки из контекста
    const { dbUser, isLoading: isAppLoading } = useAppContext();
    
    // 2. Состояние для данных и для процесса загрузки ИМЕННО ДАННЫХ
    const [rentals, setRentals] = useState<UserRentalDashboard[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // 3. Эффект для загрузки данных, когда пользователь доступен
    useEffect(() => {
        // Если контекст еще грузится, ничего не делаем
        if (isAppLoading) {
            return;
        }
        
        // Если пользователя нет, то и грузить нечего
        if (!dbUser) {
            setIsLoadingData(false);
            return;
        }

        const loadRentals = async () => {
            setIsLoadingData(true);
            // Вызываем серверный экшен, который использует вашу RPC-функцию
            const result = await getUserRentals(dbUser.user_id);
            if (result.success && result.data) {
                setRentals(result.data as UserRentalDashboard[]);
            } else {
                console.error("Ошибка загрузки аренд:", result.error);
            }
            setIsLoadingData(false);
        };

        loadRentals();
    }, [dbUser, isAppLoading]); // Зависимости: dbUser и статус загрузки контекста

    // 4. Обработка состояний отображения
    
    // Пока грузится контекст (первичная загрузка)
    if (isAppLoading) {
        return <Loading text="Инициализация приложения..." />;
    }

    // Если после загрузки пользователя нет
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

    // Основное отображение страницы
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
                        <VibeContentRenderer content="::FaTicketAlt::" className="text-5xl text-primary mx-auto mb-4 text-shadow-brand-yellow" />
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
                            <TabsTrigger value="owner"><VibeContentRenderer content="::FaBike::" className="mr-2"/>Мой Транспорт</TabsTrigger>
                        </TabsList>

                        <TabsContent value="renter" className="mt-6">
                            {asRenter.length > 0 ? (
                                <div className="space-y-4">{asRenter.map(r => <RentalListItem key={r.rental_id} rental={r} />)}</div>
                            ) : (
                                <EmptyState icon="::FaSearchDollar::" title="Вы пока ничего не арендовали" description="Найдите подходящий транспорт и начните свое приключение."/>
                            )}
                        </TabsContent>
                        <TabsContent value="owner" className="mt-6">
                            {asOwner.length > 0 ? (
                                <div className="space-y-4">{asOwner.map(r => <RentalListItem key={r.rental_id} rental={r} />)}</div>
                            ) : (
                                <EmptyState icon="::FaPlusCircle::" title="Ваш транспорт еще не сдавался" description="Добавьте свой транспорт в систему, чтобы начать зарабатывать."/>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </main>
    );
}