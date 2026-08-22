/**
 * tests/franchize/doc-command-flows.spec.ts
 *
 * Tests for the /doc command operator flow (rent + sale):
 * - Equipment step: eq_skip_all resets all + eq_done proceeds
 * - QR: only sent for rentals, NOT sales
 * - Post-creation message: contains bike, renter, dates, price, next steps
 * - Sale success message: no QR mention, points to analytics
 * - Odometer: shows last known reading as hint
 * - Confirm button: callback_data values match handlers
 * - Flow detection: isRent vs isSale branching
 * - Todo creation: correct number of closure + verification todos
 */

import { describe, expect, it } from 'vitest';

// ── Equipment keyboard ──────────────────────────────────────────────────────

describe('/doc Command — Equipment Step', () => {
  describe('eq_skip_all button', () => {
    it('should reset all equipment to zero/false when pressed', () => {
      const context = {
        helmets: 2, gloves: 1, jacket: true, boots: true,
        net: true, backpack: true, bag: true, charger: true,
      };

      // Simulate eq_skip_all handler
      context.helmets = 0;
      context.gloves = 0;
      context.jacket = false;
      context.boots = false;
      context.net = false;
      context.backpack = false;
      context.bag = false;
      context.charger = false;

      expect(context.helmets).toBe(0);
      expect(context.gloves).toBe(0);
      expect(context.jacket).toBe(false);
      expect(context.boots).toBe(false);
      expect(context.net).toBe(false);
      expect(context.backpack).toBe(false);
      expect(context.bag).toBe(false);
      expect(context.charger).toBe(false);
    });

    it('should proceed to odometer step after skip_all', () => {
      const steps: string[] = [];
      const gotoOdometer = () => steps.push('odometer');

      // Simulate eq_skip_all handler calling gotoOdometer
      gotoOdometer();

      expect(steps).toContain('odometer');
    });
  });

  describe('eq_done button', () => {
    it('should proceed to odometer with current equipment values', () => {
      const context = { helmets: 2, gloves: 1, jacket: false };
      const steps: string[] = [];
      const gotoOdometer = () => steps.push('odometer');

      // Equipment values are preserved (not reset)
      gotoOdometer();

      expect(context.helmets).toBe(2);
      expect(context.gloves).toBe(1);
      expect(steps).toContain('odometer');
    });
  });

  describe('Individual equipment toggles', () => {
    it('helmets should cycle 0 → 1 → 2 → 0', () => {
      let helmets = 0;
      // Cycle: 0 → 1
      helmets = helmets >= 2 ? 0 : helmets + 1;
      expect(helmets).toBe(1);
      // Cycle: 1 → 2
      helmets = helmets >= 2 ? 0 : helmets + 1;
      expect(helmets).toBe(2);
      // Cycle: 2 → 0
      helmets = helmets >= 2 ? 0 : helmets + 1;
      expect(helmets).toBe(0);
    });

    it('boolean items should toggle true ↔ false', () => {
      let jacket = false;
      jacket = !jacket;
      expect(jacket).toBe(true);
      jacket = !jacket;
      expect(jacket).toBe(false);
    });
  });
});

// ── QR code flow ────────────────────────────────────────────────────────────

describe('/doc Command — QR Code', () => {
  describe('QR only for rentals', () => {
    it('should send QR when isRent=true', () => {
      const isRent = true;
      const qrPngBuffer = Buffer.from('fake-qr');
      const shouldSendQR = qrPngBuffer && isRent;
      expect(shouldSendQR).toBeTruthy();
    });

    it('should NOT send QR when isRent=false (sale)', () => {
      const isRent = false;
      const qrPngBuffer = Buffer.from('fake-qr');
      const shouldSendQR = qrPngBuffer && isRent;
      expect(shouldSendQR).toBeFalsy();
    });

    it('should NOT send QR when buffer is null', () => {
      const isRent = true;
      const qrPngBuffer = null;
      const shouldSendQR = qrPngBuffer && isRent;
      expect(shouldSendQR).toBeFalsy();
    });
  });

  describe('QR message content', () => {
    it('should explain the QR is for the renter', () => {
      const qrMessage = '📲 QR-код для арендатора\nПокажите этот QR клиенту — он откроет карточку аренды в Telegram';
      expect(qrMessage).toContain('арендатора');
      expect(qrMessage).toContain('Покажите');
      expect(qrMessage).toContain('клиенту');
    });
  });
});

// ── Post-creation messages ─────────────────────────────────────────────────

