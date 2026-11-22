// Probe live DB via REST: which bikes have sale flag / sale price, and how stored.
const url = "https://inmctohsodgdohamhzag.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) {
  console.error("SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/cars?select=id,make,model,type,crew_id,daily_price,specs&type=neq.service`, {
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
  },
});
if (!res.ok) {
  console.error("HTTP", res.status, await res.text());
  process.exit(1);
}
const cars = await res.json();

const rows = [];
for (const car of cars || []) {
  const specs = (car.specs || {});
  const sale = specs.sale;
  const saleOn = sale === true || sale === 1 || String(sale) === "1" || String(sale).toLowerCase() === "true";
  const hasPrice = specs.sale_price !== undefined || specs.price_rub !== undefined || specs.purchase_price !== undefined;
  if (saleOn || hasPrice) {
    rows.push({
      id: car.id,
      name: `${car.make} ${car.model}`,
      type: car.type,
      crew: car.crew_id,
      daily: car.daily_price,
      sale_flag: JSON.stringify(specs.sale ?? null),
      sale_price: specs.sale_price ?? null,
      price_rub: specs.price_rub ?? null,
      purchase_price: specs.purchase_price ?? null,
      other_price_keys: Object.keys(specs)
        .filter((k) => /price|стоим|цена/i.test(k) && !["sale_price", "price_rub", "purchase_price"].includes(k))
        .join(","),
    });
  }
}

console.log(`Total non-service vehicles: ${(cars || []).length}`);
console.log(`With sale flag or price keys: ${rows.length}\n`);
for (const r of rows) console.log(JSON.stringify(r));
