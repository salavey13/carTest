"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { translations } from "@/components/translations_inventory";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { Button } from "@/components/ui/button";

export default function OrderList() {
  const { dbUser, isAdmin, user } = useTelegram();
  const lang = user?.language_code === "ru" ? "ru" : "en";
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "processed" | "unprocessed">("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbUser || !isAdmin()) return;

    const fetchOrders = async () => {
      let query = supabaseAdmin
        .from("orders")
        .select("*")
        .order("completed_at", { ascending: false });
      if (filter === "processed") query = query.eq("processed", true);
      if (filter === "unprocessed") query = query.eq("processed", false);

      const { data, error } = await query;
      if (error) {
        toast.error(`Ошибка загрузки заказов: ${error.message}`);
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    };
    fetchOrders();

    const channel = supabaseAdmin
      .channel("orders_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) => {
            const newOrder = payload.new;
            if (
              filter === "all" ||
              (filter === "processed" && newOrder.processed) ||
              (filter === "unprocessed" && !newOrder.processed)
            ) {
              return [newOrder, ...prev].sort((a, b) =>
                new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
              );
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [dbUser, isAdmin, filter]);

  const paginatedOrders = orders.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(orders.length / itemsPerPage);

  const processAllOrders = async () => {
    try {
      const { error } = await supabaseAdmin.rpc("process_orders");
      if (error) throw error;
      toast.success(translations[lang].processAllSuccess || "All orders processed successfully!");
      setOrders((prev) =>
        prev.map((order) => (order.processed ? order : { ...order, processed: true }))
      );
    } catch (err) {
      toast.error(`Failed to process orders: ${err.message}`);
    }
  };

  if (loading) return <p className="text-center text-[#00ff9d] font-mono text-sm">{translations[lang].ordersLoading}</p>;
  if (!dbUser || !isAdmin()) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30 p-4"
    >
      <h2
        className="text-xl font-bold mb-3 text-teal-400 font-orbitron glitch"
        data-text={translations[lang].ordersTitle}
      >
        {translations[lang].ordersTitle}
      </h2>
      <div className="flex gap-2 mb-3">
        {["all", "processed", "unprocessed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-3 py-1 font-mono text-xs rounded-full ${
              filter === f ? "bg-[#00ff9d]/30 text-[#00ff9d]" : "bg-gray-900/60 text-white hover:bg-gray-700"
            } transition-all`}
          >
            {translations[lang][`filter${f.charAt(0).toUpperCase() + f.slice(1)}` as keyof typeof translations["en"]]}
          </button>
        ))}
      </div>
      <ul className="space-y-1">
        {paginatedOrders.map((order) => (
          <motion.li
            key={order.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-2 bg-gray-900/60 rounded-lg border border-cyan-500/40 flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              {order.processed ? (
                <FaCheckCircle className="text-green-400 text-sm" />
              ) : (
                <FaTimesCircle className="text-red-400 text-sm" />
              )}
              <span className="text-white font-mono text-sm">
                {order.crm_name} - {order.service_id}
              </span>
            </div>
            <span className="text-[#00ff9d] text-xs font-mono">
              {new Date(order.completed_at).toLocaleDateString()} {new Date(order.completed_at).toLocaleTimeString()}
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="flex justify-between mt-3">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-full font-mono text-sm disabled:opacity-50"
        >
          {translations[lang].previous}
        </button>
        <span className="text-white font-mono text-sm">
          {translations[lang].page} {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-3 py-1 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-full font-mono text-sm disabled:opacity-50"
        >
          {translations[lang].next}
        </button>
      </div>
      <Button
        onClick={processAllOrders}
        className="mt-4 w-full bg-gradient-to-r from-green-600 to-teal-400 hover:from-green-700 hover:to-teal-500 text-white rounded-lg font-mono text-sm"
      >
        {lang === "en" ? "Process All Orders" : "Обработать все заказы"}
      </Button>
    </motion.div>
  );
}
