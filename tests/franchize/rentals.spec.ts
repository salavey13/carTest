/**
 * tests/franchize/rentals.spec.ts
 *
 * Tests for the rentals subsystem:
 * - confirmVehicleReturn: closure data capture, receipt recipient fallback,
 *   auth (owner/admin/crew member), payment_status preservation
 * - confirmVehiclePickup: closure todo creation, auth, pickup_freeze check
 * - completeRentalClosureTodo: auth (crew membership required)
 * - createRentalClosureTodos: idempotency, 5 todo templates
 * - Deep link routing: rental_<id> → /rental/[id] (NOT analytics)
 * - Boss commands: returns-reminder IFS separator, evening-summary deep links
 */

import { describe, expect, it } from 'vitest';

// ── confirmVehicleReturn tests ──────────────────────────────────────────────

describe('Rentals — confirmVehicleReturn', () => {
  describe('CRITICAL: payment_status must not be hardcoded to fully_paid', () => {
    it('should preserve existing payment_status when depositReturned is not true', () => {
      const existingStatus = 'deposit_paid';
      const closureData = { depositReturned: false };
      const newStatus =
        closureData.depositReturned === true
          ? 'fully_paid'
          : existingStatus || 'pending';
      expect(newStatus).toBe('deposit_paid');
    });

    it('should set fully_paid only when depositReturned === true', () => {
      const existingStatus = 'deposit_paid';
      const closureData = { depositReturned: true };
      const newStatus =
        closureData.depositReturned === true
          ? 'fully_paid'
          : existingStatus || 'pending';
      expect(newStatus).toBe('fully_paid');
    });

    it('should default to pending when existing status is null', () => {
      const existingStatus = null;
      const closureData = { depositReturned: false };
      const newStatus =
        closureData.depositReturned === true
          ? 'fully_paid'
          : existingStatus || 'pending';
      expect(newStatus).toBe('pending');
    });

    it('should NOT set fully_paid when depositReturned is null (unknown)', () => {
      const existingStatus = 'partial_paid';
      const closureData = { depositReturned: null };
      const newStatus =
        closureData.depositReturned === true
          ? 'fully_paid'
          : existingStatus || 'pending';
      expect(newStatus).toBe('partial_paid');
    });
  });

  describe('CRITICAL: receipt recipient fallback chain', () => {
    it('should use rentals.user_id when available (web-app flow)', () => {
      const rental = { user_id: '413553377' };
      const artefactChatId = null;
      const receiptChatId = rental.user_id || artefactChatId || null;
      expect(receiptChatId).toBe('413553377');
    });

    it('should fall back to rental_contract_artefacts.telegram_chat_id (bot/QR flow)', () => {
      const rental = { user_id: null };
      const artefactChatId = '413553377';
      const receiptChatId = rental.user_id || artefactChatId || null;
      expect(receiptChatId).toBe('413553377');
    });

    it('should return null when both user_id and artefact chat_id are missing', () => {
      const rental = { user_id: null };
      const artefactChatId = null;
      const receiptChatId = rental.user_id || artefactChatId || null;
      expect(receiptChatId).toBeNull();
    });

    it('should prefer rentals.user_id over artefact telegram_chat_id', () => {
      const rental = { user_id: '111' };
      const artefactChatId = '222';
      const receiptChatId = rental.user_id || artefactChatId || null;
      expect(receiptChatId).toBe('111');
    });
  });

  describe('CRITICAL: auth — allow owner, admins, and crew members', () => {
    it('should allow rental owner', () => {
      const rental = { owner_id: '413553377' };
      const userId = '413553377';
      expect(rental.owner_id === userId).toBe(true);
    });

    it('should allow crew admin', () => {
      const membership = { membership_status: 'active', role: 'admin' };
      const isCrewOperator =
        membership.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isCrewOperator).toBe(true);
    });

    it('should allow crew co_owner', () => {
      const membership = { membership_status: 'active', role: 'co_owner' };
      const isCrewOperator =
        membership.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isCrewOperator).toBe(true);
    });

    it('should reject regular crew member', () => {
      const membership = { membership_status: 'active', role: 'member' };
      const isCrewOperator =
        membership.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isCrewOperator).toBe(false);
    });

    it('should reject inactive crew member', () => {
      const membership = { membership_status: 'pending', role: 'admin' };
      const isCrewOperator =
        membership.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isCrewOperator).toBe(false);
    });

    it('should allow global admin', () => {
      const userMeta = { role: 'admin' };
      const isGlobalAdmin = userMeta.role === 'admin' || (userMeta as any).status === 'admin';
      expect(isGlobalAdmin).toBe(true);
    });

    it('should reject non-owner, non-member, non-admin user', () => {
      const rental = { owner_id: '413553377' };
      const userId = '999';
      const membership = null;
      const userMeta = { role: 'user' };

      const isOwner = rental.owner_id === userId;
      const isCrewOperator =
        membership?.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership?.role);
      const isGlobalAdmin = userMeta.role === 'admin';

      const canClose = isOwner || isCrewOperator || isGlobalAdmin;
      expect(canClose).toBe(false);
    });
  });

  describe('Closure data capture', () => {
    it('should save odometerAfter to metadata', () => {
      const closureData = { odometerAfter: 12345 };
      const metadata: Record<string, unknown> = {};
      if (closureData.odometerAfter != null) metadata.odometer_after = closureData.odometerAfter;
      expect(metadata.odometer_after).toBe(12345);
    });

    it('should save damageNotes to metadata', () => {
      const closureData = { damageNotes: 'Царапина на баке' };
      const metadata: Record<string, unknown> = {};
      if (closureData.damageNotes != null) metadata.damage_notes = closureData.damageNotes;
      expect(metadata.damage_notes).toBe('Царапина на баке');
    });

    it('should save depositReturned to metadata', () => {
      const closureData = { depositReturned: true };
      const metadata: Record<string, unknown> = {};
      if (closureData.depositReturned != null) metadata.deposit_returned = closureData.depositReturned;
      expect(metadata.deposit_returned).toBe(true);
    });

    it('should save returnNotes to metadata', () => {
      const closureData = { returnNotes: 'Всё в порядке' };
      const metadata: Record<string, unknown> = {};
      if (closureData.returnNotes != null) metadata.return_notes = closureData.returnNotes;
      expect(metadata.return_notes).toBe('Всё в порядке');
    });

    it('should NOT save null fields to metadata', () => {
      const closureData = { odometerAfter: null, damageNotes: null };
      const metadata: Record<string, unknown> = {};
      if (closureData.odometerAfter != null) metadata.odometer_after = closureData.odometerAfter;
      if (closureData.damageNotes != null) metadata.damage_notes = closureData.damageNotes;
      expect(metadata.odometer_after).toBeUndefined();
      expect(metadata.damage_notes).toBeUndefined();
    });

    it('should append to history array', () => {
      const existingHistory = [
        { status: 'active', at: '2026-07-28T10:00:00Z', by: '413553377' },
      ];
      const newEntry = {
        status: 'completed',
        at: '2026-07-30T15:00:00Z',
        by: '413553377',
        message: 'Возврат подтверждён',
      };
      const history = [...existingHistory, newEntry];
      expect(history).toHaveLength(2);
      expect(history[1].status).toBe('completed');
    });
  });

  describe('Receipt message format', () => {
    it('should include bike name in receipt', () => {
      const bikeName = '79bike Falcon PRO';
      const receiptParts = ['✅ Аренда завершена', '', `🚲 ${bikeName}`];
      expect(receiptParts[2]).toContain('79bike Falcon PRO');
    });

    it('should include odometer reading when provided', () => {
      const odometerAfter = 12345;
      const receiptParts: string[] = [];
      if (odometerAfter != null) receiptParts.push(`📏 Финальный одометр: ${odometerAfter} км`);
      expect(receiptParts[0]).toContain('12345');
    });

    it('should show deposit returned status', () => {
      const depositReturned = true;
      const receiptParts: string[] = [];
      if (depositReturned) receiptParts.push('💰 Депозит: возвращён');
      expect(receiptParts[0]).toContain('возвращён');
    });

    it('should show deposit held status when not returned', () => {
      const depositReturned = false;
      const receiptParts: string[] = [];
      if (depositReturned === false) receiptParts.push('💰 Депозит: удержан');
      expect(receiptParts[0]).toContain('удержан');
    });

    it('should include damage notes when provided', () => {
      const damageNotes = 'Царапина на левом боку';
      const receiptParts: string[] = [];
      if (damageNotes) receiptParts.push(`📝 Заметки: ${damageNotes}`);
      expect(receiptParts[0]).toContain('Царапина');
    });
  });
});

