"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { createFranchizeOrderInvoice, submitFranchizeOrderNotification } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
import { crewPaletteForSurface, focusRingOutlineStyle } from "../lib/theme";

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

const orderExtras = [
  { id: "priority-prep", label: "Приоритетная подготовка", amount: 1200 },
  { id: "full-insurance", label: "Расширенная страховка", amount: 1800 },
  { id: "hotel-dropoff", label: "Доставка к отелю", amount: 900 },
] as const;

type CheckoutPayload = {
  orderId: string;
  recipient: string;
  phone: string;
  time: string;
  comment: string;
  payment: PaymentMethod;
  delivery: "pickup" | "delivery";
  extras: Array<{ id: string; label: string; amount: number }>;
  extrasTotal: number;
  totalAmount: number;
  cartLines: Array<{
    lineId: string;
    itemId: string;
    qty: number;
    pricePerDay: number;
    lineTotal: number;
    options: {
      package: string;
      duration: string;
      perk: string;
      auction: string;
    };
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
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const recipientRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const surface = crewPaletteForSurface(crew.theme);
  const fieldStyle = {
    borderColor: "var(--order-border)",
    backgroundColor: `${crew.theme.palette.bgBase}a8`,
    color: crew.theme.palette.textPrimary,
  };

  const isCartEmpty = cartLines.length === 0;
  const selectedExtraItems = useMemo(
    () => orderExtras.filter((extra) => selectedExtras.includes(extra.id)),
    [selectedExtras],
  );
  const extrasTotal = useMemo(
    () => selectedExtraItems.reduce((sum, extra) => sum + extra.amount, 0),
    [selectedExtraItems],
  );
  const totalAmount = subtotal + extrasTotal;
  const isValidForm = recipient.trim().length > 1 && phone.trim().length > 5 && time.trim().length > 0 && consent;
  const requiresTelegram = payment === "telegram_xtr";
  const hasTelegramUser = Boolean(user?.id);
  const canSubmit = isValidForm && !isCartEmpty && (!requiresTelegram || hasTelegramUser);
  const checkoutMilestones = useMemo(
    () => [
      { id: "cart", label: "Байк выбран", done: !isCartEmpty },
      { id: "contact", label: "Контакт заполнен", done: recipient.trim().length > 1 && phone.trim().length > 5 && time.trim().length > 0 },
      { id: "consent", label: "Условия подтверждены", done: consent },
    ],
    [consent, isCartEmpty, phone, recipient, time],
  );
  const completedMilestones = checkoutMilestones.filter((step) => step.done).length;
  const readinessPercent = Math.round((completedMilestones / checkoutMilestones.length) * 100);
  const checkoutBlockers = useMemo(
    () => [
      { id: "cart", label: "Добавьте хотя бы один байк в корзину", active: isCartEmpty },
      { id: "recipient", label: "Укажите имя получателя", active: recipient.trim().length <= 1 },
      { id: "phone", label: "Добавьте контактный номер", active: phone.trim().length <= 5 },
      { id: "time", label: "Выберите удобное время", active: time.trim().length === 0 },
      { id: "consent", label: "Подтвердите условия аренды", active: !consent },
      { id: "telegram", label: "Для Stars откройте страницу через Telegram WebApp", active: requiresTelegram && !hasTelegramUser },
    ].filter((item) => item.active),
    [consent, hasTelegramUser, isCartEmpty, phone, recipient, requiresTelegram, time],
  );
  const nextAction = checkoutBlockers[0];

  const submitPayload = useMemo<CheckoutPayload>(
    () => ({
      orderId,
      recipient: recipient.trim(),
      phone: phone.trim(),
      time: time.trim(),
      comment: comment.trim(),
      payment,
      delivery: deliveryMode,
      extras: selectedExtraItems.map((extra) => ({ id: extra.id, label: extra.label, amount: extra.amount })),
      extrasTotal,
      totalAmount,
      cartLines: cartLines.map((line) => ({
        lineId: line.lineId,
        itemId: line.itemId,
        qty: line.qty,
        pricePerDay: line.pricePerDay,
        lineTotal: line.lineTotal,
        options: line.options,
      })),
    }),
    [cartLines, comment, deliveryMode, extrasTotal, orderId, payment, phone, recipient, selectedExtraItems, time, totalAmount],
  );

  const submitLabel = isSubmitting
    ? "Подготавливаем оплату..."
    : payment === "telegram_xtr"
      ? "Подтвердить и получить XTR-счёт"
      : "Подтвердить заказ";

  const submitHint = isSubmitting
    ? "Проверяем данные и отправляем действие оплаты. Обычно это занимает несколько секунд."
    : isCartEmpty
      ? "Добавьте хотя бы один байк в корзину, чтобы перейти к подтверждению."
      : !consent
        ? "Подтвердите согласие с условиями аренды, чтобы отправить заказ."
        : requiresTelegram && !hasTelegramUser
          ? "Для оплаты Stars откройте оформление из Telegram WebApp и повторите попытку."
          : payment === "telegram_xtr"
            ? "XTR-счёт будет рассчитан как 1% от полной суммы (с учётом доп. опций)."
            : "Проверьте контакты и способ получения, затем подтверждайте заказ.";

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    startSubmitTransition(async () => {
      const notifyResult = await submitFranchizeOrderNotification({
        slug,
        orderId,
        telegramUserId: String(user?.id ?? "manual-order"),
        recipient: submitPayload.recipient,
        phone: submitPayload.phone,
        time: submitPayload.time,
        comment: submitPayload.comment,
        payment: submitPayload.payment,
        delivery: submitPayload.delivery,
        subtotal,
        extrasTotal: submitPayload.extrasTotal,
        totalAmount: submitPayload.totalAmount,
        extras: submitPayload.extras,
        cartLines: submitPayload.cartLines,
      });

      if (!notifyResult.success) {
        toast.error(notifyResult.error ?? "Не удалось отправить уведомление админу.");
        return;
      }

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
          extrasTotal: submitPayload.extrasTotal,
          totalAmount: submitPayload.totalAmount,
          extras: submitPayload.extras,
          cartLines: submitPayload.cartLines,
        });

        if (!result.success) {
          toast.error(result.error ?? "Не удалось отправить XTR-счёт.");
          return;
        }

        toast.success("XTR-счёт отправлен в Telegram. После оплаты откроется franchize rental flow ⭐");
        return;
      }

      toast.success("Заказ отправлен администратору вместе с DOC-файлом. Скоро с вами свяжутся.");
    });
  };

  const focusBlockerControl = (blockerId: string) => {
    if (blockerId === "recipient") {
      recipientRef.current?.focus();
      return;
    }
    if (blockerId === "phone") {
      phoneRef.current?.focus();
      return;
    }
    if (blockerId === "time") {
      timeRef.current?.focus();
      return;
    }
    if (blockerId === "consent") {
      consentRef.current?.focus();
    }
  };

  return (
    <section
      className="mx-auto w-full max-w-4xl px-4 py-6"
      style={{
        ["--order-accent" as string]: crew.theme.palette.accentMain,
        ["--order-border" as string]: crew.theme.palette.borderSoft,
        ["--order-muted" as string]: crew.theme.palette.textSecondary,
        ["--order-accent-contrast" as string]: "#16130A",
        ["--order-accent-on" as string]: crew.theme.palette.accentTextOn,
        ["--order-text-primary" as string]: crew.theme.palette.textPrimary,
        ["--order-text-muted" as string]: crew.theme.palette.textMuted,
        ["--order-accent-soft" as string]: `${crew.theme.palette.accentMain}1f`,
        ["--order-progress-track" as string]: `${crew.theme.palette.borderSoft}80`,
        ["--order-progress-gradient-end" as string]: crew.theme.palette.accentMainHover,
      }}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--order-accent)]">
        /franchize/{slug}/order/{orderId}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Оформление заказа</h1>

      <div className="mt-4 flex items-center gap-2 text-xs" style={surface.mutedText}>
        {[
          ["1", "Корзина"],
          ["2", "Контакты"],
          ["3", "Подтверждение"],
        ].map(([step, label], index) => (
          <div key={step} className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--order-border)]">{step}</span>
            <span>{label}</span>
            {index < 2 ? <span className="mx-1">→</span> : null}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="rounded-2xl border p-4" style={surface.card}>
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
                  className="rounded-xl border px-3 py-2 text-sm transition hover:opacity-90 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    borderColor: deliveryMode === value ? "var(--order-accent)" : "var(--order-border)",
                    color: deliveryMode === value ? "var(--order-accent)" : undefined,
                    ...focusRingOutlineStyle(crew.theme),
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={surface.card}>
            <p className="text-sm font-medium">Данные получателя</p>
            <div className="mt-3 space-y-3">
              <input ref={recipientRef} className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Имя и фамилия" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              <input ref={phoneRef} className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Телефон" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <input ref={timeRef} className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Удобное время" value={time} onChange={(e) => setTime(e.target.value)} />
              <textarea className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Комментарий к заказу" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={surface.card}>
            <p className="text-sm font-medium">Оплата и промокод</p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {payments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPayment(item.id)}
                  className="rounded-xl border px-3 py-2 text-left text-sm transition hover:opacity-90 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    borderColor: payment === item.id ? "var(--order-accent)" : "var(--order-border)",
                    color: payment === item.id ? "var(--order-accent)" : undefined,
                    ...focusRingOutlineStyle(crew.theme),
                  }}
                >
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs" style={surface.mutedText}>{item.description}</p>
                </button>
              ))}
            </div>
            {requiresTelegram && !hasTelegramUser ? (
              <p className="mt-2 text-xs" style={surface.mutedText}>Для оплаты в Stars откройте оформление из Telegram WebApp.</p>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Промокод" value={promo} onChange={(e) => setPromo(e.target.value)} />
              <button type="button" className="rounded-xl border border-[var(--order-border)] px-3 text-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={focusRingOutlineStyle(crew.theme)}>
                Применить
              </button>
            </div>
          </div>


          <div className="rounded-2xl border p-4" style={surface.card}>
            <p className="text-sm font-medium">Доп. опции к заказу</p>
            <div className="mt-3 space-y-2">
              {orderExtras.map((extra) => {
                const checked = selectedExtras.includes(extra.id);
                return (
                  <button
                    key={extra.id}
                    type="button"
                    onClick={() =>
                      setSelectedExtras((prev) =>
                        checked ? prev.filter((id) => id !== extra.id) : [...prev, extra.id],
                      )
                    }
                    className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition hover:opacity-90 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      borderColor: checked ? "var(--order-accent)" : "var(--order-border)",
                      backgroundColor: checked ? "var(--order-accent-soft)" : undefined,
                      ...focusRingOutlineStyle(crew.theme),
                    }}
                  >
                    <span>{extra.label}</span>
                    <span className="font-semibold text-[var(--order-accent)]">+{extra.amount.toLocaleString("ru-RU")} ₽</span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-xl border p-3 text-sm" style={surface.card}>
            <input ref={consentRef} type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Согласен с условиями аренды и обработкой персональных данных.</span>
          </label>
        </div>

        <aside className="h-fit rounded-2xl border p-4" style={surface.card}>
          <p className="text-sm" style={surface.mutedText}>Заказ #{orderId}</p>
          <div className="mt-3 rounded-xl border border-[var(--order-border)] px-3 py-2" style={surface.subtleCard}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-[0.18em]" style={surface.mutedText}>Checkout vibe</p>
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  color: completedMilestones === checkoutMilestones.length ? "var(--order-accent-on)" : "var(--order-accent)",
                  backgroundColor:
                    completedMilestones === checkoutMilestones.length
                      ? crew.theme.palette.accentMain
                      : `${crew.theme.palette.accentMain}1f`,
                }}
              >
                {completedMilestones === checkoutMilestones.length ? "Готово ✨" : `${completedMilestones}/${checkoutMilestones.length}`}
              </span>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs">
              {checkoutMilestones.map((step) => (
                <li key={step.id} className={`flex items-center gap-2 ${step.done ? "text-[var(--order-text-primary)]" : "text-[var(--order-muted)]"}`}>
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]"
                    style={{
                      borderColor: step.done ? "var(--order-accent)" : "var(--order-border)",
                      color: step.done ? "var(--order-accent)" : "var(--order-text-muted)",
                    }}
                  >
                    {step.done ? "✓" : "•"}
                  </span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--order-progress-track)]">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${readinessPercent}%`,
                  background: "linear-gradient(90deg, var(--order-accent) 0%, var(--order-progress-gradient-end) 100%)",
                }}
              />
            </div>
            <p className="mt-2 text-[11px]" style={surface.mutedText}>Готовность к подтверждению: {readinessPercent}%</p>
          </div>

          <div className="mt-3 rounded-xl border border-[var(--order-border)] p-3" style={surface.subtleCard}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--order-accent)]">Checkout copilot</p>
              <span className="rounded-full bg-[var(--order-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--order-accent)]">
                {checkoutBlockers.length === 0 ? "ready" : `${checkoutBlockers.length} blockers`}
              </span>
            </div>
            {checkoutBlockers.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--order-muted)]">
                Всё собрано. Проверьте способ оплаты и жмите подтверждение 🚀
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-xs">
                {checkoutBlockers.map((blocker) => (
                  <li key={blocker.id} className="flex items-center gap-2 text-[var(--order-muted)]">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--order-accent-soft)] text-[10px] text-[var(--order-accent)]">
                      !
                    </span>
                    <span>{blocker.label}</span>
                  </li>
                ))}
              </ul>
            )}
            {nextAction && ["recipient", "phone", "time", "consent"].includes(nextAction.id) ? (
              <button
                type="button"
                onClick={() => focusBlockerControl(nextAction.id)}
                className="mt-3 w-full rounded-lg border border-[var(--order-accent)] px-3 py-2 text-xs font-medium text-[var(--order-accent)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={focusRingOutlineStyle(crew.theme)}
              >
                Исправить следующий шаг
              </button>
            ) : null}
          </div>

          {isCartEmpty ? (
            <div className="mt-3 rounded-xl border border-dashed p-3 text-sm" style={surface.subtleCard}>
              <p>Корзина пуста — добавьте байк из каталога перед оформлением.</p>
              <Link
                href={`/franchize/${slug}`}
                className="mt-3 inline-flex font-medium text-[var(--order-accent)] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--order-accent)]"
              >
                Вернуться в каталог
              </Link>
            </div>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {cartLines.map((line) => (
                <li key={line.lineId} className="flex justify-between gap-2">
                  <span>
                    {line.item?.title ?? "Позиция недоступна"} × {line.qty}
                    <span className="block text-[11px]" style={surface.mutedText}>{line.options.package} · {line.options.duration} · {line.options.perk} · {line.options.auction}</span>
                  </span>
                  <span>{line.lineTotal.toLocaleString("ru-RU")} ₽</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-3 border-t border-[var(--order-border)] pt-3 text-sm">
            <p className="flex justify-between"><span>Получение</span><span>{deliveryMode === "pickup" ? "Самовывоз" : "Доставка"}</span></p>
            <p className="mt-1 flex justify-between"><span>Оплата</span><span>{payments.find((item) => item.id === payment)?.label ?? payment}</span></p>
            <p className="mt-2 flex justify-between"><span>Подытог</span><span>{subtotal.toLocaleString("ru-RU")} ₽</span></p>
            <p className="mt-1 flex justify-between"><span>Доп. опции</span><span>{extrasTotal.toLocaleString("ru-RU")} ₽</span></p>
            <p className="mt-2 flex justify-between text-base font-semibold text-[var(--order-accent)]">
              <span>Итого</span>
              <span>{totalAmount.toLocaleString("ru-RU")} ₽</span>
            </p>
          </div>

          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            className="mt-4 w-full rounded-xl bg-[var(--order-accent)] px-4 py-3 text-sm font-semibold text-[var(--order-accent-contrast)] transition hover:brightness-105 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={focusRingOutlineStyle(crew.theme)}
            onClick={handleSubmit}
          >
            {submitLabel}
          </button>
          <p className="mt-2 text-xs" style={surface.mutedText}>{submitHint}</p>
        </aside>
      </div>
    </section>
  );
}
