"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { sendTelegramMessage } from "@/app/actions";

export default function TeaCallPage() {
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      setIsSending(true);
      setStatus(null);

      const res = await sendTelegramMessage(
        "☕ Пользователь нажал кнопку на странице /tea-call и просит срочно принести чай!"
      );

      if (res?.success) {
        setStatus("Админ уже уведомлён и несётся с чаем.");
      } else {
        setStatus("Не получилось докричаться до админа, попробуй ещё раз.");
      }
    } catch (e) {
      setStatus("Произошла ошибка при вызове админа.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120 }}
        className="text-center space-y-4"
      >
        <h1 className="text-2xl sm:text-3xl font-orbitron text-brand-yellow">
          Вызвать админа за чаем
        </h1>
        <p className="text-muted-foreground font-mono text-sm">
          Нажми кнопку, и админ получит телеграм‑сигнал, что пора принести чай.
        </p>

        <Button
          onClick={handleClick}
          disabled={isSending}
          className="bg-brand-pink text-white hover:bg-brand-pink/90 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-150"
        >
          {isSending ? "Зову админа..." : "Позвать админа за чаем ☕"}
        </Button>

        {status && (
          <p className="text-xs sm:text-sm font-mono text-brand-cyan mt-2">
            {status}
          </p>
        )}
      </motion.div>
    </div>
  );
}