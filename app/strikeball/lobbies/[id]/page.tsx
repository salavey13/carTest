"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, togglePlayerStatus, removeMember, fetchLobbyData } from "../../actions/lobby";
import { playerHit, playerRespawn } from "../../actions/game";
import { updateTransportStatus, signSafetyBriefing } from "../../actions/logistics";
import { generateAndSendLobbyPdf } from "../../actions/service";
import { SquadRoster } from "../../components/SquadRoster";
import { CommandConsole } from "../../components/CommandConsole"; 
import { LiveHUD } from "../../components/LiveHUD"; 
import { SafetyBriefing } from "../../components/SafetyBriefing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaShareNodes, FaMapLocationDot, FaSkullCrossbones, FaFilePdf, FaCar, FaClipboardCheck, FaUsers, FaGamepad, FaPlus, FaMinus, FaShieldHalved, FaRecycle } from "react-icons/fa6";
import { VibeMap, MapBounds, PointOfInterest } from "@/components/VibeMap";

const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg } = useAppContext();
  
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'map' | 'logistics' | 'safety' | 'game'>('roster'); 
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [driverSeats, setDriverSeats] = useState(3);

  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        if (!result.success || !result.lobby) {
            setError("Lobby data fetch failed.");
            return;
        }

        setLobby(result.lobby);
        setMembers(result.members || []);

    } catch (e: any) {
        console.error("Lobby Load Error:", e);
        setError("Failed to load lobby data.");
    }
  }, [lobbyId]);

  useEffect(() => {
    loadData();
    
    const channel = supabaseAnon
      .channel(`lobby_room_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` }, () => loadData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, (payload) => {
          setLobby(prev => ({ ...prev, ...payload.new })); 
      })
      .subscribe();

    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId, loadData]);

  const userMember = members.find(m => m.user_id === dbUser?.user_id);
  const isOwner = userMember?.role === 'owner' || lobby?.owner_id === dbUser?.user_id;

  const handleAddBot = async (team: string) => { const res = await addNoobBot(lobbyId as string, team); if (!res.success) toast.error(res.error); else loadData(); };
  const handleKickBot = async (memberId: string) => { const res = await removeMember(memberId); if (!res.success) toast.error(res.error); else { toast.success("Kicked"); loadData(); } };
  
  // Admin Manual Toggle
  const handleStatusToggle = async (memberId: string, current: string) => { 
      if (lobby?.status === 'active') {
          if (current === 'alive') await playerHit(lobbyId as string, memberId);
          else await playerRespawn(lobbyId as string, memberId);
      } else {
          // pre-game toggle disabled or use standard toggle
      }
      loadData(); 
  };
  
  const handleJoinTeam = async (team: string) => { 
      if (!dbUser) { toast.error("Auth required"); return; } 
      const res = await joinLobby(dbUser.user_id, lobbyId as string, team); 
      if (res.success) { toast.success(res.message); loadData(); } 
      else { toast.error(res.error); } 
  };

  const handleImHit = async () => {
      if (!userMember || userMember.status === 'dead') return;
      const res = await playerHit(lobbyId as string, userMember.id);
      if (res.success) { toast.warning("ВЫ УБИТЫ. СЧЕТ ОБНОВЛЕН."); loadData(); }
      else toast.error(res.error);
  };

  const handleSelfRespawn = async () => {
      if (!userMember || userMember.status === 'alive') return;
      const res = await playerRespawn(lobbyId as string, userMember.id);
      if (res.success) { toast.success("ВЫ ВОЗРОЖДЕНЫ! В БОЙ!"); loadData(); }
      else toast.error(res.error);
  };

  const handlePdfGen = async () => {
      if (!dbUser) return;
      setIsGeneratingPdf(true);
      toast.loading("Создание PDF...");
      const res = await generateAndSendLobbyPdf(dbUser.user_id, lobbyId as string);
      toast.dismiss(); setIsGeneratingPdf(false);
      if (res.success) toast.success("Отправлено в Telegram"); else toast.error(res.error);
  };

  const handleTransportUpdate = async (role: string, seats: number = 0) => {
      if (!userMember) return;
      await updateTransportStatus(userMember.id, { role, seats });
      toast.success("Транспорт обновлен");
      loadData();
  };

  const toggleDriver = () => {
      const isDriver = userMember?.metadata?.transport?.role === 'driver';
      handleTransportUpdate(isDriver ? 'none' : 'driver', driverSeats);
  };

  const togglePassenger = () => {
      const isPassenger = userMember?.metadata?.transport?.role === 'passenger';
      handleTransportUpdate(isPassenger ? 'none' : 'passenger');
  };

  const handleSafetySign = async () => {
      if (!userMember) return;
      await signSafetyBriefing(userMember.id);
      loadData();
      toast.success("Инструктаж подписан");
  };

  const shareIntel = () => {
    if (!lobby) return;
    const inviteLink = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobbyId}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(`Op: ${lobby.name}\nJoin Squad!`)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank');
  };

  if (error) return <div className="text-center pt-32 text-red-600 font-mono">{error}</div>;
  if (!lobby) return <div className="text-center pt-32 text-red-600 font-mono animate-pulse">CONNECTING...</div>;

  const mapPoints: PointOfInterest[] = [];
  let mapBounds: MapBounds = { top: 56.4, bottom: 56.2, left: 43.7, right: 44.1 };
  if (lobby.field_id && lobby.field_id.includes(',')) {
      const [lat, lon] = lobby.field_id.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
          mapPoints.push({ id: 'obj', name: 'TARGET', type: 'point', coords: [[lat, lon]], icon: '::FaFlag::', color: 'bg-red-500' });
          mapBounds = { top: lat + 0.005, bottom: lat - 0.005, left: lon - 0.005, right: lon + 0.005 };
      }
  }

  const score = lobby.metadata?.score || { red: 0, blue: 0 };

  return (
    <div className="pt-28 pb-32 px-2 min-h-screen text-white font-sans">
      
      {/* Header */}
      <div className="text-center mb-4 relative">
        <div className="absolute top-0 right-0 flex gap-2">
             <button onClick={handlePdfGen} disabled={isGeneratingPdf} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white"><FaFilePdf /></button>
             <button onClick={shareIntel} className="p-2 bg-zinc-800 rounded-full text-cyan-500 hover:text-cyan-300"><FaShareNodes /></button>
        </div>
        <h1 className="text-2xl font-black font-orbitron uppercase">{lobby.name}</h1>
        <div className="text-xs font-mono text-zinc-500">{lobby.mode?.toUpperCase()} // {lobby.status?.toUpperCase()}</div>
        
        {lobby.host_crew && (
            <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 border border-cyan-900 bg-cyan-950/30 px-2 py-0.5 rounded">
                <FaShieldHalved /> {lobby.host_crew.name.toUpperCase()}
            </div>
        )}

        {lobby.status === 'active' && (
             <div className="mt-2 text-red-500 font-bold font-mono animate-pulse bg-red-900/20 inline-block px-4 py-1 rounded border border-red-900">
                 ⚠️ COMBAT IN PROGRESS ⚠️
             </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {[
              { id: 'roster', icon: FaUsers, label: 'SQUADS' },
              { id: 'game', icon: FaGamepad, label: 'OPS' },
              { id: 'map', icon: FaMapLocationDot, label: 'MAP' },
              { id: 'logistics', icon: FaCar, label: 'LOGI' },
              { id: 'safety', icon: FaClipboardCheck, label: 'BRIEF' }
          ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                    "px-3 py-2 rounded text-[10px] font-bold flex items-center gap-1.5 border transition-all",
                    activeTab === tab.id 
                        ? "bg-red-900/50 border-red-500 text-white" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                )}
              >
                  <tab.icon />
                  <span>{tab.label}</span>
              </button>
          ))}
      </div>

      <div className="max-w-4xl mx-auto min-h-[50vh]">
          
          {/* GAME TAB */}
          {activeTab === 'game' && (
             <div className="space-y-6">
                 {lobby.status === 'active' && <LiveHUD startTime={lobby.metadata?.actual_start_at} score={score} />}
                 
                 {isOwner && (
                     <div className="border-t border-zinc-800 pt-6">
                         <h3 className="text-center font-orbitron text-zinc-500 mb-4 text-xs tracking-widest">COMMANDER OVERRIDE</h3>
                         <CommandConsole lobbyId={lobby.id} userId={dbUser!.user_id} status={lobby.status} score={score} />
                     </div>
                 )}

                 {lobby.status === 'open' && !isOwner && <div className="text-center py-10 bg-zinc-900/50 rounded border border-zinc-800 border-dashed text-zinc-500 font-mono">WAITING FOR COMMANDER...</div>}
             </div>
          )}

          {/* ROSTER TAB */}
          {activeTab === 'roster' && (
             <div className="flex flex-col md:flex-row gap-6">
                <SquadRoster teamName="BLUE" teamColor="blue" members={members.filter(m => m.team === 'blue')} onToggleStatus={handleStatusToggle} onAddBot={() => handleAddBot('blue')} onKick={handleKickBot} currentUserId={dbUser?.user_id} />
                <SquadRoster teamName="RED" teamColor="red" members={members.filter(m => m.team === 'red')} onToggleStatus={handleStatusToggle} onAddBot={() => handleAddBot('red')} onKick={handleKickBot} currentUserId={dbUser?.user_id} />
             </div>
          )}

          {/* MAP TAB */}
          {activeTab === 'map' && (
              <div className="h-[60vh] w-full border-2 border-zinc-700 rounded-lg overflow-hidden relative">
                  <VibeMap points={mapPoints} bounds={mapBounds} imageUrl={DEFAULT_MAP_URL} />
                  <div className="absolute bottom-4 left-4 bg-black/70 p-2 rounded text-xs font-mono border border-zinc-600">GPS: {lobby.field_id || "NOT SET"}</div>
              </div>
          )}

          {/* LOGISTICS TAB */}
          {activeTab === 'logistics' && (
              <div className="space-y-4">
                  <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-700">
                      <h3 className="font-bold text-lg mb-6 text-cyan-400 font-orbitron flex items-center gap-2"><FaCar /> LOGISTICS NETWORK</h3>
                      <div className="grid grid-cols-2 gap-4 mb-8">
                          <div className={cn("p-4 rounded-lg border-2 transition-all cursor-pointer", userMember?.metadata?.transport?.role === 'driver' ? "bg-green-900/20 border-green-500" : "bg-zinc-950 border-zinc-800 hover:border-zinc-600")}>
                              <div onClick={toggleDriver} className="text-center">
                                  <div className="text-2xl mb-2">🚗</div>
                                  <div className="font-bold text-sm">Я ВОДИТЕЛЬ</div>
                              </div>
                              {userMember?.metadata?.transport?.role === 'driver' && (
                                  <div className="mt-3 flex items-center justify-center gap-2">
                                      <button onClick={() => setDriverSeats(Math.max(1, driverSeats - 1))} className="p-1 bg-zinc-800 rounded hover:bg-zinc-700"><FaMinus size={10}/></button>
                                      <span className="font-mono text-lg font-bold">{driverSeats}</span>
                                      <button onClick={() => setDriverSeats(Math.min(8, driverSeats + 1))} className="p-1 bg-zinc-800 rounded hover:bg-zinc-700"><FaPlus size={10}/></button>
                                      <button onClick={toggleDriver} className="ml-2 text-[10px] text-green-400 border border-green-500 px-2 py-1 rounded">SAVE</button>
                                  </div>
                              )}
                          </div>
                          <button onClick={togglePassenger} className={cn("p-4 rounded-lg border-2 transition-all", userMember?.metadata?.transport?.role === 'passenger' ? "bg-amber-900/20 border-amber-500" : "bg-zinc-950 border-zinc-800 hover:border-zinc-600")}>
                              <div className="text-2xl mb-2">🙋‍♂️</div>
                              <div className="font-bold text-sm">МНЕ НУЖНО МЕСТО</div>
                              <div className="text-xs text-zinc-500 mt-1">Passenger</div>
                          </button>
                      </div>
                      <div className="space-y-6">
                          <div>
                              <div className="text-xs font-mono text-zinc-500 uppercase mb-2 border-b border-zinc-800 pb-1">Активные Водители</div>
                              <div className="space-y-2">
                                {members.filter(m => m.metadata?.transport?.role === 'driver').map(m => (
                                    <div key={m.id} className="bg-black/40 p-3 rounded flex justify-between items-center border border-zinc-800">
                                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="font-bold text-sm">{m.user?.username || 'Unknown'}</span></div>
                                        <div className="text-xs text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-zinc-700">СВОБОДНО: <span className="text-white font-mono">{m.metadata.transport.seats}</span></div>
                                    </div>
                                ))}
                              </div>
                          </div>
                          <div>
                              <div className="text-xs font-mono text-zinc-500 uppercase mb-2 border-b border-zinc-800 pb-1">Пассажиры</div>
                              <div className="flex flex-wrap gap-2">
                                  {members.filter(m => m.metadata?.transport?.role === 'passenger').map(m => (
                                      <span key={m.id} className="bg-amber-900/20 text-amber-500 px-3 py-1 rounded text-xs border border-amber-900/50 flex items-center gap-2">{m.user?.username} <span>👋</span></span>
                                  ))}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* SAFETY TAB */}
          {activeTab === 'safety' && (
              <SafetyBriefing onComplete={handleSafetySign} isSigned={!!userMember?.metadata?.safety_signed} />
          )}
      </div>

      {/* Footer Actions (HIT / RESPAWN / JOIN) */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30 flex flex-col gap-2 pointer-events-none">
          {/* Active Game Controls */}
          {lobby.status === 'active' && userMember && (
              <>
                {(userMember.status === 'alive' || userMember.status === 'ready') && (
                    <button 
                        onClick={handleImHit}
                        className="pointer-events-auto w-full bg-red-600/90 hover:bg-red-500 text-white font-black py-4 uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(220,38,38,0.6)] border-2 border-red-400 animate-pulse text-xl font-orbitron"
                    >
                        <FaSkullCrossbones className="inline mr-3 mb-1"/> Я УБИТ!
                    </button>
                )}
                
                {userMember.status === 'dead' && (
                    <button 
                        onClick={handleSelfRespawn}
                        className="pointer-events-auto w-full bg-emerald-600/90 hover:bg-emerald-500 text-white font-black py-4 uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(16,185,129,0.6)] border-2 border-emerald-400 animate-pulse text-xl font-orbitron"
                    >
                        <FaRecycle className="inline mr-3 mb-1"/> ВОЗРОЖДЕНИЕ (QR)
                    </button>
                )}
              </>
          )}

          {/* Show Join Buttons if not member OR allow switching even during game (with penalty if needed) */}
          <div className="pointer-events-auto grid grid-cols-2 gap-2 bg-black/80 p-2 border border-zinc-700 shadow-2xl backdrop-blur-md">
                <button 
                    onClick={() => handleJoinTeam('blue')} 
                    className={cn(
                        "bg-blue-900/40 hover:bg-blue-800 text-blue-200 font-bold py-3 uppercase border border-blue-500/30",
                        userMember?.team === 'blue' && "bg-blue-600 text-white"
                    )}
                    disabled={userMember?.team === 'blue'}
                >
                    {userMember?.team === 'blue' ? "ВЫ ЗА СИНИХ" : "ЗА СИНИХ"}
                </button>
                <button 
                    onClick={() => handleJoinTeam('red')} 
                    className={cn(
                        "bg-red-900/40 hover:bg-red-800 text-red-200 font-bold py-3 uppercase border border-red-500/30",
                        userMember?.team === 'red' && "bg-red-600 text-white"
                    )}
                    disabled={userMember?.team === 'red'}
                >
                    {userMember?.team === 'red' ? "ВЫ ЗА КРАСНЫХ" : "ЗА КРАСНЫХ"}
                </button>
          </div>
      </div>
    </div>
  );
}