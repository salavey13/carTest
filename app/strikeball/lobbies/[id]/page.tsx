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
import { LogisticsPanel } from "../../components/LogisticsPanel"; // NEW EXTRACTED
import { useTacticalOutbox } from "../../hooks/useTacticalOutbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaShareNodes, FaMapLocationDot, FaSkullCrossbones, FaFilePdf, FaCar, FaClipboardCheck, FaUsers, FaGamepad, FaRecycle, FaShieldHalved, FaWifi } from "react-icons/fa6";
import { VibeMap, MapBounds, PointOfInterest } from "@/components/VibeMap";

const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg } = useAppContext();
  const { addToOutbox, flushQueue, queue } = useTacticalOutbox();
  
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'map' | 'logistics' | 'safety' | 'game'>('roster'); 
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Logistics local state
  const [driverSeats, setDriverSeats] = useState(3);
  const [carName, setCarName] = useState("");
  
  const [checkpoints, setCheckpoints] = useState<any[]>([]);
  const [whiteFlash, setWhiteFlash] = useState(false);

  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        if (!result.success || !result.lobby) { setError("FETCH_ERROR"); return; }

        setLobby(result.lobby);
        setMembers(result.members || []);

        const me = result.members?.find((m: any) => m.user_id === dbUser?.user_id);
        if (me?.metadata?.transport?.role === 'driver') {
             if (!carName) setCarName(me.metadata.transport.car_name || "");
             if (me.metadata.transport.seats) setDriverSeats(me.metadata.transport.seats);
        }

        const { data: cps } = await getLobbyCheckpoints(lobbyId as string);
        setCheckpoints(cps || []);

        if (result.lobby.status === 'finished' && activeTab !== 'game') setActiveTab('game');
    } catch (e) { setError("CRITICAL_CON_ERROR"); }
  }, [lobbyId, dbUser?.user_id, activeTab]);

  // Sync Engine Loop
  useEffect(() => {
    const interval = setInterval(() => {
        flushQueue(async (action) => {
            if (action.type === 'HIT') return await playerHit(lobbyId as string, action.payload.memberId);
            if (action.type === 'RESPAWN') return await playerRespawn(lobbyId as string, action.payload.memberId);
            if (action.type === 'CAPTURE') return await captureCheckpoint(dbUser?.user_id!, action.payload.checkpointId);
            return { success: true };
        });
    }, 3000);
    return () => clearInterval(interval);
  }, [queue, flushQueue, lobbyId, dbUser]);

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
  const handleImHit = async () => { 
      if (!userMember || userMember.status === 'dead') return;
      setMembers(prev => prev.map(m => m.id === userMember.id ? { ...m, status: 'dead' } : m));
      setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 200);
      addToOutbox('HIT', { memberId: userMember.id });
      toast.warning("STATUS: KIA // QUEUED");
  };

  const handleSelfRespawn = async () => { 
      if (!userMember || userMember.status === 'alive') return;
      setMembers(prev => prev.map(m => m.id === userMember.id ? { ...m, status: 'alive' } : m));
      setWhiteFlash(true); setTimeout(() => setWhiteFlash(false), 200);
      addToOutbox('RESPAWN', { memberId: userMember.id });
      toast.success("STATUS: READY // QUEUED");
  };

  const handleJoinTeam = async (team: string) => { 
      if (!dbUser) return;
      const res = await joinLobby(dbUser.user_id, lobbyId as string, team); 
      if (res.success) { loadData(); } else { toast.error(res.error); } 
  };

  // Logic for Logistics
  const updateTransport = async (role: string, seats: number = 0) => {
      if (!userMember) return;
      await updateTransportStatus(userMember.id, { role, seats, car_name: carName || "UNIT_01" });
      loadData();
  };

  if (error) return <div className="text-center pt-32 text-red-600 font-mono tracking-tighter">FATAL_ERROR: {error}</div>;
  if (!lobby) return <div className="text-center pt-32 text-white font-mono animate-pulse">ESTABLISHING_LINK...</div>;

  return (
    <div className={cn("pt-28 pb-40 px-2 min-h-screen text-white font-mono transition-colors duration-200", whiteFlash ? "bg-white/20" : "")}>
      
      {/* SYNC INDICATOR */}
      {queue.length > 0 && (
          <div className="fixed top-20 left-4 z-[60] flex items-center gap-2 bg-black border border-red-600 px-3 py-1 animate-pulse">
              <FaWifi className="text-red-500 text-xs" />
              <span className="text-[9px] font-bold text-red-500">UPLINK_BUFFER: {queue.length}</span>
          </div>
      )}

      {/* Header Info */}
      <div className="text-center mb-6 relative">
        <div className="absolute top-0 right-0 flex gap-2">
             <button onClick={() => generateAndSendLobbyPdf(dbUser!.user_id, lobbyId as string)} className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white"><FaFilePdf /></button>
             <button onClick={() => {
                 const inviteLink = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobbyId}`;
                 if (tg?.openTelegramLink) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}`);
             }} className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white"><FaShareNodes /></button>
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tighter">{lobby.name}</h1>
        <div className="text-[9px] text-zinc-600 uppercase tracking-[0.3em]">{lobby.mode} // {lobby.status}</div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex justify-center gap-1 mb-8">
          {[
              { id: 'roster', icon: FaUsers, label: 'SQD' },
              { id: 'game', icon: FaGamepad, label: 'OPS' },
              { id: 'logistics', icon: FaCar, label: 'LOG' },
              { id: 'safety', icon: FaClipboardCheck, label: 'INF' }
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={cn(
                    "px-4 py-3 text-[10px] font-bold flex items-center gap-2 border transition-all",
                    activeTab === tab.id ? "bg-white text-black border-white" : "bg-black border-zinc-900 text-zinc-600 hover:border-zinc-700"
                )}>
                  <tab.icon /> <span className="hidden xs:inline">{tab.label}</span>
              </button>
          ))}
      </div>

      <div className="max-w-4xl mx-auto min-h-[40vh]">
          {activeTab === 'game' && (
             <div className="space-y-4">
                 <DominationHUD lobbyId={lobby.id} />
                 <LiveHUD startTime={lobby.metadata?.actual_start_at} score={lobby.metadata?.score || {red:0, blue:0}} />
                 {isOwner && (
                     <div className="space-y-4 pt-8 border-t border-zinc-900">
                         <CommandConsole lobbyId={lobby.id} userId={dbUser!.user_id} status={lobby.status} score={lobby.metadata?.score || {red:0, blue:0}} />
                         <AdminCheckpointPanel lobbyId={lobby.id} onLoad={loadData} />
                     </div>
                 )}
             </div>
          )}

          {activeTab === 'roster' && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SquadRoster teamName="BLUE" teamColor="blue" members={members.filter(m => m.team === 'blue')} onToggleStatus={() => {}} currentUserId={dbUser?.user_id} />
                <SquadRoster teamName="RED" teamColor="red" members={members.filter(m => m.team === 'red')} onToggleStatus={() => {}} currentUserId={dbUser?.user_id} />
             </div>
          )}

          {activeTab === 'logistics' && (
              <LogisticsPanel 
                userMember={userMember} members={members} carName={carName} setCarName={setCarName} 
                driverSeats={driverSeats} setDriverSeats={setDriverSeats}
                onToggleDriver={() => updateTransport(userMember?.metadata?.transport?.role === 'driver' ? 'none' : 'driver', driverSeats)}
                onTogglePassenger={() => updateTransport(userMember?.metadata?.transport?.role === 'passenger' ? 'none' : 'passenger')}
                onUpdateCar={() => updateTransport('driver', driverSeats)}
                onJoinCar={(dId) => joinCar(userMember.id, dId).then(loadData)}
              />
          )}

          {activeTab === 'safety' && (
              <SafetyBriefing onComplete={() => signSafetyBriefing(userMember.id).then(loadData)} isSigned={!!userMember?.metadata?.safety_signed} />
          )}
      </div>

      {/* FIXED COMBAT ACTIONS */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 space-y-2 pointer-events-none">
          {userMember && lobby.status === 'active' && (
              userMember.status === 'alive' ? (
                <button onClick={handleImHit} className="pointer-events-auto w-full bg-red-600 text-white font-black py-5 uppercase tracking-[0.3em] border-b-4 border-red-900 active:translate-y-1 transition-all text-xl">
                    <FaSkullCrossbones className="inline mr-3"/> Report_KIA
                </button>
              ) : (
                <button onClick={handleSelfRespawn} className="pointer-events-auto w-full bg-emerald-600 text-white font-black py-5 uppercase tracking-[0.3em] border-b-4 border-emerald-900 active:translate-y-1 transition-all text-xl">
                    <FaRecycle className="inline mr-3"/> Respawn_Ready
                </button>
              )
          )}

          {!userMember && lobby.status !== 'finished' && (
            <div className="pointer-events-auto grid grid-cols-2 gap-2 bg-black p-2 border border-zinc-800">
                <button onClick={() => handleJoinTeam('blue')} className="bg-zinc-900 text-blue-500 py-4 font-bold border border-blue-900 uppercase text-xs">Join_Blue</button>
                <button onClick={() => handleJoinTeam('red')} className="bg-zinc-900 text-red-500 py-4 font-bold border border-red-900 uppercase text-xs">Join_Red</button>
            </div>
          )}
      </div>
    </div>
  );
}