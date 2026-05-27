#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const TEMPLATE_MD = 'docs/RENTAL_DEAL_TEMPLATE.md';
const TEMPLATE_HTML = 'docs/RENTAL_DEAL_TEMPLATE.html';
const REQUIRED_VARS = [
  'contract_number','day','month_num','year','renter_full_name','bike_vin','bike_make','bike_model',
  'bike_category','bike_color','bike_year','bike_engine_cc','bike_power_hp','rent_start_date',
  'rent_start_time','rent_end_date','rent_end_time','return_address','daily_price_rub','subtotal_rub','deposit_rub',
];

function extractVars(template) {
  const vars = new Set();
  for (const match of template.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
    vars.add(match[1]);
  }
  return vars;
}

function verifyMode(name, vars) {
  const missing = REQUIRED_VARS.filter((item) => !vars.has(item));
  if (missing.length) {
    throw new Error(`${name}: missing required variables: ${missing.join(', ')}`);
  }
}

const mdVars = extractVars(readFileSync(TEMPLATE_MD, 'utf8'));
const htmlVars = extractVars(readFileSync(TEMPLATE_HTML, 'utf8'));

verifyMode('md', mdVars);
verifyMode('html', htmlVars);

const onlyMd = [...mdVars].filter((item) => !htmlVars.has(item));
const onlyHtml = [...htmlVars].filter((item) => !mdVars.has(item));
if (onlyMd.length || onlyHtml.length) {
  throw new Error(`template variable mismatch (only md: ${onlyMd.join(', ') || '-'}; only html: ${onlyHtml.join(', ') || '-'})`);
}

console.log('OK: md/html templates contain identical variable keys and all required vars.');
