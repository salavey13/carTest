"use client";

import { DominationHUD } from "../../../components/DominationHUD";
import { LiveHUD } from "../../../components/LiveHUD";
import { CommandConsole } from "../../../components/CommandConsole";
import { PlanningPanel } from "./PlanningPanel";
import { FaUserShield } from "react-icons/fa6";

export function CombatHUD({ lobby, isOwner, members, loadData, dbUser, isAdmin }: any) {
    const userMember = members?.find((m: any) => m.user_id === dbUser?.user_id);
    const isCommander = isOwner || isAdmin;

    return (
        <div className="space-y-4">
            {/* Панель планирования (PlanningPanel) показывает в статусе 'open' */}
            {/* Панель планирования показывается только в статусе 'open' И только если нет активного предложения от провайдера */}
            {/* Логика: Если есть провайдер (approval_status === 'proposed'), то голосование по дате скрывается */}
            {/* И показываются кнопки управления провайдером (в CommandConsole) */}
            {lobby.status === 'open' && (
                <PlanningPanel 
                    lobby={lobby} 
                    userMember={userMember} 
                    dbUser={dbUser}
                    loadData={loadData} 
                />
            )}

            {/* Телеметрия боя / Обратный отсчет */}
            <DominationHUD lobbyId={lobby.id} />
            <LiveHUD 
                startTime={lobby.status === 'active' ? lobby.metadata?.actual_start_at : lobby.start_at} 
                score={lobby.metadata?.score || {red:0, blue:0}} 
                status={lobby.status}
            />

            {/* Консоль командира (Владелец или Админ системы) */}
            {isCommander && (
                <div className="space-y-4 pt-10 border-t border-zinc-900">
                    {/* PASSING providerId to CommandConsole */}
                    <CommandConsole 
                        lobbyId={lobby.id}
                        providerId={lobby.provider_id}
                        userId={dbUser!.user_id} 
                        status={lobby.status} 
                        score={lobby.metadata?.score || {red:0, blue:0}} 
                        lobby={lobby}
                        isAdmin={isAdmin}
                        onLoad={loadData}
                    />
                </div>
            )}
        </div>
    );
}