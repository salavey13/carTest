"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useAppContext } from "@/contexts/AppContext";
import { getGearList, rentGear } from "../actions/market"; // Updated import
import { toast } from "sonner";
import { FaCartPlus } from "react-icons/fa6";

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
    <div className="min-h-screen bg-zinc-950 pt-24 p-4 pb-24 text-white">
      <div className="flex justify-between items-end mb-6 border-b border-zinc-800 pb-2">
          <h1 className="text-3xl font-orbitron font-black text-red-600 italic">АРСЕНАЛ</h1>
          <span className="text-xs font-mono text-zinc-500">{gear.length} ЕД.</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {gear.map(item => (
          <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 overflow-hidden flex flex-col hover:border-red-900 transition-colors group relative">
            <div className="absolute top-0 right-0 bg-red-900 text-white text-[10px] font-bold px-2 py-1 z-10 font-mono">
                {item.daily_price} XTR
            </div>

            <div className="relative h-28 w-full bg-black/50">
               {item.image_url ? (
                   <Image src={item.image_url} alt={item.make} fill className="object-cover opacity-70 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" />
               ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-zinc-800 font-bold font-mono text-2xl">Н/Д</div>
               )}
            </div>
            
            <div className="p-3 flex-1 flex flex-col">
               <h3 className="font-bold text-zinc-200 text-sm leading-tight mb-1 uppercase">{item.make} {item.model}</h3>
               <p className="text-[9px] text-zinc-500 mb-3 flex-1 line-clamp-2 font-mono leading-tight">
                   {item.description || "Стандартное снаряжение"}
               </p>
               
               <button 
                 onClick={() => handleRent(item)}
                 className="w-full bg-zinc-950 text-red-500 border border-zinc-800 py-2 font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-900 hover:text-white hover:border-red-700 transition-all active:scale-95 uppercase tracking-wider">
                 <span>ВЗЯТЬ</span>
                 <FaCartPlus size={10} />
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}