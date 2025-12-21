"use client";

import { cn } from "@/lib/utils";
import { 
  FaSkull, 
  FaHeartPulse, 
  FaRobot, 
  FaUserAstronaut, 
  FaCheckDouble, 
  FaXmark, 
  FaPlus, 
  FaGun, 
  FaShieldHalved, 
  FaMicrochip, 
  FaKitMedical,
  FaUserPlus,
  FaCrown
} from "react-icons/fa6";

// Типизация данных снаряжения
interface GearItem {
  item_name: string;
  item_type?: string; // 'weapon' | 'gear' | 'gadget' | 'consumable'
}

interface Member {
  id: string;
  user_id: string | null;
  is_bot: boolean;
  role: string;
  status: string; 
  team: string;
  user?: {
    username?: string;
    photo_url?: string;
    avatar_url?: string;
  };
  gear?: GearItem[];
  metadata?: {
    safety_signed?: boolean;
    vote?: string;
  };
}

interface SquadRosterProps {
  teamName: string;
  teamColor: 'red' | 'blue';
  members: Member[];
  onAddBot?: () => void;
  onInvite?: () => void;
  onKick?: (id: string) => void;
  currentUserId?: string;
  isOwner?: boolean; 
}

export const SquadRoster = ({ 
  teamName, 
  teamColor, 
  members, 
  onAddBot, 
  onInvite, 
  onKick, 
  currentUserId,
  isOwner 
}: SquadRosterProps) => {
  const isRed = teamColor === 'red';
  
  // Хелпер для отрисовки тактических иконок снаряжения
  const renderGearIcons = (gear: GearItem[]) => {
    if (!gear || gear.length === 0) return null;

    const gearCounts = gear.reduce((acc: Record<string, number>, item) => {
      const type = item.item_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {gearCounts.weapon && (
          <div className="flex items-center gap-1 bg-red-950/40 px-1.5 py-0.5 rounded border border-red-900/50 text-[7px] font-bold text-red-500 uppercase">
            <FaGun size={7} /> {gearCounts.weapon > 1 ? `x${gearCounts.weapon}` : 'ОРУЖИЕ'}
          </div>
        )}
        {gearCounts.gear && (
          <div className="flex items-center gap-1 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-900/50 text-[7px] font-bold text-cyan-400 uppercase">
            <FaShieldHalved size={7} /> {gearCounts.gear > 1 ? `x${gearCounts.gear}` : 'СНАРЯГА'}
          </div>
        )}
        {gearCounts.consumable && (
          <div className="flex items-center gap-1 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/50 text-[7px] font-bold text-emerald-500 uppercase">
            <FaKitMedical size={7} /> {gearCounts.consumable > 1 ? `x${gearCounts.consumable}` : 'РАСХОДНИКИ'}
          </div>
        )}
        {gearCounts.gadget && (
          <div className="flex items-center gap-1 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/50 text-[7px] font-bold text-brand-gold uppercase">
            <FaMicrochip size={7} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      "flex-1 flex flex-col bg-black border-t-2 transition-all duration-300", 
      isRed ? "border-red-900" : "border-blue-900"
    )}>
      {/* ТАКТИЧЕСКИЙ ЗАГОЛОВОК */}
      <div className={cn(
        "px-4 py-3 font-black text-[10px] uppercase tracking-widest flex justify-between items-center border-b border-zinc-900", 
        isRed ? "text-red-500 bg-red-950/20" : "text-blue-400 bg-blue-950/20"
      )}>
        <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rotate-45", isRed ? "bg-red-600" : "bg-blue-600")} />
            <span>{isRed ? "КРАСНЫЕ" : "СИНИЕ"} // {teamName}</span>
        </div>
        <span className="font-mono opacity-60">
          {members.filter(m => m.status === 'alive').length}/{members.length} В БОЮ
        </span>
      </div>

      {/* РОСТЕР ЛИЧНОГО СОСТАВА */}
      <div className="flex-1 divide-y divide-zinc-900">
        {members.length === 0 && (
          <div className="p-10 text-center font-mono text-[9px] text-zinc-700 italic uppercase tracking-[0.3em] animate-pulse">
            Ожидание_Высадки_Десанта...
          </div>
        )}
        
        {members.map((m) => {
            const isMe = m.user_id === currentUserId;
            const isDead = m.status === 'dead';
            const isReady = m.metadata?.safety_signed && m.metadata?.vote === 'ok';
            const avatar = m.user?.avatar_url || m.user?.photo_url;
            const canBeKicked = onKick && (m.is_bot || (isOwner && !isMe));

            return (
                <div 
                  key={m.id} 
                  className={cn(
                    "flex items-center justify-between p-3 transition-all relative group", 
                    "hover:bg-zinc-900/40 active:bg-zinc-800",
                    isMe && "bg-white/[0.05]"
                  )}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Лазерный статус-маркер */}
                        <div className={cn(
                          "w-1 h-5 rounded-full shadow-[0_0_8px_currentColor] shrink-0 transition-opacity", 
                          isRed ? "text-red-600 bg-red-600" : "text-blue-600 bg-blue-600",
                          isDead && "opacity-30"
                        )} />

                        {/* КОНТЕЙНЕР ПРОФИЛЯ (Без overflow-hidden, чтобы не резать корону) */}
                        <div className="w-10 h-10 shrink-0 relative">
                            {/* Внутренний круг с аватаром (тут overflow-hidden нужен) */}
                            <div className={cn(
                              "w-full h-full bg-zinc-900 border border-zinc-800 overflow-hidden flex items-center justify-center transition-all",
                              isDead && "opacity-40 grayscale"
                            )}>
                                {avatar ? (
                                  <img src={avatar} alt="P" className="w-full h-full object-cover" />
                                ) : (
                                  m.is_bot ? <FaRobot className="text-zinc-600" /> : <FaUserAstronaut className={cn(isMe ? "text-brand-cyan" : "text-zinc-500")} />
                                )}
                            </div>
                            
                            {/* Значок Владельца (Теперь снаружи overflow-hidden, виден полностью) */}
                            {m.role === 'owner' && (
                              <div className="absolute -top-1.5 -right-1.5 bg-black rounded-full p-1 border border-brand-gold z-20 shadow-lg shadow-black">
                                <FaCrown className="text-brand-gold text-[7px]" />
                              </div>
                            )}
                        </div>
                        
                        {/* Инфо-блок */}
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <span className={cn(
                                  "font-bold text-[12px] leading-none uppercase truncate tracking-tight transition-opacity", 
                                  isMe ? "text-brand-cyan" : "text-zinc-100",
                                  isDead && "opacity-60 line-through" 
                                )}>
                                    {m.is_bot ? `БОТ_${m.id.slice(0,4)}` : (m.user?.username || 'РЕКРУТ')}
                                </span>
                                {isReady && <FaCheckDouble className="text-green-500 text-[10px] shrink-0" title="ГОТОВ" />}
                            </div>
                            
                            {/* Снаряжение */}
                            <div className={cn("transition-opacity", isDead && "opacity-40")}>
                              {renderGearIcons(m.gear || [])}
                            </div>

                            <span className="text-[7px] font-mono text-zinc-600 mt-1 uppercase tracking-tighter">
                              СИГНАЛ: {Math.floor(Math.random()*40)+10}MS // {isDead ? 'КРИТИЧЕСКИЙ' : 'СТАБИЛЬНЫЙ'}
                            </span>
                        </div>
                    </div>

                    {/* Правый блок: Статус жизни и действия */}
                    <div className="flex items-center gap-4">
                        <div className="w-4 flex justify-center">
                          {isDead ? (
                            <FaSkull className="text-red-900 text-xs" />
                          ) : (
                            <FaHeartPulse className="text-emerald-900 text-xs animate-pulse" />
                          )}
                        </div>

                        {canBeKicked && (
                            <button 
                              onClick={() => onKick && onKick(m.id)} 
                              className="text-zinc-800 hover:text-red-600 active:text-red-500 transition-colors p-1.5 bg-zinc-950/50 border border-transparent hover:border-red-900/50"
                              title="Исключить"
                            >
                              <FaXmark size={14}/>
                            </button>
                        )}
                    </div>
                </div>
            )
        })}
      </div>

      {/* КНОПКИ УПРАВЛЕНИЯ ОТРЯДOМ */}
      <div className="grid grid-cols-2 gap-px bg-zinc-900 border-t border-zinc-900">
          {onAddBot && (
              <button 
                onClick={onAddBot} 
                className="py-4 bg-black text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:text-white active:text-white hover:bg-zinc-950 active:bg-zinc-900 transition-all flex items-center justify-center gap-2"
              >
                  <FaPlus size={8} /> Добавить_Бота
              </button>
          )}
          {onInvite && (
              <button 
                onClick={onInvite} 
                className="py-4 bg-black text-zinc-600 text-[10px] font-black uppercase tracking-widest hover:text-brand-cyan active:text-brand-cyan hover:bg-zinc-950 active:bg-zinc-900 transition-all flex items-center justify-center gap-2 border-l border-zinc-900"
              >
                  <FaUserPlus size={10} /> Вербовка
              </button>
          )}
      </div>
    </div>
  );
};