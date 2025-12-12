"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useAppContext } from "@/contexts/AppContext";
import { getGearList, rentGear } from "../actions";
import { toast } from "sonner";
import { FaStar, FaCartPlus } from "react-icons/fa6";

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
    if (!dbUser?.user_id) return toast.error("ACCESS DENIED: Auth required");
    
    toast.promise(rentGear(dbUser.user_id, item.id), {
        loading: 'Processing requisition...',
        success: (data) => {
            if(!data.success) throw new Error(data.error);
            return "Invoice sent to encrypted channel (Telegram)";
        },
        error: (err) => `Failed: ${err.message}`
    });
  };

  if (loading) return <div className="p-10 text-center font-mono text-emerald-500">LOADING ARMORY DATA...</div>;

  return (
    <div className="min-h-screen bg-neutral-950 p-4 pb-20">
      <div className="flex justify-between items-end mb-6">
          <h1 className="text-3xl font-orbitron font-bold text-emerald-400">ARMORY</h1>
          <span className="text-xs font-mono text-neutral-500">{gear.length} ITEMS AVAILABLE</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {gear.map(item => (
          <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col hover:border-emerald-500/30 transition-colors group">
            <div className="relative h-32 w-full bg-neutral-800">
               {item.image_url ? (
                   <Image src={item.image_url} alt={item.make} fill className="object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
               ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-neutral-700 font-bold font-mono">NO IMG</div>
               )}
               <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-emerald-400 border border-emerald-500/20">
                   {item.type?.toUpperCase()}
               </div>
            </div>
            
            <div className="p-3 flex-1 flex flex-col">
               <div className="flex justify-between items-start mb-2">
                 <h3 className="font-bold text-white text-sm leading-tight">{item.make} {item.model}</h3>
               </div>
               
               <p className="text-[10px] text-neutral-500 mb-4 flex-1 line-clamp-2 font-mono">
                   {item.description || "Standard issue equipment."}
               </p>
               
               <button 
                 onClick={() => handleRent(item)}
                 className="w-full bg-emerald-950 text-emerald-400 border border-emerald-900 py-2 rounded font-bold text-xs flex items-center justify-center gap-2 hover:bg-emerald-900 transition-colors active:scale-95">
                 <span>{item.daily_price} XTR</span>
                 <FaCartPlus />
               </button>
            </div>
          </div>
        ))}
      </div>
      
      {gear.length === 0 && (
          <div className="text-center text-neutral-600 font-mono mt-10">
              ARMORY IS EMPTY.<br/>ADD ITEMS TO 'CARS' TABLE WITH TYPE='gear'
          </div>
      )}
    </div>
  );
}