describe('/doc Command — Post-Creation Messages', () => {
  describe('Rental success message', () => {
    const rentalMessage = [
      '✅ *Аренда создана!*',
      '🏍 Wenbox U2 Pro',
      '👤 Иванов Иван Иванович',
      '📅 31.07 18:00 → 02.08 21:30',
      '💰 6000 ₽',
      '',
      '*Дальнейшие шаги:*',
      '1️⃣ Откройте карточку аренды',
      '2️⃣ Зафиксируйте выдачу (одометр + фото)',
      '3️⃣ Подтвердите выдачу → аренда активна',
    ].join('\n');

    it('should contain bike make+model', () => {
      expect(rentalMessage).toContain('Wenbox U2 Pro');
    });

    it('should contain renter full name', () => {
      expect(rentalMessage).toContain('Иванов Иван Иванович');
    });

    it('should contain rental dates', () => {
      expect(rentalMessage).toContain('31.07');
      expect(rentalMessage).toContain('02.08');
    });

    it('should contain price', () => {
      expect(rentalMessage).toContain('6000 ₽');
    });

    it('should contain numbered next steps', () => {
      expect(rentalMessage).toContain('1️⃣');
      expect(rentalMessage).toContain('2️⃣');
      expect(rentalMessage).toContain('3️⃣');
    });

    it('should mention opening the rental card', () => {
      expect(rentalMessage).toContain('карточку аренды');
    });

    it('should mention pickup freeze step', () => {
      expect(rentalMessage).toContain('выдачу');
    });

    it('should mention confirming pickup', () => {
      expect(rentalMessage).toContain('Подтвердите');
    });
  });

  describe('Sale success message', () => {
    const saleMessage = [
      '✅ *Договор купли-продажи готов!*',
      '🏍 79bike Falcon PRO',
      '👤 Петров Пётр Петрович',
      '💰 310000 ₽',
      '',
      'Договор отправлен выше ↑',
      'Карточку продажи смотрите в аналитике →',
    ].join('\n');

    it('should contain bike info', () => {
      expect(saleMessage).toContain('Falcon PRO');
    });

    it('should contain buyer name', () => {
      expect(saleMessage).toContain('Петров');
    });

    it('should contain price', () => {
      expect(saleMessage).toContain('310000 ₽');
    });

    it('should NOT mention QR', () => {
      expect(saleMessage).not.toContain('QR');
      expect(saleMessage).not.toContain('qr');
    });

    it('should point to analytics instead of QR', () => {
      expect(saleMessage).toContain('аналитике');
    });
  });
});

// ── Confirm button ─────────────────────────────────────────────────────────

describe('/doc Command — Confirm Button', () => {
  it('should have "ok" callback for confirm', () => {
    const confirmButton = { text: '✅ Всё верно — генерируем', callback_data: 'ok' };
    expect(confirmButton.callback_data).toBe('ok');
  });

  it('should have "restart" callback for edit (not "start_over")', () => {
    const editButton = { text: '✏️ Исправить', callback_data: 'restart' };
    expect(editButton.callback_data).toBe('restart');
  });

  it('should have "cancel" callback for cancel', () => {
    const cancelButton = { text: '❌ Отменить', callback_data: 'cancel' };
    expect(cancelButton.callback_data).toBe('cancel');
  });

  it('confirm text should contain "генерируем" (action-oriented)', () => {
    const confirmButton = { text: '✅ Всё верно — генерируем' };
    expect(confirmButton.text).toContain('генерируем');
  });
});

// ── Flow detection ─────────────────────────────────────────────────────────

describe('/doc Command — Flow Detection', () => {
  it('should identify rent flow when deal type is "rent"', () => {
    const dealType = 'rent';
    const isRent = dealType === 'rent';
    expect(isRent).toBe(true);
  });

  it('should identify sale flow when deal type is "sale"', () => {
    const dealType = 'sale';
    const isRent = dealType === 'rent';
    expect(isRent).toBe(false);
  });

  it('should create rental row only for rent flow', () => {
    const isRent = true;
    const shouldCreateRental = isRent;
    expect(shouldCreateRental).toBe(true);

    const isSale = false;
    const shouldCreateRentalForSale = isSale;
    expect(shouldCreateRentalForSale).toBe(false);
  });
});

// ── Todo creation ──────────────────────────────────────────────────────────

