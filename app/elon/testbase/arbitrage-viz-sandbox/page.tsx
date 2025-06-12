"use client";

import React, { useState, useEffect, useCallback, Suspense } from 'react'; // Suspense is key
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { logger } from '@/lib/logger';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  fetchArbitrageOpportunitiesWithSettings,
} from '@/app/elon/testbase/sandbox_actions';
import type {
  ArbitrageOpportunity,
  ArbitrageSettings,
  ExchangeName,
  TwoLegArbitrageOpportunity,
  ThreeLegArbitrageOpportunity,
} from '@/app/elon/arbitrage_scanner_types';
import {
  DEFAULT_ARBITRAGE_SETTINGS,
  ALL_POSSIBLE_EXCHANGES_CONST,
} from '@/app/elon/arbitrage_scanner_types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// --- 3D Visualization Component (Lazy Loaded) ---
// Ensure the path is correct and the component default exports correctly
const ArbitrageVoxelPlot = React.lazy(() => import('@/components/arbitrage/ArbitrageVoxelPlot'));

const LoadingVoxelPlotFallback = () => (
  <div className="p-4 border border-dashed border-brand-purple rounded-lg min-h-[400px] flex items-center justify-center bg-black/20">
    <div className="text-center">
      <VibeContentRenderer content="::FaSpinner className='text-5xl text-brand-purple mb-3 mx-auto animate-spin'::" />
      <p className="text-lg text-brand-cyan">Loading 3D Voxel Plot...</p>
    </div>
  </div>
);

