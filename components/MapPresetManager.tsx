"use client";

import { useState, useEffect } from 'react';
import { VibeMap } from './VibeMap';
import { getMapPresets } from '@/app/actions'; // Adjust path as needed
import type { Database } from '@/types/database.types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { VibeContentRenderer } from './VibeContentRenderer';
import type { PointOfInterest, MapBounds } from '@/lib/map-utils';

type MapPreset = Database['public']['Tables']['maps']['Row'];

interface MapPresetManagerProps {
  points: PointOfInterest[];
  highlightedPointId?: string | null;
  isEditable?: boolean;
  onMapClick?: (coords: [number, number]) => void;
}

export function MapPresetManager({ 
  points, 
  highlightedPointId, 
  isEditable = false, 
  onMapClick 
}: MapPresetManagerProps) {
  const [presets, setPresets] = useState<MapPreset[]>([]);
  const [activePreset, setActivePreset] = useState<MapPreset | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Fetch available maps on mount
  useEffect(() => {
    const fetchMaps = async () => {
      const result = await getMapPresets();
      if (result.success && result.data) {
        setPresets(result.data);
        // Select the default map, or the first one in the list
        const defaultMap = result.data.find(p => p.is_default) || result.data[0];
        setActivePreset(defaultMap || null);
      }
      setIsLoading(false);
    };
    fetchMaps();
  }, []);

  const handlePresetChange = (presetId: string) => {
    const selected = presets.find(p => p.id === presetId);
    if (selected) setActivePreset(selected);
  };

  if (isLoading) {
    return (
      <div className="w-full h-full relative bg-zinc-900 flex items-center justify-center">
        <div className="space-y-2 text-center">
           <Skeleton className="h-4 w-32 mx-auto bg-zinc-800" />
           <div className="text-zinc-500 text-xs animate-pulse">LOADING MAP DATA...</div>
        </div>
      </div>
    );
  }

  if (!activePreset) {
    return <div className="flex items-center justify-center h-full text-red-500">No Map Presets Found</div>;
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map Controls / Preset Switcher */}
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/10 p-1.5 rounded-lg">
        <span className="text-xs text-zinc-400 font-mono pl-2 hidden sm:block">TERRAIN:</span>
        <Select value={activePreset.id} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-[180px] h-8 bg-transparent border-none text-white text-sm focus:ring-0 shadow-none">
            <SelectValue placeholder="Select Map" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id} className="text-zinc-200 focus:bg-zinc-800">
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* The VibeMap Component */}
      <VibeMap
        points={points}
        // We cast bounds here because Supabase stores them as JSON, and our utility expects a strict object
        bounds={activePreset.bounds as unknown as MapBounds}
        imageUrl={activePreset.map_image_url}
        highlightedPointId={highlightedPointId}
        isEditable={isEditable}
        onMapClick={onMapClick}
      />
    </div>
  );
}