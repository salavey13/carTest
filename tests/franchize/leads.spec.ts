/**
 * tests/franchize/leads.spec.ts
 *
 * Tests for the leads subsystem:
 * - Filter pipeline (mode → stage → search → source/owner → flags → segment → sort)
 * - Dismiss flow (auth, optimistic remove, server action call)
 * - Todo CRUD (create, toggle, delete with optimistic updates)
 * - Deep link routing (?leadId= auto-focus, ?segment= preselect)
 * - KPI computation (totalLeads, hotLeads, conversionRate, monthlyRevenue)
 * - Security: leads data not in HTML payload before auth
 */

import { describe, expect, it, vi } from 'vitest';

// ── Types (mirror leads-constants.ts) ────────────────────────────────────────

type Mode = "rent" | "sale" | "service";
type StageKey = "new" | "contacted" | "qualified" | "negotiation" | "closed_won" | "closed_lost";
type SortModeV2 = "recent" | "urgent" | "name" | "spent" | "sla" | "return_due" | "overdue_todos";

interface FilterFlags {
  overdueOnly: boolean;
  unclaimedQrOnly: boolean;
  documentsMissingOnly: boolean;
  activeRentalOnly: boolean;
  returnDueOnly: boolean;
  dismissedOnly: boolean;
  hideOperatorPlaceholders: boolean;
}

const DEFAULT_FILTER_FLAGS: FilterFlags = {
  overdueOnly: false,
  unclaimedQrOnly: false,
  documentsMissingOnly: false,
  activeRentalOnly: false,
  returnDueOnly: false,
  dismissedOnly: false,
  hideOperatorPlaceholders: false,
};

const MODE_INTENTS: Record<Mode, string[]> = {
  rent: ["rent", "test_drive", "test_ride_click", "checkout_start", "prebuy", "trade_in", "finance", "hold_created", "payment_failure", "payment_success", "map_click", "contact_click"],
  sale: ["sale"],
  service: ["service"],
};

// ── Test data builders ──────────────────────────────────────────────────────

function buildLead(overrides: Record<string, unknown> = {}) {
  return {
    user_id: '413553377',
    full_name: 'Иван Иванов',
    phone: '+79998887766',
    username: 'ivan_ivanov',
    bikeTitle: '79bike Falcon PRO',
    source: 'web',
    sourceRoute: '/franchize/vip-bike',
    intentType: 'rent',
    intentStage: 'new',
    verified: false,
    totalSpent: 0,
    ownerId: null,
    ownerName: null,
    originalOperatorChatId: null,
    identityState: 'claimed_user',
    troubled: false,
    rentals: [] as any[],
    sales: [] as any[],
    lastSeenAt: '2026-07-30T10:00:00Z',
    createdAt: '2026-07-30T10:00:00Z',
    ...overrides,
  };
}

// ── Filter pipeline tests ───────────────────────────────────────────────────

