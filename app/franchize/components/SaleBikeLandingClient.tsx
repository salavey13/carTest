"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Battery,
  Check,
  Gauge,
  CalendarCheck,
  CreditCard,
  PhoneCall,
  Printer,
  Repeat2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Share2,
  Swords,
  Star,
  Tag,
  Timer,
  Weight,
  Zap,
} from "lucide-react";

import type { CatalogItemVM, FranchizeCrewVM } from "@/app/franchize/actions";
import {
  createFranchizeOrderInvoice,
  getFranchizeOperatorDashboardAccess,
  sendFranchizeBuyPrintPdf,
  upsertFranchizeIntent,
} from "@/app/franchize/actions";
import type { PageSize } from "@/app/franchize/server-actions/buy-print";
import { crewPaletteForSurface, crewPaletteWithCssVars } from "@/app/franchize/lib/theme";
import {
  DEFAULT_COLOR_OPTIONS,
  DEFAULT_CONFIG_OPTIONS,
  PREBUY_COMPARISON_OPTIONS,
  resolveBuyColorOptions,
  resolveBuyConfigOptions,
  type ColorOption,
  type ConfigOption,
  type PrebuyComparisonOption,
  type PrebuyIntentType,
} from "@/app/franchize/lib/sale-config";
import { buildCandidateImageUrls } from "@/app/franchize/lib/media";
import { localImageSrc, localVideoSrc, handleVideoError, supabaseUrlFromLocal } from "@/lib/image-fallback";
import { getTelegramWebAppFallbackHref } from "@/app/franchize/lib/telegram-links";
import { useFranchizeCart } from "@/app/franchize/hooks/useFranchizeCart";
import { useFranchizeTheme } from "@/app/franchize/hooks/useFranchizeTheme";
import { useAppContext } from "@/contexts/AppContext";
import {
  CATALOG_VS_SPECS,
  VsSpecRow,
  getCatalogVsSpecValue,
} from "@/components/franchize/VsSpecRow";
import {
  getCatalogPropulsionLabel,
  getCatalogPropulsionSegment,
} from "@/app/franchize/lib/catalog-propulsion";

type SaleActionState = "idle" | "loading" | "success" | "error";
type PrebuyStage =
  | "prebuy_started"
  | "test_ride_requested"
  | "trade_in_requested"
  | "finance_requested";

type TradeInFormState = {
  model: string;
  year: string;
  condition: string;
  contact: string;
};
type SaleBikeLandingClientProps = {
  crew: FranchizeCrewVM;
  item: CatalogItemVM;
  vsItem?: CatalogItemVM | null;
  otherSaleBikes?: CatalogItemVM[];
};

function formatPrice(value: number): string {
  return value > 0 ? `${value.toLocaleString("ru-RU")} ₽` : "по запросу";
}

function readSpecText(
  specs: Record<string, unknown>,
  keys: string[],
  fallback = "—",
): string {
  const value = keys
    .map((key) => specs[key])
    .find(
      (entry) => entry !== undefined && entry !== null && String(entry).trim(),
    );
  return value === undefined || value === null ? fallback : String(value);
}

function stageForIntent(intentType: PrebuyIntentType): PrebuyStage {
  if (intentType === "test_ride") return "test_ride_requested";
  if (intentType === "trade_in") return "trade_in_requested";
  if (intentType === "finance") return "finance_requested";
  return "prebuy_started";
}

