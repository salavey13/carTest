"use client"

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Settings, RefreshCcw, Database } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { syncWbStocks, syncOzonStocks, setWbBarcodes, getWarehouseItems } from "@/app/wb/actions";

export function WarehouseSyncButtons() {
  const [loading, setLoading] = useState(false);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [needSetup, setNeedSetup] = useState(false); // True if some items miss wb_sku

  useEffect(() => {
    const loadItems = async () => {
      setLoading(true);
      const res = await getWarehouseItems();
      setLoading(false);
      if (res.success && res.data) {
        const missingBarcodes = res.data.some((i: any) => !i.specs?.wb_sku);
        setNeedSetup(missingBarcodes);
        setItemsLoaded(true);
        toast.success(`Загружено ${res.data.length} items из Supabase. ${missingBarcodes ? "Нужна настройка баркодов." : "Всё готово к синку!"}`);
      } else {
        toast.error(res.error || "Ошибка загрузки items");
      }
    };
    loadItems();
  }, []);

  const handleSetupWbSku = async () => {
    setLoading(true);
    const res = await setWbBarcodes();
    setLoading(false);
    if (res.success) {
      toast.success(`Обновлено ${res.updated} items с WB баркодами!`);
      // Re-check after setup
      const itemsRes = await getWarehouseItems();
      if (itemsRes.success && itemsRes.data) {
        const stillMissing = itemsRes.data.some((i: any) => !i.specs?.wb_sku);
        setNeedSetup(stillMissing);
      }
    } else {
      toast.error(res.error || "Ошибка настройки WB SKU");
    }
  };

  const handleSyncWb = async () => {
    setLoading(true);
    const res = await syncWbStocks();
    setLoading(false);
    toast[res.success ? "success" : "error"](res.success ? "WB синхронизировано!" : res.error);
  };

  const handleSyncOzon = async () => {
    setLoading(true);
    const res = await syncOzonStocks();
    setLoading(false);
    toast[res.success ? "success" : "error"](res.success ? "Ozon синхронизировано!" : res.error);
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
              disabled={loading || !itemsLoaded || needSetup}
            >
              <RefreshCcw className="mr-1 h-3 w-3" /> WB
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{needSetup ? "Сначала настрой баркоды" : "Синк стоков WB из Supabase"}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              className="bg-gradient-to-r from-[#005BFF] to-[#0048CC] hover:from-[#0048CC] hover:to-[#0039A6] text-white"
              onClick={handleSyncOzon}
              disabled={loading || !itemsLoaded}
            >
              <RefreshCcw className="mr-1 h-3 w-3" /> Ozon
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Синк стоков Ozon из Supabase</p>
          </TooltipContent>
        </Tooltip>
        <p className="text-xs text-muted-foreground w-full">
          Вайб: Авто-загрузка из Supabase. {needSetup ? "Настрой баркоды для WB." : "Всё готово — синкни и вайби!"} Авто-синк nightly.
        </p>
      </div>
    </TooltipProvider>
  );
};