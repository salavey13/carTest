"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext';
import { saveMapPreset } from '@/app/actions';

interface Bounds { top: number; bottom: number; left: number; right: number; }
interface Point { id: string; name: string; coords: [number, number]; }
interface PixelPosition { x: number; y: number; }

const REFERENCE_POINTS: Point[] = [
  { id: 'main_square', name: 'Главная Площадь', coords: [56.3269, 44.0059] },
  { id: 'airport', name: 'Аэропорт Стригино', coords: [56.229, 43.784] },
];
const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';

const project = (lat: number, lon: number, bounds: Bounds): PixelPosition | null => {
  if (lat > bounds.top || lat < bounds.bottom || lon < bounds.left || lon > bounds.right) return null;
  const x = ((lon - bounds.left) / (bounds.right - bounds.left)) * 100;
  const y = ((bounds.top - lat) / (bounds.top - bounds.bottom)) * 100;
  return { x, y };
};

export function VibeMapCalibrator({ initialBounds }: { initialBounds: Bounds }) {
  const { dbUser } = useAppContext();
  const [mapUrl, setMapUrl] = useState(DEFAULT_MAP_URL);
  const [presetName, setPresetName] = useState("");
  const [bounds, setBounds] = useState<Bounds>(initialBounds);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [positions, setPositions] = useState<Record<string, PixelPosition>>({});
  const [calculatedBounds, setCalculatedBounds] = useState<Bounds | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const startCalibration = useCallback(() => {
    const initialPositions: Record<string, PixelPosition> = {};
    REFERENCE_POINTS.forEach(p => {
      const pos = project(p.coords[0], p.coords[1], bounds);
      initialPositions[p.id] = pos || { x: 50, y: 50 };
    });
    setPositions(initialPositions);
    setCalculatedBounds(null);
    setIsCalibrating(true);
  }, [bounds]);

  useEffect(() => {
    if (!isCalibrating || Object.keys(positions).length < 2) return;
    const p1 = REFERENCE_POINTS[0]; // main_square
    const p2 = REFERENCE_POINTS[1]; // airport
    const pos1 = positions[p1.id];
    const pos2 = positions[p2.id];
    if (Math.abs(pos1.x - pos2.x) < 0.1 || Math.abs(pos1.y - pos2.y) < 0.1) return;
    const lonRange = (p2.coords[1] - p1.coords[1]) * 100 / (pos2.x - pos1.x);
    const newLeft = p1.coords[1] - (pos1.x / 100) * lonRange;
    const newRight = newLeft + lonRange;
    const latRange = (p1.coords[0] - p2.coords[0]) * 100 / (pos2.y - pos1.y);
    const newTop = p1.coords[0] + (pos1.y / 100) * latRange;
    const newBottom = newTop - latRange;
    setCalculatedBounds({ top: newTop, bottom: newBottom, left: newLeft, right: newRight });
  }, [positions, isCalibrating]);

  const handleSave = async () => {
    if (!calculatedBounds || !presetName.trim() || !dbUser?.user_id) {
      toast.error("Имя пресета и вычисленные границы обязательны для сохранения.");
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

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-mono text-muted-foreground">URL Изображения Карты</label>
          <Input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} className="input-cyber mt-1" />
        </div>
        <div ref={mapContainerRef} className="relative w-full aspect-[16/10] bg-black/50 rounded-lg overflow-hidden border-2 border-brand-purple/30">
          {mapUrl && <img src={mapUrl} alt="Map Background" className="absolute inset-0 w-full h-full object-contain opacity-50" />}
          {isCalibrating ? (
            REFERENCE_POINTS.map(point => (
              <motion.div
                key={point.id}
                drag
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (!mapContainerRef.current) return;
                  const rect = mapContainerRef.current.getBoundingClientRect();
                  const newX = ((info.point.x - rect.left) / rect.width) * 100;
                  const newY = ((info.point.y - rect.top) / rect.height) * 100;
                  setPositions(prev => ({ ...prev, [point.id]: { x: newX, y: newY } }));
                }}
                className="absolute w-8 h-8 bg-brand-lime rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center text-black shadow-lg shadow-brand-lime/50"
                style={{ left: `${positions[point.id]?.x}%`, top: `${positions[point.id]?.y}%`, translateX: '-50%', translateY: '-50%' }}
              >
                <Tooltip><TooltipTrigger asChild><span><VibeContentRenderer content="::FaMapMarkerAlt::" /></span></TooltipTrigger><TooltipContent><p>{point.name}</p></TooltipContent></Tooltip>
              </motion.div>
            ))
          ) : (
            REFERENCE_POINTS.map(point => {
              const pos = project(point.coords[0], point.coords[1], bounds);
              if (!pos) return null;
              return <div key={point.id} className="absolute w-4 h-4 bg-brand-pink rounded-full" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }} />;
            })
          )}
        </div>

        {!isCalibrating ? (
          <Button onClick={startCalibration} className="w-full"><VibeContentRenderer content="::FaRulerCombined:: Начать Калибровку"/></Button>
        ) : (
          <div className="bg-card/50 p-4 rounded-lg space-y-4">
            <h3 className="font-orbitron">Перетащи точки на их реальные места на карте</h3>
            {calculatedBounds && (
              <div className="space-y-2">
                <h4 className="font-mono text-brand-cyan">Новые Границы:</h4>
                <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto simple-scrollbar">{JSON.stringify(calculatedBounds, null, 2)}</pre>
                <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Название пресета (e.g., Nizhny Novgorod Center)" className="input-cyber" />
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!calculatedBounds || !presetName.trim() || isSaving} className="flex-1"><VibeContentRenderer content="::FaSave:: Сохранить"/></Button>
              <Button onClick={() => setIsCalibrating(false)} variant="secondary" className="flex-1">Отмена</Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}