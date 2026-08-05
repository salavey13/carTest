// /components/QuickSetWebhookButton.tsx
"use client";
import { useState } from "react";
import { setTelegramWebhook } from "@/app/actions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from "@/components/VibeContentRenderer";
import { cn } from "@/lib/utils";

export function QuickSetWebhookButton() {
  const [isSettingWebhook, setIsSettingWebhook] = useState(false);

  const handleSetWebhook = async () => {
    setIsSettingWebhook(true);
    try {
      const result = await setTelegramWebhook();
      if (result.success) {
        toast.success("Webhook успешно установлен!");
      } else {
        toast.error(`Ошибка при установке Webhook: ${result.error || "Неизвестная ошибка"}`);
      }
    } catch (error) {
      toast.error(`Ошибка при установке Webhook: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSettingWebhook(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Button
        onClick={handleSetWebhook}
        disabled={isSettingWebhook}
        variant="outline"
        size="sm"
        className={cn(
          "w-full border-brand-cyan/30 bg-brand-cyan/5 text-brand-cyan hover:bg-brand-cyan/15 hover:text-white transition-colors",
          isSettingWebhook && "opacity-50 cursor-not-allowed"
        )}
      >
        <VibeContentRenderer content="::FaSatelliteDish::" className="mr-2 h-3.5 w-3.5" />
        {isSettingWebhook ? "Устанавливаю..." : "Установить Webhook"}
      </Button>
    </motion.div>
  );
}
