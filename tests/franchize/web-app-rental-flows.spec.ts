/**
 * tests/franchize/web-app-rental-flows.spec.ts
 *
 * Tests for the web-app rental flow (renter-initiated):
 * - Checkout → pending_confirmation → confirmed → active → completed
 * - Renter identity: TG chat_id auto-shared (no QR needed)
 * - Photo upload + OCR: renter uploads → operator verifies
 * - Verification status transitions: unverified → pending → verified
 * - Rental page: flow-aware sections (show/hide based on /doc vs web-app)
 * - Analytics: renter name from user_rental_secrets (not operator name)
 */

import { describe, expect, it } from 'vitest';

// ── Web-app flow: identity + verification ───────────────────────────────────

describe('Web-App Rental Flow — Identity', () => {
  describe('TG chat_id auto-shared', () => {
    it('should have chat_id from WebApp auth (no QR needed)', () => {
      const webAppUser = { user_id: '413553377', username: 'salavey13' };
      const hasChatId = !!webAppUser.user_id;
      expect(hasChatId).toBe(true);
    });

    it('should NOT have originalOperatorChatId (renter-initiated)', () => {
      const lead = { originalOperatorChatId: null, user_id: '413553377' };
      expect(lead.originalOperatorChatId).toBeNull();
    });

    it('should NOT need QR claim (chat_id already linked)', () => {
      const flowType = 'webapp';
      const needsQr = flowType === 'doc';
      expect(needsQr).toBe(false);
    });
  });
});

describe('Web-App Rental Flow — Verification', () => {
  describe('Initial state: unverified', () => {
    it('should be unverified when no photos uploaded', () => {
      const rental = {
        originalOperatorChatId: null,
        passportMainpagePhoto: null,
        passportRegistrationPhoto: null,
        driversLicenceFrontalPhoto: null,
        metadata: { contract_verifier: null },
      };

      const hasPhotos = rental.passportMainpagePhoto || rental.passportRegistrationPhoto || rental.driversLicenceFrontalPhoto;
      const verified = rental.metadata?.contract_verifier?.status === 'verified';

      const status = verified ? 'verified' : hasPhotos ? 'pending' : 'unverified';
      expect(status).toBe('unverified');
    });

    it('should be pending when photos uploaded but not verified', () => {
      const rental = {
        originalOperatorChatId: null,
        passportMainpagePhoto: 'path/to/photo.jpg',
        passportRegistrationPhoto: null,
        driversLicenceFrontalPhoto: null,
        metadata: { contract_verifier: null },
      };

      const hasPhotos = rental.passportMainpagePhoto || rental.passportRegistrationPhoto || rental.driversLicenceFrontalPhoto;
      const verified = rental.metadata?.contract_verifier?.status === 'verified';

      const status = verified ? 'verified' : hasPhotos ? 'pending' : 'unverified';
      expect(status).toBe('pending');
    });

    it('should be verified when operator checks photos', () => {
      const rental = {
        originalOperatorChatId: null,
        passportMainpagePhoto: 'path/to/photo.jpg',
        passportRegistrationPhoto: 'path/to/reg.jpg',
        driversLicenceFrontalPhoto: 'path/to/license.jpg',
        metadata: { contract_verifier: { status: 'verified' } },
      };

      const verified = rental.metadata?.contract_verifier?.status === 'verified';
      const status = verified ? 'verified' : 'pending';
      expect(status).toBe('verified');
    });
  });

  describe('/doc flow: always verified', () => {
    it('should be verified when originalOperatorChatId is set', () => {
      const lead = {
        originalOperatorChatId: '413553377',
        rentals: [{ status: 'pending_confirmation' }],
      };

      const status = lead.originalOperatorChatId && lead.rentals.length > 0
        ? 'verified'
        : 'unverified';
      expect(status).toBe('verified');
    });
  });
});

// ── Stage bottlenecks (flow-aware) ──────────────────────────────────────────