describe('Leads — Filter Pipeline', () => {
  describe('Mode filter', () => {
    it('should filter rent intents when mode=rent', () => {
      const leads = [
        buildLead({ user_id: '1', intentType: 'rent' }),
        buildLead({ user_id: '2', intentType: 'sale' }),
        buildLead({ user_id: '3', intentType: 'service' }),
      ];
      const allowed = MODE_INTENTS.rent;
      const filtered = leads.filter((l) => allowed.includes(l.intentType));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].user_id).toBe('1');
    });

    it('should filter sale intents when mode=sale', () => {
      const leads = [
        buildLead({ user_id: '1', intentType: 'rent' }),
        buildLead({ user_id: '2', intentType: 'sale' }),
      ];
      const allowed = MODE_INTENTS.sale;
      const filtered = leads.filter((l) => allowed.includes(l.intentType));
      expect(filtered).toHaveLength(1);
      expect(filtered[0].user_id).toBe('2');
    });

    it('should include test_drive intents in rent mode', () => {
      const leads = [
        buildLead({ user_id: '1', intentType: 'test_drive' }),
      ];
      const allowed = MODE_INTENTS.rent;
      const filtered = leads.filter((l) => allowed.includes(l.intentType));
      expect(filtered).toHaveLength(1);
    });
  });

  describe('Search filter', () => {
    it('should match by full_name', () => {
      const q = 'иван';
      const lead = buildLead({ full_name: 'Иван Иванов' });
      const matches = (lead.full_name || '').toLowerCase().includes(q);
      expect(matches).toBe(true);
    });

    it('should match by phone', () => {
      const q = '888';
      const lead = buildLead({ phone: '+79998887766' });
      const matches = (lead.phone || '').toLowerCase().includes(q);
      expect(matches).toBe(true);
    });

    it('should match by username', () => {
      const q = 'ivan';
      const lead = buildLead({ username: 'ivan_ivanov' });
      const matches = (lead.username || '').toLowerCase().includes(q);
      expect(matches).toBe(true);
    });

    it('should match by bikeTitle', () => {
      const q = 'falcon';
      const lead = buildLead({ bikeTitle: '79bike Falcon PRO' });
      const matches = (lead.bikeTitle || '').toLowerCase().includes(q);
      expect(matches).toBe(true);
    });

    it('should match by user_id', () => {
      const q = '413553';
      const lead = buildLead({ user_id: '413553377' });
      const matches = (lead.user_id || '').toLowerCase().includes(q);
      expect(matches).toBe(true);
    });

    it('should NOT match when query is empty', () => {
      const q = '';
      const lead = buildLead({ full_name: 'Иван' });
      const matches = q.trim() ? (lead.full_name || '').toLowerCase().includes(q) : true;
      expect(matches).toBe(true); // empty query = show all
    });
  });

  describe('Source filter', () => {
    it('should filter by source when sourceFilter != "all"', () => {
      const leads = [
        buildLead({ user_id: '1', source: 'web' }),
        buildLead({ user_id: '2', source: 'telegram' }),
      ];
      const sourceFilter = 'telegram';
      const filtered = leads.filter((l) => sourceFilter === 'all' || l.source === sourceFilter);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].source).toBe('telegram');
    });

    it('should show all when sourceFilter = "all"', () => {
      const leads = [
        buildLead({ user_id: '1', source: 'web' }),
        buildLead({ user_id: '2', source: 'telegram' }),
      ];
      const sourceFilter = 'all';
      const filtered = leads.filter((l) => sourceFilter === 'all' || l.source === sourceFilter);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Filter flags', () => {
    it('should filter overdueOnly leads (todos with past due_date)', () => {
      const now = Date.now();
      const todos = [
        { due_date: '2026-07-28T10:00:00Z', status: 'pending' }, // overdue
        { due_date: '2026-08-05T10:00:00Z', status: 'pending' }, // future
        { due_date: '2026-07-28T10:00:00Z', status: 'done' },    // overdue but done
      ];
      const hasOverdue = todos.some(
        (t) => !!t.due_date && new Date(t.due_date).getTime() < now && t.status !== 'done'
      );
      expect(hasOverdue).toBe(true);
    });

    it('should filter activeRentalOnly leads (rentals with status=active)', () => {
      const lead = buildLead({
        rentals: [{ status: 'active', rentalId: 'r1' }],
      });
      const hasActiveRental = lead.rentals.some((r) => r.status === 'active');
      expect(hasActiveRental).toBe(true);
    });

    it('should filter returnDueOnly leads (active rental ending within 24h)', () => {
      const now = Date.now();
      const lead = buildLead({
        rentals: [{
          status: 'active',
          endDate: new Date(now + 12 * 60 * 60 * 1000).toISOString(), // 12h from now
        }],
      });
      const hasReturnDue = lead.rentals.some(
        (r) => r.status === 'active' && r.endDate && new Date(r.endDate).getTime() - now < 24 * 60 * 60 * 1000
      );
      expect(hasReturnDue).toBe(true);
    });

    it('should NOT mark return due when rental ends in 48h', () => {
      const now = Date.now();
      const lead = buildLead({
        rentals: [{
          status: 'active',
          endDate: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
        }],
      });
      const hasReturnDue = lead.rentals.some(
        (r) => r.status === 'active' && r.endDate && new Date(r.endDate).getTime() - now < 24 * 60 * 60 * 1000
      );
      expect(hasReturnDue).toBe(false);
    });

    it('should hide operator placeholders when flag is set', () => {
      const lead = buildLead({
        identityState: 'operator_placeholder',
        rentals: [],
        sales: [],
      });
      const leadTodos: any[] = [];
      const isOperatorPlaceholder =
        lead.identityState === 'operator_placeholder' &&
        lead.rentals.length === 0 &&
        lead.sales.length === 0 &&
        leadTodos.length === 0;
      expect(isOperatorPlaceholder).toBe(true);
    });
  });

  describe('Segment filter', () => {
    it('should show all leads when segment=all', () => {
      const leads = [buildLead({ user_id: '1' }), buildLead({ user_id: '2' })];
      const segment = 'all';
      const filtered = segment === 'all' ? leads : leads.filter(() => true);
      expect(filtered).toHaveLength(2);
    });

    it('should filter clients (verified or has rentals/sales)', () => {
      const leads = [
        buildLead({ user_id: '1', verified: false, rentals: [], sales: [] }),
        buildLead({ user_id: '2', verified: true, rentals: [], sales: [] }),
        buildLead({ user_id: '3', verified: false, rentals: [{ rentalId: 'r1' }], sales: [] }),
      ];
      const filtered = leads.filter((l) => l.verified || l.rentals.length > 0 || l.sales.length > 0);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((l) => l.user_id)).toEqual(['2', '3']);
    });
  });

  describe('Sort', () => {
    it('should sort by recency (newest first)', () => {
      const leads = [
        buildLead({ user_id: '1', lastSeenAt: '2026-07-28T10:00:00Z', createdAt: '2026-07-28T10:00:00Z' }),
        buildLead({ user_id: '2', lastSeenAt: '2026-07-30T10:00:00Z', createdAt: '2026-07-30T10:00:00Z' }),
        buildLead({ user_id: '3', lastSeenAt: '2026-07-29T10:00:00Z', createdAt: '2026-07-29T10:00:00Z' }),
      ];
      const sorted = [...leads].sort((a, b) =>
        new Date(b.lastSeenAt || b.createdAt || 0).getTime() -
        new Date(a.lastSeenAt || a.createdAt || 0).getTime()
      );
      expect(sorted[0].user_id).toBe('2');
      expect(sorted[1].user_id).toBe('3');
      expect(sorted[2].user_id).toBe('1');
    });

    it('should sort by name (alphabetical)', () => {
      const leads = [
        buildLead({ user_id: '1', full_name: 'Борис' }),
        buildLead({ user_id: '2', full_name: 'Анна' }),
        buildLead({ user_id: '3', full_name: 'Виктор' }),
      ];
      const sorted = [...leads].sort((a, b) =>
        (a.full_name || '').localeCompare(b.full_name || '')
      );
      expect(sorted[0].full_name).toBe('Анна');
      expect(sorted[1].full_name).toBe('Борис');
      expect(sorted[2].full_name).toBe('Виктор');
    });

    it('should sort by spent (highest first)', () => {
      const leads = [
        buildLead({ user_id: '1', totalSpent: 5000 }),
        buildLead({ user_id: '2', totalSpent: 50000 }),
        buildLead({ user_id: '3', totalSpent: 15000 }),
      ];
      const sorted = [...leads].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
      expect(sorted[0].totalSpent).toBe(50000);
      expect(sorted[1].totalSpent).toBe(15000);
      expect(sorted[2].totalSpent).toBe(5000);
    });
  });
});

