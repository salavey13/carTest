"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { useCrewTokens } from "@/app/franchize/lib/use-crew-tokens";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/Loading";
import { Plus, Settings, Trash2, Check, X, Percent, DollarSign } from "lucide-react";
import { toast } from "sonner";
import {
  getCommissionRates,
  upsertCommissionRate,
  deactivateCommissionRate,
  type CommissionRate,
} from "@/app/franchize/server-actions/commissions";

interface CommissionsClientProps {
  crewSlug: string;
  crew: any;
}

export function CommissionsClient({ crewSlug, crew }: CommissionsClientProps) {
  const { dbUser, userCrewMemberships } = useAppContext();
  const tokens = useCrewTokens(crew.theme);

  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<CommissionRate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    operationType: "rental",
    commissionType: "percentage" as "percentage" | "fixed_amount",
    commissionValue: "",
    priority: "0",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isOwner = userCrewMemberships.some(
    (m) => m.slug === crewSlug && ["owner", "admin", "co_owner"].includes(m.role)
  );

  useEffect(() => {
    loadRates();
  }, [crewSlug]);

  const loadRates = async () => {
    setLoading(true);
    try {
      const result = await getCommissionRates({
        slug: crewSlug,
        actorUserId: dbUser?.user_id || "",
      });

      if (result.success) {
        setRates(result.data || []);
      } else {
        toast.error(result.error || "Не удалось загрузить ставки");
      }
    } catch (error) {
      console.error("[loadRates] Error:", error);
      toast.error("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  const handleUpsertRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    // Validation
    const errors: Record<string, string> = {};
    const value = Number(formData.commissionValue);

    if (formData.commissionType === "percentage") {
      if (isNaN(value) || value <= 0) {
        errors.commissionValue = "Процент должен быть больше нуля";
      } else if (value > 100) {
        errors.commissionValue = "Процент не может превышать 100%";
      }
    } else {
      if (isNaN(value) || value <= 0) {
        errors.commissionValue = "Фиксированная сумма должна быть больше нуля";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      const result = await upsertCommissionRate({
        slug: crewSlug,
        actorUserId: dbUser?.user_id || "",
        operationType: formData.operationType,
        commissionType: formData.commissionType,
        commissionValue: value,
        priority: Number(formData.priority),
      });

      if (result.success) {
        toast.success("Ставка сохранена");
        setShowForm(false);
        setFormData({
          operationType: "rental",
          commissionType: "percentage",
          commissionValue: "",
          priority: "0",
        });
        loadRates();
      } else {
        toast.error(result.error || "Не удалось сохранить ставку");
      }
    } catch (error) {
      console.error("[handleUpsertRate] Error:", error);
      toast.error("Ошибка сохранения ставки");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      const result = await deactivateCommissionRate({
        slug: crewSlug,
        actorUserId: dbUser?.user_id || "",
        id,
      });

      if (result.success) {
        toast.success("Ставка деактивирована");
        setConfirmDelete(null);
        loadRates();
      } else {
        toast.error(result.error || "Не удалось деактивировать ставку");
      }
    } catch (error) {
      console.error("[handleDeactivate] Error:", error);
      toast.error("Ошибка деактивации");
    }
  };

  const getOperationLabel = (operation: string) => {
    const labels: Record<string, string> = {
      rental: "Аренда",
      sale: "Продажа",
      service_return: "Возврат сервиса",
      purchase: "Закупка",
    };
    return labels[operation] || operation;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold uppercase tracking-tighter md:text-3xl">
            Комиссионные ставки
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {crew?.name || crewSlug}
          </p>
        </div>
        {isOwner && (
          <Button
            onClick={() => setShowForm(!showForm)}
            style={tokens.styles.ctaPrimary}
            className="min-h-[44px] px-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить ставку
          </Button>
        )}
      </div>

      {/* Stats Card */}
      <Card style={tokens.styles.card}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Всего активных ставок</h3>
              <p className="text-muted-foreground text-sm">
                {rates.filter((r) => r.isActive).length} из {rates.length}
              </p>
            </div>
            <Settings className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Upsert Form */}
      {showForm && isOwner && (
        <Card style={tokens.styles.card}>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {formData.operationType && rates.some(
                (r) => r.operationType === formData.operationType && r.priority === Number(formData.priority)
              )
                ? "Обновить ставку"
                : "Новая ставка"}
            </h3>
            <form onSubmit={handleUpsertRate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Операция
                  </label>
                  <Select
                    value={formData.operationType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, operationType: value })
                    }
                  >
                    <SelectTrigger style={tokens.styles.input}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rental">Аренда</SelectItem>
                      <SelectItem value="sale">Продажа</SelectItem>
                      <SelectItem value="service_return">Возврат сервиса</SelectItem>
                      <SelectItem value="purchase">Закупка</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Тип комиссии
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={formData.commissionType === "percentage" ? "default" : "outline"}
                      onClick={() =>
                        setFormData({
                          ...formData,
                          commissionType: "percentage",
                          commissionValue: "",
                        })
                      }
                      style={
                        formData.commissionType === "percentage"
                          ? tokens.styles.ctaPrimary
                          : tokens.styles.ctaSecondary
                      }
                      className="flex-1"
                    >
                      <Percent className="h-4 w-4 mr-2" />
                      Процент
                    </Button>
                    <Button
                      type="button"
                      variant={formData.commissionType === "fixed_amount" ? "default" : "outline"}
                      onClick={() => {
                        const newCommissionType = "fixed_amount";
                        setFormData({
                          ...formData,
                          commissionType: newCommissionType,
                          commissionValue: "",
                        });
                      }}
                      style={
                        formData.commissionType === "fixed_amount"
                          ? tokens.styles.ctaPrimary
                          : tokens.styles.ctaSecondary
                      }
                      className="flex-1"
                    >
                      <DollarSign className="h-4 w-4 mr-2" />
                      Фикс
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    {formData.commissionType === "percentage"
                      ? "Значение (%)"
                      : "Значение (₽)"}
                  </label>
                  <Input
                    type="number"
                    step={formData.commissionType === "percentage" ? "0.01" : "0.01"}
                    value={formData.commissionValue}
                    onChange={(e) =>
                      setFormData({ ...formData, commissionValue: e.target.value })
                    }
                    placeholder={
                      formData.commissionType === "percentage"
                        ? "0.00"
                        : "0.00"
                    }
                    style={tokens.styles.input}
                    className={formErrors.commissionValue ? "border-red-500" : ""}
                  />
                  {formErrors.commissionValue && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.commissionValue}
                    </p>
                  )}
                  {formData.commissionType === "percentage" &&
                    formData.commissionValue &&
                    Number(formData.commissionValue) > 100 && (
                      <p className="text-red-500 text-xs mt-1">
                        Процент не может превышать 100%
                      </p>
                    )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Приоритет
                  </label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value })
                    }
                    placeholder="0"
                    style={tokens.styles.input}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Чем выше число, тем выше приоритет
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={submitting}
                  style={tokens.styles.ctaPrimary}
                  className="min-h-[44px] px-6"
                >
                  {submitting ? "Сохранение..." : "Сохранить"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setFormErrors({});
                    setFormData({
                      operationType: "rental",
                      commissionType: "percentage",
                      commissionValue: "",
                      priority: "0",
                    });
                  }}
                  style={tokens.styles.ctaSecondary}
                  className="min-h-[44px] px-6"
                >
                  Отмена
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rates Table */}
      <Card style={tokens.styles.card}>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loading variant="bike" text="Загрузка ставок..." />
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>Нет настроенных ставок</p>
              {isOwner && (
                <p className="text-sm mt-2">
                  Нажмите "Добавить ставку" для создания первой ставки
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className="border-b"
                    style={{ borderColor: tokens.borderSoft }}
                  >
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Операция
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Тип
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Значение
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Приоритет
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      Статус
                    </th>
                    {isOwner && (
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                        Действия
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr
                      key={rate.id}
                      className="border-b hover:bg-muted/50 transition-colors"
                      style={{ borderColor: tokens.borderSoft }}
                    >
                      <td className="p-4 text-sm font-medium">
                        {getOperationLabel(rate.operationType)}
                      </td>
                      <td className="p-4 text-sm">
                        <Badge
                          variant={rate.commissionType === "percentage" ? "default" : "secondary"}
                          style={tokens.styles.accentPill}
                        >
                          {rate.commissionType === "percentage" ? (
                            <>
                              <Percent className="h-3 w-3 mr-1" />
                              Процент
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-3 w-3 mr-1" />
                              Фикс
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm font-semibold">
                        {rate.commissionType === "percentage"
                          ? `${rate.commissionValue}%`
                          : `${rate.commissionValue.toLocaleString()} ₽`}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {rate.priority}
                      </td>
                      <td className="p-4 text-sm">
                        {rate.isActive ? (
                          <Badge style={tokens.styles.successBadge}>
                            <Check className="h-3 w-3 mr-1" />
                            Активна
                          </Badge>
                        ) : (
                          <Badge variant="secondary" style={tokens.styles.mutedText}>
                            <X className="h-3 w-3 mr-1" />
                            Неактивна
                          </Badge>
                        )}
                      </td>
                      {isOwner && (
                        <td className="p-4 text-sm">
                          {rate.isActive ? (
                            confirmDelete === rate.id ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeactivate(rate.id)}
                                  className="h-[32px] px-3"
                                >
                                  <Check className="h-3 w-3 mr-1" />
                                  Да
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmDelete(null)}
                                  className="h-[32px] px-3"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Нет
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmDelete(rate.id)}
                                className="h-[32px] px-3 text-red-500 hover:text-red-600 hover:bg-red-50"
                                style={{
                                  color: "#ef4444",
                                }}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Деактивировать
                              </Button>
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Деактивирована
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card style={tokens.styles.subtleCard}>
        <CardContent className="p-6">
          <h4 className="font-semibold mb-2">Как работают комиссии</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Процентные ставки вычисляются от суммы операции</li>
            <li>• Фиксированные ставки добавляют постоянную сумму</li>
            <li>• Ставки с более высоким приоритетом применяются первыми</li>
            <li>• Можно создать несколько ставок для одной операции</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}