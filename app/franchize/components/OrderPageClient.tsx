"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { createFranchizeOrderInvoice } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";

interface OrderPageClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  orderId: string;
  items: CatalogItemVM[];
}

const payments = [
  { id: "telegram_xtr", label: "Telegram Stars (XTR)", description: "Счёт в Telegram (быстрый anti-spam tip flow)" },
  { id: "card", label: "Карта", description: "Оплата картой при подтверждении" },
  { id: "cash", label: "Наличные", description: "Оплата при получении" },
  { id: "sbp", label: "СБП", description: "Перевод по QR-коду" },
] as const;

type PaymentMethod = (typeof payments)[number]["id"];

type CheckoutPayload = {
  orderId: string;
  recipient: string;
  phone: string;
  time: string;
  comment: string;
  payment: PaymentMethod;
  delivery: "pickup" | "delivery";
  cartLines: Array<{
    itemId: string;
    qty: number;
    pricePerDay: number;
    lineTotal: number;
  }>;
};

export function OrderPageClient({ crew, slug, orderId, items }: OrderPageClientProps) {
  const { user } = useAppContext();
  const { cartLines, subtotal } = useFranchizeCartLines(slug, items);
  const [isSubmitting, startSubmitTransition] = useTransition();

  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "delivery">("pickup");
  const [payment, setPayment] = useState<PaymentMethod>(payments[0].id);
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [time, setTime] = useState("");
  const [comment, setComment] = useState("");
  const [promo, setPromo] = useState("");
  const [consent, setConsent] = useState(false);

  const isCartEmpty = cartLines.length === 0;
  const isValidForm = recipient.trim().length > 1 && phone.trim().length > 5 && time.trim().length > 0 && consent;
  const requiresTelegram = payment === "telegram_xtr";
  const hasTelegramUser = Boolean(user?.id);
  const canSubmit = isValidForm && !isCartEmpty && (!requiresTelegram || hasTelegramUser);

  const submitPayload = useMemo<CheckoutPayload>(
    () => ({
      orderId,
      recipient: recipient.trim(),
      phone: phone.trim(),
      time: time.trim(),
      comment: comment.trim(),
      payment,
      delivery: deliveryMode,
      cartLines: cartLines.map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        pricePerDay: line.pricePerDay,
        lineTotal: line.lineTotal,
      })),
    }),
    [cartLines, comment, deliveryMode, orderId, payment, phone, recipient, time],
  );

  const submitLabel = isSubmitting
    ? "Подготавливаем оплату..."
    : payment === "telegram_xtr"
      ? "Подтвердить и получить XTR-счёт"
      : "Подтвердить заказ";

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    startSubmitTransition(async () => {
      if (payment === "telegram_xtr") {
        if (!user?.id) {
          toast.error("Для XTR-счёта откройте страницу из Telegram WebApp.");
          return;
        }

        const result = await createFranchizeOrderInvoice({
          slug,
          orderId,
          telegramUserId: String(user.id),
          recipient: submitPayload.recipient,
          phone: submitPayload.phone,
          time: submitPayload.time,
          comment: submitPayload.comment,
          payment: submitPayload.payment,
          delivery: submitPayload.delivery,
          subtotal,
          cartLines: submitPayload.cartLines,
        });

        if (!result.success) {
          toast.error(result.error ?? "Не удалось отправить XTR-счёт.");
          return;
        }

        toast.success("XTR-счёт отправлен в Telegram. Проверьте чат и завершите оплату ⭐");
        return;
      }

      // backend submit will be connected in a separate step
      console.info("checkout payload draft", submitPayload);
      toast.info("Черновой payload собран. Бэкенд submit подключим следующим шагом.");
    });
  };

  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-6">
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: crew.theme.palette.accentMain }}>
        /franchize/{slug}/order/{orderId}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Оформление заказа</h1>

      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        {[
          ["1", "Корзина"],
          ["2", "Контакты"],
          ["3", "Подтверждение"],
        ].map(([step, label], index) => (
          <div key={step} className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border">{step}</span>
            <span>{label}</span>
            {index < 2 ? <span className="mx-1">→</span> : null}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Способ получения</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["pickup", "Самовывоз"],
                ["delivery", "Доставка"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDeliveryMode(value as "pickup" | "delivery")}
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{
                    borderColor: deliveryMode === value ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                    color: deliveryMode === value ? crew.theme.palette.accentMain : undefined,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Данные получателя</p>
            <div className="mt-3 space-y-3">
              <input className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Имя и фамилия" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              <input className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Удобное время" value={time} onChange={(e) => setTime(e.target.value)} />
              <textarea className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Комментарий к заказу" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Оплата и промокод</p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {payments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPayment(item.id)}
                  className="rounded-xl border px-3 py-2 text-left text-sm"
                  style={{
                    borderColor: payment === item.id ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                    color: payment === item.id ? crew.theme.palette.accentMain : undefined,
                  }}
                >
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </button>
              ))}
            </div>
            {requiresTelegram && !hasTelegramUser ? (
              <p className="mt-2 text-xs text-muted-foreground">Для оплаты в Stars откройте оформление из Telegram WebApp.</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" placeholder="Промокод" value={promo} onChange={(e) => setPromo(e.target.value)} />
              <button type="button" className="rounded-xl border border-border px-3 text-sm">
                Применить
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Согласен с условиями аренды и обработкой персональных данных.</span>
          </label>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Заказ #{orderId}</p>

          {isCartEmpty ? (
            <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
              <p>Корзина пуста — добавьте байк из каталога перед оформлением.</p>
              <Link
                href={`/franchize/${slug}`}
                className="mt-3 inline-flex font-medium underline-offset-4 hover:underline"
                style={{ color: crew.theme.palette.accentMain }}
              >
                Вернуться в каталог
              </Link>
            </div>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {cartLines.map((line) => (
                <li key={line.itemId} className="flex justify-between gap-2">
                  <span>
                    {line.item?.title ?? "Позиция недоступна"} × {line.qty}
                  </span>
                  <span>{line.lineTotal.toLocaleString("ru-RU")} ₽</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="flex justify-between"><span>Получение</span><span>{deliveryMode === "pickup" ? "Самовывоз" : "Доставка"}</span></p>
            <p className="mt-1 flex justify-between"><span>Оплата</span><span>{payments.find((item) => item.id === payment)?.label ?? payment}</span></p>
            <p className="mt-2 flex justify-between text-base font-semibold" style={{ color: crew.theme.palette.accentMain }}>
              <span>Итого</span>
              <span>{subtotal.toLocaleString("ru-RU")} ₽</span>
            </p>
          </div>

          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}
            onClick={handleSubmit}
          >
            {submitLabel}
          </button>
        </aside>
      </div>
    </section>
  );
}
