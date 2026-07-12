"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAppContext } from "@/contexts/AppContext";
import type { CatalogItemVM, FranchizeCrewVM } from "../actions";
import { checkFranchizeCarsAvailability, createFranchizeOrderCheckout, recordFranchizeCheckoutRecoverySnapshot, validateFranchizePromoCode } from "../actions";
import { useFranchizeCartLines } from "../hooks/useFranchizeCartLines";
import { useFranchizeCart } from "../hooks/useFranchizeCart";
import { saveUserFranchizeCartAction } from "@/contexts/actions";
import { focusRingOutlineStyle, readablePaletteTextOnColor, withAlpha } from "../lib/theme";
import { getTelegramHandleHref, getTelegramWebAppFallbackHref, getTelegramWebAppPageHref, getTelegramWebAppAdaptiveHref } from "../lib/telegram-links";
import { getFranchizeFormPrefillAction, getFranchizeUserRentalSecretsAction, getRentalDocsPrefillAction } from "../profile-actions";
import { useCrewTokens } from "../lib/use-crew-tokens";
import {
  parseISODate,
  formatRuDateFromISO,
  diffDaysISO,
  addDaysISO,
  isoDateTimeFromParts,
  durationDaysFromDateTime,
} from "../lib/date-utils";
import { ruPluralDays } from "../lib/catalog-utils";

interface OrderPageClientProps {
  crew: FranchizeCrewVM;
  slug: string;
  orderId: string;
  items: CatalogItemVM[];
}

