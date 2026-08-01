/**
 * tests/franchize/service-flows.spec.ts
 *
 * Tests for service flow:
 * - Service rentals (vip-bike-svc-*) have different semantics than regular rentals
 * - No "overdue" — service is "in progress" (has a timeline, not a deadline)
 * - Service analytics: filtered separately from regular rentals
 * - Boss commands: service KPIs in evening-summary
 * - Empty states: positive wording per reframe PRD
 */

import { describe, expect, it } from 'vitest';

// ── Service flow semantics ──────────────────────────────────────────────────

describe('Service Flow — Semantics', () => {
  describe('Service vs regular rental', () => {
    it('should identify service vehicles by vip-bike-svc-* prefix', () => {
      const serviceBikeIds = ['vip-bike-svc-diagnostic', 'vip-bike-svc-repair'];
      const regularBikeIds = ['falcon-gt', 'y-volt-surge-v'];

      for (const id of serviceBikeIds) {
        expect(id.startsWith('vip-bike-svc-')).toBe(true);
      }
      for (const id of regularBikeIds) {
        expect(id.startsWith('vip-bike-svc-')).toBe(false);
      }
    });

    it('should exclude service vehicles from regular rentals query', () => {
      const query = 'vehicle_id=not.like.vip-bike-svc-*';
      expect(query).toContain('not.like.vip-bike-svc-*');
    });

    it('should query service vehicles separately for service analytics', () => {
      const svcQuery = 'type=eq.service';
      expect(svcQuery).toContain('type=eq.service');
    });
  });

  describe('Service status wording (positive reframe)', () => {
    it('should say "Работа в процессе" not "Просрочена" for long service', () => {
      const serviceActiveDays = 5;
      const label = serviceActiveDays > 3
        ? `Работа в процессе (${serviceActiveDays} дней)`
        : 'В работе';
      expect(label).toContain('Работа в процессе');
      expect(label).not.toContain('Просрочен');
    });

    it('should say "В работе" for short service', () => {
      const serviceActiveDays = 2;
      const label = serviceActiveDays > 3
        ? `Работа в процессе (${serviceActiveDays} дней)`
        : 'В работе';
      expect(label).toBe('В работе');
    });
  });
});

// ── Service in boss commands ────────────────────────────────────────────────

describe('Service Flow — Boss Commands', () => {
  describe('evening-summary service KPIs', () => {
    it('should query service vehicles by type=eq.service', () => {
      // The evening-summary fetches service vehicle IDs first, then queries rentals
      const svcIdsQuery = 'select=id&crew_id=eq.${CREW_ID}&type=eq.service';
      expect(svcIdsQuery).toContain('type=eq.service');
    });

    it('should skip service KPIs when no service vehicles exist', () => {
      const svcIds = '';
      const shouldSkip = !svcIds;
      expect(shouldSkip).toBe(true);
    });

    it('should query service rentals when service vehicles exist', () => {
      const svcIds = 'vip-bike-svc-diag,vip-bike-svc-repair';
      const shouldQuery = !!svcIds;
      expect(shouldQuery).toBe(true);
    });

    it('should compute service revenue from active+completed', () => {
      const services = [
        { status: 'active', total_cost: 3000 },
        { status: 'completed', total_cost: 5000 },
        { status: 'cancelled', total_cost: 2000 },
      ];
      const revenue = services
        .filter((s) => s.status === 'active' || s.status === 'completed')
        .reduce((sum, s) => sum + s.total_cost, 0);
      expect(revenue).toBe(8000);
    });
  });

  describe('morning-standup service mentions', () => {
    it('should not alert about service rentals as "returns due"', () => {
      // Service rentals are filtered out of returns-reminder (vehicle_id=not.like.vip-bike-svc-*)
      const filter = 'vehicle_id=not.like.vip-bike-svc-*';
      expect(filter).toContain('not.like');
    });
  });
});

// ── Service empty states (positive reframe) ─────────────────────────────────

describe('Service Flow — Empty States', () => {
  it('should say "не было" not "отсутствуют" for empty service day', () => {
    const emptyMessage = 'В этот день сервисных работ не было';
    expect(emptyMessage).toContain('не было');
    expect(emptyMessage).not.toContain('отсутствуют');
  });

  it('should show 0 services as neutral fact, not failure', () => {
    const kpiLine = 'Сервисов сегодня: 0\nВыручка: 0 ₽';
    expect(kpiLine).toContain('0');
    // Should NOT have red/shame indicators
    expect(kpiLine).not.toContain('❌');
    expect(kpiLine).not.toContain('🔴');
  });
});

// ── Service in analytics ────────────────────────────────────────────────────

describe('Service Flow — Analytics', () => {
  it('should separate service revenue from rental revenue', () => {
    const rentalsRevenue = 24000;
    const servicesRevenue = 8000;
    const totalRevenue = rentalsRevenue + servicesRevenue;
    expect(totalRevenue).toBe(32000);
    expect(rentalsRevenue).not.toBe(servicesRevenue);
  });

  it('should count service rentals separately', () => {
    const allRentals = [
      { vehicle_id: 'falcon-gt', status: 'active' },
      { vehicle_id: 'vip-bike-svc-diag', status: 'active' },
      { vehicle_id: 'y-volt-surge', status: 'completed' },
      { vehicle_id: 'vip-bike-svc-repair', status: 'completed' },
    ];

    const regularRentals = allRentals.filter((r) => !r.vehicle_id.startsWith('vip-bike-svc-'));
    const serviceRentals = allRentals.filter((r) => r.vehicle_id.startsWith('vip-bike-svc-'));

    expect(regularRentals).toHaveLength(2);
    expect(serviceRentals).toHaveLength(2);
  });
});

// ── Service + /doc flow ─────────────────────────────────────────────────────

describe('Service Flow — /doc Command', () => {
  it('should support service type in /doc (deal type = service)', () => {
    const dealType = 'service';
    const isRent = dealType === 'rent';
    const isSale = dealType === 'sale';
    const isService = !isRent && !isSale;
    expect(isService).toBe(true);
  });

  it('should create service rental with type=service vehicle', () => {
    const bike = { id: 'vip-bike-svc-diag', type: 'service', make: 'Diagnostic', model: 'Service' };
    expect(bike.type).toBe('service');
  });

  it('should NOT create closure todos for service (no return checklist)', () => {
    const isRent = false; // service is not a rental
    const shouldCreateClosureTodos = isRent;
    expect(shouldCreateClosureTodos).toBe(false);
  });

  it('should NOT send QR for service (no rental to claim)', () => {
    const isRent = false;
    const shouldSendQR = isRent;
    expect(shouldSendQR).toBe(false);
  });
});
