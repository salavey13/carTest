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

export async function uploadAdviceCsv(
    csvContent: string, // Changed from FormData to string
    userId: string | undefined // Keep userId for verification
): Promise<{ success: boolean; message?: string; error?: string }> {

    // 1. --- Security Check: Verify User is Admin ---
    const isAdmin = await verifyAdmin(userId);
    if (!isAdmin) {
         logger.warn(`Unauthorized attempt to upload advice CSV by user: ${userId || 'Unknown'}`);
        return { success: false, error: "Permission denied. Admin privileges required." };
    }

    // 2. --- Basic Validation ---
    if (!csvContent || !csvContent.trim()) {
        return { success: false, error: 'No CSV data provided.' };
    }
     if (!supabaseAdmin) {
        return { success: false, error: "Database client is unavailable." };
    }

    debugLogger.log(`Admin user ${userId} initiated CSV upload via text area.`);

    try {
        // 3. --- Parse CSV (Server-Side) ---
        const parseResult = Papa.parse<AdviceCsvRow>(csvContent.trim(), {
            header: true,
            skipEmptyLines: 'greedy',
            transformHeader: header => header.trim(),
            transform: value => value.trim(),
        });

        if (parseResult.errors.length > 0) {
             logger.error('CSV parsing errors:', parseResult.errors);
             const firstError = parseResult.errors[0];
            return { success: false, error: `CSV Parsing Error (Row ${firstError.row + 1}): ${firstError.message}. Check format/quoting.` };
        }
        if (!parseResult.data || parseResult.data.length === 0) {
            return { success: false, error: 'CSV data is empty or contains no valid data rows.' };
        }

        const rows = parseResult.data;
        debugLogger.log(`Parsed ${rows.length} rows from CSV content.`);

        // 4. --- Process and Validate Data ---
        const articlesToProcess: Map<string, ProcessedArticle> = new Map();
        const validationErrors: string[] = [];
        const requiredHeaders = ["article_title", "article_slug", "section_order", "section_content"];
        const actualHeaders = Object.keys(rows[0] || {});
        const missingHeaders = requiredHeaders.filter(h => !actualHeaders.includes(h));

        if (missingHeaders.length > 0) {
             return { success: false, error: `Missing required CSV columns: ${missingHeaders.join(', ')}` };
        }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowIndex = i + 2; // For error reporting (1-based index + header)

            // Trim all string values in the row object
            Object.keys(row).forEach(key => {
              if (typeof row[key] === 'string') {
                row[key] = row[key].trim();
              }
            });


            // Basic row validation (check non-empty required fields after trim)
            if (!row.article_title || !row.article_slug || !row.section_order || !row.section_content) {
                validationErrors.push(`Row ${rowIndex}: Missing required fields (article_title, article_slug, section_order, section_content).`);
                continue;
            }

            const sectionOrderNum = parseInt(row.section_order, 10);
            if (isNaN(sectionOrderNum) || sectionOrderNum <= 0) {
                 validationErrors.push(`Row ${rowIndex}: Invalid section_order "${row.section_order}". Must be a positive number.`);
                 continue;
            }

            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.article_slug)) {
                validationErrors.push(`Row ${rowIndex}: Invalid article_slug "${row.article_slug}". Should be lowercase, alphanumeric, with hyphens.`);
                continue;
            }

            const articleKey = row.article_slug;

            if (!articlesToProcess.has(articleKey)) {
                articlesToProcess.set(articleKey, {
                    articleData: {
                        title: row.article_title,
                        slug: articleKey,
                        description: row.article_description || null,
                    },
                    sectionsData: [],
                });
            }

            const articleEntry = articlesToProcess.get(articleKey);
            if (articleEntry) {
                 if (articleEntry.sectionsData.some(s => s.section_order === sectionOrderNum)) {
                     validationErrors.push(`Row ${rowIndex}: Duplicate section_order "${sectionOrderNum}" found for article slug "${articleKey}".`);
                     continue;
                 }
                 articleEntry.sectionsData.push({
                    section_order: sectionOrderNum,
                    title: row.section_title || null,
                    content: row.section_content,
                 });
                 // Sort sections within the entry as they are added to maintain order for DB check later if needed
                 articleEntry.sectionsData.sort((a, b) => a.section_order - b.section_order);
            }
        }

        if (validationErrors.length > 0) {
            logger.error("CSV Validation failed:", validationErrors);
            // Limit number of errors shown?
            const limitedErrors = validationErrors.slice(0, 5);
            const errorString = `- ${limitedErrors.join('\n- ')}${validationErrors.length > 5 ? '\n- ... (more errors)' : ''}`;
            return { success: false, error: `CSV Validation Failed:\n${errorString}` };
        }

        if (articlesToProcess.size === 0) {
             return { success: false, error: 'No valid articles found in the CSV after processing.' };
        }

        debugLogger.log(`Processing ${articlesToProcess.size} unique articles from CSV.`);

        // 5. --- Database Operations ---
        let articlesProcessedCount = 0;
        const processingErrors: string[] = [];

        for (const [slug, processedArticle] of articlesToProcess.entries()) {
            try {
                // Upsert Article
                const { data: upsertedArticle, error: articleError } = await supabaseAdmin
                    .from('articles')
                    .upsert(processedArticle.articleData, { onConflict: 'slug' })
                    .select('id')
                    .single();

                if (articleError) throw new Error(`Failed to upsert article "${slug}": ${articleError.message}`);
                if (!upsertedArticle?.id) throw new Error(`Failed to get ID for upserted article "${slug}".`);

                const articleId = upsertedArticle.id;
                debugLogger.log(`Upserted article "${slug}", ID: ${articleId}`);

                // Delete existing sections
                const { error: deleteError } = await supabaseAdmin
                    .from('article_sections')
                    .delete()
                    .eq('article_id', articleId);
                 if (deleteError) {
                    throw new Error(`Failed to delete existing sections for article ID ${articleId}: ${deleteError.message}`);
                 }
                 debugLogger.log(`Deleted existing sections for article ID: ${articleId}`);

                // Insert Sections
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
                processingErrors.push(`Article "${processedArticle.articleData.title || slug}": ${errorMsg}`);
            }
        }

        // 6. --- Final Result ---
        const finalMessage = `Processed ${articlesProcessedCount} / ${articlesToProcess.size} articles.`;
        if (processingErrors.length > 0) {
            const limitedErrors = processingErrors.slice(0, 3);
            const errorString = `- ${limitedErrors.join('\n- ')}${processingErrors.length > 3 ? '\n- ... (more errors)' : ''}`;
            return {
                success: articlesProcessedCount > 0, // Success if at least one article processed
                message: `${finalMessage} Some errors occurred.`,
                error: `Processing Errors:\n${errorString}`,
            };
        } else {
            return { success: true, message: `${finalMessage} All articles processed successfully.` };
        }

    } catch (error) {
        logger.error('Critical error during CSV upload processing:', error);
        return { success: false, error: error instanceof Error ? error.message : 'An unexpected server error occurred.' };
    }
}


    

        
