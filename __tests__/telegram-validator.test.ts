import crypto from 'crypto';
import { validateTelegramInitData } from '@/lib/telegram-validator';

// Set max age to 1 hour for testing
process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS = '3600';

describe('Telegram Validator', () => {
  const TEST_BOT_TOKEN = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  
  function createMockInitData(user: any, authDate: number, extraParams: Record<string, string> = {}): string {
    const userStr = encodeURIComponent(JSON.stringify(user));
    const params = new URLSearchParams({
      user: userStr,
      auth_date: authDate.toString(),
      ...extraParams
    });
    
    // Build data check string (sorted)
    const keys = Array.from(params.keys()).sort();
    const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join('\n');
    
    // Compute hash
    const secretKey = crypto.createHmac('sha256', TEST_BOT_TOKEN).update('WebAppData').digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    
    params.set('hash', hash);
    return params.toString();
  }

  test('✅ validates correct initData with signature', async () => {
    const user = { id: 123, username: 'testuser' };
    const authDate = Math.floor(Date.now() / 1000);
    const initData = createMockInitData(user, authDate, {
      signature: 'mock_signature_123'
    });
    
    const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);
    
    expect(result.valid).toBe(true);
    expect(result.user?.username).toBe('testuser');
    expect(result.reason).toBeUndefined();
  });

  test('❌ rejects tampered initData', async () => {
    const user = { id: 123, username: 'testuser' };
    const initData = createMockInitData(user, Math.floor(Date.now() / 1000));
    
    // Tamper with it
    const tampered = initData.replace('testuser', 'hacker');
    
    const result = await validateTelegramInitData(tampered, TEST_BOT_TOKEN);
    
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('hash mismatch');
  });

  test('❌ rejects expired auth_date', async () => {
    const oldAuthDate = Math.floor(Date.now() / 1000) - 7200; // 2 hours ago
    const user = { id: 123, username: 'testuser' };
    const initData = createMockInitData(user, oldAuthDate);
    
    const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);
    
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('auth_date expired');
  });

  test('❌ rejects missing auth_date', async () => {
    const user = { id: 123, username: 'testuser' };
    const userStr = encodeURIComponent(JSON.stringify(user));
    const secretKey = crypto.createHmac('sha256', TEST_BOT_TOKEN).update('WebAppData').digest();
    const hash = crypto.createHmac('sha256', secretKey).update(`user=${userStr}`).digest('hex');
    
    const initData = `user=${userStr}&hash=${hash}`;
    
    const result = await validateTelegramInitData(initData, TEST_BOT_TOKEN);
    
    // Should fail because auth_date is missing (and it's a warning)
    expect(result.valid).toBe(false);
  });
});