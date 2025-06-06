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
import { toast } from 'sonner';
import { ELON_SIMULATOR_CARD_ID, MISSION_SUPPORT_PRICE_XTR, ELON_SIMULATOR_ACCESS_PRICE_XTR } from '@/app/hotvibes/page'; // Assuming constants are exported

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
}

interface HotVibeCardProps {
  lead: HotLeadData;
  isMissionUnlocked: boolean;
  onExecuteMission: (leadId: string, questId: string | undefined) => void;
  onSupportMission: (lead: HotLeadData) => void; // Callback for supporting/buying access
  isSupported: boolean; // Passed from parent, if current user supports this mission/card
  isSpecial?: boolean; // To identify Elon card or other special cards
  onViewVip: (lead: HotLeadData) => void; // To open the VipLeadDisplay
  currentLang?: 'ru' | 'en';
  theme: HotVibeCardTheme;
  translations: Record<string, any>; // For button texts etc.
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

  const handleMainAction = () => {
    if (isElonSimulatorCard) {
        if (isSupported) {
            // Navigate to Elon page
            window.location.href = '/elon'; // Or use Next Router if preferred
        } else {
            onSupportMission(lead); // Buy access
        }
    } else { // Regular HotVibe lead
        if (isSupported) {
            onViewVip(lead); // Show VIP/Detail view
        } else {
            // If not supported, primary action is still to view details (which might offer support)
            // OR, if we want "Support" to be primary before details:
            onSupportMission(lead);
            // Then, if they want more details after supporting, they click again / or we auto-show VIP
        }
    }
  };
  
  const renderFooterButton = () => {
    if (isElonSimulatorCard) {
      if (isSupported) {
        return (
          <Button 
            onClick={() => window.location.href = '/elon'} // Or Next Router
            className={cn("w-full font-orbitron text-[0.65rem] sm:text-xs py-1 sm:py-1.5 rounded-md flex items-center justify-center text-center leading-tight bg-brand-orange text-black shadow-md")}
          >
            <VibeContentRenderer content={`::FaGamepad:: ${translations.goToSimulator}`} />
          </Button>
        );
      } else {
        return (
          <Button 
            onClick={() => onSupportMission(lead)}
            disabled={isPurchasePending || !isAuthenticated}
            className={cn("w-full font-orbitron text-[0.65rem] sm:text-xs py-1 sm:py-1.5 rounded-md flex items-center justify-center text-center leading-tight", theme.accentGradient, "text-black shadow-md", (isPurchasePending || !isAuthenticated) && "opacity-60 cursor-not-allowed")}
          >
            <VibeContentRenderer content={isPurchasePending ? "::FaSpinner className='animate-spin'::" : `::FaHandHoldingDollar:: ${translations.elonSimulatorAccessBtn}`} />
          </Button>
        );
      }
    } else { // Regular HotVibe lead
      if (isSupported) {
        return (
          <Button 
            onClick={() => onViewVip(lead)}
            className={cn("w-full font-orbitron text-[0.65rem] sm:text-xs py-1 sm:py-1.5 rounded-md flex items-center justify-center text-center leading-tight bg-brand-green text-black shadow-md")}
          >
            <VibeContentRenderer content={`::FaEye:: ${translations.supported} (${translations.viewDemo})`} />
          </Button>
        );
      } else {
        return (
          <Button 
            onClick={() => onSupportMission(lead)}
            disabled={isPurchasePending || !isAuthenticated}
            className={cn("w-full font-orbitron text-[0.65rem] sm:text-xs py-1 sm:py-1.5 rounded-md flex items-center justify-center text-center leading-tight", theme.accentGradient, "text-black shadow-md", (isPurchasePending || !isAuthenticated) && "opacity-60 cursor-not-allowed")}
          >
            <VibeContentRenderer content={isPurchasePending ? "::FaSpinner className='animate-spin'::" : `::FaHandHoldingDollar:: ${translations.supportMissionBtn}`} />
          </Button>
        );
      }
    }
  };


