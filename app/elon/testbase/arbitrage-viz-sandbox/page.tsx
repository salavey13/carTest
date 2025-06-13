"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { debugLogger as logger } from '@/lib/debugLogger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InputWithSteppers } from '@/components/ui/InputWithSteppers';
import { Input } from '@/components/ui/input';
import { useAppToast } from "@/hooks/useAppToast";
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
import { useTradeSimulator } from '@/hooks/useTradeSimulator';
import { GameyOfferCard } from '@/components/arbitrage/GameyOfferCard';

const ArbitrageVoxelPlotWithNoSSR = dynamic(
  () => import('@/components/arbitrage/ArbitrageVoxelPlot'),
  { 
    ssr: false,
    loading: () => <LoadingVoxelPlotFallback />,
  }
);

const LoadingVoxelPlotFallback = () => { logger.debug("[SandboxPage] Rendering LoadingVoxelPlotFallback."); return ( <div className="p-4 border border-dashed border-brand-purple rounded-lg min-h-[400px] flex items-center justify-center bg-card/5 dark:bg-black/20"> <div className="text-center"> <VibeContentRenderer content="::FaSpinner className='text-5xl text-brand-purple mb-3 mx-auto animate-spin'::" /> <p className="text-lg text-brand-cyan">Loading 3D Voxel Universe...</p> </div> </div> );};
const formatNum = (num: number | undefined, digits = 2) => { if (typeof num === 'undefined') return 'N/A'; return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });};
export interface ProcessedSandboxOpportunity extends ArbitrageOpportunity { x_reward: number; y_ezness: number; z_inv_effort: number; riskScore: number; rawEzness: number; rawEffort: number; colorValue: string; sizeValue: number;}

const LegendWTF: React.FC<{onSimulateTrade: () => void, isSimulateDisabled: boolean}> = ({ onSimulateTrade, isSimulateDisabled }) => ( 
    <Card className="mt-6 bg-card/90 dark:bg-dark-card/80 border border-border dark:border-brand-yellow/50 p-3 shadow-lg"> 
        <CardHeader className="p-2 pt-1"> <CardTitle className="text-primary dark:text-brand-yellow font-orbitron text-base md:text-lg flex items-center"> <VibeContentRenderer content="::FaCircleQuestion className='mr-2 text-primary dark:text-yellow-400'::" /> WTF is Going On Here? (Legend) </CardTitle> </CardHeader> 
        <CardContent className="text-xs text-foreground/90 dark:text-gray-300 space-y-1.5"> 
            <p><strong className="text-primary/80 dark:text-brand-cyan">Axes:</strong></p> 
            <ul className="list-disc list-inside pl-3 space-y-0.5"> 
                <li><strong className="text-red-600 dark:text-red-400">X (Reward):</strong> Profit % <VibeContentRenderer content="::FaArrowRight className='inline ml-1 text-red-400/70'::"/></li> 
                <li><strong className="text-green-600 dark:text-lime-400">Y (Ezness):</strong> Ease score <VibeContentRenderer content="::FaArrowUp className='inline ml-1 text-lime-400/70'::"/></li> 
                <li><strong className="text-blue-600 dark:text-blue-400">Z (1/Effort):</strong> Inverse effort <VibeContentRenderer content="::FaExpand className='inline ml-1 text-blue-400/70'::"/></li> 
            </ul> 
            <p className="mt-2"><strong className="text-primary/80 dark:text-brand-cyan">Cubes (Opportunities):</strong></p> 
            <ul className="list-disc list-inside pl-3 space-y-0.5"> 
                <li><strong className="text-foreground dark:text-white">Color (Risk Score = Effort / Ezness):</strong></li> 
                <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#32CD32] mr-1.5 shrink-0 border border-black/20"></div>Low Risk, Good Reward (Alpha!)</li> 
                <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#FFD700] mr-1.5 shrink-0 border border-black/20"></div>Moderate Risk/Reward</li> 
                <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#1E90FF] mr-1.5 shrink-0 border border-black/20"></div>Good Reward, Manageable Risk</li> 
                <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#FF6347] mr-1.5 shrink-0 border border-black/20"></div>High Risk</li> <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#A9A9A9] mr-1.5 shrink-0 border border-black/20"></div>Very Low Reward</li> 
                <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#8A2BE2] mr-1.5 shrink-0 border border-black/20"></div>Default / Mid-Risk</li> 
                <li><strong className="text-foreground dark:text-white">Size:</strong> Proportional to Trade Volume (USD)</li> 
            </ul> 
            <p className="mt-2 text-muted-foreground italic">Aim for <span className="text-brand-lime font-semibold">Lime Green</span> cubes in the far positive corner (high X, Y, Z)!</p> 
            <div className="mt-3 pt-2 border-t border-border dark:border-brand-yellow/20">
                <Button onClick={onSimulateTrade} disabled={isSimulateDisabled} size="sm" variant="outline" className="text-xs border-brand-yellow/70 text-brand-yellow hover:bg-brand-yellow/10 w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent">
                    <VibeContentRenderer content="::FaDiceD20 className='mr-1.5'::" /> 
                    {isSimulateDisabled ? "Select a cube to simulate trade" : "Simulate This Trade!"}
                </Button>
            </div>
        </CardContent> 
    </Card> 
);

