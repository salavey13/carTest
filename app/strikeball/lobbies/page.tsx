"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { getOpenLobbies, joinLobby } from "../actions";
import { toast } from "sonner";
import { FaUserAstronaut } from "react-icons/fa6";

type Lobby = {
  id: string;
  name: string;
  mode?: string;
  max_players?: number;
  created_at?: string;
  start_at?: string;
};

export default function LobbiesPageClient() {
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id ?? null;
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getOpenLobbies();
      if (!res.success) throw new Error(res.error || "Failed");
      setLobbies(res.data || []);
    } catch (e) {
      toast.error("Error: " + ((e as Error).message));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleJoin = async (lobbyId: string) => {
    if (!userId) return toast.error("LOGIN REQUIRED");
    const res = await joinLobby(userId, lobbyId);
    if (!res.success) toast.error(res.error);
    else toast.success("DEPLOYED!");
  };

  return (
    // Added pt-24
    <div className="pt-24 pb-24 p-4 min-h-screen bg-zinc-950 text-white font-orbitron">
      <h2 className="text-3xl font-black mb-6 text-red-600 tracking-tighter uppercase border-b border-red-900/50 pb-2">
        Active Operations
      </h2>
      
      {loading ? (
        <div className="text-center py-10 font-mono text-red-500 animate-pulse">
          SCANNING FREQUENCIES...
        </div>
      ) : (
        <div className="space-y-4">
          {lobbies.length === 0 && (
            <div className="text-zinc-600 border border-dashed border-zinc-800 p-8 rounded text-center font-mono">
              NO SIGNALS DETECTED.
            </div>
          )}
          {lobbies.map(l => (
            <div key={l.id} className="group relative bg-zinc-900/50 border border-zinc-800 hover:border-red-600/50 transition-colors p-4 overflow-hidden">
              <div className="absolute top-0 right-0 bg-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-400">
                 {l.mode?.toUpperCase() || "TDM"}
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-lg font-bold text-zinc-200 group-hover:text-red-500 transition-colors">
                    {l.name}
                  </div>
                  <div className="text-xs font-mono text-zinc-500 mt-1 flex gap-2">
                    <span>Slots: {l.max_players}</span>
                    <span>•</span>
                    <span>{l.start_at ? new Date(l.start_at).toLocaleDateString() : "ASAP"}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => handleJoin(l.id)} 
                  className="bg-red-900/20 text-red-500 border border-red-900/50 px-4 py-2 hover:bg-red-600 hover:text-white transition-all active:scale-95"
                >
                  JOIN
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}