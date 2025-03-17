"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramInvoice, notifyAdmin } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { translations } from "@/components/translations_inventory";

const SCRIPT_PACK = {
  id: "order_snatcher",
  name: "Order Snatcher Scripts",
  price: 150, // Price in XTR
};

export default function OrderSnatcherSection() {
  const { user, isInTelegramContext, tg } = useTelegram();
  const lang = user?.language_code === "ru" ? "ru" : "en";
  const [loading, setLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return;
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("metadata")
        .eq("user_id", user.id.toString())
        .single();
      if (error) {
        toast.error("Ошибка проверки доступа");
      } else {
        setHasAccess(data?.metadata?.has_inventory_script_access || false);
        if (data?.metadata?.has_inventory_script_access) {
          toast.success(lang === "en" ? "Access granted!" : "Доступ получен!");
        }
      }
    };
    checkAccess();
  }, [user, lang]);

  const handlePurchase = async () => {
    if (!user?.id) {
      toast.error(translations[lang].snatcherLoginError);
      return;
    }
    if (hasAccess) {
      toast.error(translations[lang].snatcherAlreadyOwned);
      return;
    }
    setLoading(true);

    try {
      const payload = `inventory_script_access_${user.id}_${Date.now()}`; // Match webhook type
      const response = await sendTelegramInvoice(
        user.id.toString(),
        SCRIPT_PACK.name,
        translations[lang].snatcherDescription,
        payload,
        SCRIPT_PACK.price
      );

      if (!response.success) throw new Error(response.error || "Failed to send invoice");

      toast.success(lang === "en" ? "Invoice sent to Telegram!" : "Счет отправлен в Telegram!");
      await notifyAdmin(`User ${user.id} requested ${SCRIPT_PACK.name} for ${SCRIPT_PACK.price} XTR`);
      // No metadata update here—webhook handles it
    } catch (err) {
      toast.error(`${lang === "en" ? "Purchase error" : "Ошибка покупки"}: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScriptLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isInTelegramContext && tg) {
      e.preventDefault();
      tg.openLink("https://automa.site/workflow/order-snatcher");
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="py-16 bg-gray-900" // Simplified, gradient moved to parent
    >
      <div className="max-w-4xl mx-auto p-6 bg-gray-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-cyan-500/30">
        <h2
          className="text-4xl font-extrabold text-center mb-8 text-cyan-300 tracking-widest font-orbitron uppercase glitch animate-[neon_2s_infinite]"
          data-text={translations[lang].snatcherTitle}
        >
          {translations[lang].snatcherTitle}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="p-4 bg-gray-900/60 rounded-lg border border-cyan-500/40 hover:border-cyan-500 transition-all duration-300">
            <h3 className="text-2xl font-bold mb-3 text-teal-400 font-orbitron">
              {translations[lang].snatcherSubtitle}
            </h3>
            <p className="text-gray-300 mb-4 font-mono text-sm">
              {translations[lang].snatcherDescription}
            </p>
            <p className="text-3xl font-bold mb-6 text-white font-mono tracking-tight">
              {translations[lang].snatcherPrice}
            </p>
            {hasAccess ? (
              <div className="space-y-3">
                <p className="text-green-400 font-mono text-sm tracking-wide">
                  {translations[lang].snatcherAccess}
                </p>
                <motion.a
                  href="https://automa.site/workflow/order-snatcher"
                  onClick={handleScriptLinkClick}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-gradient-to-r from-[#ff007a] to-cyan-500 text-white font-mono text-sm rounded-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-300 animate-pulse"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {translations[lang].snatcherView}
                </motion.a>
              </div>
            ) : (
              <Button
                onClick={handlePurchase}
                disabled={loading}
                className="w-full py-3 font-mono text-lg bg-gradient-to-r from-green-600 to-teal-400 hover:from-green-700 hover:to-teal-500 text-white rounded-lg shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/50 transition-all duration-300 animate-[neon_2s_infinite]"
              >
                {loading ? translations[lang].snatcherProcessing : translations[lang].snatcherButton}
              </Button>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
