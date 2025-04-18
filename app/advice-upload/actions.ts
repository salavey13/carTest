"use server";

import { supabaseAdmin, DbArticle, DbArticleSection } from '@/hooks/supabase'; // Assuming types are exported correctly
import { logger } from '@/lib/logger';
import { debugLogger } from '@/lib/debugLogger';
import Papa from 'papaparse'; // CSV parsing library
import { v4 as uuidv4 } from 'uuid'; // For potential temporary IDs if needed

// Interface for parsed CSV row data
interface AdviceCsvRow {
    article_title: string;
    article_slug: string;
    article_description: string;
    section_order: string; // Initially string from CSV
    section_title?: string | null; // Optional
    section_content: string;
}

// Interface for grouped data before DB insertion
interface ProcessedArticle {
    articleData: Omit<DbArticle, 'id' | 'created_at' | 'updated_at'>; // Data for articles table
    sectionsData: Omit<DbArticleSection, 'id' | 'article_id' | 'created_at' | 'updated_at'>[]; // Data for article_sections
}

// --- Helper function to verify admin status ---
// IMPORTANT: Implement robust admin verification based on your user schema
async function verifyAdmin(userId: string | undefined): Promise<boolean> {
     if (!userId) return false;
     if (!supabaseAdmin) {
        logger.error("Admin client unavailable for verification.");
        return false;
     }
     try {
        const { data: user, error } = await supabaseAdmin
            .from('users') // Adjust if your user table is different
            .select('status, role') // Select fields used for admin check
            .eq('user_id', userId) // Adjust column name if needed
            .single();

        if (error || !user) {
            logger.warn(`Admin verification failed for user ${userId}: ${error?.message || 'User not found'}`);
            return false;
        }
        // Adjust condition based on how you identify admins (e.g., role or status)
        const isAdmin = user.status === 'admin' || user.role === 'admin';
        debugLogger.log(`Admin verification for ${userId}: ${isAdmin}`);
        return isAdmin;
     } catch (err) {
        logger.error(`Exception during admin verification for user ${userId}:`, err);
        return false;
     }
}


