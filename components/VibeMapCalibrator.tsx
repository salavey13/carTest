"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { saveMapPreset } from '@/lib/map-actions';
import { cn } from '@/lib/utils';
import { Loading } from './Loading';
import Image from 'next/image';
import { 
  project, unproject, GeoBounds,
  getRenderBox, calculateBoundsFromPoints, validateBounds, formatBounds,
  clamp, pixelToPercent, percentToPixel, formatCoordinate,
  DEFAULT_MAP_IMAGE, FALLBACK_MAP_IMAGE, generateStorageKey
} from "@/lib/map-utils";

interface Point { id: string; name: string; coords: [number, number]; }
type PixelPosition = { x: number; y: number };
type Size = { width: number; height: number };

const REFERENCE_POINTS: Point[] = [
  { id: 'aska', name: 'Аська', coords: [56.330, 44.018] },
  { id: 'airport', name: 'Аэропорт Стригино', coords: [56.229, 43.784] },
];

export function VibeMapCalibrator({ initialBounds }: { initialBounds: GeoBounds }) {
  const { dbUser } = useAppContext();
  const [mapUrl, setMapUrl] = useState(DEFAULT_MAP_IMAGE);
  const [currentImageUrl, setCurrentImageUrl] = useState(DEFAULT_MAP_IMAGE);
  const [presetName, setPresetName] = useState("");
  const [bounds, setBounds] = useState<GeoBounds>(initialBounds);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [positions, setPositions] = useState<Record<string, PixelPosition>>({});
  const [calculatedBounds, setCalculatedBounds] = useState<GeoBounds | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [containerSize, setContainerSize] = useState<Size>({ width: 1, height: 1 });
  const [coordFormat, setCoordFormat] = useState<'dd' | 'dms'>('dd');
  
  // ✅ ALWAYS-VISIBLE DEBUG LOGS (no cropping, scrollable)
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const entry = `[${timestamp}] ${msg}`;
    console.log(`[Calibrator] ${msg}`);
    setDebugLogs(prev => [...prev, entry].slice(-50)); // Keep last 50 lines
  }, []);
  
  // ✅ REFS FOR FRESH VALUES IN CALLBACKS (avoid stale closures)
  const imageSizeRef = useRef<Size | null>(null);
  const renderBoxRef = useRef<ReturnType<typeof getRenderBox> | null>(null);
  const positionsRef = useRef<Record<string, PixelPosition>>({});
  const containerSizeRef = useRef<Size>({ width: 1, height: 1 });
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const storageKey = useMemo(() => generateStorageKey(initialBounds, "vibecal"), [initialBounds]);

  // Update refs when state changes
  useEffect(() => { imageSizeRef.current = imageSize; }, [imageSize]);
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  useEffect(() => { containerSizeRef.current = containerSize; }, [containerSize]);
  
  const renderBox = useMemo(() => {
    const box = imageSize ? getRenderBox(containerSize, imageSize) : null;
    renderBoxRef.current = box;
    return box;
  }, [containerSize, imageSize]);

  // Restore state
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.presetName) setPresetName(parsed.presetName);
        if (parsed.coordFormat) setCoordFormat(parsed.coordFormat);
        if (parsed.mapUrl) {
          setMapUrl(parsed.mapUrl);
          setCurrentImageUrl(parsed.mapUrl);
        }
      }
    } catch (e) {
      log(`Restore failed: ${e}`);
    }
  }, [storageKey, log]);

  // Persist state
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ presetName, coordFormat, mapUrl }));
      } catch (e) {
        log(`Persist failed: ${e}`);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [presetName, coordFormat, mapUrl, storageKey, log]);

  useEffect(() => {
    setIsImageLoading(true);
    setImageSize(null);
    setCalculatedBounds(null);
    log(`Image URL changed: ${mapUrl?.slice(0, 50)}...`);
  }, [mapUrl, log]);

  useEffect(() => {
    if (mapUrl) setCurrentImageUrl(mapUrl);
  }, [mapUrl]);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      const newSize = { width: el.offsetWidth, height: el.offsetHeight };
      setContainerSize(newSize);
      log(`Container: ${newSize.width}x${newSize.height}`);
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [log]);

  const startCalibration = useCallback(() => {
    if (!imageSize || !mapContainerRef.current) {
      toast.warning("Изображение карты еще не загружено.");
      log("❌ Start blocked: missing imageSize or container");
      return;
    }
    
    log(`✅ Starting calibration`);
    log(`   Bounds: ${JSON.stringify(bounds)}`);
    log(`   Image: ${imageSize.width}x${imageSize.height}`);
    log(`   Container: ${containerSize.width}x${containerSize.height}`);
    log(`   RenderBox: ${renderBox ? `${renderBox.width.toFixed(0)}x${renderBox.height.toFixed(0)} +${renderBox.offsetX.toFixed(0)},+${renderBox.offsetY.toFixed(0)}` : 'null'}`);
    
    const initialPositions: Record<string, PixelPosition> = {};
    let hasValidProjection = true;
    
    REFERENCE_POINTS.forEach(p => {
      const pos = project(p.coords[0], p.coords[1], bounds);
      log(`   Project ${p.id}: ${p.coords} → ${pos ? `${pos.x.toFixed(1)}%,${pos.y.toFixed(1)}%` : 'null'}`);
      
      if (pos && pos.x >= 10 && pos.x <= 90 && pos.y >= 10 && pos.y <= 90) {
        initialPositions[p.id] = pos;
      } else {
        hasValidProjection = false;
        initialPositions[p.id] = p.id === 'aska' ? { x: 25, y: 70 } : { x: 75, y: 30 };
        log(`   → Using fallback for ${p.id}: ${JSON.stringify(initialPositions[p.id])}`);
      }
    });
    
    setPositions(initialPositions);
    setCalculatedBounds(null);
    setIsCalibrating(true);
    log(`✅ Calibration started with positions: ${JSON.stringify(initialPositions)}`);
    
    toast.info("Перетащите точки на реальные позиции", { duration: 3000 });
  }, [bounds, imageSize, containerSize, renderBox, log]);

  // ✅ BOUNDS RECALC — USES REFS FOR FRESH VALUES
  const recalcBounds = useCallback((currentPositions: Record<string, PixelPosition>) => {
    log(`🔄 recalcBounds called`);
    
    const imgSize = imageSizeRef.current;
    const rBox = renderBoxRef.current;
    
    if (!imgSize) { log("❌ imageSizeRef is null"); return; }
    if (!rBox) { log("❌ renderBoxRef is null"); return; }
    
    const p1 = REFERENCE_POINTS[0];
    const p2 = REFERENCE_POINTS[1];
    const pos1 = currentPositions[p1.id];
    const pos2 = currentPositions[p2.id];
    
    log(`   Positions: P1=${pos1?.x?.toFixed(1) ?? 'null'}%,${pos1?.y?.toFixed(1) ?? 'null'}% | P2=${pos2?.x?.toFixed(1) ?? 'null'}%,${pos2?.y?.toFixed(1) ?? 'null'}%`);
    
    if (!pos1 || !pos2 || !isFinite(pos1.x) || !isFinite(pos1.y) || !isFinite(pos2.x) || !isFinite(pos2.y)) {
      log("❌ Invalid positions");
      return;
    }
    
    // Convert percentage (0-100) to NATURAL image pixels
    const x1 = (pos1.x / 100) * imgSize.width;
    const y1 = (pos1.y / 100) * imgSize.height;
    const x2 = (pos2.x / 100) * imgSize.width;
    const y2 = (pos2.y / 100) * imgSize.height;
    
    log(`   Natural pixels: P1=(${x1.toFixed(1)}, ${y1.toFixed(1)}) | P2=(${x2.toFixed(1)}, ${y2.toFixed(1)})`);
    log(`   Image size: ${imgSize.width}x${imgSize.height}`);
    
    // Validate bounds
    const margin = 20;
    if (x1 < -margin || x1 > imgSize.width + margin || y1 < -margin || y1 > imgSize.height + margin ||
        x2 < -margin || x2 > imgSize.width + margin || y2 < -margin || y2 > imgSize.height + margin) {
      log(`⚠️ Pixels outside image (margin=${margin})`);
      return;
    }
    
    if (Math.abs(x2 - x1) < 5 || Math.abs(y2 - y1) < 5) {
      log(`⚠️ Points too close: dx=${Math.abs(x2-x1).toFixed(1)}, dy=${Math.abs(y2-y1).toFixed(1)}`);
      return;
    }
    
    log(`🧮 Calling calculateBoundsFromPoints...`);
    
    const newBounds = calculateBoundsFromPoints(
      { lat: p1.coords[0], lon: p1.coords[1], pixelX: x1, pixelY: y1 },
      { lat: p2.coords[0], lon: p2.coords[1], pixelX: x2, pixelY: y2 },
      imgSize.width,
      imgSize.height
    );
    
    log(`📦 calculateBoundsFromPoints returned: ${newBounds ? JSON.stringify(newBounds) : 'null'}`);
    
    if (newBounds) {
      const errors = validateBounds(newBounds);
      if (errors.length === 0) {
        setCalculatedBounds(newBounds);
        log(`✅✅✅ BOUNDS UPDATED: ${newBounds.top.toFixed(4)}, ${newBounds.left.toFixed(4)}, ${newBounds.bottom.toFixed(4)}, ${newBounds.right.toFixed(4)}`);
      } else {
        log(`⚠️ Validation errors: ${errors.join('; ')} (keeping previous bounds)`);
      }
    } else {
      log(`⚠️ Calculation returned null (keeping previous bounds)`);
    }
  }, [log]);

  // ✅ DRAG HANDLER — USES REFS + ABSOLUTE POSITIONING
  const handlePointDragEnd = useCallback((pointId: string, _event: any, info: any) => {
    log(`🖱️ DragEnd ${pointId}`);
    
    if (!mapContainerRef.current) { log("❌ No container ref"); return; }
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    const prev = positionsRef.current[pointId];
    
    if (!prev) { log(`❌ No prev position for ${pointId}`); return; }
    log(`   Prev: ${prev.x.toFixed(1)}%, ${prev.y.toFixed(1)}%`);
    
    // Get final pointer position (absolute screen coords)
    const finalX = info.point?.[0];
    const finalY = info.point?.[1];
    
    log(`   Pointer: ${finalX}, ${finalY} (container: ${rect.left}, ${rect.top})`);
    
    if (!isFinite(finalX) || !isFinite(finalY)) {
      log("❌ Invalid pointer position");
      return;
    }
    
    const cs = containerSizeRef.current;
    if (cs.width <= 0 || cs.height <= 0) {
      log(`❌ Invalid containerSize: ${cs.width}x${cs.height}`);
      return;
    }
    
    // Convert to percentage of container
    const percentX = clamp(((finalX - rect.left) / cs.width) * 100, 0, 100);
    const percentY = clamp(((finalY - rect.top) / cs.height) * 100, 0, 100);
    
    log(`   New: ${percentX.toFixed(1)}%, ${percentY.toFixed(1)}%`);
    
    // Update state
    const newPositions = { ...positionsRef.current, [pointId]: { x: percentX, y: percentY } };
    setPositions(newPositions);
    
    // Recalc bounds
    recalcBounds(newPositions);
  }, [recalcBounds, log]);

  const calibrationBoxStyle = useMemo(() => {
    if (!isCalibrating || !renderBox) return { display: 'none' };
    const pos1 = positions[REFERENCE_POINTS[0].id];
    const pos2 = positions[REFERENCE_POINTS[1].id];
    if (!pos1 || !pos2) return { display: 'none' };
    
    const x1 = percentToPixel(pos1.x, renderBox.offsetX, renderBox.width);
    const y1 = percentToPixel(pos1.y, renderBox.offsetY, renderBox.height);
    const x2 = percentToPixel(pos2.x, renderBox.offsetX, renderBox.width);
    const y2 = percentToPixel(pos2.y, renderBox.offsetY, renderBox.height);
    
    return {
      left: `${Math.min(x1, x2)}px`,
      top: `${Math.min(y1, y2)}px`,
      width: `${Math.abs(x2 - x1)}px`,
      height: `${Math.abs(y2 - y1)}px`,
      display: 'block',
    };
  }, [isCalibrating, renderBox, positions]);

  const handleSave = async () => {
    if (!calculatedBounds || !presetName.trim() || !dbUser?.user_id) {
      toast.error("Имя пресета и вычисленные границы обязательны для сохранения.");
      return;
    }
    
    const errors = validateBounds(calculatedBounds);
    if (errors.length > 0) {
      toast.error(`Некорректные границы: ${errors.join('; ')}`);
      return;
    }
    
    setIsSaving(true);
    try {
      const result = await saveMapPreset(dbUser.user_id, presetName.trim(), currentImageUrl, calculatedBounds, false);
      if (result.success && result.data) {
        setIsCalibrating(false);
        setBounds(calculatedBounds);
        setPresetName("");
        toast.success(`Пресет "${result.data.name}" сохранен!`);
        log(`✅ Preset saved: ${result.data.name}`);
      } else {
        throw new Error(result.error || "Неизвестная ошибка");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
      log(`❌ Save error: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestClick = useCallback((e: React.MouseEvent) => {
    if (!calculatedBounds || !imageSize || !renderBox) return;
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const imgX = pixelToPercent(clickX, renderBox.offsetX, renderBox.width);
    const imgY = pixelToPercent(clickY, renderBox.offsetY, renderBox.height);
    
    const result = unproject(imgX, imgY, calculatedBounds);
    if (result) {
      toast.info(`🎯 ${formatCoordinate(result[0], true, coordFormat)} ${formatCoordinate(result[1], false, coordFormat)}`, { duration: 3000 });
    }
  }, [calculatedBounds, imageSize, renderBox, coordFormat]);

  const handleImageError = useCallback(() => {
    if (currentImageUrl !== FALLBACK_MAP_IMAGE) {
      setCurrentImageUrl(FALLBACK_MAP_IMAGE);
      toast.error("Изображение не загрузилось — используем fallback", { duration: 4000 });
      log(`❌ Image error, switched to fallback`);
    }
  }, [currentImageUrl, log]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-sm font-mono text-zinc-400 mb-1.5 block">URL Изображения Карты</label>
            <Input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} className="input-cyber font-mono text-xs" placeholder="https://..." />
          </div>
          <div>
            <label className="text-sm font-mono text-zinc-400 mb-1.5 block">Формат Координат</label>
            <div className="flex gap-1 p-1 rounded-lg bg-white/5">
              <Button size="sm" variant={coordFormat === 'dd' ? 'default' : 'ghost'} onClick={() => setCoordFormat('dd')} className={cn("flex-1 text-xs", coordFormat === 'dd' && "bg-brand-lime text-black")}>Decimal</Button>
              <Button size="sm" variant={coordFormat === 'dms' ? 'default' : 'ghost'} onClick={() => setCoordFormat('dms')} className={cn("flex-1 text-xs", coordFormat === 'dms' && "bg-brand-lime text-black")}>DMS</Button>
            </div>
          </div>
        </div>
        
        <div ref={mapContainerRef} className="relative w-full aspect-[3/4] sm:aspect-[16/9] lg:aspect-[21/8] overflow-hidden rounded-2xl border border-brand-purple/30 bg-slate-950/80 shadow-2xl" onClick={calculatedBounds ? handleTestClick : undefined}>
          {currentImageUrl && (
            <>
              <Image src={currentImageUrl} alt="Map backdrop" fill className="pointer-events-none object-cover scale-110 opacity-35 blur-2xl saturate-125" unoptimized onError={handleImageError} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.14),rgba(2,6,23,0.55))]" />
            </>
          )}
          
          {isImageLoading && <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40"><Loading text="ЗАГРУЗКА КАРТЫ..." /></div>}
          
          {currentImageUrl && <Image src={currentImageUrl} alt="Map Background" fill className={cn("pointer-events-none object-contain transition-opacity duration-300", isImageLoading ? "opacity-0" : "opacity-100")} onLoadingComplete={(img) => { setImageSize({width: img.naturalWidth, height: img.naturalHeight}); setIsImageLoading(false); log(`✅ Image loaded: ${img.naturalWidth}x${img.naturalHeight}`); }} onError={handleImageError} unoptimized />}
          
          <div style={calibrationBoxStyle} className="absolute border-2 border-dashed border-brand-cyan/70 bg-brand-cyan/5 pointer-events-none rounded-xl transition-all duration-200 z-10" />
          
          {isCalibrating && renderBox && (
            <svg className="absolute pointer-events-none opacity-20 z-0" style={{ left: renderBox.offsetX, top: renderBox.offsetY, width: renderBox.width, height: renderBox.height }}>
              {[...Array(11)].map((_, i) => (
                <g key={i}>
                  <line x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="white" strokeWidth="0.5" />
                  <line x1="0" y1={`${i * 10}%`} x2="100%" y2={`${i * 10}%`} stroke="white" strokeWidth="0.5" />
                </g>
              ))}
            </svg>
          )}
          
          {isCalibrating ? (
            REFERENCE_POINTS.map(point => (
              <motion.div 
                key={point.id} 
                className="absolute z-20" 
                style={{ 
                  left: `${positions[point.id]?.x ?? 50}%`, 
                  top: `${positions[point.id]?.y ?? 50}%`, 
                  transform: 'translate(-50%, -50%)' 
                }}
              >
                <motion.div 
                  drag 
                  dragMomentum={false}
                  dragElastic={0}
                  onDragEnd={(e, info) => handlePointDragEnd(point.id, e, info)}
                  className="flex h-10 w-10 sm:h-12 sm:w-12 cursor-grab items-center justify-center rounded-full bg-gradient-to-br from-brand-lime to-brand-cyan text-black shadow-lg ring-2 ring-white/30 active:cursor-grabbing"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="focus:outline-none focus:ring-2 focus:ring-brand-lime rounded-full">
                        <VibeContentRenderer content="::FaLocationDot::" className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-dark-card/95 border-brand-lime/30">
                      <p className="font-mono text-sm">{point.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              </motion.div>
            ))
          ) : (
            imageSize && renderBox && REFERENCE_POINTS.map(point => {
              const projected = project(point.coords[0], point.coords[1], bounds);
              if (!projected) return null;
              const pixelX = percentToPixel(projected.x, renderBox.offsetX, renderBox.width);
              const pixelY = percentToPixel(projected.y, renderBox.offsetY, renderBox.height);
              return <div key={point.id} className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full ring-2 ring-white/50 z-10" style={{ left: `${(pixelX / containerSize.width) * 100}%`, top: `${(pixelY / containerSize.height) * 100}%`, transform: 'translate(-50%, -50%)', backgroundColor: point.id === 'aska' ? '#FF69B4' : '#00CED1' }} />;
            })
          )}
        </div>

        {/* ✅ ALWAYS-VISIBLE DEBUG PANEL — SCROLLABLE, NO CROPPING */}
        <div className="bg-black/60 rounded-lg border border-white/10 p-3 font-mono text-[10px] text-zinc-300">
          <div className="flex items-center justify-between mb-2 sticky top-0 bg-black/80 py-1">
            <span className="text-xs text-brand-cyan font-bold">🔍 DEBUG LOGS (live)</span>
            <button onClick={() => setDebugLogs([])} className="text-[10px] text-brand-lime hover:underline">Clear</button>
          </div>
          <div className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all simple-scrollbar">
            {debugLogs.length === 0 ? (
              <span className="text-zinc-500">No logs yet — start calibration to see debug output</span>
            ) : (
              debugLogs.map((entry, i) => <div key={i} className="border-b border-white/5 py-0.5 last:border-0">{entry}</div>)
            )}
          </div>
        </div>
        
        {!isCalibrating ? (
          <Button onClick={startCalibration} disabled={isImageLoading} className="w-full group h-12 text-base">
            <VibeContentRenderer content="::FaRulerCombined::" className="mr-2 group-hover:scale-110 transition-transform" />
            Начать Калибровку
          </Button>
        ) : (
          <div className="bg-card/50 p-4 sm:p-6 rounded-xl space-y-4 border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-orbitron text-lg text-white">Калибровка</h3>
              {calculatedBounds && <Badge className="bg-brand-lime/20 text-brand-lime border-brand-lime/30 text-xs">✓ Границы вычислены</Badge>}
            </div>
            
            {calculatedBounds ? (
              <div className="space-y-3">
                <div className="relative">
                  <label className="text-xs font-mono text-zinc-400 mb-1.5 block">Вычисленные GeoBounds:</label>
                  <pre className="text-[10px] sm:text-[11px] bg-black/40 p-3 rounded-lg overflow-x-auto font-mono text-brand-cyan/90 max-h-32 simple-scrollbar border border-white/10 whitespace-pre-wrap break-all">{formatBounds(calculatedBounds)}</pre>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-white" onClick={() => { navigator.clipboard.writeText(formatBounds(calculatedBounds)); toast.success("Границы скопированы"); }}><VibeContentRenderer content="::FaCopy::" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-zinc-400 hover:text-white" onClick={() => { if (!calculatedBounds) return; const blob = new Blob([formatBounds(calculatedBounds)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${presetName || "map-bounds"}.json`; a.click(); URL.revokeObjectURL(url); toast.success("Bounds exported"); }}><VibeContentRenderer content="::FaDownload::" /></Button>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs font-mono text-zinc-400 mb-1.5 block">Название пресета</label>
                  <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Например: Nizhny Novgorod Center" className="input-cyber font-mono" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic text-center py-4">Переместите обе опорные точки на карте для вычисления границ...</p>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={!calculatedBounds || !presetName.trim() || isSaving || (calculatedBounds && validateBounds(calculatedBounds).length > 0)} className="flex-1 bg-gradient-to-r from-brand-lime to-brand-cyan text-black font-medium hover:opacity-90 h-11">
                {isSaving ? <Loading className="h-4 w-4 text-black" /> : <><VibeContentRenderer content="::FaSave::" className="mr-2" />Сохранить Пресет</>}
              </Button>
              <Button onClick={() => setIsCalibrating(false)} variant="outline" className="flex-1 border-white/20 hover:bg-white/10 h-11">Отмена</Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}