"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { createCrew } from "@/app/actions"; 
import { cn } from "@/lib/utils";
import { FaUserShield, FaSkull, FaIdCard, FaQuoteLeft, FaArrowUpRightFromSquare, FaArrowRight } from "react-icons/fa6";
import Link from "next/link";

const Q3Input = ({ label, value, onChange, placeholder, icon: Icon }: any) => (
  <label className="block mb-4">
    <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="text-cyan-500 text-xs" />}
        <div className="text-[10px] text-cyan-500 font-black uppercase tracking-[0.2em]">{label}</div>
    </div>
    <input 
      type="text"
      value={value} 
      onChange={onChange} 
      className="w-full p-3 bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:border-cyan-500 focus:outline-none transition-all rounded-none placeholder:text-zinc-700" 
      placeholder={placeholder} 
    />
  </label>
);

export const CreateSquadForm = ({ onSuccess }: { onSuccess: () => void }) => {
  const { dbUser, userCrewInfo, refreshDbUser } = useAppContext();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setName(val);
      const generated = val.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      setSlug(generated);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbUser?.user_id) return toast.error("ТРЕБУЕТСЯ АВТОРИЗАЦИЯ");
    
    setIsSubmitting(true);
    toast.loading("РЕГИСТРАЦИЯ В СЕТИ...");

    try {
      const res = await createCrew({
          name, slug,
          description: description || "Игровой отряд системы CyberVibe",
          logo_url: "",
          owner_id: dbUser.user_id,
          hq_location: "" 
      });

      if (!res.success) throw new Error(res.error);
      
      toast.dismiss();
      toast.success("ОТРЯД СФОРМИРОВАН");
      await refreshDbUser();
      onSuccess();
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "ОШИБКА РЕГИСТРАЦИИ");
    } finally { setIsSubmitting(false); }
  };

  // --- СОСТОЯНИЕ: УЖЕ ЕСТЬ ОТРЯД ---
  if (userCrewInfo) {
    return (
        <div className="bg-black/90 border-2 border-amber-900 p-6 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
            <h3 className="text-amber-500 font-black font-orbitron text-xl tracking-tighter uppercase italic flex items-center gap-3 mb-4">
                <FaArrowUpRightFromSquare /> Эволюция Базы
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono mb-6 uppercase tracking-widest leading-relaxed">
                Твой отряд <span className="text-white">"{userCrewInfo.name}"</span> уже в системе. <br/>
                Хочешь открыть магазин услуг, управлять складом и принимать оплату в XTR?
            </p>
            <Link href={`/crews/create?upgrade=true`}>
                <button className="w-full py-4 bg-amber-600 text-black font-black font-orbitron uppercase tracking-[0.3em] hover:bg-white transition-all flex items-center justify-center gap-2">
                    СТАТЬ ПРОВАЙДЕРОМ <FaArrowRight />
                </button>
            </Link>
        </div>
    );
  }

  // --- СОСТОЯНИЕ: СОЗДАНИЕ НОВОГО ---
  return (
    <form onSubmit={submit} className="bg-black/90 border-2 border-cyan-900 p-6 shadow-[0_0_30px_rgba(0,163,255,0.1)]">
      <div className="mb-6 border-b border-cyan-900 pb-4">
        <h3 className="text-cyan-500 font-black font-orbitron text-xl tracking-tighter uppercase italic flex items-center gap-3">
            <FaUserShield /> Создать Отряд
        </h3>
        <p className="text-[9px] text-zinc-500 font-mono mt-1 uppercase tracking-widest leading-relaxed">
            Объедини друзей для игры. <br/>
            Никакой работы. Только тактика и смены в сети.
        </p>
      </div>

      <div className="space-y-2">
        <Q3Input label="Название" value={name} onChange={handleNameChange} placeholder="НАПР: ALPHA_UNIT" icon={FaSkull} />
        <Q3Input label="ID в URL (Slug)" value={slug} onChange={(e: any) => setSlug(e.target.value.toLowerCase())} placeholder="alpha-unit" icon={FaIdCard} />
      </div>
      
      <button type="submit" disabled={isSubmitting} className={cn("w-full py-4 font-black font-orbitron uppercase tracking-[0.3em] transition-all", isSubmitting ? "bg-zinc-800 text-zinc-600" : "bg-cyan-600 text-black hover:bg-white")}>
          {isSubmitting ? "ОБРАБОТКА..." : "СФОРМИРОВАТЬ_ОТРЯД"}
      </button>
    </form>
  );
};