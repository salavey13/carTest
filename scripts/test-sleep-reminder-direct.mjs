#!/usr/bin/env node
/**
 * Test Sleep Reminder - Direct Telegram API call (for testing)
 */

import { readFileSync } from 'node:fs';

// Load .env file
const envContent = readFileSync('.env', 'utf-8');
const TELEGRAM_BOT_TOKEN = envContent.match(/TELEGRAM_BOT_TOKEN=(.+)/)?.[1]?.trim();
const ADMIN_CHAT_ID = envContent.match(/ADMIN_CHAT_ID=(.+)/)?.[1]?.trim() || '413553377';

async function testSleepReminderDirect() {
  console.log('🔔 Testing sleep reminder via direct Telegram API...');
  console.log(`   Chat ID: ${ADMIN_CHAT_ID}\n`);

  if (!TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not found in .env');
    process.exit(1);
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: ADMIN_CHAT_ID,
      text: '😴 Тест cron: Пора спать! 4:20 - время отдыхать. Спокойной ночи! 🌙\n\n(Este un test via direct Telegram API)',
      parse_mode: 'HTML',
    }),
  });

  const result = await response.json();

  if (result.ok) {
    console.log('✅ Sleep reminder sent successfully!');
    console.log('   Message ID:', result.result.message_id);
  } else {
    console.error('❌ Failed to send sleep reminder');
    console.error('   Error:', result.description);
  }
}

testSleepReminderDirect().catch(console.error);
