"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, togglePlayerStatus, removeMember, fetchLobbyData } from "../../actions/lobby";
import { playerHit, playerRespawn } from "../../actions/game";
import { updateTransportStatus, signSafetyBriefing, joinCar } from "../../actions/logistics";
import { generateAndSendLobbyPdf } from "../../actions/service";
import { getLobbyCheckpoints } from "../../actions/domination";
import { SquadRoster } from "../../components/SquadRoster";
import { CommandConsole } from "../../components/CommandConsole"; 
import { LiveHUD } from "../../components/LiveHUD";
import { DominationHUD } from "../../components/DominationHUD";
import { AdminCheckpointPanel } from "../../components/AdminCheckpointPanel";
import { SafetyBriefing } from "../../components/SafetyBriefing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaShareNodes, FaMapLocationDot, FaSkullCrossbones, FaFilePdf, FaCar, FaClipboardCheck, FaUsers, FaGamepad, FaRecycle, FaPlus, FaMinus, FaShieldHalved, FaPersonWalking } from "react-icons/fa6";
import { VibeMap, MapBounds, PointOfInterest } from "@/components/VibeMap";

const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';

// New Component: BattleReportView (Local to this file)
const BattleReportView = ({ lobby, members, checkpoints }: any) => {
    const winner = lobby.metadata?.winner?.toUpperCase() || "DRAW";
    const score = lobby.metadata?.score || { red: 0, blue: 0 };
    const blueCount = members.filter((m: any) => m.team === 'blue').length;
    const redCount = members.filter((m: any) => m.team === 'red').length;

    return (
        <div className="bg-zinc-900 border-2 border-zinc-700 p-6 rounded-xl animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center border-b border-zinc-800 pb-4 mb-4">
                <h2 className="text-3xl font-black font-orbitron text-white tracking-widest">MISSION DEBRIEF</h2>
                <p className="text-xs text-zinc-500 font-mono mt-1">OPERATION ID: {lobby.id.slice(0,8).toUpperCase()}</p>
            </div>

            <div className="flex justify-between items-center mb-6">
                <div className="text-center">
                    <div className="text-blue-500 font-black text-4xl">{score.blue}</div>
                    <div className="text-xs text-blue-300 font-bold uppercase">Blue Force ({blueCount})</div>
                </div>
                <div className="text-zinc-600 font-black text-2xl">VS</div>
                <div className="text-center">
                    <div className="text-red-500 font-black text-4xl">{score.red}</div>
                    <div className="text-xs text-red-300 font-bold uppercase">Red Cell ({redCount})</div>
                </div>
            </div>

            <div className="bg-black/50 p-4 rounded text-center mb-6 border border-zinc-800">
                <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Victor</div>
                <div className={cn("text-2xl font-black uppercase", winner === 'BLUE' ? "text-blue-500" : winner === 'RED' ? "text-red-500" : "text-white")}>
                    {winner} TEAM
                </div>
            </div>

            {/* Checkpoints Status */}
            {checkpoints.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs text-zinc-500 font-bold uppercase">Sector Control</h4>
                    {checkpoints.map((cp: any) => (
                        <div key={cp.id} className="flex justify-between items-center bg-zinc-950 p-2 rounded border border-zinc-800">
                            <span className="text-sm font-mono text-zinc-300">{cp.name}</span>
                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded", 
                                cp.owner_team === 'blue' ? "bg-blue-900 text-blue-300" : 
                                cp.owner_team === 'red' ? "bg-red-900 text-red-300" : "bg-zinc-800 text-zinc-500")}>
                                {cp.owner_team.toUpperCase()}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg } = useAppContext();
  
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'map' | 'logistics' | 'safety' | 'game'>('roster'); 
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [driverSeats, setDriverSeats] = useState(3);
  const [carName, setCarName] = useState("");
  const [checkpoints, setCheckpoints] = useState<any[]>([]);

  // USE SERVER ACTION FOR DATA LOADING (Manual Joins)
  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        
        if (!result.success || !result.lobby) {
            setError("Lobby data fetch failed.");
            return;
        }

        setLobby(result.lobby);
        setMembers(result.members || []);

        // Sync local inputs if user is a driver
        const me = result.members?.find((m: any) => m.user_id === dbUser?.user_id);
        if (me?.metadata?.transport?.role === 'driver') {
             if (!carName) setCarName(me.metadata.transport.car_name || "");
             if (driverSeats === 3 && me.metadata.transport.seats) setDriverSeats(me.metadata.transport.seats);
        }

        // Fetch Checkpoints
        const { data: cps } = await getLobbyCheckpoints(lobbyId as string);
        setCheckpoints(cps || []);

        // Auto-switch tab if game active
        if (result.lobby.status === 'active' && activeTab === 'roster') {
             // setActiveTab('game'); // Optional auto-switch
        }
        
        // Auto-switch to game tab if finished to show report
        if (result.lobby.status === 'finished' && activeTab !== 'game') {
             setActiveTab('game');
        }

    } catch (e: any) {
        console.error("Lobby Load Error:", e);
        setError("Failed to load lobby data.");
    }
  }, [lobbyId, dbUser?.user_id, activeTab]);

  // Initial Load & Realtime Subscriptions
  useEffect(() => {
    loadData();
    
    // Subscribe to changes
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
  const handleAddBot = async (team: string) => { const res = await addNoobBot(lobbyId as string, team); if (!res.success) toast.error(res.error); else loadData(); };
  const handleKickBot = async (memberId: string) => { const res = await removeMember(memberId); if (!res.success) toast.error(res.error); else { toast.success("Kicked"); loadData(); } };
  const handleStatusToggle = async (memberId: string, current: string) => { 
      if (lobby?.status === 'active') {
          if (current === 'alive') await playerHit(lobbyId as string, memberId);
          else await playerRespawn(lobbyId as string, memberId);
      }
      loadData(); 
  };
  const handleJoinTeam = async (team: string) => { 
      if (!dbUser) { toast.error("Auth required"); return; } 
      const res = await joinLobby(dbUser.user_id, lobbyId as string, team); 
      if (res.success) { 
          toast.success(res.message); 
          loadData(); 
      } else { 
          toast.error(res.error); 
      } 
  };
  const handleImHit = async () => { if (!userMember || userMember.status === 'dead') return; const res = await playerHit(lobbyId as string, userMember.id); if (res.success) { toast.warning("ВЫ УБИТЫ. СЧЕТ ОБНОВЛЕН."); loadData(); } else toast.error(res.error); };
  const handleSelfRespawn = async () => { if (!userMember || userMember.status === 'alive') return; const res = await playerRespawn(lobbyId as string, userMember.id); if (res.success) { toast.success("ВЫ ВОЗРОЖДЕНЫ! В БОЙ!"); loadData(); } else toast.error(res.error); };
  const handlePdfGen = async () => { if (!dbUser) return; setIsGeneratingPdf(true); toast.loading("Создание PDF..."); const res = await generateAndSendLobbyPdf(dbUser.user_id, lobbyId as string); toast.dismiss(); setIsGeneratingPdf(false); if (res.success) toast.success("Отправлено в Telegram"); else toast.error(res.error); };
  const handleSafetySign = async () => { if (!userMember) return; await signSafetyBriefing(userMember.id); loadData(); toast.success("Инструктаж подписан"); };
  const shareIntel = () => { if (!lobby) return; const inviteLink = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobbyId}`; const url = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(`Op: ${lobby.name}\nJoin Squad!`)}`; if (tg && tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url, '_blank'); };

  // Logistics
  const handleTransportUpdate = async (role: string, seats: number = 0) => {
      if (!userMember) return;
      await updateTransportStatus(userMember.id, { role, seats, car_name: carName || "Авто" });
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

  const handleUpdateCarDetails = async () => {
      if (!userMember) return;
      // This forces the current input values to be saved
      await updateTransportStatus(userMember.id, { role: 'driver', seats: driverSeats, car_name: carName || "Авто" });
      toast.success("Данные авто обновлены");
      loadData();
  };

  const handleJoinCar = async (driverMemberId: string) => {
      if (!userMember) return;
      await joinCar(userMember.id, driverMemberId);
      toast.success("Вы сели в машину");
      loadData();
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
  const isFinished = lobby.status === 'finished';

  // Logistics Data - Filter and map correctly using the manually joined 'user' object
  const drivers = members.filter(m => m.metadata?.transport?.role === 'driver');
  const pedestrians = members.filter(m => m.metadata?.transport?.role === 'passenger' && !m.metadata.transport?.driver_id);

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
        {isFinished && (
             <div className="mt-2 text-zinc-400 font-bold font-mono bg-zinc-900 inline-block px-4 py-1 rounded border border-zinc-700">
                 🏁 MISSION COMPLETE 🏁
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
                 {/* SHOW REPORT IF FINISHED */}
                 {isFinished ? (
                     <BattleReportView lobby={lobby} members={members} checkpoints={checkpoints} />
                 ) : (
                     /* Standard HUD */
                     <>
                        {/* SHOW DOMINATION HUD IF POINTS EXIST */}
                        {checkpoints.length > 0 && <DominationHUD lobbyId={lobby.id} />}
                        
                        {(lobby.status === 'active') && <LiveHUD startTime={lobby.metadata?.actual_start_at} score={score} />}
                        
                        {isOwner && (
                            <div className="border-t border-zinc-800 pt-6">
                                <h3 className="text-center font-orbitron text-zinc-500 mb-4 text-xs tracking-widest">COMMANDER OVERRIDE</h3>
                                <CommandConsole lobbyId={lobby.id} userId={dbUser!.user_id} status={lobby.status} score={score} />
                            </div>
                        )}
                        
                        {isOwner && (
                            <AdminCheckpointPanel lobbyId={lobby.id} onLoad={loadData} />
                        )}

                        {isOwner && checkpoints.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                                {checkpoints.map(cp => (
                                    <button 
                                        key={cp.id}
                                        onClick={() => toast.info(`Code: capture_${cp.id}`)} 
                                        className="text-[10px] bg-zinc-800 p-2 rounded text-zinc-400 border border-zinc-700"
                                    >
                                        PRINT {cp.name}
                                    </button>
                                ))}
                            </div>
                        )}

                        {lobby.status === 'open' && !isOwner && <div className="text-center py-10 bg-zinc-900/50 rounded border border-zinc-800 border-dashed text-zinc-500 font-mono">WAITING FOR COMMANDER...</div>}
                     </>
                 )}
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
                                      <button onClick={handleUpdateCarDetails} className="ml-2 text-[10px] text-green-400 border border-green-500 px-2 py-1 rounded">SAVE</button>
                                  </div>
                              )}
                          </div>
                          <button onClick={togglePassenger} className={cn("p-4 rounded-lg border-2 transition-all", userMember?.metadata?.transport?.role === 'passenger' ? "bg-amber-900/40 border-amber-500 text-amber-300" : "bg-zinc-950 border-zinc-800 hover:border-zinc-600")}>
                              <div className="text-2xl mb-2">🙋‍♂️</div>
                              <div className="font-bold text-sm">МНЕ НУЖНО МЕСТО</div>
                              <div className="text-xs text-zinc-500 mt-1">Passenger</div>
                          </button>
                      </div>
                      <div className="space-y-6">
                          <div>
                              <div className="text-xs font-mono text-zinc-500 uppercase mb-2 border-b border-zinc-800 pb-1">Активные Водители</div>
                              <div className="space-y-2">
                                {drivers.map(driver => {
                                    const passengers = members.filter(m => m.metadata?.transport?.driver_id === driver.id);
                                    const seatsTaken = passengers.length;
                                    const seatsTotal = driver.metadata.transport.seats || 3;
                                    const isFull = seatsTaken >= seatsTotal;
                                    const driverName = driver.user?.username || driver.user?.full_name || 'Неизвестный';
                                    
                                    return (
                                        <div key={driver.id} className="bg-black/40 p-3 rounded flex flex-col gap-2 border border-zinc-800">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="font-bold text-sm">{driverName} <span className="text-zinc-500 font-normal">({driver.metadata.transport.car_name})</span></span></div>
                                                <div className={cn("text-xs px-2 py-1 rounded border", isFull ? "border-red-900 text-red-500" : "border-green-900 text-green-500")}>{seatsTaken}/{seatsTotal}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 items-center pl-4 border-l-2 border-zinc-800">
                                                {passengers.map(p => (
                                                    <div key={p.id} className="bg-zinc-950 px-2 py-0.5 rounded text-[10px] text-zinc-400 border border-zinc-800">
                                                        {p.user?.username || 'Спутник'}
                                                    </div>
                                                ))}
                                                {!isFull && userMember?.metadata?.transport?.role === 'passenger' && userMember.metadata.transport.driver_id !== driver.id && (
                                                    <button onClick={() => handleJoinCar(driver.id)} className="bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-800 text-cyan-400 px-3 py-0.5 rounded text-[10px] font-bold transition-colors">+ СЕСТЬ</button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                              </div>
                          </div>
                          <div>
                              <div className="text-xs font-mono text-zinc-500 uppercase mb-2 border-b border-zinc-800 pb-1">Пассажиры</div>
                              <div className="flex flex-wrap gap-2">
                                  {pedestrians.map(p => (
                                      <span key={p.id} className="bg-amber-900/20 text-amber-500 px-3 py-1 rounded text-xs border border-amber-900/50 flex items-center gap-2">{p.user?.username || 'Unknown'} <span>👋</span></span>
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

      {/* Footer Actions */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30 flex flex-col gap-2 pointer-events-none">
          {/* HIT / RESPAWN - Only if active */}
          {userMember && userMember.status === 'alive' && lobby.status === 'active' && (
              <button onClick={handleImHit} className="pointer-events-auto w-full bg-red-600/90 hover:bg-red-500 text-white font-black py-4 uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(220,38,38,0.6)] border-2 border-red-400 animate-pulse text-xl font-orbitron"><FaSkullCrossbones className="inline mr-3 mb-1"/> Я УБИТ!</button>
          )}
          {userMember && userMember.status === 'dead' && lobby.status === 'active' && (
              <button onClick={handleSelfRespawn} className="pointer-events-auto w-full bg-emerald-600/90 hover:bg-emerald-500 text-white font-black py-4 uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(16,185,129,0.6)] border-2 border-emerald-400 animate-pulse text-xl font-orbitron"><FaRecycle className="inline mr-3 mb-1"/> ВОЗРОЖДЕНИЕ (QR)</button>
          )}

          {/* Join Buttons: Hidden if finished */}
          {!isFinished && !userMember && (
            <div className="pointer-events-auto grid grid-cols-2 gap-2 bg-black/80 p-2 border border-zinc-700 shadow-2xl backdrop-blur-md">
                <button 
                    onClick={() => handleJoinTeam('blue')} 
                    className={cn(
                        "font-bold py-3 uppercase border transition-all text-xs sm:text-sm",
                        userMember?.team === 'blue' ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_blue] cursor-default" : "bg-blue-900/40 text-blue-200 border-blue-500/30 hover:bg-blue-800"
                    )}
                    disabled={userMember?.team === 'blue'}
                >
                    {userMember?.team === 'blue' ? "ВЫ ЗА СИНИХ" : "ЗА СИНИХ"}
                </button>
                <button 
                    onClick={() => handleJoinTeam('red')} 
                    className={cn(
                        "font-bold py-3 uppercase border transition-all text-xs sm:text-sm",
                        userMember?.team === 'red' ? "bg-red-600 border-red-400 text-white shadow-[0_0_15px_red] cursor-default" : "bg-red-900/40 text-red-200 border-red-500/30 hover:bg-red-800"
                    )}
                    disabled={userMember?.team === 'red'}
                >
                    {userMember?.team === 'red' ? "ВЫ ЗА КРАСНЫХ" : "ЗА КРАСНЫХ"}
                </button>
            </div>
          )}
          {/* Allow switching if not finished, even if member */}
          {!isFinished && userMember && (
            <div className="pointer-events-auto grid grid-cols-2 gap-2 bg-black/80 p-2 border border-zinc-700 shadow-2xl backdrop-blur-md opacity-80 hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => handleJoinTeam('blue')} 
                    className={cn(
                        "font-bold py-2 uppercase border transition-all text-[10px]",
                        userMember?.team === 'blue' ? "bg-blue-600 border-blue-400 text-white" : "bg-blue-900/20 text-blue-300 border-blue-500/20 hover:bg-blue-800"
                    )}
                    disabled={userMember?.team === 'blue'}
                >
                    {userMember?.team === 'blue' ? "ВЫ ЗА СИНИХ" : "СМЕНИТЬ НА СИНИХ"}
                </button>
                <button 
                    onClick={() => handleJoinTeam('red')} 
                    className={cn(
                        "font-bold py-2 uppercase border transition-all text-[10px]",
                        userMember?.team === 'red' ? "bg-red-600 border-red-400 text-white" : "bg-red-900/20 text-red-300 border-red-500/20 hover:bg-red-800"
                    )}
                    disabled={userMember?.team === 'red'}
                >
                    {userMember?.team === 'red' ? "ВЫ ЗА КРАСНЫХ" : "СМЕНИТЬ НА КРАСНЫХ"}
                </button>
            </div>
          )}
      </div>
    </div>
  );
}