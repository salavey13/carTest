"use client";

import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Send,
  CheckCircle2,
  Zap,
  Paperclip,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  generateFileName,
  generateRequestText,
  utf8ToBase64,
  type EstimateRequestData,
} from "./lib/generate-request";

const ADMIN_CHAT_ID = process.env.NEXT_PUBLIC_ADMIN_CHAT_ID || "6266482385";
const FORWARD_TELEGRAM_URL =
  process.env.NEXT_PUBLIC_FORWARD_TELEGRAM_URL ||
  "https://v0-car-test.vercel.app/api/forward-telegram";

const objectTypes = [
  { value: "newbuilding", label: "Новостройка (квартира)" },
  { value: "renovation", label: "Ремонт (квартира/дом)" },
  { value: "cottage", label: "Коттедж/дом" },
  { value: "social", label: "Социальный объект" },
  { value: "commercial", label: "Коммерческое помещение" },
  { value: "production", label: "Производство" },
  { value: "other", label: "Другое" },
];

const wallOptions = [
  { value: "brick", label: "Кирпич" },
  { value: "concrete", label: "Бетон" },
  { value: "gasblock", label: "Газобетон" },
  { value: "drywall", label: "Гипсокартон" },
  { value: "other", label: "Другое" },
];

const workOptions = [
  { value: "full-wiring", label: "Полная замена проводки (под ключ)" },
  { value: "panel-assembly", label: "Сборка электрощита" },
  { value: "sockets-switches", label: "Установка розеток/выключателей" },
  { value: "lighting", label: "Монтаж освещения (точечные, люстры)" },
  { value: "shtroba", label: "Штробление стен" },
  { value: "cable-pipes", label: "Прокладка кабеля в гофре/трубах" },
  { value: "metal-trays", label: "Установка металлических лотков" },
  { value: "low-voltage", label: "Слаботочные системы (СКС, видео, сигнализация)" },
  { value: "high-voltage", label: "Высокое напряжение (до 10 кВ)" },
  { value: "demolition", label: "Демонтаж старой проводки" },
  { value: "other", label: "Другое" },
];

const automationBrands = [
  { value: "ABB", label: "ABB" },
  { value: "Schneider", label: "Schneider" },
  { value: "Legrand", label: "Legrand" },
  { value: "IEK", label: "IEK" },
  { value: "no-preference", label: "Без разницы" },
];

const urgencyOptions = [
  { value: "not-urgent", label: "Не срочно" },
  { value: "within-month", label: "В течение месяца" },
  { value: "urgent", label: "Срочно" },
];

const contactOptions = [
  { value: "telegram", label: "Telegram" },
  { value: "phone", label: "Телефон" },
  { value: "email", label: "Email" },
  { value: "any", label: "Любой способ" },
];

const defaultData: EstimateRequestData = {
  fio: "",
  phone: "",
  telegram: "",
  email: "",
  preferredTime: "",
  objectType: "newbuilding",
  objectTypeOther: "",
  address: "",
  area: "",
  floors: "",
  walls: [],
  wallOther: "",
  workTypes: [],
  workOther: "",
  quantity: {
    sockets: "",
    switches: "",
    lights: "",
    cableMeters: "",
    rooms: "",
  },
  automationBrand: "no-preference",
  extraRequirements: "",
  startDate: "",
  urgency: "not-urgent",
  attachments: [],
  preferredContact: "phone",
  notes: "",
};

function SectionTitle({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="w-7 h-7 rounded-lg bg-volt/10 border border-volt/20 flex items-center justify-center text-volt text-xs font-black">
        {number}
      </span>
      <h3 className="text-white font-bold text-sm sm:text-base tracking-wide">
        {children}
      </h3>
    </div>
  );
}

