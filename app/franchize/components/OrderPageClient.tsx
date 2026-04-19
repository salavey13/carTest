"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { createFranchizeOrderCheckout } from "../actions";
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
  rentalStartDate?: string;
  rentalEndDate?: string;
  signatureName?: string;
  signatureAccepted?: boolean;
  signatureFingerprint?: string;
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

const orderFormSchema = z.object({
  recipient: z.string().trim().min(2, "Укажите имя получателя"),
  phone: z.string().trim().min(6, "Добавьте контактный номер"),
  time: z.string().trim().min(1, "Выберите удобное время"),
  comment: z.string().default(""),
  rentalStartDate: z.string().trim().min(1, "Выберите дату начала аренды"),
  signatureName: z.string().trim().min(3, "Введите ФИО для подписи"),
  payment: z.enum(["telegram_xtr", "card", "cash", "sbp"]),
  deliveryMode: z.enum(["pickup", "delivery"]),
  selectedExtras: z.array(z.string()).default([]),
  promo: z.string().default(""),
  consent: z.boolean().refine((value) => value, "Подтвердите условия аренды"),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;
const EMPTY_SELECTED_EXTRAS: string[] = [];

export function OrderPageClient({ crew, slug, orderId, items }: OrderPageClientProps) {
  const { user } = useAppContext();
  const { cartLines, subtotal } = useFranchizeCartLines(slug, items);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    mode: "onChange",
    defaultValues: {
      recipient: "",
      phone: "",
      time: "",
      comment: "",
      rentalStartDate: "",
      signatureName: "",
      promo: "",
      selectedExtras: [],
      payment: payments[0].id,
      deliveryMode: "pickup",
      consent: false,
    },
  });
  const {
    register,
    watch,
    setValue,
    setFocus,
    handleSubmit,
    formState: { errors, isValid },
  } = form;
  const recipient = watch("recipient") ?? "";
  const phone = watch("phone") ?? "";
  const time = watch("time") ?? "";
  const comment = watch("comment") ?? "";
  const rentalStartDate = watch("rentalStartDate") ?? "";
  const signatureName = watch("signatureName") ?? "";
  const payment = watch("payment") as PaymentMethod;
  const deliveryMode = watch("deliveryMode");
  const selectedExtras = watch("selectedExtras") ?? EMPTY_SELECTED_EXTRAS;
  const consent = Boolean(watch("consent"));
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
  const maxRentalDays = useMemo(() => Math.max(1, ...cartLines.map((line) => line.rentalDays ?? 1)), [cartLines]);
  const rentalEndDate = useMemo(() => {
    if (!rentalStartDate) return "";
    const start = new Date(rentalStartDate);
    if (Number.isNaN(start.getTime())) return "";
    return addDays(start, maxRentalDays - 1).toISOString().slice(0, 10);
  }, [maxRentalDays, rentalStartDate]);
  const requiresTelegram = payment === "telegram_xtr";
  const hasTelegramUser = Boolean(user?.id);
  const canSubmit = isValid && !isCartEmpty && (!requiresTelegram || hasTelegramUser);
  const checkoutMilestones = useMemo(
    () => [
      { id: "cart", label: "Байк выбран", done: !isCartEmpty },
      { id: "contact", label: "Контакт заполнен", done: recipient.trim().length > 1 && phone.trim().length > 5 && time.trim().length > 0 },
      { id: "dates", label: "Период аренды выбран", done: Boolean(rentalStartDate) },
      { id: "signature", label: "Электронная подпись задана", done: signatureName.trim().length > 2 },
      { id: "consent", label: "Условия подтверждены", done: consent },
    ],
    [consent, isCartEmpty, phone, recipient, rentalStartDate, signatureName, time],
  );
  const completedMilestones = checkoutMilestones.filter((step) => step.done).length;
  const readinessPercent = Math.round((completedMilestones / checkoutMilestones.length) * 100);
  const checkoutBlockers = useMemo(
    () => [
      { id: "cart", label: "Добавьте хотя бы один байк в корзину", active: isCartEmpty },
      { id: "recipient", label: "Укажите имя получателя", active: recipient.trim().length <= 1 },
      { id: "phone", label: "Добавьте контактный номер", active: phone.trim().length <= 5 },
      { id: "time", label: "Выберите удобное время", active: time.trim().length === 0 },
      { id: "dates", label: "Выберите дату начала аренды", active: !rentalStartDate },
      { id: "signature", label: "Введите ФИО для электронной подписи", active: signatureName.trim().length <= 2 },
      { id: "consent", label: "Подтвердите условия аренды", active: !consent },
      { id: "telegram", label: "Для Stars откройте страницу через Telegram WebApp", active: requiresTelegram && !hasTelegramUser },
    ].filter((item) => item.active),
    [consent, hasTelegramUser, isCartEmpty, phone, recipient, rentalStartDate, requiresTelegram, signatureName, time],
  );
  const nextAction = checkoutBlockers[0];

  const submitPayload = useMemo<CheckoutPayload>(
    () => ({
      orderId,
      recipient: recipient.trim(),
      phone: phone.trim(),
      time: time.trim(),
      comment: comment.trim(),
      rentalStartDate: rentalStartDate || undefined,
      rentalEndDate: rentalEndDate || undefined,
      signatureName: signatureName.trim() || undefined,
      signatureAccepted: consent,
      signatureFingerprint: user?.id ? `tg:${user.id}` : "manual-sign",
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
    [cartLines, comment, consent, deliveryMode, extrasTotal, orderId, payment, phone, recipient, rentalEndDate, rentalStartDate, selectedExtraItems, signatureName, time, totalAmount, user?.id],
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

  const onSubmitValid = (values: OrderFormValues) => {
    if (isSubmitting || !canSubmit) {
      return;
    }

    startSubmitTransition(async () => {
      const result = await createFranchizeOrderCheckout({
        slug,
        orderId,
        telegramUserId: String(user?.id ?? "manual-order"),
        recipient: values.recipient.trim(),
        phone: values.phone.trim(),
        time: values.time.trim(),
        comment: values.comment.trim(),
        rentalStartDate: submitPayload.rentalStartDate,
        rentalEndDate: submitPayload.rentalEndDate,
        signatureName: values.signatureName.trim(),
        signatureAccepted: values.consent,
        signatureFingerprint: user?.id ? `tg:${user.id}` : "manual-sign",
        payment: values.payment,
        delivery: values.deliveryMode,
        subtotal,
        extrasTotal: submitPayload.extrasTotal,
        totalAmount: submitPayload.totalAmount,
        extras: submitPayload.extras,
        cartLines: submitPayload.cartLines,
      });

      if (!result.success) {
        toast.error(result.error ?? "Не удалось отправить заказ.");
        return;
      }

      if (values.payment === "telegram_xtr") {
        toast.success("XTR-счёт отправлен в Telegram. После оплаты откроется franchize rental flow ⭐");
        return;
      }

      toast.success("Заказ отправлен администратору вместе с DOC-файлом. Скоро с вами свяжутся.");
    });
  };

  const focusBlockerControl = (blockerId: string) => {
    if (blockerId === "recipient") {
      setFocus("recipient");
      return;
    }
    if (blockerId === "phone") {
      setFocus("phone");
      return;
    }
    if (blockerId === "time") {
      setFocus("time");
      return;
    }
    if (blockerId === "consent") {
      setFocus("consent");
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

      <form className="mt-6 grid gap-4 md:grid-cols-[1fr_300px]" onSubmit={handleSubmit(onSubmitValid)}>
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
                  onClick={() => setValue("deliveryMode", value as "pickup" | "delivery", { shouldValidate: true })}
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
              <input className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Имя и фамилия" {...register("recipient")} />
              <input className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Телефон" {...register("phone")} />
              <input className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Удобное время" {...register("time")} />
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs" style={surface.mutedText}>
                  Дата старта аренды
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                    {...register("rentalStartDate")}
                  />
                </label>
                <label className="text-xs" style={surface.mutedText}>
                  Дата окончания (авто)
                  <input
                    type="date"
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm opacity-80"
                    style={fieldStyle}
                    value={rentalEndDate}
                    readOnly
                  />
                </label>
              </div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                placeholder="ФИО для электронной подписи"
                {...register("signatureName")}
              />
              <textarea className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Комментарий к заказу" {...register("comment")} />
              {errors.recipient || errors.phone || errors.time || errors.rentalStartDate || errors.signatureName ? (
                <p className="text-xs text-rose-300">
                  {errors.recipient?.message || errors.phone?.message || errors.time?.message || errors.rentalStartDate?.message || errors.signatureName?.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border p-4" style={surface.card}>
            <p className="text-sm font-medium">Оплата и промокод</p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {payments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setValue("payment", item.id, { shouldValidate: true })}
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
              <input className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Промокод" {...register("promo")} />
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
                      setValue(
                        "selectedExtras",
                        checked ? selectedExtras.filter((id) => id !== extra.id) : [...selectedExtras, extra.id],
                        { shouldValidate: true },
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
            <input type="checkbox" className="mt-0.5" {...register("consent")} />
            <span>Согласен с условиями аренды и подтверждаю электронную подпись в Telegram WebApp.</span>
          </label>
          {errors.consent ? <p className="text-xs text-rose-300">{errors.consent.message}</p> : null}
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
            <p className="mt-1 flex justify-between"><span>Период</span><span>{rentalStartDate || "—"} → {rentalEndDate || "—"}</span></p>
            <p className="mt-2 flex justify-between"><span>Подытог</span><span>{subtotal.toLocaleString("ru-RU")} ₽</span></p>
            <p className="mt-1 flex justify-between"><span>Доп. опции</span><span>{extrasTotal.toLocaleString("ru-RU")} ₽</span></p>
            <p className="mt-2 flex justify-between text-base font-semibold text-[var(--order-accent)]">
              <span>Итого</span>
              <span>{totalAmount.toLocaleString("ru-RU")} ₽</span>
            </p>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="mt-4 w-full rounded-xl bg-[var(--order-accent)] px-4 py-3 text-sm font-semibold text-[var(--order-accent-contrast)] transition hover:brightness-105 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={focusRingOutlineStyle(crew.theme)}
          >
            {submitLabel}
          </button>
          <p className="mt-2 text-xs" style={surface.mutedText}>{submitHint}</p>
        </aside>
      </form>
    </section>
  );
}
