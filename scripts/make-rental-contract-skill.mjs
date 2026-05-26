#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { Document, Packer, Paragraph, TextRun } from 'docx';

function arg(name, fallback = '') { const i = process.argv.indexOf(`--${name}`); return i>=0 ? (process.argv[i+1]||'') : fallback; }
const phrase = arg('phrase');
const bikeId = (phrase.match(/сделай\s+договор\s+(.+)$/i)?.[1] || arg('bikeId')).trim();
if (!bikeId) throw new Error('Use --phrase "сделай договор <bike_id>" or --bikeId <bike_id>');

const passportJson = JSON.parse(readFileSync(arg('passportJson'),'utf8'));
const licenseJson = JSON.parse(readFileSync(arg('licenseJson'),'utf8'));
const telegramChatId = arg('telegramChatId', process.env.ADMIN_CHAT_ID || '');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);


const norm = (v='') => String(v).toLowerCase().replace(/[^a-zа-я0-9]+/gi,' ').trim();
const scoreBike = (q, bike) => {
  const hay = [bike.id, bike.make, bike.model, bike.specs?.vin, bike.specs?.frame].map(norm).join(' ');
  const qn = norm(q);
  if (!qn) return 0;
  if (hay.includes(qn)) return 1000 + qn.length;
  const parts = qn.split(' ').filter(Boolean);
  let score = 0;
  for (const p of parts) if (hay.includes(p)) score += 20 + p.length;
  // fuzzy subsequence bonus for compact ids like falcon gt / falcon-gt-2025
  const compactHay = hay.replace(/\s+/g, '');
  const compactQ = qn.replace(/\s+/g, '');
  let i = 0;
  for (const ch of compactQ) { const j = compactHay.indexOf(ch, i); if (j >= 0) { score += 1; i = j + 1; } }
  return score;
};

const { data: bikes, error } = await supabase.from('cars').select('id,make,model,specs').limit(1000);
if (error) throw error;
if (!bikes?.length) throw new Error('No bikes found in cars table');
const ranked = bikes.map(b => ({ bike: b, score: scoreBike(bikeId, b) })).sort((a,b)=>b.score-a.score);
const top = ranked[0];
if (!top || top.score <= 0) throw new Error(`No matching bike for input: ${bikeId}`);
const bike = top.bike;

const template = readFileSync('docs/RENTAL_DEAL_TEMPLATE_DEMO.md','utf8');
const now = new Date();
const vars = {
  contract_number: `${now.getDate()}.${now.getMonth()+1}/${bike.id}`,
  day: String(now.getDate()).padStart(2,'0'),
  month: now.toLocaleString('ru-RU',{month:'long'}),
  month_num: String(now.getMonth()+1).padStart(2,'0'),
  year: String(now.getFullYear()),
  renter_full_name: passportJson.fullName,
  renter_phone: passportJson.phone || '',
  renter_driver_license: `${licenseJson.series||''} ${licenseJson.number||''}`.trim(),
  renter_passport: `${passportJson.series||''} ${passportJson.number||''}`.trim(),
  bike_make_model: `${bike.make||''} ${bike.model||''}`.trim(),
  bike_make: bike.make || 'уточняется',
  bike_model: bike.model || 'уточняется',
  bike_plate: bike.specs?.plate || 'уточняется',
  bike_vin: bike.specs?.vin || bike.specs?.frame || bike.specs?.vin_number || 'уточняется',
  bike_category: bike.specs?.category || bike.specs?.tp_category || 'A/L3',
  bike_color: bike.specs?.color || 'уточняется',
  bike_year: bike.specs?.year || bike.specs?.production_year || 'уточняется',
  bike_engine_cc: bike.specs?.engine_cc || bike.specs?.displacement_cc || '0',
  bike_power_hp: bike.specs?.power_hp || bike.specs?.max_power_hp || '0',
  rent_start_time: arg('startTime','18:00'), rent_start_date: arg('startDate', now.toLocaleDateString('ru-RU')),
  rent_end_time: arg('endTime','10:00'), rent_end_date: arg('endDate', now.toLocaleDateString('ru-RU')),
  daily_price_rub: arg('dailyPrice','10000'), subtotal_rub: arg('subtotal','20000'), deposit_rub: arg('deposit','20000'),
  included_mileage:'200', overage_rate:'35', included_km_per_day:'200', extra_km_fee_rub:'35', late_return_penalty_rub:'10000', late_return_penalty_max_days:'90', bike_value_rub:'850000', bike_value_words:'Восемьсот пятьдесят тысяч',
  return_address:'г. Нижний Новгород, пл. Комсомольская 2', issuer_name:'Воробьев Р.В.', issuer_signatory:'Менеджер Мотосалона', issuer_representative:'ИП Воробьев Р.В.', signature_timestamp: now.toLocaleString('ru-RU'), signature_fingerprint:'offline-skill', renter_signature:'согласие через Telegram', bike_mileage: String(bike.specs?.mileage||''), equipment:'ключ(и) 1 шт.; шлем 1', damage_notes_at_delivery:'от даты начала аренды', damage_notes_at_return:'от даты возврата тс', battery_level_start:'100 %', battery_level_end:'____ %', media_links:'телефон', renter_passport_issue_date: passportJson.issueDate || '', renter_registration: passportJson.registration || '', damage_price_list:'мотоцикл в сборе / царапина на пластике / прочее по расчету', document_key:`rental-${bike.id}-${Date.now()}`
};
let rendered = template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_,k)=> String(vars[k] ?? ''));
const doc = new Document({sections:[{children: rendered.split('\n').map(line=>new Paragraph({children:[new TextRun(line)]}))}]});
const buf = await Packer.toBuffer(doc);

const form = new FormData();
form.append('chat_id', telegramChatId);
form.append('document', new Blob([buf], {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}), `rental-contract-${bikeId}.docx`);
const token = process.env.TELEGRAM_BOT_TOKEN;
const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {method:'POST', body: form});
const json = await res.json();
if (!json.ok) throw new Error(`Telegram send failed: ${JSON.stringify(json)}`);
console.log(JSON.stringify({ok:true, requestedBikeId: bikeId, resolvedBikeId: bike.id, chatId: telegramChatId, messageId: json.result?.message_id}, null, 2));
