"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useAppContext } from "@/contexts/AppContext";
import { getGearList, rentGear } from "../actions/market";
import { toast } from "sonner";
import { FaCartPlus } from "react-icons/fa6";
import { cn } from "@/lib/utils";

export default function GearShop() {
  const { dbUser } = useAppContext();
  const [gear, setGear] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGearList().then(res => {
      if(res.success) setGear(res.data || []);
      setLoading(false);
    });
  }, []);

  const handleRent = async (item: any) => {
    if (!dbUser?.user_id) return toast.error("ДОСТУП ЗАПРЕЩЕН");
    toast.promise(rentGear(dbUser.user_id, item.id), {
        loading: 'Обработка...',
        success: (data) => { if(!data.success) throw new Error(data.error); return "Счет отправлен в Telegram"; },
        error: (err) => `Ошибка: ${err.message}`
    });
  };

  if (loading) return <div className="p-10 text-center font-mono text-red-500 pt-24 animate-pulse">ЗАГРУЗКА АРСЕНАЛА...</div>;

  return (
    // FIX: Changed bg-zinc-950 to bg-transparent so the Quake background shows through
    <div className="min-h-screen bg-transparent pt-28 p-4 pb-32 text-white font-orbitron">
      
      <div className="flex justify-between items-end mb-8 border-b-2 border-red-900/50 pb-2">
          <h1 className="text-4xl font-black text-zinc-100 italic tracking-tighter drop-shadow-lg">
            АРСЕНАЛ
          </h1>
          <div className="text-[10px] font-mono text-red-500 bg-red-900/20 px-2 py-1 border border-red-900/50">
             {gear.length} ЕД.
          </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {gear.map(item => (
          <div 
            key={item.id} 
            className="relative bg-black/60 backdrop-blur-sm border border-zinc-800 overflow-hidden flex flex-col hover:border-red-600 transition-colors group shadow-lg"
          >
            {/* Price Badge */}
            <div className="absolute top-0 right-0 bg-red-700 text-white text-[10px] font-bold px-3 py-1 z-10 font-mono shadow-md">
                {item.daily_price} XTR
            </div>

            {/* Image Container */}
            <div className="relative h-32 w-full bg-zinc-900/50 border-b border-zinc-800">
               {item.image_url ? (
                   <Image 
                     src={item.image_url} 
                     alt={item.make} 
                     fill 
                     className="object-cover opacity-80 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" 
                   />
               ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-zinc-700 font-bold font-mono text-2xl">
                     [Н/Д]
                   </div>
               )}
               
               {/* Tech Overlay (Scanlines on image) */}
               <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] pointer-events-none opacity-50" />
            </div>
            
            <div className="p-3 flex-1 flex flex-col">
               <h3 className="font-bold text-zinc-100 text-xs sm:text-sm leading-tight mb-1 uppercase tracking-wide">
                 {item.make} <span className="text-red-500">{item.model}</span>
               </h3>
               
               <p className="text-[9px] text-zinc-500 mb-4 flex-1 line-clamp-2 font-mono leading-tight tracking-tight">
                   {item.description || "Стандартное тактическое снаряжение. Характеристики засекречены."}
               </p>
               
               <button 
                 onClick={() => handleRent(item)}
                 className="w-full bg-zinc-900/80 text-red-500 border border-zinc-700 py-2 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-2 hover:bg-red-700 hover:text-white hover:border-red-500 transition-all active:scale-95 uppercase tracking-widest"
               >
                 <span>ВЗЯТЬ</span>
                 <FaCartPlus className="w-3 h-3" />
               </button>
            </div>
          </div>
        ))}
      </div>
      
      {gear.length === 0 && (
          <div className="text-center border border-dashed border-zinc-800 p-8 rounded bg-black/40 backdrop-blur-sm">
              <p className="text-zinc-500 font-mono text-xs">АРСЕНАЛ ПУСТ.</p>
          </div>
      )}
    </div>
  );
}