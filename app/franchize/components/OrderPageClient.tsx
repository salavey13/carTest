"use client";

import { useMemo, useState } from "react";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { useFranchizeCart } from "../hooks/useFranchizeCart";

interface OrderPageClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  orderId: string;
  items: CatalogItemVM[];
}

const payments = ["Карта", "Наличные", "СБП"];

export function OrderPageClient({ crew, slug, orderId, items }: OrderPageClientProps) {
  const { cart } = useFranchizeCart(slug);

  const seededItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, qty]) => {
          const item = items.find((candidate) => candidate.id === itemId);
          return item ? { item, qty } : null;
        })
        .filter((entry): entry is { item: CatalogItemVM; qty: number } => Boolean(entry)),
    [cart, items],
  );
  const subtotal = seededItems.reduce((sum, entry) => sum + entry.item.pricePerDay * entry.qty, 0);

  const [deliveryMode, setDeliveryMode] = useState<"pickup" | "delivery">("pickup");
  const [payment, setPayment] = useState(payments[0]);
  const [recipient, setRecipient] = useState("");
  const [phone, setPhone] = useState("");
  const [time, setTime] = useState("");
  const [comment, setComment] = useState("");
  const [promo, setPromo] = useState("");
  const [consent, setConsent] = useState(false);

  const isValid = recipient.trim().length > 1 && phone.trim().length > 5 && time.trim().length > 0 && consent;

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
            <div className="mt-3 grid grid-cols-3 gap-2">
              {payments.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPayment(item)}
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{
                    borderColor: payment === item ? crew.theme.palette.accentMain : crew.theme.palette.borderSoft,
                    color: payment === item ? crew.theme.palette.accentMain : undefined,
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
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
          <ul className="mt-2 space-y-2 text-sm">
            {seededItems.length === 0 ? (
              <li className="text-muted-foreground">Корзина пуста — добавьте байк из каталога.</li>
            ) : (
              seededItems.map((entry) => (
                <li key={entry.item.id} className="flex justify-between gap-2">
                  <span>
                    {entry.item.title} × {entry.qty}
                  </span>
                  <span>{(entry.item.pricePerDay * entry.qty).toLocaleString("ru-RU")} ₽</span>
                </li>
              ))
            )}
          </ul>
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="flex justify-between"><span>Получение</span><span>{deliveryMode === "pickup" ? "Самовывоз" : "Доставка"}</span></p>
            <p className="mt-1 flex justify-between"><span>Оплата</span><span>{payment}</span></p>
            <p className="mt-2 flex justify-between text-base font-semibold" style={{ color: crew.theme.palette.accentMain }}>
              <span>Итого</span>
              <span>{subtotal.toLocaleString("ru-RU")} ₽</span>
            </p>
          </div>
          <button
            type="button"
            disabled={!isValid}
            className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: crew.theme.palette.accentMain, color: "#16130A" }}
          >
            Подтвердить заказ
          </button>
        </aside>
      </div>
    </section>
  );
}
