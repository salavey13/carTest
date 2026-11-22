/**
 * iter25 — /testdrive fixes: signature alignment + crew email timing
 * =============================================================================
 *
 * 1. SIGNATURE ALIGNMENT (visual bug: "signature section not aligned to the
 *    left, kinda spread and looks ugly"):
 *    The testdrive template's signature <td> cells used text-align: justify.
 *    htmlToDocx packs the whole cell (raw text + <br> breaks, no <p>) into ONE
 *    justified paragraph — and OOXML stretches EVERY line ending with a manual
 *    line break to the full column width. Result: "Мотосалон:" / org name /
 *    "____ /Имя/" lines spread across the column with huge gaps.
 *    Fix: templates use text-align: left on signature cells + a converter
 *    guard (mapCellBreakAlign) that never justifies multi-<br> cell content.
 *
 * 2. CREW EMAIL TIMING (result doc never emailed):
 *    The email used to be the LAST step of generateContract, fire-and-forget.
 *    The telegramWebhook route runs with a hard maxDuration cap — the SMTP
 *    handshake was still running when the handler returned, the lambda froze
 *    and the email silently died. /doc works because its email starts
 *    mid-flow with seconds of awaited work still to come.
 *    Fix: sendTestDriveDocxEmail() starts right after the DOCX buffer exists
 *    (parallel with storage/TG/DB steps) + a bounded 1.5s final grace await.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { htmlToDocxElements } from '@/lib/htmlToDocx';
import { Document, Packer } from 'docx';
import JSZip from 'jszip';

const CREW_TEMPLATE = path.join(process.cwd(), 'docs/crewDocs/vip-bike_TESTDRIVE_DEAL_TEMPLATE.html');
const GENERAL_TEMPLATE = path.join(process.cwd(), 'docs/TESTDRIVE_DEAL_TEMPLATE.html');

const SAMPLE_VARS: Record<string, string> = {
  contract_number: '30.8/xxx-01',
  day: '30', month: 'августа', year: '2026',
  customer_full_name: 'Иванов Иван Иванович',
  customer_short_name: 'Иванов И. И.',
  customer_phone: '+7 987 654 32 10',
  customer_passport_number: '4509 123456',
  customer_passport_issued_by: 'ОМВД по Н.Новгороду',
  customer_passport_issue_date: '15.03.2020',
  customer_birth_date: '15.03.1990',
  customer_registration: 'г. Н.Новгород',
  license_series: '99', license_number: '76 123456',
  license_expiry_date: '15.03.2030', license_category: 'A',
  bike_make: 'Kawasaki', bike_model: 'EX650K',
  bike_color: 'чёрный', bike_year: '2023',
  price_digits: '0', price_words: 'ноль', deposit_rub: '0', deposit_words: 'ноль',
  organization_name: 'ИП Соловьёв Павел Андреевич',
  organization_short: 'ИП Соловьёв П.А.',
  issuer_name: 'Соловьёв П.А.',
  issuer_signatory: 'Соловьёв Павел Андреевич',
  ogrnip: '325520000012345', inn: '526300000000',
  legal_address: 'г. Нижний Новгород, пл. Комсомольская 2',
  return_address: 'г. Нижний Новгород, пл. Комсомольская 2',
  phone: '+7 900 000 00 00', email: 'vip_bike@mail.ru',
  signature_timestamp: '30.08.2026, 12:00:00',
  document_key: 'testdrive-xxx-1',
};

function renderTemplate(html: string): string {
  let out = html;
  out = out.replace(/{{#if\s+([a-zA-Z0-9_]+)}}([\s\S]*?){{\/if}}/g, (_, k, block) =>
    SAMPLE_VARS[k] ? block : '');
  out = out.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k) => SAMPLE_VARS[k] ?? '');
  return out;
}

/** Extract <w:jc w:val=...> alignment for every paragraph containing a marker text. */
async function paragraphAlignmentsByMarker(html: string, markers: string[]): Promise<Record<string, string | 'NONE'>> {
  const children = htmlToDocxElements(html);
  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buf);
  const xml: string = await zip.file('word/document.xml')!.async('string');

  const result: Record<string, string | 'NONE'> = {};
  // Split into paragraphs, then look for marker text inside each
  const paragraphs = xml.split('</w:p>');
  for (const marker of markers) {
    const hit = paragraphs.find((p) => p.includes(marker));
    if (!hit) { result[marker] = 'MISSING'; continue; }
    const jc = hit.match(/<w:jc w:val="([a-zA-Z]+)"/);
    result[marker] = jc ? jc[1] : 'NONE';
  }
  return result;
}

