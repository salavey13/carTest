"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, removeMember, fetchLobbyData } from "../../actions/lobby";
import { playerHit, playerRespawn, handleBaseInteraction } from "../../actions/game";
import { updateTransportStatus, signSafetyBriefing, joinCar } from "../../actions/logistics";
import { generateAndSendLobbyPdf } from "../../actions/service";
import { getLobbyCheckpoints, captureCheckpoint } from "../../actions/domination";

// --- Extracted Components (Israeli Pager Hardening) ---
import { SyncIndicator } from "./components/SyncIndicator";
import { LobbyHeader } from "./components/LobbyHeader";
import { LobbyTabs } from "./components/LobbyTabs";
import { CombatHUD } from "./components/CombatHUD";
import { MapTab } from "./components/MapTab";
import { LobbyFooter } from "./components/LobbyFooter";

// --- Tactical Modules ---
import { SquadRoster } from "../../components/SquadRoster";
import { BattleReportView } from "../../components/BattleReportView"; 
import { LogisticsPanel } from "../../components/LogisticsPanel";
import { SafetyBriefing } from "../../components/SafetyBriefing";
import { useTacticalOutbox } from "../../hooks/useTacticalOutbox";

// --- Party Service Providers ---
import { ProviderOffers } from "./components/ProviderOffers";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MapBounds, PointOfInterest } from "@/components/VibeMap";

