#!/usr/bin/env node
/**
 * avito-webhook-setup.mjs — DEPENDENCY-FREE (Node fetch only)
 *
 * Registers/unregisters the Avito Messenger v3 webhook for incoming messages.
 * Docs: https://developers.avito.ru/api-catalog/messenger/documentation
 *       (operation postWebhookV3, postWebhookUnsubscribe)
 *
 * Usage:
 *   node scripts/avito-webhook-setup.mjs register "https://rental.vip-bike.ru/api/webhooks/avito?secret=..."
 *   node scripts/avito-webhook-setup.mjs unsubscribe
 *
 * Env:
 *   AVITO_CLIENT_ID / AVITO_CLIENT_SECRET — client_credentials pair with
 *   `messenger:read` scope (auto-refreshed per run; nothing is stored).
 *
 * Notes:
 *   - Avito validates the URL at registration: it must respond 200 OK within
 *     2 seconds to a POST with an empty body. The webhook route acks that.
 *   - If the URL stays unreachable for more than a month, Avito removes the
 *     subscription — re-run `register` after long downtime.
 */
const API = 'https://api.avito.ru';

const CLIENT_ID = process.env.AVITO_CLIENT_ID;
const CLIENT_SECRET = process.env.AVITO_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing AVITO_CLIENT_ID / AVITO_CLIENT_SECRET env vars');
  process.exit(1);
}

async function getToken() {
  const res = await fetch(`${API}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) {
    console.error(`Token request failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const json = await res.json();
  return json.access_token;
}

async function main() {
  const [cmd, url] = process.argv.slice(2);
  const token = await getToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  if (cmd === 'register') {
    if (!url || !url.startsWith('https://')) {
      console.error('Usage: node scripts/avito-webhook-setup.mjs register "https://..."');
      process.exit(1);
    }
    const res = await fetch(`${API}/messenger/v3/webhook`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    console.log(`register status: ${res.status}`);
    console.log(await res.text());
    process.exit(res.ok ? 0 : 1);
  }

  if (cmd === 'unsubscribe') {
    const res = await fetch(`${API}/messenger/v1/webhook/unsubscribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: url || null }),
    });
    console.log(`unsubscribe status: ${res.status}`);
    console.log(await res.text());
    process.exit(res.ok ? 0 : 1);
  }

  console.error('Usage: node scripts/avito-webhook-setup.mjs <register|unsubscribe> [url]');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