describe('iter25: /testdrive signature alignment', () => {
  const markerLines = ['(подпись)', 'Мотосалон:', 'транспортное средство передал', '(Ф., И., О. полностью)'];

  it.each([
    ['crew vip-bike', CREW_TEMPLATE],
    ['general fallback', GENERAL_TEMPLATE],
  ])('%s template: signature cells are left-aligned, not justified', async (_label, tplPath) => {
    const html = fs.readFileSync(tplPath, 'utf8');
    const rendered = renderTemplate(html);

    // Source-level guard: no text-align: justify left on any <td>
    const justifyTds = html.match(/<td[^>]*text-align:\s*justify[^>]*>/g) || [];
    expect(justifyTds, 'no <td> should carry text-align: justify after the fix').toEqual([]);

    const aligns = await paragraphAlignmentsByMarker(rendered, markerLines);
    for (const [marker, align] of Object.entries(aligns)) {
      expect(align, `signature line "${marker}" must render, alignment=${align}`).not.toBe('MISSING');
      expect(['left', 'NONE'], `signature line "${marker}" must be LEFT (got ${align})`).toContain(align);
    }
  });

  it('converter guard: multi-<br> cell with text-align: justify falls back to LEFT', async () => {
    // Regression guard at the htmlToDocx level: even if some future template
    // re-introduces justify on a <br>-broken signature cell, the converter
    // must not produce a justified paragraph (which stretches lines in Word).
    const html = [
      '<table style="width: 100%; border: none;">',
      '<tr>',
      '<td style="border: none; width: 50%; vertical-align: top; text-align: justify;">',
      '<b>Мотосалон:</b><br>ИП Тестов<br>____________________ /Тестов Т. Т./<br><span style="font-size: 9pt;">(подпись)</span>',
      '</td>',
      '<td style="border: none; width: 50%; vertical-align: top; text-align: justify;">одна строка без переносов</td>',
      '</tr>',
      '</table>',
    ].join('\n');

    const aligns = await paragraphAlignmentsByMarker(html, ['(подпись)', 'одна строка без переносов']);
    expect(aligns['(подпись)']).toBe('left'); // multi-<br> cell → LEFT (guard)
    expect(aligns['одна строка без переносов']).toBe('both'); // single-line justify is harmless, kept
  });

  it('body paragraphs keep their justify (legal text standard untouched)', async () => {
    const html = renderTemplate(fs.readFileSync(CREW_TEMPLATE, 'utf8'));
    const children = htmlToDocxElements(html);
    const doc = new Document({ sections: [{ children }] });
    const buf = await Packer.toBuffer(doc);
    const zip = await JSZip.loadAsync(buf);
    const xml: string = await zip.file('word/document.xml')!.async('string');
    // 1.1. clause is a classic body paragraph → must remain justified
    const hit = xml.split('</w:p>').find((p) => p.includes('Мотосалон предоставляет Пользователю'));
    expect(hit, 'body clause present').toBeTruthy();
    expect(hit).toMatch(/<w:jc w:val="both"/);
  });
});

describe('iter25: /testdrive crew email timing', () => {
  const cmdPath = path.join(process.cwd(), 'app/webhook-handlers/commands/testdrive-manual.ts');

  it('email helper starts right after the DOCX buffer is built (parallel, not last)', () => {
    const src = fs.readFileSync(cmdPath, 'utf8');

    // Helper exists and is non-throwing
    expect(src).toContain('function sendTestDriveDocxEmail');
    expect(src).toMatch(/Email setup failed \(non-fatal\)/);

    // Started immediately after doc generation...
    const docxLine = src.indexOf('const docSha256 = docResult.sha256;');
    const emailStart = src.indexOf('const crewEmailPromise = sendTestDriveDocxEmail({');
    expect(docxLine).toBeGreaterThan(-1);
    expect(emailStart).toBeGreaterThan(docxLine);
    // ...and BEFORE the Telegram document send + storage upload + DB saves
    const tgSend = src.indexOf('sendTelegramDocument(String(chatId), docxBuf, docFileName)');
    const storageUpload = src.indexOf('await uploadDocxToStorage({');
    const leadUpsert = src.indexOf('await upsertFranchizeLead({');
    expect(emailStart).toBeLessThan(tgSend);
    expect(emailStart).toBeLessThan(storageUpload);
    expect(emailStart).toBeLessThan(leadUpsert);

    // No stray old-style fire-and-forget email block at the end of the flow
    const returnTrue = src.lastIndexOf('return true;');
    const lastSendMail = src.lastIndexOf('transporter.sendMail({');
    expect(lastSendMail).toBeGreaterThan(-1);
    // The only sendMail call now lives inside the helper (before generateContract)
    const helperEnd = src.indexOf('async function generateContract');
    expect(lastSendMail).toBeLessThan(helperEnd);
    expect(returnTrue).toBeGreaterThan(helperEnd);
  });

  it('flow ends with a bounded final grace await on the email promise', () => {
    const src = fs.readFileSync(cmdPath, 'utf8');
    expect(src).toMatch(/Promise\.race\(\[\s*crewEmailPromise,/);
    expect(src).toMatch(/setTimeout\(resolve, 1500\)/);
  });

  it('vercel.json gives the webhook route headroom (>= 30s) for the parallel email', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'vercel.json'), 'utf8'));
    const dur = cfg.functions?.['app/api/telegramWebhook/route.ts']?.maxDuration;
    expect(dur).toBeGreaterThanOrEqual(30);
  });
});
