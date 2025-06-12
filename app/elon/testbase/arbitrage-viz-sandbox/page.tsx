"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { debugLogger as logger } from '@/lib/debugLogger';
import { ScrollArea } from '@/components/ui/scroll-area';
// import { Slider } from "@/components/ui/slider"; // SLIDERS DITCHED
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

const ArbitrageVoxelPlotWithNoSSR = dynamic(
  () => {
    logger.debug("[SandboxPage] DYNAMIC IMPORT FUNCTION CALLED: Attempting to import '@/components/arbitrage/ArbitrageVoxelPlot'...");
    return import('@/components/arbitrage/ArbitrageVoxelPlot')
      .then((mod) => {
        logger.debug("[SandboxPage] DYNAMIC IMPORT SUCCESS: ArbitrageVoxelPlot module loaded.");
        return mod; 
      })
      .catch(err => {
        logger.error("[SandboxPage] DYNAMIC IMPORT FAILED (Plot Component):", err);
        return () => ( <div className="text-red-500 p-4 bg-red-900/20 border border-red-700 rounded-md min-h-[400px] flex flex-col items-center justify-center"> <VibeContentRenderer content="::FaBomb className='text-4xl mb-2'::" /> <p className="font-bold">Failed to load 3D Plot Component.</p> <p className="text-xs mt-1">Error during dynamic import.</p> <pre className="mt-2 text-xs bg-black/30 p-1 max-w-full overflow-auto">{String(err)}</pre> </div> );
      });
  },
  { 
    ssr: false,
    loading: () => <LoadingVoxelPlotFallback />,
  }
);

const LoadingVoxelPlotFallback = () => { logger.debug("[SandboxPage] Rendering LoadingVoxelPlotFallback for dynamic import."); return ( <div className="p-4 border border-dashed border-brand-purple rounded-lg min-h-[400px] flex items-center justify-center bg-black/20"> <div className="text-center"> <VibeContentRenderer content="::FaSpinner className='text-5xl text-brand-purple mb-3 mx-auto animate-spin'::" /> <p className="text-lg text-brand-cyan">Loading 3D Voxel Universe...</p> </div> </div> );};
const formatNum = (num: number | undefined, digits = 2) => { if (typeof num === 'undefined') return 'N/A'; return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });};
export interface ProcessedSandboxOpportunity extends ArbitrageOpportunity { x_reward: number; y_ezness: number; z_inv_effort: number; riskScore: number; rawEzness: number; rawEffort: number;}

interface FilterInputRangeProps { label: string; idPrefix: string; value: [number, number]; onChange: (value: [number, number]) => void; minLimit: number; maxLimit: number; step: number;}
const FilterInputRange: React.FC<FilterInputRangeProps> = ({ label, idPrefix, value, onChange, minLimit, maxLimit, step }) => { const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => { let newMin = parseFloat(e.target.value); if (isNaN(newMin)) newMin = minLimit; newMin = Math.max(minLimit, Math.min(newMin, value[1])); onChange([newMin, value[1]]); }; const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => { let newMax = parseFloat(e.target.value); if (isNaN(newMax)) newMax = maxLimit; newMax = Math.min(maxLimit, Math.max(newMax, value[0])); onChange([value[0], newMax]); }; return ( <div className="space-y-1.5 mb-3"> <Label className="text-xs font-semibold text-gray-300 flex justify-between items-center"> <span>{label}</span> <span className="text-brand-yellow text-[0.7rem] bg-black/30 px-1.5 py-0.5 rounded"> {value[0].toFixed(2)} – {value[1].toFixed(2)} </span> </Label> <div className="flex gap-2"> <Input id={`${idPrefix}-min`} type="number" value={value[0]} onBlur={handleMinChange} onChange={(e) => onChange([parseFloat(e.target.value) || minLimit, value[1]])} min={minLimit} max={value[1]} step={step} className="input-cyber text-sm h-8 w-1/2 focus:border-brand-pink focus:ring-brand-pink" placeholder={`Min (${minLimit})`} /> <Input id={`${idPrefix}-max`} type="number" value={value[1]} onBlur={handleMaxChange} onChange={(e) => onChange([value[0], parseFloat(e.target.value) || maxLimit])} min={value[0]} max={maxLimit} step={step} className="input-cyber text-sm h-8 w-1/2 focus:border-brand-pink focus:ring-brand-pink" placeholder={`Max (${maxLimit})`} /> </div> </div> );};

