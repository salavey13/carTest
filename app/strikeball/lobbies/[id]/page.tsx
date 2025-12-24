"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";

// Privileged Actions (using supabaseAdmin internally)
import { fetchLobbyData, joinLobby, addNoobBot, removeMember } from "../../actions/lobby";
import { playerHit, playerRespawn, handleBaseInteraction } from "../../actions/game";
import { getLobbyCheckpoints } from "../../actions/domination";

// Tactical Components
import { SyncIndicator } from "./components/SyncIndicator";
import { LobbyHeader } from "./components/LobbyHeader";
import { LobbyTabs } from "./components/LobbyTabs";
import { CombatHUD } from "./components/CombatHUD";
import { MapTab } from "./components/MapTab";
import { LobbyFooter } from "./components/LobbyFooter";
import { DrinkRoyaleMap } from "./components/DrinkRoyaleMap";
import { VirtualBlaster } from "./components/VirtualBlaster";
import { SquadRoster } from "../../components/SquadRoster";
import { BattleReportView } from "../../components/BattleReportView";
import { useGeoTracking } from "../../hooks/useGeoTracking";
import { useTacticalOutbox } from "../../hooks/useTacticalOutbox";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, isAdmin: checkAdminFunc } = useAppContext();
  const { addToOutbox, burstSync, queue } = useTacticalOutbox();
  
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'game' | 'map' | 'logistics' | 'safety'>('roster'); 
  const [whiteFlash, setWhiteFlash] = useState(false);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);

  const isSystemAdmin = useMemo(() => typeof checkAdminFunc === 'function' ? checkAdminFunc() : false, [checkAdminFunc]);
  const userMember = members.find(m => m.user_id === dbUser?.user_id);
  const isOwner = lobby?.owner_id === dbUser?.user_id;

  // Track player if match is active
  useGeoTracking(lobbyId as string, dbUser?.user_id!, lobby?.status === 'active');

  // --- PRIVILEGED SYNC ENGINE ---
  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        if (!result.success || !result.lobby) { setError("CONNECTION_FAILED"); return; }
        
        setLobby(result.lobby);
        setMembers(result.members || []);

        const { data: cps } = await getLobbyCheckpoints(lobbyId as string);
        setCheckpoints(cps || []);

        if (result.lobby.status === 'finished' && activeTab !== 'game') setActiveTab('game');
    } catch (e) { setError("SIGNAL_LOST"); }
  }, [lobbyId, activeTab]);

  useEffect(() => {
    loadData();
    // Realtime triggers privileged loadData
    const channel = supabaseAnon
      .channel(`lobby_privileged_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, () => loadData())
      .subscribe();
    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId, loadData]);

  // --- OUTBOX HANDLER ---
  const processUplink = useCallback(async (action: any) => {
      const handlers: any = {
          'HIT': () => playerHit(lobbyId as string, action.payload.memberId),
          'RESPAWN': () => playerRespawn(lobbyId as string, action.payload.memberId),
          'CAPTURE': () => captureCheckpoint(dbUser?.user_id!, action.payload.checkpointId),
          'BASE_INTERACT': () => handleBaseInteraction(lobbyId as string, dbUser?.user_id!, action.payload.targetTeam)
      };
      return await (handlers[action.type]?.() || { success: true });
  }, [lobbyId, dbUser]);

  useEffect(() => { if (queue.length > 0) burstSync(processUplink); }, [queue.length, burstSync, processUplink]);

  const isDrinkRoyale = lobby?.mode === 'DRINKNIGHT ROYALE';

  if (error) return <div className="pt-40 text-center text-red-600 font-mono italic">CRITICAL_ERROR: {error}</div>;
  if (!lobby) return <div className="pt-40 text-center text-white font-mono animate-pulse uppercase">RECONSTRUCTING_OPERATION...</div>;

  return (
    <div className={cn("pt-28 pb-48 px-2 min-h-screen text-white font-mono transition-colors", whiteFlash ? "bg-white/10" : "bg-black")}>
      
      <SyncIndicator count={queue.length} />

      <LobbyHeader 
        name={lobby.name} mode={lobby.mode} status={lobby.status} 
        startAt={lobby.start_at} metadata={lobby.metadata}
        userMember={userMember} isAdmin={isOwner || isSystemAdmin}
        onPdf={() => {}} onShare={() => {}} loading={false} 
      />

      <LobbyTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-4xl mx-auto min-h-[40vh]">
          {activeTab === 'game' && (
             lobby.status === 'finished' 
                ? <BattleReportView lobby={lobby} members={members} checkpoints={checkpoints} />
                : <CombatHUD lobby={lobby} isOwner={isOwner} members={members} loadData={loadData} dbUser={dbUser} isAdmin={isSystemAdmin} />
          )}

          {activeTab === 'roster' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
                <SquadRoster teamName="ALPHA" teamColor="blue" members={members.filter(m => m.team === 'blue')} onAddBot={isOwner ? () => addNoobBot(lobby.id, 'blue').then(loadData) : undefined} onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} currentUserId={dbUser?.user_id} isOwner={isOwner} />
                <SquadRoster teamName="BRAVO" teamColor="red" members={members.filter(m => m.team === 'red')} onAddBot={isOwner ? () => addNoobBot(lobby.id, 'red').then(loadData) : undefined} onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} currentUserId={dbUser?.user_id} isOwner={isOwner} />
             </div>
          )}

          {activeTab === 'map' && (
              isDrinkRoyale 
                ? <DrinkRoyaleMap lobby={lobby} members={members} dbUser={dbUser} />
                : <MapTab fieldId={lobby.field_id} />
          )}
      </div>

      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50">
          {lobby.status === 'active' && isDrinkRoyale && userMember?.status === 'alive' ? (
              <VirtualBlaster onHit={() => { setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 150); addToOutbox('HIT', { memberId: userMember.id }); }} />
          ) : (
              <LobbyFooter status={lobby.status} userMember={userMember} onHit={() => addToOutbox('HIT', { memberId: userMember.id })} onRespawn={() => {}} onJoinTeam={(t:string) => joinLobby(dbUser?.user_id!, lobby.id, t).then(loadData)} />
          )}
      </div>
    </div>
  );
}