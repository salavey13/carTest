"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VibeContentRenderer } from '@/components/VibeContentRenderer';
import { cn } from '@/lib/utils';

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
  };
  t: Record<string, any>; // Assuming t is an object with string keys and string values
  onFilterChange: (filter: string) => void;
  onUpdateStatus: (leadId: string, newStatus: string) => void;
  onAssignLead: (leadId: string, assigneeType: 'tank' | 'carry' | 'support', assigneeId: string | null) => void;
  onScrollToSection: (ref: React.RefObject<HTMLDivElement>) => void;
  arsenalSectionRef: React.RefObject<HTMLDivElement>;
}

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
                "text-[0.65rem] sm:text-xs px-2 sm:px-3 py-1 transform hover:scale-105",
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
                        filter === 'new' ? '::facircleexclamation:: Новые' :
                          filter === 'in_progress' ? '::fahourglasshalf:: В Работе' :
                            filter === 'interested' ? '::fafire:: Интерес' :
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
            <Button variant="link" onClick={() => onScrollToSection(arsenalSectionRef)} className={cn("p-0 h-auto text-sm sm:text-base", pageTheme.primaryColor)}>
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
              <thead className="text-[0.7rem] sm:text-xs text-brand-orange uppercase bg-gray-950/70">
                <tr>
                  <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Клиент</th>
                  <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2 hidden md:table-cell">Проект (суть)</th>
                  <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2 hidden lg:table-cell">Бюджет</th>
                  <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Статус</th>
                  <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Назначен</th>
                  <th scope="col" className="px-2 sm:px-3 py-1.5 sm:py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="bg-gray-900/50 border-b border-gray-800 hover:bg-gray-800/70 transition-colors">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 font-medium text-gray-200 whitespace-nowrap">
                      <a href={lead.lead_url || '#'} target="_blank" rel="noopener noreferrer" className="hover:underline text-brand-cyan flex items-center gap-1">
                        {lead.client_name || 'N/A'} <VibeContentRenderer content="::fasquarearrowupright className='text-[0.6rem] sm:text-2xs'::" />
                      </a>
                      {lead.source && <span className='block text-[0.6rem] sm:text-2xs text-gray-500 italic' title={`Источник: ${lead.source}`}>({lead.source})</span>}
                      {lead.similarity_score && <span className='block text-[0.65rem] sm:text-xs text-gray-500' title={`Сходство: ${lead.similarity_score}%`}>S: {lead.similarity_score}%</span>}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-300 truncate max-w-[150px] sm:max-w-[200px] md:max-w-xs hidden md:table-cell" title={lead.project_description}>
                      {lead.project_description ? lead.project_description.substring(0, 70) + (lead.project_description.length > 70 ? '...' : '') : '-'}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2 text-gray-400 hidden lg:table-cell">{lead.budget_range || '-'}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2">
                      <select
                        value={lead.status}
                        onChange={(e) => lead.id && onUpdateStatus(lead.id, e.target.value)}
                        disabled={isLoading}
                        className={cn(
                          "bg-gray-700 border border-gray-600 text-gray-200 text-[0.7rem] sm:text-xs rounded-md focus:ring-brand-orange focus:border-brand-orange p-1 sm:p-1.5 appearance-none",
                          lead.status === 'new' && 'ring-1 sm:ring-2 ring-yellow-400',
                          lead.status === 'in_progress' && 'ring-1 sm:ring-2 ring-blue-400',
                          lead.status === 'interested' && 'ring-1 sm:ring-2 ring-pink-400',
                          lead.status === 'closed_won' && 'bg-green-700/50 ring-1 sm:ring-2 ring-green-400',
                          lead.status === 'closed_lost' && 'bg-red-700/50 ring-1 sm:ring-2 ring-red-400',
                        )}
                      >
                        <option value="new">Новый</option>
                        <option value="raw_data">Сырые</option>
                        <option value="analyzed">Анализ</option>
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
                      <Button variant="ghost" size="icon" className="text-brand-yellow hover:text-yellow-300 h-6 w-6 sm:h-7 sm:w-7 p-1" title="Детали Лида (WIP)" disabled={isLoading}>
                        <VibeContentRenderer content="::facircleinfo::" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeadsDashboard;