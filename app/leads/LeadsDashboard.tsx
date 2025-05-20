"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


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
  onFilterChange: (filter: string) => void;
  onUpdateStatus: (leadId: string, newStatus: string) => void;
  onAssignLead: (leadId: string, assigneeType: 'tank' | 'carry' | 'support', assigneeId: string | null) => void;
  onScrollToSection: (ref: React.RefObject<HTMLDivElement>) => void;
  arsenalSectionRef: React.RefObject<HTMLDivElement>;
}

const getProjectTypeColor = (type: string | null | undefined, theme: LeadsDashboardProps['pageTheme']) => {
  if (!type) return 'text-gray-500';
  const lowerType = type.toLowerCase();
  if (lowerType.includes('training') || lowerType.includes('fitness')) return 'text-brand-green';
  if (lowerType.includes('carrental') || lowerType.includes('rent')) return 'text-brand-blue';
  if (lowerType.includes('ecommerce')) return 'text-brand-pink';
  if (lowerType.includes('twa')) return theme.accentColor; 
  if (lowerType.includes('bot')) return 'text-brand-purple';
  if (lowerType.includes('nextjs_app')) return 'text-brand-yellow'; // More specific for Next.js apps
  if (lowerType.includes('wheeloffortune')) return 'text-brand-lime';
  if (lowerType.includes('vprtests')) return 'text-brand-cyan'; // Using cyan from theme as an example
  return 'text-gray-400'; // Default for "Unknown" or other types
};

