"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Bike,
  User,
  CreditCard,
  Calendar,
  FileText,
  Loader2,
  AlertCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { FranchizeTheme, CatalogItemVM } from "@/app/franchize/actions";
import { withAlpha } from "@/app/franchize/lib/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubrentFlowClientProps {
  crew: { id: string; name: string; theme: FranchizeTheme };
  crewSlug: string;
  bikes: CatalogItemVM[];
  theme: FranchizeTheme;
  accentText: string;
  onClose?: () => void;
}

interface SubrentFormData {
  // Bike selection
  bikeId?: string;
  bikePlate?: string;
  bikeVin?: string;
  bikeYear?: string;
  bikeValue?: string;

  // Owner info
  ownerFullName: string;
  ownerPhone: string;
  ownerEmail: string;
  ownerBirthDate: string;
  ownerPassportSeries: string;
  ownerPassportNumber: string;
  ownerPassportIssueDate: string;
  ownerPassportIssuedBy: string;
  ownerRegistration: string;

  // Payment terms
  ownerPercentage: number;
  minDailyPrice: number;

  // Contract terms
  contractStartDate: string;
  contractDuration: "season" | "3m" | "6m" | "1y";
}

const STEPS = [
  { id: "bike", title: "Мотоцикл", icon: Bike },
  { id: "owner", title: "Собственник", icon: User },
  { id: "payment", title: "Условия", icon: CreditCard },
  { id: "dates", title: "Срок", icon: Calendar },
  { id: "confirm", title: "Проверка", icon: FileText },
] as const;

const PERCENTAGE_OPTIONS = [30, 40, 50, 60, 70];
const DURATION_OPTIONS = [
  { value: "season", label: "До 22 ноября", description: "Сезон 2026" },
  { value: "3m", label: "3 месяца", description: "Короткий срок" },
  { value: "6m", label: "6 месяцев", description: "Средний срок" },
  { value: "1y", label: "1 год", description: "Долгий срок" },
] as const;

// ─── Component ─────────────────────────────────────────────────────────────────