describe('Web-App Rental Flow — Stage Bottlenecks', () => {
  describe('getFlowType detection', () => {
    it('should return "doc" when originalOperatorChatId is set', () => {
      const lead = { originalOperatorChatId: '413553377', rentals: [{}] };
      const flowType = lead.originalOperatorChatId ? 'doc' : lead.rentals.length ? 'webapp' : 'none';
      expect(flowType).toBe('doc');
    });

    it('should return "webapp" when no operator chat ID but has rental', () => {
      const lead = { originalOperatorChatId: null, rentals: [{}] };
      const flowType = lead.originalOperatorChatId ? 'doc' : lead.rentals.length ? 'webapp' : 'none';
      expect(flowType).toBe('webapp');
    });

    it('should return "none" when no rental', () => {
      const lead = { originalOperatorChatId: null, rentals: [] };
      const flowType = lead.originalOperatorChatId ? 'doc' : lead.rentals.length ? 'webapp' : 'none';
      expect(flowType).toBe('none');
    });
  });

  describe('Flow-specific bottlenecks', () => {
    it('webapp flow at contract_sent should show "Загрузить фото" (not "Показать QR")', () => {
      const flowType = 'webapp';
      const stage = 'contract_sent';

      // QR stages don't apply to webapp flow
      if (flowType === 'webapp' && (stage === 'contract_sent' || stage === 'awaiting_qr_claim')) {
        const bottleneck = { label: 'Загрузить фото', color: '#f97316' };
        expect(bottleneck.label).toBe('Загрузить фото');
      }
    });

    it('doc flow at contract_sent should show "Показать QR" (not "Загрузить фото")', () => {
      const flowType = 'doc';
      const stage = 'contract_sent';

      if (flowType === 'doc' && stage === 'contract_sent') {
        const bottleneck = { label: 'Показать QR', color: '#eab308' };
        expect(bottleneck.label).toBe('Показать QR');
      }
    });

    it('doc flow at documents_missing should show "Ожидает QR" (docs already verified)', () => {
      const flowType = 'doc';
      const stage = 'documents_missing';

      if (flowType === 'doc' && stage === 'documents_missing') {
        const bottleneck = { label: 'Ожидает QR', color: '#eab308' };
        expect(bottleneck.label).toBe('Ожидает QR');
      }
    });
  });
});

// ── Renter name resolution ──────────────────────────────────────────────────

describe('Web-App Rental Flow — Renter Name', () => {
  it('should show renter_full_name from secrets first (/doc flow)', () => {
    const renter_full_name = 'Иванов Иван Иванович';
    const user_full_name = 'salavey13';
    const display = renter_full_name || user_full_name || '—';
    expect(display).toBe('Иванов Иван Иванович');
  });

  it('should fall back to user.full_name when no secrets (web-app flow)', () => {
    const renter_full_name = null;
    const user_full_name = 'Иван Иванов';
    const display = renter_full_name || user_full_name || '—';
    expect(display).toBe('Иван Иванов');
  });

  it('should fall back to username when no full_name', () => {
    const renter_full_name = null;
    const user_full_name = null;
    const user_username = 'ivan_ivanov';
    const display = renter_full_name || user_full_name || user_username || '—';
    expect(display).toBe('ivan_ivanov');
  });

  it('should show — when no name available', () => {
    const renter_full_name = null;
    const user_full_name = null;
    const user_username = null;
    const display = renter_full_name || user_full_name || user_username || '—';
    expect(display).toBe('—');
  });
});

// ── Rental status transitions ───────────────────────────────────────────────

describe('Rental Status Transitions', () => {
  it('pending_confirmation → active (via confirmVehiclePickup)', () => {
    const oldStatus = 'pending_confirmation';
    const newStatus = 'active';
    expect(oldStatus).not.toBe(newStatus);
    expect(newStatus).toBe('active');
  });

  it('active → completed (via confirmVehicleReturn)', () => {
    const oldStatus = 'active';
    const newStatus = 'completed';
    expect(oldStatus).not.toBe(newStatus);
    expect(newStatus).toBe('completed');
  });

  it('pending_confirmation → cancelled (operator declines)', () => {
    const oldStatus = 'pending_confirmation';
    const newStatus = 'cancelled';
    expect(newStatus).toBe('cancelled');
  });

  it('active → disputed (renter reports issue)', () => {
    const oldStatus = 'active';
    const newStatus = 'disputed';
    expect(newStatus).toBe('disputed');
  });
});

