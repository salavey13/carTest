import { describe, expect, it, vi, beforeEach } from 'vitest';

// ── Mock supabase ────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  from: vi.fn(),
}));

mocks.from.mockReturnValue({
  insert: mocks.insert,
  select: vi.fn(() => ({ data: [], error: null })),
  eq: vi.fn(() => ({ data: [], error: null })),
  gte: vi.fn(() => ({
    lte: vi.fn(() => ({
      order: vi.fn(() => ({ data: [], error: null })),
    })),
  })),
  order: vi.fn(() => ({ data: [], error: null })),
});

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: mocks.from },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/app/lib/user-rental-secrets', () => ({
  isCrewMember: vi.fn(() => false),
}));

vi.mock('@/app/franchize/server-actions/crew-todos', () => ({
  createLeadFollowupTodos: vi.fn(() => ({ success: true, created: 0, skipped: 0 })),
}));

vi.mock('@/app/franchize/server-actions/rental-verification-todos', () => ({
  createRentalVerificationTodos: vi.fn(),
}));

vi.mock('@/app/franchize/lib/docx-capability', () => ({
  buildFranchizeDocxFromTemplate: vi.fn(),
  uploadDocxToStorage: vi.fn(),
}));

vi.mock('@/app/franchize/lib/notification-templates', () => ({
  buildDocSuccessMessage: vi.fn(() => ({ text: '', buttons: [] })),
  buildDocAdminAuditMessage: vi.fn(() => ({ text: '', buttons: [] })),
}));

vi.mock('@/app/franchize/lib/pricing-calculator', () => ({
  calculatePriceForDuration: vi.fn(() => ({ tier: { period: '/ 1 день', price: 10000 }, subtotal: 10000, savings: 0 })),
  getHelmetPrice: vi.fn(() => 500),
}));

vi.mock('@/app/lib/rental-contract-vars', () => ({
  buildRentalContractVariables: vi.fn(() => ({})),
}));

vi.mock('@/app/lib/derive-access-tier', () => ({
  deriveUserAccessTier: vi.fn(() => 'standard'),
}));

vi.mock('@/app/lib/ocr-constants', () => ({
  ACCESS_TIERS: { standard: 'standard' },
}));

vi.mock('@/lib/rental-date-utils', () => ({
  resolveCrewOwnerChatId: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({}) })),
}));

// ── Import after mocks ──────────────────────────────────────────────────────
// We can't directly import doc-manual.ts (it's a server action file with many
// transitive deps), so we test the PURE LOGIC functions by extracting them.

// Instead, let's test the deposit_entries server actions and the deposit logic.

