#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// send-document-by-email.mjs — Send a document as email attachment
// ═══════════════════════════════════════════════════════════════════════════
//
// USAGE:
//   node send-document-by-email.mjs \
//     --document ./contract.docx \
//     --to vip-bike@mail.ru \
//     --subject "Договор купли-продажи Y-VOLT" \
//     --body "Во вложении договор."
//
// REQUIRED env (in .env):
//   SMTP_HOST=smtp.mail.ru
//   SMTP_PORT=465
//   SMTP_USER=vip-bike@mail.ru
//   SMTP_PASS=<16-char app password from mail.ru>
//
// OPTIONAL env:
//   EMAIL_FROM=vip-bike@mail.ru  (defaults to SMTP_USER)
//   EMAIL_DEFAULT_TO=vip-bike@mail.ru  (used if --to not passed)

import { readFileSync, existsSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

// ── Argument parsing ────────────────────────────────────────────────────
const args = process.argv.slice(2);
const arg = (name, def = '') => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const flag = (name) => args.includes(`--${name}`);

function fail(stage, reason, details = {}) {
  const payload = { ok: false, stage, reason, details };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}

// ── Validate document ───────────────────────────────────────────────────
const documentPath = arg('document', '');
if (!documentPath) fail('validate', 'missing_document', { hint: 'Pass --document <path>' });
if (!existsSync(documentPath)) fail('validate', 'file_not_found', { path: documentPath });

const docStats = statSync(documentPath);
if (!docStats.isFile()) fail('validate', 'not_a_file', { path: documentPath });
if (docStats.size === 0) fail('validate', 'empty_file', { path: documentPath });

const fileName = basename(documentPath);
const ext = extname(documentPath).toLowerCase();
const MIME_MAP = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.html': 'text/html',
  '.htm':  'text/html',
  '.json': 'application/json',
  '.txt':  'text/plain',
  '.csv':  'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip':  'application/zip',
};
const mime = MIME_MAP[ext] || 'application/octet-stream';

// ── Load env ─────────────────────────────────────────────────────────────
// Provider selection: --provider yandex | mailru (default: mailru)
const provider = arg('provider', 'mailru').toLowerCase();
const PROVIDER_PREFIX = provider === 'yandex' ? 'SMTP_YANDEX_' : 'SMTP_';
const PROVIDER_EMAIL_PREFIX = provider === 'yandex' ? 'EMAIL_YANDEX_' : 'EMAIL_';

const SMTP_HOST = process.env[`${PROVIDER_PREFIX}HOST`] || process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env[`${PROVIDER_PREFIX}PORT`] || process.env.SMTP_PORT || 0);
const SMTP_USER = process.env[`${PROVIDER_PREFIX}USER`] || process.env.SMTP_USER || '';
const SMTP_PASS = process.env[`${PROVIDER_PREFIX}PASS`] || process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env[`${PROVIDER_EMAIL_PREFIX}FROM`] || process.env.EMAIL_FROM || SMTP_USER;
const EMAIL_DEFAULT_TO = process.env[`${PROVIDER_EMAIL_PREFIX}DEFAULT_TO`] || process.env.EMAIL_DEFAULT_TO || 'vip-bike@mail.ru';

console.error(`[send-email] Using provider=${provider} — host=${SMTP_HOST}:${SMTP_PORT} user=${SMTP_USER}`);

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  fail('env', 'smtp_env_missing', {
    hint: `Set ${PROVIDER_PREFIX}HOST, ${PROVIDER_PREFIX}PORT, ${PROVIDER_PREFIX}USER, ${PROVIDER_PREFIX}PASS in .env`,
    provider,
    present: { SMTP_HOST: !!SMTP_HOST, SMTP_PORT: !!SMTP_PORT, SMTP_USER: !!SMTP_USER, SMTP_PASS: !!SMTP_PASS },
  });
}

// ── Compose email ───────────────────────────────────────────────────────
const to = arg('to', EMAIL_DEFAULT_TO);
const cc = arg('cc', '');
const bcc = arg('bcc', '');
const subject = arg('subject', `Документ: ${fileName}`);
const body = arg('body', 'Во вложении документ.');
const fromName = arg('fromName', 'VIP Bike');
const from = `${fromName} <${EMAIL_FROM}>`;

// ── Load nodemailer ──────────────────────────────────────────────────────
let nodemailer;
try {
  nodemailer = await import('nodemailer');
} catch (e) {
  fail('init', 'nodemailer_not_installed', {
    hint: 'Run: npm install nodemailer',
    error: String(e?.message || e),
  });
}

// ── Create transporter ───────────────────────────────────────────────────
const useSecure = SMTP_PORT === 465; // SSL
const transporter = nodemailer.default.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: useSecure,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  logger: false,
  debug: false,
});

// ── Verify SMTP connection ───────────────────────────────────────────────
try {
  await transporter.verify();
  console.error(`[send-email] SMTP OK: ${SMTP_HOST}:${SMTP_PORT} as ${SMTP_USER}`);
} catch (verifyErr) {
  fail('smtp_auth', 'auth_failed', {
    host: SMTP_HOST,
    port: SMTP_PORT,
    user: SMTP_USER,
    error: String(verifyErr?.message || verifyErr),
    hint: 'Check SMTP_PASS — must be app-specific password (16 chars), not account password',
  });
}

// ── Send email ───────────────────────────────────────────────────────────
const attachments = [{
  filename: fileName,
  content: readFileSync(documentPath),
  contentType: mime,
}];

const mailOptions = {
  from,
  to,
  subject,
  text: body,
  attachments,
};
if (cc) mailOptions.cc = cc;
if (bcc) mailOptions.bcc = bcc;

try {
  const info = await transporter.sendMail(mailOptions);
  const result = {
    ok: true,
    messageId: info.messageId,
    from,
    to,
    cc: cc || null,
    bcc: bcc || null,
    subject,
    attachment: fileName,
    attachmentSizeBytes: docStats.size,
    attachmentMime: mime,
  };
  console.log(JSON.stringify(result, null, 2));
} catch (sendErr) {
  fail('smtp_send', 'send_failed', {
    to,
    subject,
    error: String(sendErr?.message || sendErr),
  });
}
