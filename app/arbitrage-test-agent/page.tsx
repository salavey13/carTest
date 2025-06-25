"use client";

import React, { useState, useCallback, Suspense, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { supabaseAdmin } from '@/hooks/supabase'; // Direct read-only for admin pages is acceptable
import { triggerMarketDataFetch, triggerCentralAnalyzer } from './actions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useAppContext } from '@/contexts/AppContext';

// Refined DataTable component with better styling
const DataTable: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 italic text-sm p-4">No data to display. Trigger a fetch or check logs for errors.</p>;
  }
  const headers = Object.keys(data[0]);

  const formatValue = (value: any) => {
    if (typeof value === 'number') {
      if (Math.abs(value) < 0.0001 && value !== 0) return value.toFixed(8);
      return Number(value.toFixed(4));
    }
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return new Date(value).toLocaleString('ru-RU');
    }
    return value;
  };

  return (
    <div className="overflow-x-auto simple-scrollbar">
      <table className="min-w-full text-xs text-left">
        <thead className="bg-gray-900/50 sticky top-0 backdrop-blur-sm z-10">
          <tr>
            {headers.map(header => (
              <th key={header} className="p-2.5 font-semibold text-brand-lime/80 uppercase tracking-wider">{header.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-brand-purple/10 transition-colors">
              {headers.map(header => (
                <td key={header} className="p-2.5 text-gray-300 whitespace-nowrap">
                  {String(formatValue(row[header]))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ArbitrageTestAgentPage = () => {
  const { isAdmin, isLoading: isAuthLoading } = useAppContext();
  const [triggerStates, setTriggerStates] = useState<Record<string, 'idle' | 'loading' | 'success' | 'error'>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [rawData, setRawData] = useState<any[] | null>(null);
  const [activeTab, setActiveTab] = useState("logs");

  const addLog = useCallback((message: string) => {
    const timestamp = `[${new Date().toLocaleTimeString('ru-RU', { hour12: false })}]`;
    setLogs(prev => [`${timestamp} ${message}`, ...prev].slice(0, 100));
  }, []);

  const handleTrigger = useCallback(async (actionName: string, actionFn: () => Promise<any>) => {
    setTriggerStates(prev => ({ ...prev, [actionName]: 'loading' }));
    addLog(`Triggering ${actionName}...`);
    try {
      const result = await actionFn();
      addLog(`${actionName} Result: ${JSON.stringify(result, null, 2)}`);
      
      if (result.success) {
        toast.success(`${actionName} triggered successfully.`);
        setTriggerStates(prev => ({ ...prev, [actionName]: 'success' }));
      } else {
        toast.error(`Error triggering ${actionName}: ${result.error}`);
        setTriggerStates(prev => ({ ...prev, [actionName]: 'error' }));
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown client-side error";
      addLog(`CRITICAL ERROR on ${actionName}: ${errorMsg}`);
      toast.error(`Critical error on ${actionName}`);
      setTriggerStates(prev => ({ ...prev, [actionName]: 'error' }));
    }
    
    setTimeout(() => setTriggerStates(prev => ({ ...prev, [actionName]: 'idle' })), 3000);
  }, [addLog]);

  const fetchRawData = async (tableName: string) => {
    setTriggerStates(prev => ({ ...prev, fetchRawData: 'loading' }));
    setRawData(null);
    setActiveTab("data");
    addLog(`Fetching raw data from ${tableName}...`);
    
    const orderByColumn = tableName === 'arbitrage_opportunities' ? 'timestamp_a' : 'timestamp';

    try {
        const { data, error } = await supabaseAdmin
            .from(tableName)
            .select('*')
            .limit(50)
            .order(orderByColumn, { ascending: false });
        
        if (error) {
            toast.error(`Error fetching from ${tableName}: ${error.message}`);
            addLog(`Fetch Error from ${tableName}: ${error.message}`);
            setTriggerStates(prev => ({ ...prev, fetchRawData: 'error' }));
        } else {
            toast.success(`Fetched ${data.length} records from ${tableName}.`);
            setRawData(data);
            setTriggerStates(prev => ({ ...prev, fetchRawData: 'success' }));
        }
    } catch(e) {
        const errorMsg = e instanceof Error ? e.message : "Unknown client error during fetch.";
        toast.error(`Client Error fetching from ${tableName}: ${errorMsg}`);
        addLog(`Client Fetch Error from ${tableName}: ${errorMsg}`);
        setTriggerStates(prev => ({ ...prev, fetchRawData: 'error' }));
    }
    
    setTimeout(() => setTriggerStates(prev => ({ ...prev, fetchRawData: 'idle' })), 3000);
  };

  const getButtonContent = (actionName: string, icon: string, text: string) => {
    const state = triggerStates[actionName];
    const iconComponent = 
      state === 'loading' ? <VibeContentRenderer content="::FaSpinner className='animate-spin'::" /> :
      state === 'success' ? <VibeContentRenderer content="::FaCheckCircle::" /> :
      state === 'error' ? <VibeContentRenderer content="::FaTriangleExclamation::" /> :
      <VibeContentRenderer content={icon} />;
    
    return <span className="flex items-center justify-center gap-2">{iconComponent}{text}</span>;
  };

  if (isAuthLoading) {
     return <div className="flex h-screen items-center justify-center bg-gray-950 text-brand-cyan"><VibeContentRenderer content="::FaSpinner className='animate-spin text-4xl'::" /><span className="ml-4 text-xl">Loading Auth...</span></div>;
  }
  if (!isAdmin) {
     return <div className="flex h-screen items-center justify-center bg-gray-950 text-brand-red font-orbitron text-3xl"><VibeContentRenderer content="::FaUserShield className='mr-4'::" />ACCESS DENIED</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4 pt-24 font-mono bg-grid-pattern">
      <Card className="max-w-7xl mx-auto bg-black/70 border-2 border-brand-purple/50 shadow-2xl shadow-brand-purple/40 backdrop-blur-lg">
        <CardHeader>
          <CardTitle className="text-4xl font-orbitron text-brand-purple flex items-center cyber-text glitch" data-text="ALPHA ENGINE COMMAND DECK">
            <VibeContentRenderer content="::FaTerminal className='mr-4 text-5xl'::" /> ALPHA ENGINE COMMAND DECK
          </CardTitle>
          <CardDescription className="text-purple-300/80 mt-1">Manual control and diagnostics for the Arbitrage Engine.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Controls Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-gray-800/60 border border-gray-700 shadow-inner">
              <CardHeader><CardTitle className="text-xl font-orbitron text-brand-cyan">Engine Triggers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full bg-cyan-600 hover:bg-cyan-500 text-black font-semibold shadow-md hover:shadow-cyan-glow transition-all" onClick={() => handleTrigger('Market Data Fetch', triggerMarketDataFetch)} disabled={triggerStates['Market Data Fetch'] === 'loading'}>
                  {getButtonContent('Market Data Fetch', '::FaSatelliteDish::', 'Trigger Market Data Fetch')}
                </Button>
                <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-md hover:shadow-purple-glow transition-all" onClick={() => handleTrigger('Central Analyzer', triggerCentralAnalyzer)} disabled={triggerStates['Central Analyzer'] === 'loading'}>
                  {getButtonContent('Central Analyzer', '::FaBrain::', 'Trigger Central Analyzer')}
                </Button>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/60 border border-gray-700 shadow-inner">
              <CardHeader><CardTitle className="text-xl font-orbitron text-brand-orange">Data Viewer</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300" onClick={() => fetchRawData('market_data')} disabled={triggerStates.fetchRawData === 'loading'}>View Market Data</Button>
                <Button variant="outline" className="border-orange-500 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300" onClick={() => fetchRawData('arbitrage_opportunities')} disabled={triggerStates.fetchRawData === 'loading'}>View Opps (DB View)</Button>
              </CardContent>
            </Card>
          </div>

          {/* Logs & Data Section */}
          <div className="lg:col-span-3">
            <Card className="bg-black/50 border-gray-700 h-full">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2 bg-black/60 border-b border-gray-700">
                  <TabsTrigger value="logs" className="data-[state=active]:bg-brand-yellow data-[state=active]:text-black text-gray-400 font-semibold">Live Log</TabsTrigger>
                  <TabsTrigger value="data" className="data-[state=active]:bg-brand-yellow data-[state=active]:text-black text-gray-400 font-semibold">Raw Data</TabsTrigger>
                </TabsList>
                <TabsContent value="logs" className="flex-grow p-1">
                  <div className="bg-black p-3 rounded-b-md h-[450px] overflow-y-auto simple-scrollbar flex flex-col-reverse">
                    <AnimatePresence>
                      {logs.map((log, index) => (
                        <motion.p 
                          key={index} 
                          layout
                          initial={{ opacity: 0, y: -10 }} 
                          animate={{ opacity: 1, y: 0 }} 
                          transition={{ duration: 0.3 }} 
                          className="text-xs text-gray-300 whitespace-pre-wrap break-all border-b border-gray-800 py-1.5"
                        >
                          {log}
                        </motion.p>
                      ))}
                    </AnimatePresence>
                  </div>
                </TabsContent>
                <TabsContent value="data" className="flex-grow bg-black rounded-b-md p-1">
                  <div className="h-[450px] overflow-auto simple-scrollbar">
                    {triggerStates.fetchRawData === 'loading' ? (
                        <div className="flex h-full items-center justify-center text-brand-orange"><VibeContentRenderer content="::FaSpinner className='animate-spin text-2xl'::" /></div>
                    ) : (
                        <DataTable data={rawData || []} />
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Wrapper for Suspense, as per best practices
export default function ArbitrageTestAgentPageWrapper() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-950 text-white">Loading Command Deck...</div>}>
      <ArbitrageTestAgentPage />
    </Suspense>
  );
}