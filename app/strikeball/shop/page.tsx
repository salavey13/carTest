"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useAppContext } from "@/contexts/AppContext";
import { getGearList, rentGear, payListingFee, contactSeller } from "../actions/market"; // Updated imports
import { generateGearCatalogPdf } from "../actions/service";
import { toast } from "sonner";
import { FaCartPlus, FaPrint, FaPlus, FaComments, FaSackDollar } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// Helper for "Sell Loot" Form
const SellLootModal = ({ onClose, userId }: any) => {
    const [form, setForm] = useState({ make: "", model: "", price: "", description: "", image_url: "" });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!form.model || !form.price) return toast.error("Заполните поля");
        setSubmitting(true);
        const res = await payListingFee(userId, form);
        setSubmitting(false);
        if(res.success) {
            toast.success(res.message);
            onClose();
        } else {
            toast.error(res.error);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md" onClick={onClose}>
            <div className="bg-zinc-900 border-2 border-amber-500 p-6 rounded w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="text-amber-500 font-orbitron font-bold text-xl mb-4 uppercase">ПРОДАТЬ ЛУТ (50 XTR)</h3>
                
                <div className="space-y-3 font-mono text-xs">
                    <input className="w-full bg-black border border-zinc-700 p-2 text-white" placeholder="Производитель (Cyma)" value={form.make} onChange={e => setForm({...form, make: e.target.value})} />
                    <input className="w-full bg-black border border-zinc-700 p-2 text-white" placeholder="Модель (AK-74)" value={form.model} onChange={e => setForm({...form, model: e.target.value})} />
                    <input className="w-full bg-black border border-zinc-700 p-2 text-white" placeholder="Цена (RUB)" type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                    <textarea className="w-full bg-black border border-zinc-700 p-2 text-white h-20" placeholder="Описание / Состояние..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                    <input className="w-full bg-black border border-zinc-700 p-2 text-white" placeholder="Ссылка на фото (URL)" value={form.image_url} onChange={e => setForm({...form, image_url: e.target.value})} />
                </div>

                <button onClick={handleSubmit} disabled={submitting} className="w-full bg-amber-600 hover:bg-amber-500 text-black font-black py-3 mt-6 uppercase tracking-wider">
                    {submitting ? "ОБРАБОТКА..." : "ОПЛАТИТЬ РАЗМЕЩЕНИЕ"}
                </button>
            </div>
        </div>
    );
};