import { getDepositSummary, getDepositEntriesForDate, getDailyDepositSummary } from '@/app/franchize/server-actions/deposit-entries';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Deposit Entries — Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDepositSummary', () => {
    it('returns null for empty rentalId', async () => {
      const result = await getDepositSummary('');
      expect(result).toBeNull();
    });

    it('returns null when no deposit entries exist', async () => {
      mocks.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: [], error: null })),
          })),
        })),
      });

      const result = await getDepositSummary('test-rental-id');
      expect(result).toBeNull();
    });

    it('returns aggregated summary with correct totals', async () => {
      const mockEntries = [
        { id: '1', rental_id: 'r1', entry_type: 'deposit_collected', amount: 5000, direction: 'in', destination: 'cash', operator_chat_id: '123', notes: 'cash portion', created_at: '2026-08-10T12:00:00Z' },
        { id: '2', rental_id: 'r1', entry_type: 'deposit_collected', amount: 15000, direction: 'in', destination: 'tbank', operator_chat_id: '123', notes: 'tbank portion', created_at: '2026-08-10T12:00:00Z' },
        { id: '3', rental_id: 'r1', entry_type: 'deposit_returned', amount: 5000, direction: 'out', destination: 'cash', operator_chat_id: null, notes: 'auto-return', created_at: '2026-08-10T16:00:00Z' },
        { id: '4', rental_id: 'r1', entry_type: 'deposit_returned', amount: 15000, direction: 'out', destination: 'tbank', operator_chat_id: null, notes: 'auto-return', created_at: '2026-08-10T16:00:00Z' },
      ];

      mocks.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: mockEntries, error: null })),
          })),
        })),
      });

      const result = await getDepositSummary('r1');

      expect(result).not.toBeNull();
      expect(result!.totalCollected).toBe(20000);
      expect(result!.totalReturned).toBe(20000);
      expect(result!.totalPenalty).toBe(0);
      expect(result!.balance).toBe(0);
      expect(result!.destinations).toHaveLength(2);

      const cashDest = result!.destinations.find(d => d.destination === 'cash');
      expect(cashDest!.collected).toBe(5000);
      expect(cashDest!.returned).toBe(5000);
      expect(cashDest!.net).toBe(0);

      const tbankDest = result!.destinations.find(d => d.destination === 'tbank');
      expect(tbankDest!.collected).toBe(15000);
      expect(tbankDest!.returned).toBe(15000);
      expect(tbankDest!.net).toBe(0);
    });

    it('handles penalty entries correctly', async () => {
      const mockEntries = [
        { id: '1', rental_id: 'r1', entry_type: 'deposit_collected', amount: 20000, direction: 'in', destination: 'cash', operator_chat_id: '123', notes: '', created_at: '2026-08-10T12:00:00Z' },
        { id: '2', rental_id: 'r1', entry_type: 'penalty', amount: 3000, direction: 'out', destination: 'cash', operator_chat_id: '123', notes: 'scratched fairing', created_at: '2026-08-10T15:00:00Z' },
        { id: '3', rental_id: 'r1', entry_type: 'deposit_returned', amount: 17000, direction: 'out', destination: 'cash', operator_chat_id: null, notes: 'return minus penalty', created_at: '2026-08-10T16:00:00Z' },
      ];

      mocks.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ data: mockEntries, error: null })),
          })),
        })),
      });

      const result = await getDepositSummary('r1');

      expect(result!.totalCollected).toBe(20000);
      expect(result!.totalReturned).toBe(17000);
      expect(result!.totalPenalty).toBe(3000);
      expect(result!.balance).toBe(0); // 20000 - 17000 - 3000 = 0
    });
  });

  describe('getDailyDepositSummary', () => {
    it('returns empty array when no entries', async () => {
      mocks.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({ data: [], error: null })),
            })),
          })),
        })),
      });

      const result = await getDailyDepositSummary('2026-08-10');
      expect(result).toEqual([]);
    });

    it('aggregates by destination correctly', async () => {
      const mockEntries = [
        { destination: 'cash', entry_type: 'deposit_collected', amount: 5000, direction: 'in' },
        { destination: 'cash', entry_type: 'deposit_collected', amount: 10000, direction: 'in' },
        { destination: 'cash', entry_type: 'deposit_returned', amount: 5000, direction: 'out' },
        { destination: 'tbank', entry_type: 'deposit_collected', amount: 20000, direction: 'in' },
        { destination: 'sber', entry_type: 'penalty', amount: 2000, direction: 'out' },
      ];

      mocks.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          gte: vi.fn(() => ({
            lte: vi.fn(() => ({
              order: vi.fn(() => ({ data: mockEntries, error: null })),
            })),
          })),
        })),
      });

      const result = await getDailyDepositSummary('2026-08-10');

      expect(result).toHaveLength(3);

      const cash = result.find(d => d.destination === 'cash');
      expect(cash!.collected).toBe(15000);
      expect(cash!.returned).toBe(5000);
      expect(cash!.penalty).toBe(0);
      expect(cash!.net).toBe(10000);

      const tbank = result.find(d => d.destination === 'tbank');
      expect(tbank!.collected).toBe(20000);
      expect(tbank!.net).toBe(20000);

      const sber = result.find(d => d.destination === 'sber');
      expect(sber!.collected).toBe(0);
      expect(sber!.penalty).toBe(2000);
      expect(sber!.net).toBe(-2000);
    });
  });
});