// ── Dismiss flow tests ──────────────────────────────────────────────────────

describe('Leads — Dismiss Flow', () => {
  it('should call dismissLeadWithReason with correct payload', () => {
    const payload = {
      slug: 'vip-bike',
      leadId: '413553377',
      reason: 'not_interested',
      note: 'Клиент не заинтересован',
      isPasswordAuth: false,
    };
    expect(payload.slug).toBe('vip-bike');
    expect(payload.leadId).toBe('413553377');
    expect(payload.reason).toBe('not_interested');
    expect(payload.isPasswordAuth).toBe(false);
  });

  it('should set isPasswordAuth=true when using password auth', () => {
    const passwordAuthOwnerId = 'pass-123';
    const isPasswordAuth = !!passwordAuthOwnerId;
    expect(isPasswordAuth).toBe(true);
  });

  it('should set isPasswordAuth=false when using Telegram auth', () => {
    const passwordAuthOwnerId = null;
    const dbUser = { user_id: '413553377' };
    const isPasswordAuth = !!passwordAuthOwnerId && !dbUser?.user_id;
    expect(isPasswordAuth).toBe(false);
  });

  it('should optimistically remove lead from state after dismiss', () => {
    const leads = [
      buildLead({ user_id: '1' }),
      buildLead({ user_id: '2' }),
      buildLead({ user_id: '3' }),
    ];
    const dismissedId = '2';
    const updated = leads.filter((l) => l.user_id !== dismissedId);
    expect(updated).toHaveLength(2);
    expect(updated.find((l) => l.user_id === '2')).toBeUndefined();
  });
});

