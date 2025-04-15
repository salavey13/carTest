"use client";
import { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice } from "@/app/actions"; // Предполагаем, что этот экшен существует
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger"; // Импортируем логгер
import { cn } from "@/lib/utils"

export default function SupportForm() {
  const contextValue = useAppContext(); // Сначала получаем весь контекст
  const [level, setLevel] = useState("1");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  // Проверка на наличие контекста
  if (!contextValue) {
    logger.error("AppContext not available in SupportForm. Ensure AppProvider wraps this component.");
    // Можно вернуть заглушку или null, чтобы избежать ошибки рендера
    return (
        <div className="text-center text-red-500 p-4 border border-red-500/50 rounded-lg bg-red-900/30">
            Ошибка: Контекст приложения недоступен. Форма поддержки не может быть загружена.
        </div>
    );
  }

  // Теперь безопасно деструктурируем user
  const { user } = contextValue;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Ошибка",
        description: "Пожалуйста, авторизуйтесь через Telegram.",
        variant: "destructive",
      });
      return;
    }

    // Убедимся, что user.id существует
    if (!user.id) {
       toast({
        title: "Ошибка",
        description: "Не удалось получить ID пользователя. Попробуйте перезайти.",
        variant: "destructive",
      });
      logger.error("User object is missing 'id' property in SupportForm handleSubmit", { user });
      return;
    }

    const amount = parseInt(level) * 1000; // 1 звезда = 1000 XTR (Stars)
    const description = `Заявка на поддержку (${level} ★): ${message || 'Без сообщения'}`; // Добавим звезду и обработку пустого сообщения
    const payload = `support_${user.id}_${Date.now()}`;
    const title = `Поддержка VIBE (${level} ★)`; // Более информативный заголовок

    try {
      const result = await sendTelegramInvoice(
        user.id.toString(),
        title,
        description,
        payload,
        amount, // Сумма в минимальных единицах валюты (например, копейках для RUB, центах для USD, или Stars для XTR)
        0, // No subscription ID
        "XTR" // Указываем валюту
      );

      if (!result || !result.success) { // Добавим проверку на существование result
        throw new Error(result?.error || "Не удалось отправить счет на оплату");
      }

      toast({
        title: "Успех!",
        description: "Счет на оплату поддержки отправлен вам в Telegram.",
      });
      setMessage(""); // Очищаем форму после успеха
      setLevel("1");
    } catch (error) {
      logger.error("Failed to send support invoice:", error);
      toast({
        title: "Ошибка отправки",
        description: error instanceof Error ? error.message : "Не удалось отправить заявку. Попробуйте позже.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
       <p className="text-sm text-gray-400 text-center">
         Отправьте заявку на поддержку или консультацию. Оплата через Telegram Stars (XTR).
       </p>
      <Input
        placeholder="Кратко опишите ваш вопрос или задачу"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        className="w-full bg-black/70 text-white border border-brand-green/50 rounded-lg text-sm md:text-base placeholder:text-gray-500 focus:border-brand-green focus:ring-brand-green"
      />
      <Select value={level} onValueChange={setLevel}>
        <SelectTrigger className="w-full bg-black/70 text-white border border-brand-green/50 rounded-lg text-sm md:text-base focus:border-brand-green focus:ring-brand-green">
          <SelectValue placeholder="Выберите уровень приоритета" />
        </SelectTrigger>
        <SelectContent className="bg-black text-white border border-brand-green/50">
          <SelectItem value="1">★ Базовый (1000 XTR)</SelectItem>
          <SelectItem value="2">★★ Средний (2000 XTR)</SelectItem>
          <SelectItem value="3">★★★ Высокий (3000 XTR)</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="submit"
        disabled={!user} // Делаем кнопку неактивной, если пользователь не авторизован
        className={cn(
            "w-full text-black rounded-lg font-semibold transition-all duration-300 ease-in-out",
            "bg-brand-green hover:bg-brand-green/80 shadow-[0_0_10px_rgba(0,255,157,0.5)] hover:shadow-[0_0_15px_rgba(0,255,157,0.7)]",
            "disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed disabled:shadow-none"
            )}
       >
        {user ? "Отправить Заявку (через Telegram)" : "Авторизуйтесь для отправки"}
      </Button>
    </form>
  );
}
