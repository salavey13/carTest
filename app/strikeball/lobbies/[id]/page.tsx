"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, removeMember, fetchLobbyData } from "../../actions/lobby";
import { playerHit, playerRespawn } from "../../actions/game";
import { updateTransportStatus, signSafetyBriefing, joinCar } from "../../actions/logistics";
import { generateAndSendLobbyPdf } from "../../actions/service";
import { getLobbyCheckpoints, captureCheckpoint } from "../../actions/domination";

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
import { FaShareNodes, FaFilePdf, FaCar, FaClipboardCheck, FaUsers, FaGamepad, FaWifi, FaFlag, FaQrcode } from "react-icons/fa6";

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg } = useAppContext();
  const { addToOutbox, burstSync, queue } = useTacticalOutbox();
  
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'game' | 'logistics' | 'safety'>('roster'); 
  const [whiteFlash, setWhiteFlash] = useState(false);
  const [checkpoints, setCheckpoints] = useState<any[]>([]);

  // Logistics State
  const [driverSeats, setDriverSeats] = useState(3);
  const [carName, setCarName] = useState("");

  const processUplink = useCallback(async (action: any) => {
      if (action.type === 'HIT') return await playerHit(lobbyId as string, action.payload.memberId);
      if (action.type === 'RESPAWN') return await playerRespawn(lobbyId as string, action.payload.memberId);
      if (action.type === 'CAPTURE') return await captureCheckpoint(dbUser?.user_id!, action.payload.checkpointId);
      return { success: true };
  }, [lobbyId, dbUser]);

  // WATCHDOG
  useEffect(() => {
      if (queue.length > 0) burstSync(processUplink);
  }, [queue.length, burstSync, processUplink]);

  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        if (!result.success || !result.lobby) { setError("ОШИБКА_СВЯЗИ"); return; }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_checkpoints', filter: `lobby_id=eq.${lobbyId}` }, () => loadData())
      .subscribe();
    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId, loadData]);

  const userMember = members.find(m => m.user_id === dbUser?.user_id);
  const isOwner = userMember?.role === 'owner' || lobby?.owner_id === dbUser?.user_id;

  // --- ACTIONS ---
  const handleImHit = () => { 
    if (!userMember || userMember.status === 'dead' || !lobbyId) return;
    setMembers(prev => prev.map(m => m.id === userMember.id ? { ...m, status: 'dead' } : m));
    setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 150);
    addToOutbox('HIT', { memberId: userMember.id });
    toast.warning("УБИТ_В_БОЮ // ПАКЕТ_В_ОЧЕРЕДИ");
  };

  const handleSelfRespawn = () => { 
    if (!userMember || userMember.status === 'alive' || !lobbyId) return;
    setMembers(prev => prev.map(m => m.id === userMember.id ? { ...m, status: 'alive' } : m));
    setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 150);
    addToOutbox('RESPAWN', { memberId: userMember.id });
    toast.success("ГОТОВ_К_БОЮ // ПАКЕТ_В_ОЧЕРЕДИ");
  };

  const handleJoinTeam = async (team: string) => {
    if (!dbUser) return;
    const res = await joinLobby(dbUser.user_id, lobbyId as string, team);
    if (res.success) { toast.success(res.message); loadData(); }
  };

  if (error) return <div className="text-center pt-40 text-red-600 font-mono">КРИТИЧЕСКАЯ_ОШИБКА: {error}</div>;
  if (!lobby) return <div className="text-center pt-40 text-white font-mono animate-pulse">РЕКОНСТРУКЦИЯ_ОПЕРАЦИИ...</div>;

  return (
    <div className={cn("pt-28 pb-48 px-2 min-h-screen text-white font-mono transition-colors duration-200", whiteFlash ? "bg-white/10" : "bg-black")}>
      
      {queue.length > 0 && (
          <div className="fixed top-20 left-4 z-[70] flex items-center gap-2 bg-red-950/80 border border-red-600 px-3 py-1 animate-pulse">
              <FaWifi className="text-red-500 text-xs" />
              <span className="text-[9px] font-black text-red-500 tracking-widest uppercase">БУФЕР_СВЯЗИ: {queue.length}</span>
          </div>
      )}

      <div className="text-center mb-10">
        <h1 className="text-2xl font-black uppercase tracking-[0.2em]">{lobby.name}</h1>
        <div className="text-[9px] text-zinc-600 mt-1 uppercase tracking-widest">{lobby.mode} // {lobby.status}</div>
      </div>

      <div className="flex justify-center gap-px bg-zinc-900 border border-zinc-900 mb-8">
          {[
              { id: 'roster', icon: FaUsers, label: 'ОТРЯД' },
              { id: 'game', icon: FaGamepad, label: 'ХАД_БОЯ' },
              { id: 'logistics', icon: FaCar, label: 'ЛОГИ' },
              { id: 'safety', icon: FaClipboardCheck, label: 'БРИФ' }
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn(
                    "flex-1 py-4 text-[9px] font-black flex flex-col items-center gap-1 transition-all uppercase",
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
                     {/* 1. DOMINATION HUD (Pagers) */}
                     <DominationHUD lobbyId={lobby.id} />
                     
                     {/* 2. OBJECTIVES LOG (The missing list) */}
                     <div className="bg-[#000000] border border-zinc-800 p-4 mb-6">
                        <h4 className="text-[9px] text-zinc-600 font-mono mb-3 uppercase tracking-widest flex items-center gap-2">
                           <FaFlag className="text-zinc-500" /> Активные_Сектора
                        </h4>
                        <div className="space-y-2">
                           {checkpoints.map(cp => (
                              <div key={cp.id} className="flex justify-between items-center bg-zinc-950/50 p-2 border border-zinc-900">
                                 <span className="text-[10px] font-mono text-zinc-400">SEC_{cp.name.toUpperCase()}</span>
                                 <div className="flex items-center gap-4">
                                    <span className={cn("text-[9px] font-black px-2", cp.owner_team === 'blue' ? "bg-white text-black" : cp.owner_team === 'red' ? "bg-zinc-700 text-white" : "text-zinc-700")}>
                                       {cp.owner_team.toUpperCase()}
                                    </span>
                                    {isOwner && (
                                        <button onClick={() => toast.info(`Код цели: capture_${cp.id}`)} className="text-zinc-700 hover:text-white"><FaQrcode size={10}/></button>
                                    )}
                                 </div>
                              </div>
                           ))}
                           {checkpoints.length === 0 && <div className="text-[9px] text-zinc-800 font-mono italic">Цели не определены.</div>}
                        </div>
                     </div>

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
              <SafetyBriefing onComplete={() => signSafetyBriefing(userMember.id).then(loadData)} isSigned={!!userMember?.metadata?.safety_signed} />
          )}
      </div>

      {/* FIXED FOOTER CONTROLS */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 pointer-events-none space-y-4">
          
          {userMember && lobby.status === 'active' && (
              userMember.status === 'alive' ? (
                <button onClick={handleImHit} className="pointer-events-auto w-full bg-white text-black font-black py-6 uppercase tracking-[0.4em] border-4 border-black outline outline-1 outline-white active:bg-zinc-300 transition-all text-xl shadow-[0_0_50px_rgba(255,255,255,0.2)]">
                    УБИТ_В_БОЮ
                </button>
              ) : (
                <button onClick={handleSelfRespawn} className="pointer-events-auto w-full bg-white text-black font-black py-6 uppercase tracking-[0.4em] border-4 border-black outline outline-1 outline-white active:bg-zinc-300 transition-all text-xl">
                    ГОТОВ_К_БОЮ
                </button>
              )
          )}

          {!isFinished && (
            <div className="pointer-events-auto grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800">
                <button 
                    onClick={() => handleJoinTeam('blue')} 
                    className={cn(
                        "py-4 font-black uppercase text-[10px] tracking-widest transition-colors",
                        userMember?.team === 'blue' ? "bg-zinc-700 text-white pointer-events-none" : "bg-black text-zinc-500 hover:bg-zinc-950"
                    )}
                >
                    {userMember?.team === 'blue' ? "В_СИНИХ_СИЛАХ" : "ВСТУПИТЬ_К_СИНИМ"}
                </button>
                <button 
                    onClick={() => handleJoinTeam('red')} 
                    className={cn(
                        "py-4 font-black uppercase text-[10px] tracking-widest transition-colors",
                        userMember?.team === 'red' ? "bg-zinc-700 text-white pointer-events-none" : "bg-black text-zinc-500 hover:bg-zinc-950"
                    )}
                >
                    {userMember?.team === 'red' ? "В_КРАСНОЙ_ЯЧЕЙКЕ" : "ВСТУПИТЬ_К_КРАСНЫМ"}
                </button>
            </div>
          )}
      </div>
    </div>
  );
}