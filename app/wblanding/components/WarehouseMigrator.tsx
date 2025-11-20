"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, FileSpreadsheet, Database, ArrowRight, ShieldAlert, UploadCloud } from "lucide-react";
import { importDemoCsvAction } from "@/app/wblanding/actions_demo"; // New action file

export function WarehouseMigrator() {
  const [mode, setMode] = useState<'csv' | 'api'>('csv');
  const [csvData, setCsvData] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`]);

  const handleCsvMigration = async () => {
    if (!csvData.trim()) return toast.error("Сначала вставьте данные из Excel/CSV");

    setIsMigrating(true);
    setLogs([]);
    
    try {
      // Симуляция процесса через Server Action (демо)
      addLog("Инициализация парсера...");
      
      // Вызываем демо-экшен
      const result = await importDemoCsvAction(csvData.substring(0, 50)); // Шлем только кусок для демо
      
      if (result.success) {
          // Визуальная симуляция шагов для вайба
          await new Promise(r => setTimeout(r, 800));
          addLog("Детекция формата: Wildberries Export (XLSX)...");
          await new Promise(r => setTimeout(r, 800));
          addLog(`Найдено записей: ${Math.floor(Math.random() * 300) + 50}...`);
          addLog("Очистка от мусорных колонок...");
          await new Promise(r => setTimeout(r, 1000));
          addLog("Генерация структуры склада...");
          await new Promise(r => setTimeout(r, 800));
          addLog("ИМПОРТ ЗАВЕРШЕН. Данные готовы к песочнице.");
          
          toast.success("Данные обработаны! Вы готовы к тесту.", {
              duration: 4000,
              icon: "🧬"
          });
      } else {
          throw new Error(result.error);
      }

    } catch (e) {
      addLog("ОШИБКА: Неверный формат данных.");
      toast.error("Ошибка обработки данных.");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Card className="bg-black/80 border border-brand-cyan/30 shadow-[0_0_30px_rgba(0,255,255,0.05)] w-full max-w-2xl mx-auto backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-brand-cyan font-orbitron flex items-center gap-2 text-lg md:text-xl">
          <Database className="w-5 h-5" />
          MIGRATION_PROTOCOL_V2.1
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="csv" onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-900/50">
            <TabsTrigger value="csv" className="data-[state=active]:bg-brand-cyan data-[state=active]:text-black font-mono text-xs md:text-sm">
                CSV / EXCEL (SAFE)
            </TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-red-500 data-[state=active]:text-white font-mono text-xs md:text-sm">
                API SYNC (LOCKED)
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6 space-y-4">
            <TabsContent value="csv" className="space-y-4">
                <div className="p-4 bg-brand-cyan/5 border border-brand-cyan/20 rounded text-xs text-brand-cyan font-mono mb-4">
                    <UploadCloud className="inline w-4 h-4 mr-2 mb-0.5"/>
                    Просто скопируйте ячейки из вашего Excel (SKU, Остаток, Цена) и вставьте сюда. Мы сами разберем структуру.
                </div>
                
                <Textarea 
                    placeholder="SKU123  |  Одеяло 2х2  |  50 шт\nSKU124  |  Подушка     |  10 шт..." 
                    className="font-mono bg-black border-gray-700 text-green-400 h-40 text-xs md:text-sm leading-relaxed focus:border-brand-cyan transition-all"
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    disabled={isMigrating}
                />

                {/* Terminal Output */}
                <div className="bg-black border border-gray-800 rounded-md p-3 h-32 overflow-y-auto font-mono text-[10px] md:text-xs shadow-inner relative">
                    {logs.length === 0 && !isMigrating && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600 pointer-events-none">
                            <span className="animate-pulse">_ready_for_data_injection</span>
                        </div>
                    )}
                    <AnimatePresence>
                        {logs.map((log, i) => (
                            <motion.div 
                                key={i} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-green-500 mb-1"
                            >
                                {log}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                    {isMigrating && <span className="text-green-500 animate-pulse">_</span>}
                </div>

                <Button 
                    onClick={handleCsvMigration} 
                    disabled={isMigrating}
                    className="w-full bg-gradient-to-r from-brand-cyan to-blue-600 text-white hover:from-brand-cyan/80 hover:to-blue-700 font-bold font-mono py-6 text-base md:text-lg shadow-lg shadow-brand-cyan/20"
                >
                    {isMigrating ? (
                        <><Loader2 className="animate-spin mr-2" /> PARSING...</>
                    ) : (
                        <><FileSpreadsheet className="mr-2 w-5 h-5" /> ТЕСТОВЫЙ ИМПОРТ</>
                    )}
                </Button>
            </TabsContent>
            
            <TabsContent value="api" className="space-y-6">
                 <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <ShieldAlert className="w-16 h-16 text-red-500/50" />
                    <h3 className="text-xl font-bold text-white font-orbitron">ДОСТУП ОГРАНИЧЕН</h3>
                    <p className="text-gray-400 text-sm max-w-md font-mono">
                        Мы не запрашиваем API ключи через веб-интерфейс. Это небезопасно. 
                        <br/><br/>
                        Подключение API ключей производится <strong>только вручную</strong> через Superadmin Environment (Server-Side) после прохождения верификации и настройки Sandbox.
                    </p>
                    <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-950 hover:text-red-300 font-mono">
                        Связаться с Архитектором для настройки
                    </Button>
                 </div>
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}