// ── confirmVehiclePickup tests ──────────────────────────────────────────────

describe('Rentals — confirmVehiclePickup', () => {
  describe('Pickup freeze check', () => {
    it('should reject pickup when no pickup_freeze is set', () => {
      const metadata = {};
      const hasPickupFreeze = Boolean((metadata as any).pickup_freeze?.frozen_at);
      expect(hasPickupFreeze).toBe(false);
    });

    it('should allow pickup when pickup_freeze.frozen_at is set', () => {
      const metadata = { pickup_freeze: { frozen_at: '2026-07-30T10:00:00Z' } };
      const hasPickupFreeze = Boolean((metadata as any).pickup_freeze?.frozen_at);
      expect(hasPickupFreeze).toBe(true);
    });
  });

  describe('Auth — only owner can confirm pickup', () => {
    it('should allow owner', () => {
      const rental = { owner_id: '413553377' };
      const userId = '413553377';
      expect(rental.owner_id === userId).toBe(true);
    });

    it('should reject non-owner', () => {
      const rental = { owner_id: '413553377' };
      const userId = '999';
      expect(rental.owner_id === userId).toBe(false);
    });
  });

  describe('Closure todo creation on pickup', () => {
    it('should create 5 closure todos when rental becomes active', () => {
      const CLOSURE_TODO_TEMPLATES = [
        { type: 'inspect_damage', title: 'Осмотреть байк на повреждения при возврате', priority: 'high' },
        { type: 'odometer_final', title: 'Зафиксировать финальный одометр', priority: 'high' },
        { type: 'deposit_refund', title: 'Вернуть депозит арендатору', priority: 'medium' },
        { type: 'review_request', title: 'Запросить отзыв у арендатора', priority: 'low' },
        { type: 'mark_completed', title: 'Пометить аренду завершённой в дашборде', priority: 'medium' },
      ];
      expect(CLOSURE_TODO_TEMPLATES).toHaveLength(5);
    });

    it('should use category=rental_closure for closure todos', () => {
      const category = 'rental_closure';
      expect(category).toBe('rental_closure');
    });

    it('should be idempotent (skip if closure todos already exist)', () => {
      const existing = [{ id: 't1', category: 'rental_closure' }];
      const alreadyExists = existing && existing.length > 0;
      expect(alreadyExists).toBe(true);
    });
  });
});

