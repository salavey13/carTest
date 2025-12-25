import { MapPresetManager } from "@/components/MapPresetManager";

export function MapTab({ mapData, fieldId }: any) {
    return (
        <div className="h-[65vh] w-full border border-zinc-800 relative bg-zinc-950 overflow-hidden rounded-lg">
            {/* 
               Instead of passing hardcoded URL/bounds, we pass the dynamic data.
               The MapPresetManager will handle fetching the map image and bounds from DB.
               It will overlay the mapData.points on top of whatever map is selected.
            */}
            <MapPresetManager 
                points={mapData.points} 
                highlightedPointId="target"
                // Optional: If you want to allow admins to click and add points
                isEditable={false} 
            />
            
            <div className="absolute bottom-4 left-4 z-10 bg-black/90 p-2 border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.3)] pointer-events-none">
                <div className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Source_Intel: GPS_Grid</div>
                <div className="text-[10px] text-red-500 font-mono tracking-widest uppercase">
                    {fieldId ? `OBJECTIVE_LOC: ${fieldId}` : "SIGNAL_LOST"}
                </div>
            </div>
        </div>
    );
}