"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { toast } from "sonner";
import { createLobby } from "../actions"; // server action (see file above)

export const CreateLobbyForm: React.FC = () => {
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id ?? null;

  const [name, setName] = useState("");
  const [mode, setMode] = useState("tdm");
  const [maxPlayers, setMaxPlayers] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userId) return toast.error("Пожалуйста, войдите через Telegram.");
    if (name.trim().length < 3) return toast.error("Название должно быть не короче 3 символов.");

    setIsSubmitting(true);
    try {
      const result = await createLobby(userId, { name, mode, max_players: maxPlayers });
      if (!result.success) throw new Error(result.error || "Не удалось создать лобби");
      toast.success("Лобби создано! ID: " + result.lobby?.id);
      // Optionally: redirect or refresh context
      setName("");
    } catch (err) {
      toast.error("Ошибка: " + ((err as Error).message || "unknown"));
    } finally { setIsSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3 p-4 border rounded-lg bg-neutral-900">
      <label className="block">
        <div className="text-sm text-neutral-300">Название лобби</div>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 p-2 rounded-md bg-neutral-800 border border-neutral-700" placeholder="Например: Ночное захват" />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label>
          <div className="text-sm text-neutral-300">Режим</div>
          <select value={mode} onChange={e => setMode(e.target.value)} className="w-full mt-1 p-2 rounded-md bg-neutral-800 border border-neutral-700">
            <option value="tdm">Team Deathmatch</option>
            <option value="ctf">Capture The Flag</option>
            <option value="br">Battle Royale</option>
          </select>
        </label>

        <label>
          <div className="text-sm text-neutral-300">Макс игроков</div>
          <input type="number" min={2} max={64} value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))} className="w-full mt-1 p-2 rounded-md bg-neutral-800 border border-neutral-700" />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-md bg-emerald-600 disabled:opacity-50">
          {isSubmitting ? "Создание..." : "Создать лобби"}
        </button>
      </div>
    </form>
  );
};