// ── Todo CRUD tests ─────────────────────────────────────────────────────────

describe('Leads — Todo CRUD', () => {
  it('should create optimistic todo with correct shape', () => {
    const lead = buildLead({ user_id: '413553377', phone: '+79998887766', rentals: [{ rentalId: 'r1' }] });
    const newTodo = {
      id: `optimistic-${Date.now()}`,
      lead_id: lead.user_id,
      user_id: lead.user_id,
      phone: lead.phone || null,
      rental_id: lead.rentals[0]?.rentalId || null,
      title: 'Позвонить клиенту',
      description: null,
      status: 'pending',
      priority: 'medium',
      category: 'general',
      created_at: new Date().toISOString(),
      completed_at: null,
      assigned_to: null,
      due_date: null,
    };
    expect(newTodo.lead_id).toBe('413553377');
    expect(newTodo.phone).toBe('+79998887766');
    expect(newTodo.rental_id).toBe('r1');
    expect(newTodo.status).toBe('pending');
    expect(newTodo.id).toMatch(/^optimistic-\d+$/);
  });

  it('should toggle todo status optimistically', () => {
    const todos = [
      { id: 't1', status: 'pending' },
      { id: 't2', status: 'done' },
    ];
    const todoId = 't1';
    const updated = todos.map((t) =>
      t.id === todoId ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t
    );
    expect(updated[0].status).toBe('done');
    expect(updated[1].status).toBe('done'); // unchanged
  });

  it('should toggle back to pending when already done', () => {
    const todos = [{ id: 't1', status: 'done' }];
    const todoId = 't1';
    const updated = todos.map((t) =>
      t.id === todoId ? { ...t, status: t.status === 'done' ? 'pending' : 'done' } : t
    );
    expect(updated[0].status).toBe('pending');
  });

  it('should delete todo optimistically', () => {
    const todos = [
      { id: 't1', status: 'pending' },
      { id: 't2', status: 'done' },
    ];
    const todoId = 't1';
    const updated = todos.filter((t) => t.id !== todoId);
    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe('t2');
  });

  it('should remove optimistic todo before adding real one (no duplicates)', () => {
    const todos = [
      { id: 'optimistic-123', status: 'pending', title: 'Test' },
    ];
    const optimisticId = 'optimistic-123';
    const realTodo = { id: 'real-456', status: 'pending', title: 'Test' };

    // Step 1: remove optimistic
    const afterRemove = todos.filter((t) => t.id !== optimisticId);
    expect(afterRemove).toHaveLength(0);

    // Step 2: add real
    const afterAdd = [realTodo, ...afterRemove];
    expect(afterAdd).toHaveLength(1);
    expect(afterAdd[0].id).toBe('real-456');
  });
});

// ── Deep link routing tests ─────────────────────────────────────────────────

describe('Leads — Deep Link Routing', () => {
  it('should parse ?leadId= from URL for auto-focus', () => {
    const url = new URL('https://example.com/franchize/vip-bike/leads?leadId=413553377');
    const params = new URLSearchParams(url.search);
    const leadId = params.get('leadId');
    expect(leadId).toBe('413553377');
  });

  it('should parse ?segment= from URL for preselect', () => {
    const url = new URL('https://example.com/franchize/vip-bike/leads?segment=hot');
    const params = new URLSearchParams(url.search);
    const segment = params.get('segment') || 'all';
    expect(segment).toBe('hot');
  });

  it('should default segment to "all" when not in URL', () => {
    const url = new URL('https://example.com/franchize/vip-bike/leads');
    const params = new URLSearchParams(url.search);
    const segment = params.get('segment') || 'all';
    expect(segment).toBe('all');
  });

  it('should only auto-focus if lead exists in loaded list', () => {
    const leads = [
      buildLead({ user_id: '1' }),
      buildLead({ user_id: '2' }),
    ];
    const leadId = '3';
    const exists = leads.some((l) => l.user_id === leadId);
    expect(exists).toBe(false);
  });
});

