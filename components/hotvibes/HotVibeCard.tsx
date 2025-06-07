"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
    Card, 
    CardContent, 
    CardFooter, 
} from '@/components/ui/card';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { ELON_SIMULATOR_CARD_ID } from '@/app/hotvibes/page'; 

export interface HotLeadData {
  id: string;
  kwork_gig_title?: string | null;
  ai_summary?: string | null;
  demo_image_url?: string | null;
  potential_earning?: string | null;
  required_kilovibes?: number | null;
  required_quest_id?: string | null;
  client_response_snippet?: string | null;
  kwork_url?: string | null;
  project_description?: string | null;
  ai_generated_proposal_draft?: string | null;
  status?: string;
  project_type_guess?: string | null;
  client_name?: string | null;
}

export interface HotVibeCardTheme {
  borderColor: string; 
  accentGradient: string; 
  shadowColor?: string; 
  hoverBorderColor?: string; 
  hoverShadowColor?: string; 
  textColor?: string; 
}

interface HotVibeCardProps {
  lead: HotLeadData;
  isMissionUnlocked: boolean;
  onExecuteMission: (leadId: string, questId: string | undefined) => void;
  onSupportMission: (lead: HotLeadData) => void; 
  isSupported: boolean; 
  isSpecial?: boolean; 
  onViewVip: (lead: HotLeadData) => void; 
  currentLang?: 'ru' | 'en';
  theme: HotVibeCardTheme;
  translations: Record<string, any>; 
  isPurchasePending: boolean;
  isAuthenticated: boolean;
}

const PLACEHOLDER_IMAGE_CARD = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png"; 

