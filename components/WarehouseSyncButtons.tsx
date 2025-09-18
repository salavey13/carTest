"use client"
import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncWbStocks, syncOzonStocks, uploadWarehouseCsv } from "@/app/wb/actions";  // Assuming uploadWarehouseCsv for Supabase sync example

export function WarehouseSyncButtons() {
  const handleSyncWb = async () => {
    const res = await syncWbStocks();
    toast[res.success ? "success" : "error"](res.success ? "WB синхронизировано!" : res.error);
  };

  const handleSyncOzon = async () => {
    const res = await syncOzonStocks();
    toast[res.success ? "success" : "error"](res.success ? "Ozon синхронизировано!" : res.error);
  };

  const handleSyncSupabase = async () => {
    // Example: Sync to Supabase, adjust as needed (e.g., fetch and upload)
    const res = await uploadWarehouseCsv([], "userId");  // Placeholder, implement actual sync
    toast[res.success ? "success" : "error"](res.success ? "Supabase синхронизировано!" : res.error);
  };

  return (
    <div className="flex flex-wrap gap-2">
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
      <Button
        className="bg-gradient-to-r from-[#3ECF8E] to-[#2EAE74] hover:from-[#2EAE74] hover:to-[#228C5B] text-white"
        onClick={handleSyncSupabase}
      >
        Синк Supabase
      </Button>
      <p className="text-xs text-muted-foreground w-full">
        Примечание: Авто-синк каждую полночь. Используйте кнопки для ручного синка.
      </p>
    </div>
  );
};