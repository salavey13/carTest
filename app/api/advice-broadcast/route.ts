// УБИРАЕМ "use server"; отсюда, так как это Route Handler, а не чистый Server Action файл.

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/hooks/supabase';
import { sendTelegramMessage } from '@/app/actions'; 
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import type { Database } from "@/types/database.types";

// --- Types ---
type UserMetadata = {
  advice_broadcast?: {
    enabled: boolean;        
    article_id: string;      
    remaining_section_ids: string[]; 
    last_sent_at?: string; 
  };
  [key: string]: any; 
};
type UserWithMetadata = Database["public"]["Tables"]["users"]["Row"];

// --- Constants ---
const CRON_SECRET = process.env.CRON_SECRET;
const MAX_USERS_PER_RUN = 50; 

// --- Helpers ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function escapeTelegramMarkdownV1(text: string): string {
    if (!text) return '';
    return text
        .replace(/`/g, '\\`') 
        .replace(/_/g, '\\_') 
        .replace(/\*/g, '\\*') 
        .replace(/\[/g, '\\['); 
}

// --- API Route Handler ---
export async function POST(request: Request) {
    const authorization = request.headers.get('Authorization');

    if (authorization !== `Bearer ${CRON_SECRET}`) {
        logger.warn('Unauthorized attempt to access advice broadcast API (POST).');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    debugLogger.log('Advice broadcast API (POST) triggered by cron.');

    let processedUsers = 0;
    let sentMessages = 0;
    let failedUsers = 0;
    const errors: string[] = [];

    try {
        debugLogger.log('Fetching users with active broadcasts (POST)...');
        const { data: users, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('user_id, metadata') 
            .filter('metadata->advice_broadcast->>enabled', 'eq', 'true') 
            .limit(MAX_USERS_PER_RUN);

        if (fetchError) {
            logger.error('Failed to fetch users for advice broadcast (POST):', fetchError);
            throw new Error(`Database error fetching users: ${fetchError.message}`);
        }

        if (!users || users.length === 0) {
            debugLogger.log('No users found with active advice broadcasts (POST).');
            return NextResponse.json({ message: 'No active broadcasts found.', processedUsers: 0, sentMessages: 0 });
        }
        debugLogger.log(`Found ${users.length} users with active broadcasts (POST).`);

        for (const user of users) {
            processedUsers++;
            const userId = user.user_id;
            const metadata = user.metadata as UserMetadata | null | undefined; 
            const broadcastInfo = metadata?.advice_broadcast;

            if (!broadcastInfo || broadcastInfo.enabled !== true || !broadcastInfo.article_id || !Array.isArray(broadcastInfo.remaining_section_ids) || broadcastInfo.remaining_section_ids.length === 0) {
                logger.warn(`User ${userId} has inconsistent/finished broadcast data (POST). Attempting to disable.`);
                
                const currentFullMetadata = metadata || {};
                const updatedAdviceBroadcast = {
                    ...(broadcastInfo || { article_id: 'unknown', remaining_section_ids: [] }), 
                    enabled: false,
                    remaining_section_ids: [] 
                };

                const { error: disableError } = await supabaseAdmin
                    .from('users')
                    .update({
                        metadata: {
                            ...currentFullMetadata,
                            advice_broadcast: updatedAdviceBroadcast
                        }
                    })
                    .eq('user_id', userId);

                if (disableError) {
                    logger.error(`Failed to disable inconsistent broadcast for user ${userId} (POST):`, disableError);
                    errors.push(`User ${userId}: Failed disable - ${disableError.message}`);
                } else {
                    debugLogger.log(`Disabled broadcast for user ${userId} (POST).`);
                }
                failedUsers++;
                continue; 
            }

            const nextSectionId = broadcastInfo.remaining_section_ids[0];
            debugLogger.log(`Processing user ${userId}, article ${broadcastInfo.article_id}, next section ID: ${nextSectionId} (POST)`);

            try {
                debugLogger.log(`Fetching content for section ${nextSectionId} (POST)...`);
                const { data: section, error: sectionError } = await supabaseAdmin
                    .from('article_sections')
                    .select('id, title, content')
                    .eq('id', nextSectionId)
                    .single();

                if (sectionError || !section) {
                    logger.error(`Failed to fetch section ${nextSectionId} for user ${userId} (POST):`, sectionError);
                    errors.push(`User ${userId}: Failed fetch section ${nextSectionId} - ${sectionError?.message || 'Not Found'}`);
                    failedUsers++;
                    continue; 
                }
                debugLogger.log(`Fetched content for section ${section.id} (POST). Title: ${section.title?.substring(0, 30)}...`);

                const rawTitle = section.title?.trim() || '';
                const rawContent = section.content?.trim() || '';
                const processedContent = rawContent.replace(/\\n/g, '\n');
                const escapedTitle = escapeTelegramMarkdownV1(rawTitle);
                const escapedContent = escapeTelegramMarkdownV1(processedContent);
                const messagePrefix = escapedTitle ? `*${escapedTitle}*\n\n` : '';
                const finalMessageContent = `${messagePrefix}${escapedContent}`;

                debugLogger.log(`Sending final message to user ${userId} (length: ${finalMessageContent.length}) (POST). Start: ${finalMessageContent.substring(0, 100)}...`);

                const sendResult = await sendTelegramMessage(
                    finalMessageContent, [], undefined, userId
                );

                if (!sendResult.success) {
                    const isParsingError = sendResult.error?.includes("can't parse entities");
                    const logOrErrorMessage = `User ${userId}: Failed send (Section ${section.id}) (POST) - ${sendResult.error || 'Unknown TG Error'}${isParsingError ? ' <-- Check source Markdown V1!' : ''}`;
                    logger.error(logOrErrorMessage);
                    errors.push(logOrErrorMessage);
                    failedUsers++;
                    continue; 
                }

                debugLogger.log(`Sent section ${section.id} to user ${userId} (POST).`);
                sentMessages++;

                const updatedRemainingIds = broadcastInfo.remaining_section_ids.slice(1);
                const isFinished = updatedRemainingIds.length === 0;
                const newBroadcastState: UserMetadata['advice_broadcast'] = {
                    ...broadcastInfo,
                    remaining_section_ids: updatedRemainingIds,
                    last_sent_at: new Date().toISOString(),
                    enabled: !isFinished,
                };

                debugLogger.log(`Updating metadata for user ${userId} (POST). Finished: ${isFinished}`);
                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({ metadata: { ...metadata, advice_broadcast: newBroadcastState } }) 
                    .eq('user_id', userId);

                if (updateError) {
                    logger.error(`Failed to update metadata for user ${userId} after sending section ${section.id} (POST):`, updateError);
                    errors.push(`User ${userId}: Failed metadata update (Section ${section.id}) - ${updateError.message}`);
                    failedUsers++; 
                } else {
                    debugLogger.log(`Updated metadata for user ${userId} (POST). Remaining: ${updatedRemainingIds.length}. Enabled: ${newBroadcastState.enabled}`);
                    if (isFinished) { debugLogger.log(`User ${userId} finished broadcast for article ${broadcastInfo.article_id} (POST).`); }
                }
                await delay(200); 

            } catch (innerError) {
                logger.error(`Unexpected error processing user ${userId} (Section ${nextSectionId}) (POST):`, innerError);
                errors.push(`User ${userId}: Unexpected error (Section ${nextSectionId}) - ${innerError instanceof Error ? innerError.message : 'Unknown'}`);
                failedUsers++;
            }
        } 

        const summaryMessage = `Advice broadcast run (POST) complete. Processed: ${processedUsers}. Sent: ${sentMessages}. Failed: ${failedUsers}.`;
        debugLogger.log(summaryMessage);
        if (errors.length > 0) { logger.warn('Advice broadcast (POST) finished with errors:', errors); }

        return NextResponse.json({
            message: summaryMessage,
            processedUsers,
            sentMessages,
            failedUsers,
            errors: errors.slice(0, 10), 
        });

    } catch (error) {
        logger.error('Critical error in advice broadcast API (POST):', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const authorization = request.headers.get('Authorization');
     // Для GET-запросов от Vercel Cron, секрет может быть в query параметре, если так настроено.
     // Но лучше использовать Authorization header и для GET, если это возможно в Vercel Cron.
     // Если Vercel Cron поддерживает только GET без кастомных заголовков, то проверка секрета здесь усложняется.
     // Предположим, что Vercel Cron настроен так, чтобы вызывать POST, или GET также защищен.
    if (authorization !== `Bearer ${CRON_SECRET}`) {
        logger.warn('Unauthorized attempt to access advice broadcast API (GET).');
        // Можно вернуть другую ошибку или просто 401, если GET не предназначен для прямого вызова кроном без секрета
        return NextResponse.json({ error: 'Unauthorized or GET not configured for cron with secret' }, { status: 401 });
    }
    logger.info('Advice broadcast API triggered by GET request. Delegating to POST logic.');
    return POST(request); // Делегируем всю логику в POST, чтобы не дублировать
}