const formatNum = (num: number | undefined, digits = 2) => {
  if (typeof num === 'undefined') return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export default function ArbitrageVizSandboxPage() {
  const [testSettings, setTestSettings] = useState<ArbitrageSettings>({ ...DEFAULT_ARBITRAGE_SETTINGS });
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false); // Used to ensure React.lazy works only client-side

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleSettingsChange = (field: keyof ArbitrageSettings, value: any) => {
    setTestSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleExchangeToggle = (exchangeName: ExchangeName) => {
    setTestSettings(prev => {
      const currentEnabledExchanges = prev.enabledExchanges || [];
      const newEnabledExchanges = currentEnabledExchanges.includes(exchangeName)
        ? currentEnabledExchanges.filter(ex => ex !== exchangeName)
        : [...currentEnabledExchanges, exchangeName];
      return { ...prev, enabledExchanges: newEnabledExchanges };
    });
  };

  const handleRunSimulation = useCallback(async () => {
    setIsLoading(true);
    setLogs(["Initiating sandbox simulation..."]);
    setOpportunities([]);
    logger.info("[SandboxPage] Running simulation with settings:", testSettings);
    try {
      const result = await fetchArbitrageOpportunitiesWithSettings(testSettings);
      setOpportunities(result.opportunities);
      setLogs(prev => [...prev, ...result.logs, `Simulation finished. Found ${result.opportunities.length} opportunities.`]);
      logger.info("[SandboxPage] Simulation result:", result);
    } catch (error) {
      logger.error("Error in sandbox simulation (handleRunSimulation):", error);
      setLogs(prev => [...prev, `CLIENT-SIDE ERROR: ${error instanceof Error ? error.message : String(error)}`]);
    }
    setIsLoading(false);
  }, [testSettings]);

  useEffect(() => {
    logger.info("[SandboxPage] Initial mount, running simulation with default settings.");
    handleRunSimulation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900/30 text-foreground p-4 pt-24 pb-12 font-mono">
      <Card className="max-w-7xl mx-auto bg-black/80 backdrop-blur-lg border-2 border-brand-cyan/60 shadow-2xl shadow-brand-cyan/40">
        <CardHeader className="text-center border-b border-brand-cyan/40 pb-4">
          <VibeContentRenderer content="::FaFlaskVial className='text-5xl text-brand-cyan mx-auto mb-3 filter drop-shadow-[0_0_8px_hsl(var(--brand-cyan-rgb))]'::" />
          <CardTitle className="text-3xl font-orbitron text-brand-cyan cyber-text glitch" data-text="ARBITRAGE VOXEL SANDBOX">
            ARBITRAGE VOXEL SANDBOX
          </CardTitle>
          <CardDescription className="text-sm text-cyan-300/80 font-mono">
            Experiment with simulated arbitrage opportunities and visualize the EERR latent space.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "circOut" }}
            className="lg:col-span-1 space-y-4 p-4 bg-dark-card/60 border border-brand-purple/40 rounded-xl shadow-lg"
          >
            <h3 className="text-xl font-orbitron text-brand-purple mb-4 border-b border-brand-purple/30 pb-2">
                <VibeContentRenderer content="::FaSliders className='inline mr-2'::" />
                Test Simulation Settings
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="minSpread" className="text-xs font-semibold text-gray-300">Min Spread (%)</Label>
              <Input
                id="minSpread" type="number" step="0.01"
                value={testSettings.minSpreadPercent}
                onChange={(e) => handleSettingsChange('minSpreadPercent', parseFloat(e.target.value) || 0)}
                className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tradeVolume" className="text-xs font-semibold text-gray-300">Trade Volume (USD)</Label>
              <Input
                id="tradeVolume" type="number" step="50"
                value={testSettings.defaultTradeVolumeUSD}
                onChange={(e) => handleSettingsChange('defaultTradeVolumeUSD', parseInt(e.target.value, 10) || 0)}
                className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-300 block mb-1.5">Enabled Exchanges (Simulation)</Label>
              <ScrollArea className="h-[180px] border border-brand-purple/30 rounded-md p-2 bg-black/30 simple-scrollbar">
                <div className="grid grid-cols-1 gap-1.5 text-xs">
                  {ALL_POSSIBLE_EXCHANGES_CONST.map(ex => (
                    <div key={ex} className="flex items-center space-x-2 p-1.5 hover:bg-brand-purple/10 rounded">
                      <Checkbox
                        id={`ex-${ex}`}
                        checked={testSettings.enabledExchanges?.includes(ex) ?? false} // Ensure enabledExchanges is not undefined
                        onCheckedChange={() => handleExchangeToggle(ex)}
                        className="border-brand-purple data-[state=checked]:bg-brand-purple data-[state=checked]:text-black scale-90"
                      />
                      <Label htmlFor={`ex-${ex}`} className="text-gray-300 cursor-pointer flex-1">{ex}</Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trackedPairs" className="text-xs font-semibold text-gray-300">Tracked Pairs (comma-separated)</Label>
              <Input
                id="trackedPairs" type="text"
                value={testSettings.trackedPairs?.join(',') ?? ''} // Ensure trackedPairs is not undefined
                onChange={(e) => handleSettingsChange('trackedPairs', e.target.value.split(',').map(p => p.trim().toUpperCase()).filter(p => p))}
                className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple"
                placeholder="BTC/USDT,ETH/BTC"
              />
            </div>
            <Button onClick={handleRunSimulation} disabled={isLoading} className="w-full bg-brand-orange text-black hover:bg-yellow-400 font-orbitron mt-3 py-2.5 text-base shadow-md hover:shadow-orange-glow">
              {isLoading ? <VibeContentRenderer content="::FaCog className='animate-spin mr-2'::" /> : <VibeContentRenderer content="::FaPlay className='mr-2'::" />}
              {isLoading ? "Simulating..." : "Run Simulation"}
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "circOut" }}
            className="lg:col-span-3"
          >
            <Tabs defaultValue="visualization" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-black/60 border border-brand-blue/50 backdrop-blur-sm">
                <TabsTrigger value="visualization" className="font-orbitron text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow">
                    <VibeContentRenderer content="::FaChartBar className='mr-1.5'::"/>Visualization
                </TabsTrigger>
                <TabsTrigger value="rawData" className="font-orbitron text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow">
                    <VibeContentRenderer content="::FaListAlt className='mr-1.5'::"/>Raw Data ({opportunities.length})
                </TabsTrigger>
                <TabsTrigger value="logs" className="font-orbitron text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow">
                    <VibeContentRenderer content="::FaTerminal className='mr-1.5'::"/>Logs
                </TabsTrigger>
              </TabsList>
              <TabsContent value="visualization" className="mt-4 p-1 bg-dark-card/30 border border-brand-blue/30 rounded-lg shadow-inner">
                {isClient ? ( // Only render Suspense and lazy component on the client
                    <Suspense fallback={<LoadingVoxelPlotFallback />}>
                        <ArbitrageVoxelPlot opportunities={opportunities} />
                    </Suspense>
                ) : (
                    <LoadingVoxelPlotFallback /> // Render fallback on server or before client mount
                )}
              </TabsContent>
              <TabsContent value="rawData" className="mt-4 p-1">
                <ScrollArea className="h-[600px] border border-brand-blue/30 rounded-lg bg-dark-card/30 p-3 simple-scrollbar">
                  {opportunities.length > 0 ? (
                    opportunities.map(op => (
                      <Card key={op.id} className="mb-3 bg-dark-bg/70 border-brand-purple/30 text-xs shadow-sm hover:border-brand-purple transition-colors">
                        <CardHeader className="p-2.5">
                          <CardTitle className={`text-sm font-semibold ${op.profitPercentage > (testSettings.minSpreadPercent + 0.2) ? 'text-brand-lime' : op.profitPercentage > testSettings.minSpreadPercent ? 'text-brand-yellow' : 'text-brand-orange'}`}>
                            {op.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsLeftRight className='inline mr-1.5'::"/> : <VibeContentRenderer content="::FaRandom className='inline mr-1.5'::"/>}
                            {op.type === '2-leg' ? ` ${op.currencyPair} (${(op as TwoLegArbitrageOpportunity).buyExchange} → ${(op as TwoLegArbitrageOpportunity).sellExchange})` : ` ${op.currencyPair} (${(op as ThreeLegArbitrageOpportunity).exchange})`}
                          </CardTitle>
                           <CardDescription className="text-gray-400 text-[0.7rem] pt-0.5">ID: {op.id.substring(0,8)}</CardDescription>
                        </CardHeader>
                        <CardContent className="p-2.5 pt-0 space-y-0.5">
                          <p>Spread: <strong className="text-white">{formatNum(op.profitPercentage, 3)}%</strong></p>
                          <p>Profit (USD): <strong className="text-white">${formatNum(op.potentialProfitUSD)}</strong> (on ${formatNum(op.tradeVolumeUSD,0)} vol)</p>
                          <p className="text-gray-400 text-[0.7rem] break-all">Details: {op.details}</p>
                          {op.type === '2-leg' && <p className="text-gray-500 text-[0.65rem]">Net Fee: ${formatNum((op as TwoLegArbitrageOpportunity).networkFeeUSD)} | Buy: {(op as TwoLegArbitrageOpportunity).buyPrice.toFixed(4)} | Sell: {(op as TwoLegArbitrageOpportunity).sellPrice.toFixed(4)}</p>}
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No opportunities generated with current settings.</p>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="logs" className="mt-4 p-1">
                <ScrollArea className="h-[600px] border border-brand-blue/30 rounded-lg bg-dark-card/30 p-3 simple-scrollbar">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
                    {logs.join('\n')}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}