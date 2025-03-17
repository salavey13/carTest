"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { translations } from "@/components/translations_inventory";
import { FaCheckCircle, FaTimesCircle, FaInfoCircle } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal"; // Assuming you have a Modal component

export default function OrderList() {
  const { dbUser, isAdmin, user } = useTelegram();
  const lang = user?.language_code === "ru" ? "ru" : "en";
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "processed" | "unprocessed">("all");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

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

  const openModal = (order: any) => setSelectedOrder(order);
  const closeModal = () => setSelectedOrder(null);

  if (loading) return <p className="text-center text-[#00ff9d] font-mono text-[10px]">{translations[lang].ordersLoading}</p>;
  if (!dbUser || !isAdmin()) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30 px-2 py-4" // Reduced x padding
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
            className={`px-2 py-1 font-mono text-[10px] rounded-full ${
              filter === f ? "bg-[#00ff9d]/30 text-[#00ff9d]" : "bg-gray-900/60 text-white hover:bg-gray-700"
            } transition-all`}
          >
            {translations[lang][`filter${f.charAt(0).toUpperCase() + f.slice(1)}` as keyof typeof translations["en"]]}
          </button>
        ))}
      </div>
      <ul className="space-y-0.5">
        {paginatedOrders.map((order) => (
          <motion.li
            key={order.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-1 py-1 bg-gray-900/60 rounded-lg border border-cyan-500/40 flex items-center justify-between cursor-pointer"
            onClick={() => openModal(order)}
          >
            <div className="flex items-center space-x-1">
              {order.processed ? (
                <FaCheckCircle className="text-green-400 text-[10px]" />
              ) : (
                <FaTimesCircle className="text-red-400 text-[10px]" />
              )}
              <span className="text-white font-mono text-[10px]">
                {order.crm_name.slice(0, 5)}... - {order.service_id.slice(-5)}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-[#00ff9d] text-[9px] font-mono">
                {new Date(order.completed_at).toLocaleTimeString()}
              </span>
              <FaInfoCircle className="text-cyan-400 text-[10px]" />
            </div>
          </motion.li>
        ))}
      </ul>
      <div className="flex justify-between mt-3">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-2 py-1 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-full font-mono text-[10px] disabled:opacity-50"
        >
          {translations[lang].previous}
        </button>
        <span className="text-white font-mono text-[10px]">
          {translations[lang].page} {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="px-2 py-1 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-full font-mono text-[10px] disabled:opacity-50"
        >
          {translations[lang].next}
        </button>
      </div>

      {/* Modal for order details */}
      {selectedOrder && (
        <Modal onClose={closeModal}>
          <div className="p-2 bg-gray-900/80 rounded-lg border border-cyan-500/40">
            <h3 className="text-lg font-bold text-teal-400 mb-2">{translations[lang].orderDetails}</h3>
            <p className="text-white font-mono text-[10px]">
              <strong>{translations[lang].crmName}:</strong> {selectedOrder.crm_name}
            </p>
            <p className="text-white font-mono text-[10px]">
              <strong>{translations[lang].serviceId}:</strong> {selectedOrder.service_id}
            </p>
            <p className="text-white font-mono text-[10px]">
              <strong>{translations[lang].serviceType}:</strong> {selectedOrder.service_type || "N/A"}
            </p>
            <p className="text-white font-mono text-[10px]">
              <strong>{translations[lang].carSize}:</strong> {selectedOrder.car_size || "N/A"}
            </p>
            <p className="text-white font-mono text-[10px]">
              <strong>{translations[lang].completedAt}:</strong> {new Date(selectedOrder.completed_at).toLocaleString()}
            </p>
            <p className="text-white font-mono text-[10px]">
              <strong>{translations[lang].processed}:</strong> {selectedOrder.processed ? "Yes" : "No"}
            </p>
            <Button onClick={closeModal} className="mt-2 w-full bg-[#ff007a] hover:bg-[#ff007a]/80 text-white rounded-full font-mono text-[10px]">
              {translations[lang].close}
            </Button>
          </div>
        </Modal>
      )}
    </motion.div>
  );
}
