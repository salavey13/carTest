"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";

export default function DonationForm({ streamerId }: { streamerId: string }) {
  const { dbUser } = useAppContext();
  const payerUserId = dbUser?.user_id ?? null;

  const [amount, setAmount] = useState<number>(50); // default 50 XTR
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    if (!payerUserId) {
      toast.error("Требуется авторизация (укажите Telegram).");
      return;
    }
    if (!streamerId) {
      toast.error("Не указан получатель.");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Укажите сумму > 0");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/streamer/create-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": payerUserId, // server will prefer header
        },
        body: JSON.stringify({
          streamerId,
          amount,
          metadata: { note },
        }),
      }).then((r) => r.json());

      if (!res?.success) {
        toast.error(res?.error || "Ошибка создания инвойса");
      } else {
        toast.success("Инвойс создан. Счёт отправлен — ожидайте подтверждения платежа.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleDonate} className="space-y-3 p-3 bg-card rounded-md border border-border">
      <div className="text-sm text-muted-foreground">Поддержать стримера (XTR / звезды)</div>
      <div className="flex gap-2">
        <Input type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="flex-1 input-cyber" />
        <Button type="submit" className="whitespace-nowrap" disabled={loading}>{loading ? "Отправка..." : "Поддержать"}</Button>
      </div>
      <div>
        <Input placeholder="Сообщение (опционально)" value={note} onChange={(e) => setNote(e.target.value)} className="input-cyber mt-2" />
      </div>
      <div className="text-xs text-muted-foreground">Средства — XTR (внутренняя валюта). После оплаты — звезды зачисляются автоматически.</div>
    </form>
  );
}