const payments = [
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

const beginnerSafetyQuiz = [] as const;

type CheckoutPayload = {
  orderId: string;
  recipient: string;
  phone: string;
  time: string;
  comment: string;
  rentalStartDate?: string;
  rentalEndDate?: string;
  // ── Personal data for contract generation (aligned with /doc flow) ──
  birthDate?: string;
  passportSeries?: string;
  passportNumber?: string;
  passportIssueDate?: string;
  passportIssuedBy?: string;
  registrationAddress?: string;
  licenseSeries?: string;
  licenseNumber?: string;
  licenseCategories?: string;
  licenseExpiryDate?: string;
  hasLicense?: boolean;
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
  pickupAddress: string;
  requiredDocs: string[];
  flowType: "rental" | "sale" | "mixed" | "testdrive";
};

const orderFormSchema = z.object({
  recipient: z.string().trim().min(2, "Укажите имя получателя"),
  phone: z.string().trim().min(6, "Добавьте контактный номер"),
  comment: z.string().default(""),
  rentalStartDate: z.string().trim().optional(),
  // ── Passport fields ──
  birthDate: z.string().trim().optional(),
  passportSeries: z.string().trim().optional(),
  passportNumber: z.string().trim().optional(),
  passportIssueDate: z.string().trim().optional(),
  passportIssuedBy: z.string().trim().optional(),
  registrationAddress: z.string().trim().optional(),
  // ── License fields ──
  hasLicense: z.boolean().default(true),
  licenseSeries: z.string().trim().optional(),
  licenseNumber: z.string().trim().optional(),
  licenseCategories: z.string().trim().optional(),
  licenseExpiryDate: z.string().trim().optional(),
  payment: z.enum(["card", "cash", "sbp"]),
  deliveryMode: z.enum(["pickup", "delivery"]).default("pickup"),
  selectedExtras: z.array(z.string()).default([]),
  promo: z.string().default(""),
  consent: z.boolean().default(true),
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
  const { user, dbUser, isInTelegramContext } = useAppContext();
  const { cartLines, subtotal } = useFranchizeCartLines(slug, items);
  const { clear: clearCart } = useFranchizeCart(slug);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [paymentRetryHint, setPaymentRetryHint] = useState<string | null>(null);
  const [isPromoValidating, setIsPromoValidating] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoMessage, setPromoMessage] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
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
      comment: "",
      rentalStartDate: "",
      birthDate: "",
      passportSeries: "",
      passportNumber: "",
      passportIssueDate: "",
      passportIssuedBy: "",
      registrationAddress: "",
      hasLicense: true,
      licenseSeries: "",
      licenseNumber: "",
      licenseCategories: "",
      licenseExpiryDate: "",
      promo: "",
      selectedExtras: [],
      payment: "card",
      deliveryMode: "pickup",
      consent: true,
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
  const comment = watch("comment") ?? "";
  const rentalStartDate = watch("rentalStartDate") ?? "";
  const promo = watch("promo") ?? "";
  const payment = watch("payment") as PaymentMethod;
  const deliveryMode = watch("deliveryMode");
  const selectedExtras = watch("selectedExtras") ?? EMPTY_SELECTED_EXTRAS;
  const consent = true; // Non-blocking, auto-checked
  // ── Passport + license watched fields ──
  const birthDate = watch("birthDate") ?? "";
  const passportSeries = watch("passportSeries") ?? "";
  const passportNumber = watch("passportNumber") ?? "";
  const passportIssueDate = watch("passportIssueDate") ?? "";
  const passportIssuedBy = watch("passportIssuedBy") ?? "";
  const registrationAddress = watch("registrationAddress") ?? "";
  const hasLicense = watch("hasLicense") ?? true;
  const licenseSeries = watch("licenseSeries") ?? "";
  const licenseNumber = watch("licenseNumber") ?? "";
  const licenseCategories = watch("licenseCategories") ?? "";
  const licenseExpiryDate = watch("licenseExpiryDate") ?? "";
  const T = useCrewTokens(crew.theme);
  const surface = T.styles;
  const isAuto = T.isAuto;
  const accentMain = T.accent;
  const accentHover = T.accentHover;
  const borderSoft = T.borderSoft;
  const textSecondary = T.textMuted;
  const textPrimary = T.text;
  const textMuted = T.textMuted;
  const accentTextOn = T.accentContrast;
  const fieldStyle: React.CSSProperties = {
    borderColor: T.border,
    backgroundColor: T.bgElevated,
    color: T.text,
  };

  const isCartEmpty = cartLines.length === 0;
  const saleLinesCount = useMemo(() => cartLines.filter((line) => line.saleAvailable).length, [cartLines]);
  const testdriveLinesCount = useMemo(() => cartLines.filter((line) => (line.options as any).action === "testdrive").length, [cartLines]);
  const flowType: "rental" | "sale" | "mixed" | "testdrive" = testdriveLinesCount > 0 && testdriveLinesCount === cartLines.length
    ? "testdrive"
    : saleLinesCount === 0
      ? "rental"
      : saleLinesCount === cartLines.length
        ? "sale"
        : "mixed";
  const flowLabel = flowType === "sale" ? "покупки" : flowType === "mixed" ? "аренды/покупки" : flowType === "testdrive" ? "тест-драйва" : "аренды";
  const catalogHref = `/franchize/${slug}`;
  const profileHref = isInTelegramContext
    ? `/franchize/${slug}/profile`
    : (getTelegramWebAppPageHref(`franchize/${slug}/profile`, crew.contacts.telegramBotUsername) || `/franchize/${slug}/profile`);
  const contactsHref = `/franchize/${slug}/contacts`;
  const telegramSupportHref = getTelegramHandleHref(crew.contacts.telegram);
  const telegramWebAppFallbackHref = getTelegramWebAppFallbackHref("franchize", slug, crew.contacts.telegramBotUsername);
  const [adaptiveTgFallbackHref, setAdaptiveTgFallbackHref] = useState(telegramWebAppFallbackHref);
  useEffect(() => {
    // After hydration, switch to device-aware href (desktop → web.telegram.org, mobile → t.me)
    setAdaptiveTgFallbackHref(getTelegramWebAppAdaptiveHref(`franchize/${slug}`, crew.contacts.telegramBotUsername));
  }, [slug, crew.contacts.telegramBotUsername]);
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
  // FIX: The rental period is now picked in the Item modal and lives
  // on the cart line options. We pull it out of the first cart line
  // that has a date set, instead of asking the user to re-pick it
  // here (which used to create "two sources of truth" and let the
  // dates drift apart if the user edited the cart).
  const firstLineWithDates = useMemo(
    () => cartLines.find((line) => line.options.rentStartDate && line.options.rentEndDate),
    [cartLines],
  );
  const resolvedStartDate = firstLineWithDates?.options.rentStartDate || "";
  const resolvedEndDate = firstLineWithDates?.options.rentEndDate || "";
  const resolvedStartTime = firstLineWithDates?.options.rentStartTime || "10:00";
  const resolvedEndTime = firstLineWithDates?.options.rentEndTime || "10:00";
  const rentalPeriodDays = useMemo(
    () => (resolvedStartDate && resolvedEndDate ? durationDaysFromDateTime(resolvedStartDate, resolvedStartTime, resolvedEndDate, resolvedEndTime) : null),
    [resolvedStartDate, resolvedEndDate, resolvedStartTime, resolvedEndTime],
  );
  const rentalStartIsoTimestamp = useMemo(
    () => (resolvedStartDate ? isoDateTimeFromParts(resolvedStartDate, resolvedStartTime) : null),
    [resolvedStartDate, resolvedStartTime],
  );
  const rentalEndIsoTimestamp = useMemo(
    () => (resolvedEndDate ? isoDateTimeFromParts(resolvedEndDate, resolvedEndTime) : null),
    [resolvedEndDate, resolvedEndTime],
  );
  // `rentalEndDate` is kept as the local YYYY-MM-DD for downstream
  // code that expects it (submission payload, recovery snapshot).
  const rentalEndDate = resolvedEndDate;
  const requiresTelegram = false; // XTR payment removed
  const hasTelegramUser = Boolean(user?.id);
  const visiblePayments = payments; // Show all payments (XTR removed)

  // Auto-switch from XTR to card when not in Telegram context (XTR removed, kept for safety)
  useEffect(() => {
    if (payment === "telegram_xtr") {
      setValue("payment", "card", { shouldDirty: false, shouldValidate: true });
    }
  }, [payment, setValue]);
  const normalizedPromoInput = normalizePromoCode(promo);
  const hasUnvalidatedPromo = normalizedPromoInput.length > 0 && appliedPromo?.code !== normalizedPromoInput;
  const canSubmit = !isCartEmpty && !hasUnvalidatedPromo && recipient.trim().length > 1 && phone.trim().length > 5;
  const checkoutMilestones = useMemo(
    () => [
      { id: "cart", label: "Байк выбран", done: !isCartEmpty },
      { id: "contact", label: "Контакт заполнен", done: recipient.trim().length > 1 && phone.trim().length > 5 },
      { id: "dates", label: `Период ${flowLabel} выбран`, done: Boolean(rentalStartDate) },
    ],
    [flowLabel, isCartEmpty, phone, recipient, rentalStartDate],
  );
  const completedMilestones = checkoutMilestones.filter((step) => step.done).length;
  const readinessPercent = Math.round((completedMilestones / checkoutMilestones.length) * 100);
  const checkoutBlockers = useMemo(
    () => [
      { id: "cart", label: "Добавьте хотя бы один байк в корзину", active: isCartEmpty },
      { id: "recipient", label: "Укажите имя получателя", active: recipient.trim().length <= 1 },
      { id: "phone", label: "Добавьте контактный номер", active: phone.trim().length <= 5 },
      { id: "dates", label: `Выберите период ${flowLabel}`, active: !rentalStartDate },
      { id: "promo", label: "Примените введённый промокод или очистите поле", active: hasUnvalidatedPromo },
    ].filter((item) => item.active),
    [flowLabel, hasUnvalidatedPromo, isCartEmpty, phone, recipient, rentalStartDate],
  );
  const nextAction = checkoutBlockers[0];
  const holdAmountRub = crew.reservationHold.amountRub;
  const holdDepositAmount = crew.reservationHold.percent
    ? Math.max(1, Math.ceil(totalAmount * (crew.reservationHold.percent / 100)))
    : holdAmountRub;
  const holdPaymentAmountRub = crew.reservationHold.percent ? holdDepositAmount : holdAmountRub;
  const holdCtaLabel = crew.reservationHold.percent
    ? `Забронировать за ${crew.reservationHold.percent}%`
    : crew.reservationHold.label || "Подтвердить заказ";
  const pickupAddress = crew.reservationHold.pickupAddress || crew.contacts.address || "адрес выдачи подтвердит оператор";
  const requiredDocs = crew.reservationHold.requiredDocs.length > 0
    ? crew.reservationHold.requiredDocs
    : ["Паспорт", "Водительское удостоверение", "Электронная подпись договора"];

  const submitPayload = useMemo<CheckoutPayload>(
    () => ({
      orderId,
      recipient: recipient.trim(),
      phone: phone.trim(),
      time: comment.trim() || "по согласованию",
      comment: appliedPromo
        ? [comment.trim(), `Промокод ${appliedPromo.code}: ${appliedPromo.description}${appliedPromo.discountAmount > 0 ? ` (-${appliedPromo.discountAmount.toLocaleString("ru-RU")} ₽)` : ""}`].filter(Boolean).join("\n")
        : comment.trim(),
      rentalStartDate: rentalStartDate || resolvedStartDate || undefined,
      rentalEndDate: rentalEndDate || resolvedEndDate || undefined,
      // ── Personal data for contract generation ──
      birthDate: birthDate.trim() || undefined,
      passportSeries: passportSeries.trim() || undefined,
      passportNumber: passportNumber.trim() || undefined,
      passportIssueDate: passportIssueDate.trim() || undefined,
      passportIssuedBy: passportIssuedBy.trim() || undefined,
      registrationAddress: registrationAddress.trim() || undefined,
      hasLicense,
      licenseSeries: hasLicense ? (licenseSeries.trim() || undefined) : undefined,
      licenseNumber: hasLicense ? (licenseNumber.trim() || undefined) : undefined,
      licenseCategories: hasLicense ? (licenseCategories.trim() || undefined) : undefined,
      licenseExpiryDate: hasLicense ? (licenseExpiryDate.trim() || undefined) : undefined,
      signatureName: recipient.trim() || undefined,
      signatureAccepted: true,
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
      pickupAddress,
      requiredDocs,
      flowType,
    }),
    [appliedPromo, birthDate, cartLines, checkoutBlockers, comment, deliveryMode, extrasTotal, flowType, hasLicense, holdDepositAmount, licenseCategories, licenseExpiryDate, licenseNumber, licenseSeries, orderId, passportIssuedBy, passportIssueDate, passportNumber, passportSeries, payment, phone, pickupAddress, promoDiscount, recipient, registrationAddress, rentalEndDate, rentalStartDate, requiredDocs, selectedExtraItems, totalAmount, user?.id],
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
    : "Подтвердить заказ";

  const submitHint = isSubmitting
    ? "Проверяем данные и отправляем заказ. Обычно это занимает несколько секунд."
    : isCartEmpty
      ? `Добавьте хотя бы один байк в корзину, чтобы перейти к подтверждению ${flowLabel}.`
      : hasUnvalidatedPromo
        ? "Промокод введён, но ещё не применён. Нажмите «Применить» или очистите поле."
        : appliedPromo
          ? `Промокод ${appliedPromo.code} применён: ${appliedPromo.description}.`
          : "Проверьте контакты и подтверждайте заказ.";

  useEffect(() => {
    const loadPrefill = async () => {
      if (!dbUser?.user_id) return;
      const res = await getFranchizeFormPrefillAction({ userId: dbUser.user_id, slug });
      if (!res.success || !res.data) return;
      setValue("recipient", res.data.fullName || "");
      setValue("phone", res.data.phone || "");
      // preferredTime has no dedicated form field — merge into comment
      // so the operator still sees the customer's preferred time.
      const prefillComment = res.data.comment || "";
      const prefillTime = res.data.preferredTime || "";
      setValue("comment", prefillComment || prefillTime);
      setValue("deliveryMode", res.data.deliveryMode || "pickup");
    };
    void loadPrefill();
  }, [dbUser?.user_id, setValue, slug]);

  // Load rental secrets for returning users (WOW effect + signature prefill)
  useEffect(() => {
    const loadRentalSecrets = async () => {
      if (!dbUser?.user_id) return;

      // 1. Check for previous rentals (WOW effect)
      const res = await getFranchizeUserRentalSecretsAction({ userId: dbUser.user_id, slug });
      if (res.success && res.data?.hasPreviousRentals) {
        setIsReturningUser(true);
        setReturningUserLastRental(res.data.lastRentalDate ?? null);

        // Pre-fill form fields with saved rental secrets
        const { fullName, phone } = res.data.savedData || {};
        if (fullName) {
          setValue("recipient", fullName, { shouldDirty: false, shouldValidate: false });
        }
        if (phone) setValue("phone", phone, { shouldDirty: false, shouldValidate: false });
      }

      // 2. Load full rental docs prefill (passport, license, etc.)
      const docsRes = await getRentalDocsPrefillAction({ userId: dbUser.user_id, slug });
      if (docsRes.success && docsRes.data) {
        const d = docsRes.data;
        // Prefill recipient from docs if not already set
        if (d.fullName && !recipient) {
          setValue("recipient", d.fullName, { shouldDirty: false, shouldValidate: false });
        }
        if (d.phone) setValue("phone", d.phone, { shouldDirty: false, shouldValidate: false });
        // ── Auto-fill passport fields for 1-click-next-rental ──
        if (d.birthDate) setValue("birthDate", d.birthDate, { shouldDirty: false });
        if (d.passportSeries) setValue("passportSeries", d.passportSeries, { shouldDirty: false });
        if (d.passportNumber) setValue("passportNumber", d.passportNumber, { shouldDirty: false });
        if (d.passportIssueDate) setValue("passportIssueDate", d.passportIssueDate, { shouldDirty: false });
        if (d.passportIssuedBy) setValue("passportIssuedBy", d.passportIssuedBy, { shouldDirty: false });
        if (d.registrationAddress) setValue("registrationAddress", d.registrationAddress, { shouldDirty: false });
        // ── Auto-fill license fields ──
        if (d.licenseSeries) setValue("licenseSeries", d.licenseSeries, { shouldDirty: false });
        if (d.licenseNumber) setValue("licenseNumber", d.licenseNumber, { shouldDirty: false });
        if (d.licenseCategories) setValue("licenseCategories", d.licenseCategories, { shouldDirty: false });
        if (d.licenseExpiryDate) setValue("licenseExpiryDate", d.licenseExpiryDate, { shouldDirty: false });
        if (!d.licenseSeries && !d.licenseNumber) setValue("hasLicense", false, { shouldDirty: false });
      }
    };
    void loadRentalSecrets();
  }, [dbUser?.user_id, setValue, slug]);

  // Prefill the form's rentalStartDate from the cart (read-only echo
  // back to the user). The dates are owned by the cart line now — this
  // page just mirrors them.
  useEffect(() => {
    if (resolvedStartDate && rentalStartDate !== resolvedStartDate) {
      setValue("rentalStartDate", resolvedStartDate, { shouldDirty: false, shouldValidate: false });
    }
  }, [resolvedStartDate, rentalStartDate, setValue]);

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
  }, [checkoutBlockers, comment, flowType, hasTelegramUser, isCartEmpty, orderId, payment, phone, readinessPercent, recoveryDepositAmount, rentalEndDate, rentalStartDate, slug, submitPayload, totalAmount, user?.id]);

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
      rentalStartDate: submitPayload.rentalStartDate,
      rentalEndDate: submitPayload.rentalEndDate,
      signatureName: values.recipient.trim(),
      totalAmount: submitPayload.totalAmount,
      extras: submitPayload.extras,
      promoCode: submitPayload.promoCode,
      promoDiscount: submitPayload.promoDiscount,
      cartLines: submitPayload.cartLines,
    });

    if (isSubmitting || !canSubmit) {
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
        time: submitPayload.time,
        comment: submitPayload.comment,
        rentalStartDate: submitPayload.rentalStartDate,
        rentalEndDate: submitPayload.rentalEndDate,
        // ── Personal data for contract generation ──
        birthDate: submitPayload.birthDate,
        passportSeries: submitPayload.passportSeries,
        passportNumber: submitPayload.passportNumber,
        passportIssueDate: submitPayload.passportIssueDate,
        passportIssuedBy: submitPayload.passportIssuedBy,
        registrationAddress: submitPayload.registrationAddress,
        hasLicense: submitPayload.hasLicense,
        licenseSeries: submitPayload.licenseSeries,
        licenseNumber: submitPayload.licenseNumber,
        licenseCategories: submitPayload.licenseCategories,
        licenseExpiryDate: submitPayload.licenseExpiryDate,
        signatureName: values.recipient.trim(),
        signatureAccepted: true,
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
        pickupAddress: submitPayload.pickupAddress,
        requiredDocs: submitPayload.requiredDocs,
        flowType: submitPayload.flowType,
      });

      if (!result.success) {
        toast.error(result.error ?? "Не удалось отправить заказ.");
        lastSubmitFingerprintRef.current = null;
        return;
      }

      toast.success(submitPayload.flowType === "rental" ? "Заявка на аренду отправлена вместе с DOC-файлом." : "Заявка на покупку отправлена вместе с DOC-файлом.");

      // Clear cart after successful order
      clearCart();
      if (dbUser?.user_id) {
        saveUserFranchizeCartAction(dbUser.user_id, slug, {}).catch(() => {
          // Best-effort server-side cart clear
        });
      }

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
        ["--order-accent" as string]: accentMain,
        ["--order-border" as string]: borderSoft,
        ["--order-muted" as string]: textSecondary,
        ["--order-accent-contrast" as string]: "#16130A",
        ["--order-accent-on" as string]: accentTextOn,
        ["--order-text-primary" as string]: textPrimary,
        ["--order-text-muted" as string]: textMuted,
        ["--order-accent-soft" as string]: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 12%, transparent)" : `${crew.theme.palette.accentMain}1f`,
        ["--order-progress-track" as string]: isAuto ? "color-mix(in srgb, var(--franchize-border-soft) 50%, transparent)" : `${crew.theme.palette.borderSoft}80`,
        ["--order-progress-gradient-end" as string]: accentHover,
      }}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--order-accent)]">
        /franchize/{slug}/order/{orderId}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Оформление заказа</h1>

      {isReturningUser && (
        <div
          className="mt-4 rounded-2xl border p-4"
          style={{
            borderColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 30%, transparent)" : `${crew.theme.palette.accentMain}40`,
            backgroundColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 10%, transparent)" : `${crew.theme.palette.accentMain}1a`,
          }}
        >
          <p className="text-sm font-semibold" style={{ color: accentTextOn === "#16130A" ? crew.theme.palette.accentMain : textPrimary }}>
            С возвращением! {returningUserLastRental ? `Последняя аренда: ${returningUserLastRental}` : ""}
          </p>
          <p className="mt-1 text-xs" style={surface.mutedText}>
            Ваши данные из прошлой аренды сохранены. Просто проверьте и подтвердите заказ.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={catalogHref} className="rounded-xl border px-3 py-2 text-center text-xs transition hover:opacity-90" style={{ ...surface.subtleCard, ...focusRingOutlineStyle(crew.theme) } as React.CSSProperties}>Каталог</Link>
        <a
          href={telegramSupportHref}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-[var(--order-accent)] px-3 py-2 text-center text-xs font-semibold text-[var(--order-accent-contrast)] transition hover:brightness-105"
          style={focusRingOutlineStyle(crew.theme)}
        >
          Написать оператору
        </a>
      </div>

      <form className="mt-6 grid gap-4 md:grid-cols-[1fr_300px]" onSubmit={handleSubmit(onSubmitValid)}>
