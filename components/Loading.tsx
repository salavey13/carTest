// /components/Loading.tsx
"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import VibeContentRenderer from "./VibeContentRenderer";

interface LoadingProps {
  variant?: 'bike' | 'generic';
  text?: string;
  className?: string;
}

export function Loading({ variant = 'generic', text, className }: LoadingProps) {
  if (variant === 'bike') {
    return (
      <div className={cn("min-h-screen bg-white flex flex-col items-center justify-center dark:bg-black", className)}>
         <div className="dark:invert">
            <Image 
                src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
                alt="Loading Garage..."
                width={100}
                height={100}
                unoptimized
            />
         </div>
        <p className='font-mono text-black dark:text-brand-cyan mt-4 animate-pulse'>
          {text || 'ЗАГРУЗКА ГАРАЖА...'}
        </p>
      </div>
    );
  }

  // Generic loader
  return (
    <div className={cn("min-h-screen bg-black flex flex-col items-center justify-center", className)}>
        <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-brand-purple/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-brand-cyan border-l-brand-cyan/0 border-r-brand-cyan/0 border-b-brand-cyan/0 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                 <VibeContentRenderer content="::FaBolt::" className="text-brand-yellow text-xl animate-pulse"/>
            </div>
        </div>
      <p className='font-mono text-brand-cyan mt-4 animate-pulse'>
        {text || 'ИНИЦИАЛИЗАЦИЯ VIBE OS...'}
      </p>
    </div>
  );
}