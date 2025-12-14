"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";
import { joinLobby, addNoobBot, togglePlayerStatus, removeMember } from "../../actions/lobby";
import { generateAndSendLobbyPdf } from "../../actions/service";
import { SquadRoster } from "../../components/SquadRoster";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FaShareNodes, FaMapLocationDot, FaSkullCrossbones, FaFilePdf, FaCar, FaClipboardCheck } from "react-icons/fa6";
import { VibeMap, MapBounds, PointOfInterest } from "@/components/VibeMap"; // Reusing your VibeMap

const DEFAULT_MAP_URL = 'https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/about/IMG_20250721_203250-d268820b-f598-42ce-b8af-60689a7cc79e.jpg';

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg } = useAppContext();
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'roster' | 'map'>('roster'); 
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
    const { data: m } = await supabaseAnon.from("lobby_members").select("*").eq("lobby_id", lobbyId);
    setLobby(l);
    setMembers(m || []);
  };

  const handleAddBot = async (team: string) => { const res = await addNoobBot(lobbyId as string, team); if (!res.success) toast.error(res.error); else loadData(); };
  const handleKickBot = async (memberId: string) => { const res = await removeMember(memberId); if (!res.success) toast.error(res.error); else { toast.success("Bot kicked"); loadData(); } };
  const handleStatusToggle = async (memberId: string, current: string) => { await togglePlayerStatus(memberId, current); };
  const handleJoinTeam = async (team: string) => { if (!dbUser) { toast.error("Нужна авторизация"); return; } const res = await joinLobby(dbUser.user_id, lobbyId as string, team); if (res.success) { toast.success(res.message); loadData(); } else { toast.error(res.error || "Ошибка"); } };

  const handleImHit = async () => {
      if (!dbUser) return;
      const me = members.find(m => m.user_id === dbUser.user_id);
      if (!me) return;
      if (me.status === 'dead') { toast.info("Вы уже мертвы."); return; }
      const res = await togglePlayerStatus(me.id, 'alive'); // alive -> dead toggle
      if (res.success) toast.warning("СТАТУС: РАНЕН/УБИТ");
  };

  const handlePdfGen = async () => {
      if (!dbUser) return;
      setIsGeneratingPdf(true);
      toast.loading("Генерация PDF сводки...");
      const res = await generateAndSendLobbyPdf(dbUser.user_id, lobbyId as string);
      toast.dismiss();
      setIsGeneratingPdf(false);
      if (res.success) toast.success("PDF отправлен в Telegram!");
      else toast.error(res.error || "Ошибка PDF");
  };

  const shareIntel = () => {
    if (!lobby) return;
    const timeStr = lobby.start_at ? new Date(lobby.start_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "СЕЙЧАС";
    const inviteLink = `https://t.me/oneSitePlsBot/app?startapp=lobby_${lobbyId}`;
    const text = `⚡️ СТРАЙКБОЛ: ${lobby.name}\n📍 Режим: ${lobby.mode?.toUpperCase()}\n🕒 Время: ${timeStr}\n👇 Вступай:\n${inviteLink}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, '_blank');
  };

  if (error) return <div className="text-center pt-32 text-red-600 font-mono">{error}</div>;
  if (!lobby) return <div className="text-center pt-32 text-red-600 font-mono animate-pulse">ПОДКЛЮЧЕНИЕ...</div>;

  const blueTeam = members.filter(m => m.team === 'blue');
  const redTeam = members.filter(m => m.team === 'red');
  const userMember = members.find(m => m.user_id === dbUser?.user_id);

  // Map Data
  const mapPoints: PointOfInterest[] = [];
  let mapBounds: MapBounds = { top: 56.4, bottom: 56.2, left: 43.7, right: 44.1 }; // Default NN
  
  if (lobby.field_id && lobby.field_id.includes(',')) {
      const [lat, lon] = lobby.field_id.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lon)) {
          mapPoints.push({
              id: 'obj', name: 'ТОЧКА СБОРА', type: 'point', 
              coords: [[lat, lon]], icon: '::FaFlag::', color: 'bg-red-500'
          });
          mapBounds = { top: lat + 0.005, bottom: lat - 0.005, left: lon - 0.005, right: lon + 0.005 };
      }
  }

  return (
    <div className="pt-28 pb-32 px-2 min-h-screen text-white font-sans">
      
      {/* Header & Controls */}
      <div className="text-center mb-6 relative">
        <div className="absolute top-0 right-0 flex gap-2">
             {/* Map Toggle */}
             <button onClick={() => setViewMode(viewMode === 'map' ? 'roster' : 'map')} className={cn("p-2 rounded-full transition-colors", viewMode === 'map' ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400")}>
                 <FaMapLocationDot />
             </button>
             {/* PDF Gen */}
             <button onClick={handlePdfGen} disabled={isGeneratingPdf} className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                 <FaFilePdf />
             </button>
             {/* Share */}
             <button onClick={shareIntel} className="p-2 bg-zinc-800 rounded-full text-cyan-500 hover:text-cyan-300 transition-colors">
                 <FaShareNodes />
             </button>
        </div>

        <h1 className="text-3xl font-black font-orbitron uppercase tracking-widest">{lobby.name}</h1>
        <div className="flex justify-center gap-2 mt-2">
             <div className="inline-flex gap-4 text-[10px] font-mono text-zinc-400 bg-black/50 px-4 py-1 border border-zinc-800 rounded-full">
                <span>{lobby.mode?.toUpperCase()}</span> <span className="text-red-500">|</span> <span>{lobby.status?.toUpperCase()}</span>
             </div>
        </div>
        
        {/* Helper Buttons Row */}
        <div className="flex justify-center gap-4 mt-4">
             <button className="text-[10px] flex items-center gap-1 text-zinc-500 hover:text-zinc-300" onClick={() => toast.info("Функция Авто-группировки в разработке")}>
                 <FaCar /> ГРУППИРОВКА
             </button>
             <button className="text-[10px] flex items-center gap-1 text-zinc-500 hover:text-zinc-300" onClick={() => toast.info("Чек-лист безопасности отправлен")}>
                 <FaClipboardCheck /> ИНСТРУКТАЖ
             </button>
        </div>
      </div>

      {viewMode === 'map' ? (
          <div className="h-[60vh] w-full border-2 border-zinc-700 rounded-lg overflow-hidden relative">
              <VibeMap points={mapPoints} bounds={mapBounds} imageUrl={DEFAULT_MAP_URL} />
              <div className="absolute bottom-4 left-4 bg-black/70 p-2 rounded text-xs font-mono border border-zinc-600">
                  GPS: {lobby.field_id || "НЕ ЗАДАН"}
              </div>
          </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 max-w-4xl mx-auto mb-24">
            <SquadRoster teamName="СИНИЕ" teamColor="blue" members={blueTeam} onToggleStatus={handleStatusToggle} onAddBot={() => handleAddBot('blue')} onKick={handleKickBot} currentUserId={dbUser?.user_id} />
            <div className="text-center flex flex-col justify-center"><span className="font-black text-4xl italic text-zinc-700 font-orbitron">VS</span></div>
            <SquadRoster teamName="КРАСНЫЕ" teamColor="red" members={redTeam} onToggleStatus={handleStatusToggle} onAddBot={() => handleAddBot('red')} onKick={handleKickBot} currentUserId={dbUser?.user_id} />
        </div>
      )}

      {/* Footer: HIT Button or Join */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-30 flex flex-col gap-2">
          {userMember && userMember.status === 'alive' && (
              <button 
                onClick={handleImHit}
                className="w-full bg-red-600/90 hover:bg-red-500 text-white font-black py-4 uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(220,38,38,0.6)] border-2 border-red-400 animate-pulse text-xl font-orbitron"
              >
                  <FaSkullCrossbones className="inline mr-3 mb-1"/> Я УБИТ!
              </button>
          )}

          {!userMember && (
            <div className="grid grid-cols-2 gap-2 bg-black/80 p-2 border border-zinc-700 shadow-2xl backdrop-blur-md">
                <button onClick={() => handleJoinTeam('blue')} className="bg-blue-900/40 hover:bg-blue-800 text-blue-200 font-bold py-3 uppercase border border-blue-500/30">ЗА СИНИХ</button>
                <button onClick={() => handleJoinTeam('red')} className="bg-red-900/40 hover:bg-red-800 text-red-200 font-bold py-3 uppercase border border-red-500/30">ЗА КРАСНЫХ</button>
            </div>
          )}
      </div>
    </div>
  );
}