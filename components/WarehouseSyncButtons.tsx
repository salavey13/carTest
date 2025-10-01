"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Settings, RefreshCcw, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  syncWbStocks,
  syncOzonStocks,
  syncYmStocks,
  setWbBarcodes,
  getWarehouseItems,
  getYmCampaigns,
  checkYmToken,
  setYmSku,
} from "@/app/wb/actions";

export function WarehouseSyncButtons() {
  const [loading, setLoading] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [needSetup, setNeedSetup] = useState(false);
  const [hasSyncableWb, setHasSyncableWb] = useState(false);
  const [hasSyncableOzon, setHasSyncableOzon] = useState(false);
  const [hasSyncableYm, setHasSyncableYm] = useState(false);

  // YM specific
  const [campaigns, setCampaigns] = useState<any[] | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);
  const [tokenStatusText, setTokenStatusText] = useState<string | null>(null);

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      try {
        const res = await getWarehouseItems();
        if (res.success && res.data) {
          const missingBarcodes = res.data.some((i: any) => !i.specs?.wb_sku);
          const syncableWb = res.data.some((i: any) => !!i.specs?.wb_sku);
          const syncableOzon = res.data.some((i: any) => !!i.specs?.ozon_sku);
          const syncableYm = res.data.some((i: any) => !!i.specs?.ym_sku);
          setNeedSetup(missingBarcodes);
          setHasSyncableWb(syncableWb);
          setHasSyncableOzon(syncableOzon);
          setHasSyncableYm(syncableYm);
          setItemsLoaded(true);
          toast.success(
            `Загружено ${res.data.length} items из Supabase. ${
              missingBarcodes ? "Нужна настройка баркодов." : "Всё готово к синку!"
            }`
          );
        } else {
          toast.error(res.error || "Ошибка загрузки items");
        }
      } catch (err: any) {
        console.error("WarehouseSyncButtons.loadItems error:", err);
        toast.error("Ошибка при загрузке items (см. логи)");
      } finally {
        setLoading(false);
      }
    };

    // Load items + campaigns in parallel
    loadItems();
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setCheckingToken(true);
    try {
      const res = await getYmCampaigns();
      if (res.success) {
        setCampaigns(res.campaigns || []);
        // auto-select any AVAILABLE campaign (prefer existing selected or env handled server-side)
        const avail = (res.campaigns || []).find((c: any) => c.apiAvailability === "AVAILABLE");
        if (avail) setSelectedCampaign(String(avail.id));
        toast.success(`YM: найдено ${res.campaigns?.length || 0} кампаний`);
      } else {
        toast.error(res.error || "Не удалось получить кампании YM");
      }
    } catch (err: any) {
      console.error("loadCampaigns error:", err);
      toast.error("Ошибка при получении списка кампаний YM");
    } finally {
      setCheckingToken(false);
    }
  };

  const handleCheckYm = async () => {
    setCheckingToken(true);
    try {
      // checkYmToken returns diagnostics (server fn)
      const res = await checkYmToken(undefined as any, selectedCampaign || undefined);
      // normalize text for UI
      const summary = `list: ${res?.listStatus || "?"}, camp: ${res?.campStatus || "?"}`;
      setTokenStatusText(summary);
      toast.success("Проверка токена выполнена (см. статус)");
      console.info("checkYmToken result:", res);
    } catch (err: any) {
      console.error("handleCheckYm error:", err);
      toast.error("Ошибка проверки токена YM (см. логи)");
    } finally {
      setCheckingToken(false);
    }
  };

  const handleSetupWbSku = async () => {
    setLoading(true);
    try {
      const res = await setWbBarcodes();
      if (res.success) {
        toast.success(`Обновлено ${res.updated} items с WB баркодами!`);
        const itemsRes = await getWarehouseItems();
        if (itemsRes.success && itemsRes.data) {
          const stillMissing = itemsRes.data.some((i: any) => !i.specs?.wb_sku);
          const syncableWb = itemsRes.data.some((i: any) => !!i.specs?.wb_sku);
          const syncableOzon = itemsRes.data.some((i: any) => !!i.specs?.ozon_sku);
          const syncableYm = itemsRes.data.some((i: any) => !!i.specs?.ym_sku);
          setNeedSetup(stillMissing);
          setHasSyncableWb(syncableWb);
          setHasSyncableOzon(syncableOzon);
          setHasSyncableYm(syncableYm);
        }
      } else {
        toast.error(res.error || "Ошибка настройки WB SKU");
      }
    } catch (err: any) {
      console.error("handleSetupWbSku error:", err);
      toast.error("Ошибка при setup WB SKU (см. логи)");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWb = async () => {
    setLoading(true);
    try {
      const res = await syncWbStocks();
      toast[res.success ? "success" : "error"](res.success ? "WB синхронизировано!" : res.error);
    } catch (err: any) {
      console.error("handleSyncWb error:", err);
      toast.error("Ошибка синка WB (см. логи)");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncOzon = async () => {
    setLoading(true);
    try {
      const res = await syncOzonStocks();
      toast[res.success ? "success" : "error"](res.success ? "Ozon синхронизировано!" : res.error);
    } catch (err: any) {
      console.error("handleSyncOzon error:", err);
      toast.error("Ошибка синка Ozon (см. логи)");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncYm = async () => {
    setLoading(true);
    try {
      const res = await syncYmStocks(selectedCampaign || undefined);
      if (res.success) {
        toast.success(`YM синхронизировано! Отправлено: ${res.sent || "?"} items. Кампания: ${res.campaignId || "?"}`);
      } else {
        toast.error(res.error || "Ошибка синка YM");
      }
    } catch (err: any) {
      console.error("handleSyncYm error:", err);
      toast.error("Ошибка синка YM (см. логи)");
    } finally {
      setLoading(false);
    }
  };

  const handleSetYmSku = async () => {
    setLoading(true);
    try {
      const res = await setYmSku();
      if (res.success) {
        toast.success(`setYmSku: updated ${res.updated || 0} items`);
        const itemsRes = await getWarehouseItems();
        if (itemsRes.success && itemsRes.data) {
          const syncableYm = itemsRes.data.some((i: any) => !!i.specs?.ym_sku);
          setHasSyncableYm(syncableYm);
        }
      } else {
        toast.error(res.error || "Ошибка setYmSku");
      }
    } catch (err: any) {
      console.error("handleSetYmSku error:", err);
      toast.error("Ошибка setYmSku (см. логи)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2 items-center">
        {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}

        {needSetup && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div initial={{ scale: 1 }} animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                <Button
                  className="bg-gradient-to-r from-[#E313BF] to-[#C010A8] hover:from-[#C010A8] hover:to-[#A00E91] text-white"
                  onClick={handleSetupWbSku}
                  disabled={loading}
                >
                  <Settings className="mr-1 h-3 w-3" /> Setup WB
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Настроить баркоды для синка (missing у некоторых items)</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="bg-gradient-to-r from-[#E313BF] to-[#C010A8] hover:from-[#C010A8] hover:to-[#A00E91] text-white"
              onClick={handleSyncWb}
              disabled={loading || !itemsLoaded || !hasSyncableWb}
            >
              <RefreshCcw className="mr-1 h-3 w-3" /> WB
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{!hasSyncableWb ? "Нет items с wb_sku" : "Синк стоков WB из Supabase"}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="bg-gradient-to-r from-[#005BFF] to-[#0048CC] hover:from-[#0048CC] hover:to-[#0039A6] text-white"
              onClick={handleSyncOzon}
              disabled={loading || !itemsLoaded || !hasSyncableOzon}
            >
              <RefreshCcw className="mr-1 h-3 w-3" /> Ozon
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{!hasSyncableOzon ? "Нет items с ozon_sku" : "Синк стоков Ozon из Supabase"}</p>
          </TooltipContent>
        </Tooltip>

        {/* YM Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-md px-2 py-1 bg-white">
            <label className="text-xs mr-2 text-muted-foreground">YM кампания</label>
            <div className="relative">
              <select
                className="text-sm p-1 bg-transparent"
                value={selectedCampaign || ""}
                onChange={(e) => setSelectedCampaign(e.target.value || null)}
                disabled={checkingToken || !campaigns}
              >
                <option value="">(auto select AVAILABLE)</option>
                {(campaigns || []).map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.domain} — {c.id} {c.apiAvailability ? `(${c.apiAvailability})` : ""}
                  </option>
                ))}
              </select>
              <span className="absolute right-0 top-1/2 -translate-y-1/2 pr-1">
                <ChevronDown className="h-4 w-4" />
              </span>
            </div>
            <Button className="ml-2" onClick={handleCheckYm} disabled={checkingToken}>
              {checkingToken ? <Loader2 className="h-3 w-3 animate-spin" /> : "Check token"}
            </Button>
            <Button
              className="bg-gradient-to-r from-[#FFC107] to-[#FF9800] hover:from-[#FF9800] hover:to-[#F57C00] text-white ml-2"
              onClick={handleSyncYm}
              disabled={loading || !itemsLoaded || !hasSyncableYm}
            >
              <RefreshCcw className="mr-1 h-3 w-3" /> YM
            </Button>
          </div>
          <Button onClick={handleSetYmSku} disabled={loading} title="Заполнить ym_sku = id для тех у кого пусто">
            set ym_sku
          </Button>
        </div>

        <p className="text-xs text-muted-foreground w-full">
          Вайб: Авто-загрузка из Supabase. {needSetup ? "Настрой баркоды для WB." : "Всё готово — синкни и вайби!"} Авто-синк nightly.
        </p>

        {tokenStatusText && <p className="text-xs text-muted-foreground w-full">YM token: {tokenStatusText}</p>}
      </div>
    </TooltipProvider>
  );
}