"use client"
import React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { syncWbStocks, syncOzonStocks } from "@/app/wb/actions";

export function WarehouseSyncButtons() {
  const handleSyncWb = async () => {
    const res = await syncWbStocks();
    toast[res.success ? "success" : "error"](res.success ? "WB synced!" : res.error);
  };

  const handleSyncOzon = async () => {
    const res = await syncOzonStocks();
    toast[res.success ? "success" : "error"](res.success ? "Ozon synced!" : res.error);
  };

  return (
    <div className="space-y-2">
      <Button
        className="bg-[#E313BF] hover:bg-[#C010A8] text-white w-full"
        onClick={handleSyncWb}
      >
        Sync WB
      </Button>
      <Button
        className="bg-[#005BFF] hover:bg-[#0048CC] text-white w-full"  
        onClick={handleSyncOzon}
      >
        Sync Ozon
      </Button>
      <p className="text-xs text-muted-foreground">
        Note: Auto-sync runs every midnight. Use buttons for manual sync as backup.
      </p>
    </div>
  );
};