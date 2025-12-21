"use client";

import { cn } from "@/lib/utils";
import { FaQrcode } from "react-icons/fa6";

export function LobbyFooter({ status, userMember, onHit, onRespawn, onJoinTeam }: any) {
    return (
        <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-50 pointer-events-none space-y-4">
            {userMember && status === 'active' && (
                userMember.status === 'alive' ? (
                    <button 
                        onClick={onHit} 
                        className="pointer-events-auto w-full bg-white text-black font-black py-6 uppercase tracking-[0.4em] border-4 border-black outline outline-1 outline-white text-xl shadow-[0_0_50px_rgba(255,255,255,0.2)] active:scale-95 transition-all"
                    >
                        УБИТ_В_БОЮ
                    </button>
                ) : (
                    <button 
                        onClick={onRespawn} 
                        className="pointer-events-auto w-full bg-white text-black font-black py-6 uppercase tracking-[0.4em] border-4 border-black outline outline-1 outline-white text-xl flex items-center justify-center gap-4 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]"
                    >
                        <FaQrcode /> ВОЗРОЖДЕНИЕ
                    </button>
                )
            )}

            {status === 'open' && (
                <div className="pointer-events-auto grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 shadow-2xl">
                    <button 
                        onClick={() => onJoinTeam('blue')} 
                        className={cn(
                            "py-4 font-black uppercase text-[10px] tracking-widest transition-colors", 
                            userMember?.team === 'blue' ? "bg-zinc-700 text-white pointer-events-none" : "bg-black text-zinc-600 hover:bg-zinc-950"
                        )}
                    >
                        {userMember?.team === 'blue' ? "[ В_СИНИХ_СИЛАХ ]" : "ВСТУПИТЬ_К_СИНИМ"}
                    </button>
                    <button 
                        onClick={() => onJoinTeam('red')} 
                        className={cn(
                            "py-4 font-black uppercase text-[10px] tracking-widest transition-colors", 
                            userMember?.team === 'red' ? "bg-zinc-700 text-white pointer-events-none" : "bg-black text-zinc-600 hover:bg-zinc-950"
                        )}
                    >
                        {userMember?.team === 'red' ? "[ В_КРАСНОЙ_ЯЧЕЙКЕ ]" : "ВСТУПИТЬ_К_КРАСНЫМ"}
                    </button>
                </div>
            )}
        </div>
    );
}