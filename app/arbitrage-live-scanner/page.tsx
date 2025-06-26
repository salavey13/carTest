"use client";

import React, { useState, useCallback, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { useAppContext } from '@/contexts/AppContext';
import { supabaseAdmin } from '@/hooks/supabase';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

// --- Client-Side Crypto & Fetching Utilities ---

// Native Web Crypto API for HMAC-SHA256 signature
async function createHmacSha256Signature(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Client-side fetcher for Bybit (authenticated)
async function fetchBybitClientSide(apiKey: string, apiSecret: string, symbol: string) {
    const host = "https://api.bybit.com"; // Use the main domain, proxies can be tricky
    const path = "/v5/market/tickers";
    const queryString = `category=spot&symbol=${symbol}`;
    const timestamp = Date.now().toString();
    const recvWindow = "10000";
    
    const toSign = timestamp + apiKey + recvWindow + queryString;
    const signature = await createHmacSha256Signature(apiSecret, toSign);

    const response = await fetch(`${host}${path}?${queryString}`, {
        headers: { 'X-BAPI-API-KEY': apiKey, 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': recvWindow, 'X-BAPI-SIGN': signature }
    });

    const data = await response.json();
    if (!response.ok || data.retCode !== 0) {
        throw new Error(`Bybit error for ${symbol}: ${data.retMsg || `Status ${response.status}`}`);
    }
    return data.result.list[0];
}

// Main Component
const ArbitrageLiveScannerPage = () => {
  const { isAdmin } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = `[${new Date().toLocaleTimeString()}]`;
    setLogs(prev => [`${timestamp} ${message}`, ...prev].slice(0, 50));
  }, []);

  const handleFetch = async () => {
    setIsLoading(true);
    setResults([]);
    addLog("Initiating client-side fetch sequence...");
    
    if (!supabaseAdmin) {
        toast.error("Supabase client not available.");
        addLog("ERROR: Supabase client not available.");
        setIsLoading(false);
        return;
    }

    try {
      addLog("Calling 'get-api-keys' function...");
      const { data: keyData, error: keyError } = await supabaseAdmin.functions.invoke('get-api-keys');
      
      if (keyError || !keyData.success) {
        throw new Error(keyError?.message || keyData.error || "Failed to fetch API keys.");
      }
      addLog("Successfully retrieved API keys from vault.");
      
      const bybitApiKey = keyData.keys.bybit.apiKey;
      const bybitApiSecret = keyData.keys.bybit.apiSecret;

      if (!bybitApiKey || !bybitApiSecret) {
        throw new Error("Bybit API Key or Secret not found in response.");
      }

      addLog("Fetching from Bybit with retrieved keys (client-side)...");
      const bybitResult = await fetchBybitClientSide(bybitApiKey, bybitApiSecret, 'BTCUSDT');
      
      const finalResults = [{ exchange: 'Bybit', ...bybitResult }];
      setResults(finalResults);
      addLog(`Fetch complete. Received data from Bybit.`);
      toast.success("Live data fetched successfully!");

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "An unknown error occurred.";
      addLog(`ERROR: ${errorMsg}`);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) return <div className="p-8 text-center text-red-500 font-orbitron">ACCESS DENIED</div>;

  return (
    <div className="min-h-screen bg-gray-950 p-4 pt-24 font-mono text-gray-200">
      <Card className="max-w-4xl mx-auto bg-black/70 border-2 border-brand-orange/50 shadow-2xl shadow-brand-orange/30 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-4xl font-orbitron text-brand-orange cyber-text glitch" data-text="LIVE SEEKER">LIVE SEEKER</CardTitle>
          <CardDescription className="text-orange-300/80">Client-side data fetching using vaulted, user-authenticated API keys.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button onClick={handleFetch} disabled={isLoading} className="w-full bg-brand-orange text-black font-bold text-lg hover:bg-orange-400 shadow-lg hover:shadow-orange-glow">
            {isLoading ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-2'::" /> : <VibeContentRenderer content="::FaSearchDollar className='mr-2'::" />}
            {isLoading ? "SEEKING ALPHA..." : "SEEK ALPHA NOW"}
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-brand-lime">Live Results:</h3>
                <AnimatePresence>
                {results.map((res, i) => (
                    <motion.div key={i} initial={{opacity: 0, x: -20}} animate={{opacity: 1, x: 0}} transition={{delay: i * 0.1}}>
                        <pre className="text-xs bg-gray-900 p-3 rounded-md overflow-x-auto simple-scrollbar">{JSON.stringify(res, null, 2)}</pre>
                    </motion.div>
                ))}
                </AnimatePresence>
                 {results.length === 0 && !isLoading && <p className="text-xs text-gray-500 italic">No data yet. Press the button to seek.</p>}
              </div>
              <div className="space-y-2">
                  <h3 className="font-bold text-lg text-brand-yellow">Log:</h3>
                  <div className="bg-black p-3 rounded-md h-60 overflow-y-auto simple-scrollbar flex flex-col-reverse">
                      <AnimatePresence>
                          {logs.map((log, index) => (
                              <motion.p key={index} initial={{opacity: 0}} animate={{opacity: 1}} className="text-xs text-gray-400 border-b border-gray-800 py-1">{log}</motion.p>
                          ))}
                      </AnimatePresence>
                  </div>
              </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default function LiveScannerPageWrapper() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ArbitrageLiveScannerPage />
        </Suspense>
    )
}
