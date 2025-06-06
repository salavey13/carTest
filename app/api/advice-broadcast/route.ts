"use server"; // Явно указываем, что это серверный модуль

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
  // Можно добавить другие поля, если они есть в metadata
  [key: string]: any; // Позволяет другие поля в metadata
};
type UserWithMetadata = Database["public"]["Tables"]["users"]["Row"]; // Это уже должно включать metadata JSONB

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
// Экспортируемая функция ДОЛЖНА быть async
export async function POST(request: Request) {
    const authorization = request.headers.get('Authorization');

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
        debugLogger.log('Fetching users with active broadcasts...');
        const { data: users, error: fetchError } = await supabaseAdmin
            .from('users')
            .select('user_id, metadata') // metadata уже должно быть JSONB
            .filter('metadata->advice_broadcast->>enabled', 'eq', 'true') // Фильтр по JSONB полю
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

        for (const user of users) {
            processedUsers++;
            const userId = user.user_id;
            // Приведение типа для metadata, если оно приходит как unknown
            const metadata = user.metadata as UserMetadata | null | undefined; 
            const broadcastInfo = metadata?.advice_broadcast;

            if (!broadcastInfo || broadcastInfo.enabled !== true || !broadcastInfo.article_id || !Array.isArray(broadcastInfo.remaining_section_ids) || broadcastInfo.remaining_section_ids.length === 0) {
                logger.warn(`User ${userId} has inconsistent/finished broadcast data. Attempting to disable.`);
                
                const currentFullMetadata = metadata || {};
                const updatedAdviceBroadcast = {
                    ...(broadcastInfo || { article_id: 'unknown', remaining_section_ids: [] }), // Обеспечиваем наличие полей, если broadcastInfo было null/undefined
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
                    logger.error(`Failed to disable inconsistent broadcast for user ${userId}:`, disableError);
                    errors.push(`User ${userId}: Failed disable - ${disableError.message}`);
                } else {
                    debugLogger.log(`Disabled broadcast for user ${userId}.`);
                }
                failedUsers++;
                continue; 
            }

            const nextSectionId = broadcastInfo.remaining_section_ids[0];
            debugLogger.log(`Processing user ${userId}, article ${broadcastInfo.article_id}, next section ID: ${nextSectionId}`);

            try {
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
                    continue; 
                }
                debugLogger.log(`Fetched content for section ${section.id}. Title: ${section.title?.substring(0, 30)}...`);

                const rawTitle = section.title?.trim() || '';
                const rawContent = section.content?.trim() || '';
                const processedContent = rawContent.replace(/\\n/g, '\n');
                const escapedTitle = escapeTelegramMarkdownV1(rawTitle);
                const escapedContent = escapeTelegramMarkdownV1(processedContent);
                const messagePrefix = escapedTitle ? `*${escapedTitle}*\n\n` : '';
                const finalMessageContent = `${messagePrefix}${escapedContent}`;

                debugLogger.log(`Sending final message to user ${userId} (length: ${finalMessageContent.length}). Start: ${finalMessageContent.substring(0, 100)}...`);

                const sendResult = await sendTelegramMessage(
                    finalMessageContent, [], undefined, userId
                );

                if (!sendResult.success) {
                    const isParsingError = sendResult.error?.includes("can't parse entities");
                    const logOrErrorMessage = `User ${userId}: Failed send (Section ${section.id}) - ${sendResult.error || 'Unknown TG Error'}${isParsingError ? ' <-- Check source Markdown V1!' : ''}`;
                    logger.error(logOrErrorMessage);
                    errors.push(logOrErrorMessage);
                    failedUsers++;
                    continue; 
                }

                debugLogger.log(`Sent section ${section.id} to user ${userId}.`);
                sentMessages++;

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
                    .update({ metadata: { ...metadata, advice_broadcast: newBroadcastState } }) // Обновляем только часть metadata
                    .eq('user_id', userId);

                if (updateError) {
                    logger.error(`Failed to update metadata for user ${userId} after sending section ${section.id}:`, updateError);
                    errors.push(`User ${userId}: Failed metadata update (Section ${section.id}) - ${updateError.message}`);
                    failedUsers++; 
                } else {
                    debugLogger.log(`Updated metadata for user ${userId}. Remaining: ${updatedRemainingIds.length}. Enabled: ${newBroadcastState.enabled}`);
                    if (isFinished) { debugLogger.log(`User ${userId} finished broadcast for article ${broadcastInfo.article_id}.`); }
                }
                await delay(200); // Увеличил задержку

            } catch (innerError) {
                logger.error(`Unexpected error processing user ${userId} (Section ${nextSectionId}):`, innerError);
                errors.push(`User ${userId}: Unexpected error (Section ${nextSectionId}) - ${innerError instanceof Error ? innerError.message : 'Unknown'}`);
                failedUsers++;
            }
        } 

        const summaryMessage = `Advice broadcast run complete. Processed: ${processedUsers}. Sent: ${sentMessages}. Failed: ${failedUsers}.`;
        debugLogger.log(summaryMessage);
        if (errors.length > 0) { logger.warn('Advice broadcast finished with errors:', errors); }

        return NextResponse.json({
            message: summaryMessage,
            processedUsers,
            sentMessages,
            failedUsers,
            errors: errors.slice(0, 10), 
        });

    } catch (error) {
        logger.error('Critical error in advice broadcast API:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
    }
}

// Добавляем GET обработчик для возможности вызова через URL (например, для ручного теста)
// или если Vercel Cron требует GET для простых вызовов.
// Он будет делать то же самое, что и POST.
export async function GET(request: Request) {
    logger.info('Advice broadcast API triggered by GET request.');
    // Можно добавить дополнительную проверку секрета здесь, если GET будет использоваться извне
    // Например, через query параметр, но это менее безопасно, чем Authorization header.
    // Для простоты пока вызываем POST-логику.
    return POST(request); 
}