export function SubrentFlowClient({
  crew,
  crewSlug,
  bikes,
  theme,
  accentText,
  onClose,
}: SubrentFlowClientProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SubrentFormData>({
    bikeId: undefined,
    bikePlate: "",
    bikeVin: "",
    bikeYear: "",
    bikeValue: "",
    ownerFullName: "",
    ownerPhone: "",
    ownerEmail: "",
    ownerBirthDate: "",
    ownerPassportSeries: "",
    ownerPassportNumber: "",
    ownerPassportIssueDate: "",
    ownerPassportIssuedBy: "",
    ownerRegistration: "",
    ownerPercentage: 50,
    minDailyPrice: 9000,
    contractStartDate: new Date().toISOString().split("T")[0],
    contractDuration: "season",
  });

  const currentStepId = STEPS[currentStep].id;

  // Open the flow
  const openFlow = () => setIsOpen(true);

  // Navigate steps
  const nextStep = useCallback(() => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  // Close flow
  const closeFlow = () => {
    setIsOpen(false);
    setCurrentStep(0);
    onClose?.();
  };

  // Submit form
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/franchize/subrent/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crewId: crew.id,
          crewSlug,
          ...formData,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ошибка отправки формы");
      }

      toast.success("Заявка отправлена! Оператор свяжется с вами для подтверждения договора.");
      closeFlow();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Произошла ошибка");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If closed, show trigger button
  if (!isOpen) {
    return (
      <section className="rounded-3xl border p-6 md:p-8" style={{
        backgroundColor: withAlpha(theme.palette.accentMain, 0.08),
        borderColor: withAlpha(theme.palette.accentMain, 0.3),
      }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg" style={{
                backgroundColor: withAlpha(theme.palette.accentMain, 0.2),
              }}>
                <Bike className="w-6 h-6" style={{ color: theme.palette.accentMain }} />
              </div>
              <h2 className="text-2xl font-bold">Хотите сдать свой мотоцикл в парк?</h2>
            </div>
            <p className="text-base opacity-80 max-w-2xl mb-4">
              Станьте собственником мотоцикла в парке {crew.name} — получайте процент от каждого проката
              без операционной головной боли. Заполните форму за 5 минут.
            </p>
            <div className="flex flex-wrap gap-2 text-sm opacity-70">
              <span className="flex items-center gap-1">✓ Юридически оформленный договор</span>
              <span className="flex items-center gap-1">✓ Прозрачный доход</span>
              <span className="flex items-center gap-1">✓ Без лишних хлопот</span>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={openFlow}
            className="px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: theme.palette.accentMain,
              color: accentText,
            }}
          >
            Начать оформление
          </button>
          <button
            onClick={() => {
              const telegram = crew.name.toLowerCase().includes("vip") ? "vipbikerental" : "";
              if (telegram) {
                window.open(`https://t.me/${telegram}`, "_blank");
              }
            }}
            className="px-6 py-3 rounded-xl font-semibold border transition-all"
            style={{
              borderColor: theme.palette.borderSoft,
              color: theme.palette.textPrimary,
            }}
          >
            Узнать больше в Telegram
          </button>
        </div>
      </section>
    );
  }

  // Flow UI
  return (
    <section className="rounded-3xl border p-6 md:p-8" style={{
      backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
      borderColor: theme.palette.borderSoft,
    }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{
            backgroundColor: withAlpha(theme.palette.accentMain, 0.2),
          }}>
            <Bike className="w-6 h-6" style={{ color: theme.palette.accentMain }} />
          </div>
          <h2 className="text-2xl font-bold">Оформление субаренды</h2>
        </div>
        <button
          onClick={closeFlow}
          className="p-2 rounded-lg transition-all hover:scale-110"
          style={{ color: theme.palette.textSecondary }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const isClickable = index < currentStep || (index === currentStep + 1 && canProgressToStep(formData, step.id));

            return (
              <div key={step.id} className="flex items-center">
                <button
                  onClick={() => isClickable && setCurrentStep(index)}
                  disabled={!isClickable}
                  className="flex flex-col items-center gap-2 transition-all disabled:opacity-40"
                  style={isActive ? { color: theme.palette.accentMain } : {}}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted ? "bg-current" : ""
                  }`} style={{
                    borderColor: isActive ? theme.palette.accentMain : theme.palette.borderSoft,
                  }}>
                    {isCompleted ? (
                      <Check className="w-5 h-5" style={{ color: accentText }} />
                    ) : (
                      <StepIcon className="w-5 h-5" style={{ color: isActive ? theme.palette.accentMain : theme.palette.textSecondary }} />
                    )}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{step.title}</span>
                </button>
                {index < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${index < currentStep ? "bg-current" : ""}`} style={{
                    backgroundColor: index < currentStep ? theme.palette.accentMain : theme.palette.borderSoft,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStepId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {currentStepId === "bike" && (
            <BikeSelectionStep
              bikes={bikes}
              selectedBikeId={formData.bikeId}
              onSelect={(bikeId) => setFormData({ ...formData, bikeId })}
              formData={formData}
              onChange={setFormData}
              theme={theme}
              accentText={accentText}
            />
          )}

          {currentStepId === "owner" && (
            <OwnerInfoStep
              formData={formData}
              onChange={setFormData}
              theme={theme}
            />
          )}

          {currentStepId === "payment" && (
            <PaymentTermsStep
              formData={formData}
              onChange={setFormData}
              theme={theme}
              accentText={accentText}
            />
          )}

          {currentStepId === "dates" && (
            <ContractDatesStep
              formData={formData}
              onChange={setFormData}
              theme={theme}
            />
          )}

          {currentStepId === "confirm" && (
            <ConfirmStep
              formData={formData}
              bikes={bikes}
              crew={crew}
              theme={theme}
              accentText={accentText}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: theme.palette.borderSoft }}>
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: currentStep === 0 ? "transparent" : withAlpha(theme.palette.bgBase, 0.5),
            color: theme.palette.textPrimary,
          }}
        >
          <ChevronLeft className="w-4 h-4" />
          Назад
        </button>

        {currentStep === STEPS.length - 1 ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid(formData)}
            className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
            style={{
              backgroundColor: isSubmitting ? theme.palette.textSecondary : theme.palette.accentMain,
              color: accentText,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Отправить заявку
              </>
            )}
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={!canProgressToStep(formData, STEPS[currentStep + 1].id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: canProgressToStep(formData, STEPS[currentStep + 1].id)
                ? theme.palette.accentMain
                : withAlpha(theme.palette.borderSoft, 0.5),
              color: canProgressToStep(formData, STEPS[currentStep + 1].id)
                ? accentText
                : theme.palette.textSecondary,
            }}
          >
            Далее
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function canProgressToStep(formData: SubrentFormData, nextStepId: string): boolean {
  switch (nextStepId) {
    case "owner":
      return !!formData.bikeId &&
             !!formData.bikePlate &&
             !!formData.bikeVin &&
             !!formData.bikeYear &&
             !!formData.bikeValue;
    case "payment":
      return !!formData.ownerFullName &&
             !!formData.ownerPhone &&
             !!formData.ownerBirthDate &&
             !!formData.ownerPassportSeries &&
             !!formData.ownerPassportNumber;
    case "dates":
      return formData.ownerPercentage > 0 && formData.minDailyPrice > 0;
    case "confirm":
      return !!formData.contractStartDate && formData.contractDuration;
    default:
      return true;
  }
}

function isFormValid(formData: SubrentFormData): boolean {
  return !!formData.bikeId &&
         !!formData.bikePlate &&
         !!formData.bikeVin &&
         !!formData.bikeYear &&
         !!formData.bikeValue &&
         !!formData.ownerFullName &&
         !!formData.ownerPhone &&
         !!formData.ownerBirthDate &&
         !!formData.ownerPassportSeries &&
         !!formData.ownerPassportNumber &&
         !!formData.ownerPassportIssueDate &&
         !!formData.ownerPassportIssuedBy &&
         !!formData.ownerRegistration &&
         formData.ownerPercentage > 0 &&
         formData.minDailyPrice > 0 &&
         !!formData.contractStartDate;
}

// ─── Step Components ─────────────────────────────────────────────────────────────

function BikeSelectionStep({
  bikes,
  selectedBikeId,
  onSelect,
  formData,
  onChange,
  theme,
  accentText,
}: {
  bikes: CatalogItemVM[];
  selectedBikeId?: string;
  onSelect: (bikeId: string) => void;
  formData: SubrentFormData;
  onChange: (data: SubrentFormData) => void;
  theme: FranchizeTheme;
  accentText: string;
}) {
  const updateField = (field: keyof SubrentFormData, value: string) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Выберите мотоцикл</h3>
        <p className="text-sm opacity-70">
          Выберите мотоцикл из каталога, который хотите передать в субаренду
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {bikes.slice(0, 12).map((bike) => (
          <button
            key={bike.id}
            onClick={() => onSelect(bike.id)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              selectedBikeId === bike.id ? "border-current" : ""
            }`}
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: selectedBikeId === bike.id ? theme.palette.accentMain : theme.palette.borderSoft,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h4 className="font-semibold truncate">{bike.title}</h4>
                {bike.subtitle && (
                  <p className="text-sm opacity-60 truncate">{bike.subtitle}</p>
                )}
                {bike.pricePerDay && (
                  <p className="text-sm mt-1" style={{ color: theme.palette.accentMain }}>
                    {bike.pricePerDay.toLocaleString("ru-RU")} ₽/день
                  </p>
                )}
              </div>
              {selectedBikeId === bike.id && (
                <Check className="w-5 h-5 shrink-0" style={{ color: theme.palette.accentMain }} />
              )}
            </div>
          </button>
        ))}
      </div>

      {bikes.length === 0 && (
        <div className="text-center p-8 rounded-xl border border-dashed" style={{ borderColor: theme.palette.borderSoft }}>
          <Bike className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm opacity-60">В каталоге пока нет мотоциклов</p>
        </div>
      )}

      {/* Bike details for contract */}
      {selectedBikeId && (
        <div className="p-4 rounded-xl border" style={{
          backgroundColor: withAlpha(theme.palette.accentMain, 0.08),
          borderColor: withAlpha(theme.palette.accentMain, 0.3),
        }}>
          <h4 className="font-semibold mb-4" style={{ color: theme.palette.accentMain }}>Данные мотоцикла для договора</h4>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-2">Гос. номер *</label>
              <input
                type="text"
                value={formData.bikePlate}
                onChange={(e) => updateField("bikePlate", e.target.value)}
                placeholder="А123БВ777"
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 uppercase"
                style={{
                  backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
                  borderColor: theme.palette.borderSoft,
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">VIN *</label>
              <input
                type="text"
                value={formData.bikeVin}
                onChange={(e) => updateField("bikeVin", e.target.value)}
                placeholder="XXXXXXXXXXXXXXXXX"
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 uppercase"
                style={{
                  backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
                  borderColor: theme.palette.borderSoft,
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Год выпуска *</label>
              <input
                type="text"
                value={formData.bikeYear}
                onChange={(e) => updateField("bikeYear", e.target.value)}
                placeholder="2023"
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
                  borderColor: theme.palette.borderSoft,
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Стоимость (₽) *</label>
              <input
                type="number"
                value={formData.bikeValue}
                onChange={(e) => updateField("bikeValue", e.target.value)}
                placeholder="500000"
                className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
                  borderColor: theme.palette.borderSoft,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OwnerInfoStep({
  formData,
  onChange,
  theme,
}: {
  formData: SubrentFormData;
  onChange: (data: SubrentFormData) => void;
  theme: FranchizeTheme;
}) {
  const updateField = (field: keyof SubrentFormData, value: string) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Данные собственника</h3>
        <p className="text-sm opacity-70">
          Заполните информацию о владельце мотоцикла
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Full name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">ФИО полностью *</label>
          <input
            type="text"
            value={formData.ownerFullName}
            onChange={(e) => updateField("ownerFullName", e.target.value)}
            placeholder="Иванов Иван Иванович"
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium mb-2">Телефон *</label>
          <input
            type="tel"
            value={formData.ownerPhone}
            onChange={(e) => updateField("ownerPhone", e.target.value)}
            placeholder="+7 (999) 123-45-67"
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium mb-2">Email</label>
          <input
            type="email"
            value={formData.ownerEmail}
            onChange={(e) => updateField("ownerEmail", e.target.value)}
            placeholder="example@mail.ru"
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>

        {/* Birth date */}
        <div>
          <label className="block text-sm font-medium mb-2">Дата рождения *</label>
          <input
            type="date"
            value={formData.ownerBirthDate}
            onChange={(e) => updateField("ownerBirthDate", e.target.value)}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>

        {/* Passport series */}
        <div>
          <label className="block text-sm font-medium mb-2">Серия паспорта *</label>
          <input
            type="text"
            value={formData.ownerPassportSeries}
            onChange={(e) => updateField("ownerPassportSeries", e.target.value)}
            placeholder="4509"
            maxLength={4}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>

        {/* Passport number */}
        <div>
          <label className="block text-sm font-medium mb-2">Номер паспорта *</label>
          <input
            type="text"
            value={formData.ownerPassportNumber}
            onChange={(e) => updateField("ownerPassportNumber", e.target.value)}
            placeholder="123456"
            maxLength={6}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>

        {/* Passport issue date */}
        <div>
          <label className="block text-sm font-medium mb-2">Дата выдачи паспорта *</label>
          <input
            type="date"
            value={formData.ownerPassportIssueDate}
            onChange={(e) => updateField("ownerPassportIssueDate", e.target.value)}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>

        {/* Passport issued by */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Кем выдан паспорт *</label>
          <input
            type="text"
            value={formData.ownerPassportIssuedBy}
            onChange={(e) => updateField("ownerPassportIssuedBy", e.target.value)}
            placeholder="ОМВД по Нижегородской области"
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>

        {/* Registration address */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-2">Адрес регистрации *</label>
          <textarea
            value={formData.ownerRegistration}
            onChange={(e) => updateField("ownerRegistration", e.target.value)}
            placeholder="г. Нижний Новгород, ул. Примерная, д. 1, кв. 1"
            rows={2}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 resize-none"
            style={{
              backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
              borderColor: theme.palette.borderSoft,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function PaymentTermsStep({
  formData,
  onChange,
  theme,
  accentText,
}: {
  formData: SubrentFormData;
  onChange: (data: SubrentFormData) => void;
  theme: FranchizeTheme;
  accentText: string;
}) {
  const updateField = (field: keyof SubrentFormData, value: number) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Условия сотрудничества</h3>
        <p className="text-sm opacity-70">
          Настройте процент от дохода и минимальную стоимость аренды
        </p>
      </div>

      {/* Percentage selection */}
      <div>
        <label className="block text-sm font-medium mb-3">
          Ваш процент от каждой аренды: <span className="font-bold" style={{ color: theme.palette.accentMain }}>{formData.ownerPercentage}%</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PERCENTAGE_OPTIONS.map((pct) => (
            <button
              key={pct}
              onClick={() => updateField("ownerPercentage", pct)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                formData.ownerPercentage === pct ? "ring-2" : ""
              }`}
              style={{
                backgroundColor: formData.ownerPercentage === pct
                  ? theme.palette.accentMain
                  : withAlpha(theme.palette.bgCard, 0.5),
                color: formData.ownerPercentage === pct ? accentText : theme.palette.textPrimary,
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
        <p className="text-xs mt-2 opacity-60">
          Большой процент = больше дохода с проката, но возможно меньше заказов из-за высокой цены
        </p>
      </div>

      {/* Minimum daily price */}
      <div>
        <label className="block text-sm font-medium mb-3">
          Минимальная суточная стоимость аренды (₽)
        </label>
        <div className="flex flex-wrap gap-2">
          {[6000, 8000, 9000, 10000, 12000, 15000].map((price) => (
            <button
              key={price}
              onClick={() => updateField("minDailyPrice", price)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                formData.minDailyPrice === price ? "ring-2" : ""
              }`}
              style={{
                backgroundColor: formData.minDailyPrice === price
                  ? theme.palette.accentMain
                  : withAlpha(theme.palette.bgCard, 0.5),
                color: formData.minDailyPrice === price ? accentText : theme.palette.textPrimary,
              }}
            >
              {price.toLocaleString("ru-RU")}
            </button>
          ))}
        </div>
        <p className="text-xs mt-2 opacity-60">
          Эта цена будет использоваться как минимум при расчёте вашего дохода
        </p>
      </div>

      {/* Example calculation */}
      <div className="p-4 rounded-xl border" style={{
        backgroundColor: withAlpha(theme.palette.accentMain, 0.1),
        borderColor: withAlpha(theme.palette.accentMain, 0.3),
      }}>
        <h4 className="font-semibold mb-2" style={{ color: theme.palette.accentMain }}>
          Пример расчёта
        </h4>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="opacity-70">Стоимость проката:</span>
            <span>{formData.minDailyPrice.toLocaleString("ru-RU")} ₽/день</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Ваш процент:</span>
            <span>{formData.ownerPercentage}%</span>
          </div>
          <div className="flex justify-between font-bold pt-1 border-t" style={{ borderColor: theme.palette.borderSoft }}>
            <span>Ваш доход:</span>
            <span style={{ color: theme.palette.accentMain }}>
              {Math.round(formData.minDailyPrice * formData.ownerPercentage / 100).toLocaleString("ru-RU")} ₽/день
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContractDatesStep({
  formData,
  onChange,
  theme,
}: {
  formData: SubrentFormData;
  onChange: (data: SubrentFormData) => void;
  theme: FranchizeTheme;
}) {
  const updateField = (field: keyof SubrentFormData, value: string) => {
    onChange({ ...formData, [field]: value });
  };

  const calculateEndDate = (): string => {
    const start = new Date(formData.contractStartDate);
    let end = new Date(start);

    switch (formData.contractDuration) {
      case "season":
        end = new Date(start.getFullYear(), 10, 22); // Nov 22
        if (start > end) end.setFullYear(end.getFullYear() + 1);
        break;
      case "3m":
        end.setMonth(start.getMonth() + 3);
        break;
      case "6m":
        end.setMonth(start.getMonth() + 6);
        break;
      case "1y":
        end.setFullYear(start.getFullYear() + 1);
        break;
    }

    return end.toLocaleDateString("ru-RU");
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Срок договора</h3>
        <p className="text-sm opacity-70">
          Выберите дату начала и длительность договора субаренды
        </p>
      </div>

      {/* Start date */}
      <div>
        <label className="block text-sm font-medium mb-3">Дата начала договора *</label>
        <input
          type="date"
          value={formData.contractStartDate}
          onChange={(e) => updateField("contractStartDate", e.target.value)}
          min={new Date().toISOString().split("T")[0]}
          className="px-4 py-3 rounded-lg border focus:outline-none focus:ring-2"
          style={{
            backgroundColor: withAlpha(theme.palette.bgCard, 0.5),
            borderColor: theme.palette.borderSoft,
          }}
        />
      </div>

      {/* Duration selection */}
      <div>
        <label className="block text-sm font-medium mb-3">Длительность договора</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => updateField("contractDuration", option.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                formData.contractDuration === option.value ? "border-current" : ""
              }`}
              style={{
                backgroundColor: formData.contractDuration === option.value
                  ? withAlpha(theme.palette.accentMain, 0.15)
                  : withAlpha(theme.palette.bgCard, 0.5),
                borderColor: formData.contractDuration === option.value
                  ? theme.palette.accentMain
                  : theme.palette.borderSoft,
              }}
            >
              <div className="font-semibold">{option.label}</div>
              <div className="text-sm opacity-60">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* End date preview */}
      <div className="p-4 rounded-xl border" style={{
        backgroundColor: withAlpha(theme.palette.bgCard, 0.3),
        borderColor: theme.palette.borderSoft,
      }}>
        <div className="flex items-center gap-2 text-sm opacity-70">
          <Calendar className="w-4 h-4" />
          <span>Договор закончится:</span>
        </div>
        <div className="text-lg font-semibold mt-1" style={{ color: theme.palette.accentMain }}>
          {calculateEndDate()}
        </div>
      </div>
    </div>
  );
}

function ConfirmStep({
  formData,
  bikes,
  crew,
  theme,
  accentText,
}: {
  formData: SubrentFormData;
  bikes: CatalogItemVM[];
  crew: { id: string; name: string };
  theme: FranchizeTheme;
  accentText: string;
}) {
  const selectedBike = bikes.find((b) => b.id === formData.bikeId);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold mb-2">Проверьте данные</h3>
        <p className="text-sm opacity-70">
          Убедитесь, что вся информация верна перед отправкой заявки
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Bike info */}
        <div className="p-4 rounded-xl border" style={{
          backgroundColor: withAlpha(theme.palette.bgCard, 0.3),
          borderColor: theme.palette.borderSoft,
        }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: theme.palette.accentMain }}>
            <Bike className="w-5 h-5" />
            <span className="font-semibold">Мотоцикл</span>
          </div>
          <div className="text-lg font-bold">{selectedBike?.title || "Не выбран"}</div>
          {selectedBike?.subtitle && (
            <div className="text-sm opacity-60">{selectedBike.subtitle}</div>
          )}
          <div className="mt-2 pt-2 border-t space-y-1" style={{ borderColor: theme.palette.borderSoft }}>
            <div className="flex justify-between text-sm">
              <span className="opacity-60">Гос. номер:</span>
              <span className="font-medium">{formData.bikePlate || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-60">VIN:</span>
              <span className="font-medium">{formData.bikeVin || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-60">Год:</span>
              <span className="font-medium">{formData.bikeYear || "—"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="opacity-60">Стоимость:</span>
              <span className="font-medium">{formData.bikeValue ? Number(formData.bikeValue).toLocaleString("ru-RU") + " ₽" : "—"}</span>
            </div>
          </div>
        </div>

        {/* Owner info */}
        <div className="p-4 rounded-xl border" style={{
          backgroundColor: withAlpha(theme.palette.bgCard, 0.3),
          borderColor: theme.palette.borderSoft,
        }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: theme.palette.accentMain }}>
            <User className="w-5 h-5" />
            <span className="font-semibold">Собственник</span>
          </div>
          <div className="text-lg font-bold">{formData.ownerFullName}</div>
          <div className="text-sm opacity-60">{formData.ownerPhone}</div>
        </div>

        {/* Payment terms */}
        <div className="p-4 rounded-xl border" style={{
          backgroundColor: withAlpha(theme.palette.bgCard, 0.3),
          borderColor: theme.palette.borderSoft,
        }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: theme.palette.accentMain }}>
            <CreditCard className="w-5 h-5" />
            <span className="font-semibold">Условия</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="opacity-60">Ваш процент:</span>
              <span className="font-semibold">{formData.ownerPercentage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">Мин. цена:</span>
              <span className="font-semibold">{formData.minDailyPrice.toLocaleString("ru-RU")} ₽</span>
            </div>
          </div>
        </div>

        {/* Contract terms */}
        <div className="p-4 rounded-xl border" style={{
          backgroundColor: withAlpha(theme.palette.bgCard, 0.3),
          borderColor: theme.palette.borderSoft,
        }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: theme.palette.accentMain }}>
            <Calendar className="w-5 h-5" />
            <span className="font-semibold">Срок договора</span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="opacity-60">Начало:</span>
              <span className="font-semibold">{new Date(formData.contractStartDate).toLocaleDateString("ru-RU")}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">Длительность:</span>
              <span className="font-semibold">
                {formData.contractDuration === "season" ? "До 22 ноября" :
                 formData.contractDuration === "3m" ? "3 месяца" :
                 formData.contractDuration === "6m" ? "6 месяцев" : "1 год"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="flex gap-3 p-4 rounded-xl border" style={{
        backgroundColor: withAlpha(theme.palette.accentMain, 0.1),
        borderColor: withAlpha(theme.palette.accentMain, 0.3),
      }}>
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: theme.palette.accentMain }} />
        <div className="text-sm">
          <p className="font-semibold mb-1" style={{ color: theme.palette.accentMain }}>
            После отправки заявки
          </p>
          <p className="opacity-80">
            Оператор экипажа "{crew.name}" свяжется с вами для подтверждения данных,
            подписания договора субаренды и передачи мотоцикла в парк.
          </p>
        </div>
      </div>
    </div>
  );
}
