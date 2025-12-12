"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { createStrikeballLobby } from "../actions";
import { cn } from "@/lib/utils";

const Q3Input = ({ label, value, onChange, type = "text", placeholder }: any) => (
  <label className="block mb-3">
    <div className="text-[10px] text-red-500 font-bold mb-1 uppercase tracking-wider">{label}</div>
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
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id ?? null;

  const [name, setName] = useState("");
  const [mode, setMode] = useState("tdm");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [maxPlayers, setMaxPlayers] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userId) return toast.error("LOGIN REQUIRED");
    if (name.trim().length < 3) return toast.error("INVALID LOBBY NAME");

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
          start_at: startAtISO 
      });
      
      if (!result.success) throw new Error(result.error || "DEPLOY FAILED");
      
      toast.success("LOBBY ESTABLISHED");
      setName("");
    } catch (err) {
      toast.error("ERROR: " + ((err as Error).message || "UNKNOWN"));
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-1">
      <Q3Input 
        label="Operation Name" 
        value={name} 
        onChange={(e: any) => setName(e.target.value)} 
        placeholder="Op: Red Storm" 
      />

      <div className="grid grid-cols-2 gap-3">
        <label className="block mb-3">
            <div className="text-[10px] text-red-500 font-bold mb-1 uppercase tracking-wider">Mode</div>
            <select 
                value={mode} 
                onChange={e => setMode(e.target.value)} 
                className="w-full p-3 bg-zinc-950 border border-zinc-700 text-zinc-300 font-mono text-sm focus:border-red-500 focus:outline-none rounded-none"
            >
                <option value="tdm">Team Deathmatch</option>
                <option value="ctf">Capture The Flag</option>
                <option value="mil">Milsim</option>
            </select>
        </label>

        <Q3Input 
            label="Slots" 
            type="number" 
            value={maxPlayers} 
            onChange={(e: any) => setMaxPlayers(Number(e.target.value))} 
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
         <Q3Input 
            label="Date" 
            type="date" 
            value={date} 
            onChange={(e: any) => setDate(e.target.value)} 
         />
         <Q3Input 
            label="Time" 
            type="time" 
            value={time} 
            onChange={(e: any) => setTime(e.target.value)} 
         />
      </div>

      <button 
        type="submit" 
        disabled={isSubmitting} 
        className={cn(
            "w-full py-4 mt-6 font-black text-lg uppercase tracking-[0.2em] border-2 transition-all duration-100 active:scale-95",
            isSubmitting ? "bg-zinc-800 border-zinc-600 text-zinc-500" : "bg-red-700 border-red-500 text-black hover:bg-red-600 hover:text-white"
        )}
      >
        {isSubmitting ? "INITIALIZING..." : "INITIATE"}
      </button>
    </form>
  );
};