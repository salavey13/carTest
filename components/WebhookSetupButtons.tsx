"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { registerOzonWebhook, registerYmWebhook } from "@/app/wb/auto-actions";
import { getBaseUrl } from "@/lib/utils";

export function WebhookSetupButtons() {
  const [loading, setLoading] = useState({ ozon: false, ym: false });
  const baseUrl = getBaseUrl();

  const handleSetOzon = async () => {
    setLoading(prev => ({ ...prev, ozon: true }));
    try {
      const url = `${baseUrl}/api/webhooks/ozon`;
      const res = await registerOzonWebhook(url);
      if (res.success) {
        toast.success("Ozon webhook настроен");
      } else {
        toast.error(res.error || "Ошибка настройки Ozon webhook");
      }
    } catch (err: any) {
      toast.error(err?.message || "Ошибка настройки");
    } finally {
      setLoading(prev => ({ ...prev, ozon: false }));
    }
  };

  const handleSetYm = async () => {
    setLoading(prev => ({ ...prev, ym: true }));
    try {
      const url = `${baseUrl}/api/webhooks/ym`;
      const campaignId = process.env.YM_WAREHOUSE_ID || ""; // from env or select if multiple
      const res = await registerYmWebhook(url, campaignId);
      if (res.success) {
        toast.success("YM webhook настроен");
      } else {
        toast.error(res.error || "Ошибка настройки YM webhook");
      }
    } catch (err: any) {
      toast.error(err?.message || "Ошибка настройки");
    } finally {
      setLoading(prev => ({ ...prev, ym: false }));
    }
  };

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleSetOzon}
        disabled={loading.ozon}
        className="bg-blue-500 hover:bg-blue-600"
      >
        {loading.ozon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Set Ozon Webhook
      </Button>
      <Button
        onClick={handleSetYm}
        disabled={loading.ym}
        className="bg-orange-500 hover:bg-orange-600"
      >
        {loading.ym ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Set YM Webhook
      </Button>
    </div>
  );
}