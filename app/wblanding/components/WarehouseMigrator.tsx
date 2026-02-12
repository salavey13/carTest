"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Loader2, FileSpreadsheet, Database, Trash2, 
  ShieldQuestion, User, Sparkles, Building2, UploadCloud
} from "lucide-react";
import { uploadWarehouseCsv, getUserCrews } from "@/app/wb/actions";
import { useAppContext } from "@/contexts/AppContext";
import { parse } from "papaparse";
import * as XLSX from 'xlsx';

// --- CONFIG ---

const normalizeHeader = (header: string): string => 
  (header || "").toString().toLowerCase().trim().replace(/\s+/g, '');

const HEADER_KEYWORDS: Record<string, string> = {
  // ID
  'артикул': 'id', 
  'sku': 'id', 
  'vendorcode': 'id', 
  'vendor': 'id',
  
  // Quantity
  'количество': 'quantity', 
  'stock': 'quantity', 
  'остаток': 'quantity',
  'доступно': 'quantity', 
  'вналичии': 'quantity',
  'свободныйостаток': 'quantity',

  // Name/Model
  'название': 'model', 
  'name': 'model', 
  'model': 'model',
  'наименование': 'model',
  'subject': 'model', 

  // Make/Brand
  'бренд': 'make', 
  'brand': 'make', 
  'make': 'make',

  // Specs
  'размер': 'size', 
  'сезон': 'season', 
  'цвет': 'color',
};

