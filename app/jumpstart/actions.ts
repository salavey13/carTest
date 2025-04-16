"use server";

// Re-export necessary actions for now, keeps things organized.
// More Jumpstart-specific actions can be added here later.
import { notifyAdmin } from "@/app/actions";
import { logger } from "@/lib/logger";

// Example: Notify admin about a new Jumpstart Kit request
export async function notifyJumpstartRequest(applicantUserId: string, applicantUsername?: string | null): Promise<{ success: boolean; error?: string }> {
    const message = `🚀 New Supervibe Jumpstart Kit Request!\nUser: ${applicantUsername || applicantUserId} (${applicantUserId})`;
    logger.info(`[Jumpstart Action] Notifying admin about new request from ${applicantUserId}`);
    return notifyAdmin(message);
}

// You might add other Jumpstart-specific actions here in the future,
// e.g., functions to provision a template, assign a bot instance, etc.