  return (
    // Removed DialogTrigger, Card itself will handle click for VIP view via onViewVip prop
    <Card 
      onClick={isSupported && !isElonSimulatorCard ? () => onViewVip(lead) : undefined} // Only allow direct click to VIP if supported & not Elon card
      className={cn(
        "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl border-2 bg-card/80 backdrop-blur-md shadow-lg transition-all duration-300 ease-in-out focus-within:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)] aspect-[3/4] sm:aspect-[4/5] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-red/70",
        isMissionUnlocked || isElonSimulatorCard || isSupported ? `${theme.borderColor} hover:${theme.borderColor.replace("/70", "")} hover:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)]` : "border-muted/30",
        (isSupported && !isElonSimulatorCard) ? "cursor-pointer hover:scale-105" : "cursor-default" // Make supported cards clickable to VIP
      )}
    >
        <div className="relative aspect-[3/2] w-full" onClick={isSupported && !isElonSimulatorCard ? () => onViewVip(lead) : undefined}>
          <Image
            src={imageToDisplayOnCard}
            alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover object-center group-hover:scale-105 transition-transform duration-300 ease-in-out"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE_CARD; }}
          />
          <div className={cn(
              "absolute inset-0 opacity-100 group-hover:opacity-60 transition-opacity duration-300 bg-gradient-to-t from-black/90 via-black/50 to-transparent",
              (isMissionUnlocked || isElonSimulatorCard || isSupported) ? "" : "bg-gray-900/50"
          )} />
          {(lead.status === 'client_responded_positive' || lead.status === 'interested') && !isElonSimulatorCard && (
            <div className="absolute top-1.5 right-1.5 bg-brand-red text-destructive-foreground text-[0.6rem] font-orbitron uppercase px-1.5 py-0.5 rounded-full shadow-md animate-pulse flex items-center gap-1">
              HOT! <VibeContentRenderer content="::FaFire className='w-2.5 h-2.5'::" />
            </div>
          )}
          {isSupported && (
             <div className="absolute top-1.5 left-1.5 bg-brand-green text-black text-[0.6rem] font-orbitron uppercase px-1.5 py-0.5 rounded-full shadow-md flex items-center gap-1">
                <VibeContentRenderer content="::FaCheckCircle className='w-2.5 h-2.5'::" /> {isElonSimulatorCard ? "Доступ Активен" : "Поддержано"}
              </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col justify-between p-2 sm:p-3 text-center" onClick={isSupported && !isElonSimulatorCard ? () => onViewVip(lead) : undefined}>
          <div>
            <h3 className={cn("font-orbitron text-xs sm:text-sm font-semibold leading-tight group-hover:text-brand-red transition-colors line-clamp-2", (isMissionUnlocked || isElonSimulatorCard || isSupported) ? "text-light-text" : "text-muted-foreground/70")} title={lead.kwork_gig_title || "Untitled Gig"}>
              {lead.kwork_gig_title || (currentLang === 'ru' ? "Без названия" : "Untitled Gig")}
            </h3>
            {lead.ai_summary && (
              <p className={cn("mt-0.5 text-[0.65rem] sm:text-xs line-clamp-2", (isMissionUnlocked || isElonSimulatorCard || isSupported) ? "text-muted-foreground" : "text-muted-foreground/50")} title={lead.ai_summary}>
                {lead.ai_summary}
              </p>
            )}
            {lead.client_response_snippet && !isElonSimulatorCard && (
              <p className="mt-0.5 text-[0.65rem] sm:text-xs font-mono text-brand-lime italic line-clamp-1">
                "{lead.client_response_snippet}"
              </p>
            )}
          </div>
          <div className="mt-1.5 text-[0.65rem] sm:text-xs font-mono">
            {lead.potential_earning && <span className={cn("font-semibold", (isMissionUnlocked || isElonSimulatorCard || isSupported) ? (isElonSimulatorCard ? "text-brand-orange" : "text-brand-green") : "text-muted-foreground/60")}>{lead.potential_earning}</span>}
          </div>
        </CardContent>
        
        <CardFooter className="p-2 sm:p-2.5 pt-0 mt-auto">
            {renderFooterButton()}
        </CardFooter>
    </Card>
    // Dialog for VIP/Details is removed, parent page will handle showing VipLeadDisplay
  );
}