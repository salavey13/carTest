/**
 * Lead type definitions — shared between client and server.
 *
 * This file has NO server-only imports (no cookies, no supabase, no "server-only").
 * It exists so client components can `import type { LeadRow } from "./leads-types"`
 * WITHOUT pulling in the server-only transitive dependency chain from leads.ts
 * (which imports telegram-actor-cookie.ts → `import "server-only"`).
 *
 * Server action files (leads.ts, lead-notes.ts, leads-kpis.ts, leads-dismiss.ts)
 * re-export these types for backwards compatibility:
 *   `export type { LeadRow, LeadTodoRow, ... } from "./leads-types"`
 */

// TYPE-ONLY imports (erased at compile time — no runtime dependency on libs):
import type { LeadKpiMetrics } from "./lib/lead-kpi";
import type { NextAction } from "./lib/lead-playbook";
import type { LeadAchievement } from "./lib/lead-achievements";
import type { LeadsKpiCardsStats, LeadsSegment } from "./lib/leads-query-core";

export interface LeadRentalRow {
  rentalId: string;
  status: string;
  paymentStatus: string;
  startDate: string | null;
  endDate: string | null;
  bikeTitle: string | null;
  totalCost: number;
  metadata?: Record<string, unknown> | null;
  passportMainpagePhoto?: string | null;
  passportRegistrationPhoto?: string | null;
  driversLicenceFrontalPhoto?: string | null;
}

export interface LeadSaleRow {
  saleId: string;
  bikeTitle: string | null;
  salePrice: number;
  createdAt: string;
}

