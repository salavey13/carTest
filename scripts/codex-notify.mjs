#!/usr/bin/env node

/**
 * Local operator skill: send Codex completion notifications either:
 *  - directly to Telegram Bot API
 *  - through /api/codex-bridge/callback
 *
 * Examples:
 *   node scripts/codex-notify.mjs callback --status completed --summary "Done" --telegramChatId 123 --telegramUserId 456 --imageUrl https://example.com/image.png
 *   node scripts/codex-notify.mjs callback-auto --summary "Done" --prUrl https://github.com/org/repo/pull/1
 *   node scripts/codex-notify.mjs telegram --chatId 123 --text "Hello"
 *   node scripts/codex-notify.mjs telegram-photo --chatId 123 --photo ./artifacts/page.png --caption "Preview"
 *   node scripts/codex-notify.mjs telegram-photo --chatId 123 --photoUrl https://... --caption "Preview"
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [mode, ...args] = process.argv.slice(2);

function getArg(name, fallback = undefined) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return args[idx + 1];
}



function uploadImageToSupabaseStorage(localPath) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const bucket = getArg('imageBucket', 'carpix');
  const objectName = getArg('imageObject', `cybertutor/${Date.now()}-${localPath.split('/').pop() || 'solution.png'}`);
  const imageBytes = readFileSync(localPath);
  const ext = (localPath.split('.').pop() || '').toLowerCase();
  const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

  const upload = spawnSync('curl', [
    '-sS',
    '-X',
    'POST',
    `${supabaseUrl}/storage/v1/object/${bucket}/${objectName}`,
    '-H',
    `Authorization: Bearer ${serviceKey}`,
    '-H',
    `apikey: ${serviceKey}`,
    '-H',
    `Content-Type: ${contentType}`,
    '--data-binary',
    '@-',
  ], { input: imageBytes, encoding: 'utf8' });

  if (upload.status !== 0) {
    throw new Error(`Image upload failed: ${upload.stderr || upload.stdout}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectName}`;
}

function getBranchFallback() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return undefined;
  }
}

async function postJson(url, body, headers = {}) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return text;
  } catch (fetchError) {
    // Fallback for runner environments where Node fetch has network/proxy issues.
    const headerArgs = Object.entries({ 'Content-Type': 'application/json', ...headers })
      .flatMap(([k, v]) => ['-H', `${k}: ${v}`]);
    const curl = spawnSync('curl', ['-sS', '-X', 'POST', url, ...headerArgs, '-d', JSON.stringify(body)], {
      encoding: 'utf8',
    });
    if (curl.status !== 0) {
      throw new Error(`fetch failed; curl fallback failed: ${curl.stderr || curl.stdout || fetchError}`);
    }
    return curl.stdout.trim();
  }
}

async function runCallbackMode() {
  const endpoint = getArg('endpoint', process.env.CODEX_CALLBACK_ENDPOINT || 'https://v0-car-test.vercel.app/api/codex-bridge/callback');
  const secret = process.env.CODEX_BRIDGE_CALLBACK_SECRET || getArg('secret');
  if (!secret) throw new Error('Missing CODEX_BRIDGE_CALLBACK_SECRET (or --secret)');

  const branch = getArg('branch', process.env.PR_HEAD_REF || getBranchFallback());
  const payload = {
    status: getArg('status', 'completed'),
    summary: getArg('summary', 'Codex task update'),
    branch,
    taskPath: getArg('taskPath', '/'),
    prUrl: getArg('prUrl'),
    telegramChatId: getArg('telegramChatId', process.env.TELEGRAM_CHAT_ID),
    telegramUserId: getArg('telegramUserId', process.env.TELEGRAM_USER_ID),
    slackChannelId: getArg('slackChannelId', process.env.SLACK_CODEX_CHANNEL_ID),
    slackThreadTs: getArg('slackThreadTs', process.env.SLACK_THREAD_TS),
    imageUrl: getArg('imageUrl') || (getArg('imagePath') ? uploadImageToSupabaseStorage(getArg('imagePath')) : undefined),
  };

  const response = await postJson(endpoint, payload, {
    'x-codex-bridge-secret': secret,
  });
  console.log(response);
}

async function runCallbackAutoMode() {
  const endpoint = getArg('endpoint', process.env.CODEX_CALLBACK_ENDPOINT || 'https://v0-car-test.vercel.app/api/codex-bridge/callback');
  const secret = process.env.CODEX_BRIDGE_CALLBACK_SECRET || getArg('secret');

  if (!secret) {
    console.log('callback-auto skipped: missing CODEX_BRIDGE_CALLBACK_SECRET');
    return;
  }

  const payload = {
    status: getArg('status', 'completed'),
    summary: getArg('summary', 'Codex task update'),
    branch: getArg('branch', process.env.PR_HEAD_REF || getBranchFallback()),
    taskPath: getArg('taskPath', '/'),
    prUrl: getArg('prUrl'),
    telegramChatId: getArg('telegramChatId', process.env.TELEGRAM_CHAT_ID),
    telegramUserId: getArg('telegramUserId', process.env.TELEGRAM_USER_ID),
    slackChannelId: getArg('slackChannelId', process.env.SLACK_CODEX_CHANNEL_ID),
    slackThreadTs: getArg('slackThreadTs', process.env.SLACK_THREAD_TS),
    imageUrl: getArg('imageUrl') || (getArg('imagePath') ? uploadImageToSupabaseStorage(getArg('imagePath')) : undefined),
  };

  const response = await postJson(endpoint, payload, {
    'x-codex-bridge-secret': secret,
  });
  console.log(response);
}

async function runTelegramMode() {
  const token = process.env.TELEGRAM_BOT_TOKEN || getArg('token');
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN (or --token)');

  const chatId = getArg('chatId', process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_USER_ID);
  if (!chatId) throw new Error('Missing --chatId (or TELEGRAM_CHAT_ID/TELEGRAM_USER_ID env)');

  const text = getArg('text', 'Codex task update');
  const response = await postJson(`https://api.telegram.org/bot${token}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: getArg('parseMode', 'Markdown'),
    disable_web_page_preview: true,
  });
  console.log(response);
}

function runTelegramPhotoMode() {
  const token = process.env.TELEGRAM_BOT_TOKEN || getArg('token');
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN (or --token)');

  const chatId = getArg('chatId', process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_USER_ID || process.env.ADMIN_CHAT_ID);
  if (!chatId) throw new Error('Missing --chatId (or TELEGRAM_CHAT_ID/TELEGRAM_USER_ID/ADMIN_CHAT_ID env)');

  const photo = getArg('photo');
  const photoUrl = getArg('photoUrl');
  if (!photo && !photoUrl) throw new Error('Missing --photo (local file path) or --photoUrl (remote image URL)');

  const caption = getArg('caption', 'Codex task image update');
  const parseMode = getArg('parseMode', 'Markdown');
  const url = `https://api.telegram.org/bot${token}/sendPhoto`;

  const photoField = photo ? `photo=@${photo}` : `photo=${photoUrl}`;

  const curl = spawnSync(
    'curl',
    ['-sS', '-X', 'POST', url, '-F', `chat_id=${chatId}`, '-F', `caption=${caption}`, '-F', `parse_mode=${parseMode}`, '-F', photoField],
    { encoding: 'utf8' }
  );

  if (curl.status !== 0) {
    throw new Error(`Telegram photo send failed: ${curl.stderr || curl.stdout}`);
  }

  console.log(curl.stdout.trim());
}

if (!mode || !['callback', 'callback-auto', 'telegram', 'telegram-photo'].includes(mode)) {
  console.error('Usage: node scripts/codex-notify.mjs <callback|callback-auto|telegram|telegram-photo> [--key value]');
  process.exit(1);
}

Promise.resolve(
  mode === 'callback'
    ? runCallbackMode()
    : mode === 'callback-auto'
      ? runCallbackAutoMode()
      : mode === 'telegram'
        ? runTelegramMode()
        : runTelegramPhotoMode()
)
  .catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
