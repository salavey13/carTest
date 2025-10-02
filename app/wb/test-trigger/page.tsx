"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Copy, RefreshCcw } from "lucide-react";
import { getWarehouseItems, getSalaryCalcToday } from "@/app/wb/actions";
import { processOrder, generateDailySummary } from "@/app/wb/auto-actions";
import { v4 as uuidv4 } from "uuid";

export default function TestTriggerPage() {
  const [platform, setPlatform] = useState<"wb" | "ozon" | "ym">("wb");
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [salaryData, setSalaryData] = useState<any[]>([]);
  const [summaryText, setSummaryText] = useState("");

  useEffect(() => {
    fetchSalaryStatus();
  }, []);

  const fetchSalaryStatus = async () => {
    setLoading(true);
    try {
      const res = await getSalaryCalcToday();
      if (res.success && res.data) {
        setSalaryData(res.data);
      } else {
        toast.error(res.error || "Failed to fetch salary data");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error fetching salary data");
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const itemsRes = await getWarehouseItems();
      if (!itemsRes.success || !itemsRes.data) {
        toast.error("Failed to fetch items");
        return;
      }

      const item = itemsRes.data.find((i: any) => 
        (i.specs?.pattern || "").includes("ogurcy") && 
        (i.specs?.season || "").includes("leto") && 
        (i.specs?.size || "").includes("evro")
      );
      if (!item) {
        toast.error("Item 'евро лето огурцы' not found — check specs.pattern/season/size");
        return;
      }

      const skuKey = `${platform}_sku` as "wb_sku" | "ozon_sku" | "ym_sku";
      const sku = item.specs?.[skuKey] as string | undefined;
      if (!sku) {
        toast.error(`No ${platform.toUpperCase()} SKU for item ${item.id}`);
        return;
      }

      const mockOrderId = `test-${platform}-${uuidv4()}`;
      const itemsToProcess = [{ sku, qty }];

      const res = await processOrder(mockOrderId, platform, itemsToProcess);
      if (res.success) {
        toast.success(`Mock purchase triggered: decreased ${qty} for SKU ${sku} on ${platform.toUpperCase()}.`);
        fetchSalaryStatus(); // Refresh status
      } else {
        toast.error(res.error || "Failed to process mock order");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error triggering test");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    setLoading(true);
    try {
      const res = await generateDailySummary();
      if (res.success && res.text) {
        setSummaryText(res.text);
        navigator.clipboard.writeText(res.text);
        toast.success("Summary generated and copied to clipboard. Notified admin.");
      } else {
        toast.error(res.error || "Failed to generate summary");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error generating summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Purchase Trigger for "евро лето огурцы"</CardTitle>
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
            placeholder="Quantity to decrease"
          />

          <Button onClick={handleTrigger} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Trigger Mock Purchase
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today Salary Calculation Status</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchSalaryStatus} disabled={loading}>
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {salaryData.length === 0 ? (
            <p className="text-center text-muted-foreground">No data for today</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Item ID</TableHead>
                  <TableHead>Decreased Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salaryData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{row.platform}</TableCell>
                    <TableCell>{row.item_id}</TableCell>
                    <TableCell>{row.decreased_qty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generate Daily Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGenerateSummary} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate & Copy Summary
          </Button>
          {summaryText && (
            <div className="p-4 bg-muted rounded-md whitespace-pre-wrap text-sm">
              {summaryText}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}