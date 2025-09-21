"use client"
import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncWbStocks, syncOzonStocks, setWbBarcodes } from "@/app/wb/actions";  // Добавили setWbBarcodes

export function WarehouseSyncButtons() {
  const handleSyncWb = async () => {
    const res = await syncWbStocks();
    toast[res.success ? "success" : "error"](res.success ? "WB синхронизировано!" : res.error);
  };

  const handleSyncOzon = async () => {
    const res = await syncOzonStocks();
    toast[res.success ? "success" : "error"](res.success ? "Ozon синхронизировано!" : res.error);
  };

  const handleSetupWbSku = async () => {
    const res = await setWbBarcodes();
    if (res.success) {
      toast.success(`Обновлено ${res.updated} items с WB баркодами!`);
    } else {
      toast.error(res.error || "Ошибка настройки WB SKU");
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        className="bg-gradient-to-r from-[#E313BF] to-[#C010A8] hover:from-[#C010A8] hover:to-[#A00E91] text-white"
        onClick={handleSetupWbSku}
      >
        Setup WB SKU
      </Button>
      <Button
        className="bg-gradient-to-r from-[#E313BF] to-[#C010A8] hover:from-[#C010A8] hover:to-[#A00E91] text-white"
        onClick={handleSyncWb}
      >
        Синк WB
      </Button>
      <Button
        className="bg-gradient-to-r from-[#005BFF] to-[#0048CC] hover:from-[#0048CC] hover:to-[#0039A6] text-white"
        onClick={handleSyncOzon}
      >
        Синк Ozon
      </Button>
      <p className="text-xs text-muted-foreground w-full">
        Примечание: Авто-синк каждую полночь. Используйте кнопки для ручного синка. Setup WB SKU сначала, если баркоды не настроены.
      </p>
    </div>
  );
};