"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import dynamic from 'next/dynamic'; // <<< NEW IMPORT
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { debugLogger as logger } from '@/lib/debugLogger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from "@/components/ui/slider";
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

// --- 3D Visualization Component (Using next/dynamic) ---
const ArbitrageVoxelPlotWithNoSSR = dynamic(
  () => {
    logger.debug("[SandboxPage] Attempting to DYNAMICALLY import ArbitrageVoxelPlot (ssr: false)...");
    return import('@/components/arbitrage/ArbitrageVoxelPlot');
  },
  { 
    ssr: false, // <<< CRUCIAL: Ensures component only renders on client-side
    loading: () => <LoadingVoxelPlotFallback />, // Keep the same fallback
  }
);

const LoadingVoxelPlotFallback = () => {
  logger.debug("[SandboxPage] Rendering LoadingVoxelPlotFallback for dynamic import.");
  return (
    <div className="p-4 border border-dashed border-brand-purple rounded-lg min-h-[400px] flex items-center justify-center bg-black/20">
      <div className="text-center">
        <VibeContentRenderer content="::FaSpinner className='text-5xl text-brand-purple mb-3 mx-auto animate-spin'::" />
        <p className="text-lg text-brand-cyan">Loading 3D Voxel Universe...</p>
      </div>
    </div>
  );
};

