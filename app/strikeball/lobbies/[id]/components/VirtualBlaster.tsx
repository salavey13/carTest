"use client";
import { FaBurst, FaSkull } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export function VirtualBlaster({ onHit }: { onHit: () => void }) {
    const handleFire = () => {
        // High-intensity tactical feedback
        const audio = new Audio('https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/blaster-fire.mp3');
        audio.volume = 0.8;
        audio.play().catch(() => {});
        
        if (navigator.vibrate) {
            navigator.vibrate([100, 30, 100, 30, 300]); // "Burst" pattern
        }
    };

    return (
        <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 shadow-[0_0_50px_rgba(34,211,238,0.2)] pointer-events-auto">
            <button 
                onClick={handleFire}
                className="bg-brand-cyan text-black font-black py-10 uppercase tracking-[0.2em] flex flex-col items-center justify-center active:bg-white transition-colors"
            >
                <FaBurst className="text-4xl mb-2 animate-pulse" />
                <span>ОГОНЬ</span>
            </button>
            
            <button 
                onClick={onHit}
                className="bg-red-600 text-white font-black py-10 uppercase tracking-[0.2em] flex flex-col items-center justify-center active:bg-red-400 transition-colors"
            >
                <FaSkull className="text-4xl mb-2" />
                <span>Я УБИТ</span>
            </button>
        </div>
    );
}