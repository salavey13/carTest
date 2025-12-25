"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";

// --- ЭКШЕНЫ ---
import { fetchLobbyData, joinLobby, addNoobBot, removeMember } from "../../actions/lobby";
import { playerHit, playerRespawn, handleBaseInteraction } from "../../actions/game";
import { generateAndSendLobbyPdf } from "../../actions/service";

// --- КОМПОНЕНТЫ ---
import { SyncIndicator } from "./components/SyncIndicator";
import { LobbyHeader } from "./components/LobbyHeader";
import { LobbyTabs } from "./components/LobbyTabs";
import { LobbyFooter } from "./components/LobbyFooter";
import { VirtualBlaster } from "./components/VirtualBlaster";
import { LobbyTabManager } from "./components/LobbyTabManager";

// --- ХУКИ ---
import { useGeoTracking } from "../../hooks/useGeoTracking";
import { useTacticalOutbox } from "../../hooks/useTacticalOutbox";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg, isAdmin: checkAdminFunc } = useAppContext();
  const { addToOutbox, burstSync, queue } = useTacticalOutbox();
  
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'game' | 'map' | 'logistics' | 'safety'>('roster'); 
  const [whiteFlash, setWhiteFlash] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const isSystemAdmin = useMemo(() => typeof checkAdminFunc === 'function' ? checkAdminFunc() : false, [checkAdminFunc]);
  
  // КРИТИЧНО: Привязываем участника строго к текущему лобби по ID
  const userMember = useMemo(() => members.find(m => m.user_id === dbUser?.user_id), [members, dbUser]);
  const isOwner = useMemo(() => lobby?.owner_id === dbUser?.user_id, [lobby, dbUser]);

  const isDrinkRoyale = lobby?.mode === 'DRINKNIGHT ROYALE';

  // Трекинг работает, если это лобби активно
  useGeoTracking(lobbyId as string, dbUser?.user_id!, lobby?.status === 'active', dbUser);

  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        if (!result.success || !result.lobby) { setError("СВЯЗЬ_ПРЕРВАНА"); return; }
        setLobby(result.lobby);
        setMembers(result.members || []);
        if (result.lobby.status === 'finished' && activeTab !== 'game') setActiveTab('game');
    } catch (e) { setError("ОШИБКА_СЕТИ"); }
  }, [lobbyId, activeTab]);

  useEffect(() => {
    loadData();
    const channel = supabaseAnon
      .channel(`lobby_room_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` }, loadData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, loadData)
      .subscribe();
    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId, loadData]);

  const processUplink = useCallback(async (action: any) => {
      if (action.type === 'HIT') return await playerHit(lobbyId as string, action.payload.memberId);
      if (action.type === 'RESPAWN') return await playerRespawn(lobbyId as string, action.payload.memberId);
      if (action.type === 'BASE_INTERACT') return await handleBaseInteraction(lobbyId as string, dbUser?.user_id!, action.payload.targetTeam);
      return { success: true };
  }, [lobbyId, dbUser]);

  useEffect(() => { if (queue.length > 0) burstSync(processUplink); }, [queue.length, burstSync, processUplink]);

  const handleImHit = () => { 
    if (!userMember || userMember.status === 'dead') return;
    setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 150);
    addToOutbox('HIT', { memberId: userMember.id });
    toast.warning("KIA_ЗАПИСАНО // ПЕРЕДАЧА...");
  };

  if (error) return <div className="pt-40 text-center text-red-600 font-mono italic text-xl">КРИТИЧЕСКАЯ_ОШИБКА: {error}</div>;
  if (!lobby) return <div className="pt-40 text-center text-white font-mono animate-pulse uppercase">Загрузка_Операции...</div>;

  return (
    <div className={cn("pt-28 pb-48 px-2 min-h-screen text-white font-mono transition-colors duration-200", whiteFlash ? "bg-white/10" : "bg-black")}>
      
      <SyncIndicator count={queue.length} />

      <LobbyHeader 
        name={lobby.name} mode={lobby.mode} status={lobby.status} 
        startAt={lobby.start_at} metadata={lobby.metadata}
        userMember={userMember} isAdmin={isOwner || isSystemAdmin}
        onPdf={() => generateAndSendLobbyPdf(dbUser?.user_id!, lobby.id)} onShare={() => {}} loading={isGeneratingPdf} 
      />

      <LobbyTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-4xl mx-auto min-h-[40vh]">
          <LobbyTabManager 
            activeTab={activeTab}
            lobby={lobby}
            members={members}
            dbUser={dbUser}
            isOwner={isOwner}
            isAdmin={isSystemAdmin}
            loadData={loadData}
          />
      </div>

      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50">
          {lobby.status === 'active' && isDrinkRoyale && userMember?.status === 'alive' ? (
              <VirtualBlaster onHit={handleImHit} />
          ) : (
              <LobbyFooter 
                status={lobby.status} 
                userMember={userMember} 
                onHit={handleImHit} 
                onRespawn={() => addToOutbox('RESPAWN', { memberId: userMember.id })} 
                onJoinTeam={(team: string) => joinLobby(dbUser?.user_id!, lobby.id, team).then(loadData)} 
              />
          )}
      </div>
    </div>
  );
}