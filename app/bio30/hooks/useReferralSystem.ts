"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  getReferralStats, 
  getReferralNetwork, 
  processReferralCommissions,
  logReferralActivity,
  generateReferralCode,
  setReferrer
} from '../ref_actions';
import { useAppContext } from '@/contexts/AppContext';

export interface UseReferralSystemReturn {
  // Data
  stats: any;
  network: any;
  loading: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => Promise<void>;
  processOrder: (orderId: string, amount: number) => Promise<void>;
  logActivity: (activityType: string, data?: any) => Promise<void>;
  setUserReferrer: (referrerCode: string) => Promise<void>;
  generateUserReferralCode: () => Promise<string | null>;
}

export const useReferralSystem = (): UseReferralSystemReturn => {
  const { dbUser } = useAppContext();
  const [stats, setStats] = useState<any>(null);
  const [network, setNetwork] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = dbUser?.user_id;

  // Load referral data
  const loadData = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [statsResult, networkResult] = await Promise.all([
        getReferralStats(userId),
        getReferralNetwork(userId)
      ]);
      
      if (statsResult.success) {
        setStats(statsResult.data);
      } else {
        setError(statsResult.error || 'Failed to load referral stats');
      }
      
      if (networkResult.success) {
        setNetwork(networkResult.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Process order and distribute commissions
  const processOrder = useCallback(async (orderId: string, amount: number) => {
    if (!userId) return;
    
    try {
      const result = await processReferralCommissions(orderId, userId, amount);
      if (result.success) {
        // Refresh stats after processing
        await loadData();
      } else {
        throw new Error(result.error || 'Failed to process referral commissions');
      }
    } catch (err) {
      console.error('Error processing referral commissions:', err);
      throw err;
    }
  }, [userId, loadData]);

  // Log referral activity
  const logActivity = useCallback(async (activityType: string, data?: any) => {
    if (!userId) return;
    
    try {
      await logReferralActivity(userId, activityType, data);
      // Optionally refresh stats to show new activity
      await loadData();
    } catch (err) {
      console.error('Error logging referral activity:', err);
    }
  }, [userId, loadData]);

  // Set referrer for user
  const setUserReferrer = useCallback(async (referrerCode: string) => {
    if (!userId) return;
    
    try {
      const result = await setReferrer({ userId, referrerCode });
      if (!result.success) {
        throw new Error(result.error || 'Failed to set referrer');
      }
      // Refresh data after setting referrer
      await loadData();
    } catch (err) {
      console.error('Error setting referrer:', err);
      throw err;
    }
  }, [userId, loadData]);

  // Generate referral code for user
  const generateUserReferralCode = useCallback(async () => {
    if (!userId) return null;
    
    try {
      const code = await generateReferralCode(userId);
      // Refresh stats to show new code
      await loadData();
      return code;
    } catch (err) {
      console.error('Error generating referral code:', err);
      return null;
    }
  }, [userId, loadData]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Auto-load data when user changes
  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId, loadData]);

  return {
    // Data
    stats,
    network,
    loading,
    error,
    
    // Actions
    refreshData,
    processOrder,
    logActivity,
    setUserReferrer,
    generateUserReferralCode
  };
};

// Utility functions for referral calculations
export const calculateCommission = (level: number, amount: number): number => {
  const rates = {
    1: 0.30, // 30% for level 1
    2: 0.10, // 10% for level 2
    3: 0.10  // 10% for level 3
  };
  
  return Math.floor(amount * (rates[level as keyof typeof rates] || 0));
};

export const getActivityPoints = (activityType: string): number => {
  const points = {
    referral_signup: 100,
    social_share: 50,
    purchase_made: 200,
    profile_complete: 25
  };
  
  return points[activityType as keyof typeof points] || 0;
};

// Hook for checking referral code from URL
export const useReferralCodeFromURL = () => {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const { dbUser } = useAppContext();
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const refParam = urlParams.get('ref');
      if (refParam) {
        setReferralCode(refParam);
      }
    }
  }, []);
  
  // Auto-set referrer if code is present and user is logged in
  useEffect(() => {
    if (referralCode && dbUser?.user_id) {
      setReferrer({ userId: dbUser.user_id, referrerCode }).catch(err => {
        console.error('Failed to set referrer from URL:', err);
      });
    }
  }, [referralCode, dbUser?.user_id]);
  
  return referralCode;
};