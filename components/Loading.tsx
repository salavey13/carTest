"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface LoadingProps {
  variant?: 'bike' | 'generic';
  text?: string;
  className?: string;
}

export function Loading({ variant = 'generic', text, className }: LoadingProps) {
  if (variant === 'bike') {
    return (
      <div className={cn("min-h-screen bg-white flex flex-col items-center justify-center dark:bg-black dark:invert", className)}>
        <Image 
          src="https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/Loader-S1000RR-8cb0319b-acf7-4ed9-bfd2-97b4b3e2c6fc.gif"
          alt="Loading Garage..."
          width={150}
          height={150}
          unoptimized
        />
        <p className='font-mono text-black dark:text-black mt-4 animate-pulse'>
          {text || 'ЗАГРУЗКА ГАРАЖА...'}
        </p>
      </div>
    );
  }

  // Generic loader
  return (
    <div className={cn("min-h-screen bg-black flex flex-col items-center justify-center", className)}>
      <div className="w-16 h-16 border-4 border-t-brand-cyan border-brand-purple/30 rounded-full animate-spin"></div>
      <p className='font-mono text-brand-cyan mt-4 animate-pulse'>
        {text || 'ИНИЦИАЛИЗАЦИЯ VIBE OS...'}
      </p>
    </div>
  );
}