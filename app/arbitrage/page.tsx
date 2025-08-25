"use client";

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import VibeContentRenderer from "@/components/VibeContentRenderer";

type MarketData = {
  exchange: string;
  symbol: string;
  bid_price: number;
  ask_price: number;
  last_price: number;
  volume: number;
  timestamp: string;
};

export default function ArbitrageAgentPage() {
  const [prices, setPrices] = useState<MarketData[]>([]);
  const [opps, setOpps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/fetch-dex-prices");
      if (res.data?.success) {
        toast.success("Prices fetched");
        setPrices(res.data.marketData || []);
      } else {
        // If existing route returns {success: true, count: N} we still call DB? fallback
        toast.success("Prices endpoint returned ok");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch prices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // simple opportunity detector: compare mid prices for same pair across exchanges
  const findOpportunities = useCallback(() => {
    const newOpps: any[] = [];
    const grouped: Record<string, MarketData[]> = {};
    for (const p of prices) {
      grouped[p.symbol] = grouped[p.symbol] || [];
      grouped[p.symbol].push(p);
    }
    for (const sym of Object.keys(grouped)) {
      const list = grouped[sym];
      if (list.length < 2) continue;
      const sorted = [...list].sort((a, b) => a.last_price - b.last_price);
      const low = sorted[0];
      const high = sorted[sorted.length - 1];
      const spread = ((high.last_price - low.last_price) / Math.min(high.last_price, low.last_price)) * 100;
      if (spread > 0.5) {
        newOpps.push({
          pair: sym,
          dexBuy: low.exchange,
          dexSell: high.exchange,
          spread: Number(spread.toFixed(4)),
          low,
          high,
        });
      }
    }
    setOpps(newOpps);
    toast.success(`Found ${newOpps.length} opportunities`);
  }, [prices]);

  const onQuote = async (opp: any) => {
    // client prepares basic payload and sends to server for quick quote
    const payload = {
      loanToken: { chainId: 1, address: "TON_FAKE_ADDRESS", decimals: 18, symbol: "TON" },
      loanAmount: "5", // example borrow 5 TON
      midPrice: 1, // for simplicity, assume 1 TON == 1 ETH (user should provide real)
      gasEstimateETH: 0.004,
      ethPriceInLoanToken: opp.low.last_price, // not exact, but we accept heuristic
      assumedProfitRatio: opp.spread / 100, // use spread as profit est.
    };
    try {
      const res = await axios.post("/api/arb/quote", payload);
      if (res.data.success) {
        toast.success(`Quote computed. NetProfit (loanToken units): ${res.data.netProfit.toFixed?.(4) ?? res.data.netProfit}`);
        // Save plan to show simulate button
        return res.data;
      } else {
        toast.error("Quote failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Quote error");
    }
  };

  const onSimulate = async (quoteResult: any) => {
    try {
      const plan = quoteResult.plan;
      const res = await axios.post("/api/arb/simulate", { plan, estimateProfitUSD: 10 });
      if (res.data.success) {
        toast.success(`Simulated. EstProfit: $${res.data.estimateProfitUSD}`);
      } else {
        toast.error("Simulation failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Simulate error");
    }
  };

  const onExecute = async (quoteResult: any) => {
    try {
      const plan = quoteResult.plan;
      const res = await axios.post("/api/arb/execute", { plan });
      if (res.data.success) {
        toast.success("Execute stub success (no tx sent in POC)");
      } else {
        toast.error("Execute failed");
      }
    } catch (e) {
      console.error(e);
      toast.error("Execute error");
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Arbitrage Agent — lightweight POC</h2>
      <div className="flex gap-2 mb-4">
        <Button onClick={fetchPrices} disabled={loading}>Refresh Prices</Button>
        <Button onClick={findOpportunities} disabled={prices.length === 0}>Find Opportunities</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Market Feed</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              {prices.length === 0 ? <div>No price rows (fetch first)</div> :
                prices.map((p, i) => (
                  <div key={i} className="border-b py-2">
                    <div className="text-sm font-medium">{p.symbol} — {p.exchange}</div>
                    <div className="text-xs">mid: {p.last_price} | bid {p.bid_price} | ask {p.ask_price}</div>
                  </div>
                ))
              }
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Opportunities</CardTitle></CardHeader>
          <CardContent>
            <ScrollArea className="h-56">
              {opps.length === 0 ? <div>No opportunities found</div> :
                opps.map((o, idx) => (
                  <div key={idx} className="p-2 border rounded mb-2">
                    <div><b>{o.pair}</b> Spread: {o.spread}%</div>
                    <div className="text-xs">Buy at {o.dexBuy} ({o.low.last_price}), sell at {o.dexSell} ({o.high.last_price})</div>
                    <div className="mt-2 flex gap-2">
                      <Button onClick={async () => {
                        const quote = await onQuote(o);
                        if (quote) onSimulate(quote);
                      }}>Quote & Simulate</Button>
                    </div>
                  </div>
                ))
              }
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}