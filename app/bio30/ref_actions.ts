"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import type { Database } from "@/types/database.types";
import { updateUserSettings } from "@/app/actions";

// Commission structure
export const REFERRAL_COMMISSIONS = {
  level1: 0.30, // 30% for direct referrals
  level2: 0.10, // 10% for second level
  level3: 0.10, // 10% for third level
};

// Activity points for gamification
export const ACTIVITY_POINTS = {
  referral_signup: 100,
  social_share: 50,
  purchase_made: 200,
  profile_complete: 25,
};

type ReferralRelationship = Database["public"]["Tables"]["referral_relationships"]["Row"];
type ReferralCommission = Database["public"]["Tables"]["referral_commissions"]["Row"];
type ReferralActivity = Database["public"]["Tables"]["referral_activities"]["Row"];

/**
 * Generate unique referral code for user
 */
export async function generateReferralCode(userId: string): Promise<string> {
  const code = `BIO30${userId.slice(-6).toUpperCase()}`;
  
  try {
    await supabaseAdmin.from("referral_codes").insert({
      user_id: userId,
      code: code,
      is_active: true,
    });
    return code;
  } catch (error) {
    logger.error(`Error generating referral code for ${userId}:`, error);
    return code; // Return generated code even if DB insert fails
  }
}

/**
 * Get user's referral code
 */
export async function getUserReferralCode(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("referral_codes")
      .select("code")
      .eq("user_id", userId)
      .eq("is_active", true)
      .single();
    
    return data?.code || null;
  } catch (error) {
    logger.error(`Error getting referral code for ${userId}:`, error);
    return null;
  }
}

/**
 * Set referrer for a new user with multi-level support
 */
