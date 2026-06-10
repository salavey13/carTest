#!/usr/bin/env node
/**
 * Test Sleep Reminder - Send immediately via forward-telegram API
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://v0-car-test.vercel.app';
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '413553377';
const CRON_SECRET = process.env.CRON_SECRET || process.env.CODEX_BRIDGE_CALLBACK_SECRET || '13131313';

async function testSleepReminder() {
  console.log('🔔 Testing sleep reminder...');
  console.log(`   URL: ${SITE_URL}/api/forward-telegram`);
  console.log(`   Chat ID: ${ADMIN_CHAT_ID}`);
  console.log(`   Secret: ${CRON_SECRET}\n`);

  const response = await fetch(`${SITE_URL}/api/forward-telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': CRON_SECRET,
    },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      method: 'sendMessage',
      payload: {
        text: '😴 Тест cron: Пора спать! 4:20 - время отдыхать. Спокойной ночи! 🌙',
        parse_mode: 'HTML',
      },
    }),
  });

  if (response.ok) {
    const result = await response.json();
    console.log('✅ Sleep reminder sent successfully!');
    console.log('   Result:', result);
  } else {
    const error = await response.text();
    console.error('❌ Failed to send sleep reminder');
    console.error('   Status:', response.status);
    console.error('   Error:', error);
  }
}

testSleepReminder().catch(console.error);