export function HotVibeCard({ 
    lead, 
    isMissionUnlocked, 
    onExecuteMission, 
    onSupportMission,
    isSupported,
    isSpecial,
    onViewVip,
    currentLang = 'ru', 
    theme, 
    translations,
    isPurchasePending,
    isAuthenticated
}: HotVibeCardProps) {
  
  const imageToDisplayOnCard = lead.demo_image_url || PLACEHOLDER_IMAGE_CARD;
  const isElonSimulatorCard = lead.id === ELON_SIMULATOR_CARD_ID;

  const effectiveBorderColor = theme.borderColor || "border-transparent";
  const effectiveHoverBorderColor = theme.hoverBorderColor || theme.borderColor?.replace("/70", "") || "hover:border-transparent";
  const effectiveShadowColor = theme.shadowColor || "shadow-md"; 
  const effectiveHoverShadowColor = theme.hoverShadowColor || `hover:shadow-xl`; 
  const effectiveTextColor = theme.textColor || "group-hover:text-brand-red";

  const renderFooterButton = () => {
    const buttonBaseClasses = "w-full font-orbitron text-[0.65rem] sm:text-xs py-2 sm:py-2.5 rounded-lg flex items-center justify-center text-center leading-tight shadow-md transition-all duration-200 ease-in-out transform group-hover:scale-105";
    const disabledClasses = (isPurchasePending || !isAuthenticated) ? "opacity-60 cursor-not-allowed !scale-100" : "";

    if (isElonSimulatorCard) {
      if (isSupported) {
        return (
          <Button 
            onClick={() => window.location.href = '/elon'}
            className={cn(buttonBaseClasses, "bg-brand-orange hover:bg-yellow-400 text-black", disabledClasses)}
          >
            <VibeContentRenderer content={`::FaGamepad className='mr-1.5':: ${translations.goToSimulatorText}`} />
          </Button>
        );
      } else {
        return (
          <Button 
            onClick={() => onSupportMission(lead)}
            disabled={isPurchasePending || !isAuthenticated}
            className={cn(buttonBaseClasses, "bg-gradient-to-r from-yellow-400 via-brand-orange to-orange-600 hover:brightness-110", "text-black", disabledClasses)}
          >
            <VibeContentRenderer content={isPurchasePending ? "::FaSpinner className='animate-spin'::" : `::FaHandHoldingDollar:: ${translations.elonSimulatorAccessBtnText}`} />
          </Button>
        );
      }
    } else { 
      if (isSupported) {
        return (
          <Button 
            onClick={() => onViewVip(lead)} 
            className={cn(buttonBaseClasses, "bg-brand-green hover:bg-green-400 text-black", disabledClasses)}
          >
            <VibeContentRenderer content={`::FaEye className='mr-1.5':: ${translations.supportedText} (${translations.viewDemoText})`} />
          </Button>
        );
      } else {
        return (
          <Button 
            onClick={() => onSupportMission(lead)}
            disabled={isPurchasePending || !isAuthenticated}
            className={cn(buttonBaseClasses, theme.accentGradient, "text-black hover:brightness-110", disabledClasses)}
          >
            <VibeContentRenderer content={isPurchasePending ? "::FaSpinner className='animate-spin'::" : `::FaHandHoldingDollar:: ${translations.supportMissionBtnText}`} />
          </Button>
        );
      }
    }
  };

  return (
    <Card 
      onClick={isSupported && !isElonSimulatorCard ? () => onViewVip(lead) : undefined}
      className={cn(
        "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl bg-black/70 backdrop-blur-md transition-all duration-300 ease-in-out aspect-[3/4] sm:aspect-[4/5]",
        effectiveBorderColor, 
        effectiveShadowColor,
        (isMissionUnlocked || isElonSimulatorCard || isSupported) 
          ? `${effectiveHoverBorderColor} ${effectiveHoverShadowColor} hover:scale-[1.03] hover:-translate-y-0.5` 
          : `${isSpecial ? theme.borderColor : 'border-muted/30'} opacity-80 hover:opacity-100`, // Заблокированные, но не специальные, имеют muted рамку
        (isSupported && !isElonSimulatorCard) ? "cursor-pointer" : "cursor-default"
      )}
    >
        <div className="relative aspect-[1/1] w-full overflow-hidden"> 
          <Image
            src={imageToDisplayOnCard}
            alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover object-center group-hover:scale-110 transition-transform duration-300 ease-in-out"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_CARD; }}
          />
          <div className={cn(
              "absolute inset-0 transition-opacity duration-300 bg-gradient-to-t from-black/80 via-black/40 to-transparent group-hover:opacity-80",
              (isMissionUnlocked || isElonSimulatorCard || isSupported) ? "opacity-60" : "bg-gray-900/60 opacity-80"
          )} />
          {(lead.status === 'client_responded_positive' || lead.status === 'interested') && !isElonSimulatorCard && (
            <div className="absolute top-1.5 right-1.5 bg-brand-red text-white text-[0.55rem] font-orbitron uppercase px-2 py-1 rounded-full shadow-lg animate-pulse flex items-center gap-1 ring-1 ring-white/30">
              HOT <VibeContentRenderer content="::FaFireAlt className='w-2.5 h-2.5'::" />
            </div>
          )}
          {isSupported && (
             <div className="absolute top-1.5 left-1.5 bg-brand-green text-black text-[0.55rem] font-orbitron uppercase px-2 py-1 rounded-full shadow-lg flex items-center gap-1 ring-1 ring-black/20">
                <VibeContentRenderer content="::FaCheckCircle className='w-3 h-3'::" /> 
                <span className="leading-none">{isElonSimulatorCard ? "Доступен" : "Поддержано"}</span>
              </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col justify-between p-2.5 sm:p-3 text-center space-y-1.5">
          <div className="min-h-[3.5em] sm:min-h-[4em]"> 
            <h3 
              className={cn(
                "font-orbitron text-sm sm:text-base font-bold leading-tight transition-colors line-clamp-2", 
                (isMissionUnlocked || isElonSimulatorCard || isSupported) ? `text-light-text ${effectiveTextColor}` : "text-muted-foreground/80"
              )} 
              title={lead.kwork_gig_title || "Untitled Gig"}
            >
              {lead.kwork_gig_title || (currentLang === 'ru' ? "Без названия" : "Untitled Gig")}
            </h3>
            {lead.ai_summary && (
              <p 
                className={cn(
                    "mt-1 text-[0.6rem] sm:text-[0.7rem] leading-snug line-clamp-2", 
                    (isMissionUnlocked || isElonSimulatorCard || isSupported) ? "text-gray-400 group-hover:text-gray-300" : "text-gray-500/80"
                )} 
                title={lead.ai_summary}
              >
                {lead.ai_summary}
              </p>
            )}
          </div>
          <div className="text-[0.7rem] sm:text-xs font-orbitron font-semibold">
            {lead.potential_earning && 
                <span className={cn(
                    (isMissionUnlocked || isElonSimulatorCard || isSupported) 
                        ? (isElonSimulatorCard ? "text-brand-orange" : "text-brand-green text-glow") 
                        : "text-muted-foreground/70"
                )}>
                    {lead.potential_earning}
                </span>
            }
          </div>
        </CardContent>
        
        <CardFooter className="p-2 sm:p-2.5 pt-0 mt-auto">
            {renderFooterButton()}
        </CardFooter>
    </Card>
  );
}