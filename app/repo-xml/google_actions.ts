"use server";

import { logger } from '@/lib/logger';
import google from 'google-it'; // Use google-it for search results
import axios from 'axios'; // Use axios for fetching image source pages if needed
import { load } from 'cheerio'; // Use cheerio for parsing HTML if needed

/**
 * Searches Google Images for a prompt and attempts to return the direct URL of the first image result.
 * Note: Web scraping is inherently fragile and may break if Google changes its structure.
 *
 * @param prompt The search query for Google Images.
 * @returns Promise resolving to the success status, image URL, or an error message.
 */
export async function searchAndGetFirstImageUrl(
    prompt: string
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
    logger.info(`[Google Action] Searching for image with prompt: "${prompt}"`);

    if (!prompt) {
        return { success: false, error: "Prompt cannot be empty." };
    }

    try {
        // Perform the image search using google-it
        const results = await google({ query: prompt, disableConsole: true, limit: 5, 'only-images': true }); // Limit results, disable logs

        // Check if we got any results
        if (!results || results.length === 0) {
            logger.warn(`[Google Action] No image results found for prompt: "${prompt}"`);
            return { success: false, error: "No image results found on Google." };
        }

        // Try to find a usable image URL from the results
        let imageUrl: string | undefined;
        for (const result of results) {
            // google-it's structure for images might vary, common patterns:
            // 1. Direct image source (often thumbnail or base64 data URI)
            if (result.image?.src && typeof result.image.src === 'string' && result.image.src.startsWith('http')) {
                imageUrl = result.image.src;
                logger.info(`[Google Action] Found potential direct image URL: ${imageUrl}`);
                break; // Use the first valid HTTP(S) src
            }
            // 2. Sometimes 'link' might be the image URL itself (less common for images)
            if (!imageUrl && result.link && typeof result.link === 'string' && result.link.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
                 imageUrl = result.link;
                 logger.info(`[Google Action] Found potential image URL in 'link': ${imageUrl}`);
                 break;
            }
            // 3. Fallback: Try fetching the context page and scraping (more complex, higher chance of failure/block)
            // This is often needed as Google prefers showing you the page, not the direct image.
            if (!imageUrl && result.image?.contextLink && typeof result.image.contextLink === 'string') {
                logger.info(`[Google Action] No direct URL found, attempting to scrape context page: ${result.image.contextLink}`);
                try {
                     // IMPORTANT: Set a realistic User-Agent to avoid immediate blocks
                    const response = await axios.get(result.image.contextLink, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        },
                        timeout: 5000 // 5 second timeout
                    });
                    const $ = load(response.data);

                    // Try finding a prominent image tag (e.g., inside common content divs, or meta tags)
                    // This selector is a GUESS and WILL likely need adjustment based on actual page structures
                    const potentialImage =
                        $('meta[property="og:image"]').attr('content') ||
                        $('img[alt*="' + prompt.substring(0,15) + '"]').first().attr('src') || // Try alt text match
                        $('#main-image img').first().attr('src') || // Common ID guess
                        $('.main-content img').first().attr('src') || // Common class guess
                        $('img').first().attr('src'); // Last resort: first image

                    if (potentialImage && potentialImage.startsWith('http')) {
                        // Ensure URL is absolute
                         imageUrl = new URL(potentialImage, result.image.contextLink).toString();
                        logger.info(`[Google Action] Scraped image URL from context page: ${imageUrl}`);
                        break;
                    } else {
                        logger.warn(`[Google Action] Could not scrape a suitable image URL from ${result.image.contextLink}`);
                    }
                } catch (scrapeError: any) {
                    logger.error(`[Google Action] Failed to scrape context page ${result.image.contextLink}: ${scrapeError.message}`);
                    // Continue to the next result if scraping fails
                }
            }
        }


        if (imageUrl) {
            logger.info(`[Google Action] Success for prompt "${prompt}", final URL: ${imageUrl}`);
            return { success: true, imageUrl: imageUrl };
        } else {
            logger.error(`[Google Action] Failed to extract a usable image URL for prompt: "${prompt}" after checking ${results.length} results.`);
            return { success: false, error: "Could not extract a valid image URL from search results." };
        }

    } catch (error: any) {
        logger.error(`[Google Action] Error during google-it search for "${prompt}":`, error);
        // Handle potential rate limiting or other API errors from google-it
        let errorMessage = error.message || "Failed to search Google Images.";
        if (error.code === 'ERR_UNESCAPED_CHARACTERS') { // Specific error from google-it
             errorMessage = "Search query likely contained invalid characters.";
        }
        return { success: false, error: errorMessage };
    }
}