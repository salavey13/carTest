"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Copy, RefreshCcw, Zap } from "lucide-react";
import { getWarehouseItems, getSalaryCalcToday } from "@/app/wb/actions";
import {
  processOrder,
  generateDailySummary,
  getSalesVelocity,
  getForecastDepletion,
  getPlatformShare,
  getWebhookConfig,
  saveWebhookConfig,
  sendTestWebhook,
  fetchRecentWebhookEvents,
} from "@/app/wb/actions";
import { v4 as uuidv4 } from "uuid";
import { WebhookSetupButtons } from "@/components/WebhookSetupButtons";

type Platform = "wb" | "ozon" | "ym";

export default function TestTriggerPage() {
  const [platform, setPlatform] = useState<Platform>("wb");
  const [qty, setQty] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [salaryData, setSalaryData] = useState<any[]>([]);
  const [summaryText, setSummaryText] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [velocityData, setVelocityData] = useState<any[]>([]);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [shareData, setShareData] = useState<any[]>([]);

  // webhook state
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [webhookEnabled, setWebhookEnabled] = useState<boolean>(false);
  const [webhookSecret, setWebhookSecret] = useState<string>("");
  const [events, setEvents] = useState<any[]>([]);
  const [webhookLoading, setWebhookLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchSalaryStatus();
    fetchWebhookConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- core actions ----------
  const fetchSalaryStatus = async () => {
    setLoading(true);
    try {
      const res = await getSalaryCalcToday();
      if (res?.success && Array.isArray(res.data)) setSalaryData(res.data);
      else toast.error(res?.error || "Failed to fetch salary data");
    } catch (err: any) {
      console.error("fetchSalaryStatus", err);
      toast.error(err?.message || "Error fetching salary data");
    } finally {
      setLoading(false);
    }
  };

  const handleTrigger = async () => {
    setLoading(true);
    try {
      const itemsRes = await getWarehouseItems();
      if (!itemsRes?.success || !Array.isArray(itemsRes.data)) {
        toast.error("Failed to fetch items");
        return;
      }

      const item = itemsRes.data.find((i: any) =>
        (String(i?.specs?.pattern || "").toLowerCase()).includes("ogurcy") &&
        (String(i?.specs?.season || "").toLowerCase()).includes("leto") &&
        (String(i?.specs?.size || "").toLowerCase()).includes("evro")
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
      if (res?.success) {
        toast.success(`Mock purchase triggered: decreased ${qty} for SKU ${sku} on ${platform.toUpperCase()}.`);
        fetchSalaryStatus();
      } else {
        toast.error(res?.error || "Failed to process mock order");
        console.error("processOrder failed:", res);
      }
    } catch (err: any) {
      console.error("handleTrigger", err);
      toast.error(err?.message || "Error triggering test");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    setLoading(true);
    try {
      const res = await generateDailySummary();
      if (res?.success && res.text) {
        setSummaryText(res.text);
        await navigator.clipboard.writeText(res.text);
        toast.success("Summary generated and copied to clipboard. Notified admin.");
      } else {
        toast.error(res?.error || "Failed to generate summary");
      }
    } catch (err: any) {
      console.error("handleGenerateSummary", err);
      toast.error(err?.message || "Error generating summary");
    } finally {
      setLoading(false);
    }
  };

  const handleGetVelocity = async () => {
    setLoading(true);
    try {
      const res = await getSalesVelocity(startDate, endDate);
      if (res?.success && Array.isArray(res.data)) setVelocityData(res.data);
      else toast.error(res?.error || "Failed to calculate velocity");
    } catch (err: any) {
      console.error("handleGetVelocity", err);
      toast.error(err?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleGetForecast = async () => {
    setLoading(true);
    try {
      const res = await getForecastDepletion();
      if (res?.success && Array.isArray(res.data)) setForecastData(res.data);
      else toast.error(res?.error || "Failed to calculate forecast");
    } catch (err: any) {
      console.error("handleGetForecast", err);
      toast.error(err?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleGetShare = async () => {
    setLoading(true);
    try {
      const res = await getPlatformShare(startDate, endDate);
      if (res?.success && Array.isArray(res.data)) setShareData(res.data);
      else toast.error(res?.error || "Failed to calculate share");
    } catch (err: any) {
      console.error("handleGetShare", err);
      toast.error(err?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  // ---------- webhook helpers ----------
  const fetchWebhookConfig = async () => {
    setWebhookLoading(true);
    try {
      const res = await getWebhookConfig(platform);
      if (res?.success && res.data) {
        setWebhookUrl(res.data.url || "");
        setWebhookEnabled(Boolean(res.data.enabled));
        setWebhookSecret(res.data.secret || "");
      }

      const ev = await fetchRecentWebhookEvents(platform);
      if (ev?.success && Array.isArray(ev.data)) setEvents(ev.data);
    } catch (err: any) {
      console.error("fetchWebhookConfig", err);
      toast.error("Ошибка загрузки конфигурации вебхука");
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleSaveWebhook = async () => {
    setWebhookLoading(true);
    try {
      const res = await saveWebhookConfig(platform, { url: webhookUrl, enabled: webhookEnabled, secret: webhookSecret });
      if (res?.success) toast.success("Webhook config saved");
      else {
        toast.error(res?.error || "Failed to save webhook config");
        console.error("saveWebhookConfig failed:", res);
      }
    } catch (err: any) {
      console.error("handleSaveWebhook", err);
      toast.error(err?.message || "Error saving webhook config");
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleSendTestWebhook = async () => {
    setWebhookLoading(true);
    try {
      const payload = { test: true, platform, timestamp: new Date().toISOString(), order_id: `test-${uuidv4()}` };
      const res = await sendTestWebhook(platform, payload);
      if (res?.success) {
        toast.success("Test webhook sent");
        const ev = await fetchRecentWebhookEvents(platform);
        if (ev?.success && Array.isArray(ev.data)) setEvents(ev.data);
      } else {
        toast.error(res?.error || "Failed to send test webhook");
        console.error("sendTestWebhook failed:", res);
      }
    } catch (err: any) {
      console.error("handleSendTestWebhook", err);
      toast.error(err?.message || "Error sending test webhook");
    } finally {
      setWebhookLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook URL copied");
    } catch (err) {
      console.error("handleCopyUrl", err);
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="container mx-auto p-4">
      {/* purchase trigger card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Purchase Trigger for "евро лето огурцы"</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={platform}
            onValueChange={(v: any) => {
              setPlatform(v);
              // refresh webhook config for the new platform
              setTimeout(fetchWebhookConfig, 0);
            }}
          >
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
            onChange={(e) => setQty(parseInt(e.target.value || "1", 10))}
            placeholder="Quantity to decrease"
          />

          <Button onClick={handleTrigger} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Trigger Mock Purchase
          </Button>
        </CardContent>
      </Card>

      {/* webhook card */}
      <Card className="mb-6">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Webhook setup & test</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={fetchWebhookConfig} disabled={webhookLoading}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleSendTestWebhook} disabled={webhookLoading || !webhookUrl}>
              {webhookLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Send test
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="mb-3">
            <WebhookSetupButtons />
          </div>

          <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-12 md:col-span-9">
              <Input
                placeholder="https://hooks.example.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <div className="col-span-12 md:col-span-3 flex gap-2">
              <Button onClick={handleSaveWebhook} className="flex-1" disabled={webhookLoading}>
                Save
              </Button>
              <Button variant="ghost" onClick={handleCopyUrl} disabled={!webhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={webhookEnabled} onChange={(e) => setWebhookEnabled(e.target.checked)} className="h-4 w-4" />
              <span className="text-sm">Enabled</span>
            </label>

            <Input placeholder="secret (optional)" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} className="max-w-md" />
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Recent webhook events</div>
            {events.length === 0 ? (
              <div className="text-muted-foreground text-sm">No recent events</div>
            ) : (
              <div className="overflow-auto max-h-48 border rounded-md p-2 bg-muted">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payload (excerpt)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{new Date(ev.received_at || ev.ts || ev.created_at || Date.now()).toLocaleString()}</TableCell>
                        <TableCell>{ev.event_type || ev.type || "event"}</TableCell>
                        <TableCell className="max-w-xs truncate">{JSON.stringify(ev.payload || ev.body || {}).slice(0, 200)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* salary / summary / analyses cards (unchanged logic) */}
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

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate Daily Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGenerateSummary} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Generate & Copy Summary
          </Button>
          {summaryText && <div className="p-4 bg-muted rounded-md whitespace-pre-wrap text-sm">{summaryText}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analyses (Date Range)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <Button onClick={handleGetVelocity} disabled={loading} className="w-full">
            Get Sales Velocity
          </Button>
          {velocityData.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Avg Daily</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {velocityData.map((v, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{v.item_id}</TableCell>
                    <TableCell>{v.avg_daily}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Button onClick={handleGetForecast} disabled={loading} className="w-full">
            Get Forecast Depletion
          </Button>
          {forecastData.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Days to Zero</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastData.map((f, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{f.item_id}</TableCell>
                    <TableCell>{f.days_to_zero}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Button onClick={handleGetShare} disabled={loading} className="w-full">
            Get Platform Share
          </Button>
          {shareData.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Share %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shareData.map((s, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{s.platform}</TableCell>
                    <TableCell>{s.percentage}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}