export function SaleBikeLandingClient({
  crew,
  item,
  vsItem = null,
  otherSaleBikes = [],
}: SaleBikeLandingClientProps) {
  const router = useRouter();
  const { user, dbUser, tg, isInTelegramContext } = useAppContext();
  const [mounted, setMounted] = useState(false);
  const resolvedSlug = crew.slug || "vip-bike";

  // Use CSS variables when theme is in 'auto' mode
  const surface = crew.theme.isAuto ? crewPaletteWithCssVars(crew.theme) : crewPaletteForSurface(crew.theme);
  useFranchizeTheme(crew.theme);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Video support: show promo video instead of hero image if available
  const videoUrl = useMemo(
    () => (item.rawSpecs?.video_url as string | undefined) || (item.rawSpecs?.video as string | undefined) || null,
    [item.rawSpecs],
  );

  const gallery = useMemo(() => {
    const raw = item.mediaUrls?.filter(Boolean)?.length
      ? item.mediaUrls.filter(Boolean)
      : [item.imageUrl].filter(Boolean);
    const normalized = raw.flatMap((url) => buildCandidateImageUrls(url));
    return Array.from(new Set(normalized));
  }, [item.imageUrl, item.mediaUrls]);

  const heroImage =
    gallery[0] ?? "https://placehold.co/1200x900/0b0f13/e6edf3?text=No+image";
  const specs = useMemo(() => item.rawSpecs || {}, [item.rawSpecs]);
  const basePrice = Number(specs.price_rub || specs.sale_price || 0);

  const configOptions = useMemo(() => resolveBuyConfigOptions(specs), [specs]);
  const colorOptions = useMemo(() => resolveBuyColorOptions(specs), [specs]);

  const [selectedImage, setSelectedImage] = useState(0);
  const [brokenGalleryUrls, setBrokenGalleryUrls] = useState<
    Record<string, true>
  >({});
  const [selectedOptionId, setSelectedOptionId] = useState<string>(
    configOptions[0]?.id ?? "standard",
  );
  const [selectedColorId, setSelectedColorId] = useState<string>(
    colorOptions[0]?.id ?? "black",
  );
  const safeGallery = useMemo(
    () => gallery.filter((url) => !brokenGalleryUrls[url]),
    [gallery, brokenGalleryUrls],
  );

  useEffect(() => {
    if (selectedImage >= safeGallery.length) setSelectedImage(0);
  }, [selectedImage, safeGallery.length]);

  const selectedOption = useMemo(
    () =>
      configOptions.find((option) => option.id === selectedOptionId) ||
      configOptions[0],
    [configOptions, selectedOptionId],
  );

  const finalPrice = useMemo(
    () => (basePrice > 0 ? basePrice + selectedOption.priceDelta : 0),
    [basePrice, selectedOption.priceDelta],
  );

  const canShowConcretePrice = basePrice > 0;
  const propulsionSegment = useMemo(
    () => getCatalogPropulsionSegment(item),
    [item],
  );
  const propulsionLabel = getCatalogPropulsionLabel(propulsionSegment);

  const trustStats = useMemo(
    () => ({
      soldCount: Number(specs.sold_count || 120),
      rating: Number(specs.rating || 4.9),
      recommendPercent: Number(specs.recommend_percent || 98),
    }),
    [specs.rating, specs.recommend_percent, specs.sold_count],
  );

  useEffect(() => {
    if (!configOptions.find((option) => option.id === selectedOptionId)) {
      setSelectedOptionId(configOptions[0]?.id ?? "standard");
    }
  }, [configOptions, selectedOptionId]);

  useEffect(() => {
    if (!colorOptions.find((color) => color.id === selectedColorId)) {
      setSelectedColorId(colorOptions[0]?.id ?? "black");
    }
  }, [colorOptions, selectedColorId]);

  const cards = [
    { label: "Тип", value: item.category, icon: Tag },
    {
      label: "Мощность",
      value: String(specs.power_kw || specs.motor_peak_kw || "—"),
      icon: Zap,
    },
    { label: "Батарея", value: String(specs.battery || "—"), icon: Battery },
    { label: "Запас хода", value: `${specs.range_km || "—"} км`, icon: Gauge },
    {
      label: "Макс. скорость",
      value: `${specs.top_speed_kmh || "—"} км/ч`,
      icon: Gauge,
    },
    { label: "Вес", value: `${specs.weight_kg || "—"} кг`, icon: Weight },
    { label: "Зарядка", value: `${specs.charge_time_h || "—"} ч`, icon: Timer },
    { label: "Привод", value: String(specs.drive || "—"), icon: ShoppingBag },
  ];

  const buyFaq = [
    {
      q: "Как проходит покупка?",
      a: "Оставляете заявку, менеджер связывается, подтверждаем наличие и фиксируем конфигурацию. Дальше — договор, оплата и выдача с инструктажем.",
    },
    {
      q: "Можно ли протестировать перед покупкой?",
      a: "Да. Запишем на тест-драйв в офлайн-точке, подберем удобный слот и маршрут.",
    },
    {
      q: "Есть ли гарантия и сервис?",
      a: "Да, даем гарантийные условия, документы и сопровождение по сервису после покупки.",
    },
  ];

  const { addItem, isHydrated } = useFranchizeCart(resolvedSlug);
  const [reservationState, setReservationState] =
    useState<SaleActionState>("idle");
  const [purchaseState, setPurchaseState] = useState<SaleActionState>("idle");
  const [printState, setPrintState] = useState<SaleActionState>("idle");
  const [canPrintBuySheet, setCanPrintBuySheet] = useState(false);
  const [printPageSize, setPrintPageSize] = useState<PageSize>("A4");
  const [intentActionStates, setIntentActionStates] = useState<
    Partial<Record<string, SaleActionState>>
  >({});
  const [cartMessage, setCartMessage] = useState("");
  const [tradeInForm, setTradeInForm] = useState<TradeInFormState>({
    model: "",
    year: "",
    condition: "",
    contact: "",
  });
  const [financeMonths, setFinanceMonths] = useState(24);
  const [fallbackContact, setFallbackContact] = useState("");

  const currentContact =
    typeof (dbUser as { phone?: unknown } | null)?.phone === "string"
      ? (dbUser as { phone?: string } | null)?.phone
      : undefined;
  const telegramUserId = user?.id
    ? String(user.id)
    : dbUser?.user_id
      ? String(dbUser.user_id)
      : undefined;
  const telegramFirstContinuation = Boolean(telegramUserId);
  const hasTelegramRuntime = mounted && Boolean(
    isInTelegramContext ||
      tg?.initData ||
      tg?.initDataUnsafe?.user ||
      (typeof window !== "undefined" && window.Telegram?.WebApp),
  );
  const sourceRoute = `/franchize/${resolvedSlug}/market/${item.id}/buy`;
  const buyWebAppHref = getTelegramWebAppFallbackHref(
    "buy",
    item.id,
    crew.contacts.telegramBotUsername,
    "_",
  );
  const bikeCondition = readSpecText(
    specs,
    ["condition", "state", "bike_condition"],
    "new",
  );
  const checkedStatus = readSpecText(
    specs,
    ["checked_status", "checked", "inspection_status", "diagnostics"],
    "operator_checked",
  );
  const availability = `${item.availabilityStatus}:${item.availabilityLabel}`;
  const selectedColorLabel =
    colorOptions.find((color) => color.id === selectedColorId)?.label ?? "—";
  const normalizedFallbackContact = fallbackContact.trim();
  const normalizedTradeInContact = tradeInForm.contact.trim();
  const fallbackPhone = normalizedFallbackContact.startsWith("+")
    ? normalizedFallbackContact
    : undefined;
  const contactHint = telegramFirstContinuation
    ? "Продолжим в Telegram: оператор пришлёт подтверждение прямо в чат."
    : "Оставьте телефон или Telegram @handle — оператор продолжит без лишних шагов.";

  useEffect(() => {
    let cancelled = false;

    getFranchizeOperatorDashboardAccess({ slug: resolvedSlug })
      .then((result) => {
        if (cancelled) return;
        const role = String(result.role || "").toLowerCase();
        setCanPrintBuySheet(Boolean(result.canOpen && ["admin", "owner"].includes(role)));
      })
      .catch(() => {
        if (!cancelled) setCanPrintBuySheet(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedSlug]);

  const monthlyPaymentEstimate = useMemo(() => {
    if (finalPrice <= 0) return 0;
    return Math.ceil((finalPrice * 1.08) / financeMonths / 100) * 100;
  }, [financeMonths, finalPrice]);

  const reservationAmountXtr = useMemo(
    () =>
      Math.min(
        500,
        Math.max(
          100,
          Math.ceil((finalPrice > 0 ? finalPrice : basePrice) * 0.001),
        ),
      ),
    [basePrice, finalPrice],
  );

  const selectVsBike = (bikeId: string) => {
    router.push(
      `${window.location.pathname}?vs=${encodeURIComponent(bikeId)}`,
      { scroll: false },
    );
  };

  const clearVsBike = () => {
    router.push(window.location.pathname, { scroll: false });
  };

  const recordSaleIntent = async (input: {
    intentType:
      | PrebuyIntentType
      | "test_ride_click"
      | "hold_created"
      | "payment_failure";
    stage: PrebuyStage | "hold_created" | "payment_failed";
    urgencyScore: number;
    selectedOption?: string;
    contactChannel?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const selectedFlowOption = input.selectedOption ?? selectedOption.id;

    try {
      const result = await upsertFranchizeIntent({
        slug: resolvedSlug,
        bikeId: item.id,
        intentType: input.intentType,
        stage: input.stage,
        sourceRoute,
        contactChannel:
          input.contactChannel ??
          (telegramFirstContinuation ? "telegram" : "phone_or_handle"),
        urgencyScore: input.urgencyScore,
        telegramUserId,
        phone: currentContact ?? fallbackPhone,
        metadata: {
          itemTitle: item.title,
          bikePrice: finalPrice,
          basePrice,
          condition: bikeCondition,
          checkedStatus,
          availability,
          selectedOption: selectedFlowOption,
          selectedOptionId,
          selectedOptionLabel: selectedOption.label,
          selectedColorId,
          selectedColorLabel,
          sourceRoute,
          telegramFirstContinuation,
          fallbackContact: normalizedFallbackContact || undefined,
          ...input.metadata,
        },
      });

      if (!result.success) {
        console.warn("sale intent tracking failed", result.error);
      }

      return result;
    } catch (error) {
      console.warn("sale intent tracking failed", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить заявку.",
      };
    }
  };

  const handleComparisonCta = async (option: PrebuyComparisonOption) => {
    if (option.id === "buy_now") {
      setIntentActionStates((prev) => ({ ...prev, [option.id]: "loading" }));
      await handleAddToCart();
      setIntentActionStates((prev) => ({ ...prev, [option.id]: "success" }));
      return;
    }

    const hasFallbackContinuation = Boolean(
      normalizedFallbackContact ||
      (option.intentType === "trade_in" && normalizedTradeInContact),
    );
    const requiresFallbackContact =
      !telegramFirstContinuation && !hasFallbackContinuation;
    if (requiresFallbackContact) {
      setCartMessage(
        "Оставьте телефон или Telegram @handle, чтобы оператор продолжил заявку.",
      );
      return;
    }

    if (option.intentType === "trade_in") {
      const hasTradeInMinimum =
        tradeInForm.model.trim() &&
        tradeInForm.year.trim() &&
        tradeInForm.condition.trim();
      if (
        !hasTradeInMinimum ||
        (!telegramFirstContinuation &&
          !normalizedTradeInContact &&
          !normalizedFallbackContact)
      ) {
        setCartMessage(
          "Для trade-in заполните модель, год, состояние и контакт.",
        );
        return;
      }
    }

    setIntentActionStates((prev) => ({ ...prev, [option.id]: "loading" }));
    setCartMessage("");

    try {
      const result = await recordSaleIntent({
        intentType: option.intentType,
        stage: stageForIntent(option.intentType),
        urgencyScore: option.urgencyScore,
        selectedOption: option.id,
        metadata: {
          action: `comparison_${option.id}`,
          flowLabel: option.label,
          tradeIn:
            option.intentType === "trade_in"
              ? {
                  ...tradeInForm,
                  contact:
                    normalizedTradeInContact || normalizedFallbackContact,
                }
              : undefined,
          finance:
            option.intentType === "finance"
              ? {
                  months: financeMonths,
                  monthlyPaymentEstimate,
                  disclaimer: "operator_will_confirm_terms",
                }
              : undefined,
        },
      });

      if (!result.success) {
        throw new Error(result.error ?? "Не удалось сохранить заявку.");
      }

      setIntentActionStates((prev) => ({ ...prev, [option.id]: "success" }));

      setCartMessage(
        telegramFirstContinuation
          ? `${option.label}: заявка записана. Подтверждение придёт в Telegram.`
          : `${option.label}: заявка записана. Оператор свяжется по указанному контакту.`,
      );
    } catch (error) {
      console.error("buy/comparison intent failed", error);
      setIntentActionStates((prev) => ({ ...prev, [option.id]: "error" }));
      setCartMessage(
        "Не удалось записать заявку. Проверьте контакт и попробуйте ещё раз.",
      );
    }
  };

  const buildBuyOptions = () => ({
    package: selectedOption.label,
    duration: "Покупка",
    perk: `Цвет: ${colorOptions.find((color) => color.id === selectedColorId)?.label ?? "—"}`,
    auction: "Покупка",
  });

  const handleAddToCart = async () => {
    if (!isHydrated) return;
    setPurchaseState("loading");
    setCartMessage("");
    try {
      addItem(
        item.id,
        {
          ...buildBuyOptions(),
          buyConfigId: selectedOption.id,
          buyPriceDelta: selectedOption.priceDelta,
          buyColorId: selectedColorId,
        },
        1,
      );
      setPurchaseState("success");
      setCartMessage(
        "Конфигурация добавлена в корзину. Открываем оформление покупки.",
      );
      await recordSaleIntent({
        intentType: "prebuy",
        stage: "prebuy_started",
        urgencyScore: 60,
        selectedOption: "buy_now",
        metadata: { action: "add_to_cart" },
      });
      router.push(`/franchize/${resolvedSlug}/cart`);
    } catch (error) {
      console.error("buy/add-to-cart failed", error);
      setPurchaseState("error");
      setCartMessage("Не удалось добавить конфигурацию. Попробуйте ещё раз.");
    }
  };


  const handleShareBuyLink = useCallback(async () => {
    const shareTitle = `Карточка ${item.title}`;
    const shareText = `${shareTitle}: ${buyWebAppHref}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(buyWebAppHref)}&text=${encodeURIComponent(shareTitle)}`;

    tg?.HapticFeedback?.impactOccurred?.("light");

    const openTelegramShare = () => {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(shareUrl);
        return true;
      }

      if (tg?.openLink) {
        tg.openLink(shareUrl);
        return true;
      }

      if (typeof window !== "undefined") {
        window.open(shareUrl, "_blank", "noopener,noreferrer");
        return true;
      }

      return false;
    };

    try {
      // Native `switchInlineQuery` silently depends on bot inline-mode support,
      // so prefer Telegram's share URL first: it opens the chat picker for any bot.
      if (openTelegramShare()) {
        setCartMessage("Открыли Telegram-отправку карточки. Выберите чат для ссылки.");
        return;
      }
    } catch (error) {
      console.warn("buy/share telegram link failed", error);
    }

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: buyWebAppHref });
        setCartMessage("Ссылка на карточку отправлена через системное меню.");
        return;
      }
    } catch (error) {
      console.warn("buy/share native menu failed", error);
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        setCartMessage("Ссылка скопирована. Вставьте её в нужный Telegram-чат.");
        tg?.showPopup?.({
          title: "Ссылка скопирована",
          message: "Вставьте её в нужный Telegram-чат.",
          buttons: [{ type: "ok" }],
        });
      }
    } catch (error) {
      console.warn("buy/share clipboard fallback failed", error);
      setCartMessage("Не удалось открыть отправку. Скопируйте ссылку из адресной строки.");
    }
  }, [buyWebAppHref, item.title, tg]);

  const handlePrintBuySheet = async () => {
    setPrintState("loading");
    setCartMessage("");

    try {
      const result = await sendFranchizeBuyPrintPdf({
        slug: resolvedSlug,
        bikeId: item.id,
        pageSize: printPageSize,
      });

      if (!result.success) {
        throw new Error(result.error || "Не удалось отправить PDF.");
      }

      setPrintState("success");
      setCartMessage(`PDF ${result.fileName || "карточки"} (${printPageSize}) отправлен вам в Telegram.`);
    } catch (error) {
      console.error("buy/print-pdf failed", error);
      setPrintState("error");
      setCartMessage(
        error instanceof Error
          ? error.message
          : "Не удалось отправить PDF в Telegram.",
      );
    }
  };

  const handleReserveTestDrive = async () => {
    if (!isHydrated) return;
    if (!telegramUserId) {
      setReservationState("error");
      setCartMessage(
        "Откройте страницу в Telegram WebApp, чтобы получить счёт на бронь тест-драйва.",
      );
      return;
    }

    void recordSaleIntent({
      intentType: "test_ride",
      stage: "test_ride_requested",
      urgencyScore: 85,
      selectedOption: "test_ride_paid_hold",
      contactChannel: "telegram_xtr",
      metadata: { action: "reserve_test_drive_click" },
    });

    const options = buildBuyOptions();
    setReservationState("loading");
    setCartMessage("");
    try {
      const result = await createFranchizeOrderInvoice({
        slug: resolvedSlug,
        orderId: `testdrive-${item.id}-${Date.now()}`,
        telegramUserId,
        recipient: String(
          dbUser?.full_name || user?.first_name || "Гость Telegram",
        ),
        phone: crew.contacts?.phone || "+79999005588",
        time: "Тест-драйв: ближайший свободный слот",
        comment: `Бронь тест-драйва для покупки ${item.title}`,
        payment: "telegram_xtr",
        delivery: "pickup",
        subtotal: finalPrice,
        extrasTotal: 0,
        totalAmount: finalPrice,
        extras: [],
        cartLines: [
          {
            itemId: item.id,
            qty: 1,
            pricePerDay: finalPrice,
            lineTotal: finalPrice,
            options,
          },
        ],
        flowType: "sale",
      });

      if (!result.success) {
        void recordSaleIntent({
          intentType: "payment_failure",
          stage: "payment_failed",
          urgencyScore: 90,
          metadata: {
            action: "test_drive_invoice_failed",
            error: result.error,
          },
        });
        setReservationState("error");
        setCartMessage(result.error ?? "Не удалось отправить счёт в Telegram.");
        return;
      }

      void recordSaleIntent({
        intentType: "hold_created",
        stage: "hold_created",
        urgencyScore: 95,
        metadata: {
          action: "test_drive_invoice_sent",
          invoiceId: result.invoiceId,
          amountXtr: result.amountXtr,
        },
      });
      setReservationState("success");
      setCartMessage(
        `Счёт на бронь тест-драйва отправлен в Telegram: ${result.amountXtr ?? reservationAmountXtr} XTR.`,
      );
    } catch (error) {
      void recordSaleIntent({
        intentType: "payment_failure",
        stage: "payment_failed",
        urgencyScore: 90,
        metadata: {
          action: "test_drive_exception",
          error: error instanceof Error ? error.message : String(error),
        },
      });
      console.error("buy/reserve-test-drive failed", error);
      setReservationState("error");
      setCartMessage(
        "Не удалось забронировать тест-драйв. Попробуйте ещё раз.",
      );
    }
  };

  return (
    <div className="pb-28 pt-3 sm:pt-6" style={surface.page}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/franchize/${resolvedSlug}?vehicle=${item.id}&flow=buy`}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
            style={surface.subtleCard}
          >
            <ArrowLeft className="h-4 w-4" />В маркет
          </Link>
          <span
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={surface.subtleCard}
          >
            На продажу
          </span>
        </div>

        {/* Gallery Section - moved to top */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border p-2 sm:p-3"
          style={surface.card}
        >
          <div className="relative aspect-[9/16] sm:aspect-video w-full overflow-hidden rounded-2xl bg-black/30">
            {videoUrl && selectedImage === 0 ? (
                <video
                  src={localVideoSrc(videoUrl)}
                  poster={localImageSrc(heroImage)}
                  controls
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  onError={handleVideoError(videoUrl)}
                />
              ) : (
                <Image
                  src={safeGallery[selectedImage] ?? heroImage}
                  alt={item.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 100vw"
                  loading="lazy"
                  className="object-cover"
                  onError={() => {
                    const broken = safeGallery[selectedImage];
                    if (!broken) return;
                    setBrokenGalleryUrls((prev) => ({
                      ...prev,
                      [broken]: true,
                    }));
                  }}
                />
              )}
          </div>
          <div className="grid grid-cols-5 gap-2 mt-2" suppressHydrationWarning>
            {videoUrl && (
              <button
                key="video-thumb"
                type="button"
                onClick={() => setSelectedImage(0)}
                className="overflow-hidden rounded-xl border transition hover:brightness-110 relative"
                style={selectedImage === 0 ? { borderColor: crew.theme.palette.accentMain, boxShadow: `0 0 0 1px ${crew.theme.palette.accentMain}` } : {}}
              >
                <span className="relative block aspect-[4/3] w-full">
                  <Image src={localImageSrc(heroImage)} alt="video" fill sizes="120px" className="object-cover" loading="lazy" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                  </span>
                </span>
              </button>
            )}
            {gallery.slice(0, 5).map((img, i) => {
              const thumbIdx = videoUrl ? i + 1 : i;
              const isBroken = brokenGalleryUrls[img];
              if (isBroken) return null;
              return (
                <button
                  key={`${img}-${i}`}
                  type="button"
                  onClick={() => setSelectedImage(i)}
                  className="overflow-hidden rounded-xl border transition hover:brightness-110"
                  style={{
                    ...(i === selectedImage
                      ? {
                          borderColor: crew.theme.palette.accentMain,
                          boxShadow: `0 0 0 1px ${crew.theme.palette.accentMain}`,
                        }
                      : {}),
                  }}
                >
                  <span className="relative block aspect-[4/3] w-full">
                    <Image
                      src={img}
                      alt={`${item.title}-${i}`}
                      fill
                      sizes="120px"
                      className="object-cover"
                      loading="lazy"
                      onError={() =>
                        setBrokenGalleryUrls((prev) => ({
                          ...prev,
                          [img]: true,
                        }))
                      }
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Test info cards - moved below gallery */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border p-4" style={surface.subtleCard}>
            <p className="text-xs uppercase tracking-[0.16em] opacity-70">
              Тест-драйв
            </p>
            <p className="mt-2 text-sm">
              Офлайн-показ и тест-драйв по предварительной записи.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={surface.subtleCard}>
            <p className="text-xs uppercase tracking-[0.16em] opacity-70">
              Группа магазина
            </p>
            <p className="mt-2 text-sm">
              Актуальные поставки и консультации:{" "}
              <a
                className="underline"
                href="https://vk.ru/vip_bike_electro"
                target="_blank"
                rel="noreferrer"
              >
                vk.ru/vip_bike_electro
              </a>
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={surface.subtleCard}>
            <p className="text-xs uppercase tracking-[0.16em] opacity-70">
              После покупки
            </p>
            <p className="mt-2 text-sm">
              Сервисное сопровождение и рекомендации по обслуживанию.
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border"
          style={surface.card}
        >
          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2" suppressHydrationWarning>
                <div
                  className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                  style={surface.subtleCard}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Premium eMoto
                </div>
                {otherSaleBikes.length > 0 && !vsItem ? (
                  <div className="group relative">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                      style={surface.subtleCard}
                    >
                      <Swords className="h-3.5 w-3.5" />
                      Сравнить
                    </button>
                    <div
                      className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border p-2 opacity-0 shadow-2xl transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
                      style={surface.card}
                    >
                      <p className="px-2 pb-1 text-xs opacity-70">
                        Выберите байк для VS
                      </p>
                      <p className="px-2 pb-2 text-[11px] opacity-55">
                        Показываем только {propulsionLabel}
                      </p>
                      {otherSaleBikes.slice(0, 5).map((bike) => (
                        <button
                          key={bike.id}
                          type="button"
                          onClick={() => selectVsBike(bike.id)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left text-xs transition hover:bg-white/5"
                        >
                          <span className="min-w-0 truncate">{bike.title}</span>
                          <Swords className="h-3.5 w-3.5 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {item.title}
              </h1>
              <p className="text-sm opacity-80">{item.description}</p>

              <div
                className="rounded-2xl border p-4"
                style={surface.subtleCard}
              >
                <p className="text-xs uppercase tracking-[0.16em] opacity-70">
                  Цена продажи
                </p>
                <p className="text-3xl font-bold sm:text-4xl">
                  {formatPrice(finalPrice)}
                </p>
                {!canShowConcretePrice ? (
                  <p className="mt-1 text-xs opacity-70">
                    Точная стоимость зависит от комплектации и наличия.
                  </p>
                ) : null}
                <p className="mt-2 inline-flex items-center gap-2 text-xs opacity-80">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Официальная сделка + документы
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2" suppressHydrationWarning>
                  {!hasTelegramRuntime ? (
                    <a
                      href={buyWebAppHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:brightness-110"
                      style={surface.subtleCard}
                    >
                      <Sparkles className="h-4 w-4" />
                      Открыть в Telegram
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleShareBuyLink}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:brightness-110"
                      style={surface.subtleCard}
                    >
                      <Share2 className="h-4 w-4" />
                      Поделиться
                    </button>
                  )}
                  {canPrintBuySheet ? (
                    <>
                      <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={surface.subtleCard}>
                        <span className="opacity-70">Формат:</span>
                        <button
                          type="button"
                          onClick={() => setPrintPageSize("A4")}
                          className={`rounded px-2 py-1 transition ${
                            printPageSize === "A4"
                              ? "font-semibold"
                              : "opacity-60 hover:opacity-100"
                          }`}
                          style={
                            printPageSize === "A4"
                              ? { background: crew.theme.palette.accentMain, color: "#101010" }
                              : {}
                          }
                        >
                          A4
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintPageSize("A5")}
                          className={`rounded px-2 py-1 transition ${
                            printPageSize === "A5"
                              ? "font-semibold"
                              : "opacity-60 hover:opacity-100"
                          }`}
                          style={
                            printPageSize === "A5"
                              ? { background: crew.theme.palette.accentMain, color: "#101010" }
                              : {}
                          }
                        >
                          A5
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handlePrintBuySheet}
                        disabled={printState === "loading"}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        style={{
                          ...surface.subtleCard,
                          borderColor: crew.theme.palette.accentMain,
                        }}
                      >
                        <Printer className="h-4 w-4" />
                        {printState === "loading"
                          ? "Готовим PDF..."
                          : printState === "success"
                            ? "PDF отправлен"
                            : printState === "error"
                              ? "Повторить печать"
                              : "Распечатать"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              <div
                className="rounded-2xl border p-3"
                style={surface.subtleCard}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.16em] opacity-70">
                      Prebuy flow
                    </p>
                    <h2 className="text-lg font-semibold">
                      Покупка, тест или trade-in?
                    </h2>
                  </div>
                  <span className="rounded-full border px-2.5 py-1 text-[11px] opacity-80">
                    {contactHint}
                  </span>
                </div>

                {!telegramFirstContinuation ? (
                  <label className="mt-3 block text-xs font-semibold">
                    Телефон или Telegram @handle для продолжения
                    <input
                      value={fallbackContact}
                      onChange={(event) =>
                        setFallbackContact(event.target.value)
                      }
                      placeholder="+7... или @username"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/30"
                    />
                  </label>
                ) : null}

                <div className="mt-3 grid gap-2">
                  {PREBUY_COMPARISON_OPTIONS.map((option) => {
                    const state = intentActionStates[option.id] ?? "idle";
                    const Icon =
                      option.intentType === "test_ride"
                        ? CalendarCheck
                        : option.intentType === "trade_in"
                          ? Repeat2
                          : option.intentType === "finance"
                            ? CreditCard
                            : ShoppingBag;

                    return (
                      <div
                        key={option.id}
                        className="rounded-2xl border p-3"
                        style={surface.card}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={surface.accentPill}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">
                              {option.label}
                            </p>
                            <p className="mt-0.5 text-xs opacity-70">
                              {option.title}
                            </p>
                            <p className="mt-1 text-xs opacity-60">
                              {option.description}
                            </p>
                          </div>
                        </div>

                        {option.intentType === "trade_in" ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <input
                              value={tradeInForm.model}
                              onChange={(event) =>
                                setTradeInForm((prev) => ({
                                  ...prev,
                                  model: event.target.value,
                                }))
                              }
                              placeholder="Текущий байк: модель"
                              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-white/30"
                            />
                            <input
                              value={tradeInForm.year}
                              onChange={(event) =>
                                setTradeInForm((prev) => ({
                                  ...prev,
                                  year: event.target.value,
                                }))
                              }
                              placeholder="Год"
                              inputMode="numeric"
                              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-white/30"
                            />
                            <input
                              value={tradeInForm.condition}
                              onChange={(event) =>
                                setTradeInForm((prev) => ({
                                  ...prev,
                                  condition: event.target.value,
                                }))
                              }
                              placeholder="Состояние"
                              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-white/30"
                            />
                            <input
                              value={tradeInForm.contact}
                              onChange={(event) =>
                                setTradeInForm((prev) => ({
                                  ...prev,
                                  contact: event.target.value,
                                }))
                              }
                              placeholder={
                                telegramFirstContinuation
                                  ? "Контакт необязателен"
                                  : "Телефон/@handle"
                              }
                              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-white/30"
                            />
                          </div>
                        ) : null}

                        {option.intentType === "finance" ? (
                          <div className="mt-3 rounded-xl border border-white/10 p-3 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="opacity-70">Срок</span>
                              <select
                                value={financeMonths}
                                onChange={(event) =>
                                  setFinanceMonths(Number(event.target.value))
                                }
                                className="rounded-lg border border-white/10 bg-black/30 px-2 py-1"
                              >
                                {[12, 18, 24, 36].map((months) => (
                                  <option key={months} value={months}>
                                    {months} мес.
                                  </option>
                                ))}
                              </select>
                            </div>
                            <p className="mt-2 text-lg font-bold">
                              ≈{" "}
                              {monthlyPaymentEstimate > 0
                                ? monthlyPaymentEstimate.toLocaleString("ru-RU")
                                : "—"}{" "}
                              ₽/мес.
                            </p>
                            <p className="mt-1 opacity-60">
                              Предварительная оценка. Условия, первый взнос и
                              одобрение подтверждает оператор.
                            </p>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => handleComparisonCta(option)}
                          disabled={
                            state === "loading" ||
                            (option.id === "buy_now" &&
                              purchaseState === "loading")
                          }
                          className="mt-3 w-full rounded-xl border px-3 py-2 text-sm font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                          style={
                            option.id === "buy_now"
                              ? {
                                  ...surface.subtleCard,
                                  borderColor: crew.theme.palette.accentMain,
                                }
                              : surface.subtleCard
                          }
                        >
                          {state === "loading"
                            ? "Записываем..."
                            : state === "success"
                              ? "Заявка записана"
                              : state === "error"
                                ? "Повторить"
                                : option.ctaLabel}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs opacity-70">
                  Оплата {reservationAmountXtr.toLocaleString("ru-RU")} ₽ через
                  Telegram — гарантия вашей брони на тест-драйв. Остаток суммы
                  при покупке на базе.
                </p>
                <button
                  type="button"
                  onClick={handleReserveTestDrive}
                  disabled={!isHydrated || reservationState === "loading"}
                  className="rounded-xl px-4 py-3 text-center font-semibold transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  aria-live="polite"
                  style={{
                    ...surface.subtleCard,
                    background: crew.theme.palette.accentMain,
                    color: "#101010",
                  }}
                >
                  {!isHydrated
                    ? "Подготовка Telegram..."
                    : reservationState === "loading"
                      ? "Отправляем счёт..."
                      : reservationState === "success"
                        ? "Счёт отправлен"
                        : reservationState === "error"
                          ? "Повторить бронь"
                          : `Забронировать тест-драйв (${reservationAmountXtr.toLocaleString("ru-RU")} ₽)`}
                </button>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!isHydrated || purchaseState === "loading"}
                    className="inline-flex items-center justify-center rounded-xl border px-4 py-3 text-center font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    style={surface.subtleCard}
                  >
                    {purchaseState === "loading"
                      ? "Добавляем..."
                      : purchaseState === "success"
                        ? "Добавлено в корзину"
                        : purchaseState === "error"
                          ? "Повторить покупку"
                          : "Оформить покупку"}
                  </button>
                  <Link
                    href={`tel:${crew.contacts?.phone || "+79999005588"}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center font-semibold"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Позвонить
                  </Link>
                </div>
                {cartMessage ? (
                  <p className="text-xs opacity-75">{cartMessage}</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border p-3"
                style={surface.subtleCard}
              >
                <card.icon className="mb-2 h-4 w-4 opacity-80" />
                <p className="text-xs opacity-70">{card.label}</p>
                <p className="text-sm font-semibold">{card.value}</p>
              </div>
            ))}
          </div>

          {vsItem ? (
            <div
              className="mx-3 mb-3 rounded-3xl border border-white/10 p-3"
              style={surface.subtleCard}
              suppressHydrationWarning
            >
              <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] opacity-55">
                    {propulsionLabel}
                  </p>
                </div>
                <Swords
                  className="h-7 w-7"
                  style={{ color: crew.theme.palette.accentMain }}
                />
                <div className="flex items-center justify-end gap-2 text-sm font-semibold">
                  <span className="min-w-0 truncate">{vsItem.title}</span>
                  <button
                    type="button"
                    onClick={clearVsBike}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {CATALOG_VS_SPECS.map((spec) => (
                  <VsSpecRow
                    key={spec.label}
                    label={spec.label}
                    valueA={getCatalogVsSpecValue(item.rawSpecs, spec.keys)}
                    valueB={getCatalogVsSpecValue(vsItem.rawSpecs, spec.keys)}
                    unit={spec.unit}
                    lowerIsBetter={spec.lowerIsBetter}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>

        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-3xl border p-4 sm:p-5" style={surface.card}>
            <h2 className="text-xl font-semibold sm:text-2xl">Конфигуратор</h2>
            <p className="mt-1 text-sm opacity-80">
              Соберите конфигурацию под себя и сразу видьте итоговую цену.
            </p>
            <div className="mt-4 space-y-2">
              {configOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedOptionId(option.id)}
                  className="flex w-full items-center justify-between rounded-2xl border p-3 text-left transition hover:brightness-110"
                  style={
                    selectedOptionId === option.id
                      ? {
                          ...surface.subtleCard,
                          borderColor: crew.theme.palette.accentMain,
                        }
                      : surface.subtleCard
                  }
                >
                  <div>
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-xs opacity-70">{option.subtitle}</p>
                  </div>
                  <p className="font-semibold">
                    {option.priceDelta === 0
                      ? "Включено"
                      : `+ ${option.priceDelta.toLocaleString("ru-RU")} ₽`}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setSelectedColorId(color.id)}
                  aria-label={color.label}
                  className="h-8 w-8 rounded-full border-2"
                  style={{
                    background: color.hex,
                    borderColor:
                      selectedColorId === color.id
                        ? crew.theme.palette.accentMain
                        : "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-3xl border p-4 sm:p-5" style={surface.card}>
            <h2 className="text-xl font-semibold">Нам доверяют</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border p-3" style={surface.subtleCard}>
                <p className="text-2xl font-bold">{trustStats.soldCount}+</p>
                <p className="text-xs opacity-70">Продано</p>
              </div>
              <div className="rounded-xl border p-3" style={surface.subtleCard}>
                <p className="text-2xl font-bold">
                  {trustStats.rating.toFixed(1)}
                </p>
                <p className="text-xs opacity-70">Рейтинг</p>
              </div>
              <div className="rounded-xl border p-3" style={surface.subtleCard}>
                <p className="text-2xl font-bold">
                  {trustStats.recommendPercent}%
                </p>
                <p className="text-xs opacity-70">Рекомендуют</p>
              </div>
            </div>
            <div
              className="mt-3 rounded-2xl border p-3"
              style={surface.subtleCard}
            >
              <p className="font-medium">Алексей, Москва</p>
              <p className="mt-1 inline-flex items-center gap-1 text-yellow-300">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
              </p>
              <p className="mt-1 text-sm opacity-80">
                "Отличный байк и сервис, быстро оформили и объяснили всё по
                обслуживанию."
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border p-4 sm:p-5" style={surface.card}>
          <h2 className="text-xl font-semibold sm:text-2xl">FAQ по покупке</h2>
          <div className="mt-3 space-y-3">
            {buyFaq.map((faq) => (
              <details
                key={faq.q}
                className="rounded-2xl border p-4 open:shadow-sm"
                style={surface.subtleCard}
              >
                <summary className="cursor-pointer list-none font-medium">
                  {faq.q}
                </summary>
                <p className="mt-2 text-sm opacity-80">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      <div
        className="fixed inset-x-2 bottom-2 z-40 rounded-2xl border p-2 backdrop-blur md:hidden"
        style={surface.card}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p
              className="text-base font-bold"
              style={{ color: crew.theme.palette.accentMain }}
            >
              {formatPrice(finalPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleReserveTestDrive}
            disabled={!isHydrated || reservationState === "loading"}
            className="rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: crew.theme.palette.accentMain, color: "#111" }}
          >
            {reservationState === "success" ? (
              <Check className="h-4 w-4" />
            ) : reservationState === "loading" ? (
              "..."
            ) : (
              `Тест-драйв ${reservationAmountXtr.toLocaleString("ru-RU")} ₽`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
