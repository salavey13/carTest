"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { CreateLobbyForm } from "./components/CreateLobbyForm";
import { useTacticalOutbox } from "./hooks/useTacticalOutbox";
import { captureCheckpoint } from "./actions/domination";
import { playerRespawn, handleBaseInteraction } from "./actions/game";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FaQrcode, FaShieldHalved, FaUsers, FaPlus, FaTrophy, FaWifi } from "react-icons/fa6";
import { ActivityTicker } from "./components/ActivityTicker";

const QRDisplay = ({ value, onClose }: { value: string, onClose: () => void }) => (
    <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
        onClick={onClose}
    >
        <div className="bg-zinc-900 p-6 rounded-none border-4 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.5)] max-w-sm w-full" onClick={e => e.stopPropagation()}>
             <h3 className="text-red-500 font-orbitron font-bold text-center text-xl mb-4 tracking-widest uppercase">Signal_Link</h3>
             <div className="bg-white p-2 mb-4">
                 <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}`} 
                    alt="QR Code" 
                    className="w-full h-auto"
                 />
             </div>
             <button onClick={onClose} className="w-full bg-red-700 hover:bg-red-600 text-white py-3 font-black font-orbitron uppercase tracking-wider transition-colors rounded-none">
                 CLOSE_LINK
             </button>
        </div>
    </motion.div>
);

const Q3MenuItem = ({ label, subLabel, href, onClick, icon: Icon, className }: any) => {
  const [hovered, setHovered] = useState(false);
  const Container = href ? Link : 'div';
  const props = href ? { href } : { onClick };

  return (
    <Container 
        {...props}
        className={cn("relative block group cursor-pointer w-full mb-5", className)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
    >
      {/* 
          ГЕОМЕТРИЯ: Слой рамки и фона. 
          skew-x-[-15deg] наклоняет сам прямоугольник, включая его границы.
      */}
      <div className={cn(
          "absolute inset-0 transition-all duration-200 skew-x-[-15deg] border-2 border-l-[6px] origin-bottom", 
          hovered 
            ? "bg-red-600/10 border-red-500 translate-x-1 shadow-[0_0_20px_rgba(220,38,38,0.2)]" 
            : "bg-zinc-900/80 border-zinc-700 shadow-lg"
      )} />
      
      {/* КОНТЕНТ: Без наклона (straight) */}
      <div className="relative flex items-center justify-between p-4 pl-8 z-10">
          <div className="flex items-center gap-5">
              <div className={cn(
                  "w-12 h-12 flex items-center justify-center bg-black border-2 transition-all duration-200", 
                  hovered ? "border-red-500 text-red-500" : "border-zinc-700 text-zinc-500"
              )}>
                  {Icon && <Icon className="w-6 h-6" />}
              </div>
              <div className="flex flex-col">
                  <span className={cn(
                      "font-black font-orbitron text-xl tracking-widest leading-none transition-colors", 
                      hovered ? "text-white" : "text-zinc-400"
                  )}>{label}</span>
                  <span className={cn(
                      "text-[9px] font-mono tracking-[0.3em] uppercase mt-1 transition-colors", 
                      hovered ? "text-red-400" : "text-zinc-600"
                  )}>{subLabel}</span>
              </div>
          </div>
          <div className={cn(
              "transition-all duration-300 font-black text-2xl pr-4",
              hovered ? "text-red-500 opacity-100 translate-x-0" : "opacity-0 -translate-x-2"
          )}>&gt;&gt;</div>
      </div>
    </Container>
  );
};

export default function StrikeballDashboard() {
  const { tg, dbUser, activeLobby, isAdmin } = useAppContext(); 
  const { addToOutbox, flushQueue, queue } = useTacticalOutbox(); 
  const router = useRouter();
  const [menuStep, setMenuStep] = useState<'main' | 'create'>('main');
  const [showQR, setShowQR] = useState(false);

  const isLive = !!activeLobby;
  const isSysAdmin = isAdmin && isAdmin();

  useEffect(() => {
    const interval = setInterval(() => {
        if (queue.length === 0) return;
        flushQueue(async (action) => {
            if (action.type === 'CAPTURE') return await captureCheckpoint(dbUser?.user_id!, action.payload.checkpointId);
            if (action.type === 'RESPAWN') return await handleBaseInteraction(action.payload.lobbyId, dbUser?.user_id!, action.payload.team);
            return { success: true };
        });
    }, 4000);
    return () => clearInterval(interval);
  }, [queue, flushQueue, dbUser]);

  const handleQR = () => {
      if (tg && tg.showScanQrPopup) {
          tg.showScanQrPopup({ text: "SCAN_TACTICAL_OBJECTIVE" }, async (text: string) => { 
              tg.closeScanQrPopup();
              if (!text) return true;
              let param = text;
              if (text.includes('startapp=')) param = text.split('startapp=')[1].split('&')[0];

              if (param.startsWith('lobby_')) {
                  router.push(`/strikeball/lobbies/${param.replace('lobby_', '')}`);
              } else if (param.startsWith('capture_')) {
                  addToOutbox('CAPTURE', { checkpointId: param.replace('capture_', '') });
                  toast.success("OBJECTIVE_QUEUED");
              } else if (param.startsWith('respawn_')) {
                  const parts = param.split('_');
                  addToOutbox('RESPAWN', { lobbyId: parts[1], team: parts[2] || 'neutral' });
                  toast.success("RESPAWN_QUEUED");
              } else {
                  toast.error("INVALID_SIGNAL");
              }
              return true;
          });
      } else {
          setShowQR(true);
      }
  };

  const myLink = `https://t.me/oneSitePlsBot/app?startapp=user_${dbUser?.user_id || 'unknown'}`;

  return (
    <div className={cn(
        "pt-28 pb-32 px-4 relative min-h-screen transition-all duration-700",
        isLive ? "bg-[#000000]" : "" 
    )}>
      <AnimatePresence>
        {showQR && <QRDisplay value={myLink} onClose={() => setShowQR(false)} />}
      </AnimatePresence>

      {queue.length > 0 && (
          <div className="fixed top-24 left-4 z-50 flex items-center gap-2 bg-black/80 border border-amber-600 px-3 py-1 animate-pulse rounded-none">
              <FaWifi className="text-amber-500 text-xs" />
              <span className="text-[9px] font-mono text-amber-500 font-bold uppercase">Uplink_Buffer: {queue.length}</span>
          </div>
      )}

      <div className="text-center mb-12">
        <motion.h1 
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
            className={cn("font-black font-orbitron italic tracking-tighter uppercase", isLive ? "text-4xl text-white" : "text-6xl md:text-8xl text-zinc-200 drop-shadow-2xl")}
        >
          {isLive ? "GHOST_OS // v2.4" : <div className="relative bg-black/40 backdrop-blur-md border border-brand-cyan/30 rounded-lg overflow-hidden">
  {/* Corners */}
  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-brand-cyan" />
  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-brand-cyan" />
  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-brand-cyan" />
  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-brand-cyan" />

  {/* Label */}
  <div className="flex items-center justify-between px-3 py-1 border-b border-brand-cyan/20 bg-brand-cyan/5">
    <span className="text-xs font-orbitron text-brand-cyan tracking-widest uppercase">Live Feed</span>
    <div className="flex gap-1">
      <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
      <span className="text-[10px] text-red-400 font-mono">REC</span>
    </div>
  </div>

  <ActivityTicker isLive={true} />
</div>}
        </motion.h1>
        {isLive && (
            <div className="mt-4 px-6 py-1 bg-red-600/10 border-x-4 border-red-600 inline-block">
                <span className="text-red-500 font-bold animate-pulse text-[10px] font-mono tracking-[0.3em] uppercase">
                    ● Signal_Active: {activeLobby.name}
                </span>
            </div>
        )}
      </div>

      <div className="max-w-md mx-auto">
        <div className="relative z-10">
            <AnimatePresence mode="wait">
              {menuStep === 'main' ? (
                <motion.div key="main" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }} className="space-y-1">
                  <Q3MenuItem 
                        label="СКАНЕР (QR)" 
                        subLabel={isLive ? "ЗАХВАТ / ВОЗРОЖДЕНИЕ / ЦЕЛЬ" : "ПОДКЛЮЧЕНИЕ"}
                        onClick={handleQR} 
                        icon={FaQrcode}
                        className={cn(
                            "transition-all duration-500",
                            isLive && "scale-105"
                        )}
                   />
                  {isLive && (
                      <Q3MenuItem 
                        label="ЦЕНТР УПРАВЛЕНИЯ" 
                        subLabel="HUD / КАРТА / ТЕЛЕМЕТРИЯ"
                        href={`/strikeball/lobbies/${activeLobby.id}`}
                        icon={FaShieldHalved}
                        className="mt-6"
                      />
                  )}
                  <div className={cn("transition-all duration-1000", isLive ? "opacity-30 grayscale blur-[0.5px] pointer-events-none mt-12" : "mt-6")}>
                      <Q3MenuItem label="ПАТИ" subLabel="ПОИСК АКТИВНЫХ ОТРЯДОВ" href="/strikeball/lobbies" icon={FaUsers} />
                      {!isLive && <Q3MenuItem label="ТУРНИРЫ" subLabel="4x4 LEAGUE" href="/strikeball/tournaments" icon={FaTrophy} />}
                      <Q3MenuItem label="СОЗДАТЬ СЕРВЕР" subLabel="НОВАЯ ОПЕРАЦИЯ" onClick={() => setMenuStep('create')} icon={FaPlus} />
                      {isSysAdmin && <Q3MenuItem label="АДМИН-ПАНЕЛЬ" subLabel="УПРАВЛЕНИЕ СИСТЕМОЙ" href="/strikeball/admin" icon={FaShieldHalved} className="border-brand-purple" />}
                  </div>
                </motion.div>
              ) : (
                <motion.div key="create" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}>
                  <div className="bg-black/80 p-6 mb-4 border-2 border-zinc-700 skew-x-[-2deg]">
                    <CreateLobbyForm />
                  </div>
                  <Q3MenuItem label="ОТМЕНА" subLabel="НАЗАД В МЕНЮ" onClick={() => setMenuStep('main')} />
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}