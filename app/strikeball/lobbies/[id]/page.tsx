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

// --- Tactical Modules ---
import { SquadRoster } from "../../components/SquadRoster";
import { CommandConsole } from "../../components/CommandConsole"; 
import { LiveHUD } from "../../components/LiveHUD";
import { DominationHUD } from "../../components/DominationHUD";
import { AdminCheckpointPanel } from "../../components/AdminCheckpointPanel";
import { SafetyBriefing } from "../../components/SafetyBriefing";
import { LogisticsPanel } from "../../components/LogisticsPanel";
import { BattleReportView } from "../../components/BattleReportView"; 
import { useTacticalOutbox } from "../../hooks/useTacticalOutbox";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaShareNodes, FaFilePdf, FaCar, FaClipboardCheck, FaUsers, FaGamepad, FaWifi, FaMapLocationDot, FaQrcode, FaSpinner } from "react-icons/fa6";
import { VibeMap, MapBounds, PointOfInterest } from "@/components/VibeMap";

const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';

// Калиброванные границы для изображения города (Nizhny Novgorod Grid)
const CITY_BOUNDS: MapBounds = { 
    top: 56.42, 
    bottom: 56.0825, 
    left: 43.6603, 
    right: 44.1230 
};

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg } = useAppContext();
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

  const processUplink = useCallback(async (action: any) => {
      if (action.type === 'HIT') return await playerHit(lobbyId as string, action.payload.memberId);
      if (action.type === 'RESPAWN') return await playerRespawn(lobbyId as string, action.payload.memberId);
      if (action.type === 'CAPTURE') return await captureCheckpoint(dbUser?.user_id!, action.payload.checkpointId);
      if (action.type === 'BASE_INTERACT') return await handleBaseInteraction(lobbyId as string, dbUser?.user_id!, action.payload.targetTeam);
      return { success: true };
  }, [lobbyId, dbUser]);

  // WATCHDOG: Мгновенная отправка при изменении очереди
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

  // FIXED: Корректная проекция GPS на сетку города
  const mapData = useMemo(() => {
      if (!lobby?.field_id) return null;
      const points: PointOfInterest[] = [];
      
      if (lobby.field_id.includes(',')) {
          const [lat, lon] = lobby.field_id.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lon)) {
              points.push({ 
                  id: 'target', 
                  name: 'ЦЕЛЬ_ОПЕРАЦИИ', 
                  type: 'point', 
                  coords: [[lat, lon]], 
                  icon: '::FaFlag::', 
                  color: 'bg-red-600' 
              });
          }
      }
      return { points, bounds: CITY_BOUNDS };
  }, [lobby]);

  const userMember = members.find(m => m.user_id === dbUser?.user_id);
  const isOwner = userMember?.role === 'owner' || lobby?.owner_id === dbUser?.user_id;

  // --- ACTIONS ---
  const handlePdfGen = async () => {
    if (!dbUser?.user_id) return;
    setIsGeneratingPdf(true);
    toast.loading("ГЕНЕРАЦИЯ_ОТЧЕТА...");
    try {
        const res = await generateAndSendLobbyPdf(dbUser.user_id, lobbyId as string);
        toast.dismiss();
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

  if (error) return <div className="text-center pt-40 text-red-600 font-mono italic">КРИТИЧЕСКАЯ_ОШИБКА: {error}</div>;
  if (!lobby) return <div className="text-center pt-40 text-white font-mono animate-pulse uppercase">РЕКОНСТРУКЦИЯ_ОПЕРАЦИИ...</div>;

  return (
    <div className={cn("pt-28 pb-48 px-2 min-h-screen text-white font-mono transition-colors duration-200", whiteFlash ? "bg-white/10" : "bg-black")}>
      
      {queue.length > 0 && (
          <div className="fixed top-20 left-4 z-[70] flex items-center gap-2 bg-red-950/80 border border-red-600 px-3 py-1 animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.2)]">
              <FaWifi className="text-red-500 text-xs" />
              <span className="text-[9px] font-black text-red-500 tracking-widest uppercase">БУФЕР_СВЯЗИ: {queue.length}</span>
          </div>
      )}

      {/* HEADER SITREP */}
      <div className="text-center mb-10 relative">
        <div className="absolute top-0 right-0 flex gap-3">
             <button 
                onClick={handlePdfGen} 
                disabled={isGeneratingPdf}
                className="p-2 border border-zinc-800 text-zinc-600 hover:text-white hover:border-zinc-400 transition-all active:scale-95"
                title="Печать PDF"
             >
                {isGeneratingPdf ? <FaSpinner className="animate-spin" /> : <FaFilePdf />}
             </button>
             <button 
                onClick={handleShare}
                className="p-2 border border-zinc-800 text-zinc-600 hover:text-white hover:border-zinc-400 transition-all active:scale-95"
                title="Поделиться"
             >
                <FaShareNodes />
             </button>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-[0.2em]">{lobby.name}</h1>
        <div className="text-[9px] text-zinc-600 mt-1 uppercase tracking-widest">{lobby.mode} // {lobby.status}</div>
      </div>

      <div className="flex justify-center gap-px bg-zinc-900 border border-zinc-900 mb-8 overflow-x-auto no-scrollbar">
          {[
              { id: 'roster', icon: FaUsers, label: 'ОТРЯД' },
              { id: 'game', icon: FaGamepad, label: 'ХАД_БОЯ' },
              { id: 'map', icon: FaMapLocationDot, label: 'СЕТКА' },
              { id: 'logistics', icon: FaCar, label: 'ЛОГИ' },
              { id: 'safety', icon: FaClipboardCheck, label: 'БРИФ' }
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn(
                    "flex-1 min-w-[70px] py-4 text-[9px] font-black flex flex-col items-center gap-1 transition-all uppercase",
                    activeTab === tab.id ? "bg-white text-black" : "bg-black text-zinc-600 hover:bg-zinc-950"
                )}>
                  <tab.icon className="text-base" /> <span>{tab.label}</span>
              </button>
          ))}
      </div>

      <div className="max-w-4xl mx-auto min-h-[40vh]">
          {activeTab === 'game' && (
             lobby.status === 'finished' ? (
                 <BattleReportView lobby={lobby} members={members} checkpoints={checkpoints} />
             ) : (
                 <div className="space-y-4">
                     <DominationHUD lobbyId={lobby.id} />
                     <LiveHUD startTime={lobby.metadata?.actual_start_at} score={lobby.metadata?.score || {red:0, blue:0}} />
                     {isOwner && (
                         <div className="space-y-4 pt-10 border-t border-zinc-900">
                             <CommandConsole lobbyId={lobby.id} userId={dbUser!.user_id} status={lobby.status} score={lobby.metadata?.score || {red:0, blue:0}} />
                             <AdminCheckpointPanel lobbyId={lobby.id} onLoad={loadData} />
                         </div>
                     )}
                 </div>
             )
          )}

          {activeTab === 'roster' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
                <SquadRoster teamName="СИНИЕ_СИЛЫ" teamColor="blue" members={members.filter(m => m.team === 'blue')} onAddBot={isOwner ? () => addNoobBot(lobby.id, 'blue').then(loadData) : undefined} onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} currentUserId={dbUser?.user_id} />
                <SquadRoster teamName="КРАСНАЯ_ЯЧЕЙКА" teamColor="red" members={members.filter(m => m.team === 'red')} onAddBot={isOwner ? () => addNoobBot(lobby.id, 'red').then(loadData) : undefined} onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} currentUserId={dbUser?.user_id} />
             </div>
          )}

          {activeTab === 'map' && (
              <div className="h-[65vh] w-full border border-zinc-800 relative bg-zinc-950 overflow-hidden rounded-lg">
                  {mapData && (
                    <VibeMap 
                        points={mapData.points} 
                        bounds={mapData.bounds} 
                        imageUrl={DEFAULT_MAP_URL}
                        highlightedPointId="target"
                    />
                  )}
                  {/* ТАКТИЧЕСКИЙ ФУТЕР КАРТЫ */}
                  <div className="absolute bottom-4 left-4 z-10 bg-black/90 p-2 border border-red-900 shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                      <div className="text-[8px] text-zinc-600 uppercase font-bold mb-1">Source_Intel: GPS_Grid</div>
                      <div className="text-[10px] text-red-500 font-mono tracking-widest uppercase">
                          {lobby?.field_id ? `OBJECTIVE_LOC: ${lobby.field_id}` : "SIGNAL_LOST"}
                      </div>
                  </div>
              </div>
          )}

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

      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 pointer-events-none space-y-4">
          {userMember && lobby.status === 'active' && (
              userMember.status === 'alive' ? (
                <button onClick={handleImHit} className="pointer-events-auto w-full bg-white text-black font-black py-6 uppercase tracking-[0.4em] border-4 border-black outline outline-1 outline-white text-xl shadow-[0_0_50px_rgba(255,255,255,0.2)] active:scale-95 transition-all">
                    УБИТ_В_БОЮ
                </button>
              ) : (
                <button onClick={handleTacticalRespawn} className="pointer-events-auto w-full bg-white text-black font-black py-6 uppercase tracking-[0.4em] border-4 border-black outline outline-1 outline-white text-xl flex items-center justify-center gap-4 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                    <FaQrcode /> ВОЗРОЖДЕНИЕ
                </button>
              )
          )}

          {lobby?.status === 'open' && (
            <div className="pointer-events-auto grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 shadow-2xl">
                <button 
                    onClick={() => handleJoinTeam('blue')} 
                    className={cn(
                        "py-4 font-black uppercase text-[10px] tracking-widest transition-colors",
                        userMember?.team === 'blue' ? "bg-zinc-700 text-white pointer-events-none" : "bg-black text-zinc-600 hover:bg-zinc-950"
                    )}
                >
                    {userMember?.team === 'blue' ? "[ В_СИНИХ_СИЛАХ ]" : "ВСТУПИТЬ_К_СИНИМ"}
                </button>
                <button 
                    onClick={() => handleJoinTeam('red')} 
                    className={cn(
                        "py-4 font-black uppercase text-[10px] tracking-widest transition-colors",
                        userMember?.team === 'red' ? "bg-zinc-700 text-white pointer-events-none" : "bg-black text-zinc-600 hover:bg-zinc-950"
                    )}
                >
                    {userMember?.team === 'red' ? "[ В_КРАСНОЙ_ЯЧЕЙКЕ ]" : "ВСТУПИТЬ_К_КРАСНЫМ"}
                </button>
            </div>
          )}
      </div>
    </div>
  );
}