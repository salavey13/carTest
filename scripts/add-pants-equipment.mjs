#!/usr/bin/env node
/**
 * Add pants equipment to public.cars table for all crews
 * Pants equipment already exists in migration 20260812000006_seed_equipment.sql
 * This script verifies pants exist and shows their IDs
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Load environment
const envPath = '.env.local';
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log('🔍 Checking pants equipment in public.cars...\n');

  // Query for pants equipment
  const { data: pants, error } = await supabase
    .from('cars')
    .select('id, crew_id, make, model, type, specs')
    .eq('type', 'equipment')
    .like('id', 'equip-pants-%');

  if (error) {
    console.error('❌ Error querying pants:', error.message);
    process.exit(1);
  }

  if (!pants || pants.length === 0) {
    console.log('⚠️  No pants equipment found. Adding pants for all crews...\n');

    // Get all crews
    const { data: crews } = await supabase
      .from('crews')
      .select('id, slug');

    if (!crews || crews.length === 0) {
      console.error('❌ No crews found');
      process.exit(1);
    }

    // Insert pants for each crew
    for (const crew of crews) {
      const pantsId = `equip-pants-trail-adv-${crew.slug}`;
      console.log(`  Adding pants for crew: ${crew.slug} (id: ${pantsId})`);

      const { error: insertError } = await supabase
        .from('cars')
        .insert({
          id: pantsId,
          crew_id: crew.id,
          make: 'MT',
          model: 'Trail Adv',
          description: 'Штаны для эндуро и туризма. Влагостойкие, с защитой коленей.',
          type: 'equipment',
          daily_price: 500,
          image_url: '',
          rent_link: '',
          specs: {
            category: "pants",
            brand: "MT",
            collection: "Adventure",
            materials: "Полиэстер 600D, мембрана Reissa",
            protection: ["CE Level 1 колени", "Карман для защиты бёдер"],
            features: ["Влагостойкие", "Регулируемая талия"],
            season: ["Весна", "Лето", "Осень"],
            sizes: ["S", "M", "L", "XL", "XXL"],
            colors: ["Чёрный"],
            badge: "versatile",
            badge_color: "#3b82f6"
          }
        });

      if (insertError) {
        console.error(`    ❌ Error: ${insertError.message}`);
      } else {
        console.log(`    ✅ Added`);
      }
    }
  } else {
    console.log(`✅ Found ${pants.length} pants equipment records:\n`);
    pants.forEach(p => {
      console.log(`  • ${p.id}: ${p.make} ${p.model} (crew: ${p.crew_id})`);
    });
  }

  console.log('\n📋 Equipment catalog with pants included:');
  const { data: allEquipment } = await supabase
    .from('cars')
    .select('id, make, model, type')
    .eq('type', 'equipment')
    .order('id');

  if (allEquipment) {
    const categories = {};
    allEquipment.forEach(eq => {
      const cat = eq.id.split('-')[1]; // helmet, jacket, pants, gloves, boots, etc.
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(`${eq.make} ${eq.model}`);
    });

    Object.entries(categories).forEach(([cat, items]) => {
      console.log(`  ${cat}: ${items.join(', ')}`);
    });
  }

  console.log('\n✅ Pants equipment verified/added successfully!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
