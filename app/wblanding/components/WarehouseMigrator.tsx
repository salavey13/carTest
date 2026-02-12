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
  ShieldQuestion, User, Sparkles, Building2, UploadCloud, Warehouse
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
  'вашsku': 'id', // "Ваш SKU *"
  
  // Quantity
  'количество': 'quantity', 
  'stock': 'quantity', 
  'остаток': 'quantity',
  'доступно': 'quantity', 
  'вналичии': 'quantity',
  'свободныйостаток': 'quantity',
  'доступнодлязаказа': 'quantity', // "Доступно для заказа *"

  // Warehouse (NEW)
  'склад': 'warehouse',

  // Name/Model
  'название': 'model', 
  'name': 'model', 
  'model': 'model',
  'наименование': 'model',
  'названиетовара': 'model',

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
  warehouse?: string;
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
  
  // Source Data State
  const [rawRows, setRawRows] = useState<any[]>([]); // Stores all parsed rows
  const [availableWarehouses, setAvailableWarehouses] = useState<string[]>([]); // Detected warehouses
  const [selectedSourceWarehouse, setSelectedSourceWarehouse] = useState<string>(""); // Selected source filter
  
  // Destination State
  const [userCrews, setUserCrews] = useState<CrewInfo[]>([]);
  const [targetCrewId, setTargetCrewId] = useState<string>('personal');

  useEffect(() => {
    if (dbUser?.user_id) getUserCrews(dbUser.user_id).then(setUserCrews);
  }, [dbUser]);

  // --- FILTERING LOGIC ---
  // When user selects a warehouse or rawRows change, filter data and generate CSV
  useEffect(() => {
    if (rawRows.length === 0) return;

    // Filter rows
    const filtered = selectedSourceWarehouse 
      ? rawRows.filter(r => r.warehouse === selectedSourceWarehouse)
      : rawRows;

    // Convert back to CSV for display
    if (filtered.length > 0) {
      const headers = Object.keys(filtered[0]);
      const csvString = [
        headers.join(','),
        ...filtered.map(row => 
          headers.map(h => {
            let val = row[h] || "";
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
              val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(',')
        )
      ].join('\n');
      setCsvData(csvString);
    } else {
      setCsvData('');
    }
  }, [selectedSourceWarehouse, rawRows]);

  // --- PARSING LOGIC (CSV Display -> Items) ---
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

  // --- FILE UPLOAD HANDLER ---
  const handleFileUpload = useCallback((file: File) => {
    if (!file) return;
    addLog(`Reading: ${file.name}...`, 'info');
    setRawRows([]); // Reset
    setAvailableWarehouses([]); // Reset

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', raw: false });

        let bestSheetName: string | null = null;
        let bestHeaderRow: number = -1;
        let bestHeaders: string[] = [];
        let maxScore = 0;

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          
          if (rows.length === 0) return;

          for (let i = 0; i < Math.min(50, rows.length); i++) {
            const row = rows[i];
            let currentScore = 0;
            const detectedHeaders: string[] = [];
            
            row.forEach(cell => {
              const type = detectColumnType(String(cell));
              if (type) {
                currentScore++;
                detectedHeaders.push(type);
              } else {
                detectedHeaders.push(normalizeHeader(String(cell)));
              }
            });

            if (currentScore > maxScore && currentScore >= 2) {
              maxScore = currentScore;
              bestSheetName = sheetName;
              bestHeaderRow = i;
              bestHeaders = detectedHeaders;
            }
          }
        });

        if (!bestSheetName || maxScore < 2) {
          throw new Error("Could not detect data headers.");
        }

        addLog(`Found headers in sheet "${bestSheetName}" at row ${bestHeaderRow + 1}`, 'success');

        // 2. Parse to JSON using detected headers
        const sheet = workbook.Sheets[bestSheetName];
        // We use header: 1 to manually map because sheet_to_json with header:1 is safer for dynamic header rows
        // But easier: use sheet_to_json with range.
        const jsonData = XLSX.utils.sheet_to_json(sheet, { 
            range: bestHeaderRow, 
            defval: "",
            raw: false 
        });

        // 3. Normalize Keys and Extract Warehouses
        const warehouseSet = new Set<string>();
        const processedRows: any[] = [];

        jsonData.forEach((row: any) => {
            const cleanRow: any = {};
            // Map original keys to our normalized keys
            Object.keys(row).forEach(key => {
                const type = detectColumnType(key);
                const cleanKey = type || normalizeHeader(key);
                let val = row[key];
                
                // Clean up newlines in values (common in warehouse names)
                if (typeof val === 'string') val = val.replace(/\n/g, ' ').trim();
                
                cleanRow[cleanKey] = val;
            });

            // Extract Warehouse if present
            if (cleanRow.warehouse) {
                warehouseSet.add(cleanRow.warehouse);
            }
            
            processedRows.push(cleanRow);
        });

        setRawRows(processedRows);

        // 4. Handle Warehouse Logic
        if (warehouseSet.size > 1) {
            const whList = Array.from(warehouseSet);
            setAvailableWarehouses(whList);
            setSelectedSourceWarehouse(whList[0]); // Auto-select first
            addLog(`Detected ${whList.length} warehouses. Please select one.`, 'info');
            toast.info(`Found ${whList.length} warehouses. Select one to proceed.`);
        } else if (warehouseSet.size === 1) {
            setAvailableWarehouses(Array.from(warehouseSet));
            setSelectedSourceWarehouse(Array.from(warehouseSet)[0]);
            addLog(`Detected single warehouse: ${Array.from(warehouseSet)[0]}`, 'success');
        } else {
            // No warehouse column
            setAvailableWarehouses([]);
            setSelectedSourceWarehouse("");
            addLog(`No warehouse column found. Processing all rows.`, 'info');
        }

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
          <Database className="w-5 h-5" /> SMART MIGRATOR V4
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs font-mono">
          MULTI-WAREHOUSE FILTER • AUTO-DETECT HEADERS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Selectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Warehouse Selector (Dynamic) */}
            {availableWarehouses.length > 1 && (
                <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded">
                    <label className="text-xs font-mono text-orange-500 flex items-center gap-1 mb-2">
                    <Warehouse className="w-3 h-3"/> Source Warehouse (Detected)
                    </label>
                    <Select value={selectedSourceWarehouse} onValueChange={setSelectedSourceWarehouse}>
                    <SelectTrigger className="bg-background border-input">
                        <SelectValue placeholder="Select warehouse..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableWarehouses.map(wh => (
                        <SelectItem key={wh} value={wh}>{wh}</SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>
            )}

            {/* Target Inventory Selector */}
            <div className={`space-y-1 ${availableWarehouses.length <= 1 ? 'md:col-span-2' : ''} p-4 bg-muted/50 rounded border border-border`}>
            <label className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                <ShieldQuestion className="w-3 h-3"/> Target Inventory (System)
            </label>
            <Select value={targetCrewId} onValueChange={setTargetCrewId}>
                <SelectTrigger className="bg-background border-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                <SelectItem value="personal"><div className="flex items-center gap-2"><User className="w-4 h-4 text-blue-500"/> Personal</div></SelectItem>
                {userCrews.map(crew => <SelectItem key={crew.id} value={crew.id}><Building2 className="inline w-4 h-4 text-purple-500 mr-2"/> {crew.name}</SelectItem>)}
                </SelectContent>
            </Select>
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
            <div className="flex items-center gap-2"><Sparkles className="w-3 h-3"/><span>Ready: {parsedItems.length} items</span></div>
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
          <Button variant="outline" size="icon" onClick={() => { setCsvData(''); setLogs([]); setRawRows([]); setAvailableWarehouses([]); }} className="border-red-500/30 text-red-500 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}