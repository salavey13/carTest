// /components/QuickSetWebhookButton.tsx
"use client";
import { useState } from "react";
import { setTelegramWebhook } from "@/app/actions";
import { toast } from "sonner";
import { motion } from "framer-motion";

export function QuickSetWebhookButton() {
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);

  const handleSetWebhook = async () => {
    setIsSettingWebhook(true);
    try {
      await setTelegramWebhook();
      toast.success("Webhook успешно установлен!");
    } catch (error) {
      toast.error(`Ошибка при установке Webhook: ${error.message}`);
    } finally {
      setIsSettingWebhook(false);
    }
  };

  return (
    <motion.button
      onClick={handleSetWebhook}
      disabled={isSettingWebhook}
      className={`px-6 py-3 bg-secondary text-secondary-foreground rounded-lg shadow-[0_0_10px_rgba(255,107,107,0.5)] hover:bg-secondary/80 transition-all ${
        isSettingWebhook ? "opacity-50 cursor-not-allowed" : ""
      }`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      {isSettingWebhook ? "Устанавливаю..." : "Установить Webhook"}
    </motion.button>
  );
}
