"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";

const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function DonationForm({ streamerId }: { streamerId: string }) {
  const { dbUser } = useAppContext();
  const payerUserId = dbUser?.user_id ?? null;

  const [amount, setAmount] = useState<number>(50);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<any | null>(null);

  async function handleDonate(e: React.FormEvent) {
    e.preventDefault();
    if (!payerUserId) {
      toast.error("Требуется авторизация (Telegram).");
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
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/streamer/create-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": payerUserId,
        },
        body: JSON.stringify({ streamerId, amount, metadata: { note } }),
      }).then((r) => r.json());

      if (!res?.success) {
        toast.error(res?.error || "Ошибка создания инвойса");
      } else {
        setInvoice(res.invoice);
        toast.success("Инвойс создан. Откройте платёж или поделитесь ссылкой.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  function copyInvoiceLink() {
    if (!invoice) return;
    const appLink = (globalThis as any).NEXT_PUBLIC_TELEGRAM_BOT_LINK || process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK;
    const link = appLink ? `${appLink}?start=pay_inv_${invoice.id}` : `invoice:${invoice.id}`;
    navigator.clipboard?.writeText(link).then(() => {
      toast.success("Ссылка скопирована в буфер обмена");
    }).catch(() => {
      toast.error("Не удалось скопировать ссылку");
    });
  }

  function openInTelegram() {
    const appLink = (globalThis as any).NEXT_PUBLIC_TELEGRAM_BOT_LINK || process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK;
    if (!appLink || !invoice) {
      toast.error("Глубокая ссылка Telegram недоступна.");
      return;
    }
    const link = `${appLink}?start=pay_inv_${invoice.id}`;
    window.open(link, "_blank");
  }

  return (
    <form onSubmit={handleDonate} className="space-y-3 p-3 bg-card rounded-md border border-border" aria-live="polite">
      <div className="text-sm text-muted-foreground">Поддержать стримера (XTR / звезды)</div>

      <div className="flex gap-2 items-center">
        {QUICK_AMOUNTS.map((a) => (
          <button
            type="button"
            key={a}
            aria-pressed={amount === a}
            onClick={() => setAmount(a)}
            className={`px-3 py-1 rounded-md text-sm border ${amount === a ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
          >
            {a}★
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          aria-label="Сумма XTR"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="flex-1 input-cyber"
        />
        <Button type="submit" className="whitespace-nowrap" disabled={loading || !!invoice}>
          {loading ? "Создаём..." : invoice ? "Инвойс готов" : "Поддержать"}
        </Button>
      </div>

      <div>
        <Input
          placeholder="Сообщение (опционально)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input-cyber mt-2"
          aria-label="Сообщение донату"
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">Средства — XTR (внутренняя валюта). После оплаты — звезды зачисляются автоматически.</div>
        {invoice && (
          <div className="flex gap-2">
            <Button size="sm" onClick={copyInvoiceLink}>Копировать ссылку</Button>
            <Button size="sm" variant="secondary" onClick={openInTelegram}>Открыть в Telegram</Button>
          </div>
        )}
      </div>
    </form>
  );
}