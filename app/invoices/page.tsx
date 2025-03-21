// /app/invoices/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getUserInvoices, getUserRentals } from "@/hooks/supabase";
import { supabaseAdmin } from "@/hooks/supabase";
import { Trophy, Car, CreditCard, Crown } from "lucide-react";

interface Invoice { id: string; type: string; status: string; amount: number; metadata: { car_make?: string; car_model?: string; days?: number; subscription_id?: string }; }
interface Rental { rental_id: string; car_id: string; user_id: string; status: string; payment_status: string; total_cost: number; start_date: string; end_date: string; car_make?: string; car_model?: string; }
interface TopFleet { owner_id: string; owner_name: string; total_revenue: number; car_count: number; }

export default function GloryHall() {
  const { dbUser, isAdmin } = useAppContext();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [topFleets, setTopFleets] = useState<TopFleet[]>([]);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const [isFleetsLoading, setIsFleetsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!dbUser) {
        toast.error("Нет юзера в Telegram, пиздец!");
        setIsUserDataLoading(false);
        return;
      }

      toast.info(`Чекаю данные для юзера ${dbUser.user_id}...`);
      try {
        const [invoicesRes, rentalsRes] = await Promise.all([
          getUserInvoices(dbUser.user_id),
          getUserRentals(dbUser.user_id),
        ]);

        if (invoicesRes.error) {
          toast.error(`Ошибка счетов: ${invoicesRes.error.message || "Хз что сломалось!"}`);
        } else {
          const invoiceData = invoicesRes.data || [];
          setInvoices(invoiceData);
          toast.success(`Счета загружены: ${invoiceData.length} штук`);
        }

        if (rentalsRes.error) {
          toast.error(`Ошибка аренд: ${rentalsRes.error.message || "Аренды не хотят грузиться!"}`);
        } else {
          const rentalData = rentalsRes.data || [];
          setRentals(rentalData);
          toast.success(`Аренды загружены: ${rentalData.length} штук`);
        }

        if (!invoicesRes.error && !rentalsRes.error) {
          toast.success("Всё железо загружено, командир!");
        }
      } catch (error) {
        toast.error(`Критический сбой: ${error instanceof Error ? error.message : "Чёрт знает что!"}`);
      } finally {
        setIsUserDataLoading(false);
      }
    };

    const fetchTopFleets = async () => {
      toast.info("Чекаю топ-флоты для админа...");
      try {
        const { data, error } = await supabaseAdmin.rpc("get_top_fleets");
        if (error) {
          toast.error(`Ошибка топ-флотов: ${error.message || "Топ-флоты сломались!"}`);
        } else {
          const fleetData = data || [];
          setTopFleets(fleetData);
          toast.success(`Топ-флоты загружены: ${fleetData.length} экипажей`);
        }
      } catch (error) {
        toast.error(`Крах топ-флотов: ${error instanceof Error ? error.message : "Неизвестная хрень!"}`);
      } finally {
        setIsFleetsLoading(false);
      }
    };

    toast.info("Запускаю загрузку данных...");
    fetchUserData();
    if (isAdmin()) fetchTopFleets(); else toast.info("Ты не админ, топ-флоты мимо!");
  }, [dbUser, isAdmin]);

  if (isUserDataLoading) {
    return (
      <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-primary border-muted rounded-full shadow-[0_0_15px_rgba(255,107,107,0.8)]"
        />
        <span className="ml-4 text-2xl text-secondary font-mono animate-pulse">Чекаю...</span>
      </div>
    );
  }

  if (!invoices.length && !rentals.length && (!topFleets.length || !isAdmin())) {
    return (
      <div className="min-h-screen pt-24 bg-background bg-grid-pattern">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl text-destructive font-mono text-center pt-20 animate-[neon_2s_infinite]"
        >
          В ожидании первого триумфа, братан!
        </motion.p>
      </div>
    );
  }

  const pendingItems = [...invoices.filter((inv) => inv.status === "pending"), ...rentals.filter((r) => r.payment_status === "pending")];
  const completedItems = [...invoices.filter((inv) => inv.status === "paid"), ...rentals.filter((r) => r.payment_status === "paid")];

  return (
    <div className="min-h-screen pt-24 bg-background bg-grid-pattern animate-[drift_30s_infinite]">
      <header className="fixed top-0 left-0 right-0 bg-card shadow-md p-6 z-10 border-b border-muted">
        <h1 className="text-4xl font-bold text-gradient cyber-text glitch" data-text="ЗАЛ СЛАВЫ">
          ЗАЛ СЛАВЫ
        </h1>
      </header>
      <main className="container mx-auto pt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-5xl mx-auto p-8 bg-card rounded-2xl shadow-[0_0_20px_rgba(255,107,107,0.3)] border border-muted"
        >
          {isAdmin() && (
            <div className="mb-12 bg-popover p-6 rounded-xl shadow-inner border border-muted">
              <h2 className="text-3xl font-semibold text-accent mb-6 cyber-text glitch flex items-center gap-2" data-text="ТОП ФЛОТОВ">
                <Crown className="h-6 w-6 animate-spin-slow" /> ТОП ФЛОТОВ
              </h2>
              {isFleetsLoading ? (
                <p className="text-accent font-mono text-center animate-pulse">Гружу топ-флоты...</p>
              ) : topFleets.length === 0 ? (
                <p className="text-accent font-mono text-center">Флоты ещё не прославились!</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {topFleets.map((fleet, i) => (
                    <motion.div
                      key={fleet.owner_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-card p-4 rounded-lg border border-accent hover:shadow-[0_0_25px_rgba(255,215,0,0.5)] transition-all"
                    >
                      <h3 className="text-accent font-mono text-lg flex items-center gap-2">
                        #{i + 1} {fleet.owner_name}
                      </h3>
                      <p className="text-muted-foreground font-mono">Доход: {fleet.total_revenue} XTR</p>
                      <p className="text-muted-foreground font-mono">Флот: {fleet.car_count} машин</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {pendingItems.length > 0 && (
            <div className="mb-12">
              <h2 className="text-3xl font-semibold text-destructive mb-6 cyber-text glitch" data-text="ОЖИДАЮТ ОПЛАТЫ">
                ОЖИДАЮТ ОПЛАТЫ
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {pendingItems.map((item) => (
                  <motion.div
                    key={"rental_id" in item ? item.rental_id : item.id}
                    whileHover={{ scale: 1.03 }}
                    className="bg-card p-4 rounded-lg border border-destructive shadow-[0_0_15px_rgba(255,107,107,0.3)] hover:shadow-[0_0_25px_rgba(255,107,107,0.5)] transition-all"
                  >
                    <h3 className="text-destructive font-mono flex items-center gap-2">
                      {"type" in item ? <CreditCard className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                      {"type" in item ? (item.type === "subscription" ? "Подписка" : "Аренда") : "Аренда"}
                    </h3>
                    <p className="text-muted-foreground font-mono">Сумма: {"amount" in item ? item.amount : item.total_cost} XTR</p>
                    <p className="text-muted-foreground font-mono text-sm">
                      Детали: {"type" in item ? (item.type === "car_rental" ? `${item.metadata.car_make} ${item.metadata.car_model} на ${item.metadata.days} дней` : `Подписка #${item.metadata.subscription_id}`) : `${item.car_make} ${item.car_model} (${new Date(item.start_date).toLocaleDateString()} - ${new Date(item.end_date).toLocaleDateString()})`}
                    </p>
                    <span className="inline-block mt-2 bg-destructive text-destructive-foreground px-2 py-1 rounded font-mono text-sm">Ожидает</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {completedItems.length > 0 && (
            <div className="bg-popover p-6 rounded-xl shadow-inner border border-muted">
              <h2 className="text-3xl font-semibold text-primary mb-6 cyber-text glitch flex items-center gap-2" data-text="ЗАВОЁВАННЫЕ СЛАВЫ">
                <Trophy className="h-6 w-6 animate-bounce" /> ЗАВОЁВАННЫЕ СЛАВЫ
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {completedItems.map((item) => (
                  <motion.div
                    key={"rental_id" in item ? item.rental_id : item.id}
                    whileHover={{ scale: 1.03 }}
                    className="bg-card p-4 rounded-lg border border-primary shadow-[0_0_15px_rgba(0,255,157,0.3)] hover:shadow-[0_0_25px_rgba(0,255,157,0.5)] transition-all"
                  >
                    <h3 className="text-primary font-mono flex items-center gap-2">
                      {"type" in item ? <CreditCard className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                      {"type" in item ? (item.type === "subscription" ? "Подписка" : "Аренда") : "Аренда"}
                    </h3>
                    <p className="text-muted-foreground font-mono">Сумма: {"amount" in item ? item.amount : item.total_cost} XTR</p>
                    <p className="text-muted-foreground font-mono text-sm">
                      Детали: {"type" in item ? (item.type === "car_rental" ? `${item.metadata.car_make} ${item.metadata.car_model} на ${item.metadata.days} дней` : `Подписка #${item.metadata.subscription_id}`) : `${item.car_make} ${item.car_model} (${new Date(item.start_date).toLocaleDateString()} - ${new Date(item.end_date).toLocaleDateString()})`}
                    </p>
                    <span className="inline-block mt-2 bg-primary text-primary-foreground px-2 py-1 rounded font-mono text-sm">Оплачено</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

