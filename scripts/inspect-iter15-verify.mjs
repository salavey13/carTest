// iter15: verify rental page data for kawasaki after retrofix
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RENTAL_ID = 'e4791134-de27-4ca0-a782-9408137599dc';

const r = await fetch(`${SB_URL}/rest/v1/rentals?rental_id=eq.${RENTAL_ID}&select=total_cost,metadata,vehicle:cars(make,model,specs)`, {
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
}).then(x => x.json());
const row = r[0];
const md = row.metadata || {};
const sp = row.vehicle?.specs || {};
console.log('total_cost:', row.total_cost);
console.log('bike:', row.vehicle?.make, row.vehicle?.model);
console.log('specs odometer:', sp.last_known_odometer, '| specs deposit:', sp.deposit_rub);
console.log('metadata.renter_phone:', md.renter_phone);
console.log('metadata.deposit_amount:', md.deposit_amount, '| deposit_rub:', md.deposit_rub, '| method:', md.deposit_method);
console.log('metadata.payment_split:', JSON.stringify(md.payment_split));
console.log('metadata.equipment:', JSON.stringify(md.equipment), '| gift:', md.equipment_gift_note);
console.log('metadata.odometer hint:', md.last_known_odometer, '/', md.odometer_before_hint);
console.log('doc_sha256:', String(md.doc_sha256).slice(0, 12), '| document_key:', md.document_key);

// artifact
const a = await fetch(`${SB_URL}/rest/v1/rental_contract_artifacts?rental_id=eq.${RENTAL_ID}&select=renter_phone,deposit_rub,total_sum,storage_path,crew_slug`, {
  headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Accept-Profile': 'private' },
}).then(x => x.json());
console.log('\nartifact:', JSON.stringify(a[0]));

// expected page-side resolution:
const odometerBefore = md.pickup_freeze?.odometer_km ?? md.odometer_before ?? md.last_known_odometer ?? md.odometer_before_hint ?? sp.last_known_odometer ?? null;
const depositRub = md.deposit_rub ?? md.depositRub ?? md.deposit_amount ?? null;
console.log('\n→ page will show odometer:', odometerBefore, 'km | deposit:', depositRub, '₽ | phone:', md.renter_phone);
