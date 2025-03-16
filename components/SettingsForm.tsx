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

  if (loading) return <p className="text-center text-[#00ff9d] font-mono">{translations[lang].settingsLoading}</p>;
  if (!dbUser || !isAdmin()) return null;

  return (
    <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30 p-6">
      <h2 className="text-2xl font-bold mb-4 text-teal-400 font-orbitron glitch" data-text={translations[lang].settingsTitle}>
        {translations[lang].settingsTitle}
      </h2>
      <div className="space-y-4">
        {rates.map((rate) => (
          <motion.div key={rate.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-center">
            <label className="flex-1 text-sm font-mono text-[#00ff9d] text-glow">
              {rate.chemicals.name} - {rate.service_types.name} - {rate.car_sizes.name}
            </label>
            <input
              type="number"
              value={formData[rate.id] || ""}
              onChange={(e) => setFormData({ ...formData, [rate.id]: Number(e.target.value) })}
              className="w-24 p-3 bg-black/80 border border-[#00ff9d]/50 text-[#00ff9d] rounded-lg focus:ring-2 focus:ring-[#00ff9d] placeholder-[#00ff9d]/40 text-sm font-mono shadow-[inset_0_0_10px_rgba(0,255,157,0.5)] transition-all hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]"
              required
            />
            <span className="text-[#00ff9d] font-mono">{translations[lang].settingsUnit}</span>
          </motion.div>
        ))}
      </div>
      <motion.button
        type="submit"
        disabled={loading}
        className={`w-full p-4 bg-[#ff007a]/80 hover:bg-[#ff007a] text-white rounded-xl font-mono text-lg ${loading ? "animate-pulse cursor-not-allowed opacity-50" : "shadow-[0_0_20px_rgba(255,0,122,0.8)] hover:shadow-[0_0_30px_rgba(255,0,122,1)]"} transition-all animate-[neon_2s_infinite]`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {loading ? translations[lang].settingsSaving : translations[lang].settingsSave}
      </motion.button>
    </motion.form>
  );
}
