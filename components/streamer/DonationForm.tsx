"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/contexts/AppContext";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import MarketBox from "./MarketBox";
import { useAppToast } from "@/hooks/useAppToast";

type Tier = {
  id: string;
  label: string;
  amount: number;
  description: string;
  badge?: string;
  highlight?: string; // class for glow
  metadata?: Record<string, any>;
};

const TIERS: Tier[] = [
  { id: "tip", label: "Мелкий подарок", amount: 50, description: "Быстрая поддержка", badge: "💖", highlight: "shadow-pink-glow", metadata: { kind: "tip" } },
  { id: "supporter", label: "Поддержка", amount: 150, description: "Имя в итогах и благодарность", badge: "👏", highlight: "shadow-blue-glow", metadata: { kind: "support" } },
  { id: "vip", label: "VIP", amount: 300, description: "VIP-метка в чате + шепот", badge: "⭐", highlight: "shadow-purple-glow", metadata: { kind: "vip", vipDays: 7 } },
  { id: "sauna", label: "Сауна Пак", amount: 500, description: "Цифровое полотенце и шлёпки", badge: "🧖", highlight: "shadow-yellow-glow", metadata: { kind: "market", sku: "sauna_pack" } },
];

export default function DonationForm({ streamerId }: { streamerId: string }) {
  const { dbUser } = useAppContext();
  const payerUserId = dbUser?.user_id ?? null;
  const supabase = getSupabaseBrowserClient();
  const toast = useAppToast();

  const [amount, setAmount] = useState<number>(TIERS[0].amount);
  const [selectedTier, setSelectedTier] = useState<Tier>(TIERS[0]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [paid, setPaid] = useState(false);
  const chanRef = useRef<any>(null);

  useEffect(() => {
    setSelectedTier(TIERS.find((t) => t.amount === amount) ?? TIERS[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

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

    const metadata = { ...selectedTier.metadata, note, tierId: selectedTier.id, tierLabel: selectedTier.label };

    try {
      const res = await fetch("/api/streamer/create-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": payerUserId,
        },
        body: JSON.stringify({ streamerId, amount, metadata }),
      }).then((r) => r.json());

      if (!res?.success) {
        toast.error(res?.error || "Ошибка создания инвойса");
      } else {
        setInvoice(res.invoice);
        toast.success("Инвойс создан. Откройте платёж или поделитесь ссылкой.");
        watchInvoicePaid(res.invoice.id);
      }
    } catch (err: any) {
      toast.error(err?.message || "Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  // Listen for invoice -> paid
  function watchInvoicePaid(invoiceId: string) {
    if (!invoiceId || !supabase) return;
    try {
      const chan = supabase.channel(`public:invoices:watch-${invoiceId}`);
      chan.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "invoices", filter: `id=eq.${invoiceId}` },
        (payload: any) => {
          const rec = payload?.new;
          if (!rec) return;
          if (String(rec.status) === "paid") {
            setPaid(true);
            toast.success(`Платёж получен: +${rec.amount} XTR — ${selectedTier.label}`);
            try { if (typeof chan.unsubscribe === "function") chan.unsubscribe(); } catch {}
          }
        }
      );
      chan.subscribe();
      chanRef.current = chan;
    } catch (e) {
      console.warn("[DonationForm] realtime invoice watch failed", e);
    }
  }

  useEffect(() => {
    return () => {
      try {
        if (chanRef.current && typeof chanRef.current.unsubscribe === "function") chanRef.current.unsubscribe();
      } catch {}
    };
  }, []);

  function copyInvoiceLink() {
    if (!invoice) return;
    const appLink = (globalThis as any).NEXT_PUBLIC_TELEGRAM_BOT_LINK || process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK;
    const link = appLink ? `${appLink}?start=pay_inv_${invoice.id}` : `invoice:${invoice.id}`;
    navigator.clipboard?.writeText(link).then(() => toast.success("Ссылка скопирована в буфер обмена")).catch(() => toast.error("Не удалось скопировать ссылку"));
  }

  function openInTelegram() {
    const appLink = (globalThis as any).NEXT_PUBLIC_TELEGRAM_BOT_LINK || process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK;
    if (!appLink || !invoice) { toast.error("Глубокая ссылка Telegram недоступна."); return; }
    const link = `${appLink}?start=pay_inv_${invoice.id}`;
    window.open(link, "_blank");
  }

  function onPickMarketItem(item: any) {
    if (item.id === "sauna_pack") {
      const saunaTier = TIERS.find((t) => t.id === "sauna");
      if (saunaTier) {
        setSelectedTier(saunaTier);
        setAmount(saunaTier.amount);
        toast.success(`Вы выбрали ${saunaTier.label}. Нажмите «Поддержать» чтобы создать инвойс.`);
      }
    } else {
      setAmount(item.price);
      toast.success(`Вы выбрали ${item.title}. Введите сообщение (опционально) и нажмите «Поддержать».`);
    }
  }

  return (
    <>
      <form onSubmit={handleDonate} className="space-y-3 p-3 rounded-md border border-border bg-card/80 backdrop-blur-sm" aria-live="polite">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">Поддержать стримера — выберите уровень</div>
          <div className="text-xs text-muted-foreground">Текущий выбор: <span className="font-semibold ml-1">{selectedTier.label} • {amount}★</span></div>
        </div>

        {/* Tiers grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TIERS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={selectedTier.id === t.id}
              onClick={() => { setSelectedTier(t); setAmount(t.amount); }}
              className={`p-2 rounded-md text-sm flex flex-col items-start justify-between border transition-shadow duration-200 ${selectedTier.id === t.id ? `border-primary bg-primary/8 ${t.highlight}` : "bg-card border-border"}`}
            >
              <div className="flex items-center gap-2 w-full">
                <div className="text-lg">{t.badge ?? "★"}</div>
                <div className="flex-1 text-left min-w-0">
                  <div className="font-medium text-sm truncate">{t.label}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                </div>
                <div className="font-semibold">{t.amount}★</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Input aria-label="Сумма XTR" type="number" min={1} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} className="flex-1 input-cyber" />
          <Button type="submit" className="whitespace-nowrap" disabled={loading || !!invoice}>
            {loading ? "Создаём..." : invoice ? "Инвойс готов" : "Поддержать"}
          </Button>
        </div>

        <div>
          <Input placeholder="Сообщение (опционально)" value={note} onChange={(e) => setNote(e.target.value)} className="input-cyber mt-2" aria-label="Сообщение донату" />
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">Средства — XTR. После оплаты звезды зачисляются автоматически.</div>

          {invoice && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="flex gap-2 flex-wrap items-center">
                <Button size="sm" onClick={copyInvoiceLink}>Копировать ссылку</Button>
                <Button size="sm" variant="secondary" onClick={openInTelegram}>Открыть в Telegram</Button>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap mt-1 sm:mt-0">
                {paid ? <span className="text-primary">✅ Оплачен</span> : <span>Ожидание оплаты</span>}
              </div>
            </div>
          )}
        </div>
      </form>

      <div className="mt-3">
        <MarketBox onPick={onPickMarketItem} />
      </div>
    </>
  );
}