"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

// --- Interfaces and Types ---
interface Bounds { top: number; bottom: number; left: number; right: number; }
interface Point { id: string; name: string; coords: [number, number]; }
interface PixelPosition { x: number; y: number; }

// --- Constants ---
const REFERENCE_POINTS: Point[] = [
  { id: 'main_square', name: 'Главная Площадь', coords: [56.3269, 44.0059] },
  { id: 'airport', name: 'Аэропорт Стригино', coords: [56.229, 43.784] },
];
const DEFAULT_MAP_URL = 'https://i.imgur.com/22n6k1V.png';

// --- Helper Functions ---
const project = (lat: number, lon: number, bounds: Bounds): PixelPosition | null => {
  if (lat > bounds.top || lat < bounds.bottom || lon < bounds.left || lon > bounds.right) return null;
  const x = ((lon - bounds.left) / (bounds.right - bounds.left)) * 100;
  const y = ((bounds.top - lat) / (bounds.top - bounds.bottom)) * 100;
  return { x, y };
};

export function VibeMapCalibrator({ initialBounds }: { initialBounds: Bounds }) {
  const [mapUrl, setMapUrl] = useState(DEFAULT_MAP_URL);
  const [bounds, setBounds] = useState<Bounds>(initialBounds);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [positions, setPositions] = useState<Record<string, PixelPosition>>({});
  const [calculatedBounds, setCalculatedBounds] = useState<Bounds | null>(null);

  const startCalibration = useCallback(() => {
    const initialPositions: Record<string, PixelPosition> = {};
    REFERENCE_POINTS.forEach(p => {
      const pos = project(p.coords[0], p.coords[1], bounds);
      initialPositions[p.id] = pos || { x: 50, y: 50 }; // Default to center if out of bounds
    });
    setPositions(initialPositions);
    setIsCalibrating(true);
  }, [bounds]);

  useEffect(() => {
    if (!isCalibrating || Object.keys(positions).length < 2) return;

    const p1 = REFERENCE_POINTS[0];
    const p2 = REFERENCE_POINTS[1];
    const pos1 = positions[p1.id];
    const pos2 = positions[p2.id];

    if (pos1.x === pos2.x || pos1.y === pos2.y) return;

    const lonRange = (p2.coords[1] - p1.coords[1]) * 100 / (pos2.x - pos1.x);
    const newLeft = p1.coords[1] - (pos1.x / 100) * lonRange;
    const newRight = newLeft + lonRange;

    const latRange = (p1.coords[0] - p2.coords[0]) * 100 / (pos2.y - pos1.y);
    const newTop = p1.coords[0] + (pos1.y / 100) * latRange;
    const newBottom = newTop - latRange;

    setCalculatedBounds({ top: newTop, bottom: newBottom, left: newLeft, right: newRight });
  }, [positions, isCalibrating]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-mono text-muted-foreground">URL Изображения Карты</label>
          <Input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} className="input-cyber mt-1" />
        </div>

        <div className="relative w-full aspect-[16/10] bg-black/50 rounded-lg overflow-hidden border-2 border-brand-purple/30">
          {mapUrl && <img src={mapUrl} alt="Map Background" className="absolute inset-0 w-full h-full object-contain opacity-50" />}
          {isCalibrating ? (
            REFERENCE_POINTS.map(point => (
              <motion.div
                key={point.id}
                drag
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  const parent = info.point.x / (document.querySelector(`[data-id="map-container"]`) as HTMLElement).offsetWidth * 100;
                  const newX = info.point.x / (document.querySelector(`[data-id="map-container"]`) as HTMLElement).offsetWidth * 100;
                  const newY = info.point.y / (document.querySelector(`[data-id="map-container"]`) as HTMLElement).offsetHeight * 100;
                  setPositions(prev => ({ ...prev, [point.id]: { x: newX, y: newY } }));
                }}
                className="absolute w-8 h-8 bg-brand-lime rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center text-black shadow-lg shadow-brand-lime/50"
                style={{
                  left: `${positions[point.id]?.x}%`,
                  top: `${positions[point.id]?.y}%`,
                  translateX: '-50%',
                  translateY: '-50%',
                }}
              >
                <Tooltip>
                  <TooltipTrigger asChild><span><VibeContentRenderer content="::FaMapMarkerAlt::" /></span></TooltipTrigger>
                  <TooltipContent><p>{point.name}</p></TooltipContent>
                </Tooltip>
              </motion.div>
            ))
          ) : (
            REFERENCE_POINTS.map(point => {
              const pos = project(point.coords[0], point.coords[1], bounds);
              if (!pos) return null;
              return (
                <div key={point.id} className="absolute w-4 h-4 bg-brand-pink rounded-full" style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }} />
              );
            })
          )}
           <div data-id="map-container" className="w-full h-full"/>
        </div>

        {!isCalibrating ? (
          <Button onClick={startCalibration} className="w-full">
            <VibeContentRenderer content="::FaRulerCombined:: Начать Калибровку"/>
          </Button>
        ) : (
          <div className="bg-card/50 p-4 rounded-lg space-y-4">
            <h3 className="font-orbitron">Перетащи точки на их реальные места на карте</h3>
            {calculatedBounds && (
              <div>
                <h4 className="font-mono text-brand-cyan">Новые Границы:</h4>
                <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto simple-scrollbar">
                  {JSON.stringify(calculatedBounds, null, 2)}
                </pre>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={() => { if(calculatedBounds) setBounds(calculatedBounds); setIsCalibrating(false); }} disabled={!calculatedBounds} className="flex-1">
                <VibeContentRenderer content="::FaCheck:: Применить"/>
              </Button>
              <Button onClick={() => setIsCalibrating(false)} variant="secondary" className="flex-1">Отмена</Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}