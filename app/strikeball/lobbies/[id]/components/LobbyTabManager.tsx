"use client";

import React, { useMemo } from "react";
import { SquadRoster } from "../../../components/SquadRoster";
import { CombatHUD } from "./CombatHUD";
import { BattleReportView } from "../../../components/BattleReportView";
import { DrinkRoyaleMap } from "./DrinkRoyaleMap";
import { MapTab } from "./MapTab";
import { LogisticsPanel } from "./LogisticsPanel";
import { SafetyBriefing } from "../../../components/SafetyBriefing";
import { ProviderOffers } from "./ProviderOffers";
import { addNoobBot, removeMember } from "../../../actions/lobby";
import { updateTransportStatus, joinCar, signSafetyBriefing } from "../../../actions/logistics";
import { PointOfInterest, MapBounds } from "@/components/VibeMap";

const CITY_BOUNDS: MapBounds = { top: 56.4242, bottom: 56.08, left: 43.66, right: 44.1230 };

export function LobbyTabManager({ activeTab, lobby, members, dbUser, isOwner, isAdmin, loadData }: any) {
  const isDrinkRoyale = lobby.mode === 'DRINKNIGHT ROYALE';
  const userMember = members.find((m: any) => m.user_id === dbUser?.user_id);

  // Генерируем данные карты из field_id (GPS координаты)
  const mapData = useMemo(() => {
    if (!lobby?.field_id) return null;
    try {
        const coords = lobby.field_id.split(',').map(Number);
        const points: PointOfInterest[] = [{ 
            id: 'target', 
            name: 'ЦЕЛЬ_ОПЕРАЦИИ', 
            type: 'point', 
            coords: [coords as [number, number]], 
            icon: '::FaFlag::', 
            color: 'bg-red-600' 
        }];
        return { points, bounds: CITY_BOUNDS };
    } catch (e) { return null; }
  }, [lobby.field_id]);

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
        : <MapTab mapData={mapData} fieldId={lobby.field_id} />;

    case 'logistics':
      return (
        <LogisticsPanel 
          userMember={userMember} 
          members={members} 
          onToggleDriver={(role: string, seats: number, carName: string) => updateTransportStatus(userMember.id, { role, seats, car_name: carName }).then(loadData)}
          onJoinCar={(dId: string) => joinCar(userMember.id, dId).then(loadData)}
        />
      );

    case 'safety':
      return <SafetyBriefing onComplete={(data: any) => signSafetyBriefing(userMember.id, data).then(loadData)} isSigned={!!userMember?.metadata?.safety_signed} />;

    default:
      return null;
  }
}