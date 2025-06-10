"use server";

import { supabaseAdmin } from '@/hooks/supabase';
import { logger } from '@/lib/logger';
import { DEFAULT_ARBITRAGE_SETTINGS, ArbitrageSettings } from './arbitrage_scanner_types';

export async function fetchUserArbitrageSettingsFromDB(userId: string): Promise<{ success: boolean, data?: ArbitrageSettings, error?: string }> {
    if (!userId) {
        logger.error("[ArbitrageSupabaseActions] fetchUserArbitrageSettingsFromDB: userId is required.");
        return { success: false, error: "User ID is required." };
    }
    if (!supabaseAdmin) {
        logger.error("[ArbitrageSupabaseActions] fetchUserArbitrageSettingsFromDB: Supabase admin client is not available.");
        return { success: false, error: "Database client unavailable." };
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('arbitrage_user_settings')
            .select('settings')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            logger.error(`[ArbitrageSupabaseActions] Error fetching arbitrage settings for user ${userId}:`, error);
            return { success: false, error: error.message };
        }

        if (data && data.settings) {
            logger.info(`[ArbitrageSupabaseActions] Successfully fetched arbitrage settings for user ${userId}.`);
            // Merge with defaults to ensure all keys are present, user's settings override
            const mergedSettings = { ...DEFAULT_ARBITRAGE_SETTINGS, ...(data.settings as ArbitrageSettings) };
            return { success: true, data: mergedSettings };
        } else {
            logger.info(`[ArbitrageSupabaseActions] No arbitrage settings found for user ${userId}, returning defaults.`);
            return { success: true, data: { ...DEFAULT_ARBITRAGE_SETTINGS } }; // Return a copy of defaults
        }
    } catch (e) {
        logger.error(`[ArbitrageSupabaseActions] Exception fetching arbitrage settings for user ${userId}:`, e);
        return { success: false, error: e instanceof Error ? e.message : "Unknown error fetching settings." };
    }
}

export async function saveUserArbitrageSettingsToDB(userId: string, settings: ArbitrageSettings): Promise<{ success: boolean, error?: string }> {
    if (!userId) {
        logger.error("[ArbitrageSupabaseActions] saveUserArbitrageSettingsToDB: userId is required.");
        return { success: false, error: "User ID is required." };
    }
     if (!settings) {
        logger.error("[ArbitrageSupabaseActions] saveUserArbitrageSettingsToDB: settings object is required.");
        return { success: false, error: "Settings are required." };
    }
    if (!supabaseAdmin) {
        logger.error("[ArbitrageSupabaseActions] saveUserArbitrageSettingsToDB: Supabase admin client is not available.");
        return { success: false, error: "Database client unavailable." };
    }

    try {
        const { error } = await supabaseAdmin
            .from('arbitrage_user_settings')
            .upsert({
                user_id: userId,
                settings: settings, // The 'settings' field in DB stores the ArbitrageSettings object
                last_updated: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            logger.error(`[ArbitrageSupabaseActions] Error saving arbitrage settings for user ${userId}:`, error);
            return { success: false, error: error.message };
        }

        logger.info(`[ArbitrageSupabaseActions] Successfully saved arbitrage settings for user ${userId}.`);
        return { success: true };
    } catch (e) {
        logger.error(`[ArbitrageSupabaseActions] Exception saving arbitrage settings for user ${userId}:`, e);
        return { success: false, error: e instanceof Error ? e.message : "Unknown error saving settings." };
    }
}