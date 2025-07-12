"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { debugLogger as logger } from '@/lib/debugLogger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppToast } from "@/hooks/useAppToast";
import { useAppContext } from '@/contexts/AppContext';
import type {
  GodModeSimulationResult,
  GodModeOpportunity
} from '@/app/elon/arbitrage_scanner_types';
import { motion } from 'framer-motion';

const ArbitrageVoxelPlotWithNoSSR = dynamic(
  () => import('@/components/arbitrage/ArbitrageVoxelPlot'),
  { 
    ssr: false,
    loading: () => <LoadingVoxelPlotFallback />,
  }
);

const LoadingVoxelPlotFallback = () => (
    <div className="p-4 border border-dashed border-brand-purple rounded-lg min-h-[400px] flex items-center justify-center bg-card/5 dark:bg-black/20">
        <div className="text-center">
            <VibeContentRenderer content="::FaSpinner className='text-5xl text-brand-purple mb-3 mx-auto animate-spin'::" />
            <p className="text-lg text-brand-cyan">Awaiting Signal from VibeNet...</p>
        </div>
    </div>
);

const formatNum = (num: number | undefined, digits = 2) => {
    if (typeof num === 'undefined') return 'N/A';
    return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

// This type must be compatible with what ArbitrageVoxelPlot expects
export interface ProcessedSandboxOpportunity extends GodModeOpportunity {
    x_reward: number; y_ezness: number; z_inv_effort: number; riskScore: number;
    rawEzness: number; rawEffort: number; colorValue: string; sizeValue: number;
    id: string; tradeVolumeUSD: number; profitPercentage: number;
    details: string; type: string; currencyPair: string;
}

const LegendWTF: React.FC = () => ( 
    <Card className="mt-6 bg-card/90 dark:bg-dark-card/80 border border-border dark:border-brand-yellow/50 p-3 shadow-lg"> 
        <CardHeader className="p-2 pt-1">
            <CardTitle className="text-primary dark:text-brand-yellow font-orbitron text-base md:text-lg flex items-center">
                <VibeContentRenderer content="::FaCircleQuestion className='mr-2 text-primary dark:text-yellow-400'::" /> WTF is This? (Legend)
            </CardTitle>
        </CardHeader> 
        <CardContent className="text-xs text-foreground/90 dark:text-gray-300 space-y-1.5"> 
            <p className="mt-2"><strong className="text-primary/80 dark:text-brand-cyan">Cubes (Opportunities):</strong></p> 
            <ul className="list-disc list-inside pl-3 space-y-0.5"> 
                <li><strong className="text-foreground dark:text-white">Color (Risk Score = Effort / Ezness):</strong></li> 
                <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#32CD32] mr-1.5 shrink-0 border border-black/20"></div>Low Risk, Good Reward (Alpha!)</li> 
                <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#FFD700] mr-1.5 shrink-0 border border-black/20"></div>Moderate Risk/Reward</li> 
                <li className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-[#FF6347] mr-1.5 shrink-0 border border-black/20"></div>High Risk</li>
            </ul>
        </CardContent> 
    </Card> 
);

const GodModeSandboxContent: React.FC = () => {
  logger.info("[GodModeSandbox] Rendering...");
  const searchParams = useSearchParams();
  const { addToast } = useAppToast();
  const { dbUser, supabase } = useAppContext();
  const [simulation, setSimulation] = useState<GodModeSimulationResult | null>(null);
  const [logs, setLogs] = useState<string[]>(["Realtime connection pending..."]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("visualization");
  const [selectedOpportunity, setSelectedOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);

  const calculateEERR = useCallback((op: GodModeOpportunity, tradeVolume: number): ProcessedSandboxOpportunity => {
      const rewardScore = op.spreadPercent;
      const volumeFactor = Math.min(tradeVolume, 50000) / 50000;
      
      const rawEzness = volumeFactor * 0.8;
      const rawEffort = volumeFactor * 0.2 + 0.1;
      const riskScore = parseFloat((rawEffort / (rawEzness > 0.01 ? rawEzness : 0.01)).toFixed(2));
      let color = '#8A2BE2'; 
      if (rewardScore < 0.1) color = '#A9A9A9';
      else if (riskScore < 1.0 && rewardScore > 0.3) color = '#32CD32';
      else if (riskScore < 2.0 && rewardScore > 0.2) color = '#FFD700';
      else if (riskScore > 3.0) color = '#FF6347';
      else if (rewardScore > 0.5 && riskScore <= 2.5) color = '#1E90FF';
      const size = Math.max(0.05, Math.min(0.8, tradeVolume / 15000 + 0.1));
      
      return { 
          ...op, id: `${op.asset}-${op.buyAt.exchange}-${op.sellAt.exchange}`,
          x_reward: rewardScore, y_ezness: rawEzness, z_inv_effort: 1 / (rawEffort > 0.01 ? rawEffort : 0.01), 
          riskScore, rawEzness, rawEffort, colorValue: color, sizeValue: size,
          tradeVolumeUSD: tradeVolume, profitPercentage: op.spreadPercent,
          details: `Buy ${op.asset} on ${op.buyAt.exchange} @ ${op.buyAt.price}, Sell on ${op.sellAt.exchange} @ ${op.sellAt.price}`,
          type: 'god-mode-2-leg', currencyPair: `${op.asset}/USD`
      };
  }, []);
  
  const processedOpportunities = useMemo(() => {
    if (!simulation) return [];
    const burstAmount = simulation.logs[0] ? parseInt(simulation.logs[0].match(/\$(\d+)/)?.[1] || '5000', 10) : 5000;
    return simulation.opportunities.map(op => calculateEERR(op, burstAmount));
  }, [simulation, calculateEERR]);
  
  useEffect(() => {
    if (!dbUser?.user_id || !supabase) {
      setLogs(prev => [...prev, "User or Supabase client not available. Cannot subscribe."]);
      return;
    }
    
    const simIdFromUrl = searchParams.get('simId');

    const fetchInitialData = async (simId: string) => {
        logger.info(`[GodModeSandbox] Fetching initial data for simId: ${simId}`);
        const { data, error } = await supabase
            .from('god_mode_simulations')
            .select('simulation_result')
            .eq('id', simId)
            .eq('user_id', dbUser.user_id)
            .single();

        if (error) {
            logger.error(`[GodModeSandbox] Error fetching initial sim data for ${simId}:`, error);
            addToast("Error loading simulation", "error", { description: "Could not find the specified simulation data." });
        } else if (data) {
            const initialSim = data.simulation_result as GodModeSimulationResult;
            setSimulation(initialSim);
            setLogs(initialSim.logs || ["Loaded historic simulation data."]);
        }
        setIsLoading(false);
    };

    if (simIdFromUrl) {
        fetchInitialData(simIdFromUrl);
    } else {
        setIsLoading(false);
    }

    setLogs([`Attempting to subscribe to VibeNet for user ${dbUser.user_id}...`]);
    const channel = supabase
      .channel(`god-mode-sims-for-${dbUser.user_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'god_mode_simulations', filter: `user_id=eq.${dbUser.user_id}` },
        (payload) => {
          logger.info('[GodModeSandbox Realtime] Received new simulation payload:', payload);
          const newSimResult = payload.new.simulation_result as GodModeSimulationResult;
          setSimulation(newSimResult);
          setLogs(newSimResult.logs || ["Received simulation data."]);
          setIsLoading(false);
          addToast("🚀 VibeNet Signal Received!", "success", {
            description: `New simulation ${newSimResult.simulationId.substring(0,8)} loaded from Telegram.`,
          });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setLogs(prev => [...prev, "✅ Connection to VibeNet established. Awaiting /god command in Telegram."]);
        }
        if (status === 'CHANNEL_ERROR' || err) {
           setLogs(prev => [...prev, `❌ VibeNet Connection Error: ${err?.message}`]);
           setIsLoading(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dbUser?.user_id, supabase, addToast, searchParams]);

  const handleVoxelSelection = useCallback((opportunity: ProcessedSandboxOpportunity | null) => {
    setSelectedOpportunity(opportunity);
  }, []);
  
  return (
    <div className="min-h-screen bg-page-gradient text-foreground p-4 pt-24 pb-12 font-mono">
      <Card className="max-w-7xl mx-auto bg-card/80 dark:bg-black/85 backdrop-blur-xl border-2 border-primary/30 dark:border-brand-cyan/70 shadow-2xl dark:shadow-brand-cyan/40">
        <CardHeader className="text-center border-b border-border dark:border-brand-cyan/40 pb-4">
            <VibeContentRenderer content="::FaSatelliteDish className='text-5xl text-primary dark:text-brand-cyan mx-auto mb-3 animate-pulse filter drop-shadow-[0_0_10px_hsl(var(--brand-cyan-rgb))]'::" />
            <CardTitle className="text-3xl font-orbitron text-primary dark:text-brand-cyan cyber-text glitch" data-text="GOD-MODE SANDBOX">GOD-MODE SANDBOX</CardTitle>
            <CardDescription className="text-sm text-muted-foreground font-mono">Realtime latent space visualization linked to your Telegram commands.</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-1 space-y-4 p-3 bg-card dark:bg-dark-card/70 border border-border dark:border-brand-purple/50 rounded-xl shadow-lg"> 
            <h3 className="text-lg font-orbitron text-primary dark:text-brand-purple mb-3 border-b border-border dark:border-brand-purple/30 pb-1.5 flex items-center">
                <VibeContentRenderer content="::FaDoorOpen className='inline mr-2'::" /> Entry Point
            </h3> 
            <div className="text-sm p-3 bg-background dark:bg-black/30 border border-border dark:border-brand-purple/20 rounded-md">
                <p>This panel is a realtime receiver.</p>
                <p className="mt-2 text-muted-foreground text-xs">To generate new data, go to your Telegram bot and use the <code className="bg-muted text-brand-orange p-1 rounded">/god [amount]</code> command.</p>
                <p className="mt-2 text-muted-foreground text-xs">The visualization will update automatically.</p>
            </div>
             <h3 className="text-lg font-orbitron text-brand-pink pt-3 mt-4 mb-3 border-t-2 border-border dark:border-brand-purple/40 pb-1.5 flex items-center">
                <VibeContentRenderer content="::FaInfoCircle className='inline mr-1.5'::" /> Current Simulation
             </h3>
             <div className="text-xs space-y-1 p-2 bg-background dark:bg-black/30 rounded">
                <p>ID: <span className="text-brand-cyan">{simulation?.simulationId.substring(0,8) || 'N/A'}</span></p>
                <p>Juiciness: <span className="text-brand-cyan">{simulation?.marketJuiciness || 0}/100</span></p>
                <p>Total Profit: <span className="text-brand-cyan">${formatNum(simulation?.totalProfit)}</span></p>
                <p>Opportunities: <span className="text-brand-cyan">{simulation?.opportunities.length || 0}</span></p>
             </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3" >
            <Tabs defaultValue="visualization" className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 bg-card/60 dark:bg-black/70 border border-border dark:border-brand-blue/60 backdrop-blur-md shadow-md"> 
                <TabsTrigger value="visualization" className="font-orbitron text-xs sm:text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black">
                    <VibeContentRenderer content="::FaCubesStacked className='mr-1 sm:mr-1.5'::"/>Viz ({processedOpportunities.length})
                </TabsTrigger> 
                <TabsTrigger value="logs" className="font-orbitron text-xs sm:text-sm data-[state=active]:bg-brand-blue data-[state=active]:text-black">
                    <VibeContentRenderer content="::FaAlignLeft className='mr-1 sm:mr-1.5'::"/>Logs
                </TabsTrigger> 
              </TabsList>
              <TabsContent value="visualization" className="mt-4 p-1 bg-card/50 dark:bg-dark-card/40 border border-border dark:border-brand-blue/40 rounded-lg shadow-inner min-h-[620px]">
                {isLoading ? <LoadingVoxelPlotFallback /> :
                  <Suspense fallback={<LoadingVoxelPlotFallback />}>
                    <ArbitrageVoxelPlotWithNoSSR 
                      opportunities={processedOpportunities} 
                      isTabActive={activeTab === "visualization"} 
                      onVoxelSelect={handleVoxelSelection}
                      selectedOpportunity={selectedOpportunity}
                    />
                  </Suspense>
                }
              </TabsContent>
              <TabsContent value="logs" className="mt-4 p-1">
                 <ScrollArea className="h-[600px] border border-border dark:border-brand-blue/40 rounded-lg bg-card/50 dark:bg-dark-card/40 p-3 simple-scrollbar">
                    <pre className="text-xs text-muted-foreground dark:text-gray-300 whitespace-pre-wrap break-all">
                        {logs.join('\n')}
                    </pre>
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

// Wrapper component to ensure Suspense boundary for useSearchParams
export default function GodModeSandboxPage() {
    return (
        <Suspense fallback={<LoadingVoxelPlotFallback />}>
            <GodModeSandboxContent />
        </Suspense>
    );
}