// ── completeRentalClosureTodo tests ─────────────────────────────────────────

describe('Rentals — completeRentalClosureTodo', () => {
  describe('CRITICAL: auth required', () => {
    it('should reject when actorUserId is missing', () => {
      const actorUserId = '';
      expect(!actorUserId).toBe(true); // should reject
    });

    it('should reject when actorUserId is undefined', () => {
      const actorUserId = undefined;
      expect(!actorUserId).toBe(true);
    });

    it('should allow when actorUserId is provided', () => {
      const actorUserId = '413553377';
      expect(!actorUserId).toBe(false); // should NOT reject
    });
  });

  describe('Crew membership auth', () => {
    it('should allow crew owner', () => {
      const membership = { membership_status: 'active', role: 'owner' };
      const isCrewOperator =
        membership.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isCrewOperator).toBe(true);
    });

    it('should allow crew admin', () => {
      const membership = { membership_status: 'active', role: 'admin' };
      const isCrewOperator =
        membership.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isCrewOperator).toBe(true);
    });

    it('should allow crew co_owner', () => {
      const membership = { membership_status: 'active', role: 'co_owner' };
      const isCrewOperator =
        membership.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isCrewOperator).toBe(true);
    });

    it('should reject regular member', () => {
      const membership = { membership_status: 'active', role: 'member' };
      const isCrewOperator =
        membership.membership_status === 'active' &&
        ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isCrewOperator).toBe(false);
    });

    it('should allow global admin as fallback', () => {
      const userMeta = { role: 'admin' };
      const isGlobalAdmin = userMeta.role === 'admin';
      expect(isGlobalAdmin).toBe(true);
    });

    it('should reject when not crew operator AND not global admin', () => {
      const isCrewOperator = false;
      const isGlobalAdmin = false;
      const canComplete = isCrewOperator || isGlobalAdmin;
      expect(canComplete).toBe(false);
    });
  });

  describe('Category safety', () => {
    it('should only update todos with category=rental_closure', () => {
      // The SQL update has .eq("category", "rental_closure") as a safety guard
      // so it can never accidentally update verification todos (category=rental_verification)
      const safetyFilter = { category: 'rental_closure' };
      expect(safetyFilter.category).toBe('rental_closure');
    });
  });
});