export default function ArbitrageVizSandboxPage() {
  logger.info("[SandboxPage] Rendering (Voxel Rebirth).");
  const { addToast } = useAppToast();
  const { dbUser, refreshDbUser } = useAppContext();
  const [testSettings, setTestSettings] = useState<ArbitrageSettings>({ ...DEFAULT_ARBITRAGE_SETTINGS });
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("visualization");
  const [selectedOpportunity, setSelectedOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);

  const [rewardFilter, setRewardFilter] = useState<[number, number]>([DEFAULT_ARBITRAGE_SETTINGS.minSpreadPercent - 0.2, 5]);
  const [eznessFilter, setEznessFilter] = useState<[number, number]>([0.1, 1.0]);
  const [effortFilter, setEffortFilter] = useState<[number, number]>([0.1, 1.0]);
  const [riskFilter, setRiskFilter] = useState<[number, number]>([0, 10]);

  const { isSimulating, simulateTrade, generatedBullshitOffer } = useTradeSimulator({ onTradeComplete: refreshDbUser });

  const calculateEERR = useCallback((op: ArbitrageOpportunity): ProcessedSandboxOpportunity => { const rewardScore = op.profitPercentage; const networkFeeFactor = 1 - Math.min((op as TwoLegArbitrageOpportunity).networkFeeUSD || 0, 50) / 50; const volumeFactor = Math.min(op.tradeVolumeUSD, 50000) / 50000; const typeFactorEz = op.type === '2-leg' ? 0.2 : 0.05; const typeFactorEffort = op.type === '3-leg' ? 0.4 : 0.1; const feesPercentageFactor = (((op as TwoLegArbitrageOpportunity).buyFeePercentage || 0) + ((op as TwoLegArbitrageOpportunity).sellFeePercentage || 0)) / 200; const rawEzness = volumeFactor * 0.4 + networkFeeFactor * 0.4 + typeFactorEz; const rawEffort = volumeFactor * 0.5 + typeFactorEffort + feesPercentageFactor * 0.1; const riskScore = parseFloat((rawEffort / (rawEzness > 0.01 ? rawEzness : 0.01)).toFixed(2)); let color = '#8A2BE2'; if (rewardScore < 0.1) color = '#A9A9A9'; else if (riskScore < 1.0 && rewardScore > 0.3) color = '#32CD32'; else if (riskScore < 2.0 && rewardScore > 0.2) color = '#FFD700'; else if (riskScore > 3.0) color = '#FF6347'; else if (rewardScore > 0.5 && riskScore <= 2.5) color = '#1E90FF'; const size = Math.max(0.05, Math.min(0.8, op.tradeVolumeUSD / 15000 + 0.1)); return { ...op, x_reward: rewardScore, y_ezness: rawEzness,  z_inv_effort: 1 / (rawEffort > 0.01 ? rawEffort : 0.01), riskScore, rawEzness, rawEffort, colorValue: color, sizeValue: size }; }, []);
  const filteredAndProcessedOpportunities = useMemo(() => { const processed = opportunities.map(calculateEERR); const filtered = processed.filter(op =>  op.x_reward >= rewardFilter[0] && op.x_reward <= rewardFilter[1] && op.rawEzness >= eznessFilter[0] && op.rawEzness <= eznessFilter[1] && op.rawEffort >= effortFilter[0] && op.rawEffort <= effortFilter[1] && op.riskScore >= riskFilter[0] && op.riskScore <= riskFilter[1] ); logger.debug(`[SandboxPage] EERR Filtered. Raw: ${opportunities.length}, Processed: ${processed.length}, Filtered for plot: ${filtered.length}`); return filtered; }, [opportunities, calculateEERR, rewardFilter, eznessFilter, effortFilter, riskFilter]);
  const handleRunSimulation = useCallback(async () => { setIsLoading(true); setLogs(["Initiating sandbox simulation..."]); setOpportunities([]); try { const result = await fetchArbitrageOpportunitiesWithSettings(testSettings); setOpportunities(result.opportunities); setLogs(prev => [...prev, ...result.logs, `Simulation finished. Raw opportunities: ${result.opportunities.length}.`]); } catch (error) { logger.error("Error in sandbox simulation:", error); setLogs(prev => [...prev, `CLIENT-SIDE ERROR: ${error instanceof Error ? error.message : String(error)}`]); } setIsLoading(false); }, [testSettings]);
  useEffect(() => { handleRunSimulation(); }, [handleRunSimulation]); 
  const handleSettingsChange = (field: keyof ArbitrageSettings, value: any) => { setTestSettings(prev => ({ ...prev, [field]: value })); };
  const handleExchangeToggle = (exchangeName: ExchangeName) => { setTestSettings(prev => { const currentEnabledExchanges = prev.enabledExchanges || []; const newEnabledExchanges = currentEnabledExchanges.includes(exchangeName) ? currentEnabledExchanges.filter(ex => ex !== exchangeName) : [...currentEnabledExchanges, exchangeName]; return { ...prev, enabledExchanges: newEnabledExchanges }; }); };
  const handleVoxelSelection = useCallback((opportunity: ProcessedSandboxOpportunity | null) => { setSelectedOpportunity(opportunity); }, []);
  const handleSimulateTrade = useCallback(() => {
    if (!selectedOpportunity || !dbUser?.user_id) {
        addToast("No opportunity selected!", "warning", { description: "Click a cube in the visualization to select it first."});
        return;
    }
    simulateTrade(dbUser.user_id, selectedOpportunity);
  }, [selectedOpportunity, dbUser?.user_id, simulateTrade, addToast]);
  
  return (
    <div className="min-h-screen bg-page-gradient text-foreground p-4 pt-24 pb-12 font-mono">
      <Card className="max-w-7xl mx-auto bg-card/80 dark:bg-black/85 backdrop-blur-xl border-2 border-primary/30 dark:border-brand-cyan/70 shadow-2xl dark:shadow-brand-cyan/40">
        <CardHeader className="text-center border-b border-border dark:border-brand-cyan/40 pb-4"> <VibeContentRenderer content="::FaFlaskVial className='text-5xl text-primary dark:text-brand-cyan mx-auto mb-3 filter drop-shadow-[0_0_10px_hsl(var(--brand-cyan-rgb))]'::" /> <CardTitle className="text-3xl font-orbitron text-primary dark:text-brand-cyan cyber-text glitch" data-text="ARBITRAGE VOXEL SANDBOX"> ARBITRAGE VOXEL SANDBOX </CardTitle> <CardDescription className="text-sm text-muted-foreground font-mono"> Experiment with simulated arbitrage opportunities and visualize the EERR latent space. </CardDescription> </CardHeader>
        <CardContent className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: "circOut" }} className="lg:col-span-1 space-y-4 p-3 bg-card dark:bg-dark-card/70 border border-border dark:border-brand-purple/50 rounded-xl shadow-lg"> 
            <h3 className="text-lg font-orbitron text-primary dark:text-brand-purple mb-3 border-b border-border dark:border-brand-purple/30 pb-1.5 flex items-center"> <VibeContentRenderer content="::FaSliders className='inline mr-2'::" /> Simulation Settings </h3> 
            <InputWithSteppers label="Min Spread" unit="%" id="minSpread" value={testSettings.minSpreadPercent} onValueChange={(val) => handleSettingsChange('minSpreadPercent', val)} min={-5} max={20} step={0.05} bigStep={0.5} description="Minimum net profit % to consider."/>
            <InputWithSteppers label="Trade Volume" unit="USD" id="tradeVolume" value={testSettings.defaultTradeVolumeUSD} onValueChange={(val) => handleSettingsChange('defaultTradeVolumeUSD', val)} min={10} max={100000} step={50} bigStep={500} description="Typical amount for one cycle."/>
            <div className="space-y-2"> 
              <Label className="text-xs font-semibold text-foreground/80 dark:text-gray-300 block">Enabled Exchanges</Label> 
              <p className="text-[0.65rem] text-muted-foreground -mt-1 mb-1.5 px-1">Select exchanges for simulation (min 2 for 2-leg).</p>
              <ScrollArea className="h-[150px] border border-border dark:border-brand-purple/30 rounded-md p-1.5 bg-background dark:bg-black/30 simple-scrollbar"> 
                <div className="grid grid-cols-1 gap-1 text-xs"> {ALL_POSSIBLE_EXCHANGES_CONST.map(ex => ( <div key={ex} className="flex items-center space-x-1.5 p-1 hover:bg-muted dark:hover:bg-brand-purple/10 rounded"> <Checkbox id={`ex-${ex}`} checked={testSettings.enabledExchanges?.includes(ex) ?? false} onCheckedChange={() => handleExchangeToggle(ex)} className="border-primary dark:border-brand-purple data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-purple scale-90"/> <Label htmlFor={`ex-${ex}`} className="text-foreground/90 dark:text-gray-300 cursor-pointer flex-1 text-[0.7rem]">{ex}</Label> </div> ))} </div> 
              </ScrollArea> 
            </div> 
            <div className="space-y-1"> 
              <Label htmlFor="trackedPairs" className="text-xs font-semibold text-foreground/80 dark:text-gray-300">Tracked Pairs (CSV)</Label> 
              <p className="text-[0.65rem] text-muted-foreground -mt-1 mb-1 px-1">e.g., BTC/USDT, ETH/BTC.</p>
              <Input id="trackedPairs" type="text" value={testSettings.trackedPairs?.join(',') ?? ''} onChange={(e) => handleSettingsChange('trackedPairs', e.target.value.split(',').map(p => p.trim().toUpperCase()).filter(p => p))} className="input-cyber text-sm h-9 dark:border-brand-purple/50 dark:focus:border-brand-purple dark:focus:ring-brand-purple" placeholder="BTC/USDT,ETH/BTC"/> 
            </div> 
            <Button onClick={handleRunSimulation} disabled={isLoading} className="w-full bg-brand-orange text-black hover:bg-yellow-400 font-orbitron mt-2 py-2 text-sm shadow-md hover:shadow-orange-glow"> {isLoading ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-1.5'::" /> : <VibeContentRenderer content="::FaPlayCircle className='mr-1.5'::" />} {isLoading ? "Simulating..." : "Run Simulation"} </Button> 
            
            <h3 className="text-lg font-orbitron text-brand-pink pt-3 mt-4 mb-3 border-t-2 border-border dark:border-brand-purple/40 pb-1.5 flex items-center"> <VibeContentRenderer content="::FaFilterCircleXmark className='inline mr-1.5'::" /> Display Filters </h3>
            <div className="space-y-2">
                <InputWithSteppers label="Reward Min" unit="%" id="reward-min" value={rewardFilter[0]} onValueChange={(val) => setRewardFilter([val, rewardFilter[1]])} min={-5} max={rewardFilter[1]} step={0.1} bigStep={1} />
                <InputWithSteppers label="Reward Max" unit="%" id="reward-max" value={rewardFilter[1]} onValueChange={(val) => setRewardFilter([rewardFilter[0], val])} min={rewardFilter[0]} max={20} step={0.1} bigStep={1} />
            </div>
            <div className="space-y-2">
               <InputWithSteppers label="Ezness Min" id="ezness-min" value={eznessFilter[0]} onValueChange={(val) => setEznessFilter([val, eznessFilter[1]])} min={0} max={eznessFilter[1]} step={0.05} bigStep={0.2} />
               <InputWithSteppers label="Ezness Max" id="ezness-max" value={eznessFilter[1]} onValueChange={(val) => setEznessFilter([eznessFilter[0], val])} min={eznessFilter[0]} max={1.5} step={0.05} bigStep={0.2} />
            </div>
             <div className="space-y-2">
                <InputWithSteppers label="Effort Min" id="effort-min" value={effortFilter[0]} onValueChange={(val) => setEffortFilter([val, effortFilter[1]])} min={0} max={effortFilter[1]} step={0.05} bigStep={0.2} />
                <InputWithSteppers label="Effort Max" id="effort-max" value={effortFilter[1]} onValueChange={(val) => setEffortFilter([effortFilter[0], val])} min={effortFilter[0]} max={1.5} step={0.05} bigStep={0.2} />
            </div>
             <div className="space-y-2">
                <InputWithSteppers label="Risk Min" id="risk-min" value={riskFilter[0]} onValueChange={(val) => setRiskFilter([val, riskFilter[1]])} min={0} max={riskFilter[1]} step={0.1} bigStep={1} />
                <InputWithSteppers label="Risk Max" id="risk-max" value={riskFilter[1]} onValueChange={(val) => setRiskFilter([riskFilter[0], val])} min={riskFilter[0]} max={20} step={0.1} bigStep={1} />
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: "circOut" }} className="lg:col-span-3" >
            <Tabs defaultValue="visualization" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 bg-card/60 dark:bg-black/70 border border-border dark:border-brand-blue/60 backdrop-blur-md shadow-md"> 
                <TabsTrigger value="visualization" className="font-orbitron text-xs sm:text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:text-foreground dark:data-[state=inactive]:text-gray-300 dark:hover:data-[state=inactive]:text-gray-100 transition-colors duration-200 py-2"> <VibeContentRenderer content="::FaCubesStacked className='mr-1 sm:mr-1.5'::"/>Viz ({filteredAndProcessedOpportunities.length}) </TabsTrigger> 
                <TabsTrigger value="rawData" className="font-orbitron text-xs sm:text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:text-foreground dark:data-[state=inactive]:text-gray-300 dark:hover:data-[state=inactive]:text-gray-100 transition-colors duration-200 py-2"> <VibeContentRenderer content="::FaClipboardList className='mr-1 sm:mr-1.5'::"/>Data ({opportunities.length}) </TabsTrigger> 
                <TabsTrigger value="logs" className="font-orbitron text-xs sm:text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow data-[state=inactive]:text-muted-foreground hover:data-[state=inactive]:text-foreground dark:data-[state=inactive]:text-gray-300 dark:hover:data-[state=inactive]:text-gray-100 transition-colors duration-200 py-2"> <VibeContentRenderer content="::FaAlignLeft className='mr-1 sm:mr-1.5'::"/>Logs </TabsTrigger> 
              </TabsList>
              <TabsContent value="visualization" className="mt-4 p-1 bg-card/50 dark:bg-dark-card/40 border border-border dark:border-brand-blue/40 rounded-lg shadow-inner min-h-[620px]">
                <Suspense fallback={<LoadingVoxelPlotFallback />}>
                  <ArbitrageVoxelPlotWithNoSSR 
                    opportunities={filteredAndProcessedOpportunities} 
                    isTabActive={activeTab === "visualization"} 
                    onVoxelSelect={handleVoxelSelection}
                    selectedOpportunity={selectedOpportunity}
                  />
                </Suspense>
              </TabsContent>
              <TabsContent value="rawData" className="mt-4 p-1"> <ScrollArea className="h-[600px] border border-border dark:border-brand-blue/40 rounded-lg bg-card/50 dark:bg-dark-card/40 p-3 simple-scrollbar"> {opportunities.length > 0 ? ( opportunities.map(op => ( <Card key={op.id} className="mb-3 bg-card dark:bg-dark-bg/80 border-border dark:border-brand-purple/40 text-xs shadow-md hover:border-brand-purple/70 transition-colors duration-150"> <CardHeader className="p-3"> <CardTitle className={cn( "text-sm font-semibold flex items-center justify-between" )}> <span className={cn("text-primary dark:text-brand-cyan", op.profitPercentage > (testSettings.minSpreadPercent + 0.5) ? 'dark:text-brand-lime' : op.profitPercentage > testSettings.minSpreadPercent ? 'dark:text-brand-yellow' : 'dark:text-brand-orange')}> {op.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsTurnRight className='inline mr-1.5 text-base align-middle'::"/> : <VibeContentRenderer content="::FaShuffle className='inline mr-1.5 text-base align-middle'::"/>} {op.type === '2-leg' ? ` ${(op as TwoLegArbitrageOpportunity).buyExchange} → ${(op as TwoLegArbitrageOpportunity).sellExchange}` : ` ${(op as ThreeLegArbitrageOpportunity).exchange}`} </span> <span className="text-xs text-muted-foreground font-mono">{op.currencyPair}</span> </CardTitle> <CardDescription className="text-muted-foreground text-[0.65rem] pt-0.5">ID: {op.id.substring(0,8)}...</CardDescription> </CardHeader> <CardContent className="p-3 pt-0 space-y-1"> <p className="text-foreground/90">Spread: <strong className="text-xl font-bold" style={{color: op.profitPercentage > (testSettings.minSpreadPercent + 0.7) ? 'hsl(var(--brand-lime))' : op.profitPercentage > testSettings.minSpreadPercent ? 'hsl(var(--brand-yellow))' : 'hsl(var(--brand-orange))'}}>{formatNum(op.profitPercentage, 3)}%</strong></p> <p className="text-foreground/90">Profit (USD): <strong className="text-lg font-semibold" style={{color: op.potentialProfitUSD > 20 ? 'hsl(var(--brand-green))' : op.potentialProfitUSD > 5 ? 'hsl(var(--brand-yellow))' : 'hsl(var(--brand-orange))'}}>${formatNum(op.potentialProfitUSD)}</strong> (on ${formatNum(op.tradeVolumeUSD,0)} vol)</p> <p className="text-muted-foreground text-[0.7rem] break-words leading-snug">Details: {op.details}</p> {op.type === '2-leg' && <p className="text-gray-400 dark:text-gray-500 text-[0.65rem] font-mono">Net Fee: ${formatNum((op as TwoLegArbitrageOpportunity).networkFeeUSD)} | Buy: {(op as TwoLegArbitrageOpportunity).buyPrice.toFixed(4)} | Sell: {(op as TwoLegArbitrageOpportunity).sellPrice.toFixed(4)}</p>} </CardContent> </Card> ))) : ( <p className="text-center text-muted-foreground py-12">No opportunities generated with current settings.</p> )} </ScrollArea> </TabsContent> 
              <TabsContent value="logs" className="mt-4 p-1"> <ScrollArea className="h-[600px] border border-border dark:border-brand-blue/40 rounded-lg bg-card/50 dark:bg-dark-card/40 p-3 simple-scrollbar"> <pre className="text-xs text-muted-foreground dark:text-gray-300 whitespace-pre-wrap break-all"> {logs.join('\n')} </pre> </ScrollArea> </TabsContent>
            </Tabs>
            <LegendWTF onSimulateTrade={handleSimulateTrade} isSimulateDisabled={!selectedOpportunity} />
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}