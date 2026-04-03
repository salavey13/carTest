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
  project, 
  unproject, 
  GeoBounds, 
  getRenderBox, 
  calculateBoundsFromPoints,
  validateBounds,
  formatBounds,
  clamp,
  pixelToPercent,
  percentToPixel,
  DEFAULT_MAP_IMAGE
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
  const [presetName, setPresetName] = useState("");
  const [bounds, setBounds] = useState<GeoBounds>(initialBounds);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [positions, setPositions] = useState<Record<string, PixelPosition>>({});
  const [calculatedBounds, setCalculatedBounds] = useState<GeoBounds | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [containerSize, setContainerSize] = useState<Size>({ width: 1, height: 1 });
  
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsImageLoading(true);
    setImageSize(null);
  }, [mapUrl]);

  // Track container resize
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
    REFERENCE_POINTS.forEach(p => {
      const pos = project(p.coords[0], p.coords[1], bounds);
      initialPositions[p.id] = pos || { x: 50, y: 50 };
    });
    setPositions(initialPositions);
    setCalculatedBounds(null);
    setIsCalibrating(true);
  }, [bounds, imageSize]);

  // FIXED: Use info.offset for reliable drag positioning
  const handlePointDragEnd = useCallback((pointId: string, _event: unknown, info: any) => {
    if (!mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    
    // Use offset (relative to drag start) + initial position for stability
    const initialPos = positions[pointId] || { x: 50, y: 50 };
    const deltaX = (info.offset[0] / rect.width) * 100;
    const deltaY = (info.offset[1] / rect.height) * 100;
    
    const newX = clamp(initialPos.x + deltaX, 0, 100);
    const newY = clamp(initialPos.y + deltaY, 0, 100);
    
    setPositions(prev => ({ ...prev, [pointId]: { x: newX, y: newY } }));
  }, [positions]);

  // Recalculate bounds when positions change
  useEffect(() => {
    if (!isCalibrating || !imageSize || !renderBox) return;
    
    const p1 = REFERENCE_POINTS[0];
    const p2 = REFERENCE_POINTS[1];
    const pos1 = positions[p1.id];
    const pos2 = positions[p2.id];
    
    if (!pos1 || !pos2) return;
    
    // Convert percentage positions to pixel coordinates within the IMAGE
    const toImagePixel = (percent: number, offset: number, size: number) => {
      return (percent / 100) * size + offset;
    };
    
    const x1_img = toImagePixel(pos1.x, -renderBox.offsetX, renderBox.width);
    const y1_img = toImagePixel(pos1.y, -renderBox.offsetY, renderBox.height);
    const x2_img = toImagePixel(pos2.x, -renderBox.offsetX, renderBox.width);
    const y2_img = toImagePixel(pos2.y, -renderBox.offsetY, renderBox.height);
    
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
      } else {
        setCalculatedBounds(null);
      }
    }
  }, [positions, isCalibrating, imageSize, renderBox]);

  // FIXED: Calibration box uses pixel-perfect renderBox alignment
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
    const promise = saveMapPreset(dbUser.user_id, presetName.trim(), mapUrl, calculatedBounds, false);
    toast.promise(promise, {
      loading: "Сохранение пресета карты...",
      success: (res) => {
        if (res.success) {
          setIsCalibrating(false);
          setBounds(calculatedBounds);
          return `Пресет "${res.data?.name}" успешно сохранен!`;
        }
        throw new Error(res.error);
      },
      error: (err) => `Ошибка сохранения: ${err.message}`,
      finally: () => setIsSaving(false),
    });
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
      toast.info(`Тест: ${result[0].toFixed(5)}, ${result[1].toFixed(5)}`, {
        duration: 3000,
        icon: '🎯'
      });
    }
  }, [calculatedBounds, imageSize, renderBox]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-mono text-muted-foreground">URL Изображения Карты</label>
          <Input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} className="input-cyber mt-1" />
        </div>
        
        <div 
          ref={mapContainerRef} 
          className="relative w-full aspect-[16/10] overflow-hidden rounded-[28px] border border-brand-purple/30 bg-slate-950/80 shadow-[0_30px_80px_rgba(0,0,0,0.4)]"
          onClick={calculatedBounds ? handleTestClick : undefined}
        >
          {mapUrl && (
            <>
              <Image
                src={mapUrl}
                alt="Map backdrop"
                fill
                className="pointer-events-none object-cover scale-110 opacity-35 blur-2xl saturate-125"
                unoptimized
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.14),rgba(2,6,23,0.55))]" />
            </>
          )}
          
          {isImageLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40">
              <Loading text="ЗАГРУЗКА КАРТЫ..." />
            </div>
          )}
          
          {mapUrl && 
            <Image 
              src={mapUrl} 
              alt="Map Background" 
              fill
              className={cn("pointer-events-none object-contain transition-opacity duration-300", isImageLoading ? "opacity-0" : "opacity-100")} 
              onLoadingComplete={(img) => { 
                setImageSize({width: img.naturalWidth, height: img.naturalHeight}); 
                setIsImageLoading(false); 
              }}
              unoptimized
            />
          }
          
          {/* FIXED: Calibration box aligned with renderBox */}
          <div 
            style={calibrationBoxStyle} 
            className="absolute border-2 border-dashed border-brand-cyan/70 bg-brand-cyan/5 pointer-events-none rounded-[24px] transition-all duration-200" 
          />
          
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
                  className="flex h-10 w-10 cursor-grab items-center justify-center rounded-full 
                           bg-gradient-to-br from-brand-lime to-brand-cyan text-black 
                           shadow-lg shadow-brand-lime/40 ring-2 ring-white/30 
                           active:cursor-grabbing active:scale-95 transition-transform"
                  whileHover={{ scale: 1.1, boxShadow: "0 0 25px rgba(124,244,120,0.6)" }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="focus:outline-none focus:ring-2 focus:ring-brand-lime rounded-full">
                        <VibeContentRenderer content="::FaLocationDot::" className="h-5 w-5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-dark-card/95 border-brand-lime/30">
                      <p className="font-mono text-sm">{point.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {positions[point.id]?.x.toFixed(1)}%, {positions[point.id]?.y.toFixed(1)}%
                      </p>
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
              
              return (
                <div 
                  key={point.id} 
                  className="absolute w-3 h-3 rounded-full ring-2 ring-white/50 z-10"
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
        
        {!isCalibrating ? (
          <Button onClick={startCalibration} disabled={isImageLoading} className="w-full group">
            <VibeContentRenderer content="::FaRulerCombined::" className="mr-2 group-hover:scale-110 transition-transform" />
            Начать Калибровку
          </Button>
        ) : (
          <div className="bg-card/50 p-4 rounded-xl space-y-4 border border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-orbitron text-lg text-white">Калибровка</h3>
              {calculatedBounds && (
                <span className="text-xs font-mono text-brand-lime bg-brand-lime/10 px-2 py-1 rounded">
                  ✓ Границы вычислены
                </span>
              )}
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
                  <label className="text-xs font-mono text-muted-foreground mb-1 block">
                    Вычисленные GeoBounds (копировать):
                  </label>
                  <pre className="text-[11px] bg-black/40 p-3 rounded-lg overflow-x-auto font-mono text-brand-cyan/90 max-h-32 simple-scrollbar">
                    {formatBounds(calculatedBounds)}
                  </pre>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="absolute top-2 right-2 h-6 w-6 p-0 text-zinc-400 hover:text-white"
                    onClick={() => {
                      navigator.clipboard.writeText(formatBounds(calculatedBounds));
                      toast.success("Границы скопированы в буфер");
                    }}
                  >
                    <VibeContentRenderer content="::FaCopy::" />
                  </Button>
                </div>
                
                <Input 
                  value={presetName} 
                  onChange={(e) => setPresetName(e.target.value)} 
                  placeholder="Название пресета (например: Nizhny Novgorod Center)" 
                  className="input-cyber" 
                />
              </div>
            ) : (
              <p className="text-sm text-zinc-400 italic">
                Переместите обе опорные точки на карте для вычисления границ...
              </p>
            )}
            
            <div className="flex gap-2 pt-2">
              <Button 
                onClick={handleSave} 
                disabled={!calculatedBounds || !presetName.trim() || isSaving || (calculatedBounds && validateBounds(calculatedBounds).length > 0)} 
                className="flex-1 bg-gradient-to-r from-brand-lime to-brand-cyan text-black font-medium hover:opacity-90"
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
                className="flex-1 border-white/20 hover:bg-white/10"
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