import { VibeMap } from "@/components/VibeMap";

const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';

export function MapTab({ mapData, fieldId }: any) {
    return (
        <div className="h-[65vh] w-full border border-zinc-800 relative bg-zinc-950 overflow-hidden rounded-lg">
            {mapData && (
                <VibeMap 
                    points={mapData.points} 
                    bounds={mapData.bounds} 
                    imageUrl={DEFAULT_MAP_URL}
                    highlightedPointId="target"
                />
            )}
            <div className="absolute bottom-4 left-4 z-10 bg-black/90 p-2 border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                <div className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Source_Intel: GPS_Grid</div>
                <div className="text-[10px] text-red-500 font-mono tracking-widest uppercase">
                    {fieldId ? `OBJECTIVE_LOC: ${fieldId}` : "SIGNAL_LOST"}
                </div>
            </div>
        </div>
    );
}