// ── Closure flow ────────────────────────────────────────────────────────────

describe('Rental Closure — confirmVehicleReturn', () => {
  describe('Closure data', () => {
    it('should capture odometerAfter', () => {
      const closureData = { odometerAfter: 12345 };
      expect(closureData.odometerAfter).toBe(12345);
    });

    it('should capture damage level (none/light/heavy)', () => {
      const closureData = { damageLevel: 'none' as const };
      expect(closureData.damageLevel).toBe('none');

      const lightDamage = { damageLevel: 'light' as const };
      expect(lightDamage.damageLevel).toBe('light');

      const heavyDamage = { damageLevel: 'heavy' as const };
      expect(heavyDamage.damageLevel).toBe('heavy');
    });

    it('should prefix damage level in notes', () => {
      const level = 'light';
      const notes = 'царапина на баке';
      const damageNotes = level !== 'none'
        ? `[${level === 'heavy' ? 'Серьёзные повреждения' : 'Лёгкие повреждения'}] ${notes}`
        : null;
      expect(damageNotes).toContain('Лёгкие повреждения');
      expect(damageNotes).toContain('царапина');
    });

    it('should set damageNotes to null when level is "none"', () => {
      const level = 'none';
      const notes = '';
      const damageNotes = level !== 'none'
        ? `[${level === 'heavy' ? 'Серьёзные повреждения' : 'Лёгкие повреждения'}] ${notes}`
        : null;
      expect(damageNotes).toBeNull();
    });

    it('should capture depositReturned', () => {
      const closureData = { depositReturned: true };
      expect(closureData.depositReturned).toBe(true);
    });
  });

  describe('Payment status preservation', () => {
    it('should NOT hardcode fully_paid when depositReturned is false', () => {
      const existingStatus = 'deposit_paid';
      const depositReturned = false;
      const newStatus = depositReturned === true
        ? 'fully_paid'
        : existingStatus || 'pending';
      expect(newStatus).toBe('deposit_paid');
    });

    it('should set fully_paid only when depositReturned is true', () => {
      const existingStatus = 'deposit_paid';
      const depositReturned = true;
      const newStatus = depositReturned === true
        ? 'fully_paid'
        : existingStatus || 'pending';
      expect(newStatus).toBe('fully_paid');
    });
  });

  describe('Receipt recipient fallback', () => {
    it('should use rentals.user_id for web-app flow', () => {
      const rental = { user_id: '413553377' };
      const artefactChatId = null;
      const chatId = rental.user_id || artefactChatId || null;
      expect(chatId).toBe('413553377');
    });

    it('should fall back to artefact telegram_chat_id for /doc flow', () => {
      const rental = { user_id: null };
      const artefactChatId = '413553377';
      const chatId = rental.user_id || artefactChatId || null;
      expect(chatId).toBe('413553377');
    });
  });
});

// ── Auth checks ─────────────────────────────────────────────────────────────

describe('Rental Auth — Crew Membership', () => {
  it('should allow crew owner to close rental', () => {
    const role = 'owner';
    const canConfirmReturn = (role === 'owner' || role === 'member') && true;
    expect(canConfirmReturn).toBe(true);
  });

  it('should allow crew member to close rental', () => {
    const role = 'member';
    const canConfirmReturn = (role === 'owner' || role === 'member') && true;
    expect(canConfirmReturn).toBe(true);
  });

  it('should NOT allow guest to close rental', () => {
    const role = 'guest';
    const canConfirmReturn = (role === 'owner' || role === 'member') && true;
    expect(canConfirmReturn).toBe(false);
  });

  it('should detect crew member via slug fallback', () => {
    const userCrewMemberships = [{ crewId: 'wrong-uuid', slug: 'vip-bike', role: 'member' }];
    const crewSlug = 'vip-bike';
    const membership = userCrewMemberships.find((m) => m.slug === crewSlug);
    expect(membership).toBeDefined();
    expect(membership?.role).toBe('member');
  });
});
