"use client";
import { FaBurst, FaSkull } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import useSound from 'use-sound'; // install: npm install use-sound

export function VirtualBlaster({ onHit }: { onHit: () => void }) {
    // Note: You'll need a sci-fi 'blast.mp3' in your public/sounds folder
    const [play] = useSound('/sounds/blaster-fire.mp3', { volume: 0.5 });

    const handleFire = () => {
        play();
        if (navigator.vibrate) navigator.vibrate([100, 30, 100]);
        // Trigger a visual animation for others if we add web sockets later
    };

    return (
        <div className="grid grid-cols-2 gap-4 w-full">
            <button 
                onClick={handleFire}
                className="bg-brand-cyan text-black font-black py-8 uppercase tracking-tighter flex flex-col items-center justify-center border-b-4 border-cyan-700 active:translate-y-1 active:border-b-0 transition-all"
            >
                <FaBurst className="text-3xl mb-2" />
                БЛАСТЕР
            </button>
            
            <button 
                onClick={onHit}
                className="bg-red-600 text-white font-black py-8 uppercase tracking-tighter flex flex-col items-center justify-center border-b-4 border-red-900 active:translate-y-1 active:border-b-0 transition-all"
            >
                <FaSkull className="text-3xl mb-2" />
                Я УБИТ
            </button>
        </div>
    );
}