const LeadsDashboard: React.FC<LeadsDashboardProps> = ({
  leads,
  isLoading,
  currentFilter,
  teamMembers,
  pageTheme,
  t,
  onFilterChange,
  onUpdateStatus,
  onAssignLead,
  onScrollToSection,
  arsenalSectionRef,
}) => {
  return (
    <TooltipProvider delayDuration={100}>
      <Card className={cn("bg-black/70 backdrop-blur-md border-2", pageTheme.borderColor, pageTheme.shadowColor)}>
        <CardHeader>
          <CardTitle className={cn("text-2xl sm:text-3xl font-orbitron flex items-center gap-2 sm:gap-3", pageTheme.primaryColor)}>
            <VibeContentRenderer content={t.leadsDashboardTitle} />
          </CardTitle>
          <CardDescription className="font-mono text-xs sm:text-sm text-gray-400">
            <VibeContentRenderer content={t.leadsDashboardDesc} />
          </CardDescription>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-2">
            {['all', 'my', 'support', 'tank', 'carry', 'new', 'in_progress', 'interested'].map(filter => (
              <Button
                key={filter}
                variant={currentFilter === filter ? "default" : "outline"}
                size="xs"
                onClick={() => onFilterChange(filter)}
                className={cn(
                  "text-[0.65rem] sm:text-xs px-2 sm:px-3 py-1 transform hover:scale-105 font-mono",
                  currentFilter === filter
                    ? `${pageTheme.buttonGradient} text-black shadow-md`
                    : `${pageTheme.borderColor} ${pageTheme.primaryColor} hover:bg-opacity-20 hover:text-white`
                )}
              >
                {filter === 'all' ? 'Все Лиды' :
                  filter === 'my' ? 'Мои Задачи' :
                    filter === 'support' ? 'Задачи Саппорта' :
                      filter === 'tank' ? 'Задачи Танков' :
                        filter === 'carry' ? 'Задачи Кэрри' :
                          filter === 'new' ? <VibeContentRenderer content="::facircleexclamation:: Новые" /> :
                            filter === 'in_progress' ? <VibeContentRenderer content="::fahourglasshalf:: В Работе" /> :
                              filter === 'interested' ? <VibeContentRenderer content="::fafire:: Интерес" /> :
                                filter.charAt(0).toUpperCase() + filter.slice(1)
                }
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="font-mono text-xs sm:text-sm">
          {leads.length === 0 && !isLoading ? (
            <p className="text-gray-400 text-center py-4">
              По фильтру '{currentFilter}' кибер-целей не обнаружено. Время для{' '}
              <Button variant="link" onClick={() => onScrollToSection(arsenalSectionRef)} className={cn("p-0 h-auto text-sm sm:text-base font-orbitron", pageTheme.primaryColor)}>
                'Сбора трофеев'
              </Button>!
            </p>
          ) : isLoading && leads.length === 0 ? (
            <div className="text-center py-4">
              <VibeContentRenderer content="::faspinner className='animate-spin text-xl sm:text-2xl text-brand-orange':: Загрузка данных из ЦОД..." />
            </div>
          ) : (
            <div className="overflow-x-auto simple-scrollbar">
              <table className="w-full text-left">
                <thead className="text-[0.7rem] sm:text-xs text-brand-orange uppercase bg-gray-950/70 font-orbitron">
                  <tr>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Клиент (Релевантность)</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2 hidden md:table-cell">Проект (Суть и Тип)</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2 hidden lg:table-cell">Бюджет</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Статус</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Назначен</th>
                    <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => {
                    let tweaksCount = 0;
                    let featuresCount = 0;
                    try {
                      if (lead.identified_tweaks) {
                        const parsedTweaks = typeof lead.identified_tweaks === 'string' ? JSON.parse(lead.identified_tweaks) : lead.identified_tweaks;
                        if (Array.isArray(parsedTweaks)) tweaksCount = parsedTweaks.length;
                      }
                    } catch (e) { /* Ошибка парсинга JSON, count остается 0 */ }
                    try {
                      if (lead.missing_features) {
                        const parsedFeatures = typeof lead.missing_features === 'string' ? JSON.parse(lead.missing_features) : lead.missing_features;
                        if (Array.isArray(parsedFeatures)) featuresCount = parsedFeatures.length;
                      }
                    } catch (e) { /* Ошибка парсинга JSON, count остается 0 */ }

                    return (
                      <tr key={lead.id} className="bg-gray-900/50 border-b border-gray-800 hover:bg-gray-800/70 transition-colors">
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-medium text-gray-200 whitespace-nowrap">
                          <a href={lead.lead_url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline text-brand-cyan flex items-center gap-1 font-semibold">
                            {lead.client_name || 'N/A'} <VibeContentRenderer content="::fasquarearrowupright className='text-[0.6rem] sm:text-2xs'::" />
                          </a>
                          {lead.source && <span className='block text-[0.6rem] sm:text-2xs text-gray-500 italic' title={`Источник: ${lead.source}`}>({lead.source})</span>}
                          {(lead.initial_relevance_score || lead.similarity_score) && 
                            <span className={cn('block text-[0.65rem] sm:text-xs font-bold', 
                                (lead.initial_relevance_score || lead.similarity_score || 0) >= 8 ? 'text-brand-lime' :
                                (lead.initial_relevance_score || lead.similarity_score || 0) >= 5 ? 'text-brand-yellow' :
                                'text-brand-orange'
                              )} 
                              title={`Релевантность: ${lead.initial_relevance_score || lead.similarity_score}/10`}
                            >
                              Р: {lead.initial_relevance_score || lead.similarity_score}/10
                            </span>
                          }
                        </td>
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-300 max-w-[150px] sm:max-w-[200px] md:max-w-xs hidden md:table-cell">
                          <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="truncate block cursor-help" title={lead.project_description}>
                                    {lead.project_description ? lead.project_description.substring(0, 70) + (lead.project_description.length > 70 ? '...' : '') : '-'}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-950 border-brand-purple text-gray-300 max-w-xs p-2 text-xs">
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
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400 hidden lg:table-cell">{lead.budget_range || '-'}</td>
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                          <select
                            value={lead.status || 'new'}
                            onChange={(e) => lead.id && onUpdateStatus(lead.id, e.target.value)}
                            disabled={isLoading}
                            className={cn(
                              "bg-gray-700 border border-gray-600 text-gray-200 text-[0.7rem] sm:text-xs rounded-md focus:ring-brand-orange focus:border-brand-orange p-1 sm:p-1.5 appearance-none",
                              lead.status === 'new' && 'ring-1 sm:ring-2 ring-yellow-400 font-bold',
                              lead.status === 'in_progress' && 'ring-1 sm:ring-2 ring-blue-400',
                              lead.status === 'interested' && 'ring-1 sm:ring-2 ring-pink-400 font-semibold',
                              lead.status === 'closed_won' && 'bg-green-700/50 ring-1 sm:ring-2 ring-green-400 text-black font-bold',
                              lead.status === 'closed_lost' && 'bg-red-700/50 ring-1 sm:ring-2 ring-red-400 text-gray-300',
                              lead.status === 'analyzed_by_pipeline' && 'bg-purple-700/30 ring-1 ring-brand-purple text-brand-purple'
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
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400">
                          <select
                            value={lead.assigned_to_tank || lead.assigned_to_carry || lead.assigned_to_support || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              const [role, id] = value.split(':');
                              if (lead.id) {
                                if (value === "unassign_tank") onAssignLead(lead.id, 'tank', null);
                                else if (value === "unassign_carry") onAssignLead(lead.id, 'carry', null);
                                else if (value === "unassign_support") onAssignLead(lead.id, 'support', null);
                                else if (role && id) onAssignLead(lead.id, role as 'tank' | 'carry' | 'support', id);
                              }
                            }}
                            disabled={isLoading}
                            className="bg-gray-700 border border-gray-600 text-gray-200 text-[0.7rem] sm:text-xs rounded-md focus:ring-brand-orange focus:border-brand-orange p-1 sm:p-1.5 appearance-none"
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
                        <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs space-x-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-brand-yellow hover:text-yellow-300 h-7 w-7 p-1" disabled={isLoading}>
                                <VibeContentRenderer content="::facircleinfo::" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-900 text-gray-200 border-brand-yellow/50 text-xs font-mono p-2 shadow-lg max-w-xs">
                              <p>ID: {lead.id?.substring(0,8)}...</p>
                              <p className="text-brand-pink">Твики (Танки): {tweaksCount}</p>
                              <p className="text-brand-green">Новые фичи (Кэрри): {featuresCount}</p>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    )
                  })}
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