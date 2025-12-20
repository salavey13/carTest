"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/contexts/AppContext";
import { CreateLobbyForm } from "./components/CreateLobbyForm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FaQrcode, FaShieldHalved, FaUsers, FaPlus, FaTrophy } from "react-icons/fa6";

const QRDisplay = ({ value, onClose }: { value: string, onClose: () => void }) => (
    <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md"
        onClick={onClose}
    >
        <div className="bg-zinc-900 p-6 rounded-none border-4 border-red-600 shadow-[0_0_50px_rgba(220,38,38,0.5)] max-w-sm w-full" onClick={e => e.stopPropagation()}>
             <h3 className="text-red-500 font-orbitron font-bold text-center text-xl mb-4 tracking-widest">SECURE LINK</h3>
             <div className="bg-white p-2 mb-4">
                 <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}`} 
                    alt="QR Code" 
                    className="w-full h-auto"
                 />
             </div>
             <div className="text-zinc-400 text-center font-mono text-xs mb-6">
                 СКАНИРУЙ ДЛЯ ПОДКЛЮЧЕНИЯ
             </div>
             <button onClick={onClose} className="w-full bg-red-700 hover:bg-red-600 text-white py-3 font-black font-orbitron uppercase tracking-wider transition-colors">
                 ЗАКРЫТЬ
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
        className={cn("relative block group cursor-pointer w-full mb-3", className)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
    >
      <div className={cn("absolute inset-0 bg-zinc-900/80 border-l-4 transition-all duration-200 skew-x-[-10deg]", hovered ? "border-red-500 bg-zinc-800 translate-x-2" : "border-zinc-700")} />
      <div className="relative flex items-center justify-between p-4 pl-6 z-10">
          <div className="flex items-center gap-4">
              <div className={cn("w-10 h-10 flex items-center justify-center bg-black/50 border border-zinc-700 transition-colors", hovered ? "border-red-500 text-white" : "text-zinc-500")}>
                  {Icon && <Icon className={cn("w-5 h-5", hovered && "text-red-500")} />}
              </div>
              <div className="flex flex-col">
                  <span className={cn("font-black font-orbitron text-xl tracking-widest leading-none transition-colors", hovered ? "text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" : "text-zinc-400")}>{label}</span>
                  <span className={cn("text-[10px] font-mono tracking-[0.2em] uppercase transition-colors", hovered ? "text-red-400" : "text-zinc-600")}>{subLabel}</span>
              </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 font-black text-2xl pr-4">&gt;&gt;</div>
      </div>
    </Container>
  );
};

export default function StrikeballDashboard() {
  const { tg, dbUser, activeLobby } = useAppContext(); 
  const router = useRouter();
  const [menuStep, setMenuStep] = useState<'main' | 'create'>('main');
  const [showQR, setShowQR] = useState(false);

  // --- GHOST VIS LOGIC ---
  const isLive = !!activeLobby;

  const handleQR = () => {
      if (tg && tg.showScanQrPopup) {
          tg.showScanQrPopup({ text: "СКАНИРУЙ КОД ОПЕРАЦИИ ИЛИ ПРОФИЛЯ" }, async (text: string) => { 
              tg.closeScanQrPopup();
              if (!text) return true;
              let param = text;
              if (text.includes('startapp=')) param = text.split('startapp=')[1].split('&')[0];

              if (param.startsWith('lobby_')) {
                  router.push(`/strikeball/lobbies/${param.replace('lobby_', '')}`);
                  toast.success("ОПЕРАЦИЯ ОБНАРУЖЕНА");
              } else if (param.startsWith('gear_')) {
                  const gearId = param.replace('gear_', '');
                  toast.loading("Обработка товара...");
                  try {
                      const { rentGear } = await import("./actions/market"); 
                      const res = await rentGear(dbUser?.user_id!, gearId);
                      if(res.success) toast.success("Счет отправлен!"); else toast.error(res.error);
                  } catch(e) { toast.error("Ошибка магазина"); }
              } else if (param.startsWith('capture_')) {
                  const checkpointId = param.replace('capture_', '');
                  toast.loading("Capturing...");
                  try {
                      const { captureCheckpoint } = await import("./actions/domination");
                      const res = await captureCheckpoint(dbUser?.user_id!, checkpointId);
                      if (res.success) toast.success(res.message); else toast.error(res.error);
                  } catch(e) { toast.error("Capture Error"); }
              } else if (param.startsWith('respawn_')) {
                  const parts = param.split('_');
                  const lobbyId = parts[1];
                  const targetTeam = parts[2] || 'neutral';
                  toast.loading("Обработка кода базы...");
                  try {
                      const { handleBaseInteraction } = await import("./actions/game");
                      const res = await handleBaseInteraction(lobbyId, dbUser?.user_id!, targetTeam);
                      if (res.success) toast.success(res.message); else toast.error(res.error);
                  } catch(e) { toast.error("Ошибка базы"); }
              } else {
                  toast.error("НЕИЗВЕСТНЫЙ КОД");
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

      <div className="text-center mb-12">
        <motion.h1 
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
            className={cn("font-black font-orbitron italic tracking-tighter uppercase", isLive ? "text-4xl text-white" : "text-6xl md:text-8xl text-zinc-200 drop-shadow-2xl")}
        >
          {isLive ? "GHOST_OS // v2.4" : <>STRIKE<span className="text-red-600">BALL</span></>}
        </motion.h1>
        {!isLive && (
            <p className="text-red-500/80 font-mono text-xs tracking-[0.5em] mt-2 border-t border-red-900/50 inline-block px-8 py-1">
            ТАКТИЧЕСКИЕ ОПЕРАЦИИ
            </p>
        )}
        {isLive && (
            <div className="mt-4 px-4 py-1 border border-red-600 bg-red-950/20 inline-block">
                <span className="text-red-500 font-bold animate-pulse text-[10px] font-mono tracking-[0.3em]">
                    ● SIGNAL_ACTIVE: {activeLobby.name.toUpperCase()}
                </span>
            </div>
        )}
      </div>

      <div className="max-w-md mx-auto">
        <div className="relative z-10">
            <AnimatePresence mode="wait">
              {menuStep === 'main' ? (
                <motion.div 
                  key="main"
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}
                  className="space-y-1"
                >
                  {/* PRIMARY COMBAT SCANNER (Highlighted in Live Mode) */}
                  <Q3MenuItem 
                        label="СКАНЕР (QR)" 
                        subLabel={isLive ? "ЗАХВАТ / ВОЗРОЖДЕНИЕ / ЦЕЛЬ" : "ПОДКЛЮЧЕНИЕ"}
                        onClick={handleQR} 
                        icon={FaQrcode}
                        className={cn(
                            "border-2 transition-all duration-500",
                            isLive ? "border-red-600 bg-red-950/20 animate-pulse scale-105 shadow-[0_0_30px_rgba(220,38,38,0.3)]" : "border-zinc-800"
                        )}
                   />

                  {/* RETURN TO OPS FRONT */}
                  {isLive && (
                      <Q3MenuItem 
                        label="ЦЕНТР УПРАВЛЕНИЯ" 
                        subLabel="HUD / КАРТА / ТЕЛЕМЕТРИЯ"
                        href={`/strikeball/lobbies/${activeLobby.id}`}
                        icon={FaShieldHalved}
                        className="border-l-4 border-emerald-500 bg-emerald-950/20 mt-4"
                      />
                  )}

                  {/* Operational Noise (Faded during active combat) */}
                  <div className={cn(
                      "transition-all duration-1000",
                      isLive ? "opacity-30 grayscale blur-[0.5px] pointer-events-none mt-12" : "mt-6"
                  )}>
                      <Q3MenuItem label="ПАТИ" subLabel="ПОИСК АКТИВНЫХ ОТРЯДОВ" href="/strikeball/lobbies" icon={FaUsers} />
                      {!isLive && <Q3MenuItem label="ТУРНИРЫ" subLabel="4x4 LEAGUE" href="/strikeball/tournaments" icon={FaTrophy} />}
                      <Q3MenuItem label="СОЗДАТЬ СЕРВЕР" subLabel="НОВАЯ ОПЕРАЦИЯ" onClick={() => setMenuStep('create')} icon={FaPlus} />
                      <Q3MenuItem label="АРСЕНАЛ" subLabel="АРЕНДА СНАРЯЖЕНИЯ" href="/strikeball/shop" icon={FaShieldHalved} />
                  </div>

                </motion.div>
              ) : (
                <motion.div
                  key="create"
                  initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                >
                  <div className="bg-black/80 p-6 mb-4 border-2 border-zinc-700 skew-x-[-2deg]">
                    <h3 className="text-red-500 mb-4 font-black uppercase border-b border-red-800 pb-2">Параметры Высадки</h3>
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