export interface LeadRow {
  user_id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  source: string;
  bikeTitle: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  verified: boolean;
  intentType?: string | null;
  intentStage?: string | null;
  urgencyScore?: number | null;
  telegramChatId?: string | null;
  troubled?: boolean;
  troubledReason?: string | null;
  contractCount?: number;
  saleCount?: number;
  lastRentalDate?: string | null;
  totalSpent?: number;
  contractRef?: string | null;
  rentals: LeadRentalRow[];
  sales: LeadSaleRow[];
  sourceRoute?: string | null;
  contactChannel?: string | null;
  /**
   * Avito channel metadata (present when the lead came from the Avito
   * webhook / assistant-bot forward). Lets the UI deep-link the operator
   * straight into the Avito chat/listing instead of hunting for it.
   */
  avito?: {
    /** Avito chat id (v3 chat_id or synthetic fwd-… key). */
    chatId: string | null;
    /** Listing/chat URL captured from the forward or monitor enrichment. */
    itemUrl: string | null;
    /** Buyer profile URL (monitor enrichment). */
    profileUrl: string | null;
    /** Avito item id, when known. */
    itemId: string | null;
    /** Last buyer message excerpt (truncated server-side). */
    lastMessage: string | null;
    /**
     * First buyer message of the chat (webhook metadata.firstMessage) —
     * feeds intent detection for the «Готовый ответ» script engine.
     */
    firstMessage?: string | null;
    /** Listing price captured by the webhook (metadata.itemPrice), ₽/unit. */
    itemPrice?: number | null;
    /** Buyer messages captured so far (metadata.messagesCount). */
    messagesCount?: number | null;
    /** ISO time of the last captured buyer message (metadata.lastMessageAt). */
    lastMessageAt?: string | null;
    /**
     * AI-анализ сообщения покупателя (пишется внешним агентом, который
     * контролирует извлечение авито-сообщений, через analysis-envelope в
     * webhook'е). Движок «Готовый ответ» предпочитает его локальному
     * keyword-детектору: suggestedReply агента > intent агента (наш шаблон)
     * > локальная диагностика.
     */
    analysis?: {
      /** Интент из словаря lead-scripts (availability/price/…/generic). */
      intent?: string | null;
      /** Уверенность агента 0–100. */
      confidence?: number | null;
      /** Готовый текст ответа, собранный агентом. */
      suggestedReply?: string | null;
      /** Короткий вариант ответа. */
      shortReply?: string | null;
      /** Next Best Action от агента. */
      nextBestAction?: string | null;
      /** «Горячесть» покупателя: hot | warm | cold. */
      temperature?: string | null;
      /** Тип возражения: price | license | experience | trust | none. */
      objection?: string | null;
      /** Извлечённые сущности (dates/phone/bike/budget/…). */
      entities?: Record<string, string> | null;
      /** Свободная заметка агента для оператора. */
      notes?: string | null;
      /** Какая модель/агент анализировал. */
      model?: string | null;
      /** ISO время анализа. */
      analyzedAt?: string | null;
    } | null;
    /**
     * НАКОПИТЕЛЬНЫЕ факты клиента (metadata.clientFacts, Lead Game wave):
     * агент/монитор присылают их с каждым сообщением, webhook мерджит.
     * «Подготовка за 5 минут»: оператор видит имя, город, бюджет, мото,
     * дату катания и прочее без открытия Авито.
     */
    clientFacts?: Record<string, string> | null;
    /**
     * Накопительный лог чата (metadata.messages, последние 12 реплик):
     * покупатель и наши ответы — полный контекст разговора без Авито.
     */
    messages?: Array<{ at: string; from: string; text: string }> | null;
  } | null;
  identityState?: 'claimed_user' | 'phone_only' | 'operator_placeholder' | 'merged' | 'avito_only';
  sourceCount?: number;
  originalOperatorChatId?: string | null;
  stageKey?: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  nextAction?: string | null;
  qrStatus?: "unclaimed" | "sent" | "claimed" | "expired";
  /**
   * Прогресс оплаты сделки (franchize_intents.metadata.saleProgress) —
   * пишется ассистентом/оператором для «upcoming sales». Статус
   * "partial_paid" = клиент уже внёс часть суммы и ждёт закрытия остатка:
   * плейбук смены показывает такое ведро «💰 Деньги на столе» (вес 105),
   * потому что это самая денежная «работа на сегодня».
   */
  saleProgress?: {
    /** partial_paid — часть суммы внесена, ждём остаток. */
    status?: string | null;
    /** Сколько уже внесено, ₽. */
    paidRub?: number | null;
    /** Полная сумма сделки, ₽ (если известна). */
    totalRub?: number | null;
    /** Свободная заметка оператора («ждёт остаток», способ оплаты…). */
    note?: string | null;
  } | null;
  /**
   * Количество заметок лида (таблица lead_notes, crew-scoped) — питает
   * подсвеченный флажок «Прочитать заметки» прямо в списке лидов.
   * Считается на сервере одним агрегатным запросом; 0/undefined = заметок нет.
   */
  notesCount?: number;
  /**
   * Сколько из заметок лида оставлено ЧЕЛОВЕКОМ (оператором) — всё, что не
   * служебная авто-заметка (автор «подбор с сайта» — дамп ответов квиза с
   * сайта, пишется вебхуком callback-lead). Питает фильтр тулбара «С
   * заметками»: авто-квиз есть у каждого лида с сайта, поэтому голый
   * notesCount для «листов с человеческой работой» бесполезен.
   * Считается на сервере в том же проходе, что notesCount.
   */
  humanNotesCount?: number;
  /** Когда оставлена последняя заметка (ISO) — «новая» (≤24 ч) подсвечена ярче. */
  lastNoteAt?: string | null;
  /**
   * Кто из операторов последним «трогал» лида (на сегодня — автор последней
   * заметки; имя разрешается на сервере из users по created_by). Показывается
   * на карточке лида и в шторке: «✍ Иванов · 2 ч назад».
   * null/undefined — заметок нет → показываем оператора, создавшего лид
   * через /doc (ownerName).
   */
  lastTouchedBy?: string | null;
  /**
   * ISO-время последней МОДИФИКАЦИИ лида (для карточки: «изм. 2 ч назад»).
   * Считается на сервере как max(intent.updated_at, заметки, туду) — заметка
   * (в т.ч. редактирование), смена стадии, создание/завершение туду обновляют
   * его. Оператор сразу видит, какие лиды он уже обработал.
   * null — модификаций после создания не было (или данных нет).
   */
  lastModifiedAt?: string | null;
}

