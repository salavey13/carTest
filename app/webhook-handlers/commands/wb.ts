import { sendComplexMessage, KeyboardButton } from "../actions/sendComplexMessage";
import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import Papa from "papaparse";

// Helper to safely parse JSON specs
const safeParseSpecs = (specs: any) => {
  if (!specs) return {};
  if (typeof specs === 'object') return specs;
  try { return JSON.parse(specs); } catch { return {}; }
};

export async function wbCommand(chatId: number, userId: string) {
  const logPrefix = `[wbCommand user:${userId}]`;
  logger.info(`${logPrefix} Initiating warehouse protocol...`);

  try {
    // 1. Identify Crew Membership & Ownership
    // We check both memberships AND ownerships to be safe
    const [memberRes, ownerRes] = await Promise.all([
      supabaseAdmin
        .from('crew_members')
        .select('crew_id, role, crews(id, name, slug, owner_id)')
        .eq('user_id', userId)
        .eq('membership_status', 'active'),
      supabaseAdmin
        .from('crews')
        .select('id, name, slug, owner_id')
        .eq('owner_id', userId)
    ]);

    // Combine and deduplicate crews
    const crewsMap = new Map<string, { id: string; name: string; slug: string; role: string }>();

    // Process memberships
    memberRes.data?.forEach((m: any) => {
      if (m.crews) {
        crewsMap.set(m.crews.id, {
          id: m.crews.id,
          name: m.crews.name,
          slug: m.crews.slug,
          role: m.role
        });
      }
    });

    // Process ownerships (override role to owner)
    ownerRes.data?.forEach((c: any) => {
      crewsMap.set(c.id, {
        id: c.id,
        name: c.name,
        slug: c.slug,
        role: 'owner'
      });
    });

    const activeCrews = Array.from(crewsMap.values());

    // 2. Scenario: No Crew Found (The "Ghost" Scenario)
    if (activeCrews.length === 0) {
      await sendComplexMessage(chatId, 
        `🛑 *ACCESS DENIED*
        
        User \`${userId}\` is not associated with any active Warehouse Crew.
        
        *Protocol requires:*
        1. Create your own HQ (Free).
        2. Or get an invite link from a Crew Owner.
        
        _Stop working in manual mode._`,
        [
            [{ text: "🚀 Create Warehouse HQ", url: "https://t.me/oneBikePlsBot/app?startapp=create_crew" }] 
        ],
        { parseMode: 'Markdown' }
      );
      return;
    }

    // 3. Scenario: Active Crew Found (The "Captain" Scenario)
    // Default to the first crew found (or most relevant logic can be added later)
    const targetCrew = activeCrews[0];
    
    await sendComplexMessage(chatId, `📡 *Uplink Established: ${targetCrew.name}* \n_Gathering intelligence..._`, [], { parseMode: 'Markdown' });

    // Fetch Items for this Crew
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('cars') // Assuming 'cars' table is used for items based on context
      .select('*')
      .eq('crew_id', targetCrew.id)
      .eq('type', 'wb_item'); // Filter only warehouse items

    if (itemsError || !items) {
      logger.error(`${logPrefix} Failed to fetch items`, itemsError);
      await sendComplexMessage(chatId, `⚠️ *System Error:* Could not retrieve inventory data for ${targetCrew.slug}.`, []);
      return;
    }

    // 4. Analyze Data (The Vibe Report)
    let totalQty = 0;
    let totalSKUs = items.length;
    let zeroStockCount = 0;
    
    // Prepare Export Data
    const exportRows: any[] = [];
    const wbSyncRows: any[] = [];

    items.forEach(item => {
      const specs = safeParseSpecs(item.specs);
      
      // Calculate Total Quantity across all voxels
      const locs = specs.warehouse_locations || [];
      const itemQty = locs.reduce((sum: number, l: any) => sum + (Number(l.quantity) || 0), 0);
      
      totalQty += itemQty;
      if (itemQty === 0) zeroStockCount++;

      // General Export
      exportRows.push({
        id: item.id,
        name: `${item.make || ''} ${item.model || ''}`.trim(),
        total_qty: itemQty,
        locations: locs.map((l: any) => `${l.voxel_id}:${l.quantity}`).join('; '),
        wb_sku: specs.wb_sku || '',
        ozon_sku: specs.ozon_sku || '',
        ym_sku: specs.ym_sku || ''
      });

      // WB Specific (Barcode based)
      if (specs.wb_sku) {
        wbSyncRows.push({
          "бар-код": specs.wb_sku,
          "количество": itemQty
        });
      }
    });

    // 5. Generate Status Message
    const statusIcon = totalQty > 0 ? '🟢' : '🔴';
    const healthScore = Math.max(0, 100 - (zeroStockCount * 2)); // Arbitrary gamification
    
    const reportText = `
🏴‍☠️ *WAREHOUSE STATUS REPORT*
Target: \`${targetCrew.slug}\`
Role: ${targetCrew.role.toUpperCase()}

${statusIcon} *Operational Status:* ${healthScore}% Efficient
📦 *Total Stock:* ${totalQty} units
🔢 *Active SKUs:* ${totalSKUs}
👻 *Zero Stock:* ${zeroStockCount} (Ghost Risk)

_Downloading manifest files..._
    `.trim();

    // Keyboard to open Web App directly to this crew
    const keyboard: KeyboardButton[][] = [
        [{ text: `📱 Open ${targetCrew.name} Dashboard`, url: `https://t.me/oneBikePlsBot/app?startapp=crew_${targetCrew.slug}` }]
    ];

    await sendComplexMessage(chatId, reportText, keyboard, { parseMode: 'Markdown' });

    // 6. Send CSVs
    if (exportRows.length > 0) {
      // Full Internal Report
      const fullCsv = Papa.unparse(exportRows, { header: true, delimiter: '\t' }); // TSV is safer for Russian text
      await sendComplexMessage(chatId, "📂 *Full Inventory Audit (Internal)*", [], {
        attachment: { type: 'document', content: fullCsv, filename: `${targetCrew.slug}_FULL_AUDIT.tsv` },
        parseMode: 'Markdown'
      });

      // WB Sync File
      if (wbSyncRows.length > 0) {
        const wbCsv = Papa.unparse(wbSyncRows, { header: true, delimiter: ';', quotes: false }); // WB likes semicolons
        await sendComplexMessage(chatId, "🟣 *Wildberries Stock Update*", [], {
          attachment: { type: 'document', content: wbCsv, filename: `${targetCrew.slug}_WB_STOCKS.csv` },
          parseMode: 'Markdown'
        });
      }
    } else {
      await sendComplexMessage(chatId, "⚠️ Warehouse is empty. Upload a CSV in the Web App to initialize.", [], { parseMode: 'Markdown' });
    }

  } catch (err: any) {
    logger.error(`${logPrefix} Critical Error:`, err);
    await sendComplexMessage(chatId, '☠️ *CRITICAL FAILURE* \nThe command deck crashed. Check system logs.', [], { parseMode: 'Markdown' });
  }
}