"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ChevronDown } from "lucide-react";
import { registerOzonWebhook, registerYmWebhook } from "@/app/wb/auto-actions";
import { getBaseUrl } from "@/lib/utils";
import { getYmCampaigns } from "@/app/wb/actions";

/**
 * WebhookSetupButtons — теперь с селектором кампаний Яндекс.Маркет.
 *
 * Требования:
 * - getYmCampaigns() — server action, возвращает { success, campaigns: [...] }
 * - registerYmWebhook(url, campaignId) — принимает campaignId (string|number)
 * - NEXT_PUBLIC_YM_WAREHOUSE_ID (опционально) — fallback для campaignId, если нужно
 */

export function WebhookSetupButtons() {
  const [loading, setLoading] = useState<{ ozon: boolean; ym: boolean }>({ ozon: false, ym: false });
  const [campaigns, setCampaigns] = useState<any[] | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState<boolean>(false);

  const baseUrl = getBaseUrl();
  const ymCampaignEnv = process.env.NEXT_PUBLIC_YM_WAREHOUSE_ID || "";

  useEffect(() => {
    loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCampaigns = async () => {
    setCampaignsLoading(true);
    try {
      const res = await getYmCampaigns();
      if (res?.success) {
        const list = res.campaigns || [];
        setCampaigns(list);

        // автоподбор: ищем доступную кампанию, иначе используем env, иначе первую
        const avail = list.find((c: any) => c.apiAvailability === "AVAILABLE");
        if (avail) setSelectedCampaign(String(avail.id));
        else if (ymCampaignEnv) setSelectedCampaign(String(ymCampaignEnv));
        else if (list.length) setSelectedCampaign(String(list[0].id));

        toast.success("Кампании YM загружены", { description: `Найдено ${list.length} кампаний` });
      } else {
        // Если не success — попробуем fallback на env
        if (ymCampaignEnv) {
          setSelectedCampaign(String(ymCampaignEnv));
          toast.warning("Не удалось загрузить кампании YM — используем NEXT_PUBLIC_YM_WAREHOUSE_ID");
        } else {
          toast.error("Ошибка загрузки кампаний YM", { description: res?.error || "Проверьте настройки" });
        }
      }
    } catch (err: any) {
      console.error("loadCampaigns error:", err);
      if (ymCampaignEnv) {
        setSelectedCampaign(String(ymCampaignEnv));
        toast.warning("Ошибка получения кампаний — используем NEXT_PUBLIC_YM_WAREHOUSE_ID");
      } else {
        toast.error("Ошибка при получении кампаний Яндекс.Маркет (подробности в консоли)");
      }
    } finally {
      setCampaignsLoading(false);
    }
  };

  const handleSetOzon = async () => {
    setLoading((s) => ({ ...s, ozon: true }));
    try {
      const url = `${baseUrl}/api/webhooks/ozon`;
      const res = await registerOzonWebhook(url);
      if (res?.success) {
        toast.success("Ozon webhook настроен");
      } else {
        toast.error(res?.error || "Ошибка настройки Ozon webhook");
        console.error("registerOzonWebhook:", res);
      }
    } catch (err: any) {
      console.error("handleSetOzon", err);
      toast.error(err?.message || "Ошибка настройки Ozon webhook");
    } finally {
      setLoading((s) => ({ ...s, ozon: false }));
    }
  };

  const handleSetYm = async () => {
    setLoading((s) => ({ ...s, ym: true }));
    try {
      const url = `${baseUrl}/api/webhooks/ym`;
      const campaignIdToUse = selectedCampaign || (ymCampaignEnv ? String(ymCampaignEnv) : undefined);

      if (!campaignIdToUse) {
        toast.error("Не выбрана кампания YM. Установите кампанию в селекторе или задайте NEXT_PUBLIC_YM_WAREHOUSE_ID.");
        setLoading((s) => ({ ...s, ym: false }));
        return;
      }

      const res = await registerYmWebhook(url, campaignIdToUse);
      if (res?.success) {
        toast.success("YM webhook настроен для кампании " + campaignIdToUse);
      } else {
        toast.error(res?.error || "Ошибка настройки YM webhook");
        console.error("registerYmWebhook failed:", res);
      }
    } catch (err: any) {
      console.error("handleSetYm", err);
      toast.error(err?.message || "Ошибка настройки YM webhook");
    } finally {
      setLoading((s) => ({ ...s, ym: false }));
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center md:gap-3 gap-2">
      <div className="flex items-center gap-2">
        <Button onClick={handleSetOzon} disabled={loading.ozon} className="bg-blue-500 hover:bg-blue-600">
          {loading.ozon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Set Ozon Webhook
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-[220px]">
          <label className="text-xs text-muted-foreground mb-1 block">Кампания YM</label>
          <div className="relative">
            <select
              aria-label="Выберите кампанию YM"
              className="w-full text-sm p-2 border rounded-md bg-background pr-8"
              value={selectedCampaign || ""}
              onChange={(e) => setSelectedCampaign(e.target.value || null)}
              disabled={campaignsLoading}
            >
              <option value="">{campaignsLoading ? "Загрузка..." : "Автовыбор / вручную"}</option>
              {(campaigns || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.domain || c.name || `id:${c.id}`} — {c.id} {c.apiAvailability ? `(${c.apiAvailability})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <Button onClick={handleSetYm} disabled={loading.ym || campaignsLoading} className="bg-orange-500 hover:bg-orange-600">
          {loading.ym ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Set YM Webhook
        </Button>
      </div>
    </div>
  );
}