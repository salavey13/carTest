"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { supabaseAnon } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext";

// --- ПРИВИЛЕГИРОВАННЫЕ ЭКШЕНЫ (Server Actions) ---
import { fetchLobbyData, joinLobby, addNoobBot, removeMember } from "../../actions/lobby";
import { playerHit, playerRespawn, handleBaseInteraction } from "../../actions/game";
import { generateAndSendLobbyPdf } from "../../actions/service";

// --- ТАКТИЧЕСКИЕ КОМПОНЕНТЫ ---
import { SyncIndicator } from "./components/SyncIndicator";
import { LobbyHeader } from "./components/LobbyHeader";
import { LobbyTabs } from "./components/LobbyTabs";
import { LobbyFooter } from "./components/LobbyFooter";
import { VirtualBlaster } from "./components/VirtualBlaster";
import { LobbyTabManager } from "./components/LobbyTabManager";
import { motion, AnimatePresence } from "framer-motion";
// --- ХУКИ ---
import { useGeoTracking } from "../../hooks/useGeoTracking";
import { useTacticalOutbox } from "../../hooks/useTacticalOutbox";

import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LobbyRoom() {
  const { id: lobbyId } = useParams(); 
  const { dbUser, tg, isAdmin: checkAdminFunc } = useAppContext();
  const { addToOutbox, burstSync, queue } = useTacticalOutbox();
  
  // Состояния данных
  const [members, setMembers] = useState<any[]>([]);
  const [lobby, setLobby] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'roster' | 'game' | 'map' | 'logistics' | 'safety'>('roster'); 
  
  // Состояния UI
  const [whiteFlash, setWhiteFlash] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Вычисляемые права
  const isSystemAdmin = useMemo(() => 
    typeof checkAdminFunc === 'function' ? checkAdminFunc() : false
  , [checkAdminFunc]);

  const userMember = useMemo(() => 
    members.find(m => m.user_id === dbUser?.user_id)
  , [members, dbUser?.user_id]);

  const isOwner = useMemo(() => 
    lobby?.owner_id === dbUser?.user_id
  , [lobby, dbUser?.user_id]);

  // Режимы игры
  const isDrinkRoyale = lobby?.mode === 'DRINKNIGHT ROYALE';
  const isCyberVibe = lobby?.metadata?.mode === 'cybervibe' || lobby?.mode === 'VIBECODE';

  // Включаем GPS-трекинг только если игра активна (Drink Royale)
  useGeoTracking(lobbyId as string, dbUser?.user_id!, lobby?.status === 'active');

  // --- ЯДРО СИНХРОНИЗАЦИИ ---
  const loadData = useCallback(async () => {
    try {
        const result = await fetchLobbyData(lobbyId as string);
        if (!result.success || !result.lobby) { 
            setError("ОШИБКА_УСТАНОВКИ_СВЯЗИ"); 
            return; 
        }
        
        setLobby(result.lobby);
        setMembers(result.members || []);

        // Если игра завершилась — перекидываем на вкладку отчета
        if (result.lobby.status === 'finished' && activeTab !== 'game') {
            setActiveTab('game');
        }
    } catch (e) { 
        setError("КРИТИЧЕСКИЙ_СБОЙ_СИГНАЛА"); 
    }
  }, [lobbyId, activeTab]);

  useEffect(() => {
    loadData();
    // Realtime канал только для уведомления о необходимости рефреша
    const channel = supabaseAnon
      .channel(`lobby_os_${lobbyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby_members', filter: `lobby_id=eq.${lobbyId}` }, loadData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lobbies', filter: `id=eq.${lobbyId}` }, loadData)
      .subscribe();
      
    return () => { supabaseAnon.removeChannel(channel); };
  }, [lobbyId, loadData]);

  // --- ОБРАБОТКА КОМАНД (Tactical Outbox / Uplink) ---
  const processUplink = useCallback(async (action: any) => {
      // Здесь вызываются Server Actions для внесения изменений
      if (action.type === 'HIT') return await playerHit(lobbyId as string, action.payload.memberId);
      if (action.type === 'RESPAWN') return await playerRespawn(lobbyId as string, action.payload.memberId);
      if (action.type === 'BASE_INTERACT') return await handleBaseInteraction(lobbyId as string, dbUser?.user_id!, action.payload.targetTeam);
      return { success: true };
  }, [lobbyId, dbUser]);

  useEffect(() => { 
      if (queue.length > 0) burstSync(processUplink); 
  }, [queue.length, burstSync, processUplink]);

  // --- ОБРАБОТЧИКИ СОБЫТИЙ ---
  const handlePdfGen = async () => {
    if (!dbUser?.user_id) return;
    setIsGeneratingPdf(true);
    toast.loading("ГЕНЕРАЦИЯ_ПАКЕТА_ДАННЫХ...");
    try {
        const res = await generateAndSendLobbyPdf(dbUser.user_id, lobbyId as string);
        if (res.success) toast.success("PDF_ПЕРЕДАН_В_TELEGRAM");
        else toast.error(res.error);
    } catch (e) {
        toast.error("СБОЙ_ПЕЧАТИ");
    } finally {
        setIsGeneratingPdf(false);
        toast.dismiss();
    }
  };

  const handleImHit = () => { 
    if (!userMember || userMember.status === 'dead') return;
    
    // Оптимистичное обновление
    setMembers(prev => prev.map(m => m.id === userMember.id ? { ...m, status: 'dead' } : m));
    setWhiteFlash(true); 
    setTimeout(() => setWhiteFlash(false), 150);
    
    addToOutbox('HIT', { memberId: userMember.id });
    toast.warning("KIA_ЗАПИСАНО // ПЕРЕДАЧА_В_ШТАБ...");
  };

  const handleTacticalRespawn = () => {
      // Если доступен сканер QR — используем его
      if (tg?.showScanQrPopup) {
          tg.showScanQrPopup({ text: "СКАНИРУЙ_QR_БАЗЫ_ДЛЯ_ВЫСАДКИ" }, async (text: string) => {
              tg.closeScanQrPopup();
              if (text?.startsWith('respawn_')) {
                  const team = text.split('_')[2];
                  addToOutbox('BASE_INTERACT', { targetTeam: team });
                  toast.success("ЗАПРОС_ВЫСАДКИ_ОТПРАВЛЕН");
              }
              return true;
          });
      } else {
          // Ручное возрождение (для дева или если QR нет)
          addToOutbox('RESPAWN', { memberId: userMember?.id });
          toast.info("ЗАПРОС_ВЫСАДКИ...");
      }
  };

  const handleJoinTeam = async (team: string) => {
    if (!dbUser) return;
    const res = await joinLobby(dbUser.user_id, lobbyId as string, team);
    if (res.success) { 
        toast.success(res.message); 
        loadData(); 
    }
  };

  if (error) return <div className="pt-40 text-center text-red-600 font-mono italic text-2xl uppercase tracking-widest">КРИТИЧЕСКАЯ_ОШИБКА: {error}</div>;
  if (!lobby) return <div className="pt-40 text-center text-white font-mono animate-pulse uppercase tracking-[0.5em]">Реконструкция_Операции...</div>;

  return (
    <div className={cn(
        "pt-28 pb-48 px-2 min-h-screen text-white font-mono transition-colors duration-200", 
        whiteFlash ? "bg-white/10" : "bg-black"
    )}>
      
      {/* Индикатор синхронизации оффлайн-буфера */}
      <SyncIndicator count={queue.length} />

      {/* Шапка: Статус, Название, Режим */}
      <LobbyHeader 
        name={lobby.name} 
        mode={isCyberVibe ? "CYBERVIBE_INTENSIVE" : lobby.mode} 
        status={lobby.status} 
        startAt={lobby.start_at}
        metadata={lobby.metadata}
        userMember={userMember} 
        isAdmin={isOwner || isSystemAdmin}
        onPdf={handlePdfGen} 
        onShare={() => {}} // Реализовать через tg.share 
        loading={isGeneratingPdf} 
      />

      {/* Навигация по вкладкам */}
      <LobbyTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Основной контент (управляется TabManager для чистоты кода) */}
      <div className="max-w-4xl mx-auto min-h-[40vh]">
          <LobbyTabManager 
            activeTab={activeTab}
            lobby={lobby}
            members={members}
            dbUser={dbUser}
            isOwner={isOwner}
            isAdmin={isSystemAdmin}
            loadData={loadData}
          />
      </div>

      {/* Динамический Футер: Бластер для Drink Royale или Кнопки жизни для Сталкера */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50">
          <AnimatePresence mode="wait">
              {lobby.status === 'active' && isDrinkRoyale && userMember?.status === 'alive' ? (
                  <motion.div initial={{ y: 50 }} animate={{ y: 0 }} exit={{ y: 50 }}>
                      <VirtualBlaster onHit={handleImHit} />
                  </motion.div>
              ) : (
                  <LobbyFooter 
                    status={lobby.status} 
                    userMember={userMember} 
                    onHit={handleImHit} 
                    onRespawn={handleTacticalRespawn} 
                    onJoinTeam={handleJoinTeam} 
                  />
              )}
          </AnimatePresence>
      </div>

      {/* Декоративный фон для погружения */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[-1] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
    </div>
  );
}