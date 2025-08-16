"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppContext } from "@/contexts/AppContext";
import { useAppToast } from "@/hooks/useAppToast";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import MarketBox from "./MarketBox";

type Tier = {
  id: string;
  label: string;
  amount: number;
  description: string;
  badge?: string;
  highlight?: string;
  metadata?: Record<string, any>;
};

const TIERS: Tier[] = [
  { id: "tip", label: "Чаевые", amount: 50, description: "Небольшая поддержка", badge: "💖", highlight: "shadow-pink-glow", metadata: { kind: "tip" } },
  { id: "supporter", label: "Поддержка", amount: 150, description: "Благодарность + имя в списке", badge: "👏", highlight: "shadow-blue-glow", metadata: { kind: "support" } },
  { id: "vip", label: "VIP", amount: 300, description: "VIP-роль в чате + громкое спасибо", badge: "⭐", highlight: "shadow-purple-glow", metadata: { kind: "vip", vipDays: 7 } },
  { id: "sauna", label: "Сауна Пак", amount: 500, description: "Полотенце и шлёпанцы + стикер", badge: "🧖", highlight: "shadow-yellow-glow", metadata: { kind: "market", sku: "sauna_pack" } },
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
      toast.success(`Вы выбрали ${item.title}. Введите сообщение и нажмите «Поддержать».`);
    }
  }

  // background image (dark vibe)
  const bgUrl = "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1600&q=60";

  return (
    <>
      <form
        onSubmit={handleDonate}
        className="space-y-3 p-3 rounded-md border border-border relative overflow-hidden"
        aria-live="polite"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(6,6,10,0.6) 0%, rgba(20,22,29,0.7) 40%, rgba(10,10,14,0.85) 100%), url('${bgUrl}')`,
          backgroundBlendMode: "overlay",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">Поддержать стримера — выберите уровень</div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">Выбран: <span className="font-semibold ml-1">{selectedTier.label} • {amount}★</span></div>
          </div>

          {/* Tiers grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={selectedTier.id === t.id}
                onClick={() => { setSelectedTier(t); setAmount(t.amount); }}
                className={`p-2 rounded-md text-sm flex flex-col items-start justify-between border transition-shadow duration-200 min-h-[64px] ${selectedTier.id === t.id ? `border-primary bg-primary/10 ${t.highlight}` : "bg-card border-border"}`}
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

          <div className="flex gap-2 mt-2 flex-wrap">
            <Input
              aria-label="Сумма XTR"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="flex-1 input-cyber min-w-0"
            />
            <Button
              type="submit"
              className="whitespace-nowrap shrink-0"
              disabled={loading || !!invoice}
            >
              {loading ? "Создаём..." : invoice ? "Инвойс готов" : "Поддержать"}
            </Button>
          </div>

          <div className="mt-2">
            <Input
              placeholder="Сообщение (опционально)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-cyber mt-0"
              aria-label="Сообщение донату"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center items-stretch justify-between gap-3 mt-3">
            <div className="text-xs text-muted-foreground">Средства — XTR. После оплаты звезды зачисляются автоматически.</div>

            {invoice ? (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={copyInvoiceLink}
                  className="px-3 py-1 rounded-md border border-border text-sm w-full sm:w-auto text-left sm:text-center"
                >
                  Копировать ссылку
                </button>
                <button
                  type="button"
                  onClick={openInTelegram}
                  className="px-3 py-1 rounded-md border border-border text-sm w-full sm:w-auto text-left sm:text-center"
                >
                  Открыть в Telegram
                </button>
                <div className="text-xs text-muted-foreground w-full sm:w-auto text-left sm:text-right">
                  {paid ? <span className="text-primary font-semibold">✅ Оплачен</span> : <span>Ожидание оплаты</span>}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground mt-1 sm:mt-0">Создайте инвойс, чтобы получить ссылку для оплаты.</div>
            )}
          </div>
        </div>
      </form>

      <div className="mt-3 relative z-10">
        <MarketBox onPick={onPickMarketItem} />
      </div>
    </>
  );
}