export interface LeadTodoRow {
  id: string;
  lead_id: string | null;
  user_id: string | null;
  phone: string | null;
  rental_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  completed_at: string | null;
  assigned_to: string | null;
  /** iter35: resolved operator name for assigned_to — shown on todo rows
   *  instead of the raw numeric chat_id. */
  assignedToName?: string | null;
  due_date: string | null;
}

/**
 * Записанное событие истории лида (public.lead_events, Lead Game wave).
 * В отличие от клиентски выводимой таймлайна — это ФАКТ в БД с атрибуцией:
 * переживает производные данные и виден всем участникам одинаково.
 */
export interface LeadEventRow {
  id: string;
  createdAt: string;
  /** Ключ лида — тот же, что в crew_todos.lead_id. */
  leadId: string;
  type: string;
  /** TG user_id оператора или "avito-agent". */
  actor: string | null;
  actorName: string | null;
  label: string;
  detail: string | null;
  /** Очки лидерборда (0 для служебных событий). */
  points: number;
}

/**
 * Строка прозрачного лидерборда: серверная агрегация lead_events за период.
 * Одинаковая для всех участников (не localStorage).
 */
export interface LeadLeaderboardEntry {
  id: string;
  name: string;
  points: number;
  handled: number;
  callbacks: number;
  todoDone: number;
  notes: number;
  closed: number;
  lastActionAt: string | null;
}

export interface GetFranchizeLeadsResult {
  success: boolean;
  leads?: LeadRow[];
  todos?: LeadTodoRow[];
  /**
   * Ростер операторов экипажа (owner + активные участники) для дропдауна
   * «Ответственный»: id нужен для матчинга фильтра по assignee/owner id,
   * name — человекочитаемая подпись опции.
   */
  operators?: Array<{ id: string; name: string }>;
  /** Журнал записанных событий истории (последние 30 дней, cap 400). */
  leadEvents?: LeadEventRow[];
  /** Прозрачный лидерборд — серверная агрегация lead_events. */
  leaderboard?: LeadLeaderboardEntry[];
  /** Оконная выдача (wave «load best leads first»): метаданные страницы. */
  page?: LeadsPageInfo;
  /** Агрегаты по ПОЛНОМУ набору лидов — питают KPI/воронку/плейбук/лидерборд. */
  agg?: LeadsAggregates;
  error?: string;
}

/** Метаданные окна при серверной пагинации лидов. */
export interface LeadsPageInfo {
  /** Смещение текущего окна внутри отфильтрованного+отсортированного списка. */
  offset: number;
  /** Запрошенный размер окна (реальный кусок может быть меньше — конец списка). */
  limit: number;
  /** Всего лидов ПОСЛЕ применения фильтров (счётчик «Показано X из Y»). */
  total: number;
  /** Есть ли ещё лиды за окном. */
  hasMore: boolean;
}

/**
 * Состояние механики «Суперлист закрыт» (lib/superlist-clear.ts) для UI:
 * панель плейбука празднует полное покрытие списка «что делать сейчас».
 */
export interface LeadsSuperlistState {
  /** Праздник случился ИМЕННО в этом ответе (этот срез закрыл список). */
  justCleared: boolean;
  /** ISO последнего праздника экипажа (баннер показывается ~2 ч после). */
  lastClearedAt: string | null;
  /** Сколько раз экипаж закрывал суперлист за всё время. */
  totalClears: number;
}