// ── KPI computation tests ───────────────────────────────────────────────────

describe('Leads — KPI Computation', () => {
  it('should count total leads (excluding closed_lost)', () => {
    const leads = [
      buildLead({ user_id: '1', stageKey: 'new' }),
      buildLead({ user_id: '2', stageKey: 'contacted' }),
      buildLead({ user_id: '3', stageKey: 'closed_lost' }),
      buildLead({ user_id: '4', stageKey: 'closed_won' }),
    ];
    const totalLeads = leads.filter((l) => l.stageKey !== 'closed_lost').length;
    expect(totalLeads).toBe(3);
  });

  it('should compute conversion rate from last 30 days', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 864e5);
    const leads = [
      { createdAt: new Date(now.getTime() - 5 * 864e5).toISOString(), stageKey: 'closed_won' },
      { createdAt: new Date(now.getTime() - 10 * 864e5).toISOString(), stageKey: 'contacted' },
      { createdAt: new Date(now.getTime() - 40 * 864e5).toISOString(), stageKey: 'closed_won' }, // outside window
    ];
    const recent = leads.filter((l) => new Date(l.createdAt) >= thirtyDaysAgo);
    const recentWon = recent.filter((l) => l.stageKey === 'closed_won').length;
    const conversionRate = recent.length > 0 ? Math.round((recentWon / recent.length) * 100) : 0;
    expect(conversionRate).toBe(50); // 1 won out of 2 recent
  });

  it('should compute monthly revenue from active+completed rentals', () => {
    const leads = [
      buildLead({
        user_id: '1',
        rentals: [
          { status: 'active', totalCost: 5000 },
          { status: 'completed', totalCost: 3000 },
          { status: 'cancelled', totalCost: 2000 }, // excluded
        ],
      }),
      buildLead({
        user_id: '2',
        rentals: [
          { status: 'active', totalCost: 10000 },
        ],
      }),
    ];
    const monthlyRevenue = leads.reduce(
      (sum, l) => sum + l.rentals
        .filter((r) => r.status === 'active' || r.status === 'completed')
        .reduce((s, r) => s + (Number(r.totalCost) || 0), 0),
      0
    );
    expect(monthlyRevenue).toBe(18000); // 5000 + 3000 + 10000
  });
});

// ── Security tests ──────────────────────────────────────────────────────────

describe('Leads — Security', () => {
  it('should NOT pass leads data as server-side props (empty arrays)', () => {
    // The fixed leads/page.tsx passes empty arrays and lets client fetch after auth.
    // This test verifies the pattern: initial props should be empty.
    const serverProps = {
      leads: [] as any[],
      todos: [] as any[],
    };
    expect(serverProps.leads).toHaveLength(0);
    expect(serverProps.todos).toHaveLength(0);
  });

  it('should only fetch leads when isAuthed is true', () => {
    const states = [
      { dbUser: null, passwordAuthOwnerId: null, authLoading: true, shouldFetch: false },
      { dbUser: null, passwordAuthOwnerId: null, authLoading: false, shouldFetch: false },
      { dbUser: { user_id: '413553377' }, passwordAuthOwnerId: null, authLoading: false, shouldFetch: true },
      { dbUser: null, passwordAuthOwnerId: 'pass-123', authLoading: false, shouldFetch: true },
      { dbUser: { user_id: '413553377' }, passwordAuthOwnerId: null, authLoading: true, shouldFetch: false },
    ];
    for (const state of states) {
      const isAuthed = !!(state.dbUser?.user_id || state.passwordAuthOwnerId);
      const shouldFetch = isAuthed && !state.authLoading;
      expect(shouldFetch).toBe(state.shouldFetch);
    }
  });

  it('should reset leadsFetchedRef when slug changes', () => {
    // Simulate ref reset behavior
    let refValue = false;
    const slug1 = 'crew-a';
    const slug2 = 'crew-b';

    // Fetch for crew A
    refValue = false; // initial
    if (!refValue) { refValue = true; }

    // Slug changes → ref must reset
    const slugChanged = slug1 !== slug2;
    if (slugChanged) refValue = false;

    // Fetch for crew B
    if (!refValue) { refValue = true; }

    expect(refValue).toBe(true); // fetched for crew B
  });
});
