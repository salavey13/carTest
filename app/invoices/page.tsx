// app/invoices/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { getUserInvoices, getUserRentals } from "@/hooks/supabase";
import { supabaseAdmin } from "@/hooks/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Car, CreditCard, Crown } from "lucide-react";

interface Invoice {
  id: string;
  type: string;
  status: string;
  amount: number;
  metadata: { car_make?: string; car_model?: string; days?: number; subscription_id?: string };
}

interface Rental {
  rental_id: string;
  car_id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_cost: number;
  start_date: string;
  end_date: string;
  car_make?: string;
  car_model?: string;
}

interface TopFleet {
  owner_id: string;
  owner_name: string;
  total_revenue: number;
  car_count: number;
}

export default function GloryHall() {
  const { dbUser, isAdmin } = useTelegram();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [topFleets, setTopFleets] = useState<TopFleet[]>([]);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);
  const [isFleetsLoading, setIsFleetsLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!dbUser) return;

      try {
        const [invoicesRes, rentalsRes] = await Promise.all([
          getUserInvoices(dbUser.user_id),
          getUserRentals(dbUser.user_id),
        ]);

        if (invoicesRes.error) console.error("Error fetching invoices:", invoicesRes.error);
        else setInvoices(invoicesRes.data || []);
        if (rentalsRes.error) console.error("Error fetching rentals:", rentalsRes.error);
        else setRentals(rentalsRes.data || []);

        toast.success("Данные пользователя загружены!");
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast.error("Ошибка загрузки данных пользователя");
      } finally {
        setIsUserDataLoading(false);
      }
    };

    const fetchTopFleets = async () => {
      try {
        const { data: fleetData, error: fleetError } = await supabaseAdmin.rpc("get_top_fleets");
        if (fleetError) {
          console.error("Error fetching top fleets:", fleetError);
          toast.error("Ошибка загрузки топ-флотов");
        } else {
          setTopFleets(fleetData || []);
          toast.success("Топ-флоты загружены!");
        }
      } catch (error) {
        console.error("Unexpected error fetching top fleets:", error);
        toast.error("Неожиданная ошибка при загрузке топ-флотов");
      } finally {
        setIsFleetsLoading(false);
      }
    };

    fetchUserData();
    if (isAdmin()) fetchTopFleets(); // Only fetch top fleets for admins
  }, [dbUser, isAdmin]);

  if (isUserDataLoading)
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-t-[#00ff9d] border-[#00ff9d]/20 rounded-full shadow-[0_0_10px_rgba(0,255,157,0.5)]"
        />
        <span className="ml-4 text-2xl text-[#4ECDC4] font-['Orbitron'] animate-pulse">Чекаю...</span>
      </div>
    );

  if (!invoices.length && !rentals.length && (!topFleets.length || !isAdmin()))
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-center pt-20">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl text-[#FF6B6B] font-mono"
        >
          В ожидании первого триумфа!
        </motion.p>
      </div>
    );

  const pendingItems = [
    ...invoices.filter((inv) => inv.status === "pending"),
    ...rentals.filter((r) => r.payment_status === "pending"),
  ];
  const completedItems = [
    ...invoices.filter((inv) => inv.status === "paid"),
    ...rentals.filter((r) => r.payment_status === "paid"),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-[#00ff9d] relative overflow-hidden">
      {/* Neon Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEwIDB2MjBNMCAxMGgyME0xMCAyMFYwTTAgMTBoMjAiIHN0cm9rZT0iIzAwZmY5ZCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] bg-repeat" />

      <div className="container mx-auto px-4 py-8 pt-20">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-5xl font-bold text-center font-['Orbitron'] text-[#00ff9d] mb-10 drop-shadow-[0_0_15px_rgba(0,255,157,0.8)] flex items-center justify-center gap-3"
        >
          <Trophy className="h-8 w-8 animate-pulse" /> Зал Славы
        </motion.h1>

        {/* Top Fleets Widget (Admins Only) */}
        {isAdmin() && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-12 bg-gradient-to-br from-yellow-900/30 to-yellow-700/20 p-6 rounded-xl shadow-[0_0_15px_rgba(255,215,0,0.4)]"
          >
            <h2 className="text-2xl font-semibold text-yellow-400 mb-6 flex items-center gap-2 font-mono">
              <Crown className="h-6 w-6 animate-spin-slow" /> Топ Командиров Флотов
            </h2>
            {isFleetsLoading ? (
              <div className="text-center text-yellow-400 animate-pulse">Загрузка топ-флотов...</div>
            ) : topFleets.length === 0 ? (
              <div className="text-center text-yellow-400">Флоты еще не готовы к славе!</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {topFleets.map((fleet, index) => (
                  <motion.div
                    key={fleet.owner_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="bg-yellow-950/50 border-yellow-500 hover:shadow-[0_0_20px_rgba(255,215,0,0.5)] transition-all">
                      <CardHeader>
                        <CardTitle className="text-yellow-400 flex items-center gap-2">
                          #{index + 1} {fleet.owner_name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-white font-mono">
                          <span className="font-semibold">Доход:</span> {fleet.total_revenue} XTR
                        </p>
                        <p className="text-gray-300 font-mono">
                          <span className="font-semibold">Флот:</span> {fleet.car_count} машин
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-semibold text-red-500 mb-6 font-mono">Ожидающие Оплаты</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingItems.map((item) => (
                <motion.div
                  key={"rental_id" in item ? item.rental_id : item.id}
                  whileHover={{ scale: 1.03 }}
                  className="bg-red-950/50 border-red-500 rounded-lg shadow-[0_0_10px_rgba(255,107,107,0.3)] hover:shadow-[0_0_20px_rgba(255,107,107,0.5)] transition-all"
                >
                  <CardHeader>
                    <CardTitle className="text-red-400 flex items-center gap-2 font-mono">
                      {"type" in item ? <CreditCard className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                      {"type" in item ? (item.type === "subscription" ? "Подписка" : "Аренда") : "Аренда"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white font-mono">
                      <span className="font-semibold">Сумма:</span> {"amount" in item ? item.amount : item.total_cost} XTR
                    </p>
                    <p className="text-gray-300 font-mono text-sm">
                      <span className="font-semibold">Детали:</span>{" "}
                      {"type" in item ? (
                        item.type === "car_rental" ? (
                          `${item.metadata.car_make} ${item.metadata.car_model} на ${item.metadata.days} дней`
                        ) : (
                          `Подписка #${item.metadata.subscription_id}`
                        )
                      ) : (
                        `${item.car_make} ${item.car_model} (${new Date(item.start_date).toLocaleDateString()} - ${new Date(
                          item.end_date
                        ).toLocaleDateString()})`
                      )}
                    </p>
                    <Badge variant="destructive" className="mt-2">
                      {"status" in item ? item.status : item.payment_status}
                    </Badge>
                  </CardContent>
                  <CardFooter>
                    <Button variant="destructive" className="w-full font-mono" onClick={() => {/* Payment logic */}}>
                      Оплатить
                    </Button>
                  </CardFooter>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-gradient-to-br from-green-900/30 to-green-700/20 p-8 rounded-xl shadow-[0_0_15px_rgba(0,255,157,0.4)]"
          >
            <h2 className="text-2xl font-semibold text-green-400 mb-6 flex items-center gap-2 font-mono">
              <Trophy className="h-6 w-6 animate-bounce" /> Завоеванные Славы
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedItems.map((item) => (
                <motion.div
                  key={"rental_id" in item ? item.rental_id : item.id}
                  whileHover={{ scale: 1.03 }}
                  className="bg-green-950/50 border-green-500 rounded-lg shadow-[0_0_10px_rgba(0,255,157,0.3)] hover:shadow-[0_0_20px_rgba(0,255,157,0.5)] transition-all"
                >
                  <CardHeader>
                    <CardTitle className="text-green-400 flex items-center gap-2 font-mono">
                      {"type" in item ? <CreditCard className="h-5 w-5" /> : <Car className="h-5 w-5" />}
                      {"type" in item ? (item.type === "subscription" ? "Подписка" : "Аренда") : "Аренда"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white font-mono">
                      <span className="font-semibold">Сумма:</span> {"amount" in item ? item.amount : item.total_cost} XTR
                    </p>
                    <p className="text-gray-300 font-mono text-sm">
                      <span className="font-semibold">Детали:</span>{" "}
                      {"type" in item ? (
                        item.type === "car_rental" ? (
                          `${item.metadata.car_make} ${item.metadata.car_model} на ${item.metadata.days} дней`
                        ) : (
                          `Подписка #${item.metadata.subscription_id}`
                        )
                      ) : (
                        `${item.car_make} ${item.car_model} (${new Date(item.start_date).toLocaleDateString()} - ${new Date(
                          item.end_date
                        ).toLocaleDateString()})`
                      )}
                    </p>
                    <Badge variant="success" className="mt-2">
                      {"status" in item ? item.status : item.payment_status}
                    </Badge>
                  </CardContent>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
