"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useAppContext } from "@/contexts/AppContext";
import { getGearList, rentGear } from "../actions";
import { toast } from "sonner";
import { FaStar } from "react-icons/fa6";

export default function GearShop() {
  const { dbUser } = useAppContext();
  const [gear, setGear] = useState<any[]>([]);

  useEffect(() => {
    getGearList().then(res => {
      if(res.success) setGear(res.data || []);
    });
  }, []);

  const handleRent = async (item: any) => {
    if (!dbUser?.user_id) return toast.error("Auth required");
    toast.loading("Generating Invoice...");
    
    const res = await rentGear(dbUser.user_id, item.id);
    toast.dismiss();
    
    if (res.success) {
      toast.success("Invoice sent to Telegram chat!");
    } else {
      toast.error(res.error || "Failed");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 p-4">
      <h1 className="text-3xl font-orbitron font-bold text-emerald-400 mb-6">ARMORY</h1>
      
      <div className="grid grid-cols-2 gap-4">
        {gear.map(item => (
          <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col">
            <div className="relative h-32 w-full bg-neutral-800">
               {/* Use placeholder if no image */}
               <div className="absolute inset-0 flex items-center justify-center text-neutral-600 font-bold">
                 {item.image_url ? <Image src={item.image_url} alt={item.name} fill className="object-cover" /> : "NO IMG"}
               </div>
            </div>
            
            <div className="p-3 flex-1 flex flex-col">
               <div className="flex justify-between items-start mb-2">
                 <h3 className="font-bold text-white text-sm">{item.name}</h3>
                 <span className="flex items-center gap-1 text-emerald-400 font-mono text-xs">
                    <FaStar /> {item.price_xtr}
                 </span>
               </div>
               <p className="text-xs text-neutral-500 mb-4 flex-1 line-clamp-2">{item.description}</p>
               
               <button 
                 onClick={() => handleRent(item)}
                 className="w-full bg-emerald-600/20 border border-emerald-600/50 text-emerald-400 py-2 rounded font-bold text-xs hover:bg-emerald-600 hover:text-white transition-colors">
                 RENT (XTR)
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}