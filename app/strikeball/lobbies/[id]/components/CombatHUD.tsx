"use client";

import { DominationHUD } from "../../components/DominationHUD";
import { LiveHUD } from "../../components/LiveHUD";
import { CommandConsole } from "../../components/CommandConsole";
import { AdminCheckpointPanel } from "../../components/AdminCheckpointPanel";

export function CombatHUD({ lobby, isOwner, loadData, dbUser }: any) {
    return (
        <div className="space-y-4">
            <DominationHUD lobbyId={lobby.id} />
            <LiveHUD 
                startTime={lobby.status === 'active' ? lobby.metadata?.actual_start_at : lobby.start_at} 
                score={lobby.metadata?.score || {red:0, blue:0}} 
                status={lobby.status}
            />
            {isOwner && (
                <div className="space-y-4 pt-10 border-t border-zinc-900">
                    <CommandConsole lobbyId={lobby.id} userId={dbUser!.user_id} status={lobby.status} score={lobby.metadata?.score || {red:0, blue:0}} />
                    <AdminCheckpointPanel lobbyId={lobby.id} onLoad={loadData} />
                </div>
            )}
        </div>
    );
}