"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { supabaseAdmin } from '@/hooks/supabase'; // Direct read-only access for admin pages is fine
import { triggerMarketDataFetch, triggerCentralAnalyzer } from './actions'; // <-- IMPORT FROM NEW DEDICATED FILE
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import { useAppContext } from '@/contexts/AppContext';

// Helper component for displaying data in a table
const DataTable: React.FC<{ data: any[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-gray-500 italic text-sm">No data to display.</p>;
  }
  const headers = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto simple-scrollbar">
      <table className="min-w-full text-xs text-left">
        <thead className="bg-gray-700/50">
          <tr>
            {headers.map(header => (
              <th key={header} className="p-2 font-semibold text-gray-300 uppercase tracking-wider">{header.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-800/60">
              {headers.map(header => (
                <td key={header} className="p-2 text-gray-400 whitespace-nowrap">
                  {String(row[header])}
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

  const handleTrigger = useCallback(async (actionName: string, actionFn: () => Promise<any>) => {
    setTriggerStates(prev => ({ ...prev, [actionName]: 'loading' }));
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] Triggering ${actionName}...`, ...prev]);

    try {
      const result = await actionFn();
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${actionName} Result: ${JSON.stringify(result, null, 2)}`, ...prev]);
      
      if (result.success) {
        toast.success(`${actionName} triggered successfully.`);
        setTriggerStates(prev => ({ ...prev, [actionName]: 'success' }));
      } else {
        toast.error(`Error triggering ${actionName}: ${result.error}`);
        setTriggerStates(prev => ({ ...prev, [actionName]: 'error' }));
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown client-side error";
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] CRITICAL ERROR on ${actionName}: ${errorMsg}`, ...prev]);
      toast.error(`Critical error on ${actionName}`);
      setTriggerStates(prev => ({ ...prev, [actionName]: 'error' }));
    }
    
    setTimeout(() => setTriggerStates(prev => ({ ...prev, [actionName]: 'idle' })), 3000);
  }, []);

  const fetchRawData = async (tableName: string) => {
    setTriggerStates(prev => ({ ...prev, fetchRawData: 'loading' }));
    setRawData(null);
    setActiveTab("data"); // Switch to data tab on fetch
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] Fetching raw data from ${tableName}...`, ...prev]);
    const { data, error } = await supabaseAdmin.from(tableName).select('*').limit(20).order('timestamp', { ascending: false });
    
    if (error) {
      toast.error(`Error fetching from ${tableName}: ${error.message}`);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] Fetch Error: ${error.message}`, ...prev]);
       setTriggerStates(prev => ({ ...prev, fetchRawData: 'error' }));
    } else {
      toast.success(`Fetched ${data.length} records from ${tableName}.`);
      setRawData(data);
      setTriggerStates(prev => ({ ...prev, fetchRawData: 'success' }));
    }
    setTimeout(() => setTriggerStates(prev => ({ ...prev, fetchRawData: 'idle' })), 3000);
  };

  if (isAuthLoading) {
     return <div className="flex h-screen items-center justify-center bg-gray-900 text-brand-cyan">Loading Auth...</div>;
  }
  if (!isAdmin) {
     return <div className="flex h-screen items-center justify-center bg-gray-900 text-brand-red">ACCESS DENIED</div>;
  }

  const getButtonContent = (actionName: string, icon: string, text: string) => {
    const state = triggerStates[actionName];
    if (state === 'loading') return <VibeContentRenderer content="::FaSpinner className='animate-spin'::" />;
    if (state === 'success') return <VibeContentRenderer content="::FaCheckCircle::" />;
    if (state === 'error') return <VibeContentRenderer content="::FaExclamationTriangle::" />;
    return <><VibeContentRenderer content={icon} className="mr-2" /> {text}</>;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 p-4 pt-24 font-mono">
      <Card className="max-w-7xl mx-auto bg-black/50 border border-brand-purple/50 shadow-2xl shadow-brand-purple/20">
        <CardHeader>
          <CardTitle className="text-4xl font-orbitron text-brand-purple flex items-center">
            <VibeContentRenderer content="::FaTerminal className='mr-4'::" /> ALPHA ENGINE COMMAND DECK
          </CardTitle>
          <CardDescription className="text-purple-300/80">Manual control and diagnostics for the Arbitrage Engine.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Controls Section */}
          <div className="md:col-span-2 space-y-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader><CardTitle className="text-xl font-orbitron text-brand-cyan">Engine Triggers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => handleTrigger('Market Data Fetch', triggerMarketDataFetch)} disabled={triggerStates['Market Data Fetch'] === 'loading'}>
                  {getButtonContent('Market Data Fetch', '::FaSatelliteDish::', 'Trigger Market Data Fetch')}
                </Button>
                <Button className="w-full" onClick={() => handleTrigger('Central Analyzer', triggerCentralAnalyzer)} disabled={triggerStates['Central Analyzer'] === 'loading'}>
                  {getButtonContent('Central Analyzer', '::FaBrain::', 'Trigger Central Analyzer')}
                </Button>
              </CardContent>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader><CardTitle className="text-xl font-orbitron text-brand-orange">Data Viewer</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => fetchRawData('market_data')} disabled={triggerStates.fetchRawData === 'loading'}>View Market Data</Button>
                <Button variant="outline" onClick={() => fetchRawData('arbitrage_opportunities')} disabled={triggerStates.fetchRawData === 'loading'}>View Opps (DB View)</Button>
              </CardContent>
            </Card>
          </div>

          {/* Logs & Data Section */}
          <div className="md:col-span-3">
            <Card className="bg-gray-900 border-gray-700 h-full">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 bg-black/50 border-b border-gray-700">
                        <TabsTrigger value="logs">Live Log</TabsTrigger>
                        <TabsTrigger value="data">Raw Data</TabsTrigger>
                    </TabsList>
                    <TabsContent value="logs" className="flex-grow">
                      <div className="bg-black p-3 rounded-b-md h-[450px] overflow-y-auto simple-scrollbar flex flex-col-reverse">
                        <AnimatePresence>
                          {logs.map((log, index) => (
                            <motion.p key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="text-xs text-gray-300 whitespace-pre-wrap break-words border-b border-gray-800 py-1.5">
                              {log}
                            </motion.p>
                          ))}
                        </AnimatePresence>
                      </div>
                    </TabsContent>
                    <TabsContent value="data" className="flex-grow p-3 bg-black rounded-b-md">
                        <div className="h-[450px] overflow-auto simple-scrollbar">
                            <DataTable data={rawData || []} />
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

export default ArbitrageTestAgentPage;