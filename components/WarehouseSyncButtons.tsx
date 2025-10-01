"use client"

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Settings, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { syncWbStocks, syncOzonStocks, syncYmStocks, setWbBarcodes, getWarehouseItems } from "@/app/wb/actions";

export function WarehouseSyncButtons() {
  const [loading, setLoading] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [needSetup, setNeedSetup] = useState(false); // True if some items miss wb_sku
  const [hasSyncableWb, setHasSyncableWb] = useState(false); // True if some have wb_sku
  const [hasSyncableOzon, setHasSyncableOzon] = useState(false); // True if some have ozon_sku
  const [hasSyncableYm, setHasSyncableYm] = useState(false); // True if some have ym_sku

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
          toast.success(`Загружено ${res.data.length} items из Supabase. ${missingBarcodes ? "Нужна настройка баркодов." : "Всё готово к синку!"}`);
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
    loadItems();
  }, []);

  const handleSetupWbSku = async () => {
    setLoading(true);
    try {
      const res = await setWbBarcodes();
      if (res.success) {
        toast.success(`Обновлено ${res.updated} items с WB баркодами!`);
        // Re-check after setup
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
      const res = await syncYmStocks();
      toast[res.success ? "success" : "error"](res.success ? "YM синхронизировано!" : (res.error || "Ошибка синка YM"));
    } catch (err: any) {
      console.error("handleSyncYm error:", err);
      toast.error("Ошибка синка YM (см. логи)");
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

        {/* Новая кнопка Синк YM */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="bg-gradient-to-r from-[#FFC107] to-[#FF9800] hover:from-[#FF9800] hover:to-[#F57C00] text-white"
              onClick={handleSyncYm}
              disabled={loading || !itemsLoaded || !hasSyncableYm}
            >
              <RefreshCcw className="mr-1 h-3 w-3" /> YM
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{!hasSyncableYm ? "Нет items с ym_sku" : "Синк стоков YM из Supabase"}</p>
          </TooltipContent>
        </Tooltip>

        <p className="text-xs text-muted-foreground w-full">
          Вайб: Авто-загрузка из Supabase. {needSetup ? "Настрой баркоды для WB." : "Всё готово — синкни и вайби!"} Авто-синк nightly.
        </p>
      </div>
    </TooltipProvider>
  );
};