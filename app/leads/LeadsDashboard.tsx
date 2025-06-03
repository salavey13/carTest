"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '@/contexts/AppContext'; // For dbUser
import { checkAndUnlockFeatureAchievement } from '@/hooks/cyberFitnessSupabase'; // For achievements
import { useAppToast } from "@/hooks/useAppToast"; // For custom toasts

interface Lead {
  id?: string;
  source?: string;
  lead_url?: string;
  client_name?: string | null;
  project_description?: string;
  raw_html_description?: string | null;
  budget_range?: string | null;
  posted_at?: string | null;
  similarity_score?: number | null;
  initial_relevance_score?: number | null;
  project_type_guess?: string | null;
  status?: string;
  assigned_to_tank?: string | null;
  assigned_to_carry?: string | null;
  assigned_to_support?: string | null;
  notes?: string | null;
  supervibe_studio_links?: any;
  github_issue_links?: any;
  generated_offer?: string | null;
  identified_tweaks?: any;
  missing_features?: any;
  created_at?: string;
  updated_at?: string;
}

interface TeamUser {
  user_id: string;
  username?: string | null;
  role?: string | null;
}

interface LeadsDashboardProps {
  leads: Lead[];
  isLoading: boolean;
  currentFilter: string;
  teamMembers: TeamUser[];
  pageTheme: {
    primaryColor: string;
    borderColor: string;
    shadowColor: string;
    buttonGradient: string;
    accentColor: string;
  };
  t: Record<string, any>;
  onFilterChange: (filter: string) => void; // This will be wrapped to include achievement logic
  onUpdateStatus: (leadId: string, newStatus: string) => void;
  onAssignLead: (leadId: string, assigneeType: 'tank' | 'carry' | 'support', assigneeId: string | null) => void; // This will be wrapped
  onScrollToSection: (ref: React.RefObject<HTMLDivElement>) => void;
  arsenalSectionRef: React.RefObject<HTMLDivElement>;
}

const getProjectTypeColor = (type: string | null | undefined, theme: LeadsDashboardProps['pageTheme']) => {
  if (!type) return 'text-gray-500';
  const lowerType = type.toLowerCase();
  if (lowerType.includes('training') || lowerType.includes('fitness')) return 'text-brand-green';
  if (lowerType.includes('carrental') || lowerType.includes('rent')) return 'text-brand-blue';
  if (lowerType.includes('ecommerce')) return 'text-brand-pink';
  if (lowerType.includes('twa')) return theme.accentColor; // Use pageTheme accent for generic TWA
  if (lowerType.includes('bot')) return 'text-brand-purple';
  if (lowerType.includes('nextjs_app')) return 'text-brand-yellow';
  if (lowerType.includes('wheeloffortune')) return 'text-brand-lime';
  if (lowerType.includes('vprtests')) return 'text-brand-cyan'; // Keep cyan for VPR tests
  return 'text-gray-400';
};

