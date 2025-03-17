"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { translations } from "@/components/translations_inventory";
import { FaSortAlphaDown, FaSortAlphaUp, FaSortNumericDown, FaSortNumericUp, FaExclamationTriangle } from "react-icons/fa";

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

  if (loading) return <p className="text-center text-[#00ff9d] font-mono text-xs">{translations[lang].inventoryLoading}</p>;
  if (!dbUser || !isAdmin()) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/80 backdrop-blur-md rounded-lg shadow-lg border border-cyan-500/20"
    >
      <h2
        className="text-lg font-bold mb-2 text-teal-400 font-orbitron glitch px-1 pt-1"
        data-text={translations[lang].inventoryTitle}
      >
        {translations[lang].inventoryTitle}
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="bg-gray-900/60 border-b border-cyan-500/40">
              <th
                onClick={() => handleSort("name")}
                className="p-1 text-[#00ff9d] cursor-pointer hover:text-[#00ff9d]/80 transition-colors flex items-center space-x-1"
              >
                <span>{translations[lang].name}</span>
                {sortField === "name" && (sortOrder === "asc" ? <FaSortAlphaDown className="text-sm" /> : <FaSortAlphaUp className="text-sm" />)}
              </th>
              <th
                onClick={() => handleSort("quantity")}
                className="p-1 text-[#00ff9d] cursor-pointer hover:text-[#00ff9d]/80 transition-colors flex items-center space-x-1"
              >
                <span>{translations[lang].quantity}</span>
                {sortField === "quantity" && (sortOrder === "asc" ? <FaSortNumericDown className="text-sm" /> : <FaSortNumericUp className="text-sm" />)}
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
                <td className="p-1 text-white flex items-center space-x-1">
                  {chem.quantity < 100 && <FaExclamationTriangle className="text-red-400 text-xs" />}
                  <span>{chem.name}</span>
                </td>
                <td className={`p-1 ${chem.quantity < 100 ? "text-red-400" : "text-white"}`}>
                  {chem.quantity} {chem.unit}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
