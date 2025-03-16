"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { translations } from "@/translations_inventory";

export default function InventoryTable() {
  const { dbUser, isAdmin, user } = useTelegram();
  const lang = user?.language_code === "ru" ? "ru" : "en";
  const [chemicals, setChemicals] = useState<any[]>([]);
  const [sortField, setSortField] = useState<"name" | "quantity">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbUser || !isAdmin()) return;
    const fetchInventory = async () => {
      const { data, error } = await supabaseAdmin.from("chemicals").select("*");
      if (error) {
        toast.error(`Error fetching inventory: ${error.message}`);
      } else {
        setChemicals(data || []);
      }
      setLoading(false);
    };
    fetchInventory();
  }, [dbUser, isAdmin]);

  const handleSort = (field: "name" | "quantity") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedChemicals = [...chemicals].sort((a, b) => {
    const multiplier = sortOrder === "asc" ? 1 : -1;
    if (sortField === "name") return multiplier * a.name.localeCompare(b.name);
    return multiplier * (a.quantity - b.quantity);
  });

  if (loading) return <p className="text-center text-[#00ff9d] font-mono">{translations[lang].inventoryLoading}</p>;
  if (!dbUser || !isAdmin()) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30 p-6">
      <h2 className="text-2xl font-bold mb-4 text-teal-400 font-orbitron glitch" data-text={translations[lang].inventoryTitle}>
        {translations[lang].inventoryTitle}
      </h2>
      <table className="w-full text-left font-mono text-sm">
        <thead>
          <tr className="bg-gray-900/60 border-b border-cyan-500/40">
            <th
              onClick={() => handleSort("name")}
              className="p-3 text-[#00ff9d] cursor-pointer hover:text-[#00ff9d]/80 transition-colors"
            >
              {translations[lang].name} {sortField === "name" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
            <th
              onClick={() => handleSort("quantity")}
              className="p-3 text-[#00ff9d] cursor-pointer hover:text-[#00ff9d]/80 transition-colors"
            >
              {translations[lang].quantity} {sortField === "quantity" && (sortOrder === "asc" ? "↑" : "↓")}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedChemicals.map((chem) => (
            <motion.tr
              key={chem.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`border-b border-gray-700 ${chem.quantity < 100 ? "bg-red-900/20" : ""}`}
            >
              <td className="p-3 text-white">{chem.name}</td>
              <td className={`p-3 ${chem.quantity < 100 ? "text-red-400" : "text-white"}`}>
                {chem.quantity} {chem.unit}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