export default function GearShop() {
  const { dbUser } = useAppContext();
  const [gear, setGear] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSelling, setIsSelling] = useState(false);

  useEffect(() => {
    getGearList().then(res => {
      if(res.success) setGear(res.data || []);
      setLoading(false);
    });
  }, []);

  // Handle Official Rent
  const handleRent = async (item: any) => {
    if (!dbUser?.user_id) return toast.error("ДОСТУП ЗАПРЕЩЕН");
    toast.promise(rentGear(dbUser.user_id, item.id), {
        loading: 'Обработка...',
        success: (data) => { if(!data.success) throw new Error(data.error); return "Счет отправлен в Telegram"; },
        error: (err) => `Ошибка: ${err.message}`
    });
  };

  // Handle P2P Contact
  const handleContact = async (item: any) => {
     if (!dbUser?.user_id) return toast.error("ДОСТУП ЗАПРЕЩЕН");
     toast.promise(contactSeller(dbUser.user_id, item.id), {
         loading: 'Связь с продавцом...',
         success: (data) => { if(!data.success) throw new Error(data.error); return "Запрос отправлен продавцу"; },
         error: (err) => `Ошибка: ${err.message}`
     });
  };

  const handlePrint = async () => {
      if (!dbUser?.user_id) return;
      setIsPrinting(true);
      toast.loading("Генерация каталога...");
      const res = await generateGearCatalogPdf(dbUser.user_id);
      toast.dismiss();
      setIsPrinting(false);
      if(res.success) toast.success(res.message);
      else toast.error(res.error);
  };

  if (loading) return <div className="p-10 text-center font-mono text-red-500 pt-24 animate-pulse">ЗАГРУЗКА АРСЕНАЛА...</div>;

  return (
    <div className="min-h-screen bg-transparent pt-28 p-4 pb-32 text-white font-orbitron">
      
      <AnimatePresence>
          {isSelling && <SellLootModal onClose={() => setIsSelling(false)} userId={dbUser?.user_id} />}
      </AnimatePresence>

      <div className="flex justify-between items-end mb-8 border-b-2 border-red-900/50 pb-2">
          <div className="flex flex-col">
              <h1 className="text-4xl font-black text-zinc-100 italic tracking-tighter drop-shadow-lg">
                АРСЕНАЛ
              </h1>
              <div className="text-[10px] font-mono text-red-500 bg-red-900/20 px-2 py-1 border border-red-900/50 w-fit mt-1">
                 {gear.length} ЕД.
              </div>
          </div>

          <div className="flex gap-2">
              {/* SELL BUTTON */}
              <button 
                onClick={() => setIsSelling(true)} 
                className="bg-amber-700/20 border border-amber-600 text-amber-500 p-3 rounded-full hover:bg-amber-600 hover:text-black transition-colors"
                title="Продать Лут"
              >
                  <FaSackDollar />
              </button>

              {/* Admin Print Button */}
              {(dbUser?.role === 'admin' || dbUser?.role === 'vprAdmin') && ( 
                  <button 
                    onClick={handlePrint} 
                    disabled={isPrinting}
                    className="bg-zinc-800 text-zinc-400 p-3 rounded-full hover:text-white hover:bg-zinc-700 transition-colors"
                    title="Печать QR-кодов"
                  >
                      <FaPrint />
                  </button>
              )}
          </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {gear.map(item => {
            const isLoot = item.type === 'loot';
            return (
          <div 
            key={item.id} 
            className={cn(
                "relative bg-black/60 backdrop-blur-sm border overflow-hidden flex flex-col transition-colors group shadow-lg",
                isLoot ? "border-amber-700/50 hover:border-amber-500" : "border-zinc-800 hover:border-red-600"
            )}
          >
            {/* Price Badge */}
            <div className={cn("absolute top-0 right-0 text-white text-[10px] font-bold px-3 py-1 z-10 font-mono shadow-md", isLoot ? "bg-amber-600" : "bg-red-700")}>
                {item.daily_price} {isLoot ? "RUB" : "XTR"}
            </div>

            {/* Type Badge */}
            {isLoot && <div className="absolute top-0 left-0 bg-amber-900/80 text-amber-100 text-[9px] font-bold px-2 py-0.5 z-10 font-mono">P2P</div>}

            {/* Image Container */}
            <div className="relative h-32 w-full bg-white border-b border-zinc-800">
               {item.image_url ? (
                   <Image 
                     src={item.image_url} 
                     alt={item.make} 
                     fill 
                     className="object-contain p-2 group-hover:scale-105 transition-transform duration-300" 
                   />
               ) : (
                   <div className="absolute inset-0 flex items-center justify-center text-zinc-400 font-bold font-mono text-2xl">[Н/Д]</div>
               )}
               <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none" />
            </div>
            
            <div className="p-3 flex-1 flex flex-col">
               <h3 className="font-bold text-zinc-100 text-xs sm:text-sm leading-tight mb-1 uppercase tracking-wide">
                 {item.make} <span className={isLoot ? "text-amber-500" : "text-red-500"}>{item.model}</span>
               </h3>
               
               <p className="text-[9px] text-zinc-500 mb-4 flex-1 line-clamp-2 font-mono leading-tight tracking-tight">
                   {item.description || "Характеристики засекречены."}
               </p>
               
               {/* Action Button */}
               {isLoot ? (
                   <button 
                     onClick={() => handleContact(item)}
                     className="w-full bg-amber-900/30 text-amber-500 border border-amber-700 py-2 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-2 hover:bg-amber-600 hover:text-black transition-all active:scale-95 uppercase tracking-widest"
                   >
                     <span>СВЯЗАТЬСЯ</span>
                     <FaComments />
                   </button>
               ) : (
                   <button 
                     onClick={() => handleRent(item)}
                     className="w-full bg-zinc-900/80 text-red-500 border border-zinc-700 py-2 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-2 hover:bg-red-700 hover:text-white hover:border-red-500 transition-all active:scale-95 uppercase tracking-widest"
                   >
                     <span>ВЗЯТЬ</span>
                     <FaCartPlus className="w-3 h-3" />
                   </button>
               )}
            </div>
          </div>
        )})}
      </div>
      
      {gear.length === 0 && (
          <div className="text-center border border-dashed border-zinc-800 p-8 rounded bg-black/40 backdrop-blur-sm">
              <p className="text-zinc-500 font-mono text-xs">АРСЕНАЛ ПУСТ.</p>
          </div>
      )}
    </div>
  );
}