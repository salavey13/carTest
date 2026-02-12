"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Loader2, FileSpreadsheet, Database, Trash2, 
  ShieldQuestion, User, Sparkles, Building2
} from "lucide-react";
import { uploadWarehouseCsv, getUserCrews } from "@/app/wb/actions";
import { useAppContext } from "@/contexts/AppContext";
import { parse } from "papaparse";

// --- CONFIG ---

const normalizeHeader = (header: string): string => 
  header.toLowerCase().trim().replace(/[^a-zа-яё0-9]/g, '');

const COLUMN_MAP: Record<string, string> = {
  'артикул': 'id', 'id': 'id', 'sku': 'id', 'vendorcode': 'id',
  'количество': 'quantity', 'quantity': 'quantity', 'stock': 'quantity', 'остаток': 'quantity',
  'название': 'model', 'model': 'model', 'name': 'model',
  'бренд': 'make', 'make': 'make', 'brand': 'make',
  'размер': 'size', 'size': 'size',
  'сезон': 'season', 'season': 'season',
  'цвет': 'color', 'color': 'color',
};

interface ParsedItem {
  id: string;
  quantity: number;
  make: string;
  model: string;
  specs: Record<string, any>;
}

interface CrewInfo {
  id: string;
  name: string;
}

// --- COMPONENT ---