<div className="space-y-4">
          <div className="rounded-2xl border p-4" style={surface.card}>
            <p className="text-sm font-medium">Данные получателя</p>
            <div className="mt-3 space-y-3">
              <input className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Имя и фамилия" {...register("recipient")} />
              <input className="w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Телефон" {...register("phone")} />

              {/* Rental period — picked in the Item modal, shown read-only here */}
              {resolvedStartDate && resolvedEndDate ? (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                  style={{ borderColor: T.borderSoft, backgroundColor: T.accentSoft }}
                >
                  <Calendar className="h-4 w-4" style={{ color: T.accent }} />
                  <span className="font-semibold" style={{ color: T.text }}>
                    {formatRuDateFromISO(resolvedStartDate)} {resolvedStartTime}
                    {" → "}
                    {formatRuDateFromISO(resolvedEndDate)} {resolvedEndTime}
                  </span>
                  {rentalPeriodDays && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: T.accent, color: T.accentContrast }}
                    >
                      {rentalPeriodDays} {ruPluralDays(rentalPeriodDays)}
                    </span>
                  )}
                  <Link
                    href={catalogHref}
                    className="ml-auto text-[11px] underline-offset-2 hover:underline"
                    style={{ color: T.accent }}
                  >
                    Изменить в каталоге
                  </Link>
                </div>
              ) : null}

              <textarea className="min-h-20 w-full rounded-xl border px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }} placeholder="Комментарий к заказу" {...register("comment")} />
              {errors.recipient || errors.phone ? (
                <p className="text-xs" style={{ color: T.isLight ? "#b91c1c" : "#f87171" }}>
                  {errors.recipient?.message || errors.phone?.message}
                </p>
              ) : null}
            </div>
          </div>

          {/* ── Testdrive flow: simplified — name + phone, passport/license optional ── */}
          {flowType === "testdrive" && (
            <div className="rounded-2xl border p-4" style={surface.card}>
              <p className="text-sm font-medium">Данные для тест-драйва</p>
              <p className="mt-1 text-xs" style={surface.mutedText}>
                Для тест-драйва достаточно паспорта. Водительское удостоверение — если есть категория А.
              </p>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                    placeholder="Серия паспорта"
                    {...register("passportSeries")}
                  />
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                    placeholder="Номер паспорта"
                    {...register("passportNumber")}
                  />
                </div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Дата рождения (ДД.ММ.ГГГГ)"
                  {...register("birthDate")}
                />
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="hasLicenseTd"
                    className="h-4 w-4"
                    style={{ accentColor: T.accent }}
                    {...register("hasLicense")}
                  />
                  <label htmlFor="hasLicenseTd" className="text-xs" style={{ color: T.textMuted }}>
                    Есть водительское удостоверение (категория А)
                  </label>
                </div>
                {hasLicense && (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="rounded-xl border px-3 py-2 text-sm"
                      style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                      placeholder="Серия ВУ"
                      {...register("licenseSeries")}
                    />
                    <input
                      className="rounded-xl border px-3 py-2 text-sm"
                      style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                      placeholder="Номер ВУ"
                      {...register("licenseNumber")}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Passport + License fields for contract generation ── */}
          {flowType !== "sale" && flowType !== "testdrive" && (
            <div className="rounded-2xl border p-4" style={surface.card}>
              <p className="text-sm font-medium">Данные для договора аренды</p>
              <p className="mt-1 text-xs" style={surface.mutedText}>
                Заполняется один раз — при следующей аренде данные подставятся автоматически.
              </p>
              <div className="mt-3 space-y-3">
                {/* Passport */}
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                    placeholder="Серия паспорта (4509)"
                    {...register("passportSeries")}
                  />
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                    placeholder="Номер паспорта (123456)"
                    {...register("passportNumber")}
                  />
                </div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Дата выдачи паспорта (ДД.ММ.ГГГГ)"
                  {...register("passportIssueDate")}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Кем выдан (ОМВД по г. Н.Новгороду)"
                  {...register("passportIssuedBy")}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Дата рождения (ДД.ММ.ГГГГ)"
                  {...register("birthDate")}
                />
                <textarea
                  className="min-h-16 w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Адрес регистрации"
                  {...register("registrationAddress")}
                />

                {/* License */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="hasLicense"
                    className="h-4 w-4"
                    accent={T.accent}
                    {...register("hasLicense")}
                  />
                  <label htmlFor="hasLicense" className="text-xs" style={{ color: T.textMuted }}>
                    Есть водительское удостоверение
                  </label>
                </div>
                {hasLicense && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="rounded-xl border px-3 py-2 text-sm"
                        style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                        placeholder="Серия ВУ (99)"
                        {...register("licenseSeries")}
                      />
                      <input
                        className="rounded-xl border px-3 py-2 text-sm"
                        style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                        placeholder="Номер ВУ (76123456)"
                        {...register("licenseNumber")}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="rounded-xl border px-3 py-2 text-sm"
                        style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                        placeholder="Категории (A, B)"
                        {...register("licenseCategories")}
                      />
                      <input
                        className="rounded-xl border px-3 py-2 text-sm"
                        style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                        placeholder="Срок действия (ДД.ММ.ГГГГ)"
                        {...register("licenseExpiryDate")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* For SALE flow — only passport fields (no license needed) */}
          {flowType === "sale" && (
            <div className="rounded-2xl border p-4" style={surface.card}>
              <p className="text-sm font-medium">Данные для договора купли-продажи</p>
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                    placeholder="Серия паспорта"
                    {...register("passportSeries")}
                  />
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                    placeholder="Номер паспорта"
                    {...register("passportNumber")}
                  />
                </div>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Дата выдачи паспорта (ДД.ММ.ГГГГ)"
                  {...register("passportIssueDate")}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Кем выдан"
                  {...register("passportIssuedBy")}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Дата рождения (ДД.ММ.ГГГГ)"
                  {...register("birthDate")}
                />
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  style={{ ...fieldStyle, ...focusRingOutlineStyle(crew.theme) }}
                  placeholder="Адрес регистрации"
                  {...register("registrationAddress")}
                />
              </div>
            </div>
          )}

          <div className="rounded-2xl border p-4" style={surface.card}>
            <p className="text-sm font-medium">Оплата</p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
              {visiblePayments.map((item) => (
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
                    {item.description}
                  </p>
                </button>
              ))}
            </div>
            {paymentRetryHint ? (
              <div
                className="mt-2 rounded-2xl border p-3"
                style={{
                  borderColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 30%, transparent)" : `${crew.theme.palette.accentMain}40`,
                  backgroundColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 10%, transparent)" : `${crew.theme.palette.accentMain}1a`,
                }}
              >
                <p className="text-xs" style={{ color: textPrimary }}>{paymentRetryHint}</p>
                <button
                  type="button"
                  onClick={handleSwitchToFallbackPayment}
                  className="mt-2 inline-flex items-center rounded-xl border px-3 py-1 text-xs font-semibold transition hover:opacity-90"
                  style={{
                    borderColor: isAuto ? "color-mix(in srgb, var(--franchize-accent-main) 40%, transparent)" : `${crew.theme.palette.accentMain}55`,
                    color: accentMain,
                  }}
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
              <p
                className="mt-2 text-xs"
                style={
                  promoMessage.tone === "error"
                    ? { color: isAuto ? "var(--franchize-text-primary)" : "#b91c1c" }
                    : promoMessage.tone === "success"
                      ? { color: isAuto ? "var(--franchize-accent-main)" : crew.theme.palette.accentMain }
                      : surface.mutedText
                }
              >
                {promoMessage.text}
              </p>
            ) : null}
          </div>


          </div>

        <aside className="h-fit rounded-2xl border p-4" style={surface.card}>
          <p className="text-sm" style={surface.mutedText}>Заказ #{orderId}</p>

          {isCartEmpty ? (
            <div className="mt-3 rounded-xl border border-dashed p-3 text-sm" style={surface.subtleCard}>
              <p className="font-medium">Корзина пуста — заказ ещё некуда оформлять.</p>
              <Link
                href={catalogHref}
                className="mt-2 inline-flex font-medium text-[var(--order-accent)] underline-offset-4 hover:underline"
              >
                Вернуться в каталог
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-2 space-y-2 text-sm">
                {cartLines.map((line) => (
                  <li key={line.lineId} className="flex justify-between gap-2">
                    <span>
                      {line.item?.title ?? "Позиция недоступна"} × {line.qty}
                      {line.rentalPeriod && (
                        <span className="block text-[11px]" style={surface.mutedText}>{line.rentalPeriod}</span>
                      )}
                    </span>
                    <span>{line.lineTotal.toLocaleString("ru-RU")} ₽</span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 border-t border-[var(--order-border)] pt-3 text-sm">
                <p className="mt-1 flex justify-between"><span>Оплата</span><span>{payments.find((item) => item.id === payment)?.label ?? payment}</span></p>
                {resolvedStartDate && resolvedEndDate && (
                  <p className="mt-1 flex justify-between"><span>Период</span><span>{formatRuDateFromISO(resolvedStartDate)} → {formatRuDateFromISO(resolvedEndDate)}</span></p>
                )}
                <p className="mt-2 flex justify-between"><span>Подытог</span><span>{subtotal.toLocaleString("ru-RU")} ₽</span></p>
                {extrasTotal > 0 && (
                  <p className="mt-1 flex justify-between"><span>Доп. опции</span><span>{extrasTotal.toLocaleString("ru-RU")} ₽</span></p>
                )}
                {appliedPromo && (
                  <p className="mt-1 flex justify-between" style={{ color: T.isLight ? "#047857" : "#34d399" }}>
                    <span>Промокод {appliedPromo.code}</span>
                    <span>{promoDiscount > 0 ? `−${promoDiscount.toLocaleString("ru-RU")} ₽` : "бонус"}</span>
                  </p>
                )}
                <p className="mt-2 flex justify-between text-base font-bold" style={{ color: T.accent }}>
                  <span>Итого</span>
                  <span>{totalAmount.toLocaleString("ru-RU")} ₽</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={!canSubmit || isSubmitting}
                className="mt-4 w-full rounded-xl bg-[var(--order-accent)] px-4 py-3 text-sm font-semibold text-[var(--order-accent-contrast)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                style={focusRingOutlineStyle(crew.theme)}
              >
                {submitLabel}
              </button>
              <p className="mt-2 text-xs" style={surface.mutedText}>{submitHint}</p>

              <div className="mt-3 rounded-xl border border-[var(--order-border)] p-3 text-xs" style={surface.subtleCard}>
                <p style={surface.mutedText}>Адрес выдачи: {pickupAddress}</p>
                <p className="mt-1" style={surface.mutedText}>Документы: {requiredDocs.join(", ")}.</p>
              </div>
            </>
          )}
        </aside>
      </form>
    </section>
  );
}
