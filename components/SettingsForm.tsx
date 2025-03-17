"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { notifyAdmin } from "@/app/actions";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { translations } from "@/components/translations_inventory";

export default function SettingsForm() {
  const { dbUser, isAdmin, user } = useTelegram();
  const lang = user?.language_code === "ru" ? "ru" : "en";
  const [rates, setRates] = useState<any[]>([]);
  const [formData, setFormData] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dbUser || !isAdmin()) return;
    const fetchRates = async () => {
      const { data, error } = await supabaseAdmin
        .from("consumption_rates")
        .select("id, amount, chemicals(name), service_types(name), car_sizes(name)");
      if (error) {
        toast.error(`Error fetching rates: ${error.message}`);
      } else {
        setRates(data || []);
        setFormData(data.reduce((acc, rate) => ({ ...acc, [rate.id]: rate.amount }), {}));
      }
      setLoading(false);
    };
    fetchRates();
  }, [dbUser, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      for (const [id, amount] of Object.entries(formData)) {
        const { error } = await supabaseAdmin
          .from("consumption_rates")
          .update({ amount: Number(amount) })
          .eq("id", id);
        if (error) throw error;
      }
      toast.success("Settings updated!");
      await notifyAdmin(`Admin ${dbUser?.user_id} updated consumption rates.`);
    } catch (err) {
      toast.error(`Error updating settings: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <p className="text-center text-[#00ff9d] font-mono text-[10px]">{translations[lang].settingsLoading}</p>;
  if (!dbUser || !isAdmin()) return null;

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30 px-2 py-4 space-y-4" // Reduced padding
    >
      <h2
        className="text-xl font-bold text-teal-400 font-orbitron glitch"
        data-text={translations[lang].settingsTitle}
      >
        {translations[lang].settingsTitle}
      </h2>
      <div className="space-y-2">
        {rates.map((rate) => (
          <motion.div
            key={rate.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            <label className="flex-1 text-[10px] font-mono text-[#00ff9d] truncate">
              {rate.chemicals.name.slice(0, 5)}... - {rate.service_types.name} - {rate.car_sizes.name}
            </label>
            <input
              type="number"
              value={formData[rate.id] || ""}
              onChange={(e) => setFormData({ ...formData, [rate.id]: Number(e.target.value) })}
              className="w-16 p-1 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-1 focus:ring-[#00ff9d] text-[10px] font-mono transition-all"
            />
            <span className="text-[#00ff9d] font-mono text-[10px]">{translations[lang].settingsUnit}</span>
          </motion.div>
        ))}
      </div>
      <motion.button
        type="submit"
        disabled={loading}
        className={`w-full py-2 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-full font-mono text-[10px] ${loading ? "animate-pulse opacity-50" : "shadow-[0_0_10px_rgba(255,0,122,0.8)]"} transition-all`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {loading ? translations[lang].settingsSaving : translations[lang].settingsSave}
      </motion.button>
    </motion.form>
  );
}
