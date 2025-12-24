"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";

// --- PRIVILEGED ACTIONS ---
import { fetchLobbyData, joinLobby, addNoobBot, removeMember } from "../../actions/lobby";
import { playerHit, playerRespawn, handleBaseInteraction } from "../../actions/game";
import { updateTransportStatus, signSafetyBriefing, joinCar } from "../../actions/logistics";
import { generateAndSendLobbyPdf } from "../../actions/service";
import { getLobbyCheckpoints } from "../../actions/domination";

// --- COMPONENTS ---
import { SyncIndicator } from "./components/SyncIndicator";
import { LobbyHeader } from "./components/LobbyHeader";
import { LobbyTabs } from "./components/LobbyTabs";
import { CombatHUD } from "./components/CombatHUD";
import { MapTab } from "./components/MapTab";
import { LobbyFooter } from "./components/LobbyFooter";
import { DrinkRoyaleMap } from "./components/DrinkRoyaleMap";
import { VirtualBlaster } from "./components/VirtualBlaster";
import { ProviderOffers } from "./components/ProviderOffers";
import { SquadRoster } from "../../components/SquadRoster";
import { BattleReportView } from "../../components/BattleReportView"; 
import { LogisticsPanel } from "../../components/LogisticsPanel";
import { SafetyBriefing } from "../../components/SafetyBriefing";
import { useTacticalOutbox } from "../../hooks/useTacticalOutbox";
import { useGeoTracking } from "../../hooks/useGeoTracking";

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
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Logistics State
  const [driverSeats, setDriverSeats] = useState(3);
  const [carName, setCarName] = useState("");

  const isSystemAdmin = useMemo(() => typeof checkAdminFunc === 'function' ? checkAdminFunc() : false, [checkAdminFunc]);
  const userMember = members.find(m => m.user_id === dbUser?.user_id);
  const isOwner = lobby?.owner_id === dbUser?.user_id;

  // Track player if match is active
  useGeoTracking(lobbyId as string, dbUser?.user_id!, lobby?.status === 'active');

  // --- ENGINE: LOAD DATA (Privileged) ---
  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        if (!result.success || !result.lobby) { setError("ОШИБКА_СИНХРОНИЗАЦИИ"); return; }
        setLobby(result.lobby);
        setMembers(result.members || []);

        const me = result.members?.find((m: any) => m.user_id === dbUser?.user_id);
        if (me?.metadata?.transport?.role === 'driver') {
             if (!carName) setCarName(me.metadata.transport.car_name || "");
             setDriverSeats(me.metadata.transport.seats || 3);
        }
        const { data: cps } = await getLobbyCheckpoints(lobbyId as string);
        setCheckpoints(cps || []);
        if (result.lobby.status === 'finished' && activeTab !== 'game') setActiveTab('game');
    } catch (e) { setError("СИГНАЛ_ПОТЕРЯН"); }
  }, [lobbyId, dbUser?.user_id, activeTab, carName]);

  useEffect(() => {
    loadData();
    const channel = supabaseAnon
      .channel(`lobby_sync_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, () => loadData())
      .subscribe();
    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId, loadData]);

  // --- ENGINE: UPLINK (Server Actions) ---
  const processUplink = useCallback(async (action: any) => {
      if (action.type === 'HIT') return await playerHit(lobbyId as string, action.payload.memberId);
      if (action.type === 'RESPAWN') return await playerRespawn(lobbyId as string, action.payload.memberId);
      if (action.type === 'CAPTURE') return await captureCheckpoint(dbUser?.user_id!, action.payload.checkpointId);
      if (action.type === 'BASE_INTERACT') return await handleBaseInteraction(lobbyId as string, dbUser?.user_id!, action.payload.targetTeam);
      return { success: true };
  }, [lobbyId, dbUser]);

  useEffect(() => { if (queue.length > 0) burstSync(processUplink); }, [queue.length, burstSync, processUplink]);

  const isDrinkRoyale = lobby?.mode === 'DRINKNIGHT ROYALE';

  if (error) return <div className="text-center pt-40 text-red-600 font-mono italic">КРИТИЧЕСКАЯ_ОШИБКА: {error}</div>;
  if (!lobby) return <div className="text-center pt-40 text-white font-mono animate-pulse uppercase">РЕКОНСТРУКЦИЯ_ОПЕРАЦИИ...</div>;

  return (
    <div className={cn("pt-28 pb-48 px-2 min-h-screen text-white font-mono transition-colors", whiteFlash ? "bg-white/10" : "bg-black")}>
      <SyncIndicator count={queue.length} />

      <LobbyHeader 
        name={lobby.name} mode={lobby.mode} status={lobby.status} 
        startAt={lobby.start_at} metadata={lobby.metadata}
        userMember={userMember} isAdmin={isOwner || isSystemAdmin}
        onPdf={() => generateAndSendLobbyPdf(dbUser?.user_id!, lobby.id)} onShare={() => {}} loading={isGeneratingPdf} 
      />

      <LobbyTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-4xl mx-auto min-h-[40vh]">
          {activeTab === 'game' && (
             lobby.status === 'finished' 
                ? <BattleReportView lobby={lobby} members={members} checkpoints={checkpoints} />
                : <CombatHUD lobby={lobby} isOwner={isOwner} members={members} loadData={loadData} dbUser={dbUser} isAdmin={isSystemAdmin} />
          )}

          {activeTab === 'roster' && (
            <div className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
                  <SquadRoster teamName="ALPHA" teamColor="blue" members={members.filter(m => m.team === 'blue')} onAddBot={isOwner ? () => addNoobBot(lobby.id, 'blue').then(loadData) : undefined} onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} currentUserId={dbUser?.user_id} isOwner={isOwner} />
                  <SquadRoster teamName="BRAVO" teamColor="red" members={members.filter(m => m.team === 'red')} onAddBot={isOwner ? () => addNoobBot(lobby.id, 'red').then(loadData) : undefined} onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} currentUserId={dbUser?.user_id} isOwner={isOwner} />
               </div>
               {lobby.status === 'open' && (
                 <ProviderOffers lobbyId={lobby.id} playerCount={members.length} selectedProviderId={lobby.provider_id} selectedServiceId={lobby.metadata?.selected_offer?.serviceId} />
               )}
            </div>
          )}

          {activeTab === 'map' && (
              isDrinkRoyale 
                ? <DrinkRoyaleMap lobby={lobby} members={members} dbUser={dbUser} />
                : <MapTab fieldId={lobby.field_id} />
          )}

          {activeTab === 'logistics' && (
              <LogisticsPanel 
                userMember={userMember} members={members} carName={carName} setCarName={setCarName} 
                driverSeats={driverSeats} setDriverSeats={setDriverSeats}
                onToggleDriver={() => updateTransportStatus(userMember.id, { role: userMember?.metadata?.transport?.role === 'driver' ? 'none' : 'driver', seats: driverSeats, car_name: carName }).then(loadData)}
                onTogglePassenger={() => updateTransportStatus(userMember.id, { role: userMember?.metadata?.transport?.role === 'passenger' ? 'none' : 'passenger', seats: 0, car_name: '' }).then(loadData)}
                onUpdateCar={() => updateTransportStatus(userMember.id, { role: 'driver', seats: driverSeats, car_name: carName }).then(loadData)}
                onJoinCar={(dId: string) => joinCar(userMember.id, dId).then(loadData)}
              />
          )}

          {activeTab === 'safety' && (
              <SafetyBriefing onComplete={(data: any) => signSafetyBriefing(userMember.id, data).then(loadData)} isSigned={!!userMember?.metadata?.safety_signed} />
          )}
      </div>

      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50">
          {lobby.status === 'active' && isDrinkRoyale && userMember?.status === 'alive' ? (
              <VirtualBlaster onHit={() => { setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 150); addToOutbox('HIT', { memberId: userMember.id }); }} />
          ) : (
              <LobbyFooter status={lobby.status} userMember={userMember} onHit={() => { setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 150); addToOutbox('HIT', { memberId: userMember.id }); }} onRespawn={() => {}} onJoinTeam={(t:string) => joinLobby(dbUser?.user_id!, lobby.id, t).then(loadData)} />
          )}
      </div>
    </div>
  );
}