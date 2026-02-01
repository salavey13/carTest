"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { sendTelegramInvoice } from "@/app/actions";
import { logger } from "@/lib/logger";

// === INTERFACES ===
export interface BountyItem {
  id: string;
  amount: number;
  title: string;
  description: string;
  status: 'open' | 'wip' | 'done';
  backerCount: number; // For social proof
}

// === 1. CREATE BOUNTY / DONATION ===
export async function createBountyInvoice(
  userId: string, 
  amount: number, 
  mode: 'love' | 'mutate', 
  details: { title?: string; desc?: string }
) {
  try {
    // 1. Validation
    if (amount < 10) throw new Error("Minimum amount is 10 XTR");
    
    // 2. Format Payload & Metadata
    const timestamp = Date.now();
    const type = mode === 'love' ? 'donation_pure' : 'bounty_request';
    const payload = `${type}_${userId}_${timestamp}`;
    
    const title = mode === 'love' ? "Поддержка Архитектора" : `BOUNTY: ${details.title?.substring(0, 30)}...`;
    const description = mode === 'love' 
      ? (details.desc || "Fuel for the code engine.")
      : `Feature Request: ${details.title}. \n${details.desc}`;

    // 3. Send Invoice via Telegram (Transport Layer)
    const invoiceRes = await sendTelegramInvoice(
      userId,
      title,
      description,
      payload,
      amount,
      0, // No subscription ID needed
      undefined // Optional photo
    );

    if (!invoiceRes.success) throw new Error(invoiceRes.error);

    // 4. Save to Database (The Ledger)
    // We use 'invoices' table as the source of truth for voting
    await supabaseAdmin.from("invoices").insert({
      id: payload,
      user_id: userId,
      amount: amount,
      type: type,
      status: "pending", // Will be updated to 'paid' by webhook
      metadata: {
        bounty_title: details.title || "Donation",
        bounty_desc: details.desc || "",
        bounty_mode: mode,
        display_on_board: mode === 'mutate' // Only mutations go to the board
      }
    });

    logger.info(`[Bounty] Invoice created: ${payload}`);
    return { success: true };

  } catch (error) {
    logger.error("[Bounty] Creation failed:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed" };
  }
}

// === 2. FETCH ACTIVE BOUNTIES (The Board) ===
export async function fetchActiveBounties(): Promise<{ success: boolean; data: BountyItem[] }> {
  try {
    // Fetch only PAID invoices that are marked for display
    // This effectively turns the invoice table into a voting mechanism
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('status', 'paid')
      .eq('type', 'bounty_request') 
      .order('amount', { ascending: false }) // Highest bidders first
      .limit(20);

    if (error) throw error;

    // Transform DB rows into UI objects
    const bounties: BountyItem[] = data.map((row: any) => ({
      id: row.id,
      amount: row.amount,
      title: row.metadata?.bounty_title || "Unknown Feature",
      description: row.metadata?.bounty_desc || "",
      status: row.metadata?.dev_status || 'open', // Admin can update this metadata manually later
      backerCount: 1 // In V2, you can group by title to show multiple backers
    }));

    return { success: true, data: bounties };

  } catch (error) {
    logger.error("[Bounty] Fetch failed:", error);
    return { success: false, data: [] };
  }
}