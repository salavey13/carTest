"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";

import { useAppContext } from "@/contexts/AppContext";
import { archivePendingRental, getUserRentals } from "./actions";
import type { UserRentalDashboard } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RentalSearchForm } from "./components/RentalSearchForm";
import { Loading } from "@/components/Loading";

const statusConfig = {
  pending_confirmation: { label: "Ожидание", icon: "::FaHourglassHalf::", color: "text-brand-yellow", ring: "ring-brand-yellow/50" },
  confirmed: { label: "Подтверждена", icon: "::FaCheckCircle::", color: "text-brand-cyan", ring: "ring-brand-cyan/50" },
  active: { label: "Активна", icon: "::FaPlayCircle::", color: "text-brand-green", ring: "ring-brand-green/50" },
  completed: { label: "Завершена", icon: "::FaCircleCheck::", color: "text-muted-foreground", ring: "ring-muted-foreground/30" },
  cancelled: { label: "Отменена", icon: "::FaCircleXmark::", color: "text-destructive", ring: "ring-destructive/40" },
  default: { label: "Неизвестно", icon: "::FaQuestionCircle::", color: "text-muted-foreground", ring: "ring-muted-foreground/30" },
};

const EmptyState = ({ icon, title, description, ctaLink, ctaText }: { icon: string; title: string; description: string; ctaLink?: string; ctaText?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-card/45 px-6 py-12 text-center backdrop-blur-sm"
  >
    <VibeContentRenderer content={icon} className="mx-auto mb-4 text-5xl text-muted-foreground" />
    <h3 className="font-orbitron text-lg font-semibold">{title}</h3>
    <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
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

const RentalListItem = ({ rental, canArchive, onArchive }: { rental: UserRentalDashboard; canArchive: boolean; onArchive: (rentalId: string) => void }) => {
  const config = statusConfig[rental.status as keyof typeof statusConfig] || statusConfig.default;
  const roleText = rental.user_role === "renter" ? "Вы арендатор" : rental.user_role === "owner" ? "Вы владелец" : "Экипаж";
  const startDate = rental.agreed_start_date || rental.requested_start_date;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="group rounded-2xl border border-border/70 bg-card/55 p-4 backdrop-blur-sm transition-all duration-300 hover:border-primary/55 hover:bg-card/70">
        <div className="flex items-start gap-4">
          <Link href={`/rentals/${rental.rental_id}`} className="block">
            <Image
              src={rental.vehicle_image_url || "/placeholder.svg"}
              alt={rental.vehicle_model || "Vehicle"}
              width={84}
              height={84}
              className="aspect-square rounded-lg border border-border/80 object-cover"
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={`/rentals/${rental.rental_id}`}>
                  <p className="text-lg font-bold leading-tight hover:text-primary">{rental.vehicle_make} {rental.vehicle_model}</p>
                </Link>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{roleText}</p>
              </div>
              <div className={cn("hidden items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-mono ring-1 ring-inset sm:flex", config.color, config.ring)}>
                <VibeContentRenderer content={config.icon} />
                <span className="font-semibold">{config.label}</span>
              </div>
            </div>
            {startDate && (
              <div className="mt-3 flex items-center gap-2 border-t border-dashed border-border pt-2 text-sm text-muted-foreground">
                <VibeContentRenderer content="::FaCalendar::" />
                <span>Начало: {formatDate(startDate)}</span>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/rentals/${rental.rental_id}`}>Открыть сделку</Link>
              </Button>
              {canArchive && (
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onArchive(rental.rental_id)}>
                  <VibeContentRenderer content="::FaBoxArchive::" className="mr-2" /> Архивировать тест
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Metric = ({ title, value, icon }: { title: string; value: string | number; icon: string }) => (
  <div className="rounded-2xl border border-border/70 bg-card/50 p-4 backdrop-blur-sm">
    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
      <VibeContentRenderer content={icon} className="text-primary" />
      {title}
    </div>
    <p className="font-orbitron text-2xl">{value}</p>
  </div>
);

export default function RentalsPage() {
  const { dbUser, isLoading: isAppLoading } = useAppContext();
  const [rentals, setRentals] = useState<UserRentalDashboard[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const loadRentals = async (userId: string) => {
    setIsLoadingData(true);
    const result = await getUserRentals(userId);
    if (result.success && result.data) {
      setRentals(result.data as UserRentalDashboard[]);
    } else {
      console.error("Ошибка загрузки аренд:", result.error);
    }
    setIsLoadingData(false);
  };

  useEffect(() => {
    if (isAppLoading) return;
    if (!dbUser) {
      setIsLoadingData(false);
      return;
    }
    loadRentals(dbUser.user_id);
  }, [dbUser, isAppLoading]);

  const handleArchive = async (rentalId: string) => {
    if (!dbUser?.user_id) return;
    const t = toast.loading("Архивируем тестовую аренду...");
    const result = await archivePendingRental(rentalId, dbUser.user_id);
    if (!result.success) {
      toast.error(result.error || "Не удалось архивировать аренду.", { id: t });
      return;
    }
    toast.success("Тестовая аренда отправлена в архив.", { id: t });
    await loadRentals(dbUser.user_id);
  };

  if (isAppLoading) return <Loading text="Инициализация приложения..." />;

  if (!dbUser) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <EmptyState icon="::FaLock::" title="Доступ ограничен" description="Пожалуйста, войдите в систему, чтобы просмотреть свои аренды." />
      </main>
    );
  }

  const asRenter = rentals.filter((r) => r.user_role === "renter");
  const asOwner = rentals.filter((r) => r.user_role === "owner" || r.user_role === "crew_owner");
  const activeCount = rentals.filter((r) => r.status === "active").length;
  const pendingCount = rentals.filter((r) => r.status === "pending_confirmation" || r.status === "confirmed").length;
  const archiveCandidates = rentals.filter((r) => ["pending_confirmation", "confirmed"].includes(r.status) && r.payment_status === "pending").length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 pb-14 pt-24 text-foreground">
      <div className="pointer-events-none fixed inset-0 z-[-2] bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.16),transparent_40%),radial-gradient(circle_at_95%_20%,rgba(76,88,255,0.16),transparent_42%)]" />
      <div className="pointer-events-none fixed inset-0 z-[-3] opacity-20 dark:opacity-25">
        <Image
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/21a9e79f-ab43-41dd-9603-4586fabed2cb-158b7f8c-86c6-42c8-8903-563ffcd61213.jpg"
          alt="Rentals BG"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-background/80" />
      </div>

      <div className="container mx-auto max-w-5xl space-y-6">
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border/70 bg-card/50 p-6 backdrop-blur-xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs text-white/90">
            <VibeContentRenderer content="::FaTicket::" className="text-brand-yellow" />
            RENTALS CONTROL CENTER
          </div>
          <h1 className="font-orbitron text-3xl sm:text-4xl">Центр управления арендами</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Управляйте текущими сделками, проверяйте статусы и открывайте карточку аренды для пошагового сценария с фото ДО/ПОСЛЕ.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Metric title="Всего сделок" value={rentals.length} icon="::FaListCheck::" />
            <Metric title="Активные" value={activeCount} icon="::FaPlayCircle::" />
            <Metric title="Ожидают действий" value={pendingCount} icon="::FaHourglassHalf::" />
            <Metric title="К архиву" value={archiveCandidates} icon="::FaBoxArchive::" />
          </div>

          <div className="mt-5 rounded-xl border border-border/70 bg-card/40 p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Быстрый поиск по ID</p>
            <RentalSearchForm />
          </div>
        </motion.div>

        {isLoadingData ? (
          <Loading text="Загрузка ваших аренд..." />
        ) : (
          <Tabs defaultValue="renter" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl border border-border/70 bg-card/55">
              <TabsTrigger value="renter">
                <VibeContentRenderer content="::FaKey::" className="mr-2" />Мои аренды
              </TabsTrigger>
              <TabsTrigger value="owner">
                <VibeContentRenderer content="::FaMotorcycle::" className="mr-2" />Мой транспорт
              </TabsTrigger>
            </TabsList>

            <TabsContent value="renter" className="mt-6">
              {asRenter.length > 0 ? (
                <div className="space-y-4">
                  {asRenter.map((r) => (
                    <RentalListItem
                      key={r.rental_id}
                      rental={r}
                      canArchive={["pending_confirmation", "confirmed"].includes(r.status) && r.payment_status === "pending"}
                      onArchive={handleArchive}
                    />
                  ))}
                </div>
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
                <div className="space-y-4">
                  {asOwner.map((r) => (
                    <RentalListItem
                      key={r.rental_id}
                      rental={r}
                      canArchive={["pending_confirmation", "confirmed"].includes(r.status) && r.payment_status === "pending"}
                      onArchive={handleArchive}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon="::FaPlusCircle::"
                  title="Ваш транспорт еще не сдавался"
                  description="Добавьте свой транспорт в систему, чтобы начать зарабатывать."
                  ctaLink="/admin"
                  ctaText="В Vibe Control Center"
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
