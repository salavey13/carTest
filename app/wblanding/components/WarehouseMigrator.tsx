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

// Map keys: "Normalized Header Keyword" -> "System Field"
const HEADER_KEYWORDS: Record<string, string> = {
  // ID (Priority match)
  'артикул': 'id', 
  'sku': 'id', 
  'vendorcode': 'id', 
  'vendor': 'id',
  
  // Quantity
  'количество': 'quantity', 
  'stock': 'quantity', 
  'остаток': 'quantity',
  'доступно': 'quantity', // "Доступно для заказа"
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

// Helper to detect column type from header text
const detectColumnType = (header: string): string | undefined => {
  const h = normalizeHeader(header);
  // Check exact matches first
  if (HEADER_KEYWORDS[h]) return HEADER_KEYWORDS[h];
  
  // Check partial matches (e.g. "ваш sku *" contains "sku")
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
      transformHeader: (h) => {
        // Use the smart detector for CSV parsing as well
        const type = detectColumnType(h);
        return type || normalizeHeader(h); // Fallback to normalized header
      },
    });

    return result.data.map((row: any) => {
      const item: Partial<ParsedItem> = { specs: {} };
      
      // We iterate over the TYPES detected (e.g., row['id'], row['quantity'])
      // But we need to be careful: multiple columns might map to 'id' in CSV if we aren't careful.
      // Let's map back from our known types.
      
      // Logic: find the column index that matches the type
      // However, Papaparse already renamed headers.
      // So we just look for 'id', 'quantity', etc.
      
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

  // --- FILE UPLOAD HANDLER (XLSX/CSV) ---
  const handleFileUpload = useCallback((file: File) => {
    if (!file) return;
    addLog(`Reading: ${file.name}...`, 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', raw: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // 1. Convert to Array of Arrays to find header
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        
        if (rows.length === 0) throw new Error("Empty sheet");

        // 2. SMART HEADER DETECTION
        let headerRowIndex = -1;
        let maxScore = 0;

        // Scan first 20 rows
        for (let i = 0; i < Math.min(20, rows.length); i++) {
          const row = rows[i];
          let currentScore = 0;
          
          // Calculate score based on how many keywords match in this row
          row.forEach(cell => {
            const type = detectColumnType(String(cell));
            if (type) currentScore++;
          });

          // If this row has more matching keywords than previous max, it's likely the header
          // Threshold: at least 2 matching columns to avoid false positives
          if (currentScore > maxScore && currentScore >= 2) {
            maxScore = currentScore;
            headerRowIndex = i;
          }
        }

        if (headerRowIndex === -1) {
          throw new Error("Could not find headers. Check the file format.");
        }

        addLog(`Headers found at row ${headerRowIndex + 1} (Score: ${maxScore})`, 'success');

        // 3. Convert specific range to CSV
        // We use sheet_to_csv starting from the detected header row
        // To do this, we manually slice the sheet range or just generate CSV from the row index
        
        // Easiest robust way: generate CSV from the rows array starting from header
        // But to keep formatting simple, let's just generate CSV for the user to see
        
        const csvRows = rows.slice(headerRowIndex);
        // Simple CSV generation (manual join to avoid extra dependencies)
        const csvString = csvRows.map(row => 
          row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma/newline
            let s = String(cell).replace(/"/g, '""');
            if (s.search(/(|,|\n|")/g) >= 0) s = `"${s}"`;
            return s;
          }).join(',')
        ).join('\n');

        setCsvData(csvString);
        toast.success(`Detected ${maxScore} columns. Ready to import.`);

      } catch (err: any) {
        console.error(err);
        addLog(`Error: ${err.message}`, 'error');
        toast.error("Parsing failed");
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
    <Card className="bg-black/90 border border-brand-cyan/20 shadow-2xl w-full max-w-3xl mx-auto backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-brand-cyan font-orbitron flex items-center gap-2 text-xl">
          <Database className="w-5 h-5" /> SMART MIGRATOR V3
        </CardTitle>
        <CardDescription className="text-gray-500 text-xs font-mono">
          AUTO-DETECT HEADERS • XLSX SUPPORT • WB/OZON READY
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
              <SelectTrigger className="bg-black border-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="personal"><div className="flex items-center gap-2"><User className="w-4 h-4 text-blue-400"/> Personal</div></SelectItem>
                {userCrews.map(crew => <SelectItem key={crew.id} value={crew.id}><Building2 className="inline w-4 h-4 text-purple-400 mr-2"/> {crew.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end text-[10px] text-muted-foreground">
            Supports complex headers (e.g., "Ваш SKU *", "Доступно для заказа").
          </div>
        </div>

        {/* Drop Zone */}
        <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} className="relative border-2 border-dashed border-border rounded-lg transition-colors hover:border-brand-cyan/50 group">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"/>
          <div className="p-4 flex flex-col items-center justify-center gap-2 text-center pointer-events-none">
            <UploadCloud className="w-8 h-8 text-muted-foreground group-hover:text-brand-cyan transition-colors"/>
            <div className="text-xs text-muted-foreground font-mono">Drop <span className="text-brand-cyan font-bold">XLSX</span> / CSV here</div>
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <Textarea 
            placeholder={`Артикул; Количество; Название; Бренд; Сезон
SKU-001; 10; Одеяло 2x2; ИвановскийТекстиль; leto`}
            className="font-mono bg-black border-gray-700 text-green-300 h-48 text-xs leading-relaxed focus:border-brand-cyan transition-all"
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            disabled={isMigrating}
          />
        </div>

        {/* Stats */}
        {csvData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-between items-center text-xs font-mono p-2 bg-brand-cyan/5 border border-brand-cyan/20 rounded">
            <div className="flex items-center gap-2"><Sparkles className="w-3 h-3 text-brand-cyan"/><span className="text-brand-cyan">Detected: {parsedItems.length} rows</span></div>
            <div className="text-muted-foreground">Sample ID: <span className="text-white">{parsedItems[0]?.id || 'N/A'}</span></div>
          </motion.div>
        )}

        {/* Logs */}
        <div className="bg-black border border-gray-800 rounded-md p-3 h-28 overflow-y-auto font-mono text-[10px] shadow-inner relative">
          {logs.length === 0 && !isMigrating && <div className="absolute inset-0 flex items-center justify-center text-gray-600"><span className="animate-pulse">_waiting_for_input_</span></div>}
          <AnimatePresence>
            {logs.map((log, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className={`mb-0.5 ${log.type === 'success' ? 'text-green-400' : log.type === 'error' ? 'text-red-400' : 'text-gray-400'}`}>
                {`> ${log.msg}`}
              </motion.div>
            ))}
          </AnimatePresence>
          {isMigrating && <span className="text-green-500 animate-pulse">_</span>}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleMigration} disabled={isMigrating || parsedItems.length === 0} className="flex-1 bg-gradient-to-r from-brand-cyan to-blue-600 text-white hover:from-brand-cyan/80 hover:to-blue-700 font-bold font-mono py-6 shadow-lg">
            {isMigrating ? <><Loader2 className="animate-spin mr-2" /> PROCESSING...</> : <><Database className="mr-2 w-5 h-5" /> IMPORT DATA</>}
          </Button>
          <Button variant="outline" size="icon" onClick={() => { setCsvData(''); setLogs([]); }} className="border-red-500/30 text-red-400 hover:bg-red-950"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}