"use client";

import { SquadRoster } from "../../components/SquadRoster";
import { CombatHUD } from "./CombatHUD";
import { BattleReportView } from "../../components/BattleReportView";
import { DrinkRoyaleMap } from "./DrinkRoyaleMap";
import { MapTab } from "./MapTab";
import { LogisticsPanel } from "../../components/LogisticsPanel";
import { SafetyBriefing } from "../../components/SafetyBriefing";
import { ProviderOffers } from "./ProviderOffers";
import { addNoobBot, removeMember } from "../../actions/lobby";
import { updateTransportStatus, joinCar, signSafetyBriefing } from "../../actions/logistics";

export function LobbyTabManager({ activeTab, lobby, members, dbUser, isOwner, isAdmin, loadData }: any) {
  const isDrinkRoyale = lobby.mode === 'DRINKNIGHT ROYALE';

  switch (activeTab) {
    case 'roster':
      return (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-zinc-900 border border-zinc-900">
            <SquadRoster teamName="ALPHA" teamColor="blue" members={members.filter((m: any) => m.team === 'blue')} onAddBot={isOwner ? () => addNoobBot(lobby.id, 'blue').then(loadData) : undefined} onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} currentUserId={dbUser?.user_id} isOwner={isOwner} />
            <SquadRoster teamName="BRAVO" teamColor="red" members={members.filter((m: any) => m.team === 'red')} onAddBot={isOwner ? () => addNoobBot(lobby.id, 'red').then(loadData) : undefined} onKick={isOwner ? (id: string) => removeMember(id).then(loadData) : undefined} currentUserId={dbUser?.user_id} isOwner={isOwner} />
          </div>
          {lobby.status === 'open' && (
            <ProviderOffers lobbyId={lobby.id} playerCount={members.length} selectedProviderId={lobby.provider_id} selectedServiceId={lobby.metadata?.selected_offer?.serviceId} />
          )}
        </div>
      );

    case 'game':
      return lobby.status === 'finished' 
        ? <BattleReportView lobby={lobby} members={members} checkpoints={[]} />
        : <CombatHUD lobby={lobby} isOwner={isOwner} members={members} loadData={loadData} dbUser={dbUser} isAdmin={isAdmin} />;

    case 'map':
      return isDrinkRoyale 
        ? <DrinkRoyaleMap lobby={lobby} members={members} dbUser={dbUser} />
        : <MapTab fieldId={lobby.field_id} />;

    case 'logistics':
      const userMember = members.find((m: any) => m.user_id === dbUser?.user_id);
      return (
        <LogisticsPanel 
          userMember={userMember} members={members} 
          onToggleDriver={(role: string, seats: number, name: string) => updateTransportStatus(userMember.id, { role, seats, car_name: name }).then(loadData)}
          onJoinCar={(dId: string) => joinCar(userMember.id, dId).then(loadData)}
        />
      );

    case 'safety':
      const me = members.find((m: any) => m.user_id === dbUser?.user_id);
      return <SafetyBriefing onComplete={(data: any) => signSafetyBriefing(me.id, data).then(loadData)} isSigned={!!me?.metadata?.safety_signed} />;

    default:
      return null;
  }
}