export async function setReferrer({ 
  userId, 
  referrerCode 
}: { 
  userId: string; 
  referrerCode: string;
}): Promise<{ success: boolean; error?: string; levelsEstablished?: number }> {
  try {
    // Get referrer user from code
    const { data: referrerCodeData } = await supabaseAdmin
      .from("referral_codes")
      .select("user_id")
      .eq("code", referrerCode)
      .eq("is_active", true)
      .single();
    
    if (!referrerCodeData) {
      return { success: false, error: "Invalid referral code" };
    }
    
    const referrerId = referrerCodeData.user_id;
    
    // Prevent self-referral
    if (referrerId === userId) {
      return { success: false, error: "Cannot refer yourself" };
    }
    
    // Check if user already has a referrer
    const { data: existingRelationship } = await supabaseAdmin
      .from("referral_relationships")
      .select("id")
      .eq("referred_id", userId)
      .single();
    
    if (existingRelationship) {
      return { success: false, error: "User already has a referrer" };
    }
    
    // Establish referral relationships (up to 3 levels)
    let levelsEstablished = 0;
    let currentReferrer = referrerId;
    let currentLevel = 1;
    
    while (currentLevel <= 3 && currentReferrer) {
      // Create referral relationship
      await supabaseAdmin.from("referral_relationships").insert({
        referrer_id: currentReferrer,
        referred_id: userId,
        referral_level: currentLevel,
      });
      
      levelsEstablished++;
      
      // Get the next level referrer
      if (currentLevel < 3) {
        const { data: nextReferrer } = await supabaseAdmin
          .from("referral_relationships")
          .select("referrer_id")
          .eq("referred_id", currentReferrer)
          .eq("referral_level", 1)
          .single();
        
        if (nextReferrer) {
          currentReferrer = nextReferrer.referrer_id;
          currentLevel++;
        } else {
          break;
        }
      } else {
        break;
      }
    }
    
    // Log referral activity
    await logReferralActivity(userId, "referral_signup", {
      referrerCode,
      levelsEstablished,
    });
    
    // Update user metadata with referrer info
    await updateUserSettings(userId, {
      referrer_id: referrerId,
      referrer_code: referrerCode,
      referred_at: new Date().toISOString(),
    });
    
    return { 
      success: true, 
      levelsEstablished,
    };
  } catch (error) {
    logger.error(`Error setting referrer for ${userId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Calculate and distribute referral commissions
 */
export async function processReferralCommissions(
  orderId: string,
  userId: string,
  orderAmount: number
): Promise<{ success: boolean; error?: string; commissionsDistributed?: number }> {
  try {
    // Get user's referral relationships (who referred this user)
    const { data: referralRelationships } = await supabaseAdmin
      .from("referral_relationships")
      .select("referrer_id, referral_level")
      .eq("referred_id", userId)
      .in("referral_level", [1, 2, 3]);
    
    if (!referralRelationships || referralRelationships.length === 0) {
      return { success: true, commissionsDistributed: 0 };
    }
    
    let commissionsDistributed = 0;
    
    for (const relationship of referralRelationships) {
      const commissionRate = REFERRAL_COMMISSIONS[`level${relationship.referral_level}` as keyof typeof REFERRAL_COMMISSIONS];
      const commissionAmount = Math.floor(orderAmount * commissionRate);
      
      if (commissionAmount > 0) {
        // Create commission record
        await supabaseAdmin.from("referral_commissions").insert({
          referrer_id: relationship.referrer_id,
          referred_id: userId,
          order_id: orderId,
          order_amount: orderAmount,
          commission_amount: commissionAmount,
          commission_level: relationship.referral_level,
          status: "pending",
        });
        
        // Update referrer's balance
        await updateReferralBalance(relationship.referrer_id, commissionAmount);
        
        commissionsDistributed++;
      }
    }
    
    // Log purchase activity
    await logReferralActivity(userId, "purchase_made", {
      orderId,
      orderAmount,
      commissionsDistributed,
    });
    
    return { success: true, commissionsDistributed };
  } catch (error) {
    logger.error(`Error processing referral commissions for order ${orderId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Update user's referral balance
 */
export async function updateReferralBalance(
  userId: string, 
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseAdmin.rpc("update_referral_balance", {
      p_user_id: userId,
      p_amount: amount,
    });
    
    return { success: true };
  } catch (error) {
    logger.error(`Error updating referral balance for ${userId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get comprehensive referral statistics
 */
export async function getReferralStats(userId: string): Promise<{
  success: boolean;
  data?: {
    // Referral counts
    level1Count: number;
    level2Count: number;
    level3Count: number;
    totalReferrals: number;
    
    // Earnings
    level1Earnings: number;
    level2Earnings: number;
    level3Earnings: number;
    totalEarnings: number;
    paidEarnings: number;
    pendingEarnings: number;
    
    // Balance
    currentBalance: number;
    lifetimeEarnings: number;
    
    // Activity
    recentActivities: ReferralActivity[];
    
    // Referral code
    referralCode: string | null;
  };
  error?: string;
}> {
  try {
    // Get statistics from materialized view
    const { data: stats } = await supabaseAdmin
      .from("referral_statistics")
      .select("*")
      .eq("user_id", userId)
      .single();
    
    // Get user's balance
    const { data: balance } = await supabaseAdmin
      .from("user_referral_balances")
      .select("balance, lifetime_earnings")
      .eq("user_id", userId)
      .single();
    
    // Get recent activities
    const { data: activities } = await supabaseAdmin
      .from("referral_activities")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    // Get referral code
    const referralCode = await getUserReferralCode(userId);
    
    return {
      success: true,
      data: {
        // Referral counts
        level1Count: stats?.level1_count || 0,
        level2Count: stats?.level2_count || 0,
        level3Count: stats?.level3_count || 0,
        totalReferrals: (stats?.level1_count || 0) + (stats?.level2_count || 0) + (stats?.level3_count || 0),
        
        // Earnings
        level1Earnings: stats?.level1_earnings || 0,
        level2Earnings: stats?.level2_earnings || 0,
        level3Earnings: stats?.level3_earnings || 0,
        totalEarnings: stats?.total_earnings || 0,
        paidEarnings: stats?.paid_earnings || 0,
        pendingEarnings: stats?.pending_earnings || 0,
        
        // Balance
        currentBalance: balance?.balance || 0,
        lifetimeEarnings: balance?.lifetime_earnings || 0,
        
        // Activity
        recentActivities: activities || [],
        
        // Referral code
        referralCode,
      },
    };
  } catch (error) {
    logger.error(`Error getting referral stats for ${userId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get referral network/tree for a user
 */
export async function getReferralNetwork(
  userId: string,
  maxLevel: number = 3
): Promise<{
  success: boolean;
  data?: {
    level1: Array<{ userId: string; username?: string; avatar?: string; joinedAt: string }>;
    level2: Array<{ userId: string; username?: string; avatar?: string; joinedAt: string }>;
    level3: Array<{ userId: string; username?: string; avatar?: string; joinedAt: string }>;
  };
  error?: string;
}> {
  try {
    const { data: referrals } = await supabaseAdmin
      .from("referral_relationships")
      .select("\n      referred_id,\n      referral_level,\n      created_at,\n      referred_user:user_id!inner(username, full_name, avatar_url)\n    ")
      .eq("referrer_id", userId)
      .in("referral_level", [1, 2, 3])
      .order("created_at", { ascending: false });
    
    const network = {
      level1: [],
      level2: [],
      level3: [],
    };
    
    for (const referral of referrals || []) {
      const level = referral.referral_level as 1 | 2 | 3;
      network[`level${level}`].push({
        userId: referral.referred_id,
        username: referral.referred_user?.username || referral.referred_user?.full_name,
        avatar: referral.referred_user?.avatar_url,
        joinedAt: referral.created_at,
      });
    }
    
    return { success: true, data: network };
  } catch (error) {
    logger.error(`Error getting referral network for ${userId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Log referral activity for gamification
 */
export async function logReferralActivity(
  userId: string,
  activityType: string,
  activityData: Record<string, any> = {},
  points: number = 0
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get default points if not specified
    if (points === 0 && ACTIVITY_POINTS[activityType as keyof typeof ACTIVITY_POINTS]) {
      points = ACTIVITY_POINTS[activityType as keyof typeof ACTIVITY_POINTS];
    }
    
    await supabaseAdmin.from("referral_activities").insert({
      user_id: userId,
      activity_type: activityType,
      activity_data: activityData,
      points_earned: points,
    });
    
    return { success: true };
  } catch (error) {
    logger.error(`Error logging referral activity for ${userId}:`, error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Get referral leaderboard
 */
export async function getReferralLeaderboard(
  limit: number = 10
): Promise<{
  success: boolean;
  data?: Array<{
    userId: string;
    username?: string;
    avatar?: string;
    totalReferrals: number;
    totalEarnings: number;
  }>;
  error?: string;
}> {
  try {
    const { data } = await supabaseAdmin
      .from("referral_statistics")
      .select("\n      user_id,\n      total_earnings,\n      level1_count,\n      level2_count,\n      level3_count,\n      user:user_id!inner(username, full_name, avatar_url)\n    ")
      .order("total_earnings", { ascending: false })
      .limit(limit);
    
    const leaderboard = (data || []).map((item) => ({
      userId: item.user_id,
      username: item.user?.username || item.user?.full_name,
      avatar: item.user?.avatar_url,
      totalReferrals: (item.level1_count || 0) + (item.level2_count || 0) + (item.level3_count || 0),
      totalEarnings: item.total_earnings || 0,
    }));
    
    return { success: true, data: leaderboard };
  } catch (error) {
    logger.error("Error getting referral leaderboard:", error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Refresh referral statistics materialized view
 */
export async function refreshReferralStats(): Promise<{ success: boolean; error?: string }> {
  try {
    await supabaseAdmin.rpc("refresh_referral_stats");
    return { success: true };
  } catch (error) {
    logger.error("Error refreshing referral stats:", error);
    return { success: false, error: (error as Error).message };
  }
}