"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { saveMapPreset } from '@/lib/map-actions';
import { cn } from '@/lib/utils';
import { Loading } from './Loading';
import Image from 'next/image';
import { 
  project, unproject, GeoBounds, ViewState,
  getRenderBox, calculateBoundsFromPoints, validateBounds, formatBounds,
  clamp, pixelToPercent, percentToPixel, snapToGrid, formatCoordinate,
  DEFAULT_MAP_IMAGE, FALLBACK_MAP_IMAGE, generateStorageKey
} from "@/lib/map-utils";

interface Point { id: string; name: string; coords: [number, number]; }
type PixelPosition = { x: number; y: number };
type Size = { width: number; height: number };

const REFERENCE_POINTS: Point[] = [
  { id: 'aska', name: 'Аська', coords: [56.330, 44.018] },
  { id: 'airport', name: 'Аэропорт Стригино', coords: [56.229, 43.784] },
];
const GRID_SNAP_ENABLED = true;
const GRID_SIZE = 2; // percent
const SNAP_THRESHOLD = 0.5; // percent

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
  const [snapEnabled, setSnapEnabled] = useState(GRID_SNAP_ENABLED);
  const [debugInfo, setDebugInfo] = useState<string>("");
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const storageKey = useMemo(() => generateStorageKey(initialBounds, "vibecal"), [initialBounds]);

  // Restore calibrator state
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
      console.warn('[Calibrator] Failed to restore state:', e);
    }
  }, [storageKey]);

  // Persist calibrator state
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ presetName, coordFormat, mapUrl }));
      } catch (e) {
        console.warn('[Calibrator] Failed to persist state:', e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [presetName, coordFormat, mapUrl, storageKey]);

  useEffect(() => {
    setIsImageLoading(true);
    setImageSize(null);
    setCalculatedBounds(null);
  }, [mapUrl]);

  useEffect(() => {
    if (mapUrl) setCurrentImageUrl(mapUrl);
  }, [mapUrl]);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const updateSize = () => setContainerSize({ width: el.offsetWidth, height: el.offsetHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const renderBox = useMemo(() => 
    imageSize ? getRenderBox(containerSize, imageSize) : null,
    [containerSize, imageSize]
  );

  const startCalibration = useCallback(() => {
    if (!imageSize || !mapContainerRef.current) {
      toast.warning("Изображение карты еще не загружено.");
      return;
    }
    
    const initialPositions: Record<string, PixelPosition> = {};
    let hasValidProjection = true;
    
    REFERENCE_POINTS.forEach(p => {
      const pos = project(p.coords[0], p.coords[1], bounds);
      
      // Check if projection is valid and within reasonable bounds
      if (!pos || pos.x < 5 || pos.x > 95 || pos.y < 5 || pos.y > 95) {
        hasValidProjection = false;
        console.warn(`[Calibrator] Point ${p.id} projected to edge:`, pos);
      }
      
      // Use projected position if valid, otherwise use smart defaults
      if (pos && hasValidProjection) {
        initialPositions[p.id] = pos;
      } else {
        // Smart defaults based on typical NN map layout
        if (p.id === 'aska') {
          initialPositions[p.id] = { x: 35, y: 65 }; // Southwest area
        } else if (p.id === 'airport') {
          initialPositions[p.id] = { x: 65, y: 35 }; // Northeast area
        } else {
          initialPositions[p.id] = { x: 50, y: 50 }; // Center fallback
        }
      }
    });
    
    setPositions(initialPositions);
    setCalculatedBounds(null);
    setIsCalibrating(true);
    
    const msg = hasValidProjection 
      ? "Перетащите точки на реальные позиции" 
      : "Точки размещены по умолчанию — перетащите их на правильные места";
    
    toast.info(msg, { duration: 4000 });
    
    if (!hasValidProjection) {
      toast.warning("GPS bounds не совпадают с картой — разместите точки вручную", { duration: 5000 });
    }
  }, [bounds, imageSize]);

  const handlePointDragEnd = useCallback((pointId: string, _event: unknown, info: any) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    
    const initialPos = positions[pointId] || { x: 50, y: 50 };
    const deltaX = (info.offset[0] / rect.width) * 100;
    const deltaY = (info.offset[1] / rect.height) * 100;
    
    let newX = clamp(initialPos.x + deltaX, 0, 100);
    let newY = clamp(initialPos.y + deltaY, 0, 100);
    
    // Optional grid snapping
    if (snapEnabled) {
      newX = snapToGrid(newX, GRID_SIZE, SNAP_THRESHOLD);
      newY = snapToGrid(newY, GRID_SIZE, SNAP_THRESHOLD);
    }
    
    setPositions(prev => ({ ...prev, [pointId]: { x: newX, y: newY } }));
  }, [positions, snapEnabled]);

  // Recalculate bounds when positions change
  useEffect(() => {
    if (!isCalibrating || !imageSize || !renderBox) return;
    
    const p1 = REFERENCE_POINTS[0];
    const p2 = REFERENCE_POINTS[1];
    const pos1 = positions[p1.id];
    const pos2 = positions[p2.id];
    
    if (!pos1 || !pos2) {
      setDebugInfo("❌ Missing point positions");
      return;
    }
    
    try {
      // Convert percentage positions to pixel coordinates within the IMAGE
      const toImagePixel = (percent: number, offset: number, size: number) => {
        return (percent / 100) * size + offset;
      };
      
      const x1_img = toImagePixel(pos1.x, -renderBox.offsetX, renderBox.width);
      const y1_img = toImagePixel(pos1.y, -renderBox.offsetY, renderBox.height);
      const x2_img = toImagePixel(pos2.x, -renderBox.offsetX, renderBox.width);
      const y2_img = toImagePixel(pos2.y, -renderBox.offsetY, renderBox.height);
      
      setDebugInfo(`P1: (${x1_img.toFixed(0)}, ${y1_img.toFixed(0)}) | P2: (${x2_img.toFixed(0)}, ${y2_img.toFixed(0)})`);
      
      const newBounds = calculateBoundsFromPoints(
        { lat: p1.coords[0], lon: p1.coords[1], pixelX: x1_img, pixelY: y1_img },
        { lat: p2.coords[0], lon: p2.coords[1], pixelX: x2_img, pixelY: y2_img },
        imageSize.width,
        imageSize.height
      );
      
      if (newBounds) {
        const errors = validateBounds(newBounds);
        if (errors.length === 0) {
          setCalculatedBounds(newBounds);
          setDebugInfo(`✅ Bounds calculated: ${newBounds.top.toFixed(4)}, ${newBounds.left.toFixed(4)}`);
        } else {
          setCalculatedBounds(null);
          setDebugInfo(`❌ Validation: ${errors[0]}`);
          toast.warning(`Проверьте позиции точек: ${errors[0]}`, { duration: 4000 });
        }
      } else {
        setCalculatedBounds(null);
        setDebugInfo("❌ Failed to calculate bounds");
      }
    } catch (error) {
      console.error('[Calibrator] Error calculating bounds:', error);
      setDebugInfo(`❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
      setCalculatedBounds(null);
    }
  }, [positions, isCalibrating, imageSize, renderBox]);

  // Calibration box style
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
    
    const validationErrors = validateBounds(calculatedBounds);
    if (validationErrors.length > 0) {
      toast.error(`Некорректные границы: ${validationErrors.join('; ')}`);
      return;
    }
    
    setIsSaving(true);
    try {
      const result = await saveMapPreset(dbUser.user_id, presetName.trim(), currentImageUrl, calculatedBounds, false);
      
      if (result.success && result.data) {
        setIsCalibrating(false);
        setBounds(calculatedBounds);
        setPresetName("");
        toast.success(`Пресет "${result.data.name}" успешно сохранен!`);
      } else {
        throw new Error(result.error || "Неизвестная ошибка");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
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
      const lat = formatCoordinate(result[0], true, coordFormat);
      const lon = formatCoordinate(result[1], false, coordFormat);
      toast.info(`🎯 ${lat} ${lon}`, { duration: 3000 });
    }
  }, [calculatedBounds, imageSize, renderBox, coordFormat]);

  const handleImageError = useCallback(() => {
    if (currentImageUrl !== FALLBACK_MAP_IMAGE) {
      setCurrentImageUrl(FALLBACK_MAP_IMAGE);
      toast.error("Изображение не загрузилось — используем fallback", { duration: 4000 });
    }
  }, [currentImageUrl]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* URL Input */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="text-sm font-mono text-zinc-400 mb-1.5 block">URL Изображения Карты</label>
            <Input 
              value={mapUrl} 
              onChange={(e) => setMapUrl(e.target.value)} 
              className="input-cyber font-mono text-xs"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-sm font-mono text-zinc-400 mb-1.5 block">Формат Координат</label>
            <div className="flex gap-1 p-1 rounded-lg bg-white/5">
              <Button 
                size="sm" 
                variant={coordFormat === 'dd' ? 'default' : 'ghost'}
                onClick={() => setCoordFormat('dd')}
                className={cn("flex-1 text-xs", coordFormat === 'dd' && "bg-brand-lime text-black")}
              >
                Decimal
              </Button>
              <Button 
                size="sm" 
                variant={coordFormat === 'dms' ? 'default' : 'ghost'}
                onClick={() => setCoordFormat('dms')}
                className={cn("flex-1 text-xs", coordFormat === 'dms' && "bg-brand-lime text-black")}
              >
                DMS
              </Button>
            </div>
          </div>
        </div>
        
        {/* Map Container - Larger */}
        <div 
          ref={mapContainerRef} 
          className="relative w-full aspect-[16/9] sm:aspect-[21/9] lg:aspect-[21/8] overflow-hidden rounded-2xl border border-brand-purple/30 bg-slate-950/80 shadow-2xl"
          onClick={calculatedBounds ? handleTestClick : undefined}
        >
          {currentImageUrl && (
            <>
              <Image
                src={currentImageUrl}
                alt="Map backdrop"
                fill
                className="pointer-events-none object-cover scale-110 opacity-35 blur-2xl saturate-125"
                unoptimized
                onError={handleImageError}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.14),rgba(2,6,23,0.55))]" />
            </>
          )}
          
          {isImageLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
              <Loading text="ЗАГРУЗКА КАРТЫ..." />
            </div>
          )}
          
          {currentImageUrl && 
            <Image 
              src={currentImageUrl} 
              alt="Map Background" 
              fill
              className={cn("pointer-events-none object-contain transition-opacity duration-300", isImageLoading ? "opacity-0" : "opacity-100")} 
              onLoadingComplete={(img) => { 
                setImageSize({width: img.naturalWidth, height: img.naturalHeight}); 
                setIsImageLoading(false); 
              }}
              onError={handleImageError}
              unoptimized
            />
          }
          
          {/* Calibration box */}
          <div 
            style={calibrationBoxStyle} 
            className="absolute border-2 border-dashed border-brand-cyan/70 bg-brand-cyan/5 pointer-events-none rounded-xl transition-all duration-200 z-10" 
          />
          
          {/* Grid overlay when snapping enabled */}
          {isCalibrating && snapEnabled && renderBox && (
            <svg
              className="absolute pointer-events-none opacity-20 z-0"
              style={{
                left: renderBox.offsetX,
                top: renderBox.offsetY,
                width: renderBox.width,
                height: renderBox.height,
              }}
            >
              {[...Array(11)].map((_, i) => (
                <g key={i}>
                  <line x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="white" strokeWidth="0.5" />
                  <line x1="0" y1={`${i * 10}%`} x2="100%" y2={`${i * 10}%`} stroke="white" strokeWidth="0.5" />
                </g>
              ))}
            </svg>
          )}
          
          {/* Calibration Points */}
          {isCalibrating ? (
            REFERENCE_POINTS.map(point => (
              <motion.div
                key={point.id}
                className="absolute z-20"
                style={{
                  left: `${positions[point.id]?.x ?? 50}%`,
                  top: `${positions[point.id]?.y ?? 50}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <motion.div
                  drag
                  dragMomentum={false}
                  dragElastic={0.1}
                  onDragEnd={(e, info) => handlePointDragEnd(point.id, e, info)}
                  className={cn(
                    "flex h-10 w-10 sm:h-12 sm:w-12 cursor-grab items-center justify-center rounded-full",
                    "bg-gradient-to-br from-brand-lime to-brand-cyan text-black",
                    "shadow-lg shadow-brand-lime/40 ring-2 ring-white/30",
                    "active:cursor-grabbing active:scale-95 transition-transform",
                    snapEnabled && "ring-4 ring-brand-cyan/50"
                  )}
                  whileHover={{ scale: 1.1, boxShadow: "0 0 25px rgba(124,244,120,0.6)" }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="focus:outline-none focus:ring-2 focus:ring-brand-lime rounded-full">
                        <VibeContentRenderer content="::FaLocationDot::" className="h-5 w-5 sm:h-6 sm:w-6" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-dark-card/95 border-brand-lime/30">
                      <p className="font-mono text-sm">{point.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {positions[point.id]?.x.toFixed(1)}%, {positions[point.id]?.y.toFixed(1)}%
                        {snapEnabled && <span className="text-brand-cyan ml-1">• snapped</span>}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              </motion.div>
            ))
          ) : (
            // Preview points (colored dots)
            imageSize && renderBox && REFERENCE_POINTS.map(point => {
              const projected = project(point.coords[0], point.coords[1], bounds);
              if (!projected) return null;
              
              const pixelX = percentToPixel(projected.x, renderBox.offsetX, renderBox.width);
              const pixelY = percentToPixel(projected.y, renderBox.offsetY, renderBox.height);
              
              return (
                <div 
                  key={point.id} 
                  className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full ring-2 ring-white/50 z-10 animate-pulse"
                  style={{ 
                    left: `${(pixelX / containerSize.width) * 100}%`, 
                    top: `${(pixelY / containerSize.height) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: point.id === 'aska' ? '#FF69B4' : '#00CED1'
                  }} 
                />
              );
            })
          )}
        </div>

        {/* Debug Info (dev only) */}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div className="text-xs font-mono text-zinc-500 bg-black/30 px-3 py-2 rounded">
            {debugInfo}
          </div>
        )}
        
        {/* Controls */}
        {!isCalibrating ? (
          <Button onClick={startCalibration} disabled={isImageLoading} className="w-full group h-12 text-base">
            <VibeContentRenderer content="::FaRulerCombined::" className="mr-2 group-hover:scale-110 transition-transform" />
            Начать Калибровку
          </Button>
        ) : (
          <div className="bg-card/50 p-4 sm:p-6 rounded-xl space-y-4 border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-orbitron text-lg text-white">Калибровка</h3>
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant={snapEnabled ? "default" : "outline"}
                  onClick={() => setSnapEnabled(!snapEnabled)}
                  className={cn("text-xs", snapEnabled && "bg-brand-cyan text-black")}
                >
                  {snapEnabled ? "✓ Snap" : "○ Snap"}
                </Button>
                {calculatedBounds && (
                  <Badge className="bg-brand-lime/20 text-brand-lime border-brand-lime/30 text-xs">
                    ✓ Границы вычислены
                  </Badge>
                )}
              </div>
            </div>
            
            {calculatedBounds ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Проверка валидности:</span>
                  <span className={validateBounds(calculatedBounds).length === 0 ? 'text-brand-lime' : 'text-amber-400'}>
                    {validateBounds(calculatedBounds).length === 0 ? '✓ Все параметры в норме' : '⚠ Требуется проверка'}
                  </span>
                </div>
                
                <div className="relative">
                  <label className="text-xs font-mono text-zinc-400 mb-1.5 block">
                    Вычисленные GeoBounds:
                  </label>
                  <pre className="text-[10px] sm:text-[11px] bg-black/40 p-3 rounded-lg overflow-x-auto font-mono text-brand-cyan/90 max-h-32 simple-scrollbar border border-white/10">
                    {formatBounds(calculatedBounds)}
                  </pre>
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(formatBounds(calculatedBounds));
                        toast.success("Границы скопированы");
                      }}
                    >
                      <VibeContentRenderer content="::FaCopy::" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                      onClick={() => {
                        if (!calculatedBounds) return;
                        const blob = new Blob([formatBounds(calculatedBounds)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${presetName || "map-bounds"}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Bounds exported as JSON");
                      }}
                    >
                      <VibeContentRenderer content="::FaDownload::" />
                    </Button>
        
          </div>
                </div>
                
                <div>
                  <label className="text-xs font-mono text-zinc-400 mb-1.5 block">Название пресета</label>
                  <Input 
                    value={presetName} 
                    onChange={(e) => setPresetName(e.target.value)} 
                    placeholder="Например: Nizhny Novgorod Center" 
                    className="input-cyber font-mono" 
                  />
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm text-zinc-400 italic mb-2">
                  Переместите обе опорные точки на карте для вычисления границ...
                </p>
                {snapEnabled && (
                  <p className="text-xs text-brand-cyan">
                    💡 Подсказка: точки привязываются к сетке
                  </p>
                )}
              </div>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleSave} 
                disabled={!calculatedBounds || !presetName.trim() || isSaving || (calculatedBounds && validateBounds(calculatedBounds).length > 0)} 
                className="flex-1 bg-gradient-to-r from-brand-lime to-brand-cyan text-black font-medium hover:opacity-90 h-11"
              >
                {isSaving ? (
                  <Loading className="h-4 w-4 text-black" />
                ) : (
                  <>
                    <VibeContentRenderer content="::FaSave::" className="mr-2" />
                    Сохранить Пресет
                  </>
                )}
              </Button>
              <Button 
                onClick={() => setIsCalibrating(false)} 
                variant="outline" 
                className="flex-1 border-white/20 hover:bg-white/10 h-11"
              >
                Отмена
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}