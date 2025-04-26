"use client";
import { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import { FaPaperPlane } from "react-icons/fa6"; // Add an icon

export default function SupportForm() {
  const contextValue = useAppContext();
  const [level, setLevel] = useState("1");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Add loading state for button
  const { toast } = useToast();

  if (!contextValue) {
    logger.error("AppContext not available in SupportForm.");
    return (
        <div className="text-center text-red-500 p-4 border border-red-500/50 rounded-lg bg-red-900/30 font-mono">
            Ошибка: Не удалось загрузить форму. Контекст приложения недоступен.
        </div>
    );
  }

  const { user } = contextValue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.id) {
      toast({
        title: "Требуется Авторизация",
        description: "Пожалуйста, войдите через Telegram, чтобы отправить заявку.",
        variant: "destructive",
      });
      logger.warn("SupportForm submit attempt without user or user.id", { user });
      return;
    }

    setIsSubmitting(true); // Start loading state

    const amount = parseInt(level) * 1000; // 1 звезда = 1000 XTR
    // Refined descriptions for clarity and value perception
    const descriptions: Record<string, string> = {
        "1": "Базовая консультация/поддержка",
        "2": "Углубленная консультация/приоритетная поддержка",
        "3": "Стратегическая сессия/VIP поддержка",
    };
    const description = `${descriptions[level]}: ${message || 'Обсудить детали задачи'}`;
    const payload = `support_${user.id}_${Date.now()}_lvl${level}`; // Added level to payload
    const title = `Заявка на Поддержку VIBE (${level} ★)`;

    try {
      const result = await sendTelegramInvoice(
        user.id.toString(),
        title,
        description,
        payload,
        amount,
        0,
        "XTR"
      );

      if (!result?.success) {
        throw new Error(result?.error || "Сбой при отправке счета в Telegram");
      }

      toast({
        title: "Заявка Отправлена!",
        description: "Счет на оплату поддержки отправлен вам в Telegram. Проверьте сообщения.",
        variant: "success", // Use success variant
      });
      setMessage("");
      setLevel("1");
    } catch (error) {
      logger.error("Failed to send support invoice:", { error, userId: user.id, level, message });
      toast({
        title: "Ошибка Отправки",
        description: error instanceof Error ? error.message : "Не удалось отправить заявку. Попробуйте еще раз или свяжитесь напрямую.",
        variant: "destructive",
      });
    } finally {
       setIsSubmitting(false); // End loading state
    }
  };

  return (
    // Form with clearer instruction priming the user for action
    <form onSubmit={handleSubmit} className="space-y-5">
       <p className="text-sm text-gray-400 text-center font-mono">
         Опиши задачу, выбери приоритет. Получи помощь на пути SelfDev. <br/> (Оплата через Telegram Stars - XTR)
       </p>
      <Input
        placeholder="Какую проблему ты хочешь решить сейчас?" // More direct question
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        className="w-full bg-black/70 text-white border border-brand-green/50 rounded-lg text-sm md:text-base placeholder:text-gray-500 focus:border-brand-green focus:ring-brand-green transition-colors duration-200"
        aria-label="Описание задачи"
      />
      <Select value={level} onValueChange={setLevel} disabled={isSubmitting}>
        <SelectTrigger className="w-full bg-black/70 text-white border border-brand-green/50 rounded-lg text-sm md:text-base focus:border-brand-green focus:ring-brand-green data-[placeholder]:text-gray-500">
          <SelectValue placeholder="Уровень поддержки/приоритет" />
        </SelectTrigger>
        <SelectContent className="bg-gray-950 text-white border border-brand-green/50">
          {/* Slightly refined labels */}
          <SelectItem value="1">★ Базовая Консультация (1000 XTR)</SelectItem>
          <SelectItem value="2">★★ Приоритетная Помощь (2000 XTR)</SelectItem>
          <SelectItem value="3">★★★ Стратегическая Сессия (3000 XTR)</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="submit"
        disabled={!user || isSubmitting} // Disable if not logged in OR submitting
        className={cn(
            "w-full text-black rounded-lg font-semibold transition-all duration-300 ease-in-out flex items-center justify-center space-x-2 text-base py-3", // Increased padding/size
            "bg-brand-green hover:bg-brand-green/80 shadow-[0_0_12px_rgba(0,255,157,0.6)] hover:shadow-[0_0_18px_rgba(0,255,157,0.8)]",
            "disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none disabled:opacity-60" // Clearer disabled state
            )}
       >
        {isSubmitting ? (
            <> <FaArrowsSpin className="animate-spin mr-2" /> Обработка... </>
        ) : user ? (
            <> <FaPaperPlane className="mr-2" /> Отправить Запрос на Поддержку </>
        ) : (
            "Войдите через Telegram для Отправки"
        )}
      </Button>
    </form>
  );
}