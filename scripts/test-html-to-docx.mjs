#!/usr/bin/env node
/**
 * Quick smoke-test: feed the HTML template with dummy vars → produce a .docx
 * Run:  node scripts/test-html-to-docx.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Document, Packer } from 'docx';
import { htmlToDocxElements } from '../lib/htmlToDocx.mjs';

const htmlTemplate = readFileSync('docs/RENTAL_DEAL_TEMPLATE.html', 'utf8');

// Minimal vars to fill template
const vars = {
  contract_number: '28.05/BIKE-001',
  day: '28', month: 'мая', month_num: '05', year: '2026',
  renter_full_name: 'Иванов Иван Иванович',
  renter_birth_date: '15.03.1990',
  renter_phone: '+7 999 123-45-67',
  renter_email: 'ivan@example.com',
  renter_passport: '1234 567890',
  renter_passport_issue_date: '10.06.2015',
  renter_registration: 'г. Нижний Новгород, ул. Ленина, д. 10, кв. 5',
  renter_driver_license: '5678 123456',
  bike_make: 'Super73', bike_model: 'ZX', bike_vin: 'WBA1234567890',
  bike_category: 'A/L3', bike_color: 'Черный', bike_year: '2023',
  bike_engine_cc: '2000', bike_power_hp: '15', bike_plate: 'А001АА 52',
  rent_start_date: '28.05.2026', rent_start_time: '18:00',
  rent_end_date: '30.05.2026', rent_end_time: '10:00',
  daily_price_rub: '10000', subtotal_rub: '20000', deposit_rub: '20000',
  included_km_per_day: '200', extra_km_fee_rub: '35',
  late_return_penalty_rub: '10000', late_return_penalty_max_days: '90',
  bike_value_rub: '850000',
  return_address: 'г. Нижний Новгород, пл. Комсомольская 2',
  bike_mileage: '1234', equipment: 'ключ(и) 1 шт.; шлем 1',
  damage_notes_at_delivery: 'без повреждений', damage_notes_at_return: '',
  battery_level_start: '100', battery_level_end: '____',
  media_links: 'телефон', damage_price_list: 'мотоцикл в сборе / царапина / прочее',
  document_key: 'rental-test-001',
  lessor_address: 'г. Нижний Новгород, пл. Комсомольская 2',
};

function renderTemplate(template, v) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, k) => String(v[k] ?? ''));
}

const renderedHtml = renderTemplate(htmlTemplate, vars);
console.log('Rendered HTML length:', renderedHtml.length);

const children = htmlToDocxElements(renderedHtml);
console.log('Produced docx elements:', children.length);
console.log('Element types:', children.map(e => e.constructor.name));

const doc = new Document({
  sections: [{
    properties: {
      page: {
        margin: { top: 1134, right: 1134, bottom: 1134, left: 1701 },
      },
    },
    children,
  }],
});

const buf = await Packer.toBuffer(doc);
const outPath = '/tmp/test-rental-contract.docx';
writeFileSync(outPath, buf);
console.log(`\nDOCX written to ${outPath} (${buf.length} bytes)`);
console.log('Open it in Word/LibreOffice to verify formatting!');
