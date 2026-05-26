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
const { data: bike, error } = await supabase.from('cars').select('id,make,model,specs').eq('id', bikeId).single();
if (error) throw error;

const template = readFileSync('docs/RENTAL_DEAL_TEMPLATE_DEMO.md','utf8');
const now = new Date();
const vars = {
  contract_number: `${now.getDate()}.${now.getMonth()+1}/${bikeId}`,
  day: String(now.getDate()).padStart(2,'0'),
  month: now.toLocaleString('ru-RU',{month:'long'}),
  year: String(now.getFullYear()),
  renter_full_name: passportJson.fullName,
  renter_phone: passportJson.phone || '',
  renter_driver_license: `${licenseJson.series||''} ${licenseJson.number||''}`.trim(),
  renter_passport: `${passportJson.series||''} ${passportJson.number||''}`.trim(),
  bike_make_model: `${bike.make||''} ${bike.model||''}`.trim(),
  bike_plate: bike.specs?.plate || 'уточняется',
  bike_vin: bike.specs?.vin || bike.specs?.frame || 'уточняется',
  rent_start_time: arg('startTime','18:00'), rent_start_date: arg('startDate', now.toLocaleDateString('ru-RU')),
  rent_end_time: arg('endTime','10:00'), rent_end_date: arg('endDate', now.toLocaleDateString('ru-RU')),
  daily_price_rub: arg('dailyPrice','10000'), subtotal_rub: arg('subtotal','20000'), deposit_rub: arg('deposit','20000'),
  included_mileage:'200', overage_rate:'35', late_return_penalty_rub:'10000', bike_value_rub:'850000', bike_value_words:'Восемьсот пятьдесят тысяч',
  return_address:'г. Нижний Новгород, пл. Комсомольская 2', issuer_name:'Воробьев Р.В.', issuer_signatory:'Менеджер Мотосалона', issuer_representative:'ИП Воробьев Р.В.', signature_timestamp: now.toLocaleString('ru-RU'), signature_fingerprint:'offline-skill', renter_signature:'согласие через Telegram', bike_mileage: String(bike.specs?.mileage||''), equipment:'ключ(и) 1 шт.; шлем 1', damage_notes_at_delivery:'от даты начала аренды', document_key:`rental-${bikeId}-${Date.now()}`
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
console.log(JSON.stringify({ok:true, bikeId, chatId: telegramChatId, messageId: json.result?.message_id}, null, 2));