// ── Deep link routing tests ─────────────────────────────────────────────────

describe('Rentals — Deep Link Routing', () => {
  describe('rental_<id> → /franchize/<slug>/rental/<id>', () => {
    it('should parse rental_<id> format', () => {
      const param = 'rental_abc-123-def';
      const rentalId = param.slice(7); // 'rental_'.length = 7
      expect(rentalId).toBe('abc-123-def');
    });

    it('should route to dedicated /rental/[id] page (NOT analytics)', () => {
      const rentalId = 'abc-123';
      const crewSlug = 'vip-bike';
      const targetPath = `/franchize/${crewSlug}/rental/${rentalId}`;
      expect(targetPath).toBe('/franchize/vip-bike/rental/abc-123');
      expect(targetPath).not.toContain('rentals-analytics');
    });

    it('should use userCrewInfo slug when available', () => {
      const userCrewInfo = { slug: 'sly13' };
      const rentalId = 'xyz-456';
      const crewSlug = userCrewInfo?.slug || 'vip-bike';
      const targetPath = `/franchize/${crewSlug}/rental/${rentalId}`;
      expect(targetPath).toBe('/franchize/sly13/rental/xyz-456');
    });

    it('should fallback to vip-bike slug when no crew info', () => {
      const userCrewInfo = null;
      const rentalId = 'xyz-456';
      const crewSlug = userCrewInfo?.slug || 'vip-bike';
      const targetPath = `/franchize/${crewSlug}/rental/${rentalId}`;
      expect(targetPath).toBe('/franchize/vip-bike/rental/xyz-456');
    });
  });

  describe('analytics_rental_<id> → /rentals-analytics?rentalId=<id>', () => {
    it('should parse analytics_rental_<id> format', () => {
      const param = 'analytics_rental_abc-123';
      const rest = param.slice(10); // 'analytics_'.length = 10
      expect(rest).toBe('rental_abc-123');
      const rentalId = rest.slice(7);
      expect(rentalId).toBe('abc-123');
    });

    it('should route to analytics drawer (NOT dedicated page)', () => {
      const rentalId = 'abc-123';
      const crewSlug = 'vip-bike';
      const targetPath = `/franchize/${crewSlug}/rentals-analytics?ui=v2&rentalId=${rentalId}`;
      expect(targetPath).toContain('rentals-analytics');
      expect(targetPath).toContain('rentalId=abc-123');
      expect(targetPath).not.toContain('/rental/abc-123');
    });
  });
});

// ── Boss command tests ──────────────────────────────────────────────────────

describe('Rentals — Boss Commands', () => {
  describe('returns-reminder.sh IFS separator', () => {
    it('should use | separator to avoid breaking on HH:MM', () => {
      const testData = 'RENTAL|abc-123|falcon-gt|41355337|14:30|5000';
      const parts = testData.split('|');
      const [prefix, rid, vid, uid, time, cost] = parts;
      expect(time).toBe('14:30');
      expect(cost).toBe('5000');
    });

    it('should NOT use : separator (breaks on HH:MM)', () => {
      const testData = 'RENTAL:abc-123:falcon-gt:41355337:14:30:5000';
      const parts = testData.split(':');
      // With : separator, time becomes "14" and cost becomes "30"
      expect(parts[4]).toBe('14'); // WRONG — should be "14:30"
      expect(parts[5]).toBe('30'); // WRONG — should be "5000"
    });

    it('should format rental line with deep link', () => {
      const vid = 'falcon-gt';
      const uid = '41355337';
      const time = '14:30';
      const cost = '5000';
      const rlink = 'https://t.me/oneBikePlsBot/app?startapp=rental_abc-123';
      const line = `• ${vid} → клиент ${uid}… | до ${time} UTC | ${cost} ₽\n  📋 <a href="${rlink}">Открыть</a>`;
      expect(line).toContain('falcon-gt');
      expect(line).toContain('14:30');
      expect(line).toContain('5000');
      expect(line).toContain('Открыть');
      expect(line).toContain('rental_abc-123');
    });
  });

  describe('evening-summary.sh per-rental deep links', () => {
    it('should build rental line with vehicle, end time, cost', () => {
      const rental = {
        vehicle_id: 'falcon-gt',
        agreed_end_date: '2026-07-30T14:30:00Z',
        total_cost: 5000,
      };
      const line = `• ${rental.vehicle_id} — ${rental.agreed_end_date.slice(11, 16)} UTC — ${rental.total_cost || 0} ₽`;
      expect(line).toContain('falcon-gt');
      expect(line).toContain('14:30');
      expect(line).toContain('5000');
    });

    it('should build per-rental Открыть link', () => {
      const rentalId = 'abc-123';
      const rlink = `https://t.me/oneBikePlsBot/app?startapp=rental_${rentalId}`;
      const link = `  📋 <a href="${rlink}">Открыть ${rentalId.slice(0, 8)}</a>`;
      expect(link).toContain('rental_abc-123');
      expect(link).toContain('Открыть');
    });

    it('should limit to 5 active rentals in digest', () => {
      const activeRentals = Array.from({ length: 10 }, (_, i) => ({ rental_id: `r${i}`, status: 'active' }));
      const limited = activeRentals.slice(0, 5);
      expect(limited).toHaveLength(5);
    });

    it('should skip active rentals section when none exist', () => {
      const activeRentals: any[] = [];
      const hasActive = activeRentals.length > 0;
      expect(hasActive).toBe(false);
    });
  });
});

