"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader as ShadCardHeader, CardTitle as ShadCardTitle, CardDescription as ShadCardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { FaXmark, FaChevronDown, FaChevronUp, FaCopy } from "react-icons/fa6";
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
  project_type_guess?: string | null;
}

export interface HotVibeCardTheme {
  borderColor: string;
  accentGradient: string;
  modalOverlayGradient?: string;
  modalAccentColor?: string;
  modalCardBg?: string;
  modalCardBorder?: string;
  modalImageOverlayGradient?: string;
}

interface HotVibeCardProps {
  lead: HotLeadData;
  isMissionUnlocked: boolean;
  onExecuteMission: (leadId: string, questId: string | undefined) => void;
  currentLang?: 'ru' | 'en';
  theme: HotVibeCardTheme;
}

const PLACEHOLDER_IMAGE = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/bullshitemotions//pooh.png";
const MODAL_BACKGROUND_FALLBACK = "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/carpix/aPAQbwg_700b-62cff769-b043-4043-923d-76a1e9e4b71f.jpg";

export function HotVibeCard({ lead, isMissionUnlocked, onExecuteMission, currentLang = 'ru', theme }: HotVibeCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  
  const imageToDisplayOnCard = lead.demo_image_url || PLACEHOLDER_IMAGE;
  const imageForModalBackground = lead.demo_image_url || MODAL_BACKGROUND_FALLBACK;

  const handleExecuteClickInModal = () => {
    if (!isMissionUnlocked) {
        toast.error(modalText.skillLocked.replace(/::.*?::\s*/, "").trim() + " Требуется: " + (lead.required_quest_id || "Базовый навык"));
        return;
    }
    onExecuteMission(lead.id, lead.required_quest_id);
    setIsModalOpen(false);
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
        viewOriginal: "Смотреть Оригинал на KWork", 
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
        viewOriginal: "View Original on KWork", 
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
  const modalEffectiveOverlayGradient = theme.modalOverlayGradient || "from-black/80 via-brand-purple/70 to-black/90";
  const modalImageEffectiveOverlayGradient = theme.modalImageOverlayGradient || "bg-gradient-to-t from-black/90 via-black/50 to-transparent";

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <Card className={cn(
          "hot-vibe-card group relative flex flex-col overflow-hidden rounded-xl border-2 bg-card/80 backdrop-blur-md shadow-lg transition-all duration-300 ease-in-out focus-within:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)] aspect-[3/4] sm:aspect-[4/5]",
          isMissionUnlocked ? `${theme.borderColor} hover:${theme.borderColor.replace("/70", "")} hover:shadow-[0_0_25px_rgba(var(--brand-red-rgb),0.6)]` : "border-muted/30"
        )}
      >
        {/* DialogTrigger теперь оборачивает основное содержимое карточки, КРОМЕ футера */}
        <DialogTrigger asChild>
          <div className="flex flex-col flex-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 focus:ring-offset-card rounded-t-xl overflow-hidden">
            <div className="relative aspect-[3/2] w-full">
              <Image
                src={imageToDisplayOnCard}
                alt={lead.kwork_gig_title || 'Hot Vibe Lead'}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover object-center group-hover:scale-105 transition-transform duration-300 ease-in-out"
                onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
              />
              <div className={cn(
                  "absolute inset-0 opacity-100 group-hover:opacity-60 transition-opacity duration-300",
                  modalImageEffectiveOverlayGradient,
                  isMissionUnlocked ? "" : "bg-gray-900/50"
              )} />
              {(lead.status === 'client_responded_positive' || lead.status === 'interested') && (
                <div className="absolute top-1.5 right-1.5 bg-brand-red text-destructive-foreground text-[0.6rem] font-orbitron uppercase px-1.5 py-0.5 rounded-full shadow-md animate-pulse flex items-center gap-1">
                  HOT! <VibeContentRenderer content="::FaFire className='w-2.5 h-2.5'::" />
                </div>
              )}
            </div>

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
              </div>
            </CardContent>
          </div>
        </DialogTrigger>

        <CardFooter className="p-2 sm:p-2.5 pt-0">
          {/* Эта кнопка теперь тоже открывает модал, но через setIsModalOpen, а не как DialogTrigger */}
          <Button
            onClick={() => setIsModalOpen(true)}
            variant="default"
            size="sm"
            className={cn(
              "w-full font-orbitron text-[0.7rem] sm:text-xs py-1.5 sm:py-2",
              isMissionUnlocked ? `${theme.accentGradient} text-black hover:brightness-110 active:scale-95 shadow-md` : "bg-gray-600 text-gray-400 hover:bg-gray-500"
            )}
          >
            <VibeContentRenderer content={isMissionUnlocked ? (currentLang === 'ru' ? "::FaBolt:: Взять Миссию!" : "::FaBolt:: Take Mission!") : (currentLang === 'ru' ? "::FaLock:: Навык Закрыт (Инфо)" : "::FaLock:: Skill Locked (Info)")} />
          </Button>
        </CardFooter>
      </Card>

      {/* MODAL CONTENT - IRRESISTIBLE SAUSAGE UNVEILING - EPIC OVERHAUL */}
      <DialogContent 
          className={cn(
          "hotvibe-modal max-w-3xl w-[95vw] sm:w-[90vw] md:w-[80vw] lg:w-[500px] max-h-[95vh] sm:max-h-[85vh]",
          "bg-dark-card text-light-text p-0 overflow-hidden flex flex-col", 
          "border-2", theme.borderColor, `shadow-[0_0_50px_rgba(var(--brand-cyan-rgb),0.6)]`
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
      >
          <div className="relative w-full h-[40vh] sm:h-[45vh] flex-shrink-0 overflow-hidden group"> {/* Уменьшил высоту для большего баланса */}
              {imageForModalBackground && (
                  <Image
                      src={imageForModalBackground}
                      alt="Mission Epic Background"
                      fill
                      className="object-cover scale-105 group-hover:scale-110 transition-transform duration-500 ease-out"
                      priority
                      onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE; }}
                  />
              )}
              <div className={cn("absolute inset-0", modalImageEffectiveOverlayGradient, "opacity-100")} />
              
              <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex justify-between items-start z-20 bg-gradient-to-b from-black/80 via-black/50 to-transparent pb-12"> {/* Увеличил pb для градиента */}
                  <div className="flex-grow pr-2"> {/* Добавил pr-2, чтобы текст не прилипал к кнопке X */}
                      <ShadCardTitle className={cn("font-orbitron text-lg sm:text-xl md:text-2xl line-clamp-3 leading-tight", theme.modalAccentColor || "text-brand-cyan", "text-glow-cyan")}>
                          {lead.client_name ? `${lead.client_name}: ${lead.kwork_gig_title}` : lead.kwork_gig_title || (currentLang === 'ru' ? "Детали Горячего Вайба" : "Hot Vibe Details")}
                      </ShadCardTitle>
                      {lead.kwork_url && (
                      <ShadCardDescription className="pt-1">
                          <Link href={lead.kwork_url} target="_blank" rel="noopener noreferrer" className="text-xs sm:text-sm text-brand-blue hover:underline flex items-center gap-1.5 opacity-80 hover:opacity-100">
                              {modalText.viewOriginal} <VibeContentRenderer content="::FaArrowUpRightFromSquare className='w-3 h-3'::" />
                          </Link>
                      </ShadCardDescription>
                      )}
                  </div>
                  <DialogClose asChild>
                      <Button variant="ghost" size="icon" className="text-gray-300 hover:text-white w-8 h-8 sm:w-9 sm:h-9 p-1.5 sm:p-2 flex-shrink-0 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm">
                          <FaXmark className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="sr-only">{modalText.close}</span>
                      </Button>
                  </DialogClose>
              </div>
          </div>
          
          <div className={cn(
              "relative z-10 flex-grow overflow-y-auto p-3 sm:p-4 space-y-3 font-mono simple-scrollbar", // Уменьшил sm:space-y-4 до sm:space-y-3
              "bg-dark-bg" 
            )}
          >
              <Card className={cn("border p-3 shadow-md", theme.modalCardBg, theme.modalCardBorder)}>
                  <ShadCardHeader className="p-0 mb-1.5 sm:mb-2">
                      <ShadCardTitle className={cn("text-sm sm:text-base font-orbitron flex items-center", theme.modalAccentColor || "text-brand-cyan")}>
                      <VibeContentRenderer content={modalText.missionBriefing}/>
                      </ShadCardTitle>
                  </ShadCardHeader>
                  <CardContent className="p-0 text-2xs sm:text-xs space-y-1 text-gray-300"> {/* Уменьшил space-y и размер шрифта */}
                      {lead.potential_earning && <p><VibeContentRenderer content="::FaMoneyBillWave className='text-brand-green mr-1.5':: "/>{modalText.budget} <span className="font-semibold text-white">{lead.potential_earning}</span></p>}
                      {lead.project_type_guess && <p><VibeContentRenderer content="::FaLightbulb className='text-brand-yellow mr-1.5':: "/>{modalText.taskType} <span className="font-semibold text-white">{lead.project_type_guess}</span></p>}
                      {lead.required_quest_id && <p><VibeContentRenderer content="::FaBoltLightning className='text-brand-orange mr-1.5':: "/>{modalText.requiredSkill} <span className="font-semibold text-white">{lead.required_quest_id}</span></p>}
                      {lead.client_response_snippet && <p className="text-brand-lime"><VibeContentRenderer content="::FaCommentDots className='text-brand-lime mr-1.5':: "/>{modalText.clientStatus} <span className="font-semibold text-white italic">"{lead.client_response_snippet}"</span></p>}
                  </CardContent>
              </Card>

              {lead.project_description && (
                <Collapsible open={isDescriptionOpen} onOpenChange={setIsDescriptionOpen} className="rounded-lg overflow-hidden">
                  <Card className={cn("border-0 shadow-none", theme.modalCardBg)}>
                    <CollapsibleTrigger asChild>
                      <ShadCardHeader className={cn("pt-2.5 pb-1.5 px-3 sm:px-4 cursor-pointer flex justify-between items-center transition-colors rounded-t-md", isDescriptionOpen ? `${theme.modalCardBorder} bg-white/10` : `${theme.modalCardBorder} hover:bg-white/5`)}> {/* Затемнение при открытии */}
                        <ShadCardTitle className={cn("text-xs sm:text-sm font-orbitron flex items-center", theme.modalAccentColor || "text-brand-purple")}>
                            <VibeContentRenderer content="::FaFileLines className='mr-2'::"/>{modalText.fullDescription}
                        </ShadCardTitle>
                        <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-gray-400">
                          {isDescriptionOpen ? <FaChevronUp /> : <FaChevronDown />}
                        </Button>
                      </ShadCardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent className={cn("border-x border-b rounded-b-md",theme.modalCardBorder)}>
                      <CardContent className="p-2.5 sm:p-3 text-2xs sm:text-xs text-gray-300 whitespace-pre-wrap break-words max-h-28 sm:max-h-32 overflow-y-auto simple-scrollbar">
                        <VibeContentRenderer content={lead.project_description} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
          
              {lead.ai_generated_proposal_draft && (
                <Collapsible open={isOfferOpen} onOpenChange={setIsOfferOpen} className="rounded-lg overflow-hidden">
                   <Card className={cn("border-0 shadow-none", theme.modalCardBg)}>
                      <CollapsibleTrigger asChild>
                          <ShadCardHeader className={cn("pt-2.5 pb-1.5 px-3 sm:px-4 cursor-pointer flex justify-between items-center transition-colors rounded-t-md", isOfferOpen ? `${theme.modalCardBorder} bg-white/10` : `${theme.modalCardBorder} hover:bg-white/5`)}>
                              <ShadCardTitle className={cn("text-xs sm:text-sm font-orbitron flex items-center", theme.modalAccentColor || "text-brand-pink")}>
                                  <VibeContentRenderer content="::FaPaperPlane className='mr-2'::"/>{modalText.draftOffer}
                              </ShadCardTitle>
                                <Button variant="ghost" size="icon" className="h-6 w-6 p-1 text-gray-400">
                                  {isOfferOpen ? <FaChevronUp /> : <FaChevronDown />}
                              </Button>
                          </ShadCardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent className={cn("border-x border-b rounded-b-md",theme.modalCardBorder)}>
                          <CardContent className="p-2.5 sm:p-3 text-2xs sm:text-xs text-gray-300">
                              <pre className="whitespace-pre-wrap break-words max-h-28 sm:max-h-32 overflow-y-auto simple-scrollbar">{lead.ai_generated_proposal_draft}</pre>
                              <Button variant="outline" size="sm" className={cn("mt-2 text-2xs sm:text-xs h-auto py-1 px-2", theme.borderColor, theme.modalAccentColor || "text-brand-pink", `hover:bg-opacity-20 focus:ring-1 focus:ring-offset-0 ${(theme.modalAccentColor || "text-brand-pink").replace('text-','ring-')}`)}
                                      onClick={() => handleCopyToClipboard(lead.ai_generated_proposal_draft, "Черновик оффера скопирован!")}>
                                  <VibeContentRenderer content="::FaCopy className='mr-1.5'::"/>{modalText.copyOffer}
                              </Button>
                          </CardContent>
                      </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
          </div>

          <div className="relative z-10 p-3 sm:p-4 border-t border-white/10 flex-shrink-0 mt-auto bg-black/50 backdrop-blur-sm rounded-b-xl">
              <Button
              onClick={handleExecuteClickInModal}
              disabled={!isMissionUnlocked}
              variant="default"
              size="lg" // Оставляем LG для главной кнопки
              className={cn(
                  "w-full font-orbitron text-sm sm:text-base py-2.5 shadow-lg", // Уменьшил паддинг для мобилок
                  isMissionUnlocked ? `${theme.accentGradient} text-black hover:brightness-110 active:scale-95 shadow-md` : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              >
              <VibeContentRenderer content={isMissionUnlocked ? modalText.executeMission : modalText.skillLocked} />
              </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}