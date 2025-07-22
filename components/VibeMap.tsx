"use client";

import Image from 'next/image';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { VibeContentRenderer } from './VibeContentRenderer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

export interface PointOfInterest {
  id: string;
  name: string;
  type: 'point' | 'path' | 'loop';
  icon: string;
  color: string;
  coords: [number, number][]; // Array of [lat, lon]
}

export interface MapBounds {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface VibeMapProps {
  points: PointOfInterest[];
  bounds: MapBounds;
  imageUrl: string;
  highlightedPointId?: string | null;
  className?: string;
  isEditable?: boolean;
  onMapClick?: (coords: [number, number]) => void;
}

const project = (lat: number, lon: number, bounds: MapBounds): { x: number; y: number } | null => {
  if (lat > bounds.top || lat < bounds.bottom || lon < bounds.left || lon > bounds.right) return null;
  const x = ((lon - bounds.left) / (bounds.right - bounds.left)) * 100;
  const y = ((bounds.top - lat) / (bounds.top - bounds.bottom)) * 100;
  return { x, y };
};

const unproject = (xPercent: number, yPercent: number, bounds: MapBounds): [number, number] => {
    const lon = (xPercent / 100) * (bounds.right - bounds.left) + bounds.left;
    const lat = bounds.top - (yPercent / 100) * (bounds.top - bounds.bottom);
    return [lat, lon];
}

export function VibeMap({ points, bounds, imageUrl, highlightedPointId, className, isEditable = false, onMapClick }: VibeMapProps) {
  const [scale, setScale] = useState(1);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleZoom = (direction: 'in' | 'out', factor = 1.5) => {
    const newScale = direction === 'in' ? scale * factor : scale / factor;
    setScale(Math.max(0.5, Math.min(newScale, 16))); // Clamp zoom
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onMapClick || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const currentX = x.get();
    const currentY = y.get();

    // Calculate click position relative to the pannable/zoomable map div
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Adjust for current pan and zoom
    const mapX = (clickX - currentX) / scale;
    const mapY = (clickY - currentY) / scale;

    // Convert pixel position to percentage
    const xPercent = (mapX / rect.width) * 100;
    const yPercent = (mapY / rect.height) * 100;
    
    const coords = unproject(xPercent, yPercent, bounds);
    onMapClick(coords);
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div ref={mapContainerRef} className={cn("relative w-full h-full bg-black/50 rounded-lg overflow-hidden border-2 border-brand-purple/30 shadow-lg shadow-brand-purple/20 cursor-grab active:cursor-grabbing", className)}>
        <motion.div
            className="relative w-full h-full"
            style={{ scale, x, y }}
            drag
            dragConstraints={mapContainerRef}
            onWheel={(e) => { e.preventDefault(); handleZoom(e.deltaY < 0 ? 'in' : 'out'); }}
            onClick={handleMapClick}
        >
          <Image
            src={imageUrl}
            alt="Vibe City Map"
            layout="fill"
            objectFit="contain"
            className="opacity-50 pointer-events-none"
            unoptimized
          />
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {points.map(point => {
                  if (point.type === 'point' || point.coords.length < 2) return null;
                  const pathPoints = point.coords.map(c => project(c[0], c[1], bounds)).filter(p => p !== null) as {x: number, y: number}[];
                  const pathData = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                  
                  return (
                     <motion.path
                        key={point.id}
                        d={pathData + (point.type === 'loop' ? ' Z' : '')}
                        stroke={point.color || '#FF69B4'}
                        strokeWidth={0.5 / scale}
                        fill="none"
                        strokeDasharray={isEditable ? `${1 / scale} ${1 / scale}` : 'none'}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.7 }}
                        transition={{ duration: 1 }}
                     />
                  )
              })}
          </svg>

          {points.map((point) => {
            const isSinglePoint = point.type === 'point' || point.coords.length === 1;
            const positionCoords = point.coords[0];
            const projected = project(positionCoords[0], positionCoords[1], bounds);
            if (!projected || !isSinglePoint) return null;

            const isHighlighted = highlightedPointId === point.id;

            return (
              <Tooltip key={point.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${projected.x}%`, top: `${projected.y}%`, zIndex: isHighlighted ? 10 : 5, scale: 1 / scale }}
                    animate={{ scale: (isHighlighted ? 1.5 : 1) / scale }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300", point.color)}>
                       <div className="absolute inset-0 bg-current rounded-full animate-pulse opacity-50"/>
                       <VibeContentRenderer content={point.icon} className="relative z-10 w-4 h-4 text-white drop-shadow-lg"/>
                    </div>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent className="bg-dark-card border-brand-lime text-foreground font-mono"><p>{point.name}</p></TooltipContent>
              </Tooltip>
            );
          })}
        </motion.div>
         <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
            <Button size="icon" onClick={() => handleZoom('in')} className="w-8 h-8"><VibeContentRenderer content="::FaPlus::" /></Button>
            <Button size="icon" onClick={() => handleZoom('out')} className="w-8 h-8"><VibeContentRenderer content="::FaMinus::" /></Button>
         </div>
      </div>
    </TooltipProvider>
  );
}