export default function ZaprosSmetiPage() {
  const [data, setData] = useState<EstimateRequestData>(defaultData);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestText = useMemo(() => generateRequestText(data), [data]);

  const updateField = <K extends keyof EstimateRequestData>(
    field: K,
    value: EstimateRequestData[K]
  ) => setData((prev) => ({ ...prev, [field]: value }));

  const updateQuantity = (key: keyof EstimateRequestData["quantity"], value: string) =>
    setData((prev) => ({
      ...prev,
      quantity: { ...prev.quantity, [key]: value.replace(/\D/g, "") },
    }));

  const toggleArray = (field: "walls" | "workTypes", value: string) => {
    setData((prev) => {
      const list = prev[field];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...prev, [field]: next };
    });
  };

  const handleFiles = (nextFiles: FileList | null) => {
    if (!nextFiles) return;
    const names = Array.from(nextFiles).map((f) => f.name);
    setFiles((prev) => [...prev, ...Array.from(nextFiles)]);
    setData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...names],
    }));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const downloadRequest = () => {
    const blob = new Blob([requestText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generateFileName(data);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sendRequest = async () => {
    setStatus("idle");
    setErrorMsg(null);

    if (!data.fio.trim() || !data.phone.trim()) {
      setStatus("error");
      setErrorMsg("Заполните имя и телефон — без них мы не сможем с вами связаться.");
      return;
    }

    setStatus("sending");

    try {
      const caption = [
        "⚡ <b>Новая заявка на смету — NN VOLT</b>",
        "",
        `👤 <b>Имя:</b> ${data.fio}`,
        `📱 <b>Телефон:</b> ${data.phone}`,
        data.telegram ? `✈️ <b>Telegram:</b> @${data.telegram}` : "",
        data.email ? `📧 <b>Email:</b> ${data.email}` : "",
        "",
        `🏠 <b>Объект:</b> ${objectTypes.find((o) => o.value === data.objectType)?.label}${
          data.objectType === "other" && data.objectTypeOther ? ` (${data.objectTypeOther})` : ""
        }`,
        `📍 <b>Адрес:</b> ${data.address || "не указан"}`,
        "",
        "📎 <b>Заявка во вложении.</b>",
      ]
        .filter(Boolean)
        .join("\n");

      const response = await fetch(FORWARD_TELEGRAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          method: "sendDocument",
          payload: {
            caption,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          },
          files: {
            document: {
              data: utf8ToBase64(requestText),
              filename: generateFileName(data),
              contentType: "text/plain",
            },
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.error || result.telegram?.description || "Ошибка отправки");
      }

      setStatus("success");
      downloadRequest();
    } catch (err) {
      console.error("Failed to send request:", err);
      setStatus("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Не удалось отправить заявку. Попробуйте скачать файл и отправить вручную."
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-32">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a
            href="/nnvolt"
            className="inline-flex items-center gap-2 text-white/50 hover:text-volt transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Назад на сайт</span>
          </a>

          <a href="/nnvolt" className="flex items-center gap-2 group">
            <Zap className="w-6 h-6 text-volt group-hover:text-electric-blue transition-colors" />
            <div className="flex flex-col">
              <span className="text-base font-black tracking-[0.15em] text-white leading-none">
                NN VOLT
              </span>
              <span className="text-[9px] tracking-[0.25em] text-volt font-semibold leading-none mt-0.5">
                ЭЛЕКТРОМОНТАЖ
              </span>
            </div>
          </a>
        </div>
      </header>

      <main className="pt-28 sm:pt-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Intro */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px w-8 bg-volt" />
              <span className="text-volt text-xs font-bold tracking-[0.25em] uppercase">
                Онлайн-форма
              </span>
              <div className="h-px w-8 bg-volt" />
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4">
              Заявка на расчёт сметы
            </h1>
            <p className="text-white/35 max-w-2xl mx-auto">
              Заполните поля ниже, и мы подготовим предварительный расчёт работ. Готовый файл можно
              сразу скачать или отправить бригадиру через Telegram.
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {status === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-2xl mx-auto"
              >
                <Card className="bg-[#111] border-volt/20">
                  <CardContent className="p-8 sm:p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-volt/10 border border-volt/20 flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-8 h-8 text-volt" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-3">Заявка отправлена!</h2>
                    <p className="text-white/40 mb-6">
                      Файл заявки отправлен бригадиру и сохранён на ваше устройство. Мы свяжемся с
                      вами в течение 2 часов.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <Button
                        onClick={downloadRequest}
                        variant="outline"
                        className="border-white/10 text-white hover:text-volt hover:border-volt/30"
                      >
                        <Download className="mr-2 w-4 h-4" />
                        Скачать ещё раз
                      </Button>
                      <a href="/nnvolt">
                        <Button className="bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal">
                          Вернуться на сайт
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <Card className="bg-[#111] border-white/5 overflow-visible">
                  <CardContent className="p-5 sm:p-8 space-y-10">
                    {/* 1. Contact */}
                    <section>
                      <SectionTitle number="1">Контактная информация</SectionTitle>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            ФИО <span className="text-volt">*</span>
                          </Label>
                          <Input
                            value={data.fio}
                            onChange={(e) => updateField("fio", e.target.value)}
                            placeholder="Иванов Иван Иванович"
                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Телефон <span className="text-volt">*</span>
                          </Label>
                          <Input
                            type="tel"
                            value={data.phone}
                            onChange={(e) => updateField("phone", e.target.value)}
                            placeholder="+7 (___) ___-__-__"
                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Telegram
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 text-sm">
                              @
                            </span>
                            <Input
                              value={data.telegram}
                              onChange={(e) =>
                                updateField(
                                  "telegram",
                                  e.target.value.replace(/^@/, "")
                                )
                              }
                              placeholder="username"
                              className="pl-7 bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Email
                          </Label>
                          <Input
                            type="email"
                            value={data.email}
                            onChange={(e) => updateField("email", e.target.value)}
                            placeholder="mail@example.com"
                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Удобное время для связи
                          </Label>
                          <Input
                            value={data.preferredTime}
                            onChange={(e) => updateField("preferredTime", e.target.value)}
                            placeholder="Пн–Пт с 18:00"
                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                          />
                        </div>
                      </div>
                    </section>

                    <Separator className="bg-white/5" />

                    {/* 2. Object */}
                    <section>
                      <SectionTitle number="2">Информация об объекте</SectionTitle>
                      <div className="space-y-5">
                        <RadioGroup
                          value={data.objectType}
                          onValueChange={(v) => updateField("objectType", v)}
                          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                        >
                          {objectTypes.map((opt) => (
                            <Label
                              key={opt.value}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                data.objectType === opt.value
                                  ? "bg-volt/5 border-volt/30 text-white"
                                  : "bg-white/[0.02] border-white/5 text-white/50 hover:border-white/10"
                              }`}
                            >
                              <RadioGroupItem value={opt.value} className="text-volt border-volt/50" />
                              <span className="text-sm">{opt.label}</span>
                            </Label>
                          ))}
                        </RadioGroup>

                        {data.objectType === "other" && (
                          <Input
                            value={data.objectTypeOther}
                            onChange={(e) => updateField("objectTypeOther", e.target.value)}
                            placeholder="Укажите тип объекта"
                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                          />
                        )}

                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Адрес объекта
                          </Label>
                          <Input
                            value={data.address}
                            onChange={(e) => updateField("address", e.target.value)}
                            placeholder="г. Нижний Новгород, ул. ..."
                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                              Общая площадь, м²
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={data.area}
                              onChange={(e) => updateField("area", e.target.value.replace(/\D/g, ""))}
                              placeholder="0"
                              className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                              Этажность
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={data.floors}
                              onChange={(e) =>
                                updateField("floors", e.target.value.replace(/\D/g, ""))
                              }
                              placeholder="0"
                              className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Стены
                          </Label>
                          <div className="flex flex-wrap gap-3">
                            {wallOptions.map((opt) => (
                              <Label
                                key={opt.value}
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer transition-all ${
                                  data.walls.includes(opt.value)
                                    ? "bg-volt/10 border-volt/30 text-white"
                                    : "bg-white/[0.02] border-white/5 text-white/50 hover:border-white/10"
                                }`}
                              >
                                <Checkbox
                                  checked={data.walls.includes(opt.value)}
                                  onCheckedChange={() => toggleArray("walls", opt.value)}
                                  className="border-volt/50 data-[state=checked]:bg-volt data-[state=checked]:text-charcoal"
                                />
                                {opt.label}
                              </Label>
                            ))}
                          </div>
                          {data.walls.includes("other") && (
                            <Input
                              value={data.wallOther}
                              onChange={(e) => updateField("wallOther", e.target.value)}
                              placeholder="Уточните материал стен"
                              className="mt-3 bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                            />
                          )}
                        </div>
                      </div>
                    </section>

                    <Separator className="bg-white/5" />

                    {/* 3. Work types */}
                    <section>
                      <SectionTitle number="3">Виды работ</SectionTitle>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {workOptions.map((opt) => (
                          <Label
                            key={opt.value}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              data.workTypes.includes(opt.value)
                                ? "bg-volt/5 border-volt/30 text-white"
                                : "bg-white/[0.02] border-white/5 text-white/50 hover:border-white/10"
                            }`}
                          >
                            <Checkbox
                              checked={data.workTypes.includes(opt.value)}
                              onCheckedChange={() => toggleArray("workTypes", opt.value)}
                              className="mt-0.5 border-volt/50 data-[state=checked]:bg-volt data-[state=checked]:text-charcoal"
                            />
                            <span className="text-sm leading-snug">{opt.label}</span>
                          </Label>
                        ))}
                      </div>
                      {data.workTypes.includes("other") && (
                        <Textarea
                          value={data.workOther}
                          onChange={(e) => updateField("workOther", e.target.value)}
                          placeholder="Опишите нужные работы"
                          className="mt-4 bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30 min-h-[80px]"
                        />
                      )}
                    </section>

                    <Separator className="bg-white/5" />

                    {/* 4. Volume */}
                    <section>
                      <SectionTitle number="4">Примерный объём работ</SectionTitle>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {[
                          { key: "sockets", label: "Розетки, шт" },
                          { key: "switches", label: "Выключатели, шт" },
                          { key: "lights", label: "Светильники, шт" },
                          { key: "cableMeters", label: "Кабель, м" },
                          { key: "rooms", label: "Комнат/помещений" },
                        ].map((item) => (
                          <div key={item.key}>
                            <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                              {item.label}
                            </Label>
                            <Input
                              type="number"
                              min={0}
                              value={data.quantity[item.key as keyof typeof data.quantity]}
                              onChange={(e) =>
                                updateQuantity(item.key as keyof typeof data.quantity, e.target.value)
                              }
                              placeholder="0"
                              className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30"
                            />
                          </div>
                        ))}
                      </div>
                    </section>

                    <Separator className="bg-white/5" />

                    {/* 5. Preferences */}
                    <section>
                      <SectionTitle number="5">Дополнительные пожелания</SectionTitle>
                      <div className="space-y-5">
                        <RadioGroup
                          value={data.automationBrand}
                          onValueChange={(v) => updateField("automationBrand", v)}
                          className="flex flex-wrap gap-3"
                        >
                          {automationBrands.map((opt) => (
                            <Label
                              key={opt.value}
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                data.automationBrand === opt.value
                                  ? "bg-volt/10 border-volt/30 text-white"
                                  : "bg-white/[0.02] border-white/5 text-white/50 hover:border-white/10"
                              }`}
                            >
                              <RadioGroupItem value={opt.value} className="text-volt border-volt/50" />
                              <span className="text-sm">{opt.label}</span>
                            </Label>
                          ))}
                        </RadioGroup>

                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Дополнительные требования
                          </Label>
                          <Textarea
                            value={data.extraRequirements}
                            onChange={(e) => updateField("extraRequirements", e.target.value)}
                            placeholder="Например: нужен умный дом, резервное питание, сроки..."
                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30 min-h-[100px]"
                          />
                        </div>
                      </div>
                    </section>

                    <Separator className="bg-white/5" />

                    {/* 6. Timing */}
                    <section>
                      <SectionTitle number="6">Сроки</SectionTitle>
                      <div className="grid sm:grid-cols-2 gap-5">
                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Желаемая дата начала работ
                          </Label>
                          <Input
                            type="date"
                            value={data.startDate}
                            onChange={(e) => updateField("startDate", e.target.value)}
                            className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30 [color-scheme:dark]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-white/35 font-medium tracking-wider uppercase mb-2 block">
                            Срочность
                          </Label>
                          <RadioGroup
                            value={data.urgency}
                            onValueChange={(v) => updateField("urgency", v)}
                            className="flex flex-wrap gap-3"
                          >
                            {urgencyOptions.map((opt) => (
                              <Label
                                key={opt.value}
                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                                  data.urgency === opt.value
                                    ? "bg-volt/10 border-volt/30 text-white"
                                    : "bg-white/[0.02] border-white/5 text-white/50 hover:border-white/10"
                                }`}
                              >
                                <RadioGroupItem
                                  value={opt.value}
                                  className="text-volt border-volt/50"
                                />
                                <span className="text-sm">{opt.label}</span>
                              </Label>
                            ))}
                          </RadioGroup>
                        </div>
                      </div>
                    </section>

                    <Separator className="bg-white/5" />

                    {/* 7. Attachments */}
                    <section>
                      <SectionTitle number="7">Прикрепить файлы</SectionTitle>
                      <p className="text-white/30 text-xs mb-3">
                        План помещений, фото объекта, техническое задание — названия файлов попадут в
                        заявку.
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFiles(e.target.files)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="border-white/10 text-white/60 hover:text-volt hover:border-volt/30"
                      >
                        <Paperclip className="mr-2 w-4 h-4" />
                        Выбрать файлы
                      </Button>
                      {files.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {files.map((file, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/10 text-xs text-white/50"
                            >
                              {file.name}
                              <button
                                type="button"
                                onClick={() => removeFile(i)}
                                className="text-white/30 hover:text-red-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </section>

                    <Separator className="bg-white/5" />

                    {/* 8. Preferred contact */}
                    <section>
                      <SectionTitle number="8">Как с вами связаться</SectionTitle>
                      <RadioGroup
                        value={data.preferredContact}
                        onValueChange={(v) => updateField("preferredContact", v)}
                        className="flex flex-wrap gap-3"
                      >
                        {contactOptions.map((opt) => (
                          <Label
                            key={opt.value}
                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                              data.preferredContact === opt.value
                                ? "bg-volt/10 border-volt/30 text-white"
                                : "bg-white/[0.02] border-white/5 text-white/50 hover:border-white/10"
                            }`}
                          >
                            <RadioGroupItem value={opt.value} className="text-volt border-volt/50" />
                            <span className="text-sm">{opt.label}</span>
                          </Label>
                        ))}
                      </RadioGroup>
                    </section>

                    <Separator className="bg-white/5" />

                    {/* 9. Notes */}
                    <section>
                      <SectionTitle number="9">Дополнительные примечания</SectionTitle>
                      <Textarea
                        value={data.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                        placeholder="Всё, что поможет быстрее подготовить смету"
                        className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/15 focus:border-volt/30 min-h-[100px]"
                      />
                    </section>
                  </CardContent>
                </Card>

                {status === "error" && errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
                  >
                    {errorMsg}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Sticky action bar */}
      <AnimatePresence>
        {status !== "success" && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-t border-white/10"
          >
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <p className="text-white/30 text-xs text-center sm:text-left">
                  Поля с <span className="text-volt">*</span> обязательны
                </p>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={downloadRequest}
                    className="flex-1 sm:flex-none border-white/10 text-white hover:text-volt hover:border-volt/30"
                  >
                    <Download className="mr-2 w-4 h-4" />
                    Скачать
                  </Button>
                  <Button
                    type="button"
                    onClick={sendRequest}
                    disabled={status === "sending"}
                    className="flex-1 sm:flex-none bg-volt text-charcoal font-bold hover:bg-volt-hover hover:text-charcoal disabled:opacity-50"
                  >
                    {status === "sending" ? (
                      <>Отправка...</>
                    ) : (
                      <>
                        <Send className="mr-2 w-4 h-4" />
                        Отправить бригадиру
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