export function WarehouseMigrator() {
  const { dbUser } = useAppContext();
  
  const [csvData, setCsvData] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<{msg: string, type: string}[]>([]);
  
  // Состояния для выбора команды
  const [userCrews, setUserCrews] = useState<CrewInfo[]>([]);
  const [targetCrewId, setTargetCrewId] = useState<string>('personal');

  // Загрузка команд пользователя
  useEffect(() => {
    if (dbUser?.user_id) {
      getUserCrews(dbUser.user_id).then(crews => {
        setUserCrews(crews);
      });
    }
  }, [dbUser]);

  // --- PARSING LOGIC (RESTORED) ---
  const parsedItems = useMemo(() => {
    if (!csvData.trim()) return [];

    const result = parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
    });

    return result.data.map((row: any) => {
      const item: Partial<ParsedItem> = { specs: {} };
      
      Object.keys(row).forEach(key => {
        const systemKey = COLUMN_MAP[key];
        const value = row[key];
        if (!value) return;

        switch(systemKey) {
          case 'id': item.id = String(value).toLowerCase().trim(); break;
          case 'quantity': item.quantity = parseInt(String(value).replace(/[^\d.-]/g, ''), 10) || 0; break;
          case 'model': item.model = String(value); break;
          case 'make': item.make = String(value); break;
          case 'size': case 'season': case 'color': item.specs![systemKey] = String(value); break;
        }
      });

      if (!item.id) return null;

      // Fallbacks
      item.make = item.make || "Unknown";
      item.model = item.model || item.id;
      item.quantity = item.quantity || 0;
      
      return item as ParsedItem;
    }).filter(Boolean) as ParsedItem[];
  }, [csvData]);

  const addLog = (msg: string, type: string = 'info') => {
    setLogs(prev => [...prev.slice(-20), { msg, type }]);
  };

  // --- MIGRATION HANDLER ---
  const handleMigration = async () => {
    if (parsedItems.length === 0) return toast.error("Нет данных");
    
    setIsMigrating(true);
    setLogs([]);
    addLog(`Start processing ${parsedItems.length} items...`, 'info');

    const BATCH_SIZE = 20;
    let totalCreated = 0, totalUpdated = 0, totalDenied = 0;

    for (let i = 0; i < parsedItems.length; i += BATCH_SIZE) {
      const batch = parsedItems.slice(i, i + BATCH_SIZE);
      
      const payload = batch.map(item => ({
        "Артикул": item.id,
        "Количество": item.quantity,
        "make": item.make,
        "model": item.model,
        "specs": JSON.stringify(item.specs),
        "target_crew_id": targetCrewId !== 'personal' ? targetCrewId : null
      }));

      try {
        const res = await uploadWarehouseCsv(payload, dbUser?.user_id);
        if (res.success && res.stats) {
          totalCreated += res.stats.created;
          totalUpdated += res.stats.updated;
          totalDenied += res.stats.denied;
          addLog(`Batch OK: ${res.stats.created} new, ${res.stats.updated} upd, ${res.stats.denied} denied`, 'success');
        } else {
          throw new Error(res.error);
        }
      } catch (e: any) {
        addLog(`Batch Error: ${e.message}`, 'error');
      }
    }

    toast.success(`Done! Created: ${totalCreated}, Updated: ${totalUpdated}, Denied: ${totalDenied}`);
    setIsMigrating(false);
  };

  // --- UI ---
  return (
    <Card className="bg-black/90 border border-brand-cyan/20 shadow-2xl w-full max-w-3xl mx-auto backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-brand-cyan font-orbitron flex items-center gap-2 text-xl">
          <Database className="w-5 h-5" />
          SMART MIGRATOR V2
        </CardTitle>
        <CardDescription className="text-gray-500 text-xs font-mono">
          AUTO-DETECT COLUMNS • PERMISSION CHECK • CREW SUPPORT
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Permission Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-background/30 rounded border border-border/50">
          <div className="space-y-1">
            <label className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <ShieldQuestion className="w-3 h-3"/> Target Inventory
            </label>
            <Select value={targetCrewId} onValueChange={setTargetCrewId}>
              <SelectTrigger className="bg-black border-input">
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-400"/> Personal Inventory
                  </div>
                </SelectItem>
                {userCrews.map(crew => (
                  <SelectItem key={crew.id} value={crew.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-purple-400"/> {crew.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end text-[10px] text-muted-foreground">
            New items will be created in the selected inventory. 
            Existing items will be updated only if you have rights.
          </div>
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <Textarea 
            placeholder="Артикул; Количество; Название; Бренд; Сезон
SKU-001; 10; Одеяло 2x2; ИвановскийТекстиль; leto
SKU-002; 5; Подушка; DreamSoft; zima"
            className="font-mono bg-black border-gray-700 text-green-300 h-48 text-xs leading-relaxed focus:border-brand-cyan transition-all"
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            disabled={isMigrating}
          />
        </div>

        {/* Preview Stats */}
        {csvData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-between items-center text-xs font-mono p-2 bg-brand-cyan/5 border border-brand-cyan/20 rounded"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-brand-cyan"/>
              <span className="text-brand-cyan">Detected: {parsedItems.length} rows</span>
            </div>
            <div className="text-muted-foreground">
              Sample ID: <span className="text-white">{parsedItems[0]?.id || 'N/A'}</span>
            </div>
          </motion.div>
        )}

        {/* Logs Terminal */}
        <div className="bg-black border border-gray-800 rounded-md p-3 h-28 overflow-y-auto font-mono text-[10px] shadow-inner relative">
          {logs.length === 0 && !isMigrating && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-600 pointer-events-none">
              <span className="animate-pulse">_system_ready_</span>
            </div>
          )}
          <AnimatePresence>
            {logs.map((log, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mb-0.5 ${
                  log.type === 'success' ? 'text-green-400' : 
                  log.type === 'error' ? 'text-red-400' : 
                  'text-gray-400'
                }`}
              >
                {`> ${log.msg}`}
              </motion.div>
            ))}
          </AnimatePresence>
          {isMigrating && <span className="text-green-500 animate-pulse">_</span>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            onClick={handleMigration} 
            disabled={isMigrating || parsedItems.length === 0}
            className="flex-1 bg-gradient-to-r from-brand-cyan to-blue-600 text-white hover:from-brand-cyan/80 hover:to-blue-700 font-bold font-mono py-6 shadow-lg"
          >
            {isMigrating ? (
              <><Loader2 className="animate-spin mr-2" /> PROCESSING...</>
            ) : (
              <><Database className="mr-2 w-5 h-5" /> IMPORT DATA</>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => { setCsvData(''); setLogs([]); }}
            className="border-red-500/30 text-red-400 hover:bg-red-950 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}