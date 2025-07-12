"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { logger } from '@/lib/logger';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppToast } from "@/hooks/useAppToast";
import { useAppContext } from '@/contexts/AppContext';
import type { GodModeSimulationResult, GodModeOpportunity } from '@/app/elon/arbitrage_scanner_types';
import { motion } from 'framer-motion';

const ArbitrageVoxelPlotWithNoSSR = dynamic(
  () => import('@/components/arbitrage/ArbitrageVoxelPlot'),
  { ssr: false, loading: () => <LoadingVoxelPlotFallback /> }
);

const LoadingVoxelPlotFallback = () => {
  logger.debug("[SandboxPage] Rendering LoadingVoxelPlotFallback.");
  return (
    <div className="min-h-[600px] flex items-center justify-center text-muted-foreground bg-card/10 dark:bg-gray-900/50 rounded-md">
      <VibeContentRenderer content="::FaSpinner className='animate-spin text-2xl mr-3'::" />
      Awaiting Signal from VibeNet...
    </div>
  );
};

const formatNum = (num: number | undefined, digits = 2) => {
  if (typeof num === 'undefined') return 'N/A';
  return num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

export interface ProcessedSandboxOpportunity extends GodModeOpportunity {
  x_reward: number;
  y_ezness: number;
  z_inv_effort: number;
  riskScore: number;
  rawEzness: number;
  rawEffort: number;
  colorValue: string;
  sizeValue: number;
  id: string;
  tradeVolumeUSD: number;
  profitPercentage: number;
  details: string;
  type: string;
  currencyPair: string;
}

const SandboxContent: React.FC = () => {
    logger.info("[SandboxPage] Rendering (Voxel Rebirth - Realtime).");
    const searchParams = useSearchParams();
    const { addToast } = useAppToast();
    const { dbUser, supabase } = useAppContext();
    const [simulation, setSimulation] = useState<GodModeSimulationResult | null>(null);
    const [logs, setLogs] = useState<string[]>(["Awaiting connection..."]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("visualization");
    const [selectedOpportunity, setSelectedOpportunity] = useState<ProcessedSandboxOpportunity | null>(null);

    const calculateEERR = useCallback((op: GodModeOpportunity, tradeVolume: number): ProcessedSandboxOpportunity => {
        const rewardScore = op.spreadPercent;
        const volumeFactor = Math.min(tradeVolume, 50000) / 50000;
        const rawEzness = volumeFactor * 0.8;
        const rawEffort = volumeFactor * 0.2 + 0.1;
        const riskScore = parseFloat((rawEffort / (rawEzness > 0.01 ? rawEzness : 0.01)).toFixed(2));
        
        let color = '#8A2BE2'; // Default: Purple
        if (rewardScore < 0.1) color = '#A9A9A9'; // Low reward: Gray
        else if (riskScore < 1.0 && rewardScore > 0.3) color = '#32CD32'; // Low risk, good reward: Lime Green (ALPHA)
        else if (riskScore < 2.0 && rewardScore > 0.2) color = '#FFD700'; // Moderate risk/reward: Gold
        else if (riskScore > 3.0) color = '#FF6347'; // High risk: Tomato Red
        else if (rewardScore > 0.5 && riskScore <= 2.5) color = '#1E90FF'; // Good reward, manageable risk: Dodger Blue

        const size = Math.max(0.05, Math.min(0.8, tradeVolume / 15000 + 0.1));
        
        return { 
            ...op, 
            id: `${op.asset}-${op.buyAt.exchange}-${op.sellAt.exchange}`,
            x_reward: rewardScore, y_ezness: rawEzness,  z_inv_effort: 1 / (rawEffort > 0.01 ? rawEffort : 0.01), 
            riskScore, rawEzness, rawEffort, colorValue: color, sizeValue: size,
            tradeVolumeUSD: tradeVolume,
            profitPercentage: op.spreadPercent,
            details: `Buy ${op.asset} on ${op.buyAt.exchange} @ ${op.buyAt.price}, Sell on ${op.sellAt.exchange} @ ${op.sellAt.price}`,
            type: 'god-mode-2-leg',
            currencyPair: `${op.asset}/USD`
        };
    }, []);

    const processedOpportunities = useMemo(() => {
        if (!simulation) return [];
        const burstAmount = simulation.logs[0] ? parseInt(simulation.logs[0].match(/for \$(\d+)/)?.[1] || '5000', 10) : 5000;
        return simulation.opportunities.map(op => calculateEERR(op, burstAmount));
    }, [simulation, calculateEERR]);
    
    // Effect to fetch initial data from deep link
    useEffect(() => {
        const simId = searchParams.get('simId');
        if (simId && !simulation && supabase) {
            const fetchInitialSimulation = async () => {
                logger.info(`[SandboxPage] Deep link detected. Fetching simulation ${simId}...`);
                setIsLoading(true);
                setLogs(prev => [...prev, `Fetching initial data for simulation ${simId.substring(0,8)}...`]);
                
                const { data, error } = await supabase
                    .from('god_mode_simulations')
                    .select('simulation_result')
                    .eq('id', simId)
                    .single();

                if (error) {
                    logger.error(`[SandboxPage] Error fetching initial simulation ${simId}:`, error);
                    addToast("Failed to load simulation", "error", { description: error.message });
                    setLogs(prev => [...prev, `❌ Error fetching data: ${error.message}`]);
                } else if (data) {
                    const simResult = data.simulation_result as GodModeSimulationResult;
                    setSimulation(simResult);
                    setLogs(simResult.logs || ["Received simulation data."]);
                    addToast("🚀 Simulation Loaded!", "success", { description: `Loaded simulation ${simResult.simulationId.substring(0,8)} from deep link.`});
                }
                setIsLoading(false);
            };
            fetchInitialSimulation();
        }
    }, [searchParams, simulation, supabase, addToast]);

    // Effect for Realtime subscription
    useEffect(() => {
        if (!dbUser?.user_id || !supabase) {
            setLogs(prev => [...prev, "User or Supabase client not available. Cannot subscribe."]);
            return;
        }

        setLogs(prev => [...prev, `Attempting to subscribe to VibeNet for user ${dbUser.user_id}...`]);
        const channel = supabase
        .channel(`god-mode-sims-for-${dbUser.user_id}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'god_mode_simulations', filter: `user_id=eq.${dbUser.user_id}` },
            (payload) => {
            logger.info('[SandboxPage Realtime] Received new simulation payload:', payload);
            const newSimResult = payload.new.simulation_result as GodModeSimulationResult;
            setSimulation(newSimResult);
            setLogs(newSimResult.logs || ["Received new simulation data."]);
            setIsLoading(false);
            addToast("🚀 VibeNet Signal Received!", "success", {
                description: `New simulation ${newSimResult.simulationId.substring(0,8)} loaded from Telegram.`,
            });
            }
        )
        .subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                setLogs(prev => [...prev, "✅ Connection to VibeNet established. Awaiting /god command in Telegram."]);
                if (!simulation) setIsLoading(false); // We are ready, just waiting for data
            }
            if (status === 'CHANNEL_ERROR' || err) {
                setLogs(prev => [...prev, `❌ VibeNet Connection Error: ${err?.message}`]);
                setIsLoading(false);
            }
        });

        return () => {
            supabase.removeChannel(channel);
            logger.info("[SandboxPage Realtime] Unsubscribed from channel.");
        };
    }, [dbUser?.user_id, supabase, addToast, simulation]);

    const handleVoxelSelection = useCallback((opportunity: ProcessedSandboxOpportunity | null) => {
        setSelectedOpportunity(opportunity);
    }, []);

    return (
        <div className="container mx-auto max-w-7xl p-4 grid grid-cols-1 lg:grid-cols-4 gap-6 pt-24">
            <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: "circOut" }} className="lg:col-span-1 space-y-4 p-3 bg-card dark:bg-dark-card/70 border border-border dark:border-brand-purple/50 rounded-xl shadow-lg">
                <CardHeader className="p-2 pt-0">
                    <CardTitle className="text-xl font-orbitron text-brand-cyan">Command Center</CardTitle>
                    <CardDescription className="text-xs">Realtime receiver for /god commands.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-2">
                     <div>
                        <VibeContentRenderer content="::FaTelegram::" className="text-xl text-brand-blue mb-2"/>
                        <p className="text-sm font-semibold">Generate New Data</p>
                        <p className="text-xs text-muted-foreground">Go to your Telegram bot and use the <code className="text-brand-yellow bg-black/50 px-1 py-0.5 rounded">/god [amount]</code> command. The visualization will update automatically.</p>
                     </div>
                     <div>
                        <p className="text-sm font-semibold mt-4">Current Simulation</p>
                        <div className="text-xs space-y-1 mt-1 text-muted-foreground font-mono">
                            <p>ID: {simulation?.simulationId.substring(0,8) || 'N/A'}</p>
                            <p>Juiciness: {simulation?.marketJuiciness || 0}/100</p>
                            <p>Total Profit: ${formatNum(simulation?.totalProfit)}</p>
                            <p>Opportunities: {simulation?.opportunities.length || 0}</p>
                        </div>
                     </div>
                </CardContent>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: "circOut" }} className="lg:col-span-3" >
                <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="visualization" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="visualization">Viz ({processedOpportunities.length})</TabsTrigger>
                        <TabsTrigger value="logs">Logs</TabsTrigger>
                    </TabsList>
                    <TabsContent value="visualization" className="mt-4">
                        {isLoading && !simulation ? <LoadingVoxelPlotFallback /> :
                            <ArbitrageVoxelPlotWithNoSSR
                                opportunities={processedOpportunities}
                                isTabActive={activeTab === "visualization"}
                                onVoxelSelect={handleVoxelSelection}
                                selectedOpportunity={selectedOpportunity}
                            />
                        }
                    </TabsContent>
                    <TabsContent value="logs" className="mt-4">
                        <Card className="h-[600px]">
                            <CardContent className="p-2 h-full">
                                <ScrollArea className="h-full p-2 border rounded-md bg-black/50">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">{logs.join('\n')}</pre>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    );
}

export default function GodModeSandboxPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center text-muted-foreground">
                <VibeContentRenderer content="::FaSpinner className='animate-spin text-2xl mr-3'::" />
                Loading VibeNet link...
            </div>
        }>
            <SandboxContent />
        </Suspense>
    );
}