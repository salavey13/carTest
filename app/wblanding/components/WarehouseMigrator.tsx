"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Loader2, Database, Trash2, 
  ShieldQuestion, User, Sparkles, Building2, UploadCloud, Warehouse, Eye
} from "lucide-react";
import { uploadWarehouseCsv, getUserCrews } from "@/app/wb/actions";
import { useAppContext } from "@/contexts/AppContext";
import { parse } from "papaparse";
import * as XLSX from 'xlsx';

// --- CONFIG ---
const MAX_LOGS = 50;

const normalizeHeader = (header: string): string => 
  (header || "").toString().toLowerCase().trim().replace(/\s+/g, '');

const HEADER_KEYWORDS: Record<string, string> = {
  // ID
  'артикул': 'id', 
  'sku': 'id', 
  'vendorcode': 'id', 
  'vendor': 'id',
  'вашsku': 'id',

  // Quantity
  'количество': 'quantity', 
  'stock': 'quantity', 
  'остаток': 'quantity',
  'доступно': 'quantity', 
  'вналичии': 'quantity',
  'свободныйостаток': 'quantity',
  'доступнодлязаказа': 'quantity',

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

// --- TYPES ---
interface ParsedItem {
  id: string;
  quantity: number;
  make: string;
  model: string;
  specs: Record<string, string>;
  warehouse?: string;
}

interface CrewInfo {
  id: string;
  name: string;
}

interface RawRow {
  [key: string]: string | number | null | undefined;
  warehouse?: string;
}

// --- COMPONENT ---
export function WarehouseMigrator() {
  const { dbUser } = useAppContext();
  
  const [csvData, setCsvData] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [logs, setLogs] = useState<{msg: string, type: string}[]>([]);
  
  // Source Data State
  const [rawRows, setRawRows] = useState<RawRow[]>([]); // Stores all parsed rows
  const [availableWarehouses, setAvailableWarehouses] = useState<string[]>([]); // Detected warehouses
  const [selectedSourceWarehouse, setSelectedSourceWarehouse] = useState<string>(""); // Selected source filter
  
  // Destination State
  const [userCrews, setUserCrews] = useState<CrewInfo[]>([]);
  const [targetCrewId, setTargetCrewId] = useState<string>('personal');

  // logging util
  const addLog = useCallback((msg: string, type: string = 'info') => {
    setLogs(prev => [...prev.slice(-MAX_LOGS), { msg, type }]);
  }, []);

  useEffect(() => {
    if (dbUser?.user_id) getUserCrews(dbUser.user_id).then(setUserCrews).catch(e => {
      console.error(e);
      addLog("Failed to load crews", "error");
    });
  }, [dbUser, addLog]);

  // Unified JSON rows processor (used by CSV and XLSX branches)
  const processJsonRows = useCallback((jsonData: Record<string, unknown>[]) => {
    const warehouseSet = new Set<string>();
    const processedRows: RawRow[] = [];

    jsonData.forEach((row) => {
      const cleanRow: RawRow = {};
      Object.keys(row).forEach(key => {
        const type = detectColumnType(key);
        const cleanKey = type || normalizeHeader(key);
        let val = row[key];

        if (typeof val === 'string') {
          val = val.replace(/\n/g, ' ').trim();
        }

        cleanRow[cleanKey] = val as string | number | null | undefined;
      });

      if (typeof cleanRow.warehouse === 'string' && cleanRow.warehouse.length > 0) {
        warehouseSet.add(String(cleanRow.warehouse));
      }

      processedRows.push(cleanRow);
    });

    setRawRows(processedRows);

    if (warehouseSet.size > 1) {
      const whList = Array.from(warehouseSet);
      setAvailableWarehouses(whList);
      setSelectedSourceWarehouse(whList[0]);
      addLog(`Detected ${whList.length} warehouses. Please select one.`, 'info');
      toast.info(`Found ${whList.length} warehouses. Select one to proceed.`);
    } else if (warehouseSet.size === 1) {
      const single = Array.from(warehouseSet)[0];
      setAvailableWarehouses([single]);
      setSelectedSourceWarehouse(single);
      addLog(`Detected single warehouse: ${single}`, 'success');
    } else {
      setAvailableWarehouses([]);
      setSelectedSourceWarehouse("");
      addLog(`No warehouse column found. Processing all rows.`, 'info');
    }
  }, [addLog]);

  // --- FILE UPLOAD HANDLER ---
  const handleFileUpload = useCallback((file: File) => {
    if (!file) return;
    addLog(`Reading: ${file.name}...`, 'info');
    setRawRows([]); // Reset
    setAvailableWarehouses([]); // Reset
    setSelectedSourceWarehouse("");
    setCsvData("");

    const isCsv = file.name.toLowerCase().endsWith('.csv');

    if (isCsv) {
      parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => detectColumnType(h) || normalizeHeader(h),
        complete: (res) => {
          // papaparse returns array of objects, headers are already transformed
          processJsonRows(res.data as Record<string, unknown>[]);
        },
        error: (err) => {
          console.error(err);
          addLog("CSV parse failed", "error");
          toast.error("Failed to parse CSV");
        }
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', raw: false });

        // Find best sheet & header row like original logic (scan up to 50 rows)
        let bestSheetName: string | null = null;
        let bestHeaderRow: number = -1;
        let maxScore = 0;

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
          if (!rows || rows.length === 0) return;

          for (let i = 0; i < Math.min(50, rows.length); i++) {
            const row = rows[i];
            let currentScore = 0;
            // evaluate how many header keywords are present
            row.forEach(cell => {
              const type = detectColumnType(String(cell));
              if (type) currentScore++;
            });

            if (currentScore > maxScore && currentScore >= 2) {
              maxScore = currentScore;
              bestSheetName = sheetName;
              bestHeaderRow = i;
            }
          }
        });

        if (!bestSheetName || maxScore < 2) {
          throw new Error("Could not detect data headers.");
        }

        addLog(`Found headers in sheet "${bestSheetName}" at row ${bestHeaderRow + 1}`, 'success');

        // Use detected header row as range to convert sheet into JSON objects (keys from header row)
        const sheet = workbook.Sheets[bestSheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { range: bestHeaderRow, defval: "", raw: false });

        // Now normalize keys and extract warehouses
        processJsonRows(jsonData as Record<string, unknown>[]);
      } catch (err: any) {
        console.error(err);
        addLog(`Error: ${err?.message || String(err)}`, 'error');
        toast.error("Failed to parse file");
      }
    };

    reader.readAsArrayBuffer(file);
  }, [addLog, processJsonRows]);

  // Drag & Drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
  }, [handleFileUpload]);

  // --- FILTERING LOGIC ---
  // When user selects a warehouse or rawRows change, filter data and generate CSV
  useEffect(() => {
    if (rawRows.length === 0) return;

    const filtered = selectedSourceWarehouse 
      ? rawRows.filter(r => r.warehouse === selectedSourceWarehouse)
      : rawRows;

    if (filtered.length > 0) {
      const headers = Object.keys(filtered[0]);
      const csvString = [
        headers.join(','),
        ...filtered.map(row => 
          headers.map(h => {
            let val = (row as any)[h] ?? "";
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

    const seenIds = new Set<string>();

    return (result.data as any[]).map((row: any) => {
      const item: Partial<ParsedItem> = { specs: {} };

      // Normalize ID
      if (row.id) item.id = String(row.id).toLowerCase().trim();

      // Quantity: support "1.234,56" and "1,234.56" by replacing comma to dot and stripping other chars
      if (row.quantity !== undefined && row.quantity !== null && String(row.quantity).toString().trim() !== '') {
        const raw = String(row.quantity).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, '');
        const val = Number(raw);
        item.quantity = Number.isFinite(val) ? Math.round(val) : 0;
      }

      if (row.model) item.model = String(row.model);
      if (row.make) item.make = String(row.make);
      if (row.size) (item.specs as any).size = String(row.size);
      if (row.season) (item.specs as any).season = String(row.season);
      if (row.color) (item.specs as any).color = String(row.color);

      if (!item.id) return null;

      // dedupe
      if (seenIds.has(item.id)) {
        addLog(`Duplicate ID skipped: ${item.id}`, 'info');
        return null;
      }
      seenIds.add(item.id);

      item.make = item.make || "Unknown";
      item.model = item.model || item.id;
      item.quantity = item.quantity ?? 0;

      return item as ParsedItem;
    }).filter(Boolean) as ParsedItem[];
  }, [csvData, addLog]);

  // --- MIGRATION HANDLER ---
  const handleMigration = async () => {
    if (!dbUser?.user_id) {
      toast.error("User not initialized");
      return;
    }

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
        const res = await uploadWarehouseCsv(payload, dbUser.user_id);
        if (res && res.success) {
          const s = res.stats ?? { created: 0, updated: 0, denied: 0 };
          stats.created += s.created;
          stats.updated += s.updated;
          stats.denied += s.denied;
          addLog(`Batch ${Math.floor(i/BATCH_SIZE)+1}: +${s.created} new, ~${s.updated} upd`, 'success');
        } else {
          const errMsg = (res && res.error) ? String(res.error) : 'Unknown upload error';
          addLog(`Batch ${Math.floor(i/BATCH_SIZE)+1}: ${errMsg}`, 'error');
        }
      } catch (e: any) {
        addLog(`Error batch ${Math.floor(i/BATCH_SIZE)+1}: ${e?.message || String(e)}`, 'error');
      }
    }

    toast.success(`Complete! Created: ${stats.created}, Updated: ${stats.updated}`);
    setIsMigrating(false);
  };

  // Preview first 10 items
  const previewItems = parsedItems.slice(0, 10);

  return (
    <Card className="bg-card border border-border shadow-2xl w-full max-w-3xl mx-auto backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-brand-cyan font-orbitron flex items-center gap-2 text-xl">
          <Database className="w-5 h-5" /> SMART MIGRATOR V5
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

        {/* Preview */}
        {previewItems.length > 0 && (
          <div className="border rounded p-3 text-xs font-mono space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="w-4 h-4"/> Preview (first {previewItems.length})
            </div>
            {previewItems.map(it => (
              <div key={it.id} className="text-[12px]">
                <span className="font-mono">{it.id}</span> — qty: <b>{it.quantity}</b> — {it.make} / {it.model}
                {Object.keys(it.specs).length > 0 && (
                  <div className="text-[11px] text-muted-foreground">specs: {Object.entries(it.specs).map(([k,v]) => `${k}:${v}`).join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        )}

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