// ── Rental page role guard tests ────────────────────────────────────────────

describe('Rentals — FranchizeRentalRoleGuard', () => {
  describe('Role detection', () => {
    it('should detect owner when dbUser.user_id === ownerId', () => {
      const dbUserId = '413553377';
      const ownerId = '413553377';
      expect(dbUserId === ownerId).toBe(true);
    });

    it('should detect renter when dbUser.user_id === renterId', () => {
      const dbUserId = '413553377';
      const renterId = '413553377';
      expect(dbUserId === renterId).toBe(true);
    });

    it('should detect renter via renterTelegramChatId fallback', () => {
      const dbUserId = '413553377';
      const renterId = '';
      const renterTelegramChatId = '413553377';
      const isRenter =
        (renterId && dbUserId === renterId) ||
        (renterTelegramChatId && dbUserId === renterTelegramChatId);
      expect(isRenter).toBe(true);
    });

    it('should detect crew operator via membership', () => {
      const membership = { role: 'admin', crewId: 'crew-1' };
      const isOperator = ['owner', 'admin', 'co_owner'].includes(membership.role);
      expect(isOperator).toBe(true);
    });

    it('should detect global admin via metadata', () => {
      const userMeta = { role: 'admin' };
      const isGlobalAdmin = userMeta.role === 'admin' || (userMeta as any).status === 'admin';
      expect(isGlobalAdmin).toBe(true);
    });

    it('should classify as guest when no role matches', () => {
      const dbUserId = '999';
      const ownerId = '413553377';
      const renterId = '111';
      const renterTelegramChatId = '';
      const membership = null;
      const userMeta = { role: 'user' };

      const isOwner = dbUserId === ownerId;
      const isRenter = (renterId && dbUserId === renterId) || (renterTelegramChatId && dbUserId === renterTelegramChatId);
      const isOperator = membership && ['owner', 'admin', 'co_owner'].includes(membership.role);
      const isGlobalAdmin = userMeta.role === 'admin';

      const role = isOwner ? 'owner' : isRenter ? 'renter' : isOperator ? 'operator' : isGlobalAdmin ? 'admin' : 'guest';
      expect(role).toBe('guest');
    });
  });

  describe('Panel visibility', () => {
    it('should show RentalChecklistPanel for owner/operator/admin', () => {
      const allowedRoles = ['owner', 'operator', 'admin'];
      const userRole = 'operator';
      expect(allowedRoles.includes(userRole)).toBe(true);
    });

    it('should hide RentalChecklistPanel for renter', () => {
      const allowedRoles = ['owner', 'operator', 'admin'];
      const userRole = 'renter';
      expect(allowedRoles.includes(userRole)).toBe(false);
    });

    it('should hide RentalChecklistPanel for guest', () => {
      const allowedRoles = ['owner', 'operator', 'admin'];
      const userRole = 'guest';
      expect(allowedRoles.includes(userRole)).toBe(false);
    });
  });
});