/**
 * Агрегаты по ПОЛНОМУ набору лидов экипажа (не по окну!). Считаются на
 * сервере за один проход в момент загрузки, чтобы клиенту не пришлось
 * скачивать все 500+ лидов ради шести плиток и воронки.
 */
export interface LeadsAggregates {
  /** KPI-воронка + скорость (lib/lead-kpi.ts — тот же объект, что считал клиент). */
  kpi: LeadKpiMetrics;
  /** Плиты LeadsKPICards: числа + 7-дневные тренды (по полному набору). */
  kpiCards: LeadsKpiCardsStats;
  /** Очередь «что делать сейчас» (lib/lead-playbook.ts, ≤6 действий). */
  playbook: NextAction[];
  /** Механика «Суперлист закрыт» — золотой баннер панели плейбука. */
  superlist?: LeadsSuperlistState;
  /** Распределение по стадиям пайплайна — кликабельная полоса-воронка. */
  stageBreakdown: Array<{ key: string; label: string; color: string; count: number }>;
  /** Счётчики сегментов тулбара (all/hot/warm/verified/troubled). */
  segmentCounts: { all: number; hot: number; warm: number; verified: number; troubled: number };
  /** Опции фильтра «Источник» (по полному набору — фильтры не исчезают). */
  availableSources: string[];
  /** Опции фильтра «Ответственный»: ростер + легаси-имена с лидов. */
  availableOwners: Array<{ value: string; label: string }>;
  /** Достижения (бронза…легенда) — crew-only панель. */
  achievements: LeadAchievement[];
  /** Активных лидов (без заглушек-операторов) — знаменатель прогресса. */
  totalActive: number;
}

/** Параметры оконной выдачи getFranchizeLeads (wave «load best leads first»). */
export interface GetLeadsWindowOpts {
  offset?: number;
  /** 0/undefined = легаси-режим «отдать всё» (совместимость). */
  limit?: number;
  /** Поиск: имя/телефон/username/байк/маршрут (правила filterLeads). */
  q?: string;
  source?: string;
  /** "all" | "avito" (виртуальная) | stageKey. */
  stage?: string;
  /** id оператора из ростера или легаси-имя. */
  owner?: string;
  segment?: LeadsSegment;
  hidePlaceholders?: boolean;
  /** "all" (по умолчанию) | "human" — только лиды с заметками оператора. */
  notes?: "all" | "human";
  sort?: "priority" | "recent" | "urgent" | "name" | "spent";
  /** true — отдать только агрегаты/счётчики, без окна лидов (тихий рефреш). */
  metaOnly?: boolean;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  crew_id: string;
  text: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadsKpis {
  totalLeads: number;
  hotLeads: number;
  conversionRate: number;
  monthlyRevenue: number;
  totalLeadsDelta?: number;
  hotLeadsDelta?: number;
  conversionDelta?: number;
  revenueDelta?: number;
}

export interface DismissLeadInput {
  slug: string;
  leadId: string;
  reason: string;
  note?: string;
  actorUserId?: string;
  isPasswordAuth?: boolean;
}

export interface DocVerificationData {
  rentalId: string;
  photos: {
    passportMainpage: { path: string | null; signedUrl: string | null };
    passportRegistration: { path: string | null; signedUrl: string | null };
    driversLicence: { path: string | null; signedUrl: string | null };
  };
  ocrData: {
    fullName: string | null;
    passport: string | null;
    passportIssuedBy: string | null;
    passportIssueDate: string | null;
    birthDate: string | null;
    registration: string | null;
    driverLicense: string | null;
  };
  checklist: {
    passportVerified: boolean;
    licenseVerified: boolean;
    equipmentHandover: boolean;
    odometerBefore: boolean;
    datesConfirmed: boolean;
    paymentVerified: boolean;
  };
}

export interface GetRentalDocVerificationResult {
  success: boolean;
  data?: DocVerificationData;
  error?: string;
}
