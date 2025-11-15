"use server";

import { supabaseAdmin } from "@/hooks/supabase";
import { logger } from "@/lib/logger";
import type { WebAppUser } from "@/types/telegram";
import { setReferrer } from "../ref_actions";
import { generateReferralCode } from "../ref_actions";
import { parseBio30StartApp } from "./bio30_startapp_parser";

interface CreateOrUpdateUserWithReferralParams {
  userInfo: WebAppUser;
  startParam?: string | null;
  isNewUser?: boolean;
}

export async function createOrUpdateUserWithReferral({
  userInfo,
  startParam,
  isNewUser = false
}: CreateOrUpdateUserWithReferralParams): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  referralSet?: boolean;
}> {
  if (!userInfo?.id) {
    return { success: false, error: "Invalid user info provided" };
  }
  
  const userId = userInfo.id.toString();
  
  try {
    // Parse startapp parameters for BIO30 referrals
    const bio30Params = parseBio30StartApp(startParam);
    
    // Create or update user
    const userResult = await supabaseAdmin
      .from("users")
      .upsert({ 
        user_id: userId, 
        username: userInfo.username || null,
        full_name: `${userInfo.first_name || ""} ${userInfo.last_name || ""}`.trim() || null,
        avatar_url: userInfo.photo_url || null,
        language_code: userInfo.language_code || null,
        updated_at: new Date().toISOString(),
      }, { 
        onConflict: 'user_id' 
      })
      .select("*, metadata")
      .single();

    if (userResult.error) throw userResult.error;
    if (!userResult.data) throw new Error("Failed to create or update user in database.");
    
    const user = userResult.data;
    let referralSet = false;
    
    // Handle BIO30 referral if this is a new user and we have referral info
    if (isNewUser && bio30Params.isReferral && bio30Params.referrerId) {
      try {
        const referralResult = await setReferrer({
          userId,
          referrerId: bio30Params.referrerId,
          referrerCode: bio30Params.referrerId // Using referrerId as code for now
        });
        
        if (referralResult.success) {
          referralSet = true;
          logger.info(`Referral set for new user ${userId} to referrer ${bio30Params.referrerId}`);
        } else {
          logger.warn(`Failed to set referral for user ${userId}: ${referralResult.error}`);
        }
      } catch (referralError) {
        logger.error(`Error setting referral for user ${userId}:`, referralError);
      }
    }
    
    // Generate referral code for the user if they don't have one
    if (!user.metadata?.referral_code) {
      try {
        const referralCode = await generateReferralCode(userId);
        logger.info(`Generated referral code ${referralCode} for user ${userId}`);
      } catch (codeError) {
        logger.error(`Error generating referral code for user ${userId}:`, codeError);
      }
    }
    
    logger.info(`User ${user.username || userId} created or updated successfully.`);
    
    return { 
      success: true, 
      data: user,
      referralSet 
    };
    
  } catch (error) {
    logger.error(`Error creating/updating user ${userId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to create or update user" 
    };
  }
}

/**
 * Enhanced user creation that handles referral codes and routing
 */
export async function handleUserRegistration({
  userInfo,
  startParam,
  isNewUser
}: CreateOrUpdateUserWithReferralParams & { isNewUser: boolean }): Promise<{
  success: boolean;
  user?: any;
  referralSet?: boolean;
  targetPath?: string;
  error?: string;
}> {
  try {
    // Parse BIO30 parameters
    const bio30Params = parseBio30StartApp(startParam);
    
    // Create/update user with referral handling
    const userResult = await createOrUpdateUserWithReferral({
      userInfo,
      startParam,
      isNewUser
    });
    
    if (!userResult.success) {
      return { success: false, error: userResult.error };
    }
    
    return {
      success: true,
      user: userResult.data,
      referralSet: userResult.referralSet,
      targetPath: bio30Params.targetPath
    };
    
  } catch (error) {
    logger.error('Error in handleUserRegistration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed'
    };
  }
}