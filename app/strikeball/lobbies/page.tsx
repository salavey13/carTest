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
    <div className="p-4">
      <h2 className="text-xl font-bold mb-3">Открытые лобби</h2>
      {loading ? <div>Загрузка...</div> : (
        <div className="space-y-3">
          {lobbies.length === 0 && <div>Лобби пока нет — создай своё!</div>}
          {lobbies.map(l => (
            <div key={l.id} className="p-3 border rounded flex justify-between items-center bg-neutral-900">
              <div>
                <div className="font-semibold">{l.name}</div>
                <div className="text-sm text-neutral-400">{l.mode || "tdm"} • {l.max_players || 0} мест</div>
              </div>
              <div>
                <button onClick={() => handleJoin(l.id)} className="px-3 py-1 rounded bg-blue-600">Присоединиться</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}