// Task 92 assets: (1) demo contract DOCX→PDF→PNG, (2) QR sticker PNG for Kawasaki deeplink
// run inside /home/z/cartest: node scripts/task92-make-contract-assets.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { htmlToDocxElements } from '../lib/htmlToDocx.mjs';

const OUT = '/home/z/cartest/task92-tutorial/images';
mkdirSync(OUT, { recursive: true });

// ── 1) contract with demo values ──────────────────────────────
const DEMO = {
  contract_number: 'ДЕМО-2026-1011',
  day: '11', month: 'октября', year: '2026', month_num: '10',
  city: 'Нижний Новгород',
  lessor_name: 'ИП Воробьев Р.В.',
  inn: '525400000000', bank_name: 'ТИНЬКОФФ БАНК', bank_account: '40802810…', bank_corr_account: '30101810…', bank_city: 'Москва', bik: '044525974',
  issuer_representative: 'Воробьев Р.В.', issuer_signatory: 'Воробьев Р.В.',
  address: 'г. Н.Новгород, пл. Комсомольская, 2', phone: '+7 9200-789-888',
  renter_last_name: 'Тест', renter_first_name: 'Пётр', renter_middle_name: 'Демо-инструкция',
  renter_full_name: 'Тест Пётр Демо-инструкция', renter_short_name: 'Тест П.Д.',
  renter_birth_date: '03.06.1995', renter_phone: '+7 (900) 111-22-33',
  passport_series: '4509', passport_number: '123456',
  passport_issued_by: 'ОМВД по г. Н.Новгороду', passport_issue_date: '12.05.2019',
  registration_address: 'г. Н.Новгород, ул. Рождественская, 1',
  licence_series: '99', licence_number: '76123456', licence_categories: 'A', licence_expiry: '03.06.2029',
  bike_make: 'Kawasaki', bike_model: 'EX650K (Ninja 650)', bike_year: '2008', bike_color: 'зеленый',
  bike_vin: 'JKAEXV… (демо)', bike_plate: '—', bike_category: 'A',
  bike_vehicle_type_label: 'Мотоцикл', bike_vehicle_type_accusative: 'мотоцикл', bike_vehicle_type_genitive: 'мотоцикла',
  bike_value_rub: '350 000', daily_price_rub: '10 000',
  deposit_rub: '20 000', deposit_payment_method: 'наличные',
  agreed_start_date: '15.10.2026 13:00', agreed_end_date: '17.10.2026 13:00',
  rental_days: '2', rental_total_rub: '22 250', total_cost_rub: '22 250',
  rent_start_date: '15.10.2026', rent_start_time: '13:00', rent_end_date: '17.10.2026', rent_end_time: '13:00',
  pricing_tier_price_rub: '10 000', pricing_tier_unit: '₽/сутки',
  subtotal_rub: '22 250', price_override_note: '',
  payment_cash_rub: '0', payment_bank_rub: '22 250',
  odometer_before: '9 851', odometer_start: '9 851', odometer_end: '—', battery_level_start: '', battery_level_end: '—',
  organization_representative: 'Воробьев Р.В.', organization_short: 'ИП Воробьев Р.В.',
  ogrnip: '315500000000000', legal_address: 'г. Н.Новгород, пл. Комсомольская, 2',
  lessor_address: 'г. Н.Новгород, пл. Комсомольская, 2', return_address: 'г. Н.Новгород, пл. Комсомольская, 2',
  renter_passport: '4509 № 123456', renter_passport_issue_date: '12.05.2019',
  renter_registration: 'г. Н.Новгород, ул. Рождественская, 1', renter_email: '',
  renter_driver_license: '99 76123456, категория A, до 03.06.2029',
  bike_engine_spec_line_1: '649 см³, 2 цилиндра, 4 такта, жидкостное охлаждение',
  bike_engine_spec_line_2: '68 л.с. при 9 000 об/мин, 64 Н·м при 7 000 об/мин',
  bike_engine_spec_line_3: 'КПП 6 ступеней, цепной привод',
  pep_signed: true, renter_signature: 'Пётр Тест (ПЭП · Telegram ID 910910910)',
  signature_timestamp: '11.10.2026 21:07 (МСК)', signature_fingerprint: 'demo0000…0000',
  media_links: '—', sts_collateral: false,
  battery_level_start: '', battery_level_end: '—',
  equipment_helmets: '1', equipment_gloves: '1', equipment_jacket: '—', equipment_pants: '—', equipment_boots: '—', equipment_net: '—', equipment_bag: '—', equipment_backpack: '—', equipment_charger: '—',
  equipment_summary: 'Шлем ×1, перчатки ×1', equipment_total_cost: '2 250',
  extra_km_fee_rub: '15', late_return_penalty_rub: '5 000', late_return_penalty_max_days: '3',
  fuel_policy: 'возврат с тем же уровнем топлива', smoking_policy: 'курение запрещено',
  damage_notes_at_delivery: 'нет', damage_notes_at_return: '—',
  odometer_start: '9 851', odometer_end: '—', battery_level_start: '—', battery_level_end: '—',
  operator_name: 'Илья (менеджер)', operator_phone: '+7 9200-789-888',
  crew_name: 'VIP BIKE', crew_telegram: '@oneBikePlsBot',
};