const detectColumnType = (header: string): string | undefined => {
  const h = normalizeHeader(header);
  if (HEADER_KEYWORDS[h]) return HEADER_KEYWORDS[h];
  
  for (const [keyword, type] of Object.entries(HEADER_KEYWORDS)) {
    if (h.includes(keyword)) return type;
  }
  return undefined;
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
  
  const [userCrews, setUserCrews] = useState<CrewInfo[]>([]);
  const [targetCrewId, setTargetCrewId] = useState<string>('personal');

  useEffect(() => {
    if (dbUser?.user_id) getUserCrews(dbUser.user_id).then(setUserCrews);
  }, [dbUser]);

  // --- PARSING LOGIC (CSV) ---
  const parsedItems = useMemo(() => {
    if (!csvData.trim()) return [];

    const result = parse(csvData, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => detectColumnType(h) || normalizeHeader(h),
    });

    return result.data.map((row: any) => {
      const item: Partial<ParsedItem> = { specs: {} };
      
      if (row.id) item.id = String(row.id).toLowerCase().trim();
      if (row.quantity) item.quantity = parseInt(String(row.quantity).replace(/[^\d.-]/g, ''), 10) || 0;
      if (row.model) item.model = String(row.model);
      if (row.make) item.make = String(row.make);
      if (row.size) item.specs.size = String(row.size);
      if (row.season) item.specs.season = String(row.season);
      if (row.color) item.specs.color = String(row.color);

      if (!item.id) return null;
      item.make = item.make || "Unknown";
      item.model = item.model || item.id;
      item.quantity = item.quantity || 0;
      
      return item as ParsedItem;
    }).filter(Boolean) as ParsedItem[];
  }, [csvData]);

  const addLog = (msg: string, type: string = 'info') => setLogs(prev => [...prev.slice(-20), { msg, type }]);

  // --- FILE UPLOAD HANDLER (ROBUST) ---
  const handleFileUpload = useCallback((file: File) => {
    if (!file) return;
    addLog(`Reading: ${file.name}...`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', raw: false });

        // 1. SEARCH ACROSS ALL SHEETS & DEEP ROWS
        let bestSheetName: string | null = null;
        let bestHeaderRow: number = -1;
        let maxScore = 0;

        // Iterate all sheets
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          
          if (rows.length === 0) return;

          // Iterate deep into rows (up to 50) to find headers
          for (let i = 0; i < Math.min(50, rows.length); i++) {
            const row = rows[i];
            let currentScore = 0;
            
            row.forEach(cell => {
              if (detectColumnType(String(cell))) currentScore++;
            });

            // Logic: Find the row with the MOST matches (minimum 2 to avoid false positives)
            if (currentScore > maxScore && currentScore >= 2) {
              maxScore = currentScore;
              bestSheetName = sheetName;
              bestHeaderRow = i;
            }
          } 
          // FIX: Removed extra ')' here that caused the syntax error
        });

        if (!bestSheetName || maxScore < 2) {
          throw new Error("Could not detect data headers. Ensure columns like 'Артикул' or 'Количество' exist.");
        }

        addLog(`Found headers in sheet "${bestSheetName}" at row ${bestHeaderRow + 1}`, 'success');

        // 2. PROCESS BEST SHEET
        const sheet = workbook.Sheets[bestSheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        
        // Slice data starting from header
        const csvRows = rows.slice(bestHeaderRow);
        
        // Convert back to CSV string for the UI
        const csvString = csvRows.map(row => 
          row.map(cell => {
            let s = String(cell).replace(/"/g, '""');
            if (s.search(/("|,|\n)/g) >= 0) s = `"${s}"`;
            return s;
          }).join(',')
        ).join('\n');

        setCsvData(csvString);
        toast.success(`Parsed ${maxScore} key columns successfully.`);

      } catch (err: any) {
        console.error(err);
        addLog(`Error: ${err.message}`, 'error');
        toast.error("Failed to parse file");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // Drag & Drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
  }, [handleFileUpload]);

  // --- MIGRATION HANDLER ---
  const handleMigration = async () => {
    if (parsedItems.length === 0) return toast.error("Нет данных");
    
    setIsMigrating(true);
    setLogs([]);
    addLog(`Processing ${parsedItems.length} items...`, 'info');

    const BATCH_SIZE = 20;
    let stats = { created: 0, updated: 0, denied: 0 };

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
          stats.created += res.stats.created;
          stats.updated += res.stats.updated;
          stats.denied += res.stats.denied;
          addLog(`Batch ${Math.floor(i/BATCH_SIZE)+1}: +${res.stats.created} new, ~${res.stats.updated} upd`, 'success');
        } else throw new Error(res.error);
      } catch (e: any) {
        addLog(`Error batch ${Math.floor(i/BATCH_SIZE)+1}: ${e.message}`, 'error');
      }
    }

    toast.success(`Complete! Created: ${stats.created}, Updated: ${stats.updated}`);
    setIsMigrating(false);
  };

  return (
    <Card className="bg-card border border-border shadow-2xl w-full max-w-3xl mx-auto backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-brand-cyan font-orbitron flex items-center gap-2 text-xl">
          <Database className="w-5 h-5" /> SMART MIGRATOR V3
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs font-mono">
          AUTO-DETECT HEADERS (DEEP SCAN) • LIGHT/DARK MODE
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Permission Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded border border-border">
          <div className="space-y-1">
            <label className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <ShieldQuestion className="w-3 h-3"/> Target Inventory
            </label>
            <Select value={targetCrewId} onValueChange={setTargetCrewId}>
              <SelectTrigger className="bg-background border-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal"><div className="flex items-center gap-2"><User className="w-4 h-4 text-blue-500"/> Personal</div></SelectItem>
                {userCrews.map(crew => <SelectItem key={crew.id} value={crew.id}><Building2 className="inline w-4 h-4 text-purple-500 mr-2"/> {crew.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end text-[10px] text-muted-foreground">
            Detects headers anywhere in the first 50 rows. Supports XLSX/CSV.
          </div>
        </div>

        {/* Drop Zone */}
        <div 
          onDrop={handleDrop} 
          onDragOver={(e) => e.preventDefault()} 
          className="relative border-2 border-dashed border-border rounded-lg transition-colors hover:border-brand-cyan/50 hover:bg-muted/20 group cursor-pointer"
        >
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
          <div className="p-6 flex flex-col items-center justify-center gap-2 text-center pointer-events-none">
            <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-brand-cyan transition-colors"/>
            <div className="text-xs text-muted-foreground font-mono">
              Drop <span className="text-brand-cyan font-bold">XLSX</span> / CSV here
            </div>
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <Textarea 
            placeholder={`Артикул; Количество; Название; Бренд; Сезон
SKU-001; 10; Одеяло 2x2; ИвановскийТекстиль; leto`}
            className="font-mono bg-background border-input text-foreground h-48 text-xs leading-relaxed focus:border-brand-cyan transition-all dark:bg-zinc-900"
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            disabled={isMigrating}
          />
        </div>

        {/* Stats */}
        {csvData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between items-center text-xs font-mono p-2 bg-brand-cyan/10 border border-brand-cyan/20 rounded text-brand-cyan">
            <div className="flex items-center gap-2"><Sparkles className="w-3 h-3"/><span>Detected: {parsedItems.length} rows</span></div>
            <div className="opacity-70">Sample ID: <span className="font-bold">{parsedItems[0]?.id || 'N/A'}</span></div>
          </motion.div>
        )}

        {/* Logs Terminal */}
        <div className="bg-muted/50 dark:bg-black border border-border rounded-md p-3 h-28 overflow-y-auto font-mono text-[10px] shadow-inner relative">
          {logs.length === 0 && !isMigrating && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
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
                  log.type === 'success' ? 'text-green-600 dark:text-green-400' : 
                  log.type === 'error' ? 'text-red-600 dark:text-red-400' : 
                  'text-muted-foreground'
                }`}
              >
                {`> ${log.msg}`}
              </motion.div>
            ))}
          </AnimatePresence>
          {isMigrating && <span className="text-brand-cyan animate-pulse">_</span>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button 
            onClick={handleMigration} 
            disabled={isMigrating || parsedItems.length === 0} 
            className="flex-1 bg-gradient-to-r from-brand-cyan to-blue-600 text-white hover:from-brand-cyan/90 hover:to-blue-700 font-bold font-mono py-6 shadow-lg dark:shadow-brand-cyan/20"
          >
            {isMigrating ? <><Loader2 className="animate-spin mr-2" /> PROCESSING...</> : <><Database className="mr-2 w-5 h-5" /> IMPORT DATA</>}
          </Button>
          <Button variant="outline" size="icon" onClick={() => { setCsvData(''); setLogs([]); }} className="border-red-500/30 text-red-500 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}