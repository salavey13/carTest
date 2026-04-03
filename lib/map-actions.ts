"use server";

import { supabaseAdmin } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { unstable_noStore as noStore } from 'next/cache';
import { GeoBounds, validateBounds, PointOfInterest } from "@/lib/map-utils";
import type { MapPreset } from '@/lib/types';

/**
 * VibeMap Server Actions
 * Dedicated file for all map-related database operations.
 * Clean, minimal, and fully typed.
 */

export async function getMapPresets(): Promise<{ success: boolean; data?: MapPreset[]; error?: string; }> {
  noStore();
  try {
    const { data, error } = await supabaseAdmin.from('maps').select('*');
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[getMapPresets] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function saveMapPreset(
  userId: string,
  name: string,
  map_image_url: string,
  bounds: GeoBounds,
  is_default: boolean = false
): Promise<{ success: boolean; data?: MapPreset; error?: string; }> {
  try {
    // Validate bounds before any DB operations
    const validationErrors = validateBounds(bounds);
    if (validationErrors.length > 0) {
      return { success: false, error: `Invalid bounds: ${validationErrors.join('; ')}` };
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (userError || !['admin'].includes(user?.role || '')) {
      throw new Error("Unauthorized: Only admins can save map presets.");
    }

    if (is_default) {
      const { error: updateError } = await supabaseAdmin
        .from('maps')
        .update({ is_default: false })
        .eq('is_default', true);
      if (updateError) {
        throw new Error(`Failed to unset other default maps: ${updateError.message}`);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('maps')
      .insert({
        name,
        map_image_url,
        bounds: bounds as any,
        is_default,
        owner_id: userId
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[saveMapPreset] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

export async function updateMapPois(
  userId: string,
  mapId: string,
  newPois: PointOfInterest[]
): Promise<{ success: boolean; data?: MapPreset; error?: string; }> {
  try {
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (userError || !['admin', 'vprAdmin'].includes(user?.role || '')) {
      throw new Error("Unauthorized: Only admins/vprAdmin can edit maps.");
    }

    const { data, error } = await supabaseAdmin
      .from('maps')
      .update({ points_of_interest: newPois as any })
      .eq('id', mapId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("[updateMapPois] Error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}