// --- The Server Action for CSV Upload ---
export async function uploadAdviceCsv(
    formData: FormData
): Promise<{ success: boolean; message?: string; error?: string }> {

    const file = formData.get('csvFile') as File | null;
    const userId = formData.get('userId') as string | undefined;

    // 1. --- Security Check: Verify User is Admin ---
    const isAdmin = await verifyAdmin(userId);
    if (!isAdmin) {
         logger.warn(`Unauthorized attempt to upload advice CSV by user: ${userId || 'Unknown'}`);
        return { success: false, error: "Permission denied. Admin privileges required." };
    }

    // 2. --- Basic Validation ---
    if (!file) {
        return { success: false, error: 'No CSV file provided.' };
    }
    if (file.type !== 'text/csv' || !file.name.toLowerCase().endsWith('.csv')) {
         return { success: false, error: 'Invalid file type. Please upload a .csv file.' };
    }
     if (!supabaseAdmin) {
        return { success: false, error: "Database client is unavailable." };
    }

    debugLogger.log(`Admin user ${userId} initiated CSV upload: ${file.name}`);

    try {
        const fileContent = await file.text();

        // 3. --- Parse CSV ---
        const parseResult = Papa.parse<AdviceCsvRow>(fileContent, {
            header: true,       // Expect header row
            skipEmptyLines: true, // Skip empty lines
            transformHeader: header => header.trim(), // Trim header whitespace
            transform: (value) => value.trim(), // Trim cell whitespace
        });

        if (parseResult.errors.length > 0) {
             logger.error('CSV parsing errors:', parseResult.errors);
             // Provide more specific error if possible
             const firstError = parseResult.errors[0];
            return { success: false, error: `CSV Parsing Error (Row ${firstError.row}): ${firstError.message}. Please check CSV format and quoting.` };
        }
        if (!parseResult.data || parseResult.data.length === 0) {
            return { success: false, error: 'CSV file is empty or contains no data rows.' };
        }

        const rows = parseResult.data;
        debugLogger.log(`Parsed ${rows.length} rows from CSV.`);

        // 4. --- Process and Validate Data ---
        const articlesToProcess: Map<string, ProcessedArticle> = new Map();
        const validationErrors: string[] = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowIndex = i + 2; // +1 for 0-based index, +1 for header row

            // Basic row validation
            if (!row.article_title?.trim() || !row.article_slug?.trim() || !row.section_order?.trim() || !row.section_content?.trim()) {
                validationErrors.push(`Row ${rowIndex}: Missing required fields (article_title, article_slug, section_order, section_content).`);
                continue;
            }

            const sectionOrderNum = parseInt(row.section_order, 10);
            if (isNaN(sectionOrderNum) || sectionOrderNum <= 0) {
                 validationErrors.push(`Row ${rowIndex}: Invalid section_order "${row.section_order}". Must be a positive number.`);
                 continue;
            }

             // Ensure slug is reasonably URL-safe (basic check)
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.article_slug.trim())) {
                validationErrors.push(`Row ${rowIndex}: Invalid article_slug "${row.article_slug}". Should be lowercase, alphanumeric, with hyphens.`);
                continue;
            }

            const articleKey = row.article_slug.trim(); // Use slug as the unique key for grouping

            if (!articlesToProcess.has(articleKey)) {
                // First time seeing this article slug
                articlesToProcess.set(articleKey, {
                    articleData: {
                        title: row.article_title.trim(),
                        slug: articleKey,
                        description: row.article_description?.trim() || null, // Handle optional description
                    },
                    sectionsData: [],
                });
            }

            // Add section data
            const articleEntry = articlesToProcess.get(articleKey);
            if (articleEntry) {
                 // Check for duplicate section orders within the same article (in the CSV)
                 if (articleEntry.sectionsData.some(s => s.section_order === sectionOrderNum)) {
                     validationErrors.push(`Row ${rowIndex}: Duplicate section_order "${sectionOrderNum}" found for article slug "${articleKey}".`);
                     continue; // Skip this duplicate section row
                 }

                 articleEntry.sectionsData.push({
                    section_order: sectionOrderNum,
                    title: row.section_title?.trim() || null, // Handle optional title
                    content: row.section_content.trim(),
                 });
            }
        }

        if (validationErrors.length > 0) {
            logger.error("CSV Validation failed:", validationErrors);
            return { success: false, error: `CSV Validation Failed:\n- ${validationErrors.join('\n- ')}` };
        }

        if (articlesToProcess.size === 0) {
             return { success: false, error: 'No valid articles found in the CSV after processing.' };
        }

        debugLogger.log(`Processing ${articlesToProcess.size} unique articles.`);

        // 5. --- Database Operations (Transaction per article) ---
        let articlesProcessedCount = 0;
        const processingErrors: string[] = [];

        for (const [slug, processedArticle] of articlesToProcess.entries()) {
            try {
                // **Upsert Article:** Create or update based on slug.
                const { data: upsertedArticle, error: articleError } = await supabaseAdmin
                    .from('articles')
                    .upsert(processedArticle.articleData, { onConflict: 'slug' })
                    .select('id') // Get the ID of the created/updated article
                    .single();

                if (articleError) throw new Error(`Failed to upsert article "${slug}": ${articleError.message}`);
                if (!upsertedArticle?.id) throw new Error(`Failed to get ID for upserted article "${slug}".`);

                const articleId = upsertedArticle.id;
                debugLogger.log(`Upserted article "${slug}", ID: ${articleId}`);

                 // **Manage Sections:** Delete existing sections for this article before inserting new ones.
                 // This ensures the CSV fully replaces the article's content.
                const { error: deleteError } = await supabaseAdmin
                    .from('article_sections')
                    .delete()
                    .eq('article_id', articleId);

                 if (deleteError) {
                    // Log warning but attempt to continue insertion? Or fail the article? Let's fail.
                    throw new Error(`Failed to delete existing sections for article ID ${articleId}: ${deleteError.message}`);
                 }
                 debugLogger.log(`Deleted existing sections for article ID: ${articleId}`);


                // **Insert Sections:** Prepare section data with the obtained article_id.
                const sectionsToInsert = processedArticle.sectionsData.map(section => ({
                    ...section,
                    article_id: articleId,
                }));

                if (sectionsToInsert.length > 0) {
                    const { error: sectionError } = await supabaseAdmin
                        .from('article_sections')
                        .insert(sectionsToInsert);

                    if (sectionError) throw new Error(`Failed to insert sections for article "${slug}" (ID ${articleId}): ${sectionError.message}`);
                     debugLogger.log(`Inserted ${sectionsToInsert.length} sections for article ID: ${articleId}`);
                } else {
                     debugLogger.log(`No sections to insert for article ID: ${articleId}`);
                }

                articlesProcessedCount++;

            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                logger.error(`Error processing article "${slug}":`, error);
                processingErrors.push(`Article "${processedArticle.articleData.title}" (slug: ${slug}): ${errorMsg}`);
                // Continue to next article, report errors at the end
            }
        }

        // 6. --- Final Result ---
        const finalMessage = `Processed ${articlesProcessedCount} / ${articlesToProcess.size} articles.`;
        if (processingErrors.length > 0) {
            return {
                success: false, // Indicate partial or full failure
                message: `${finalMessage} Errors occurred during database operations.`,
                error: `Processing Errors:\n- ${processingErrors.join('\n- ')}`,
            };
        } else {
            return { success: true, message: `${finalMessage} All articles processed successfully.` };
        }

    } catch (error) {
        logger.error('Critical error during CSV upload processing:', error);
        return { success: false, error: error instanceof Error ? error.message : 'An unexpected server error occurred.' };
    }
}

// --- Other actions below ---
// ... (handleWebhookUpdate, sendTelegramMessage, etc.)