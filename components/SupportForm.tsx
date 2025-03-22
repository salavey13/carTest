"use client";
import { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { sendTelegramInvoice } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function SupportForm() {
  const { user } = useAppContext();
  const [level, setLevel] = useState("1");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

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

    const amount = parseInt(level) * 1000; // 1 звезда = 1000 XTR
    const description = `Заявка на поддержку: ${message}\nУровень: ${level} звезды`;
    const payload = `support_${user.id}_${Date.now()}`;

    try {
      const result = await sendTelegramInvoice(
        user.id.toString(),
        "Заявка на поддержку",
        description,
        payload,
        amount,
        0 // No subscription ID
      );

      if (!result.success) {
        throw new Error(result.error || "Не удалось отправить заявку");
      }

      toast({
        title: "Успех",
        description: "Заявка отправлена! Ожидайте подтверждения оплаты.",
      });
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось отправить заявку. Попробуйте позже.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        placeholder="Ваше сообщение"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        className="w-full bg-black text-white border border-[#39FF14] rounded-lg text-sm md:text-base"
      />
      <Select value={level} onValueChange={setLevel}>
        <SelectTrigger className="w-full bg-black text-white border border-[#39FF14] rounded-lg text-sm md:text-base">
          <SelectValue placeholder="Выберите уровень поддержки" />
        </SelectTrigger>
        <SelectContent className="bg-black text-white border border-[#39FF14]">
          <SelectItem value="1">1 звезда (1000 XTR ≈ 20$)</SelectItem>
          <SelectItem value="2">2 звезды (2000 XTR ≈ 40$)</SelectItem>
          <SelectItem value="3">3 звезды (3000 XTR ≈ 60$)</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit" className="w-full bg-[#39FF14] text-black rounded-lg shadow-[0_0_5px_#39FF14] hover:bg-[#2CFF00]">Отправить заявку</Button>
    </form>
  );
}