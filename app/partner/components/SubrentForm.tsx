"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FaMotorcycle, FaUser, FaPassport, FaCalendar, FaMoneyBillWave, FaClock, FaCheckCircle } from "react-icons/fa6";
import { createSubrentContract, getAvailableBikes, type SubrentFormData } from "../actions";

type FormStep = "bike" | "owner" | "payment" | "duration" | "confirm" | "success";

const DEFAULT_PRICES = {
  ownerPercentage: 50,
  minDailyPrice: 9000,
  hourly3h: 6000,
  hourly6h: 7000,
  hourly12h: 8000,
  weekdayPrice: 14000,
  weekendPrice: 16000,
};

export function SubrentForm() {
  const [step, setStep] = useState<FormStep>("bike");
  const [loading, setLoading] = useState(false);
  const [contractNumber, setContractNumber] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<SubrentFormData>({
    // Owner details
    ownerFullName: "",
    ownerBirthDate: "",
    ownerPassportSeries: "",
    ownerPassportNumber: "",
    ownerPassportIssuedBy: "",
    ownerPassportIssueDate: "",
    ownerRegistration: "",
    ownerPhone: "",
    ownerEmail: "",

    // Bike details
    bikeMake: "",
    bikeModel: "",
    bikeVin: "",
    bikePlate: "",
    bikeYear: "",
    bikeValue: "",
    bikeRegistrationCert: "",
    bikeInsurancePolicy: "",

    // Payment terms
    ownerPercentage: DEFAULT_PRICES.ownerPercentage,
    minDailyPrice: DEFAULT_PRICES.minDailyPrice,
    hourly3hPrice: DEFAULT_PRICES.hourly3h,
    hourly6hPrice: DEFAULT_PRICES.hourly6h,
    hourly12hPrice: DEFAULT_PRICES.hourly12h,
    weekdayPrice: DEFAULT_PRICES.weekdayPrice,
    weekendPrice: DEFAULT_PRICES.weekendPrice,

    // Contract duration
    contractStartDate: getDefaultStartDate(),
    contractStartTime: "10:00",
    contractDuration: "6m",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function getDefaultStartDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${String(tomorrow.getDate()).padStart(2, '0')}.${String(tomorrow.getMonth() + 1).padStart(2, '0')}.${tomorrow.getFullYear()}`;
  }

  const updateField = (field: keyof SubrentFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateBikeStep = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.bikeMake?.trim()) newErrors.bikeMake = "Укажите марку мотоцикла";
    if (!formData.bikeModel?.trim()) newErrors.bikeModel = "Укажите модель мотоцикла";
    if (!formData.bikeValue?.trim()) newErrors.bikeValue = "Укажите стоимость мотоцикла";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOwnerStep = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.ownerFullName?.trim()) newErrors.ownerFullName = "Укажите ФИО собственника";
    if (!formData.ownerBirthDate?.trim()) newErrors.ownerBirthDate = "Укажите дату рождения";
    if (!formData.ownerPassportSeries?.trim()) newErrors.ownerPassportSeries = "Укажите серию паспорта";
    if (!formData.ownerPassportNumber?.trim()) newErrors.ownerPassportNumber = "Укажите номер паспорта";
    if (!formData.ownerPassportIssuedBy?.trim()) newErrors.ownerPassportIssuedBy = "Укажите кем выдан паспорт";
    if (!formData.ownerPassportIssueDate?.trim()) newErrors.ownerPassportIssueDate = "Укажите дату выдачи паспорта";
    if (!formData.ownerRegistration?.trim()) newErrors.ownerRegistration = "Укажите адрес регистрации";
    if (!formData.ownerPhone?.trim()) newErrors.ownerPhone = "Укажите телефон";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePaymentStep = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.ownerPercentage || formData.ownerPercentage < 1 || formData.ownerPercentage > 99) {
      newErrors.ownerPercentage = "Процент должен быть от 1 до 99";
    }
    if (!formData.minDailyPrice || formData.minDailyPrice < 1000) {
      newErrors.minDailyPrice = "Минимальная цена должна быть от 1000 ₽";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Get user ID from context or session
      const userId = "web_user"; // TODO: Get real user ID from auth

      const result = await createSubrentContract(formData, userId);

      if (result.success) {
        setContractNumber(result.contractNumber);
        setStep("success");
        toast.success("Договор субаренды успешно создан!");
      } else {
        toast.error(result.error || "Ошибка при создании договора");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error("Произошла ошибка. Попробуйте позже.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    let isValid = true;
    if (step === "bike") isValid = validateBikeStep();
    else if (step === "owner") isValid = validateOwnerStep();
    else if (step === "payment") isValid = validatePaymentStep();

    if (isValid) {
      if (step === "bike") setStep("owner");
      else if (step === "owner") setStep("payment");
      else if (step === "payment") setStep("duration");
      else if (step === "duration") setStep("confirm");
    }
  };

  const prevStep = () => {
    if (step === "owner") setStep("bike");
    else if (step === "payment") setStep("owner");
    else if (step === "duration") setStep("payment");
    else if (step === "confirm") setStep("duration");
  };

  const renderBikeStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <FaMotorcycle className="text-3xl text-brand-blue" />
        <h3 className="text-xl font-orbitron text-brand-blue">Мотоцикл</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Марка *</label>
          <Input
            value={formData.bikeMake}
            onChange={e => updateField("bikeMake", e.target.value)}
            placeholder="Yamaha"
            className={errors.bikeMake ? "border-red-500" : ""}
          />
          {errors.bikeMake && <p className="text-xs text-red-500">{errors.bikeMake}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Модель *</label>
          <Input
            value={formData.bikeModel}
            onChange={e => updateField("bikeModel", e.target.value)}
            placeholder="MT-07"
            className={errors.bikeModel ? "border-red-500" : ""}
          />
          {errors.bikeModel && <p className="text-xs text-red-500">{errors.bikeModel}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">VIN</label>
          <Input
            value={formData.bikeVin}
            onChange={e => updateField("bikeVin", e.target.value)}
            placeholder="YM3..."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Гос. номер</label>
          <Input
            value={formData.bikePlate}
            onChange={e => updateField("bikePlate", e.target.value)}
            placeholder="А123БВ777"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Год</label>
          <Input
            value={formData.bikeYear}
            onChange={e => updateField("bikeYear", e.target.value)}
            placeholder="2023"
            type="number"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Стоимость (₽) *</label>
          <Input
            value={formData.bikeValue}
            onChange={e => updateField("bikeValue", e.target.value)}
            placeholder="900000"
            type="number"
            className={errors.bikeValue ? "border-red-500" : ""}
          />
          {errors.bikeValue && <p className="text-xs text-red-500">{errors.bikeValue}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">СТС</label>
          <Input
            value={formData.bikeRegistrationCert}
            onChange={e => updateField("bikeRegistrationCert", e.target.value)}
            placeholder="Номер СТС"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Страховка</label>
          <Input
            value={formData.bikeInsurancePolicy}
            onChange={e => updateField("bikeInsurancePolicy", e.target.value)}
            placeholder="Номер полиса"
          />
        </div>
      </div>
    </div>
  );

  const renderOwnerStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <FaUser className="text-3xl text-brand-green" />
        <h3 className="text-xl font-orbitron text-brand-green">Собственник</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-mono text-muted-foreground">ФИО (полностью) *</label>
          <Input
            value={formData.ownerFullName}
            onChange={e => updateField("ownerFullName", e.target.value)}
            placeholder="Иванов Иван Иванович"
            className={errors.ownerFullName ? "border-red-500" : ""}
          />
          {errors.ownerFullName && <p className="text-xs text-red-500">{errors.ownerFullName}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Дата рождения *</label>
          <Input
            value={formData.ownerBirthDate}
            onChange={e => updateField("ownerBirthDate", e.target.value)}
            placeholder="ДД.ММ.ГГГГ"
            className={errors.ownerBirthDate ? "border-red-500" : ""}
          />
          {errors.ownerBirthDate && <p className="text-xs text-red-500">{errors.ownerBirthDate}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Телефон *</label>
          <Input
            value={formData.ownerPhone}
            onChange={e => updateField("ownerPhone", e.target.value)}
            placeholder="+7 (999) 123-45-67"
            className={errors.ownerPhone ? "border-red-500" : ""}
          />
          {errors.ownerPhone && <p className="text-xs text-red-500">{errors.ownerPhone}</p>}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-mono text-muted-foreground">Email (опционально)</label>
          <Input
            value={formData.ownerEmail}
            onChange={e => updateField("ownerEmail", e.target.value)}
            placeholder="email@example.com"
            type="email"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Серия паспорта *</label>
          <Input
            value={formData.ownerPassportSeries}
            onChange={e => updateField("ownerPassportSeries", e.target.value)}
            placeholder="4509"
            className={errors.ownerPassportSeries ? "border-red-500" : ""}
          />
          {errors.ownerPassportSeries && <p className="text-xs text-red-500">{errors.ownerPassportSeries}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Номер паспорта *</label>
          <Input
            value={formData.ownerPassportNumber}
            onChange={e => updateField("ownerPassportNumber", e.target.value)}
            placeholder="123456"
            className={errors.ownerPassportNumber ? "border-red-500" : ""}
          />
          {errors.ownerPassportNumber && <p className="text-xs text-red-500">{errors.ownerPassportNumber}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Дата выдачи *</label>
          <Input
            value={formData.ownerPassportIssueDate}
            onChange={e => updateField("ownerPassportIssueDate", e.target.value)}
            placeholder="ДД.ММ.ГГГГ"
            className={errors.ownerPassportIssueDate ? "border-red-500" : ""}
          />
          {errors.ownerPassportIssueDate && <p className="text-xs text-red-500">{errors.ownerPassportIssueDate}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Кем выдан *</label>
          <Input
            value={formData.ownerPassportIssuedBy}
            onChange={e => updateField("ownerPassportIssuedBy", e.target.value)}
            placeholder="ОМВД по р.п. ..."
            className={errors.ownerPassportIssuedBy ? "border-red-500" : ""}
          />
          {errors.ownerPassportIssuedBy && <p className="text-xs text-red-500">{errors.ownerPassportIssuedBy}</p>}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-mono text-muted-foreground">Адрес регистрации *</label>
          <Input
            value={formData.ownerRegistration}
            onChange={e => updateField("ownerRegistration", e.target.value)}
            placeholder="г. Нижний Новгород, ул. ..."
            className={errors.ownerRegistration ? "border-red-500" : ""}
          />
          {errors.ownerRegistration && <p className="text-xs text-red-500">{errors.ownerRegistration}</p>}
        </div>
      </div>
    </div>
  );

  const renderPaymentStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <FaMoneyBillWave className="text-3xl text-brand-yellow" />
        <h3 className="text-xl font-orbitron text-brand-yellow">Условия оплаты</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">
            Процент собственника (% от выручки) *
          </label>
          <Input
            value={formData.ownerPercentage}
            onChange={e => updateField("ownerPercentage", parseInt(e.target.value) || 0)}
            type="number"
            min={1}
            max={99}
            className={errors.ownerPercentage ? "border-red-500" : ""}
          />
          {errors.ownerPercentage && <p className="text-xs text-red-500">{errors.ownerPercentage}</p>}
          <p className="text-xs text-muted-foreground">Рекомендуется: 50%</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">
            Мин. суточная цена (₽) *
          </label>
          <Input
            value={formData.minDailyPrice}
            onChange={e => updateField("minDailyPrice", parseInt(e.target.value) || 0)}
            type="number"
            min={1000}
            className={errors.minDailyPrice ? "border-red-500" : ""}
          />
          {errors.minDailyPrice && <p className="text-xs text-red-500">{errors.minDailyPrice}</p>}
          <p className="text-xs text-muted-foreground">Рекомендуется: 9000 ₽</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Почасово 3ч (₽)</label>
          <Input
            value={formData.hourly3hPrice}
            onChange={e => updateField("hourly3hPrice", parseInt(e.target.value) || 0)}
            type="number"
            placeholder="6000"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Почасово 6ч (₽)</label>
          <Input
            value={formData.hourly6hPrice}
            onChange={e => updateField("hourly6hPrice", parseInt(e.target.value) || 0)}
            type="number"
            placeholder="7000"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Почасово 12ч (₽)</label>
          <Input
            value={formData.hourly12hPrice}
            onChange={e => updateField("hourly12hPrice", parseInt(e.target.value) || 0)}
            type="number"
            placeholder="8000"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Сезон: будни (₽)</label>
          <Input
            value={formData.weekdayPrice}
            onChange={e => updateField("weekdayPrice", parseInt(e.target.value) || 0)}
            type="number"
            placeholder="14000"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Сезон: выходные (₽)</label>
          <Input
            value={formData.weekendPrice}
            onChange={e => updateField("weekendPrice", parseInt(e.target.value) || 0)}
            type="number"
            placeholder="16000"
          />
        </div>
      </div>

      <div className="bg-muted/30 p-4 rounded-lg border border-border">
        <p className="text-sm text-muted-foreground font-mono">
          💡 Парк берёт на себя поиск клиентов, проведение аренды, техобслуживание.
          Собственник получает {formData.ownerPercentage}% от каждой успешной аренды.
        </p>
      </div>
    </div>
  );

  const renderDurationStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <FaCalendar className="text-3xl text-brand-pink" />
        <h3 className="text-xl font-orbitron text-brand-pink">Период действия</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Дата начала *</label>
          <Input
            value={formData.contractStartDate}
            onChange={e => updateField("contractStartDate", e.target.value)}
            placeholder="ДД.ММ.ГГГГ"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-mono text-muted-foreground">Время начала *</label>
          <Input
            value={formData.contractStartTime}
            onChange={e => updateField("contractStartTime", e.target.value)}
            type="time"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-mono text-muted-foreground">Длительность договора</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: "3m", label: "3 месяца" },
              { value: "6m", label: "6 месяцев" },
              { value: "1y", label: "1 год" },
            ].map(option => (
              <Button
                key={option.value}
                type="button"
                variant={formData.contractDuration === option.value ? "default" : "outline"}
                onClick={() => updateField("contractDuration", option.value as any)}
                className={
                  formData.contractDuration === option.value
                    ? "bg-brand-pink text-white"
                    : "border-border hover:bg-muted/50"
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <FaCheckCircle className="text-3xl text-brand-green" />
        <h3 className="text-xl font-orbitron text-brand-green">Подтверждение</h3>
      </div>

      <Card className="bg-muted/40 border border-border">
        <CardContent className="p-4 space-y-3">
          <div>
            <p className="text-xs font-mono text-muted-foreground">🏍 Мотоцикл</p>
            <p className="font-mono">{formData.bikeMake} {formData.bikeModel}</p>
            {formData.bikeVin && <p className="text-xs text-muted-foreground">VIN: {formData.bikeVin}</p>}
            {formData.bikePlate && <p className="text-xs text-muted-foreground">Гос. номер: {formData.bikePlate}</p>}
          </div>

          <div>
            <p className="text-xs font-mono text-muted-foreground">👤 Собственник</p>
            <p className="font-mono">{formData.ownerFullName}</p>
            <p className="text-xs text-muted-foreground">{formData.ownerPhone}</p>
          </div>

          <div>
            <p className="text-xs font-mono text-muted-foreground">💰 Условия</p>
            <p className="font-mono">Процент собственника: {formData.ownerPercentage}%</p>
            <p className="font-mono">Мин. суточная: {formData.minDailyPrice.toLocaleString("ru-RU")} ₽</p>
          </div>

          <div>
            <p className="text-xs font-mono text-muted-foreground">📅 Период</p>
            <p className="font-mono">
              с {formData.contractStartDate} {formData.contractStartTime}
            </p>
            <p className="text-xs text-muted-foreground">
              Длительность: {formData.contractDuration === "3m" ? "3 месяца" : formData.contractDuration === "6m" ? "6 месяцев" : "1 год"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="bg-muted/30 p-4 rounded-lg border border-border">
        <p className="text-sm text-muted-foreground font-mono">
          После подтверждения будет сгенерирован договор субаренды и отправлен вам.
          Документ будет также доступен для скачивания.
        </p>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-4">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="flex justify-center"
      >
        <div className="w-20 h-20 rounded-full bg-brand-green/20 flex items-center justify-center">
          <FaCheckCircle className="text-5xl text-brand-green" />
        </div>
      </motion.div>

      <h3 className="text-2xl font-orbitron text-brand-green">Договор создан!</h3>

      <p className="font-mono text-muted-foreground">
        Договор субаренды №{contractNumber} успешно сформирован.
      </p>

      <div className="bg-muted/30 p-4 rounded-lg border border-border">
        <p className="text-sm font-mono text-muted-foreground">
          📄 Документ будет доступен для скачивания в ближайшее время.
        </p>
        <p className="text-sm font-mono text-muted-foreground mt-2">
          📧 Копия отправлена на указанный email (если указан).
        </p>
      </div>

      <Button
        onClick={() => {
          setStep("bike");
          setContractNumber(null);
          setFormData({
            ownerFullName: "",
            ownerBirthDate: "",
            ownerPassportSeries: "",
            ownerPassportNumber: "",
            ownerPassportIssuedBy: "",
            ownerPassportIssueDate: "",
            ownerRegistration: "",
            ownerPhone: "",
            ownerEmail: "",
            bikeMake: "",
            bikeModel: "",
            bikeVin: "",
            bikePlate: "",
            bikeYear: "",
            bikeValue: "",
            bikeRegistrationCert: "",
            bikeInsurancePolicy: "",
            ownerPercentage: DEFAULT_PRICES.ownerPercentage,
            minDailyPrice: DEFAULT_PRICES.minDailyPrice,
            hourly3hPrice: DEFAULT_PRICES.hourly3h,
            hourly6hPrice: DEFAULT_PRICES.hourly6h,
            hourly12hPrice: DEFAULT_PRICES.hourly12h,
            weekdayPrice: DEFAULT_PRICES.weekdayPrice,
            weekendPrice: DEFAULT_PRICES.weekendPrice,
            contractStartDate: getDefaultStartDate(),
            contractStartTime: "10:00",
            contractDuration: "6m",
          });
        }}
        variant="outline"
        className="border-brand-green text-brand-green hover:bg-brand-green/20"
      >
        Создать ещё один договор
      </Button>
    </div>
  );

  return (
    <Card className="bg-dark-card/90 backdrop-blur-xl border border-brand-blue/50 shadow-2xl">
      <CardHeader className="text-center p-6 border-b border-brand-blue/30">
        <FaMotorcycle className="text-5xl text-brand-blue mx-auto mb-3" />
        <CardTitle className="text-2xl font-orbitron text-brand-blue">
          Субаренда мотоцикла
        </CardTitle>
        <CardDescription className="text-muted-foreground font-mono">
          Передайте свой мотоцикл в аренду парку и получайте доход
        </CardDescription>
      </CardHeader>

      <CardContent className="p-6">
        {/* Progress indicator */}
        {step !== "success" && (
          <div className="flex items-center justify-between mb-6">
            {["bike", "owner", "payment", "duration", "confirm"].map((s, index) => (
              <React.Fragment key={s}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono ${
                    step === s
                      ? "bg-brand-blue text-black"
                      : ["bike", "owner", "payment", "duration", "confirm"].indexOf(step) > index
                      ? "bg-brand-green text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {["bike", "owner", "payment", "duration", "confirm"].indexOf(step) > index ? "✓" : index + 1}
                </div>
                {index < 4 && (
                  <div
                    className={`flex-grow h-0.5 ${
                      ["bike", "owner", "payment", "duration", "confirm"].indexOf(step) > index
                        ? "bg-brand-green"
                        : "bg-muted"
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Step content */}
        {step === "bike" && renderBikeStep()}
        {step === "owner" && renderOwnerStep()}
        {step === "payment" && renderPaymentStep()}
        {step === "duration" && renderDurationStep()}
        {step === "confirm" && renderConfirmStep()}
        {step === "success" && renderSuccessStep()}

        {/* Navigation buttons */}
        {step !== "success" && (
          <div className="flex justify-between mt-6 pt-4 border-t border-border">
            <Button
              onClick={prevStep}
              variant="outline"
              disabled={step === "bike"}
              className="border-border hover:bg-muted/50"
            >
              Назад
            </Button>

            {step === "confirm" ? (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-brand-green text-white hover:bg-brand-green/80"
              >
                {loading ? "Генерация договора..." : "Подтвердить и создать"}
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                className="bg-brand-blue text-black hover:bg-brand-blue/80"
              >
                Далее
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
