"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { createStrikeballLobby } from "../actions/lobby";
import { cn } from "@/lib/utils";
import { FaUsers, FaCheck, FaLocationDot } from "react-icons/fa6";

const Q3Input = ({ label, value, onChange, type = "text", placeholder, icon }: any) => (
  <label className="block mb-3">
    <div className="flex items-center gap-2 mb-1">
        <div className="text-[10px] text-red-500 font-bold uppercase tracking-wider">{label}</div>
        {icon && <div className="text-red-500 text-xs">{icon}</div>}
    </div>
    <input 
      type={type}
      value={value} 
      onChange={onChange} 
      className="w-full p-3 bg-zinc-950 border border-zinc-700 text-zinc-300 font-mono text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-900 transition-colors rounded-none placeholder:text-zinc-800" 
      placeholder={placeholder} 
    />
  </label>
);

export const CreateLobbyForm: React.FC = () => {
  const { dbUser, userCrewInfo } = useAppContext();
  const userId = dbUser?.user_id ?? null;

  const [name, setName] = useState("");
  const [mode, setMode] = useState("tdm");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [location, setLocation] = useState("56.3269,44.0059");
  const [maxPlayers, setMaxPlayers] = useState<number>(20);
  const [hostAsCrew, setHostAsCrew] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userId) return toast.error("ТРЕБУЕТСЯ АВТОРИЗАЦИЯ");
    if (name.trim().length < 3) return toast.error("СЛИШКОМ КОРОТКОЕ НАЗВАНИЕ");

    setIsSubmitting(true);
    
    let startAtISO = null;
    if (date && time) {
        const d = new Date(`${date}T${time}`);
        startAtISO = d.toISOString();
    }

    try {
      const result = await createStrikeballLobby(userId, { 
          name, 
          mode, 
          max_players: maxPlayers,
          start_at: startAtISO,
          crew_id: (hostAsCrew && userCrewInfo) ? userCrewInfo.id : undefined,
          location: location // Pass GPS string
      });
      
      if (!result.success) throw new Error(result.error || "ОШИБКА СОЗДАНИЯ");
      
      toast.success("ОПЕРАЦИЯ СОЗДАНА");
      setName("");
    } catch (err) {
      toast.error("ОШИБКА: " + ((err as Error).message || "UNKNOWN"));
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-1">
      <Q3Input 
        label="Название Операции" 
        value={name} 
        onChange={(e: any) => setName(e.target.value)} 
        placeholder="Напр: Штурм Форта" 
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="block mb-3">
            <div className="text-[10px] text-red-500 font-bold mb-1 uppercase tracking-wider">Режим</div>
            <select 
                value={mode} 
                onChange={e => setMode(e.target.value)} 
                className="w-full p-3 bg-zinc-950 border border-zinc-700 text-zinc-300 font-mono text-sm focus:border-red-500 focus:outline-none rounded-none"
            >
                <option value="tdm">Team Deathmatch</option>
                <option value="ctf">Захват Флага</option>
                <option value="mil">Мильсим</option>
                <option value="cqb">CQB (Помещение)</option>
            </select>
        </label>

        <Q3Input 
            label="Мест" 
            type="number" 
            value={maxPlayers} 
            onChange={(e: any) => setMaxPlayers(Number(e.target.value))} 
        />
      </div>

      <Q3Input 
        label="Координаты (GPS)" 
        value={location} 
        onChange={(e: any) => setLocation(e.target.value)} 
        placeholder="56.3269, 44.0059" 
        icon={<FaLocationDot />}
      />

      {userCrewInfo && userCrewInfo.is_owner && (
          <div 
            onClick={() => setHostAsCrew(!hostAsCrew)}
            className={cn(
                "border p-3 cursor-pointer transition-all flex items-center justify-between mb-3 mt-2",
                hostAsCrew ? "bg-cyan-950/30 border-cyan-500" : "bg-zinc-950 border-zinc-800 hover:border-zinc-600"
            )}
          >
              <div className="flex items-center gap-2">
                  <FaUsers className={hostAsCrew ? "text-cyan-400" : "text-zinc-600"} />
                  <span className={cn("text-xs font-bold font-orbitron", hostAsCrew ? "text-cyan-100" : "text-zinc-500")}>
                      ОТРЯД: {userCrewInfo.name.toUpperCase()}
                  </span>
              </div>
              <div className={cn("w-4 h-4 border flex items-center justify-center", hostAsCrew ? "border-cyan-500 bg-cyan-500 text-black" : "border-zinc-700")}>
                  {hostAsCrew && <FaCheck size={10} />}
              </div>
          </div>
      )}

      <div className="grid grid-cols-2 gap-3">
         <Q3Input label="Дата" type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
         <Q3Input label="Время" type="time" value={time} onChange={(e: any) => setTime(e.target.value)} />
      </div>

      <button 
        type="submit" 
        disabled={isSubmitting} 
        className={cn(
            "w-full py-4 mt-6 font-black text-lg uppercase tracking-[0.2em] border-2 transition-all duration-100 active:scale-95",
            isSubmitting ? "bg-zinc-800 border-zinc-600 text-zinc-500" : "bg-red-700 border-red-500 text-black hover:bg-red-600 hover:text-white"
        )}
      >
        {isSubmitting ? "ЗАГРУЗКА..." : "СОЗДАТЬ"}
      </button>
    </form>
  );
};