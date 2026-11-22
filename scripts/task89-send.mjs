#!/usr/bin/env node
// Task 89 delivery: send review + fixed cs + sql + ready answer text to Paul
// run: node --env-file=.env.local scripts/task89-send.mjs
import { readFileSync } from 'node:fs';

const API = 'https://v0-car-test.vercel.app/api/forward-telegram';
const CHAT_ID = 413553377; // salavey13
const H = { 'Content-Type': 'application/json', Origin: 'https://v0-car-test.vercel.app' };

async function call(method, payload, files) {
  const res = await fetch(API, {
    method: 'POST', headers: H,
    body: JSON.stringify({ chat_id: CHAT_ID, method, payload, files }),
  });
  const j = await res.json().catch(() => ({}));
  console.log(`${method}:`, res.status, j.ok ? `message_id ${j.result?.message_id}` : JSON.stringify(j).slice(0, 300));
  return j.ok;
}

async function sendDoc(file, filename, caption) {
  const data = readFileSync(file).toString('base64');
  return call('sendDocument', { caption, parse_mode: 'HTML' }, {
    document: { data, filename, contentType: 'application/octet-stream' },
  });
}

// 1) ready-to-send answer (copy-paste to vip-bike)
const answer = readFileSync('/home/z/cartest/docs/vip-bike-answer-20261011.md', 'utf8');
const m = answer.indexOf('## ГОТОВЫЙ ТЕКСТ ДЛЯ ОТПРАВКИ');
const m2 = answer.indexOf('---\n\n## РАСШИРЕННАЯ');
const text = answer.slice(answer.indexOf('\n', m) + 1, m2).trim();
console.log('answer chars:', text.length);
const ok1 = await call('sendMessage', { text }); // markdown off — plain, копипаст как есть

// 2) codereview doc with TL;DR caption
const ok2 = await sendDoc(
  '/home/z/cartest/docs/avito-agent-supabase-codereview.md',
  'avito-agent-supabase-codereview.md',
  '<b>Ревью кода Avito-агента (Supabase-ветка)</b>\n\n' +
  'Скелет верный, брони создаются (2 тестовые уже в базе). Но:\n' +
  '1. Листинг без type=bike → агент предлагает куртки (147 позиций у vip-bike, без crew_id было 277 со всех экипажей)\n' +
  '2. N+1 запросов (~294 HTTP) — потому и «returned error»: таймаут функции, crew_id не спасёт\n' +
  '3. Нет валидации окна → в базе уже аренда с концом раньше начала\n' +
  '4. Таймзона: сайт пишет МСК (+03:00), агент лепит Z → сдвиг 3 часа\n' +
  '5. Гонка при брони + нет льготы 30 мин и пропуска протухших строк (как в приложении)\n\n' +
  'Фиксы: supafuncs-fixed.cs (drop-in, сигнатуры те же) + опциональный атомарный RPC (SQL для тебя). Ретест по чек-листу в конце документа.'
);

// 3) fixed C#
const ok3 = await sendDoc('/home/z/cartest/docs/avito-agent/supafuncs-fixed.cs', 'supafuncs-fixed.cs',
  'FIX-1…FIX-8 помечены в комментариях. Env добавить: AVITO_TZ_OFFSET_HOURS=3');

// 4) SQL for owner (optional atomic RPC)
const ok4 = await sendDoc('/home/z/cartest/docs/sql/owner/20261011_avito_agent_try_create_rental.sql', '20261011_avito_agent_try_create_rental.sql',
  'Опционально: атомарное бронирование (advisory lock). Исполни руками, когда будешь готов.');

console.log(JSON.stringify({ ok1, ok2, ok3, ok4 }));