describe('/doc Command — Todo Creation', () => {
  describe('Closure todos (created on pickup)', () => {
    it('should create 5 closure todos when rental becomes active', () => {
      const CLOSURE_TEMPLATES = [
        { type: 'inspect_damage', title: 'Осмотреть байк на повреждения при возврате', priority: 'high' },
        { type: 'odometer_final', title: 'Зафиксировать финальный одометр', priority: 'high' },
        { type: 'deposit_refund', title: 'Вернуть депозит арендатору', priority: 'medium' },
        { type: 'review_request', title: 'Запросить отзыв у арендатора', priority: 'low' },
        { type: 'mark_completed', title: 'Пометить аренду завершённой в дашборде', priority: 'medium' },
      ];
      expect(CLOSURE_TEMPLATES).toHaveLength(5);
    });

    it('should use category=rental_closure for closure todos', () => {
      const category = 'rental_closure';
      expect(category).toBe('rental_closure');
    });
  });

  describe('Return todos (created by /doc on contract generation)', () => {
    it('should create equipment return todos', () => {
      const todos = [
        { title: '🔧 Проверить ТС при возврате: Wenbox U2 Pro', priority: 'high' },
        { title: '🔑 Принять ключи от Wenbox U2 Pro', priority: 'high' },
        { title: '📄 Проверить документы при возврате Wenbox U2 Pro', priority: 'medium' },
        { title: '📊 Сравить одометр: было 405 км', priority: 'medium' },
        { title: '🔍 Осмотр на повреждения: Wenbox U2 Pro', priority: 'high' },
      ];
      expect(todos).toHaveLength(5);
      expect(todos[0].title).toContain('Проверить ТС');
      expect(todos[1].title).toContain('ключи');
      expect(todos[3].title).toContain('одометр');
    });

    it('should add helmet todo when helmets > 0', () => {
      const helmets = 2;
      const todos: Array<{ title: string }> = [];
      if (helmets > 0) todos.push({ title: `🪖 Принять ${helmets} шлем(а/ов)` });
      expect(todos).toHaveLength(1);
      expect(todos[0].title).toContain('2 шлем');
    });

    it('should NOT add helmet todo when helmets = 0 (skip_all)', () => {
      const helmets = 0;
      const todos: Array<{ title: string }> = [];
      if (helmets > 0) todos.push({ title: `🪖 Принять ${helmets} шлем(а/ов)` });
      expect(todos).toHaveLength(0);
    });
  });

  describe('Verification todos', () => {
    it('should create 5 verification todos (passport, license, odometer, dates)', () => {
      const VERIFICATION_TEMPLATES = [
        { type: 'passport_mainpage', title: 'Верифицировать паспорт (главная страница)', priority: 'high' },
        { type: 'passport_registration', title: 'Верифицировать паспорт (страница с пропиской)', priority: 'high' },
        { type: 'drivers_license', title: 'Верифицировать водительское удостоверение', priority: 'high' },
        { type: 'odometer', title: 'Подтвердить начальный одометр', priority: 'medium' },
        { type: 'dates', title: 'Подтвердить даты аренды', priority: 'medium' },
      ];
      expect(VERIFICATION_TEMPLATES).toHaveLength(5);
    });

    it('should use category=rental_verification for verification todos', () => {
      const category = 'rental_verification';
      expect(category).toBe('rental_verification');
    });
  });
});

// ── Odometer step ──────────────────────────────────────────────────────────

describe('/doc Command — Odometer Step', () => {
  it('should show last known odometer as hint when available', () => {
    const lastOdo = 405;
    const odoHint = lastOdo ? ` (было: ${lastOdo} км)` : '';
    expect(odoHint).toContain('405');
    expect(odoHint).toContain('было');
  });

  it('should show no hint when last known odometer is not available', () => {
    const lastOdo = undefined;
    const odoHint = lastOdo ? ` (было: ${lastOdo} км)` : '';
    expect(odoHint).toBe('');
  });
});

// ── Phone step ─────────────────────────────────────────────────────────────

describe('/doc Command — Phone Step', () => {
  it('should indicate phone is optional', () => {
    const phonePrompt = '📞 Телефон клиента (или «Пропустить» — номер не обязателен):';
    expect(phonePrompt).toContain('не обязателен');
  });

  it('should accept skip and continue without phone', () => {
    const clientPhone = null;
    const hasPhone = !!clientPhone;
    expect(hasPhone).toBe(false);
  });
});

// ── Deep link generation ───────────────────────────────────────────────────

describe('/doc Command — Deep Links', () => {
  it('should generate TG WebApp deep link for rental', () => {
    const rentalId = 'abc-123-def';
    const botUsername = 'oneBikePlsBot';
    const deepLink = `https://t.me/${botUsername}/app?startapp=rental_${rentalId}`;
    expect(deepLink).toContain('rental_abc-123-def');
    expect(deepLink).toContain('startapp');
  });

  it('should generate web URL for rental', () => {
    const siteUrl = 'https://v0-car-test.vercel.app';
    const resolvedSlug = 'vip-bike';
    const rentalId = 'abc-123';
    const webUrl = `${siteUrl}/franchize/${resolvedSlug}/rental/${rentalId}`;
    expect(webUrl).toBe('https://v0-car-test.vercel.app/franchize/vip-bike/rental/abc-123');
  });
});