// resolve handlebars {{#if var}}A{{else}}B{{/if}} — innermost-first, iterate to fixpoint
function resolveHandlebars(src, truthySet) {
  let prev;
  do {
    prev = src;
    // innermost with else
    src = src.replace(/\{\{#if (\w+)\}\}((?:(?!\{\{#if)(?!\{\{\/if).)*?)\{\{else\}\}((?:(?!\{\{#if).)*?)\{\{\/if\}\}/gs,
      (_, v, a, b) => truthySet.has(v) ? a : b);
    // innermost without else
    src = src.replace(/\{\{#if (\w+)\}\}((?:(?!\{\{#if)(?!\{\{\/if).)*?)\{\{\/if\}\}/gs,
      (_, v, a) => truthySet.has(v) ? a : '');
  } while (src !== prev);
  // any leftover control tags (safety)
  return src.replace(/\{\{[#\/][^}]*\}\}/g, '').replace(/\{\{else\}\}/g, '');
}

let html = readFileSync('docs/RENTAL_DEAL_TEMPLATE.html', 'utf8');
const truthy = new Set(['pep_signed', 'deposit_payment_method', 'renter_driver_license']);
html = resolveHandlebars(html, truthy);
let missing = [];
html = html.replace(/\{\{([^}]+)\}\}/g, (_, v) => {
  const key = v.trim();
  return DEMO[key] !== undefined ? String(DEMO[key]) : (missing.push(key), `[${key.slice(0, 28)}]`);
});
console.log('missing vars:', missing.length ? missing.join(', ') : 'none');

const children = htmlToDocxElements(html);
const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 } } },
    children,
  }],
});
const buf = await Packer.toBuffer(doc);
writeFileSync('/tmp/task92-contract-demo.docx', buf);
console.log('DOCX:', buf.length, 'bytes');

execSync('soffice --headless --convert-to pdf --outdir /tmp /tmp/task92-contract-demo.docx', { stdio: 'pipe', timeout: 120000 });
console.log('PDF converted');
execSync(`python3 -c "
import pypdfium2 as pdfium
pdf = pdfium.PdfDocument('/tmp/task92-contract-demo.pdf')
print('pages:', len(pdf))
page = pdf[0]
img = page.render(scale=2.2).to_pil()
img.save('${OUT}/15-contract-page1.png')
print('png saved', img.size)
"`, { stdio: 'inherit' });

// ── 2) QR sticker — generated separately from /home/z/qrtool (qrcode resolves there)
console.log('DOCX part done; run task92-make-qr.mjs from /home/z/qrtool for QR');
console.log('DONE');
