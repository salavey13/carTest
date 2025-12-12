"use client";

import React, { useEffect, useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { getOpenLobbies, joinLobby } from "../actions";
import { toast } from "sonner";

type Lobby = {
  id: string;
  name: string;
  owner_id?: string;
  mode?: string;
  max_players?: number;
  created_at?: string;
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
      if (!res.success) throw new Error(res.error || "Не удалось загрузить");
      setLobbies(res.data || []);
    } catch (e) {
      toast.error("Ошибка загрузки лобби: " + ((e as Error).message || ""));
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleJoin = async (lobbyId: string) => {
    if (!userId) return toast.error("Войдите для присоединения.");
    try {
      const res = await joinLobby(userId, lobbyId);
      if (!res.success) throw new Error(res.error || "Join failed");
      toast.success("Вы присоединились к лобби!");
      // Optionally refresh
    } catch (e) {
      toast.error("Ошибка: " + ((e as Error).message || ""));
    }
  };

  return (
    // UPDATED PADDING: pt-24
    <div className="pt-24 p-4 min-h-screen bg-neutral-950 text-white">
      <h2 className="text-xl font-bold mb-3 font-orbitron text-cyan-400">OPEN LOBBIES</h2>
      {loading ? <div className="text-neutral-500 animate-pulse">Scanning frequencies...</div> : (
        <div className="space-y-3">
          {lobbies.length === 0 && <div className="text-neutral-500 border border-dashed border-neutral-800 p-4 rounded text-center">No signals found. Deploy a new lobby!</div>}
          {lobbies.map(l => (
            <div key={l.id} className="p-3 border border-neutral-800 rounded flex justify-between items-center bg-neutral-900/50 backdrop-blur-md">
              <div>
                <div className="font-semibold text-white">{l.name}</div>
                <div className="text-xs font-mono text-neutral-400">{l.mode || "tdm"} • {l.max_players || 0} SLOTS</div>
              </div>
              <div>
                <button onClick={() => handleJoin(l.id)} className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-colors">JOIN</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}