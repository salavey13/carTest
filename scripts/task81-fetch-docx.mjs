// Task 81: download the last surge sale contract docx + extract text (price check).
import { writeFileSync } from "node:fs";
import { createClient } from "/home/z/cartest/node_modules/@supabase/supabase-js/dist/main/index.js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: blob, error } = await sb.storage.from("rental-contracts").download("vip-bike/sale-y-volt-surge-v-1790526123753.docx");
if (error) { writeFileSync("/home/z/cartest/scripts/task81-docx-out.txt", "DOWNLOAD ERR: " + error.message); process.exit(0); }
const buf = Buffer.from(await blob.arrayBuffer());
writeFileSync("/home/z/cartest/scripts/task81-sale-contract.docx", buf);
console.log("downloaded bytes:", buf.length);
