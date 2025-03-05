"use client";
import { useState, useEffect } from "react";
import { useTelegram } from "@/hooks/useTelegram";
import { sendTelegramInvoice } from "@/app/actions";
import { createInvoice } from "@/hooks/supabase";
import { motion } from "framer-motion";
import { toast } from "sonner";

const SCRIPT_PACK = {
  id: "automa_scripts",
  name: "Automa Bot-Hunting Scripts",
  price: 100, // Price in XTR (adjust as needed)
  description: "Unlock powerful Automa scripts to automate bot-blocking on 9GAG.",
  color: "from-green-600 to-teal-400",
};

export default function PurchaseScriptsSection() {
  const { user, isInTelegramContext } = useTelegram();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(false);

  // Check if user already has access (you'll need to implement this in your Supabase schema)
  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        const { data, error } = await supabase
          .from("users")
          .select("has_script_access")
          .eq("user_id", user.id.toString())
          .single();
        if (error) {
          toast.error("Ошибка проверки доступа");
        } else {
          setHasAccess(data?.has_script_access || false);
          if (data?.has_script_access) toast.success("У вас уже есть доступ к скриптам!");
        }
      }
    };
    checkAccess();
  }, [user]);

  const handlePurchase = async () => {
    if (!user) return setError("Авторизуйтесь в Telegram"), toast.error("Авторизуйтесь в Telegram");
    if (hasAccess) return setError("У вас уже есть доступ"), toast.error("Доступ уже получен");
    setLoading(true);
    setError(null);

    if (!isInTelegramContext) {
      setSuccess(true);
      setError("Демо-режим: Счёт создан!");
      toast.success("Демо: Счёт создан!");
      setLoading(false);
      return;
    }

    try {
      const metadata = { type: "script_access" };
      const payload = `script_access_${user.id}_${Date.now()}`;
      await createInvoice("script_access", payload, user.id.toString(), SCRIPT_PACK.price, metadata);
      const response = await sendTelegramInvoice(
        user.id.toString(),
        SCRIPT_PACK.name,
        SCRIPT_PACK.description,
        payload,
        SCRIPT_PACK.price
      );
      if (!response.success) throw new Error(response.error || "Не удалось отправить счёт");
      setSuccess(true);
      toast.success("Счёт отправлен в Telegram!");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setError("Ошибка покупки: " + errMsg);
      toast.error("Ошибка покупки: " + errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-16 bg-gray-900">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto p-6 bg-card rounded-xl shadow-lg border border-muted"
      >
        <h2 className="text-2xl font-bold text-center mb-4 text-gradient cyber-text">
          {SCRIPT_PACK.name}
        </h2>
        <p className="text-muted-foreground mb-4 text-center">{SCRIPT_PACK.description}</p>
        <p className="text-3xl font-bold text-center mb-6 font-mono">
          {SCRIPT_PACK.price} XTR
        </p>
        {hasAccess ? (
          <p className="text-green-400 text-center font-mono">Доступ уже активирован!</p>
        ) : (
          <button
            onClick={handlePurchase}
            disabled={loading}
            className={`w-full p-3 rounded-lg font-mono text-lg ${loading ? "bg-muted cursor-not-allowed animate-pulse" : "bg-primary hover:bg-secondary text-primary-foreground"} transition-all`}
          >
            {loading ? "Обработка..." : "Купить сейчас"}
          </button>
        )}
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-destructive text-sm font-mono mt-4 text-center"
          >
            {error}
          </p>
        )}
      </motion.div>
    </div>
  );
}