const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';
const CITY_BOUNDS: MapBounds = { top: 56.4242, bottom: 56.08, left: 43.66, right: 44.1230 };

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

  // EXECUTE admin check once for the whole tree
  const isSystemAdmin = useMemo(() => {
    return typeof checkAdminFunc === 'function' ? checkAdminFunc() : false;
  }, [checkAdminFunc]);

  const userMember = members.find(m => m.user_id === dbUser?.user_id);
  const isOwner = lobby?.owner_id === dbUser?.user_id;

  // --- UPLINK PROCESSING ---
  const processUplink = useCallback(async (action: any) => {
      if (action.type === 'HIT') return await playerHit(lobbyId as string, action.payload.memberId);
      if (action.type === 'RESPAWN') return await playerRespawn(lobbyId as string, action.payload.memberId);
      if (action.type === 'CAPTURE') return await captureCheckpoint(dbUser?.user_id!, action.payload.checkpointId);
      if (action.type === 'BASE_INTERACT') return await handleBaseInteraction(lobbyId as string, dbUser?.user_id!, action.payload.targetTeam);
      return { success: true };
  }, [lobbyId, dbUser]);

  useEffect(() => {
      if (queue.length > 0) burstSync(processUplink);
  }, [queue.length, burstSync, processUplink]);

  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        if (!result.success || !result.lobby) { setError("ОШИБКА_УСТАНОВКИ_СВЯЗИ"); return; }
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
      .channel(`lobby_room_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, () => loadData())
      .subscribe();
    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId, loadData]);

  const mapData = useMemo(() => {
      if (!lobby?.field_id) return null;
      const points: PointOfInterest[] = [
          { id: 'target', name: 'ЦЕЛЬ_ОПЕРАЦИИ', type: 'point', coords: [lobby.field_id.split(',').map(Number)], icon: '::FaFlag::', color: 'bg-red-600' }
      ];
      return { points, bounds: CITY_BOUNDS };
  }, [lobby]);

  // --- TOP-LEVEL HANDLERS ---
  const handlePdfGen = async () => {
    if (!dbUser?.user_id) return;
    setIsGeneratingPdf(true);
    toast.loading("ГЕНЕРАЦИЯ_ОТЧЕТА...");
    try {
        const res = await generateAndSendLobbyPdf(dbUser.user_id, lobbyId as string);
        if (res.success) toast.success("PDF_ОТПРАВЛЕН_В_TELEGRAM");
        else toast.error(res.error);
    } catch (e) {
        toast.error("СБОЙ_ПЕЧАТИ");
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  const handleShare = () => {
    const link = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobbyId}`;
    const text = `Операция: ${lobby.name}\nПрисоединяйся к отряду!`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
  };

  const handleImHit = () => { 
    if (!userMember || userMember.status === 'dead' || !lobbyId) return;
    setMembers(prev => prev.map(m => m.id === userMember.id ? { ...m, status: 'dead' } : m));
    setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 150);
    addToOutbox('HIT', { memberId: userMember.id });
    toast.warning("KIA_ЗАПИСАНО // ПЕРЕДАЧА...");
  };

  const handleTacticalRespawn = () => {
      if (!tg?.showScanQrPopup) {
          setMembers(prev => prev.map(m => m.id === userMember.id ? { ...m, status: 'alive' } : m));
          setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 150);
          addToOutbox('RESPAWN', { memberId: userMember.id });
          return;
      }
      tg.showScanQrPopup({ text: "СКАНИРУЙ_QR_БАЗЫ_ИЛИ_ТОЧКИ" }, async (text: string) => {
          tg.closeScanQrPopup();
          if (!text) return true;
          if (text.startsWith('respawn_')) {
              const team = text.split('_')[2];
              addToOutbox('BASE_INTERACT', { targetTeam: team });
              toast.success("ЗАПРОС_ВЫСАДКИ_ОТПРАВЛЕН");
          } else if (text.startsWith('capture_')) {
              const cpId = text.replace('capture_', '');
              addToOutbox('CAPTURE', { checkpointId: cpId });
              toast.success("ТОЧКА_ОБНАРУЖЕНА // ОБРАБОТКА");
          }
          return true;
      });
  };

  const handleJoinTeam = async (team: string) => {
    if (!dbUser) return;
    const res = await joinLobby(dbUser.user_id, lobbyId as string, team);
    if (res.success) { toast.success(res.message); loadData(); }
  };

  const handleSafetySign = async (operatorData: any) => {
      if (!userMember) return;
      const res = await signSafetyBriefing(userMember.id, operatorData);
      if (res.success) {
          toast.success("ПРОТОКОЛ_ПОДПИСАН");
          loadData();
      } else {
          toast.error(res.error);
      }
  };

  if (error) return <div className="text-center pt-40 text-red-600 font-mono italic">КРИТИЧЕСКАЯ_ОШИБКА: {error}</div>;
  if (!lobby) return <div className="text-center pt-40 text-white font-mono animate-pulse uppercase">РЕКОНСТРУКЦИЯ_ОПЕРАЦИИ...</div>;

  return (
    <div className={cn("pt-28 pb-48 px-2 min-h-screen text-white font-mono transition-colors duration-200", whiteFlash ? "bg-white/10" : "bg-black")}>
      
      <SyncIndicator count={queue.length} />

      <LobbyHeader 
        name={lobby.name} 
        mode={lobby.mode} 
        status={lobby.status} 
        startAt={lobby.start_at}
        metadata={lobby.metadata}
        userMember={userMember} 
        isAdmin={isOwner || isSystemAdmin}
        onPdf={handlePdfGen} 
        onShare={handleShare} 
        loading={isGeneratingPdf} 
      />

      <LobbyTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="max-w-4xl mx-auto min-h-[40vh]">
          {activeTab === 'game' && (
             lobby.status === 'finished' 
                ? <BattleReportView lobby={lobby} members={members} checkpoints={checkpoints} />
                : <CombatHUD 
                    lobby={lobby} 
                    isOwner={isOwner} 
                    members={members}
                    loadData={loadData} 
                    dbUser={dbUser} 
                    isAdmin={isSystemAdmin}
                  />
          )}

          {activeTab === 'roster' && (
   <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
      <SquadRoster 
          teamName="ALPHA" 
          teamColor="blue" 
          members={members.filter(m => m.team === 'blue')} 
          onAddBot={isOwner ? () => addNoobBot(lobby.id, 'blue').then(loadData) : undefined} 
          onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} 
          onInvite={handleShare} 
          currentUserId={dbUser?.user_id} 
          isOwner={isOwner}
      />
      <SquadRoster 
          teamName="BRAVO" 
          teamColor="red" 
          members={members.filter(m => m.team === 'red')} 
          onAddBot={isOwner ? () => addNoobBot(lobby.id, 'red').then(loadData) : undefined} 
          onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} 
          onInvite={handleShare} 
          currentUserId={dbUser?.user_id} 
          isOwner={isOwner}
      />

        {/* The Comparison Marketplace - Only for 'open' lobbies */}
        {lobby.status === 'open' && (
            <div className="mt-10 border-t border-zinc-900 pt-10">
                <ProviderOffers playerCount={members.length} />
            </div>
        )}
   </div>
)}

          {activeTab === 'map' && <MapTab mapData={mapData} fieldId={lobby.field_id} />}

          {activeTab === 'logistics' && (
              <LogisticsPanel 
                userMember={userMember} members={members} carName={carName} setCarName={setCarName} 
                driverSeats={driverSeats} setDriverSeats={setDriverSeats}
                onToggleDriver={() => updateTransportStatus(userMember.id, { role: userMember?.metadata?.transport?.role === 'driver' ? 'none' : 'driver', seats: driverSeats, car_name: carName }).then(loadData)}
                onTogglePassenger={() => updateTransportStatus(userMember.id, { role: userMember?.metadata?.transport?.role === 'passenger' ? 'none' : 'passenger', seats: 0, car_name: '' }).then(loadData)}
                onUpdateCar={() => updateTransportStatus(userMember.id, { role: 'driver', seats: driverSeats, car_name: carName }).then(loadData)}
                onJoinCar={(dId) => joinCar(userMember.id, dId).then(loadData)}
              />
          )}

          {activeTab === 'safety' && (
              <SafetyBriefing onComplete={handleSafetySign} isSigned={!!userMember?.metadata?.safety_signed} />
          )}
      </div>

      <LobbyFooter 
        status={lobby.status} 
        userMember={userMember} 
        onHit={handleImHit} 
        onRespawn={handleTacticalRespawn} 
        onJoinTeam={handleJoinTeam} 
      />
    </div>
  );
}