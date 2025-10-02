"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getWarehouseItems } from "@/app/wb/actions";
import { processOrder } from "@/app/wb/auto-actions";

export default function TestTriggerPage() {
  const [platform, setPlatform] = useState<"wb" | "ozon" | "ym">("wb");
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const itemsRes = await getWarehouseItems();
      if (!itemsRes.success || !itemsRes.data) {
        toast.error("Failed to fetch items");
        return;
      }

      const item = itemsRes.data.find((i: any) => i.specs?.pattern === "ogurcy" && i.specs?.season === "leto" && i.specs?.size === "evro");
      if (!item) {
        toast.error("Item 'евро лето огурцы' not found");
        return;
      }

      const skuKey = `${platform}_sku` as "wb_sku" | "ozon_sku" | "ym_sku";
      const sku = item.specs?.[skuKey] as string | undefined;
      if (!sku) {
        toast.error(`No ${platform.toUpperCase()} SKU for item`);
        return;
      }

      const mockOrderId = `test-${platform}-${Date.now()}`;
      const itemsToProcess = [{ sku, qty }];

      const res = await processOrder(mockOrderId, platform, itemsToProcess);
      if (res.success) {
        toast.success(`Mock purchase triggered: decreased ${qty} for SKU ${sku} on ${platform.toUpperCase()}`);
      } else {
        toast.error(res.error || "Failed to process mock order");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error triggering test");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle>Test Trigger for "евро лето огурцы"</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={platform} onValueChange={(v: any) => setPlatform(v)}>
          <SelectTrigger>
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="wb">Wildberries</SelectItem>
            <SelectItem value="ozon">Ozon</SelectItem>
            <SelectItem value="ym">Yandex Market</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value) || 1)}
          placeholder="Quantity"
        />

        <Button onClick={handleTrigger} disabled={loading} className="w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Trigger Mock Purchase
        </Button>
      </CardContent>
    </Card>
  );
}