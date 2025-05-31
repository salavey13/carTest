"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent as ShadCardContent, CardFooter, CardHeader as ShadCardHeader, CardTitle as ShadCardTitle, CardDescription as ShadCardDescription } from '@/components/ui/card'; // Renamed to avoid conflict
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  DialogClose, // Used for the single close button
} from '@/components/ui/dialog';
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { FaXmark } from "react-icons/fa6";
import { toast } from 'sonner';

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
  project_type_guess?: string | null; // Added for Mission Briefing
}

interface HotVibeCardTheme {
  borderColor: string;
  accentGradient: string;
  // Potentially more theme properties for modal background gradients, text colors etc.
  modalBgGradient?: string; // e.g., "from-black/80 via-brand-purple/60 to-black/90"
  modalAccentColor?: string; // e.g., "text-brand-cyan" for titles
}

interface HotVibeCardProps {
  lead: HotLeadData;
  isMissionUnlocked: boolean;
  onExecuteMission: (leadId: string, questId: string | undefined) => void;
  currentLang?: 'ru' | 'en';
  theme: HotVibeCardTheme; // Expect a theme object
}

const PLACEHOLDER_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png";

export function HotVibeCard({ lead, isMissionUnlocked, onExecuteMission, currentLang = 'ru', theme }: HotVibeCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const imageToDisplay = lead.demo_image_url || PLACEHOLDER_IMAGE;

  const handleExecuteClick = () => {
    onExecuteMission(lead.id, lead.required_quest_id);
    setIsModalOpen(false); // Close modal on action
  };
  
  const handleCopyToClipboard = (text: string | null | undefined, message: string) => {
    if (!text) {
      toast.error("Нет текста для копирования.");
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => toast.success(message))
      .catch(err => toast.error(`Ошибка копирования: ${err.message}`));
  };


  const tModal = {
    ru: { 
        viewOriginal: "Смотреть Оригинал", 
        clientSays: "Клиент говорит:", 
        draftOffer: "Черновик Оффера:", 
        fullDescription: "Полное Описание:", 
        executeMission: "::FaFireAlt className='mr-2':: Выполнить Миссию Огня!", 
        skillLocked: "::FaLock className='mr-2':: Навык Заблокирован", 
        close: "Закрыть",
        missionBriefing: "::FaListCheck className='mr-2':: Брифинг Миссии",
        budget: "Бюджет:",
        taskType: "Тип Задачи:",
        requiredSkill: "Требуемый Навык:",
        clientStatus: "Статус Клиента:",
        copyOffer: "Копировать Оффер",
     },
    en: { 
        viewOriginal: "View Original", 
        clientSays: "Client says:", 
        draftOffer: "Draft Offer:", 
        fullDescription: "Full Description:", 
        executeMission: "::FaFireAlt className='mr-2':: Execute Live Fire Mission!", 
        skillLocked: "::FaLock className='mr-2':: Skill Locked", 
        close: "Close",
        missionBriefing: "::FaListCheck className='mr-2':: Mission Briefing",
        budget: "Budget:",
        taskType: "Task Type:",
        requiredSkill: "Required Skill:",
        clientStatus: "Client Status:",
        copyOffer: "Copy Offer",
     }
  };
  const modalText = tModal[currentLang];
  const modalEffectiveBgGradient = theme.modalBgGradient || "from-black/80 via-brand-purple/70 to-black/90";


  return (
    <Card className={cn(
        "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl border-2 bg-card/80 backdrop-blur-md shadow-lg transition-all duration-300 ease-in-out focus-within:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)] aspect-[3/4] sm:aspect-[4/5]",
        isMissionUnlocked ? `${theme.borderColor} hover:${theme.borderColor.replace("/70", "")} hover:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)]` : "border-muted/30"
      )}
    >
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogTrigger asChild>
          <div className="relative aspect-[3/2] w-full cursor-pointer overflow-hidden rounded-t-lg"> {/* Changed aspect for portrait crop feel */}
            <Image
              src={imageToDisplay}
              alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover object-center group-hover:scale-105 transition-transform duration-300 ease-in-out" // object-center for portrait
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
            />
            <div className={cn(
                "absolute inset-0 bg-gradient-to-t opacity-100 group-hover:opacity-60 transition-opacity duration-300",
                isMissionUnlocked ? "from-black/80 via-black/30 to-transparent" : "from-gray-900/90 via-gray-800/50 to-transparent" // Darker if locked
            )} />
            {(lead.status === 'client_responded_positive' || lead.status === 'interested') && (
              <div className="absolute top-1.5 right-1.5 bg-brand-red text-destructive-foreground text-[0.6rem] font-orbitron uppercase px-1.5 py-0.5 rounded-full shadow-md animate-pulse flex items-center gap-1">
                HOT! <VibeContentRenderer content="::FaFire className='w-2.5 h-2.5'::" />
              </div>
            )}
          </div>
        </DialogTrigger>

        <CardContent className="flex flex-1 flex-col justify-between p-2 sm:p-3 text-center">
          <div>
            <h3 className={cn("font-orbitron text-xs sm:text-sm font-semibold leading-tight group-hover:text-brand-red transition-colors line-clamp-2", isMissionUnlocked ? "text-light-text" : "text-muted-foreground/70")} title={lead.kwork_gig_title || "Untitled Gig"}>
              {lead.kwork_gig_title || (currentLang === 'ru' ? "Без названия" : "Untitled Gig")}
            </h3>
            {lead.ai_summary && (
              <p className={cn("mt-0.5 text-[0.65rem] sm:text-xs line-clamp-2", isMissionUnlocked ? "text-muted-foreground" : "text-muted-foreground/50")} title={lead.ai_summary}>
                {lead.ai_summary}
              </p>
            )}
            {lead.client_response_snippet && (
              <p className="mt-0.5 text-[0.65rem] sm:text-xs font-mono text-brand-lime italic line-clamp-1">
                "{lead.client_response_snippet}"
              </p>
            )}
          </div>
          <div className="mt-1.5 text-[0.65rem] sm:text-xs font-mono">
            {lead.potential_earning && <span className={cn("font-semibold", isMissionUnlocked ? "text-brand-green" : "text-muted-foreground/60")}>{lead.potential_earning}</span>}
            {/* Required KiloVibes can be displayed if needed */}
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
              isMissionUnlocked ? `${theme.accentGradient} text-black hover:brightness-110 active:scale-95 shadow-md` : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <VibeContentRenderer content={isMissionUnlocked ? (currentLang === 'ru' ? "::FaBolt:: Взять Миссию!" : "::FaBolt:: Take Mission!") : (currentLang === 'ru' ? "::FaLock:: Навык Закрыт" : "::FaLock:: Skill Locked")} />
          </Button>
        </CardFooter>

        {/* MODAL CONTENT - IRRESISTIBLE SAUSAGE UNVEILING */}
        <DialogContent 
            className={cn(
            "hotvibe-modal max-w-3xl w-[95vw] sm:w-[90vw] md:w-[80vw] lg:w-[65vw] xl:w-[60vw] max-h-[90vh]",
            "bg-dark-card text-light-text p-0 overflow-hidden flex flex-col", 
            "border-2", theme.borderColor, `shadow-[0_0_35px_rgba(var(--brand-cyan-rgb),0.4)]` // Use a consistent theme accent for modal
            )}
        >
            <div className="absolute inset-0 z-0">
                {lead.demo_image_url && (
                    <Image
                        src={lead.demo_image_url}
                        alt="Mission Background"
                        fill
                        className="object-cover opacity-10 blur-sm" // Faded and blurred background
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                )}
                <div className={cn("absolute inset-0 opacity-90", modalEffectiveBgGradient)} />
            </div>

            <DialogHeader className="relative z-10 p-4 pt-5 sm:p-5 border-b border-white/10 flex-shrink-0">
                 <DialogClose asChild>
                    <Button variant="ghost" size="icon" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground w-8 h-8 p-1.5">
                        <FaXmark className="w-5 h-5" />
                        <span className="sr-only">{modalText.close}</span>
                    </Button>
                </DialogClose>
                <ShadCardTitle className={cn("font-orbitron text-lg sm:text-xl md:text-2xl line-clamp-2", theme.modalAccentColor || "text-brand-cyan", "text-glow-cyan")}>
                    {lead.client_name ? `${lead.client_name}: ${lead.kwork_gig_title}` : lead.kwork_gig_title || (currentLang === 'ru' ? "Детали Горячего Вайба" : "Hot Vibe Details")}
                </ShadCardTitle>
                {lead.kwork_url && (
                <ShadCardDescription className="pt-0.5">
                    <Link href={lead.kwork_url} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-brand-blue hover:underline flex items-center gap-1.5">
                        {modalText.viewOriginal} <VibeContentRenderer content="::FaArrowUpRightFromSquare className='w-3 h-3'::" />
                    </Link>
                </ShadCardDescription>
                )}
            </DialogHeader>

            <div className="relative z-10 flex-grow overflow-y-auto p-4 sm:p-5 space-y-4 font-mono simple-scrollbar">
                {lead.demo_image_url && (
                    <div className="aspect-video relative w-full max-w-lg mx-auto rounded-md overflow-hidden border border-white/15 shadow-lg mb-3">
                    <Image
                        src={imageToDisplay} // This will be the sharper version
                        alt={`Demo for ${lead.kwork_gig_title || 'Hot Vibe Lead'}`}
                        fill
                        className="object-contain" // Use contain to show the whole image
                        onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                    />
                    </div>
                )}

                {/* Mission Briefing Section */}
                <Card className="bg-black/40 backdrop-blur-sm border border-brand-cyan/30 p-3 sm:p-4">
                    <ShadCardHeader className="p-0 mb-2">
                        <ShadCardTitle className="text-sm sm:text-base font-orbitron text-brand-cyan flex items-center">
                        <VibeContentRenderer content={modalText.missionBriefing}/>
                        </ShadCardTitle>
                    </ShadCardHeader>
                    <ShadCardContent className="p-0 text-xs space-y-1 text-gray-300">
                        {lead.potential_earning && <p><VibeContentRenderer content="::FaMoneyBillWave className='text-brand-green':: "/>{modalText.budget} <span className="font-semibold">{lead.potential_earning}</span></p>}
                        {lead.project_type_guess && <p><VibeContentRenderer content="::FaLightbulb className='text-brand-yellow':: "/>{modalText.taskType} <span className="font-semibold">{lead.project_type_guess}</span></p>}
                        {lead.required_quest_id && <p><VibeContentRenderer content="::FaBoltLightning className='text-brand-orange':: "/>{modalText.requiredSkill} <span className="font-semibold">{lead.required_quest_id}</span></p>}
                        {lead.client_response_snippet && <p className="text-brand-lime"><VibeContentRenderer content="::FaCommentDots className='text-brand-lime':: "/>{modalText.clientStatus} <span className="font-semibold italic">"{lead.client_response_snippet}"</span></p>}
                    </ShadCardContent>
                </Card>

                {lead.project_description && (
                    <Card className="bg-black/40 backdrop-blur-sm border border-brand-purple/30">
                        <ShadCardHeader className="pt-3 pb-2 px-3 sm:px-4">
                        <ShadCardTitle className="text-sm sm:text-base font-orbitron text-brand-purple flex items-center">
                            <VibeContentRenderer content="::FaFileLines className='mr-2'::"/>{modalText.fullDescription}
                        </ShadCardTitle>
                        </ShadCardHeader>
                        <ShadCardContent className="p-3 sm:p-4 text-xs text-gray-300 whitespace-pre-wrap break-words max-h-40 sm:max-h-48 overflow-y-auto simple-scrollbar">
                        <VibeContentRenderer content={lead.project_description} />
                        </ShadCardContent>
                    </Card>
                )}
            
                {lead.ai_generated_proposal_draft && (
                     <Card className="bg-black/40 backdrop-blur-sm border border-brand-pink/30">
                        <ShadCardHeader className="pt-3 pb-2 px-3 sm:px-4 flex flex-row justify-between items-center">
                            <ShadCardTitle className="text-sm sm:text-base font-orbitron text-brand-pink flex items-center">
                                <VibeContentRenderer content="::FaPaperPlane className='mr-2'::"/>{modalText.draftOffer}
                            </ShadCardTitle>
                            <Button variant="ghost" size="icon" className="h-7 w-7 p-1 text-gray-400 hover:text-brand-pink" 
                                    onClick={() => handleCopyToClipboard(lead.ai_generated_proposal_draft, "Черновик оффера скопирован!")}>
                                <VibeContentRenderer content="::FaCopy::"/>
                            </Button>
                        </ShadCardHeader>
                        <ShadCardContent className="p-3 sm:p-4 text-xs text-gray-300 whitespace-pre-wrap break-words max-h-40 sm:max-h-48 overflow-y-auto simple-scrollbar">
                            {lead.ai_generated_proposal_draft}
                        </ShadCardContent>
                    </Card>
                )}
            </div>

            <div className="relative z-10 p-4 sm:p-5 border-t border-white/10 flex-shrink-0 mt-auto"> {/* Ensure CTA is at bottom */}
                <Button
                onClick={handleExecuteClick}
                disabled={!isMissionUnlocked}
                variant="default"
                size="lg"
                className={cn(
                    "w-full font-orbitron text-sm sm:text-base py-3 shadow-lg",
                    isMissionUnlocked ? `${theme.accentGradient} text-black hover:brightness-110 active:scale-95` : "bg-muted text-muted-foreground cursor-not-allowed"
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