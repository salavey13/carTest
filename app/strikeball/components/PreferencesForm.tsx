"use client";

import React, { useState } from "react";
import { useAppContext } from "@/contexts/AppContext";
import { updateUserPreferences } from "../actions"; // server action
import { toast } from "sonner";

export const PreferencesForm: React.FC = () => {
  const { dbUser } = useAppContext();
  const userId = dbUser?.user_id ?? null;
  const currentMeta = dbUser?.metadata ?? {};

  const [preferredMode, setPreferredMode] = useState<string>(currentMeta?.preferred_game_mode ?? "tdm");
  const [notifyOnInvite, setNotifyOnInvite] = useState<boolean>(!!currentMeta?.notify_on_invite);
  const [preferredField, setPreferredField] = useState<string | "">((currentMeta?.preferred_field_id as string) ?? "");

  const onSave = async () => {
    if (!userId) return toast.error("Войдите для сохранения настроек.");
    try {
      const res = await updateUserPreferences(userId, {
        preferred_game_mode: preferredMode,
        notify_on_invite: notifyOnInvite,
        preferred_field_id: preferredField || null,
      });
      if (!res.success) throw new Error(res.error || "Не удалось сохранить");
      toast.success("Настройки сохранены");
    } catch (e) {
      toast.error("Ошибка: " + ((e as Error).message || ""));
    }
  };

  return (
    <div className="p-4 border rounded bg-neutral-900 space-y-3">
      <h3 className="font-semibold">Настройки игрока</h3>
      <label>
        <div className="text-sm text-neutral-300">Предпочитаемый режим</div>
        <select value={preferredMode} onChange={e => setPreferredMode(e.target.value)} className="w-full mt-1 p-2 rounded-md bg-neutral-800">
          <option value="tdm">Team Deathmatch</option>
          <option value="ctf">Capture The Flag</option>
          <option value="br">Battle Royale</option>
        </select>
      </label>

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={notifyOnInvite} onChange={e => setNotifyOnInvite(e.target.checked)} />
        <span className="text-sm">Уведомлять о приглашениях в матчи</span>
      </label>

      <label>
        <div className="text-sm text-neutral-300">Предпочитаемое поле (id)</div>
        <input value={preferredField} onChange={e => setPreferredField(e.target.value)} className="w-full mt-1 p-2 rounded-md bg-neutral-800" placeholder="ID поля или пусто" />
      </label>

      <div className="flex justify-end">
        <button onClick={onSave} className="px-4 py-2 rounded bg-emerald-600">Сохранить</button>
      </div>
    </div>
  );
};