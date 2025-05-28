// /components/hotvibes/HotVibeCard.tsx
"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { FaXmark } from "react-icons/fa6";

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
  // Add any other relevant fields from your 'leads' table
}

interface HotVibeCardProps {
  lead: HotLeadData;
  isMissionUnlocked: boolean;
  onExecuteMission: (leadId: string, questId: string | undefined) => void;
  currentLang?: 'ru' | 'en';
}

const PLACEHOLDER_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png";

export function HotVibeCard({ lead, isMissionUnlocked, onExecuteMission, currentLang = 'ru' }: HotVibeCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const imageToDisplay = lead.demo_image_url || PLACEHOLDER_IMAGE;

  const handleExecuteClick = () => {
    onExecuteMission(lead.id, lead.required_quest_id);
  };

  const tModal = {
    ru: { viewOriginal: "Смотреть Оригинал", clientSays: "Клиент говорит:", draftOffer: "Черновик Оффера:", fullDescription: "Полное Описание:", executeMission: "::FaBolt:: Выполнить Миссию Огня!", skillLocked: "::FaLock:: Навык Заблокирован", close: "Закрыть" },
    en: { viewOriginal: "View Original", clientSays: "Client says:", draftOffer: "Draft Offer:", fullDescription: "Full Description:", executeMission: "::FaBolt:: Execute Live Fire Mission!", skillLocked: "::FaLock:: Skill Locked", close: "Close" }
  };
  const modalText = tModal[currentLang];

  return (
    <Card className="hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl border-2 border-card bg-card/90 shadow-lg transition-all duration-300 ease-in-out hover:border-brand-red hover:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)] focus-within:border-brand-red focus-within:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)] aspect-[3/4] sm:aspect-[4/5] backdrop-blur-sm">
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <div className="relative aspect-square w-full cursor-pointer overflow-hidden rounded-t-lg">
            <Image
              src={imageToDisplay}
              alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-110"
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-100 group-hover:opacity-70 transition-opacity duration-300" />
            {lead.status?.includes('client_responded') && (
              <div className="absolute top-1.5 right-1.5 bg-brand-red text-destructive-foreground text-[0.6rem] font-orbitron uppercase px-1.5 py-0.5 rounded-full shadow-md animate-pulse flex items-center gap-1">
                HOT! <VibeContentRenderer content="::FaFire className='w-2.5 h-2.5'::" />
              </div>
            )}
          </div>
        </DialogTrigger>

        <CardContent className="flex flex-1 flex-col justify-between p-2.5 sm:p-3 text-center">
          <div>
            <h3 className="font-orbitron text-xs sm:text-sm font-semibold leading-tight text-light-text group-hover:text-brand-red transition-colors line-clamp-2" title={lead.kwork_gig_title || "Untitled Gig"}>
              {lead.kwork_gig_title || (currentLang === 'ru' ? "Без названия" : "Untitled Gig")}
            </h3>
            {lead.ai_summary && (
              <p className="mt-1 text-[0.65rem] sm:text-xs text-muted-foreground line-clamp-2" title={lead.ai_summary}>
                {lead.ai_summary}
              </p>
            )}
            {lead.client_response_snippet && (
              <p className="mt-1 text-[0.65rem] sm:text-xs font-mono text-brand-lime italic line-clamp-1">
                "{lead.client_response_snippet}"
              </p>
            )}
          </div>
          <div className="mt-2 text-[0.65rem] sm:text-xs font-mono">
            {lead.potential_earning && <span className="text-brand-green font-semibold">{lead.potential_earning}</span>}
            {lead.required_kilovibes > 0 && <span className="ml-1.5 text-brand-purple">{lead.required_kilovibes} KV</span>}
          </div>
        </CardContent>

        <CardFooter className="p-2 sm:p-2.5 pt-0">
          <Button
            onClick={handleExecuteClick}
            disabled={!isMissionUnlocked}
            variant="default"
            size="sm"
            className={cn(
              "w-full font-orbitron text-[0.7rem] sm:text-xs py-1.5 sm:py-2",
              isMissionUnlocked ? "bg-brand-red text-destructive-foreground hover:bg-brand-red/90 active:scale-95" : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <VibeContentRenderer content={isMissionUnlocked ? (currentLang === 'ru' ? "::FaBolt:: Взять Миссию!" : "::FaBolt:: Take Mission!") : (currentLang === 'ru' ? "::FaLock:: Навык Закрыт" : "::FaLock:: Skill Locked")} />
          </Button>
        </CardFooter>

        <DialogContent className="hotvibe-modal max-w-3xl w-[95vw] sm:w-[90vw] md:w-[80vw] lg:w-[70vw] max-h-[90vh] bg-card/95 backdrop-blur-lg border-2 border-brand-cyan shadow-[0_0_35px_rgba(var(--brand-cyan-rgb),0.5)] p-0 flex flex-col simple-scrollbar rounded-xl">
          <DialogHeader className="p-4 sm:p-6 border-b border-border flex-shrink-0">
            <div className="flex justify-between items-start">
                <div>
                    <DialogTitle className="font-orbitron text-brand-cyan text-lg sm:text-xl lg:text-2xl line-clamp-2">{lead.kwork_gig_title || (currentLang === 'ru' ? "Детали Горячего Вайба" : "Hot Vibe Details")}</DialogTitle>
                    {lead.kwork_url && (
                    <DialogDescription>
                        <Link href={lead.kwork_url} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-brand-blue hover:underline flex items-center gap-1">
                         {modalText.viewOriginal} <VibeContentRenderer content="::FaArrowUpRightFromSquare::" />
                        </Link>
                    </DialogDescription>
                    )}
                </div>
                <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground -mt-1 -mr-1">
                        <FaXmark className="w-5 h-5" />
                        <span className="sr-only">{modalText.close}</span>
                    </Button>
                </DialogClose>
            </div>
          </DialogHeader>

          <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-4 font-mono simple-scrollbar">
            <div className="aspect-video relative w-full max-w-xl mx-auto rounded-lg overflow-hidden border-2 border-border shadow-lg">
              <Image
                src={imageToDisplay}
                alt={`Full demo for ${lead.kwork_gig_title || 'Hot Vibe Lead'}`}
                fill
                className="object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
              />
            </div>

            {lead.client_response_snippet && (
              <div className="bg-background/70 p-3 sm:p-4 rounded-lg border border-border">
                <p className="font-orbitron text-sm sm:text-md text-brand-lime mb-1.5">{modalText.clientSays}</p>
                <p className="text-sm text-light-text italic">"{lead.client_response_snippet}"</p>
              </div>
            )}

            {lead.project_description && (
              <div className="bg-background/70 p-3 sm:p-4 rounded-lg border border-border">
                <p className="font-orbitron text-sm sm:text-md text-brand-yellow mb-1.5">{modalText.fullDescription}</p>
                <div className="whitespace-pre-wrap text-xs sm:text-sm text-muted-foreground max-h-60 overflow-y-auto simple-scrollbar">
                  <VibeContentRenderer content={lead.project_description} />
                </div>
              </div>
            )}
            
            {lead.ai_generated_proposal_draft && (
              <div className="bg-background/70 p-3 sm:p-4 rounded-lg border border-border">
                <p className="font-orbitron text-sm sm:text-md text-brand-purple mb-1.5">{modalText.draftOffer}</p>
                <pre className="whitespace-pre-wrap text-xs sm:text-sm text-muted-foreground max-h-60 overflow-y-auto simple-scrollbar">{lead.ai_generated_proposal_draft}</pre>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 border-t border-border flex-shrink-0">
            <Button
              onClick={handleExecuteClick}
              disabled={!isMissionUnlocked}
              variant="default"
              size="lg"
              className={cn(
                "w-full font-orbitron text-sm sm:text-base py-3",
                isMissionUnlocked ? "bg-gradient-to-r from-brand-red via-brand-pink to-brand-orange text-white hover:brightness-110 active:scale-95" : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <VibeContentRenderer content={isMissionUnlocked ? modalText.executeMission : modalText.skillLocked} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}