"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { addDays } from "date-fns";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { checkFranchizeCarsAvailability, createFranchizeOrderCheckout, recordFranchizeCheckoutRecoverySnapshot, validateFranchizePromoCode } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
import { crewPaletteForSurface, focusRingOutlineStyle } from "../lib/theme";
import { getTelegramHandleHref, getTelegramWebAppFallbackHref } from "../lib/telegram-links";
import { getFranchizeFormPrefillAction, getFranchizeUserRentalSecretsAction } from "../profile-actions";

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

const beginnerSafetyQuiz = [
  {
    id: "gear",
    question: "Перед выездом новичок едет только в шлеме, перчатках и закрытой обуви?",
    correct: true,
  },
  {
    id: "speed",
    question: "В колонне можно обгонять ведущего райдера, если кажется, что темп слишком медленный?",
    correct: false,
  },
  {
    id: "meetup",
    question: "Если отстал или остановился, лучше поставить meetup-точку/написать экипажу, а не догонять на максимальной скорости?",
    correct: true,
  },
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
  promoCode?: string;
  promoTitle?: string;
  promoDiscount: number;
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
  depositAmount: number;
  checkoutBlockers: Array<{ id: string; label: string }>;
  safetyQuizPassed: boolean;
  pickupAddress: string;
  requiredDocs: string[];
  flowType: "rental" | "sale" | "mixed";
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

type AppliedPromo = {
  code: string;
  title: string;
  discountAmount: number;
  description: string;
  baseAmount: number;
};

function normalizePromoCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function OrderPageClient({ crew, slug, orderId, items }: OrderPageClientProps) {
  const { user, dbUser } = useAppContext();
  const { cartLines, subtotal } = useFranchizeCartLines(slug, items);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [paymentRetryHint, setPaymentRetryHint] = useState<string | null>(null);
  const [isPromoValidating, setIsPromoValidating] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoMessage, setPromoMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [safetyAnswers, setSafetyAnswers] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(beginnerSafetyQuiz.map((item) => [item.id, null])),
  );
  const [safetyPersisted, setSafetyPersisted] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [returningUserLastRental, setReturningUserLastRental] = useState<string | null>(null);
  const lastSubmitFingerprintRef = useRef<string | null>(null);
  const lastRecoveryFingerprintRef = useRef<string | null>(null);
  const recoveryDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const promo = watch("promo") ?? "";
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
  const saleLinesCount = useMemo(() => cartLines.filter((line) => line.saleAvailable).length, [cartLines]);
  const flowType: "rental" | "sale" | "mixed" = saleLinesCount === 0 ? "rental" : saleLinesCount === cartLines.length ? "sale" : "mixed";
  const flowLabel = flowType === "sale" ? "покупки" : flowType === "mixed" ? "аренды/покупки" : "аренды";
  const catalogHref = `/franchize/${slug}`;
  const profileHref = `/franchize/${slug}/profile`;
  const contactsHref = `/franchize/${slug}/contacts`;
  const telegramSupportHref = getTelegramHandleHref(crew.contacts.telegram);
  const telegramWebAppFallbackHref = getTelegramWebAppFallbackHref("franchize", slug, crew.contacts.telegramBotUsername);
  const selectedExtraItems = useMemo(
    () => orderExtras.filter((extra) => selectedExtras.includes(extra.id)),
    [selectedExtras],
  );
  const extrasTotal = useMemo(
    () => selectedExtraItems.reduce((sum, extra) => sum + extra.amount, 0),
    [selectedExtraItems],
  );
  const baseOrderAmount = subtotal + extrasTotal;
  const promoDiscount = appliedPromo ? Math.min(appliedPromo.discountAmount, baseOrderAmount) : 0;
  const totalAmount = Math.max(0, baseOrderAmount - promoDiscount);
  const maxRentalDays = useMemo(() => Math.max(1, ...cartLines.map((line) => line.rentalDays ?? 1)), [cartLines]);
  const rentalEndDate = useMemo(() => {
    if (!rentalStartDate) return "";
    const start = new Date(rentalStartDate);
    if (Number.isNaN(start.getTime())) return "";
    return addDays(start, maxRentalDays - 1).toISOString().slice(0, 10);
  }, [maxRentalDays, rentalStartDate]);
  const requiresTelegram = payment === "telegram_xtr";
  const hasTelegramUser = Boolean(user?.id);
  const normalizedPromoInput = normalizePromoCode(promo);
  const hasUnvalidatedPromo = normalizedPromoInput.length > 0 && appliedPromo?.code !== normalizedPromoInput;
  const safetyQuizPassed = safetyPersisted || beginnerSafetyQuiz.every((item) => safetyAnswers[item.id] === item.correct);
  const safetyStorageKey = dbUser?.user_id ? `franchize:${slug}:safety-quiz:${dbUser.user_id}` : null;
  const canSubmit = isValid && !isCartEmpty && safetyQuizPassed && !hasUnvalidatedPromo && (!requiresTelegram || hasTelegramUser);
  const checkoutMilestones = useMemo(
    () => [
      { id: "cart", label: "Байк выбран", done: !isCartEmpty },
      { id: "contact", label: "Контакт заполнен", done: recipient.trim().length > 1 && phone.trim().length > 5 && time.trim().length > 0 },
      { id: "dates", label: `Период ${flowLabel} выбран`, done: Boolean(rentalStartDate) },
      { id: "signature", label: "Электронная подпись задана", done: signatureName.trim().length > 2 },
      { id: "safety", label: "Safety quiz пройден", done: safetyQuizPassed },
      { id: "consent", label: `Условия ${flowLabel} подтверждены`, done: consent },
    ],
    [consent, flowLabel, isCartEmpty, phone, recipient, rentalStartDate, safetyQuizPassed, signatureName, time],
  );
  const completedMilestones = checkoutMilestones.filter((step) => step.done).length;
  const readinessPercent = Math.round((completedMilestones / checkoutMilestones.length) * 100);
  const checkoutBlockers = useMemo(
    () => [
      { id: "cart", label: "Добавьте хотя бы один байк в корзину", active: isCartEmpty },
      { id: "recipient", label: "Укажите имя получателя", active: recipient.trim().length <= 1 },
      { id: "phone", label: "Добавьте контактный номер", active: phone.trim().length <= 5 },
      { id: "time", label: "Выберите удобное время", active: time.trim().length === 0 },
      { id: "dates", label: `Выберите дату начала ${flowLabel}`, active: !rentalStartDate },
      { id: "signature", label: "Введите ФИО для электронной подписи", active: signatureName.trim().length <= 2 },
      { id: "safety", label: "Пройдите safety quiz новичка", active: !safetyQuizPassed },
      { id: "consent", label: `Подтвердите условия ${flowLabel}`, active: !consent },
      { id: "promo", label: "Примените введённый промокод или очистите поле", active: hasUnvalidatedPromo },
      { id: "telegram", label: "Для Stars откройте страницу через Telegram WebApp", active: requiresTelegram && !hasTelegramUser },
    ].filter((item) => item.active),
    [consent, flowLabel, hasTelegramUser, hasUnvalidatedPromo, isCartEmpty, phone, recipient, rentalStartDate, requiresTelegram, safetyQuizPassed, signatureName, time],
  );
  const nextAction = checkoutBlockers[0];
  const holdAmountRub = crew.reservationHold.amountRub;
  const holdConfiguredAmountXtr = crew.reservationHold.amountXtr;
  const holdDepositAmount = crew.reservationHold.percent
    ? Math.max(1, Math.ceil(totalAmount * (crew.reservationHold.percent / 100)))
    : holdAmountRub;
  const holdPaymentAmountXtr = crew.reservationHold.percent ? holdDepositAmount : holdConfiguredAmountXtr;
  const holdPaymentAmountRub = crew.reservationHold.percent ? holdDepositAmount : holdAmountRub;
  const holdCtaLabel = crew.reservationHold.percent
    ? `Забронировать за ${crew.reservationHold.percent}% / ${holdPaymentAmountXtr.toLocaleString("ru-RU")} XTR`
    : crew.reservationHold.label;
  const pickupAddress = crew.reservationHold.pickupAddress || crew.contacts.address || "адрес выдачи подтвердит оператор";
  const requiredDocs = crew.reservationHold.requiredDocs.length > 0
    ? crew.reservationHold.requiredDocs
    : ["Паспорт", "Водительское удостоверение", "Электронная подпись договора"];

  const submitPayload = useMemo<CheckoutPayload>(
    () => ({
      orderId,
      recipient: recipient.trim(),
      phone: phone.trim(),
      time: time.trim(),
      comment: appliedPromo
        ? [comment.trim(), `Промокод ${appliedPromo.code}: ${appliedPromo.description}${appliedPromo.discountAmount > 0 ? ` (-${appliedPromo.discountAmount.toLocaleString("ru-RU")} ₽)` : ""}`].filter(Boolean).join("\n")
        : comment.trim(),
      rentalStartDate: rentalStartDate || undefined,
      rentalEndDate: rentalEndDate || undefined,
      signatureName: signatureName.trim() || undefined,
      signatureAccepted: consent,
      signatureFingerprint: user?.id ? `tg:${user.id}` : "manual-sign",
      payment,
      delivery: deliveryMode,
      extras: selectedExtraItems.map((extra) => ({ id: extra.id, label: extra.label, amount: extra.amount })),
      extrasTotal,
      promoCode: appliedPromo?.code,
      promoTitle: appliedPromo?.title,
      promoDiscount,
      totalAmount,
      cartLines: cartLines.map((line) => ({
        lineId: line.lineId,
        itemId: line.itemId,
        qty: line.qty,
        pricePerDay: line.pricePerDay,
        lineTotal: line.lineTotal,
        options: line.options,
      })),
      depositAmount: holdDepositAmount,
      checkoutBlockers: checkoutBlockers.map((blocker) => ({ id: blocker.id, label: blocker.label })),
      safetyQuizPassed,
      pickupAddress,
      requiredDocs,
      flowType,
    }),
    [appliedPromo, cartLines, checkoutBlockers, comment, consent, deliveryMode, extrasTotal, flowType, holdDepositAmount, orderId, payment, phone, pickupAddress, promoDiscount, recipient, rentalEndDate, rentalStartDate, requiredDocs, safetyQuizPassed, selectedExtraItems, signatureName, time, totalAmount, user?.id],
  );

  const recoveryDepositAmount = flowType === "sale" ? Math.round(totalAmount * 0.1) : holdDepositAmount;

  const buildRecoverySnapshot = (stage: "checkout_started" | "payment_failed") => ({
    slug,
    orderId,
    stage,
    route: typeof window === "undefined" ? `/franchize/${slug}/order/${orderId}` : window.location.pathname,
    bikeIds: submitPayload.cartLines.map((line) => line.itemId).filter(Boolean),
    dates: {
      start: submitPayload.rentalStartDate,
      end: submitPayload.rentalEndDate,
      preferredTime: submitPayload.time,
    },
    contact: {
      phone: submitPayload.phone,
      telegramUserId: user?.id ? String(user.id) : undefined,
      telegramPresent: hasTelegramUser,
      recipient: submitPayload.recipient,
    },
    readinessPercent,
    blockers: checkoutBlockers.map((blocker) => ({ id: blocker.id, label: blocker.label })),
    totalAmount,
    depositAmount: recoveryDepositAmount,
    payment,
    flowType,
  });

  const sendRecoverySnapshot = (stage: "checkout_started" | "payment_failed", options?: { force?: boolean }) => {
    if (isCartEmpty || submitPayload.cartLines.length === 0) return;
    const meaningful = stage === "payment_failed" || phone.trim().length > 5 || Boolean(rentalStartDate) || readinessPercent >= 67;
    if (!meaningful) return;

    const snapshot = buildRecoverySnapshot(stage);
    const fingerprint = JSON.stringify({
      stage,
      bikeIds: snapshot.bikeIds,
      start: snapshot.dates.start,
      end: snapshot.dates.end,
      phone: snapshot.contact.phone.trim(),
      phonePresent: snapshot.contact.phone.trim().length > 5,
      telegramPresent: snapshot.contact.telegramPresent,
      payment: snapshot.payment,
      readinessBucket: Math.floor(snapshot.readinessPercent / 10),
      blocker: snapshot.blockers[0]?.id ?? "ready",
      totalAmount: snapshot.totalAmount,
    });

    if (!options?.force && lastRecoveryFingerprintRef.current === fingerprint) return;
    lastRecoveryFingerprintRef.current = fingerprint;

    void recordFranchizeCheckoutRecoverySnapshot(snapshot).catch(() => {
      // Best-effort lead recovery telemetry must never block checkout typing or payment submission.
    });
  };

  const submitLabel = isSubmitting
    ? "Подготавливаем бронь..."
    : payment === "telegram_xtr"
      ? holdCtaLabel
      : "Подтвердить заказ";

  const submitHint = isSubmitting
    ? "Проверяем данные и отправляем действие оплаты. Обычно это занимает несколько секунд."
    : isCartEmpty
      ? `Добавьте хотя бы один байк в корзину, чтобы перейти к подтверждению ${flowLabel}.`
      : !consent
        ? `Подтвердите согласие с условиями ${flowLabel}, чтобы отправить заказ.`
        : requiresTelegram && !hasTelegramUser
          ? "Для оплаты Stars откройте оформление из Telegram WebApp и повторите попытку."
          : hasUnvalidatedPromo
            ? "Промокод введён, но ещё не применён. Нажмите «Применить» или очистите поле."
            : appliedPromo
              ? `Промокод ${appliedPromo.code} применён: ${appliedPromo.description}.`
              : payment === "telegram_xtr"
                ? `Сейчас спишется только бронь: ${holdPaymentAmountRub.toLocaleString("ru-RU")}₽ / ${holdPaymentAmountXtr.toLocaleString("ru-RU")} XTR. Остальное подтвердит оператор.`
            : "Проверьте контакты и способ получения, затем подтверждайте заказ.";

  useEffect(() => {
    const loadPrefill = async () => {
      if (!dbUser?.user_id) return;
      const res = await getFranchizeFormPrefillAction({ userId: dbUser.user_id, slug });
      if (!res.success || !res.data) return;
      setValue("recipient", res.data.fullName || "");
      setValue("phone", res.data.phone || "");
      setValue("time", res.data.preferredTime || "");
      setValue("comment", res.data.comment || "");
      setValue("deliveryMode", res.data.deliveryMode || "pickup");
    };
    void loadPrefill();
  }, [dbUser?.user_id, setValue, slug]);

  // Load rental secrets for returning users (WOW effect)
  useEffect(() => {
    const loadRentalSecrets = async () => {
      if (!dbUser?.user_id) return;
      const res = await getFranchizeUserRentalSecretsAction({ userId: dbUser.user_id, slug });
      if (!res.success || !res.data) return;

      // If user has previous rentals, show returning user indicators
      if (res.data.hasPreviousRentals) {
        setIsReturningUser(true);
        setReturningUserLastRental(res.data.lastRentalDate ?? null);
      }
    };
    void loadRentalSecrets();
  }, [dbUser?.user_id, slug]);

  // Prefill rental dates from cart (if user selected dates in item modal)
  useEffect(() => {
    const firstLineWithDates = cartLines.find(
      (line) => line.options.rentStartDate && line.options.rentEndDate
    );
    if (firstLineWithDates) {
      const { rentStartDate, rentEndDate } = firstLineWithDates.options;
      // Only set if form field is empty (user hasn't manually entered dates yet)
      if (!rentalStartDate && rentStartDate) {
        setValue("rentalStartDate", rentStartDate, { shouldDirty: false, shouldValidate: false });
      }
    }
  }, [cartLines, rentalStartDate, setValue]);

  useEffect(() => {
    if (!appliedPromo) return;
    if (normalizePromoCode(promo) !== appliedPromo.code) {
      setAppliedPromo(null);
      setPromoMessage(promo.trim() ? { tone: "info", text: "Промокод изменён — примените новый код перед отправкой." } : null);
      return;
    }
    if (appliedPromo.baseAmount !== baseOrderAmount) {
      setAppliedPromo(null);
      setPromoMessage({ tone: "info", text: "Сумма заказа изменилась — примените промокод ещё раз." });
    }
  }, [appliedPromo, baseOrderAmount, promo]);

  useEffect(() => {
    if (!safetyStorageKey) return;
    const stored = window.localStorage.getItem(safetyStorageKey);
    if (stored === "passed") setSafetyPersisted(true);
  }, [safetyStorageKey]);

  useEffect(() => {
    if (!safetyStorageKey || !safetyQuizPassed) return;
    window.localStorage.setItem(safetyStorageKey, "passed");
    setSafetyPersisted(true);
  }, [safetyQuizPassed, safetyStorageKey]);

  useEffect(() => {
    if (recoveryDebounceRef.current) {
      window.clearTimeout(recoveryDebounceRef.current);
    }

    recoveryDebounceRef.current = window.setTimeout(() => {
      sendRecoverySnapshot("checkout_started");
    }, 2500);

    return () => {
      if (recoveryDebounceRef.current) {
        window.clearTimeout(recoveryDebounceRef.current);
      }
    };
  }, [checkoutBlockers, flowType, hasTelegramUser, isCartEmpty, orderId, payment, phone, readinessPercent, recoveryDepositAmount, rentalEndDate, rentalStartDate, slug, submitPayload, time, totalAmount, user?.id]);

  const checkAvailabilityBeforeSubmit = async () => {
    const carIds = Array.from(new Set(submitPayload.cartLines.map((line) => line.itemId).filter(Boolean)));
    const startDate = submitPayload.rentalStartDate;
    const endDate = submitPayload.rentalEndDate || submitPayload.rentalStartDate;
    if (!carIds.length || !startDate || !endDate) return true;

    const result = await checkFranchizeCarsAvailability({ carIds, rentalStartDate: startDate, rentalEndDate: endDate });
    if (!result.success) {
      toast.error(result.error ?? "Не удалось проверить доступность байка.");
      return false;
    }
    if ((result.unavailableCarIds?.length ?? 0) > 0) {
      toast.error("Часть байков уже занята в выбранный период. Обновите даты или состав заказа.");
      return false;
    }
    return true;
  };

  const onSubmitValid = async (values: OrderFormValues) => {
    const submitFingerprint = JSON.stringify({
      orderId,
      payment: values.payment,
      recipient: values.recipient.trim(),
      phone: values.phone.trim(),
      time: values.time.trim(),
      rentalStartDate: submitPayload.rentalStartDate,
      rentalEndDate: submitPayload.rentalEndDate,
      signatureName: values.signatureName.trim(),
      signatureAccepted: values.consent,
      totalAmount: submitPayload.totalAmount,
      extras: submitPayload.extras,
      promoCode: submitPayload.promoCode,
      promoDiscount: submitPayload.promoDiscount,
      safetyQuizPassed,
      cartLines: submitPayload.cartLines,
    });

    if (isSubmitting || !canSubmit) {
      return;
    }

    if (!safetyQuizPassed) {
      toast.error("Пройдите safety quiz новичка перед подтверждением заказа.");
      return;
    }

    if (lastSubmitFingerprintRef.current === submitFingerprint) {
      toast.message("Похожий checkout уже обрабатывается. Ждём ответ Telegram.");
      return;
    }

    const isAvailable = await checkAvailabilityBeforeSubmit();
    if (!isAvailable) return;

    lastSubmitFingerprintRef.current = submitFingerprint;

    startSubmitTransition(async () => {
      const result = await createFranchizeOrderCheckout({
        slug,
        orderId,
        telegramUserId: String(user?.id ?? "manual-order"),
        recipient: values.recipient.trim(),
        phone: values.phone.trim(),
        time: values.time.trim(),
        comment: submitPayload.comment,
        rentalStartDate: submitPayload.rentalStartDate,
        rentalEndDate: submitPayload.rentalEndDate,
        signatureName: values.signatureName.trim(),
        signatureAccepted: values.consent,
        signatureFingerprint: user?.id ? `tg:${user.id}` : "manual-sign",
        payment: values.payment,
        delivery: values.deliveryMode,
        subtotal,
        extrasTotal: submitPayload.extrasTotal,
        promoCode: submitPayload.promoCode,
        promoTitle: submitPayload.promoTitle,
        promoDiscount: submitPayload.promoDiscount,
        totalAmount: submitPayload.totalAmount,
        extras: submitPayload.extras,
        cartLines: submitPayload.cartLines,
        depositAmount: submitPayload.depositAmount,
        checkoutBlockers: submitPayload.checkoutBlockers,
        safetyQuizPassed: submitPayload.safetyQuizPassed,
        pickupAddress: submitPayload.pickupAddress,
        requiredDocs: submitPayload.requiredDocs,
        flowType: submitPayload.flowType,
      });

      if (!result.success) {
        toast.error(result.error ?? "Не удалось отправить заказ.");
        if (values.payment === "telegram_xtr") {
          sendRecoverySnapshot("payment_failed", { force: true });
          setPaymentRetryHint("XTR-оплата не завершилась. Проверьте Telegram WebApp и повторите отправку или выберите резервную оплату.");
        }
        lastSubmitFingerprintRef.current = null;
        return;
      }

      if (values.payment === "telegram_xtr") {
        toast.success("XTR-счёт отправлен в Telegram. После оплаты откроется franchize flow ⭐");
        setPaymentRetryHint(null);
        lastSubmitFingerprintRef.current = null;
        return;
      }

      toast.success(submitPayload.flowType === "rental" ? "Заявка на аренду отправлена вместе с DOC-файлом." : "Заявка на покупку отправлена вместе с DOC-файлом.");
      lastSubmitFingerprintRef.current = null;
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
      return;
    }
    if (blockerId === "safety") {
      document.getElementById("beginner-safety-quiz")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (blockerId === "promo") {
      setFocus("promo");
    }
  };

  const handleApplyPromo = async () => {
    const requestedCode = normalizePromoCode(promo);
    setIsPromoValidating(true);

    try {
      const result = await validateFranchizePromoCode({ slug, code: promo, baseAmount: baseOrderAmount });
      if (!result.success) {
        setAppliedPromo(null);
        setPromoMessage({ tone: "error", text: result.error });
        toast.error(result.error);
        return;
      }

      if (normalizePromoCode(promo) !== requestedCode || result.code !== requestedCode) {
        setPromoMessage({ tone: "info", text: "Поле промокода изменилось во время проверки — примените актуальный код ещё раз." });
        return;
      }

      const promoResult: AppliedPromo = {
        code: result.code,
        title: result.title,
        discountAmount: result.discountAmount,
        description: result.description,
        baseAmount: baseOrderAmount,
      };
      setAppliedPromo(promoResult);
      setPromoMessage({
        tone: "success",
        text: result.discountAmount > 0
          ? `${result.code} применён: −${result.discountAmount.toLocaleString("ru-RU")} ₽ (${result.description}).`
          : `${result.code} проверен: ${result.description}.`,
      });
      toast.success(result.discountAmount > 0 ? "Промокод применён к заказу." : "Промокод проверен и закреплён за заказом.");
    } catch {
      const error = "Не удалось проверить промокод. Попробуйте ещё раз.";
      setAppliedPromo(null);
      setPromoMessage({ tone: "error", text: error });
      toast.error(error);
    } finally {
      setIsPromoValidating(false);
    }
  };

  const handleSwitchToFallbackPayment = () => {
    setValue("payment", "card", { shouldDirty: true, shouldValidate: true });
    setPaymentRetryHint(null);
    toast.message("Переключили на резервную оплату картой. Проверьте данные и отправьте заказ снова.");
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

      {isReturningUser && (
        <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-300">
            С возвращением! {returningUserLastRental ? `Последняя аренда: ${returningUserLastRental}` : ""}
          </p>
          <p className="mt-1 text-xs text-emerald-200/80">
            Ваши данные из прошлой аренды сохранены. Просто проверьте и подтвердите заказ.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-3 rounded-3xl border p-4 text-sm md:grid-cols-[1.2fr_0.8fr]" style={surface.subtleCard}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--order-accent)]">Что будет дальше</p>
          <ol className="mt-3 space-y-2">
            {[
              `Проверим корзину, даты и контакт для ${flowLabel}.`,
              payment === "telegram_xtr" ? `Отправим hold-счёт: ${holdPaymentAmountRub.toLocaleString("ru-RU")}₽ / ${holdPaymentAmountXtr.toLocaleString("ru-RU")} XTR, чтобы закрепить байк.` : "Передадим заявку оператору: оплату подтвердим вручную до выдачи.",
              `После подтверждения в Telegram пришлём адрес выдачи (${pickupAddress}), список документов и ссылку на сделку.`,
            ].map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--order-accent-soft)] text-[11px] font-semibold text-[var(--order-accent)]">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 rounded-2xl border border-[var(--order-border)] p-3 text-xs" style={surface.card}>
            Безопасность оплаты и договора: сумма фиксируется в заявке, договор/чек проверяются до старта, спорные изменения подтверждаются только через оператора или Telegram.
          </p>
          <div className="mt-3 rounded-2xl border border-[var(--order-border)] p-3 text-xs" style={surface.card}>
            <p className="font-semibold text-[var(--order-accent)]">Hold-бронь</p>
            <p className="mt-1">{holdCtaLabel} — это маленький депозит, который фиксирует выбранный слот и запускает Telegram-подтверждение.</p>
            <ul className="mt-2 space-y-1 text-[var(--order-muted)]">
              <li>Адрес выдачи: {pickupAddress}</li>
              <li>Документы: {requiredDocs.join(", ")}</li>
              <li>Safety quiz: {safetyQuizPassed ? "пройден" : "нужно пройти до отправки"}</li>
              <li>После оплаты: Telegram пришлёт карточку сделки и следующий шаг оператора.</li>
            </ul>
          </div>
        </div>
        <div className="space-y-2">
          <a
            href={telegramSupportHref}
            target="_blank"
            rel="noreferrer"
            className="flex w-full justify-center rounded-xl bg-[var(--order-accent)] px-3 py-2 text-center text-sm font-semibold text-[var(--order-accent-contrast)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={focusRingOutlineStyle(crew.theme)}
          >
            Написать оператору в Telegram
          </a>
          <a
            href={telegramWebAppFallbackHref}
            target="_blank"
            rel="noreferrer"
            className="flex w-full justify-center rounded-xl border border-[var(--order-border)] px-3 py-2 text-center text-xs transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={focusRingOutlineStyle(crew.theme)}
          >
            Открыть WebApp fallback
          </a>
          <Link href={contactsHref} className="flex w-full justify-center rounded-xl border border-[var(--order-border)] px-3 py-2 text-center text-xs transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={focusRingOutlineStyle(crew.theme)}>
            Поддержка / контакты
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href={catalogHref} className="rounded-xl border border-[var(--order-border)] px-3 py-2 text-center text-xs transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={focusRingOutlineStyle(crew.theme)}>Каталог</Link>
            <Link href={profileHref} className="rounded-xl border border-[var(--order-border)] px-3 py-2 text-center text-xs transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={focusRingOutlineStyle(crew.theme)}>Профиль</Link>
          </div>
        </div>
      </div>

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
                  <p className="text-xs" style={surface.mutedText}>
                    {item.id === "telegram_xtr" ? `${item.description} · ${holdCtaLabel}` : item.description}
                  </p>
                </button>
              ))}
            </div>
            {requiresTelegram && !hasTelegramUser ? (
              <p className="mt-2 text-xs" style={surface.mutedText}>Для оплаты в Stars откройте оформление из Telegram WebApp.</p>
            ) : null}
            {paymentRetryHint ? (
              <div className="mt-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3">
                <p className="text-xs text-amber-200">{paymentRetryHint}</p>
                <button
                  type="button"
                  onClick={handleSwitchToFallbackPayment}
                  className="mt-2 inline-flex items-center rounded-xl border border-amber-200/40 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-200/20"
                >
                  Переключиться на оплату картой
                </button>
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm uppercase tracking-[0.08em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                placeholder={crew.catalog.promoBanners.length > 0 ? "Промокод" : "Промокодов нет"}
                aria-invalid={promoMessage?.tone === "error"}
                {...register("promo")}
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                disabled={!promo.trim() || isSubmitting || isPromoValidating}
                className="rounded-xl border border-[var(--order-border)] px-3 text-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                style={focusRingOutlineStyle(crew.theme)}
              >
                {isPromoValidating ? "Проверяем..." : "Применить"}
              </button>
            </div>
            {promoMessage ? (
              <p className={`mt-2 text-xs ${promoMessage.tone === "error" ? "text-rose-300" : promoMessage.tone === "success" ? "text-emerald-300" : "text-[var(--order-muted)]"}`}>
                {promoMessage.text}
              </p>
            ) : null}
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

          <div id="beginner-safety-quiz" className="rounded-2xl border p-4" style={surface.card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Safety quiz новичка</p>
                <p className="mt-1 text-xs" style={surface.mutedText}>
                  Ответь на 3 быстрых вопроса перед первым выездом. После прохождения отметка сохранится в этом браузере для preview/Telegram WebApp тестов.
                </p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${safetyQuizPassed ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-300/15 text-amber-200"}`}>
                {safetyQuizPassed ? "пройден" : "нужно пройти"}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {beginnerSafetyQuiz.map((item) => {
                const answer = safetyAnswers[item.id];
                return (
                  <div key={item.id} className="rounded-xl border border-[var(--order-border)] p-3" style={surface.subtleCard}>
                    <p className="text-sm">{item.question}</p>
                    <div className="mt-2 flex gap-2">
                      {[
                        { label: "Да", value: true },
                        { label: "Нет", value: false },
                      ].map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => setSafetyAnswers((current) => ({ ...current, [item.id]: option.value }))}
                          className="rounded-lg border px-3 py-1 text-xs font-medium transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                          style={{
                            borderColor: answer === option.value ? "var(--order-accent)" : "var(--order-border)",
                            color: answer === option.value ? "var(--order-accent)" : "var(--order-text-primary)",
                            ...focusRingOutlineStyle(crew.theme),
                          }}
                          aria-pressed={answer === option.value}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {!safetyQuizPassed ? <p className="mt-2 text-xs text-amber-200">Нужны все правильные ответы: экипировка — да, обгон ведущего — нет, meetup вместо погони — да.</p> : null}
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
              <p className="text-xs uppercase tracking-[0.18em]" style={surface.mutedText}>Финальная проверка</p>
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--order-accent)]">Помощник заказа</p>
              <span className="rounded-full bg-[var(--order-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--order-accent)]">
                {checkoutBlockers.length === 0 ? "готово" : `${checkoutBlockers.length} стоп-фактор${checkoutBlockers.length === 1 ? "" : "а"}`}
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
            {nextAction && ["recipient", "phone", "time", "consent", "promo", "safety"].includes(nextAction.id) ? (
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
              <p className="font-medium">Корзина пуста — заказ ещё некуда оформлять.</p>
              <p className="mt-1 text-xs" style={surface.mutedText}>Вернитесь в каталог, выберите байк и пакет аренды/покупки. Если позиция пропала — напишите оператору, он подберёт замену.</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Link
                  href={catalogHref}
                  className="inline-flex font-medium text-[var(--order-accent)] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--order-accent)]"
                >
                  Вернуться в каталог
                </Link>
                <Link
                  href={profileHref}
                  className="inline-flex font-medium text-[var(--order-accent)] underline-offset-4 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--order-accent)]"
                >
                  Открыть профиль
                </Link>
              </div>
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
            <p className="mt-1 flex justify-between"><span>Hold</span><span>{payment === "telegram_xtr" ? `${holdPaymentAmountXtr.toLocaleString("ru-RU")} XTR` : `${holdDepositAmount.toLocaleString("ru-RU")} ₽`}</span></p>
            <p className="mt-1 flex justify-between"><span>Период</span><span>{rentalStartDate || "—"} → {rentalEndDate || "—"}</span></p>
            <p className="mt-2 flex justify-between"><span>Подытог</span><span>{subtotal.toLocaleString("ru-RU")} ₽</span></p>
            <p className="mt-1 flex justify-between"><span>Доп. опции</span><span>{extrasTotal.toLocaleString("ru-RU")} ₽</span></p>
            {appliedPromo ? (
              <p className="mt-1 flex justify-between text-emerald-300">
                <span>Промокод {appliedPromo.code}</span>
                <span>{promoDiscount > 0 ? `−${promoDiscount.toLocaleString("ru-RU")} ₽` : "бонус"}</span>
              </p>
            ) : null}
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
          <div className="mt-3 rounded-xl border border-[var(--order-border)] p-3 text-xs" style={surface.subtleCard}>
            <p className="font-semibold text-[var(--order-accent)]">Следующие шаги после hold</p>
            <ul className="mt-2 space-y-1" style={surface.mutedText}>
              <li>1. Telegram подтвердит счёт и пришлёт ссылку на заказ.</li>
              <li>2. Оператор закрепит байк, адрес выдачи: {pickupAddress}.</li>
              <li>3. На выдаче проверим документы: {requiredDocs.join(", ")}.</li>
              <li>4. Safety quiz: {safetyQuizPassed ? "готов" : "нужно пройти перед отправкой"}.</li>
            </ul>
          </div>
          <p className="mt-3 rounded-xl border border-[var(--order-border)] p-3 text-xs" style={surface.subtleCard}>
            Если оплата или договор не открылись, не перезагружайте страницу: нажмите Telegram fallback выше или напишите в поддержку — оператор продолжит заявку по #{orderId}.
          </p>
        </aside>
      </form>
    </section>
  );
}
