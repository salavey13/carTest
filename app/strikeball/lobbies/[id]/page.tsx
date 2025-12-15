"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, togglePlayerStatus, removeMember } from "../../actions/lobby";
import { updateTransportStatus, signSafetyBriefing } from "../../actions/logistics";
import { generateAndSendLobbyPdf } from "../../actions/service";
import { SquadRoster } from "../../components/SquadRoster";
import { SafetyBriefing } from "../../components/SafetyBriefing"; // NEW IMPORT
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaShareNodes, FaMapLocationDot, FaSkullCrossbones, FaFilePdf, FaCar, FaClipboardCheck, FaUsers, FaCircleCheck } from "react-icons/fa6";
import { VibeMap, MapBounds, PointOfInterest } from "@/components/VibeMap";

const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg } = useAppContext();
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'map' | 'logistics' | 'safety'>('roster');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    loadData();
    const channel = supabaseAnon
      .channel(`lobby_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` }, () => loadData())
      .subscribe();
    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId]);

  const loadData = async () => {
    const { data: l, error: lobbyError } = await supabaseAnon.from("lobbies").select("*").eq("id", lobbyId).single();
    if (lobbyError) { setError("Лобби не найдено"); return; }
    const { data: m } = await supabaseAnon.from("lobby_members").select("*, user:users(username)").eq("lobby_id", lobbyId);
    setLobby(l);
    setMembers(m || []);
  };

  const userMember = members.find(m => m.user_id === dbUser?.user_id);
  const isOwner = userMember?.role === 'owner';

  // --- ACTIONS ---
  const handleAddBot = async (team: string) => { const res = await addNoobBot(lobbyId as string, team); if (!res.success) toast.error(res.error); else loadData(); };
  const handleKickBot = async (memberId: string) => { const res = await removeMember(memberId); if (!res.success) toast.error(res.error); else { toast.success("Kicked"); loadData(); } };
  const handleStatusToggle = async (memberId: string, current: string) => { await togglePlayerStatus(memberId, current); };
  const handleJoinTeam = async (team: string) => { if (!dbUser) { toast.error("Auth required"); return; } const res = await joinLobby(dbUser.user_id, lobbyId as string, team); if (res.success) { toast.success(res.message); loadData(); } else { toast.error(res.error); } };

  const handleImHit = async () => {
      if (!userMember || userMember.status === 'dead') return;
      const res = await togglePlayerStatus(userMember.id, 'alive');
      if (res.success) toast.warning("СТАТУС: РАНЕН");
  };

  const handlePdfGen = async () => {
      setIsGeneratingPdf(true);
      toast.loading("Создание PDF...");
      const res = await generateAndSendLobbyPdf(dbUser!.user_id, lobbyId as string);
      toast.dismiss(); setIsGeneratingPdf(false);
      if (res.success) toast.success("Отправлено в Telegram"); else toast.error(res.error);
  };

  const handleTransportUpdate = async (role: string, seats: number = 0) => {
      if (!userMember) return;
      await updateTransportStatus(userMember.id, { role, seats });
      toast.success("Транспорт обновлен");
  };

  const handleSafetyComplete = async () => {
      if (!userMember) return;
      await signSafetyBriefing(userMember.id);
      loadData();
      toast.success("Инструктаж подписан");
  };

  const shareIntel = () => {
    if (!lobby) return;
    const inviteLink = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobbyId}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(`Operation: ${lobby.name}\nJoin Squad!`)}`;
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
      </div>

      {/* Navigation Tabs */}
      <div className="flex justify-center gap-2 mb-6">
          {[
              { id: 'roster', icon: FaUsers, label: 'SQUADS' },
              { id: 'map', icon: FaMapLocationDot, label: 'MAP' },
              { id: 'logistics', icon: FaCar, label: 'LOGISTICS' },
              { id: 'safety', icon: FaClipboardCheck, label: 'BRIEF' }
          ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                    "px-4 py-2 rounded text-xs font-bold flex items-center gap-2 border transition-all",
                    activeTab === tab.id 
                        ? "bg-red-900/50 border-red-500 text-white" 
                        : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800"
                )}
              >
                  <tab.icon />
                  <span className="hidden sm:inline">{tab.label}</span>
              </button>
          ))}
      </div>

      {/* CONTENT AREA */}
      <div className="max-w-4xl mx-auto min-h-[50vh]">
          
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
                  <div className="absolute bottom-4 left-4 bg-black/70 p-2 rounded text-xs font-mono border border-zinc-600">
                      GPS: {lobby.field_id || "NOT SET"}
                  </div>
              </div>
          )}

          {/* LOGISTICS TAB */}
          {activeTab === 'logistics' && (
              <div className="space-y-4">
                  <div className="bg-zinc-900 p-4 rounded border border-zinc-700">
                      <h3 className="font-bold text-lg mb-4 text-cyan-400">Транспортный Узел</h3>
                      <div className="flex gap-4 mb-6">
                          <button onClick={() => handleTransportUpdate('driver', 3)} className="flex-1 bg-zinc-800 p-3 rounded hover:bg-zinc-700 border border-zinc-600">
                              <div className="text-center font-bold">Я ВОДИТЕЛЬ</div>
                              <div className="text-xs text-zinc-500">Есть 3 места</div>
                          </button>
                          <button onClick={() => handleTransportUpdate('passenger')} className="flex-1 bg-zinc-800 p-3 rounded hover:bg-zinc-700 border border-zinc-600">
                              <div className="text-center font-bold">ПЕШЕХОД</div>
                              <div className="text-xs text-zinc-500">Ищу место</div>
                          </button>
                      </div>

                      <div className="space-y-2">
                          <div className="text-xs font-mono text-zinc-500 uppercase">Водители:</div>
                          {members.filter(m => m.metadata?.transport?.role === 'driver').map(m => (
                              <div key={m.id} className="bg-black/40 p-2 rounded flex justify-between items-center border border-zinc-800">
                                  <span>{m.user?.username || 'Unknown'} <span className="text-zinc-500">({m.metadata.transport.car_name})</span></span>
                                  <span className="text-green-500 font-mono">{m.metadata.transport.seats} мест</span>
                              </div>
                          ))}
                      </div>

                      <div className="space-y-2 mt-4">
                          <div className="text-xs font-mono text-zinc-500 uppercase">Пассажиры:</div>
                          <div className="flex flex-wrap gap-2">
                              {members.filter(m => m.metadata?.transport?.role === 'passenger').map(m => (
                                  <span key={m.id} className="bg-zinc-800 px-2 py-1 rounded text-xs border border-zinc-700">{m.user?.username}</span>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* SAFETY TAB - NEW COMPONENT */}
          {activeTab === 'safety' && (
              <SafetyBriefing 
                 onComplete={handleSafetyComplete} 
                 isSigned={!!userMember?.metadata?.safety_signed} 
              />
          )}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30 flex flex-col gap-2 pointer-events-none">
          {userMember && userMember.status === 'alive' && (
              <button 
                onClick={handleImHit}
                className="pointer-events-auto w-full bg-red-600/90 hover:bg-red-500 text-white font-black py-4 uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(220,38,38,0.6)] border-2 border-red-400 animate-pulse text-xl font-orbitron"
              >
                  <FaSkullCrossbones className="inline mr-3 mb-1"/> Я УБИТ!
              </button>
          )}

          {!userMember && (
            <div className="pointer-events-auto grid grid-cols-2 gap-2 bg-black/80 p-2 border border-zinc-700 shadow-2xl backdrop-blur-md">
                <button onClick={() => handleJoinTeam('blue')} className="bg-blue-900/40 hover:bg-blue-800 text-blue-200 font-bold py-3 uppercase border border-blue-500/30">ЗА СИНИХ</button>
                <button onClick={() => handleJoinTeam('red')} className="bg-red-900/40 hover:bg-red-800 text-red-200 font-bold py-3 uppercase border border-red-500/30">ЗА КРАСНЫХ</button>
            </div>
          )}
      </div>
    </div>
  );
}