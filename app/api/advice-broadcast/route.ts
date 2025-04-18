import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/hooks/supabase';
import { sendTelegramMessage } from '@/app/actions'; // Import the server action
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import type { Database } from "@/types/database.types";

// Define the structure expected in the user's metadata for this feature
type UserMetadata = {
  advice_broadcast?: {
    enabled: boolean;        // Is the broadcast active?
    article_id: string;      // Which article is being broadcast?
    remaining_section_ids: string[]; // Ordered list of section IDs yet to be sent
    last_sent_at?: string; // Optional: Timestamp of the last sent section
  };
};
type UserWithMetadata = Database["public"]["Tables"]["users"]["Row"]; // Assuming users table type includes metadata

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_USERS_PER_RUN = 50; // Process users in batches to avoid timeouts/limits

// Helper to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    // 2. --- Fetch Users with Active Broadcasts ---
    // Fetch users where metadata -> advice_broadcast -> enabled is true
    // Ensure you have a GIN index on metadata for performance:
    // CREATE INDEX idx_users_metadata_gin ON public.users USING GIN (metadata);
    const { data: users, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('user_id, metadata')
      // Correct way to query JSONB boolean in Supabase/Postgres
      .filter('metadata->advice_broadcast->>enabled', 'eq', 'true')
      .limit(MAX_USERS_PER_RUN); // Process in batches

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
      // Safely cast metadata, assuming it might be null or incorrect structure
      const metadata = user.metadata as UserMetadata | null | undefined;
      const broadcastInfo = metadata?.advice_broadcast;

      // Added stricter checks for required fields
      if (!broadcastInfo || broadcastInfo.enabled !== true || !broadcastInfo.article_id || !Array.isArray(broadcastInfo.remaining_section_ids) || broadcastInfo.remaining_section_ids.length === 0) {
        logger.warn(`User ${userId} has inconsistent or finished broadcast data. Disabling.`);
        // Attempt to disable the inconsistent state
        const { error: disableError } = await supabaseAdmin
          .from('users')
          .update({
              // Set metadata to disable, preserving other parts if they exist
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
          errors.push(`User ${userId}: Failed to disable inconsistent state - ${disableError.message}`);
        } else {
           debugLogger.log(`Disabled broadcast for user ${userId} due to inconsistent/finished data.`);
        }
        failedUsers++;
        continue; // Skip to the next user
      }

      const nextSectionId = broadcastInfo.remaining_section_ids[0];
      debugLogger.log(`Processing user ${userId}, article ${broadcastInfo.article_id}, next section ID: ${nextSectionId}`);

      try {
        // 4. --- Fetch Section Content ---
        // Include article_id in the query for better matching
        const { data: section, error: sectionError } = await supabaseAdmin
          .from('article_sections')
          .select('id, title, content') // Select id for logging/debugging
          .eq('id', nextSectionId)
          // Optional: Add check for article_id if sections can belong to multiple articles
          // .eq('article_id', broadcastInfo.article_id)
          .single();

        if (sectionError || !section) {
          logger.error(`Failed to fetch section ${nextSectionId} (Article: ${broadcastInfo.article_id}) for user ${userId}:`, sectionError);
          errors.push(`User ${userId}: Failed to fetch section ${nextSectionId} - ${sectionError?.message || 'Not Found'}`);
          failedUsers++;
          // Consider disabling broadcast for this user if section is permanently missing?
          // Or maybe just log and retry next time? For now, continue.
          continue;
        }

        // 5. --- Send Message via Telegram ---
        // Use Markdown formatting. Ensure special chars in title/content are handled by Telegram's parser.
        // Legacy markdown `*bold*` and `_italic_` are used. `\n` for newlines.
        const messagePrefix = section.title ? `*${section.title.trim()}*\n\n` : '';
        const messageContent = `${messagePrefix}${section.content.trim()}`;

        // Use the Server Action to send the message. sendTelegramMessage now handles parse_mode.
        const sendResult = await sendTelegramMessage(
          messageContent,
          [], // No buttons for broadcast messages
          undefined, // No image
          userId // Send to the specific user
        );

        if (!sendResult.success) {
           // Error includes API description if available
           logger.error(`Failed to send section ${nextSectionId} to user ${userId}: ${sendResult.error}`);
           errors.push(`User ${userId}: Failed to send message (Section ${nextSectionId}) - ${sendResult.error}`);
           failedUsers++;
           // Don't update metadata if sending failed, retry next time
           continue;
        }

        debugLogger.log(`Sent section ${nextSectionId} to user ${userId}.`);
        sentMessages++;

        // 6. --- Update User Metadata ---
        const updatedRemainingIds = broadcastInfo.remaining_section_ids.slice(1);
        const isFinished = updatedRemainingIds.length === 0;
        const newBroadcastState: UserMetadata['advice_broadcast'] = {
          ...broadcastInfo,
          remaining_section_ids: updatedRemainingIds,
          last_sent_at: new Date().toISOString(),
          enabled: !isFinished, // Disable ONLY if list is now empty
        };

        const { error: updateError } = await supabaseAdmin
          .from('users')
           // Ensure correct update structure for JSONB
          .update({ metadata: { ...metadata, advice_broadcast: newBroadcastState } })
          .eq('user_id', userId);

        if (updateError) {
          logger.error(`Failed to update metadata for user ${userId} after sending section ${nextSectionId}:`, updateError);
          errors.push(`User ${userId}: Failed metadata update (Section ${nextSectionId}) - ${updateError.message}`);
          // Message was sent, but state not updated - potential duplicate next run. Critical issue.
          failedUsers++; // Count as failed for reporting
        } else {
           debugLogger.log(`Updated metadata for user ${userId}. Remaining sections: ${updatedRemainingIds.length}. Enabled: ${newBroadcastState.enabled}`);
           if (isFinished) {
               debugLogger.log(`User ${userId} finished broadcast for article ${broadcastInfo.article_id}.`);
           }
        }

        // Add a small delay between users to potentially avoid hitting Telegram rate limits
        await delay(100); // 100ms delay (adjust as needed)

      } catch (innerError) {
        logger.error(`Unexpected error processing user ${userId} (Section ${nextSectionId}):`, innerError);
        errors.push(`User ${userId}: Unexpected error (Section ${nextSectionId}) - ${innerError instanceof Error ? innerError.message : 'Unknown'}`);
        failedUsers++;
      }
    } // End user loop

    // 7. --- Return Summary ---
    const summaryMessage = `Advice broadcast run complete. Processed: ${processedUsers}. Sent: ${sentMessages}. Failed: ${failedUsers}.`;
    debugLogger.log(summaryMessage);
    if (errors.length > 0) {
        // Log all errors, but only return a sample
        logger.warn('Advice broadcast finished with errors:', errors);
    }

    return NextResponse.json({
      message: summaryMessage,
      processedUsers,
      sentMessages,
      failedUsers,
      errors: errors.slice(0, 10), // Limit reported errors in response
    });

  } catch (error) {
    logger.error('Critical error in advice broadcast API:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}