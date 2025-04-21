import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/hooks/supabase';
import { sendTelegramMessage } from '@/app/actions'; // Import the server action
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import type { Database } from "@/types/database.types";

// --- Types ---
// Define the structure expected in the user's metadata for this feature
// (Fully written out, no skip)
type UserMetadata = {
  advice_broadcast?: {
    enabled: boolean;        // Is the broadcast active?
    article_id: string;      // Which article is being broadcast?
    remaining_section_ids: string[]; // Ordered list of section IDs yet to be sent
    last_sent_at?: string; // Optional: Timestamp of the last sent section
  };
};
// Assuming users table type includes metadata, adjust if needed
type UserWithMetadata = Database["public"]["Tables"]["users"]["Row"];

// --- Constants ---
const CRON_SECRET = process.env.CRON_SECRET;
const MAX_USERS_PER_RUN = 50; // Process users in batches

// --- Helpers ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Escapes characters that have special meaning in Telegram's Legacy Markdown (V1).
 * Note: This prevents using these characters for formatting within the escaped string.
 * Characters escaped: _, *, `, [
 */
function escapeTelegramMarkdownV1(text: string): string {
    if (!text) return '';
    // Escape the characters in order: ` first, then others
    return text
        .replace(/`/g, '\\`') // Escape backticks
        .replace(/_/g, '\\_') // Escape underscores
        .replace(/\*/g, '\\*') // Escape asterisks
        .replace(/\[/g, '\\['); // Escape opening square brackets
}

// --- API Route Handler ---
export async function POST(request: Request) {
    const authorization = request.headers.get('Authorization');

    // 1. --- Security Check ---
    if (authorization !== `Bearer ${CRON_SECRET}`) {
        logger.warn('Unauthorized attempt to access advice broadcast API.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    debugLogger.log('Advice broadcast API triggered by cron.');

    let processedUsers = 0;
    let sentMessages = 0;
    let failedUsers = 0;
    const errors: string[] = [];

    try {
        // 2. --- Fetch Users ---
        debugLogger.log('Fetching users with active broadcasts...');
        const { data: users, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('user_id, metadata')
            .filter('metadata->advice_broadcast->>enabled', 'eq', 'true')
            .limit(MAX_USERS_PER_RUN);

        if (fetchError) {
            logger.error('Failed to fetch users for advice broadcast:', fetchError);
            throw new Error(`Database error fetching users: ${fetchError.message}`);
        }

        if (!users || users.length === 0) {
            debugLogger.log('No users found with active advice broadcasts.');
            return NextResponse.json({ message: 'No active broadcasts found.', processedUsers: 0, sentMessages: 0 });
        }
        debugLogger.log(`Found ${users.length} users with active broadcasts.`);

        // 3. --- Process Each User ---
        for (const user of users) {
            processedUsers++;
            const userId = user.user_id;
            const metadata = user.metadata as UserMetadata | null | undefined;
            const broadcastInfo = metadata?.advice_broadcast;

            // --- Validate broadcast info ---
            if (!broadcastInfo || broadcastInfo.enabled !== true || !broadcastInfo.article_id || !Array.isArray(broadcastInfo.remaining_section_ids) || broadcastInfo.remaining_section_ids.length === 0) {
                logger.warn(`User ${userId} has inconsistent/finished broadcast data. Disabling.`);
                // Attempt to disable the inconsistent state
                const { error: disableError } = await supabaseAdmin
                    .from('users')
                    .update({
                        metadata: {
                            ...(metadata || {}), // Keep existing metadata
                            advice_broadcast: { // Overwrite/set advice_broadcast part
                                ...(broadcastInfo || {}), // Keep existing broadcast info if possible
                                enabled: false, // Explicitly disable
                                remaining_section_ids: [] // Clear remaining IDs
                            }
                        }
                    })
                    .eq('user_id', userId);

                if (disableError) {
                    logger.error(`Failed to disable inconsistent broadcast for user ${userId}:`, disableError);
                    errors.push(`User ${userId}: Failed disable - ${disableError.message}`);
                } else {
                    debugLogger.log(`Disabled broadcast for user ${userId}.`);
                }
                failedUsers++;
                continue; // Skip to the next user
            }

            const nextSectionId = broadcastInfo.remaining_section_ids[0];
            debugLogger.log(`Processing user ${userId}, article ${broadcastInfo.article_id}, next section ID: ${nextSectionId}`);

            try {
                // 4. --- Fetch Section Content ---
                debugLogger.log(`Fetching content for section ${nextSectionId}...`);
                const { data: section, error: sectionError } = await supabaseAdmin
                    .from('article_sections')
                    .select('id, title, content')
                    .eq('id', nextSectionId)
                    .single();

                if (sectionError || !section) {
                    logger.error(`Failed to fetch section ${nextSectionId} for user ${userId}:`, sectionError);
                    errors.push(`User ${userId}: Failed fetch section ${nextSectionId} - ${sectionError?.message || 'Not Found'}`);
                    failedUsers++;
                    continue; // Skip user if section content fails
                }
                debugLogger.log(`Fetched content for section ${section.id}. Title: ${section.title?.substring(0, 30)}...`);

                // 5. --- Prepare and Send Message via Telegram ---
                const rawTitle = section.title?.trim() || '';
                const rawContent = section.content?.trim() || '';

                // Unescape literal '\\n' from DB content to actual newlines
                const processedContent = rawContent.replace(/\\n/g, '\n');

                // Escape potential Markdown V1 special characters
                const escapedTitle = escapeTelegramMarkdownV1(rawTitle);
                const escapedContent = escapeTelegramMarkdownV1(processedContent);

                // Construct the message: Apply bold *after* escaping title content
                const messagePrefix = escapedTitle ? `*${escapedTitle}*\n\n` : '';
                const finalMessageContent = `${messagePrefix}${escapedContent}`;

                debugLogger.log(`Sending final message to user ${userId} (length: ${finalMessageContent.length}). Start: ${finalMessageContent.substring(0, 100)}...`);

                // Call sendTelegramMessage action
                const sendResult = await sendTelegramMessage(
                    finalMessageContent,
                    [], // No buttons
                    undefined, // No image
                    userId
                );

                if (!sendResult.success) {
                    const isParsingError = sendResult.error?.includes("can't parse entities");
                    const logOrErrorMessage = `User ${userId}: Failed send (Section ${section.id}) - ${sendResult.error || 'Unknown TG Error'}${isParsingError ? ' <-- Check source Markdown V1!' : ''}`;
                    logger.error(logOrErrorMessage);
                    errors.push(logOrErrorMessage);
                    failedUsers++;
                    continue; // Don't update metadata if send failed
                }

                debugLogger.log(`Sent section ${section.id} to user ${userId}.`);
                sentMessages++;

                // 6. --- Update User Metadata ---
                const updatedRemainingIds = broadcastInfo.remaining_section_ids.slice(1);
                const isFinished = updatedRemainingIds.length === 0;
                const newBroadcastState: UserMetadata['advice_broadcast'] = {
                    ...broadcastInfo,
                    remaining_section_ids: updatedRemainingIds,
                    last_sent_at: new Date().toISOString(),
                    enabled: !isFinished,
                };

                debugLogger.log(`Updating metadata for user ${userId}. Finished: ${isFinished}`);
                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({ metadata: { ...metadata, advice_broadcast: newBroadcastState } })
                    .eq('user_id', userId);

                if (updateError) {
                    logger.error(`Failed to update metadata for user ${userId} after sending section ${section.id}:`, updateError);
                    errors.push(`User ${userId}: Failed metadata update (Section ${section.id}) - ${updateError.message}`);
                    failedUsers++; // Count as failure, potential duplicate next time
                } else {
                    debugLogger.log(`Updated metadata for user ${userId}. Remaining: ${updatedRemainingIds.length}. Enabled: ${newBroadcastState.enabled}`);
                    if (isFinished) { debugLogger.log(`User ${userId} finished broadcast for article ${broadcastInfo.article_id}.`); }
                }

                // Add delay
                await delay(150); // Delay between users

            } catch (innerError) {
                logger.error(`Unexpected error processing user ${userId} (Section ${nextSectionId}):`, innerError);
                errors.push(`User ${userId}: Unexpected error (Section ${nextSectionId}) - ${innerError instanceof Error ? innerError.message : 'Unknown'}`);
                failedUsers++;
            }
        } // End user loop

        // 7. --- Return Summary ---
        const summaryMessage = `Advice broadcast run complete. Processed: ${processedUsers}. Sent: ${sentMessages}. Failed: ${failedUsers}.`;
        debugLogger.log(summaryMessage);
        if (errors.length > 0) { logger.warn('Advice broadcast finished with errors:', errors); }

        return NextResponse.json({
            message: summaryMessage,
            processedUsers,
            sentMessages,
            failedUsers,
            errors: errors.slice(0, 10), // Limit reported errors
        });

    } catch (error) {
        logger.error('Critical error in advice broadcast API:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}