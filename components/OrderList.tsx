"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { translations } from "@/components/translations_inventory";

export default function OrderList() {
  const { dbUser, isAdmin, user } = useTelegram();
  const lang = user?.language_code === "ru" ? "ru" : "en";
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "processed" | "unprocessed">("processed");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbUser || !isAdmin()) return;

    // Initial fetch
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

    // Realtime subscription
    const channel = supabaseAdmin
      .channel("orders_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          setOrders((prev) => {
            const newOrder = payload.new;
            // Apply filter logic to decide if new order should be added
            if (
              filter === "all" ||
              (filter === "processed" && newOrder.processed) ||
              (filter === "unprocessed" && !newOrder.processed)
            ) {
              return [newOrder, ...prev].sort((a, b) =>
                new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
              );
            }
            return prev; // If it doesn’t match filter, keep list unchanged
          });
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabaseAdmin.removeChannel(channel);
    };
  }, [dbUser, isAdmin, filter]);

  const paginatedOrders = orders.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(orders.length / itemsPerPage);

  if (loading) return <p className="text-center text-[#00ff9d] font-mono">{translations[lang].ordersLoading}</p>;
  if (!dbUser || !isAdmin()) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30 p-6"
    >
      <h2
        className="text-2xl font-bold mb-4 text-teal-400 font-orbitron glitch"
        data-text={translations[lang].ordersTitle}
      >
        {translations[lang].ordersTitle}
      </h2>
      <div className="flex gap-4 mb-4">
        {["all", "processed", "unprocessed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`p-2 font-mono text-sm rounded-lg ${
              filter === f ? "bg-[#00ff9d]/30 text-[#00ff9d]" : "bg-gray-900/60 text-white hover:bg-gray-700"
            } transition-all`}
          >
            {translations[lang][`filter${f.charAt(0).toUpperCase() + f.slice(1)}` as keyof typeof translations["en"]]}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {paginatedOrders.map((order) => (
          <motion.li
            key={order.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 bg-gray-900/60 rounded-lg border border-cyan-500/40"
          >
            <span className="text-white font-mono">
              {order.crm_name} - {order.service_id} ({order.service_type}, {order.car_size})
            </span>
            <span className="text-[#00ff9d] ml-2">
              {new Date(order.completed_at).toLocaleString()}
            </span>
          </motion.li>
        ))}
      </ul>
      <div className="flex justify-between mt-4">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="p-2 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-lg font-mono disabled:opacity-50"
        >
          {translations[lang].previous}
        </button>
        <span className="text-white font-mono">
          {translations[lang].page} {page} {translations[lang].of} {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="p-2 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-lg font-mono disabled:opacity-50"
        >
          {translations[lang].next}
        </button>
      </div>
    </motion.div>
  );
}