const formatNum = (num: number | undefined, digits = 2) => {
  if (typeof num === 'undefined') return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export interface ProcessedSandboxOpportunity extends ArbitrageOpportunity {
  x_reward: number;
  y_ezness: number;
  z_inv_effort: number;
  riskScore: number;
  rawEzness: number;
  rawEffort: number;
}

export default function ArbitrageVizSandboxPage() {
  logger.info("[SandboxPage] Component rendering/re-rendering.");
  const [testSettings, setTestSettings] = useState<ArbitrageSettings>({ ...DEFAULT_ARBITRAGE_SETTINGS });
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  // processedOpportunitiesForPlot state is removed, calculation moved to useMemo for filteredAndProcessedOpportunities
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // isClient state is no longer strictly needed for dynamic import with ssr:false, but can be kept for other client-only logic if any.
  // For simplicity with next/dynamic, we can rely on its SSR handling.
  // const [isClient, setIsClient] = useState(false);
  // useEffect(() => { setIsClient(true); }, []);


  const [rewardFilter, setRewardFilter] = useState<[number, number]>([0, 2]);
  const [eznessFilter, setEznessFilter] = useState<[number, number]>([0, 1]);
  const [effortFilter, setEffortFilter] = useState<[number, number]>([0, 1]);
  const [riskFilter, setRiskFilter] = useState<[number, number]>([0, 5]);

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

  const calculateEERR = useCallback((op: ArbitrageOpportunity): ProcessedSandboxOpportunity => {
    const rewardScore = op.profitPercentage;
    const rawEzness = 
      (Math.min(op.tradeVolumeUSD, 50000) / 50000) * 0.4 +
      (1 - Math.min((op as TwoLegArbitrageOpportunity).networkFeeUSD || 0, 50) / 50) * 0.4 +
      (op.type === '2-leg' ? 0.2 : 0.05);
    const rawEffort = 
      (Math.min(op.tradeVolumeUSD, 50000) / 50000) * 0.5 + 
      (op.type === '3-leg' ? 0.4 : 0.1) +
      (((op as TwoLegArbitrageOpportunity).buyFeePercentage || 0) + ((op as TwoLegArbitrageOpportunity).sellFeePercentage || 0)) / 200 * 0.1;
    const riskScore = parseFloat((rawEffort / (rawEzness > 0.01 ? rawEzness : 0.01)).toFixed(2));
    return {
      ...op, x_reward: rewardScore, y_ezness: rawEzness, 
      z_inv_effort: 1 / (rawEffort > 0.01 ? rawEffort : 0.01),
      riskScore: riskScore, rawEzness: rawEzness, rawEffort: rawEffort,
    };
  }, []);

  const filteredAndProcessedOpportunities = useMemo(() => {
    logger.debug("[SandboxPage] Memoizing filteredAndProcessedOpportunities. Raw opportunities count:", opportunities.length);
    const processed = opportunities.map(calculateEERR);
    const filtered = processed.filter(op => 
        op.x_reward >= rewardFilter[0] && op.x_reward <= rewardFilter[1] &&
        op.rawEzness >= eznessFilter[0] && op.rawEzness <= eznessFilter[1] &&
        op.rawEffort >= effortFilter[0] && op.rawEffort <= effortFilter[1] &&
        op.riskScore >= riskFilter[0] && op.riskScore <= riskFilter[1]
      );
    logger.debug(`[SandboxPage] Processed: ${processed.length}, Filtered: ${filtered.length}`);
    return filtered;
  }, [opportunities, calculateEERR, rewardFilter, eznessFilter, effortFilter, riskFilter]);

  const handleRunSimulation = useCallback(async () => {
    setIsLoading(true);
    setLogs(["Initiating sandbox simulation..."]);
    setOpportunities([]);
    logger.info("[SandboxPage] Running simulation with settings:", testSettings);
    try {
      const result = await fetchArbitrageOpportunitiesWithSettings(testSettings);
      setOpportunities(result.opportunities);
      setLogs(prev => [...prev, ...result.logs, `Simulation finished. Raw opportunities: ${result.opportunities.length}.`]);
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

  const LegendWTF = () => ( /* ... Legend component as before ... */ 
    <Card className="mt-6 bg-dark-card/70 border border-brand-yellow/40 p-3">
      <CardHeader className="p-2">
        <CardTitle className="text-brand-yellow font-orbitron text-lg flex items-center">
          <VibeContentRenderer content="::FaQuestionCircle className='mr-2'::" /> WTF is Going On Here? (Legend)
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-gray-300 space-y-1.5">
        <p><strong className="text-brand-cyan">Axes:</strong></p>
        <ul className="list-disc list-inside pl-2">
          <li><strong className="text-white">X (Reward):</strong> Profit Percentage (higher is better)</li>
          <li><strong className="text-white">Y (Ezness):</strong> Composite ease score (liquidity, low fees, 2-leg; higher is better)</li>
          <li><strong className="text-white">Z (1/Effort):</strong> Inverse effort score (capital, complexity; higher is better/less effort)</li>
        </ul>
        <p className="mt-2"><strong className="text-brand-cyan">Voxels (Opportunities):</strong></p>
        <ul className="list-disc list-inside pl-2">
          <li><strong className="text-white">Color (Risk Score = Effort / Ezness):</strong></li>
          <li className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#32CD32] mr-1.5 shrink-0"></div>Low Risk, Good Reward (Alpha!)</li>
          <li className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#FFD700] mr-1.5 shrink-0"></div>Moderate Risk/Reward</li>
          <li className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#1E90FF] mr-1.5 shrink-0"></div>Good Reward, Manageable Risk</li>
          <li className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#FF6347] mr-1.5 shrink-0"></div>High Risk</li>
          <li className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#A9A9A9] mr-1.5 shrink-0"></div>Very Low Reward</li>
          <li className="flex items-center"><div className="w-3 h-3 rounded-full bg-[#8A2BE2] mr-1.5 shrink-0"></div>Default / Mid-Risk</li>
          <li><strong className="text-white">Size:</strong> Proportional to Trade Volume (USD)</li>
        </ul>
        <p className="mt-2 text-gray-400"><i>Aim for <span className="text-brand-lime">Lime Green</span> voxels in the far positive corner!</i></p>
      </CardContent>
    </Card>
  );
  const FilterSlider: React.FC<{label: string, value: [number, number], onChange: (value: [number, number]) => void, min: number, max: number, step: number}> = ({label, value, onChange, min, max, step}) => ( <div className="space-y-1.5"> <Label className="text-xs font-semibold text-gray-300 flex justify-between"> <span>{label}</span> <span className="text-brand-yellow">{value[0].toFixed(2)} - {value[1].toFixed(2)}</span> </Label> <Slider value={value} onValueChange={(newValue) => onChange(newValue as [number, number])} min={min} max={max} step={step} className="[&>span:first-child]:h-1.5 [&>span>span]:bg-brand-pink [&>span>span]:h-1.5 [&>span>span]:w-1.5 [&>span>span]:border-2 [&>span>span]:border-background [&>span>span]:scale-150"/> </div> );


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-purple-900/30 text-foreground p-4 pt-24 pb-12 font-mono">
      <Card className="max-w-7xl mx-auto bg-black/80 backdrop-blur-lg border-2 border-brand-cyan/60 shadow-2xl shadow-brand-cyan/40">
        {/* ... CardHeader (same as before) ... */}
        <CardHeader className="text-center border-b border-brand-cyan/40 pb-4"> <VibeContentRenderer content="::FaFlaskVial className='text-5xl text-brand-cyan mx-auto mb-3 filter drop-shadow-[0_0_8px_hsl(var(--brand-cyan-rgb))]'::" /> <CardTitle className="text-3xl font-orbitron text-brand-cyan cyber-text glitch" data-text="ARBITRAGE VOXEL SANDBOX"> ARBITRAGE VOXEL SANDBOX </CardTitle> <CardDescription className="text-sm text-cyan-300/80 font-mono"> Experiment with simulated arbitrage opportunities and visualize the EERR latent space. </CardDescription> </CardHeader>
        <CardContent className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* ... Settings Panel (same as before, ensure FilterSlider is defined or imported) ... */}
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: "circOut" }} className="lg:col-span-1 space-y-3 p-3 bg-dark-card/60 border border-brand-purple/40 rounded-xl shadow-lg" > <h3 className="text-lg font-orbitron text-brand-purple mb-3 border-b border-brand-purple/30 pb-1.5"> <VibeContentRenderer content="::FaSliders className='inline mr-1.5'::" /> Simulation Settings </h3> <div className="space-y-1.5"> <Label htmlFor="minSpread" className="text-xs font-semibold text-gray-300">Min Spread (%)</Label> <Input id="minSpread" type="number" step="0.01" value={testSettings.minSpreadPercent} onChange={(e) => handleSettingsChange('minSpreadPercent', parseFloat(e.target.value) || 0)} className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple"/> </div> <div className="space-y-1.5"> <Label htmlFor="tradeVolume" className="text-xs font-semibold text-gray-300">Trade Volume (USD)</Label> <Input id="tradeVolume" type="number" step="50" value={testSettings.defaultTradeVolumeUSD} onChange={(e) => handleSettingsChange('defaultTradeVolumeUSD', parseInt(e.target.value, 10) || 0)} className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple"/> </div> <div className="space-y-2"> <Label className="text-xs font-semibold text-gray-300 block mb-1.5">Enabled Exchanges</Label> <ScrollArea className="h-[150px] border border-brand-purple/30 rounded-md p-1.5 bg-black/30 simple-scrollbar"> <div className="grid grid-cols-1 gap-1 text-xs"> {ALL_POSSIBLE_EXCHANGES_CONST.map(ex => ( <div key={ex} className="flex items-center space-x-1.5 p-1 hover:bg-brand-purple/10 rounded"> <Checkbox id={`ex-${ex}`} checked={testSettings.enabledExchanges?.includes(ex) ?? false} onCheckedChange={() => handleExchangeToggle(ex)} className="border-brand-purple data-[state=checked]:bg-brand-purple scale-90"/> <Label htmlFor={`ex-${ex}`} className="text-gray-300 cursor-pointer flex-1 text-[0.7rem]">{ex}</Label> </div> ))} </div> </ScrollArea> </div> <div className="space-y-1.5"> <Label htmlFor="trackedPairs" className="text-xs font-semibold text-gray-300">Tracked Pairs (CSV)</Label> <Input id="trackedPairs" type="text" value={testSettings.trackedPairs?.join(',') ?? ''} onChange={(e) => handleSettingsChange('trackedPairs', e.target.value.split(',').map(p => p.trim().toUpperCase()).filter(p => p))} className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple" placeholder="BTC/USDT,ETH/BTC"/> </div> <Button onClick={handleRunSimulation} disabled={isLoading} className="w-full bg-brand-orange text-black hover:bg-yellow-400 font-orbitron mt-2 py-2 text-sm shadow-md hover:shadow-orange-glow"> {isLoading ? <VibeContentRenderer content="::FaCog className='animate-spin mr-1.5'::" /> : <VibeContentRenderer content="::FaPlay className='mr-1.5'::" />} {isLoading ? "Simulating..." : "Run Simulation"} </Button> <h3 className="text-lg font-orbitron text-brand-pink pt-3 mt-3 mb-2 border-t border-brand-purple/30 pb-1.5"> <VibeContentRenderer content="::FaFilter className='inline mr-1.5'::" /> Display Filters </h3> <FilterSlider label="Reward Filter (%)" value={rewardFilter} onChange={setRewardFilter} min={-1} max={5} step={0.1} /> <FilterSlider label="Ezness Filter" value={eznessFilter} onChange={setEznessFilter} min={0} max={1.2} step={0.05} /> <FilterSlider label="Effort Filter" value={effortFilter} onChange={setEffortFilter} min={0} max={1.2} step={0.05} /> <FilterSlider label="Risk Filter" value={riskFilter} onChange={setRiskFilter} min={0} max={10} step={0.1} /> </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: "circOut" }}
            className="lg:col-span-3"
          >
            <Tabs defaultValue="visualization" className="w-full">
              {/* ... TabsList (same as before) ... */}
              <TabsList className="grid w-full grid-cols-3 bg-black/60 border border-brand-blue/50 backdrop-blur-sm"> <TabsTrigger value="visualization" className="font-orbitron text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow"> <VibeContentRenderer content="::FaChartBar className='mr-1.5'::"/>Visualization ({filteredAndProcessedOpportunities.length}) </TabsTrigger> <TabsTrigger value="rawData" className="font-orbitron text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow"> <VibeContentRenderer content="::FaListAlt className='mr-1.5'::"/>Raw Data ({opportunities.length}) </TabsTrigger> <TabsTrigger value="logs" className="font-orbitron text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow"> <VibeContentRenderer content="::FaTerminal className='mr-1.5'::"/>Logs </TabsTrigger> </TabsList>
              <TabsContent value="visualization" className="mt-4 p-1 bg-dark-card/30 border border-brand-blue/30 rounded-lg shadow-inner min-h-[620px]">
                 <ArbitrageVoxelPlotWithNoSSR opportunities={filteredAndProcessedOpportunities} /> {/* Use the dynamically imported component */}
              </TabsContent>
              {/* ... RawData and Logs TabsContent (same as before) ... */}
              <TabsContent value="rawData" className="mt-4 p-1"> <ScrollArea className="h-[600px] border border-brand-blue/30 rounded-lg bg-dark-card/30 p-3 simple-scrollbar"> {opportunities.length > 0 ? ( opportunities.map(op => ( <Card key={op.id} className="mb-3 bg-dark-bg/70 border-brand-purple/30 text-xs shadow-sm hover:border-brand-purple transition-colors"> <CardHeader className="p-2.5"> <CardTitle className={`text-sm font-semibold ${op.profitPercentage > (testSettings.minSpreadPercent + 0.2) ? 'text-brand-lime' : op.profitPercentage > testSettings.minSpreadPercent ? 'text-brand-yellow' : 'text-brand-orange'}`}> {op.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsLeftRight className='inline mr-1.5'::"/> : <VibeContentRenderer content="::FaRandom className='inline mr-1.5'::"/>} {op.type === '2-leg' ? ` ${op.currencyPair} (${(op as TwoLegArbitrageOpportunity).buyExchange} → ${(op as TwoLegArbitrageOpportunity).sellExchange})` : ` ${op.currencyPair} (${(op as ThreeLegArbitrageOpportunity).exchange})`} </CardTitle> <CardDescription className="text-gray-400 text-[0.7rem] pt-0.5">ID: {op.id.substring(0,8)}</CardDescription> </CardHeader> <CardContent className="p-2.5 pt-0 space-y-0.5"> <p>Spread: <strong className="text-white">{formatNum(op.profitPercentage, 3)}%</strong></p> <p>Profit (USD): <strong className="text-white">${formatNum(op.potentialProfitUSD)}</strong> (on ${formatNum(op.tradeVolumeUSD,0)} vol)</p> <p className="text-gray-400 text-[0.7rem] break-all">Details: {op.details}</p> {op.type === '2-leg' && <p className="text-gray-500 text-[0.65rem]">Net Fee: ${formatNum((op as TwoLegArbitrageOpportunity).networkFeeUSD)} | Buy: {(op as TwoLegArbitrageOpportunity).buyPrice.toFixed(4)} | Sell: {(op as TwoLegArbitrageOpportunity).sellPrice.toFixed(4)}</p>} </CardContent> </Card> )) ) : ( <p className="text-center text-muted-foreground py-12">No opportunities generated with current settings.</p> )} </ScrollArea> </TabsContent> <TabsContent value="logs" className="mt-4 p-1"> <ScrollArea className="h-[600px] border border-brand-blue/30 rounded-lg bg-dark-card/30 p-3 simple-scrollbar"> <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all"> {logs.join('\n')} </pre> </ScrollArea> </TabsContent>
            </Tabs>
            <LegendWTF />
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