export default function ArbitrageVizSandboxPage() {
  logger.info("[SandboxPage] Rendering (Input Filters, Tab Control, Orbit Control Mgmt).");
  const [testSettings, setTestSettings] = useState<ArbitrageSettings>({ ...DEFAULT_ARBITRAGE_SETTINGS });
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("visualization");

  const [rewardFilter, setRewardFilter] = useState<[number, number]>([DEFAULT_ARBITRAGE_SETTINGS.minSpreadPercent - 0.5 < -1 ? -1 : DEFAULT_ARBITRAGE_SETTINGS.minSpreadPercent - 0.5, 5]);
  const [eznessFilter, setEznessFilter] = useState<[number, number]>([0, 1.2]);
  const [effortFilter, setEffortFilter] = useState<[number, number]>([0, 1.2]);
  const [riskFilter, setRiskFilter] = useState<[number, number]>([0, 10]);

  const calculateEERR = useCallback((op: ArbitrageOpportunity): ProcessedSandboxOpportunity => { const rewardScore = op.profitPercentage; const rawEzness = (Math.min(op.tradeVolumeUSD, 50000) / 50000) * 0.4 + (1 - Math.min((op as TwoLegArbitrageOpportunity).networkFeeUSD || 0, 50) / 50) * 0.4 + (op.type === '2-leg' ? 0.2 : 0.05); const rawEffort = (Math.min(op.tradeVolumeUSD, 50000) / 50000) * 0.5 + (op.type === '3-leg' ? 0.4 : 0.1) + (((op as TwoLegArbitrageOpportunity).buyFeePercentage || 0) + ((op as TwoLegArbitrageOpportunity).sellFeePercentage || 0)) / 200 * 0.1; const riskScore = parseFloat((rawEffort / (rawEzness > 0.01 ? rawEzness : 0.01)).toFixed(2)); return { ...op, x_reward: rewardScore, y_ezness: rawEzness,  z_inv_effort: 1 / (rawEffort > 0.01 ? rawEffort : 0.01), riskScore: riskScore, rawEzness: rawEzness, rawEffort: rawEffort, }; }, []);
  const filteredAndProcessedOpportunities = useMemo(() => { logger.debug("[SandboxPage] Memoizing filteredAndProcessedOpportunities. Raw opportunities count:", opportunities.length); const processed = opportunities.map(calculateEERR); const filtered = processed.filter(op =>  op.x_reward >= rewardFilter[0] && op.x_reward <= rewardFilter[1] && op.rawEzness >= eznessFilter[0] && op.rawEzness <= eznessFilter[1] && op.rawEffort >= effortFilter[0] && op.rawEffort <= effortFilter[1] && op.riskScore >= riskFilter[0] && op.riskScore <= riskFilter[1] ); logger.debug(`[SandboxPage] Processed: ${processed.length}, Filtered for plot: ${filtered.length}`); return filtered; }, [opportunities, calculateEERR, rewardFilter, eznessFilter, effortFilter, riskFilter]);
  const handleRunSimulation = useCallback(async () => { setIsLoading(true); setLogs(["Initiating sandbox simulation..."]); setOpportunities([]); logger.info("[SandboxPage] Running simulation with settings:", testSettings); try { const result = await fetchArbitrageOpportunitiesWithSettings(testSettings); setOpportunities(result.opportunities); setLogs(prev => [...prev, ...result.logs, `Simulation finished. Raw opportunities: ${result.opportunities.length}.`]); logger.info("[SandboxPage] Simulation result:", result); } catch (error) { logger.error("Error in sandbox simulation (handleRunSimulation):", error); setLogs(prev => [...prev, `CLIENT-SIDE ERROR: ${error instanceof Error ? error.message : String(error)}`]); } setIsLoading(false); }, [testSettings]);
  useEffect(() => { logger.info("[SandboxPage] Initial mount, running simulation with default settings."); handleRunSimulation(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 
  const handleSettingsChange = (field: keyof ArbitrageSettings, value: any) => { setTestSettings(prev => ({ ...prev, [field]: value })); };
  const handleExchangeToggle = (exchangeName: ExchangeName) => { setTestSettings(prev => { const currentEnabledExchanges = prev.enabledExchanges || []; const newEnabledExchanges = currentEnabledExchanges.includes(exchangeName) ? currentEnabledExchanges.filter(ex => ex !== exchangeName) : [...currentEnabledExchanges, exchangeName]; return { ...prev, enabledExchanges: newEnabledExchanges }; }); };

  const LegendWTF = () => ( <Card className="mt-6 bg-dark-card/80 border border-brand-yellow/50 p-3 shadow-md"> <CardHeader className="p-2 pt-1"> <CardTitle className="text-brand-yellow font-orbitron text-base md:text-lg flex items-center"> <VibeContentRenderer content="::FaCircleQuestion className='mr-2 text-yellow-400'::" /> WTF is Going On Here? (Legend) </CardTitle> </CardHeader> <CardContent className="text-xs text-gray-300 space-y-1.5"> <p><strong className="text-brand-cyan">Axes:</strong></p> <ul className="list-disc list-inside pl-3 space-y-0.5"> <li><strong className="text-red-400">X (Reward):</strong> Profit % <VibeContentRenderer content="::FaArrowRight className='inline ml-1 text-red-400/70'::"/></li> <li><strong className="text-lime-400">Y (Ezness):</strong> Composite ease score <VibeContentRenderer content="::FaArrowUp className='inline ml-1 text-lime-400/70'::"/></li> <li><strong className="text-blue-400">Z (1/Effort):</strong> Inverse effort score <VibeContentRenderer content="::FaExpand className='inline ml-1 text-blue-400/70'::"/></li> </ul> <p className="mt-2"><strong className="text-brand-cyan">Voxels (Cubes represent Opportunities):</strong></p> <ul className="list-disc list-inside pl-3 space-y-0.5"> <li><strong className="text-white">Color (Risk Score = Effort / Ezness):</strong></li> <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#32CD32] mr-1.5 shrink-0 border border-black/20"></div>Low Risk, Good Reward (Alpha!)</li> <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#FFD700] mr-1.5 shrink-0 border border-black/20"></div>Moderate Risk/Reward</li> <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#1E90FF] mr-1.5 shrink-0 border border-black/20"></div>Good Reward, Manageable Risk</li> <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#FF6347] mr-1.5 shrink-0 border border-black/20"></div>High Risk</li> <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#A9A9A9] mr-1.5 shrink-0 border border-black/20"></div>Very Low Reward</li> <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#8A2BE2] mr-1.5 shrink-0 border border-black/20"></div>Default / Mid-Risk</li> <li><strong className="text-white">Size:</strong> Proportional to Trade Volume (USD)</li> </ul> <p className="mt-2 text-gray-400 italic">Aim for <span className="text-brand-lime font-semibold">Lime Green</span> cubes in the far positive corner (high X, Y, Z)!</p> </CardContent> </Card> );
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-purple-950/50 text-foreground p-4 pt-24 pb-12 font-mono">
      <Card className="max-w-7xl mx-auto bg-black/85 backdrop-blur-xl border-2 border-brand-cyan/70 shadow-2xl shadow-brand-cyan/40">
        <CardHeader className="text-center border-b border-brand-cyan/40 pb-4"> <VibeContentRenderer content="::FaFlaskVial className='text-5xl text-brand-cyan mx-auto mb-3 filter drop-shadow-[0_0_10px_hsl(var(--brand-cyan-rgb))]'::" /> <CardTitle className="text-3xl font-orbitron text-brand-cyan cyber-text glitch" data-text="ARBITRAGE VOXEL SANDBOX"> ARBITRAGE VOXEL SANDBOX </CardTitle> <CardDescription className="text-sm text-cyan-300/80 font-mono"> Experiment with simulated arbitrage opportunities and visualize the EERR latent space. </CardDescription> </CardHeader>
        <CardContent className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: "circOut" }} className="lg:col-span-1 space-y-3 p-3 bg-dark-card/70 border border-brand-purple/50 rounded-xl shadow-lg"> 
            <h3 className="text-lg font-orbitron text-brand-purple mb-3 border-b border-brand-purple/30 pb-1.5 flex items-center"> <VibeContentRenderer content="::FaSlidersH className='inline mr-2'::" /> Simulation Settings </h3> 
            <div className="space-y-1.5"> <Label htmlFor="minSpread" className="text-xs font-semibold text-gray-300">Min Spread (%)</Label> <Input id="minSpread" type="number" step="0.01" value={testSettings.minSpreadPercent} onChange={(e) => handleSettingsChange('minSpreadPercent', parseFloat(e.target.value) || 0)} className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple"/> </div> 
            <div className="space-y-1.5"> <Label htmlFor="tradeVolume" className="text-xs font-semibold text-gray-300">Trade Volume (USD)</Label> <Input id="tradeVolume" type="number" step="50" value={testSettings.defaultTradeVolumeUSD} onChange={(e) => handleSettingsChange('defaultTradeVolumeUSD', parseInt(e.target.value, 10) || 0)} className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple"/> </div> 
            <div className="space-y-2"> <Label className="text-xs font-semibold text-gray-300 block mb-1.5">Enabled Exchanges</Label> <ScrollArea className="h-[150px] border border-brand-purple/30 rounded-md p-1.5 bg-black/30 simple-scrollbar"> <div className="grid grid-cols-1 gap-1 text-xs"> {ALL_POSSIBLE_EXCHANGES_CONST.map(ex => ( <div key={ex} className="flex items-center space-x-1.5 p-1 hover:bg-brand-purple/10 rounded"> <Checkbox id={`ex-${ex}`} checked={testSettings.enabledExchanges?.includes(ex) ?? false} onCheckedChange={() => handleExchangeToggle(ex)} className="border-brand-purple data-[state=checked]:bg-brand-purple scale-90"/> <Label htmlFor={`ex-${ex}`} className="text-gray-300 cursor-pointer flex-1 text-[0.7rem]">{ex}</Label> </div> ))} </div> </ScrollArea> </div> 
            <div className="space-y-1.5"> <Label htmlFor="trackedPairs" className="text-xs font-semibold text-gray-300">Tracked Pairs (CSV)</Label> <Input id="trackedPairs" type="text" value={testSettings.trackedPairs?.join(',') ?? ''} onChange={(e) => handleSettingsChange('trackedPairs', e.target.value.split(',').map(p => p.trim().toUpperCase()).filter(p => p))} className="input-cyber text-sm h-9 border-brand-purple/50 focus:border-brand-purple focus:ring-brand-purple" placeholder="BTC/USDT,ETH/BTC"/> </div> 
            <Button onClick={handleRunSimulation} disabled={isLoading} className="w-full bg-brand-orange text-black hover:bg-yellow-400 font-orbitron mt-2 py-2 text-sm shadow-md hover:shadow-orange-glow"> {isLoading ? <VibeContentRenderer content="::FaSpinner className='animate-spin mr-1.5'::" /> : <VibeContentRenderer content="::FaPlayCircle className='mr-1.5'::" />} {isLoading ? "Simulating..." : "Run Simulation"} </Button> 
            
            <h3 className="text-lg font-orbitron text-brand-pink pt-3 mt-3 mb-2 border-t border-brand-purple/30 pb-1.5 flex items-center"> <VibeContentRenderer content="::FaFilter className='inline mr-1.5'::" /> Display Filters </h3>
            <FilterInputRange label="Reward Filter (%)" idPrefix="reward" value={rewardFilter} onChange={setRewardFilter} minLimit={-5} maxLimit={10} step={0.1} />
            <FilterInputRange label="Ezness Filter" idPrefix="ezness" value={eznessFilter} onChange={setEznessFilter} minLimit={0} maxLimit={1.5} step={0.01} />
            <FilterInputRange label="Effort Filter" idPrefix="effort" value={effortFilter} onChange={setEffortFilter} minLimit={0} maxLimit={1.5} step={0.01} />
            <FilterInputRange label="Risk Filter" idPrefix="risk" value={riskFilter} onChange={setRiskFilter} minLimit={0} maxLimit={20} step={0.1} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: "circOut" }} className="lg:col-span-3" >
            <Tabs defaultValue="visualization" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 bg-black/70 border border-brand-blue/60 backdrop-blur-md shadow-md"> 
                <TabsTrigger value="visualization" className="font-orbitron text-xs sm:text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow data-[state=inactive]:text-gray-300 hover:data-[state=inactive]:text-gray-100 transition-colors duration-200 py-2"> <VibeContentRenderer content="::FaChartColumn className='mr-1 sm:mr-1.5'::"/>Viz ({filteredAndProcessedOpportunities.length}) </TabsTrigger> 
                <TabsTrigger value="rawData" className="font-orbitron text-xs sm:text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow data-[state=inactive]:text-gray-300 hover:data-[state=inactive]:text-gray-100 transition-colors duration-200 py-2"> <VibeContentRenderer content="::FaList className='mr-1 sm:mr-1.5'::"/>Data ({opportunities.length}) </TabsTrigger> 
                <TabsTrigger value="logs" className="font-orbitron text-xs sm:text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black data-[state=active]:shadow-blue-glow data-[state=inactive]:text-gray-300 hover:data-[state=inactive]:text-gray-100 transition-colors duration-200 py-2"> <VibeContentRenderer content="::FaTerminal className='mr-1 sm:mr-1.5'::"/>Logs </TabsTrigger> 
              </TabsList>
              <TabsContent value="visualization" className="mt-4 p-1 bg-dark-card/40 border border-brand-blue/40 rounded-lg shadow-inner min-h-[620px]">
                <ArbitrageVoxelPlotWithNoSSR 
                    opportunities={filteredAndProcessedOpportunities} 
                    isTabActive={activeTab === "visualization"}
                />
              </TabsContent>
              <TabsContent value="rawData" className="mt-4 p-1"> 
                <ScrollArea className="h-[600px] border border-brand-blue/40 rounded-lg bg-dark-card/40 p-3 simple-scrollbar"> 
                  {opportunities.length > 0 ? ( opportunities.map(op => ( 
                    <Card key={op.id} className="mb-3 bg-dark-bg/80 border-brand-purple/40 text-xs shadow-md hover:border-brand-purple/70 transition-colors duration-150"> 
                        <CardHeader className="p-3"> 
                            <CardTitle className={cn( "text-sm font-semibold flex items-center justify-between" )}> 
                                <span className={cn(op.profitPercentage > (testSettings.minSpreadPercent + 0.5) ? 'text-brand-lime' : op.profitPercentage > testSettings.minSpreadPercent ? 'text-brand-yellow' : 'text-brand-orange')}>
                                    {op.type === '2-leg' ? <VibeContentRenderer content="::FaArrowsTurnRight className='inline mr-1.5 text-base align-middle'::"/> : <VibeContentRenderer content="::FaShuffle className='inline mr-1.5 text-base align-middle'::"/>} 
                                    {op.type === '2-leg' ? ` ${(op as TwoLegArbitrageOpportunity).buyExchange} → ${(op as TwoLegArbitrageOpportunity).sellExchange}` : ` ${(op as ThreeLegArbitrageOpportunity).exchange}`}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">{op.currencyPair}</span>
                            </CardTitle> 
                            <CardDescription className="text-gray-500 text-[0.65rem] pt-0.5">ID: {op.id.substring(0,8)}...</CardDescription> 
                        </CardHeader> 
                        <CardContent className="p-3 pt-0 space-y-1"> 
                            <p>Spread: <strong className="text-xl font-bold" style={{color: op.profitPercentage > (testSettings.minSpreadPercent + 0.7) ? 'hsl(var(--brand-lime))' : op.profitPercentage > testSettings.minSpreadPercent ? 'hsl(var(--brand-yellow))' : 'hsl(var(--brand-orange))'}}>{formatNum(op.profitPercentage, 3)}%</strong></p> 
                            <p>Profit (USD): <strong className="text-lg font-semibold" style={{color: op.potentialProfitUSD > 20 ? 'hsl(var(--brand-green))' : op.potentialProfitUSD > 5 ? 'hsl(var(--brand-yellow))' : 'hsl(var(--brand-orange))'}}>${formatNum(op.potentialProfitUSD)}</strong> (on ${formatNum(op.tradeVolumeUSD,0)} vol)</p> 
                            <p className="text-gray-400 text-[0.7rem] break-words leading-snug">Details: {op.details}</p> 
                            {op.type === '2-leg' && <p className="text-gray-500 text-[0.65rem] font-mono">Net Fee: ${formatNum((op as TwoLegArbitrageOpportunity).networkFeeUSD)} | Buy: {(op as TwoLegArbitrageOpportunity).buyPrice.toFixed(4)} | Sell: {(op as TwoLegArbitrageOpportunity).sellPrice.toFixed(4)}</p>} 
                        </CardContent> 
                    </Card> 
                  ))) : ( <p className="text-center text-muted-foreground py-12">No opportunities generated with current settings.</p> )} 
                </ScrollArea> 
              </TabsContent> 
              <TabsContent value="logs" className="mt-4 p-1"> 
                <ScrollArea className="h-[600px] border border-brand-blue/40 rounded-lg bg-dark-card/40 p-3 simple-scrollbar"> 
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all"> {logs.join('\n')} </pre> 
                </ScrollArea> 
              </TabsContent>
            </Tabs>
            <LegendWTF />
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}