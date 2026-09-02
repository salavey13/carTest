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
   * Количество заметок лида (таблица lead_notes, crew-scoped) — питает
   * подсвеченный флажок «Прочитать заметки» прямо в списке лидов.
   * Считается на сервере одним агрегатным запросом; 0/undefined = заметок нет.
   */
  notesCount?: number;
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
  due_date: string | null;
}

export interface GetFranchizeLeadsResult {
  success: boolean;
  leads?: LeadRow[];
  todos?: LeadTodoRow[];
  error?: string;
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