const LeadsDashboard: React.FC<LeadsDashboardProps> = ({
  leads,
  isLoading,
  currentFilter,
  teamMembers,
  pageTheme,
  t,
  onFilterChange: originalOnFilterChange,
  onUpdateStatus,
  onAssignLead: originalOnAssignLead,
  onScrollToSection,
  arsenalSectionRef,
}) => {
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const { dbUser } = useAppContext();
  const { addToast } = useAppToast();

  const toggleExpand = (leadId: string | undefined) => {
    if (leadId) {
      setExpandedLeadId(prevId => (prevId === leadId ? null : leadId));
    }
  };

  const handleCopyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(message))
      .catch(err => toast.error(`Ошибка копирования: ${err.message}`));
  };

  const getAssigneeName = (lead: Lead, type: 'tank' | 'carry' | 'support') => {
    const userId = type === 'tank' ? lead.assigned_to_tank : type === 'carry' ? lead.assigned_to_carry : lead.assigned_to_support;
    if (!userId) return null;
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.username || userId.substring(0, 6);
  };

  const handleFilterChangeWithAchievement = (filter: string) => {
    originalOnFilterChange(filter);
    if (dbUser?.user_id && ['my', 'support', 'tank', 'carry', 'new', 'in_progress', 'interested'].includes(filter)) {
      checkAndUnlockFeatureAchievement(dbUser.user_id, `leads_filter_${filter}_used`)
        .then(() => checkAndUnlockFeatureAchievement(dbUser.user_id, 'leads_filter_master'))
        .then(({ newAchievements }) => {
          newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
        });
    }
  };

  const handleAssignLeadWithAchievement = (leadId: string, assigneeType: 'tank' | 'carry' | 'support', assigneeId: string | null) => {
    originalOnAssignLead(leadId, assigneeType, assigneeId);
    if (assigneeId && dbUser?.user_id) { // Log achievement only if lead is assigned (not unassigned)
        checkAndUnlockFeatureAchievement(dbUser.user_id, `lead_assigned_to_${assigneeType}_ever`)
        .then(() => checkAndUnlockFeatureAchievement(dbUser.user_id, 'leads_role_commander'))
        .then(({ newAchievements }) => {
            newAchievements?.forEach(ach => addToast(`🏆 Ачивка: ${ach.name}!`, "success", 5000, { description: ach.description }));
        });
    }
  };


  return (
    <TooltipProvider delayDuration={100}>
      <Card className={cn("bg-card/80 backdrop-blur-lg border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
        <CardHeader>
          <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
            <VibeContentRenderer content={t.leadsDashboardTitle} />
          </CardTitle>
          <CardDescription className="font-mono text-xs sm:text-sm text-muted-foreground">
            <VibeContentRenderer content={t.leadsDashboardDesc} />
          </CardDescription>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-2">
            {['all', 'my', 'support', 'tank', 'carry', 'new', 'in_progress', 'interested'].map(filter => (
              <Button
                key={filter}
                variant={currentFilter === filter ? "default" : "outline"}
                size="xs"
                onClick={() => handleFilterChangeWithAchievement(filter)}
                className={cn(
                  "text-[0.65rem] sm:text-xs px-2 sm:px-3 py-1 transform hover:scale-105 font-mono",
                  currentFilter === filter
                    ? `${pageTheme.buttonGradient} text-black shadow-md hover:opacity-95` // Added hover opacity
                    : `${pageTheme.borderColor} ${pageTheme.primaryColor} hover:bg-brand-purple/20 hover:text-white` // Adjusted hover
                )}
              >
                {filter === 'all' ? 'Все Лиды' :
                  filter === 'my' ? 'Мои Задачи' :
                    filter === 'support' ? 'Задачи Саппорта' :
                      filter === 'tank' ? 'Задачи Танков' :
                        filter === 'carry' ? 'Задачи Кэрри' :
                          filter === 'new' ? <VibeContentRenderer content="::FaCircleExclamation:: Новые" /> :
                            filter === 'in_progress' ? <VibeContentRenderer content="::FaHourglassHalf:: В Работе" /> :
                              filter === 'interested' ? <VibeContentRenderer content="::FaFire:: Интерес" /> :
                                filter.charAt(0).toUpperCase() + filter.slice(1)
                }
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="font-mono text-xs sm:text-sm">
          {leads.length === 0 && !isLoading ? (
            <p className="text-muted-foreground text-center py-4">
              По фильтру '{currentFilter}' кибер-целей не обнаружено. Время для{' '}
              <Button variant="link" onClick={() => onScrollToSection(arsenalSectionRef)} className={cn("p-0 h-auto text-sm sm:text-base font-orbitron", pageTheme.accentColor)}>
                'Сбора трофеев'
              </Button>!
            </p>
          ) : isLoading && leads.length === 0 ? (
            <div className="text-center py-4">
              <VibeContentRenderer content={`::FaSpinner className='animate-spin text-xl sm:text-2xl ${pageTheme.primaryColor}':: Загрузка данных из ЦОД...`} />
            </div>
          ) : (
            <div className="overflow-x-auto simple-scrollbar">
              <table className="w-full text-left">
                <thead className={cn("text-[0.7rem] sm:text-xs uppercase bg-background/70 font-orbitron", pageTheme.primaryColor)}>
                  <tr>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Клиент (Р)</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2 hidden md:table-cell">Проект</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Статус</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2 hidden sm:table-cell">Назначен</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Детали</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {leads.map(lead => {
                      const isExpanded = expandedLeadId === lead.id;
                      let tweaksParsed: any[] = [];
                      let featuresParsed: any[] = [];
                      let tweaksCount = 0;
                      let featuresCount = 0;

                      try {
                        if (lead.identified_tweaks) {
                          tweaksParsed = typeof lead.identified_tweaks === 'string' ? JSON.parse(lead.identified_tweaks) : lead.identified_tweaks;
                          if (Array.isArray(tweaksParsed)) tweaksCount = tweaksParsed.length;
                        }
                      } catch (e) { console.error("Error parsing tweaks JSON:", e); }
                      try {
                        if (lead.missing_features) {
                          featuresParsed = typeof lead.missing_features === 'string' ? JSON.parse(lead.missing_features) : lead.missing_features;
                          if (Array.isArray(featuresParsed)) featuresCount = featuresParsed.length;
                        }
                      } catch (e) { console.error("Error parsing features JSON:", e); }

                      return (
                        <React.Fragment key={lead.id}>
                          <tr className="bg-card/50 border-b border-border/50 hover:bg-card/70 transition-colors">
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-medium text-foreground whitespace-nowrap overflow-hidden">
                              <div className="flex items-center gap-1 w-full">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleExpand(lead.id)}
                                  className={cn("h-7 w-7 p-0 mr-1 flex-shrink-0", isExpanded ? "text-brand-blue" : "text-gray-500 hover:text-brand-cyan")}
                                  disabled={isLoading}
                                >
                                  {isExpanded ? <VibeContentRenderer content="::FaChevronUp className='h-4 w-4'::" /> : <VibeContentRenderer content="::FaChevronDown className='h-4 w-4'::" />}
                                </Button>
                                <div className="flex flex-col flex-grow min-w-0">
                                  <a href={lead.lead_url || '#'} target="_blank" rel="noopener noreferrer" className={cn("hover:underline flex items-center gap-1 font-semibold truncate", pageTheme.accentColor)}>
                                    {lead.client_name || 'N/A'} <VibeContentRenderer content="::FaSquareArrowUpRight className='text-[0.6rem] sm:text-2xs flex-shrink-0'::" />
                                  </a>
                                  {lead.source && <span className='block text-[0.6rem] sm:text-2xs text-muted-foreground italic truncate' title={`Источник: ${lead.source}`}>({lead.source})</span>}
                                  {(lead.similarity_score !== null && lead.similarity_score !== undefined) &&
                                    <span className={cn('block text-[0.65rem] sm:text-xs font-bold',
                                        lead.similarity_score >= 8 ? 'text-brand-lime' :
                                        lead.similarity_score >= 5 ? 'text-brand-yellow' :
                                        'text-brand-orange'
                                      )}
                                      title={`Релевантность: ${lead.similarity_score}/10`}
                                    >
                                      Р: {lead.similarity_score}/10
                                    </span>
                                  }
                                </div>
                              </div>
                            </td>
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-foreground max-w-[150px] sm:max-w-[200px] md:max-w-xs hidden md:table-cell">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="truncate block cursor-help" title={lead.project_description}>
                                        {lead.project_description ? lead.project_description.substring(0, 70) + (lead.project_description.length > 70 ? '...' : '') : '-'}
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent className="bg-popover border-border text-popover-foreground max-w-xs p-2 text-xs">
                                    <p>{lead.project_description}</p>
                                </TooltipContent>
                              </Tooltip>
                              {lead.project_type_guess && (
                                <span
                                  className={cn('block text-[0.6rem] sm:text-2xs italic font-semibold mt-0.5', getProjectTypeColor(lead.project_type_guess, pageTheme))}
                                  title={`Тип проекта (предположение): ${lead.project_type_guess}`}
                                >
                                  ({lead.project_type_guess})
                                </span>
                              )}
                            </td>
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                              <select
                                value={lead.status || 'new'}
                                onChange={(e) => lead.id && onUpdateStatus(lead.id, e.target.value)}
                                disabled={isLoading}
                                className={cn(
                                  "bg-muted border border-border/70 text-foreground text-[0.7rem] sm:text-xs rounded-md focus:ring-ring focus:border-ring p-1 sm:p-1.5 appearance-none w-full",
                                  lead.status === 'new' && 'ring-2 ring-yellow-400 font-bold',
                                  lead.status === 'in_progress' && 'ring-2 ring-blue-400',
                                  lead.status === 'interested' && 'ring-2 ring-pink-400 font-semibold',
                                  lead.status === 'closed_won' && 'bg-green-700/60 ring-2 ring-green-400 text-white font-bold',
                                  lead.status === 'closed_lost' && 'bg-red-700/60 ring-2 ring-red-400 text-gray-300',
                                  lead.status === 'analyzed_by_pipeline' && 'bg-purple-700/40 ring-1 ring-brand-purple text-brand-purple'
                                )}
                              >
                                <option value="new">Новый</option>
                                <option value="raw_data">Сырые</option>
                                <option value="analyzed">Анализ</option>
                                <option value="analyzed_by_pipeline">Пайплайн AI</option>
                                <option value="offer_generated">Оффер</option>
                                <option value="contacted">Контакт</option>
                                <option value="interested">Интерес</option>
                                <option value="in_progress">В работе</option>
                                <option value="closed_won">Успех!</option>
                                <option value="closed_lost">Провал</option>
                              </select>
                            </td>
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-muted-foreground hidden sm:table-cell">
                              <select
                                value={getAssigneeName(lead, 'tank') || getAssigneeName(lead, 'carry') || getAssigneeName(lead, 'support') || ''}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  const [role, id] = value.split(':');
                                  if (lead.id) {
                                    if (value === "unassign_tank") handleAssignLeadWithAchievement(lead.id, 'tank', null);
                                    else if (value === "unassign_carry") handleAssignLeadWithAchievement(lead.id, 'carry', null);
                                    else if (value === "unassign_support") handleAssignLeadWithAchievement(lead.id, 'support', null);
                                    else if (role && id) handleAssignLeadWithAchievement(lead.id, role as 'tank' | 'carry' | 'support', id);
                                  }
                                }}
                                disabled={isLoading}
                                className="bg-muted border border-border/70 text-foreground text-[0.7rem] sm:text-xs rounded-md focus:ring-ring focus:border-ring p-1 sm:p-1.5 appearance-none w-full"
                              >
                                <option value="">Никому</option>
                                <optgroup label="Танки">
                                  {teamMembers.filter(m => m.role === 'tank').map(tm => <option key={tm.user_id} value={`tank:${tm.user_id}`}>{tm.username || tm.user_id.substring(0, 6)}</option>)}
                                  {lead.assigned_to_tank && <option value="unassign_tank" className="text-red-400">Снять Танка</option>}
                                </optgroup>
                                <optgroup label="Кэрри">
                                  {teamMembers.filter(m => m.role === 'carry').map(tm => <option key={tm.user_id} value={`carry:${tm.user_id}`}>{tm.username || tm.user_id.substring(0, 6)}</option>)}
                                  {lead.assigned_to_carry && <option value="unassign_carry" className="text-red-400">Снять Кэрри</option>}
                                </optgroup>
                                <optgroup label="Саппорт">
                                  {teamMembers.filter(m => m.role === 'support').map(tm => <option key={tm.user_id} value={`support:${tm.user_id}`}>{tm.username || tm.user_id.substring(0, 6)}</option>)}
                                  {lead.assigned_to_support && <option value="unassign_support" className="text-red-400">Снять Саппорта</option>}
                                </optgroup>
                              </select>
                            </td>
                            <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className={cn("h-7 w-7 p-1", pageTheme.accentColor, `hover:text-${pageTheme.accentColor}-300`)} disabled={isLoading}>
                                    <VibeContentRenderer content="::FaCircleInfo::" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-popover text-popover-foreground border-border text-xs font-mono p-2 shadow-lg max-w-xs">
                                  <p>ID: {lead.id?.substring(0,8)}...</p>
                                  <p className="text-brand-pink">Твики (Танки): {tweaksCount}</p>
                                  <p className="text-brand-green">Новые фичи (Кэрри): {featuresCount}</p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                          </tr>
                          {isExpanded && (
                            <motion.tr
                              initial={{ opacity: 0, height: 0, scaleY: 0.95 }}
                              animate={{ opacity: 1, height: "auto", scaleY: 1 }}
                              exit={{ opacity: 0, height: 0, scaleY: 0.95 }}
                              transition={{ duration: 0.3, ease: "easeInOut" }}
                              className="bg-card/30 border-b border-border/30"
                              style={{ transformOrigin: "top" }}
                            >
                              <td colSpan={5} className="p-4 sm:p-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-foreground text-xs sm:text-sm">
                                  <div className="space-y-2">
                                    <h5 className={cn("font-orbitron font-bold text-xs sm:text-sm", pageTheme.secondaryColor)}>
                                      <VibeContentRenderer content="::FaFileLines:: Полное описание проекта:" />
                                    </h5>
                                    <p className="leading-relaxed whitespace-pre-wrap">{lead.project_description || 'Нет описания.'}</p>
                                    {lead.project_type_guess && (
                                      <p className={cn('italic font-semibold', getProjectTypeColor(lead.project_type_guess, pageTheme))}>
                                        <VibeContentRenderer content="::FaMagic:: Предполагаемый тип: " />{lead.project_type_guess}
                                      </p>
                                    )}
                                    {lead.raw_html_description && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyToClipboard(lead.raw_html_description || '', "Raw HTML скопирован!")}
                                        className={cn("h-auto py-1 px-2 text-xs", pageTheme.accentColor, `hover:text-${pageTheme.accentColor}-300`)}
                                      >
                                        <VibeContentRenderer content="::FaCode:: Копировать Raw HTML" />
                                      </Button>
                                    )}
                                  </div>

                                  <div className="space-y-2">
                                    <h5 className={cn("font-orbitron font-bold text-xs sm:text-sm", pageTheme.secondaryColor)}>
                                      <VibeContentRenderer content="::FaChartLine:: Дополнительные данные:" />
                                    </h5>
                                    <p><VibeContentRenderer content="::FaMoneyBillWave:: Бюджет:" /> {lead.budget_range || '-'}</p>
                                    <p><VibeContentRenderer content="::FaCalendarDay:: Дедлайн:" /> {lead.posted_at ? new Date(lead.posted_at).toLocaleDateString() : (lead as any).deadline_info || '-'}</p>
                                    <p><VibeContentRenderer content="::FaClock:: История клиента:" /> {lead.client_kwork_history || '-'}</p>
                                    <p><VibeContentRenderer content="::FaPercent:: Предложений:" /> {lead.current_kwork_offers_count || '-'}</p>
                                    <div className="sm:hidden mt-2 pt-2 border-t border-border/30">
                                      <h5 className={cn("font-orbitron font-bold text-xs sm:text-sm", pageTheme.secondaryColor)}>
                                        <VibeContentRenderer content="::FaShieldCat:: Назначены:" />
                                      </h5>
                                      {lead.assigned_to_tank && <p className="text-muted-foreground">Танк: {getAssigneeName(lead, 'tank')}</p>}
                                      {lead.assigned_to_carry && <p className="text-muted-foreground">Кэрри: {getAssigneeName(lead, 'carry')}</p>}
                                      {lead.assigned_to_support && <p className="text-muted-foreground">Саппорт: {getAssigneeName(lead, 'support')}</p>}
                                      {!lead.assigned_to_tank && !lead.assigned_to_carry && !lead.assigned_to_support && <p className="text-gray-600">Никому не назначен.</p>}
                                    </div>
                                  </div>

                                  <div className="md:col-span-2 space-y-2 pt-4 border-t border-border/30">
                                    <h5 className={cn("font-orbitron font-bold text-xs sm:text-sm", pageTheme.secondaryColor)}>
                                      <VibeContentRenderer content="::FaBullhorn:: Сгенерированное предложение (Оффер):" />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyToClipboard(lead.generated_offer || '', "Оффер скопирован!")}
                                        className="ml-2 text-muted-foreground hover:text-foreground h-auto py-1 px-2"
                                      >
                                        <VibeContentRenderer content="::FaCopy::" />
                                      </Button>
                                    </h5>
                                    <div className="bg-background/50 p-3 rounded-md border border-brand-purple/30 max-h-48 overflow-y-auto simple-scrollbar whitespace-pre-wrap">
                                      <VibeContentRenderer content={lead.generated_offer || 'Оффер не сгенерирован.'} />
                                    </div>
                                  </div>

                                  <div className="space-y-2 pt-4 border-t border-border/30">
                                    <h5 className={cn("font-orbitron font-bold text-xs sm:text-sm", pageTheme.secondaryColor)}>
                                      <VibeContentRenderer content="::FaTools:: Твики (для Танков):" />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyToClipboard(JSON.stringify(tweaksParsed, null, 2), "Твики скопированы!")}
                                        className="ml-2 text-muted-foreground hover:text-foreground h-auto py-1 px-2"
                                      >
                                        <VibeContentRenderer content="::FaCopy::" />
                                      </Button>
                                    </h5>
                                    {tweaksParsed.length > 0 ? (
                                      <ul className="list-disc list-inside bg-background/50 p-3 rounded-md border border-brand-pink/30 max-h-48 overflow-y-auto simple-scrollbar">
                                        {tweaksParsed.map((tweak, idx) => (
                                          <li key={idx} className="mb-1">
                                            **{tweak.tweak_description}** ({tweak.estimated_complexity})
                                            {tweak.relevant_supervibe_capability && <span className="block text-[0.6rem] text-muted-foreground">[{tweak.relevant_supervibe_capability}]</span>}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-gray-500">Твиков не найдено.</p>
                                    )}
                                  </div>

                                  <div className="space-y-2 pt-4 border-t border-border/30">
                                    <h5 className={cn("font-orbitron font-bold text-xs sm:text-sm", pageTheme.secondaryColor)}>
                                      <VibeContentRenderer content="::FaFlask:: Новые фичи (для Кэрри):" />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopyToClipboard(JSON.stringify(featuresParsed, null, 2), "Фичи скопированы!")}
                                        className="ml-2 text-muted-foreground hover:text-foreground h-auto py-1 px-2"
                                      >
                                        <VibeContentRenderer content="::FaCopy::" />
                                      </Button>
                                    </h5>
                                    {featuresParsed.length > 0 ? (
                                      <ul className="list-disc list-inside bg-background/50 p-3 rounded-md border border-brand-green/30 max-h-48 overflow-y-auto simple-scrollbar">
                                        {featuresParsed.map((feature, idx) => (
                                          <li key={idx} className="mb-1">
                                            **{feature.feature_description}**
                                            {feature.reason_for_carry && <span className="block text-[0.6rem] text-muted-foreground">Причина: {feature.reason_for_carry}</span>}
                                            {feature.potential_impact_on_supervibe && <span className="block text-[0.6rem] text-brand-yellow">Impact: {feature.potential_impact_on_supervibe}</span>}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-gray-500">Новых фич не найдено.</p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default LeadsDashboard;