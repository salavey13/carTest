-- Referral System Database Schema
-- This creates proper tables for tracking referrals with multi-level support

-- Referral relationships table
CREATE TABLE IF NOT EXISTS referral_relationships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    referred_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    referral_level INTEGER NOT NULL CHECK (referral_level >= 1 AND referral_level <= 3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(referrer_id, referred_id)
);

-- Referral commissions table for tracking earnings
CREATE TABLE IF NOT EXISTS referral_commissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    referred_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    order_amount DECIMAL(10,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    commission_level INTEGER NOT NULL CHECK (commission_level >= 1 AND commission_level <= 3),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Referral statistics materialized view for fast queries
CREATE MATERIALIZED VIEW referral_statistics AS
SELECT 
    u.user_id,
    u.user_id as referrer_id,
    COUNT(DISTINCT CASE WHEN rr.referral_level = 1 THEN rr.referred_id END) as level1_count,
    COUNT(DISTINCT CASE WHEN rr.referral_level = 2 THEN rr.referred_id END) as level2_count,
    COUNT(DISTINCT CASE WHEN rr.referral_level = 3 THEN rr.referred_id END) as level3_count,
    COALESCE(SUM(CASE WHEN rc.commission_level = 1 THEN rc.commission_amount ELSE 0 END), 0) as level1_earnings,
    COALESCE(SUM(CASE WHEN rc.commission_level = 2 THEN rc.commission_amount ELSE 0 END), 0) as level2_earnings,
    COALESCE(SUM(CASE WHEN rc.commission_level = 3 THEN rc.commission_amount ELSE 0 END), 0) as level3_earnings,
    COALESCE(SUM(rc.commission_amount), 0) as total_earnings,
    COALESCE(SUM(CASE WHEN rc.status = 'paid' THEN rc.commission_amount ELSE 0 END), 0) as paid_earnings,
    COALESCE(SUM(CASE WHEN rc.status = 'pending' THEN rc.commission_amount ELSE 0 END), 0) as pending_earnings
FROM users u
LEFT JOIN referral_relationships rr ON u.user_id = rr.referrer_id
LEFT JOIN referral_commissions rc ON u.user_id = rc.referrer_id
GROUP BY u.user_id;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_referral_relationships_referrer ON referral_relationships(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_relationships_referred ON referral_relationships(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_relationships_level ON referral_relationships(referral_level);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referrer ON referral_commissions(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_referred ON referral_commissions(referred_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_status ON referral_commissions(status);

-- Referral codes table for tracking unique referral links
CREATE TABLE IF NOT EXISTS referral_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Referral activities table for gamification
CREATE TABLE IF NOT EXISTS referral_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL, -- 'referral_signup', 'social_share', 'purchase_made', etc.
    activity_data JSONB,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User referral balances for internal currency
CREATE TABLE IF NOT EXISTS user_referral_balances (
    user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    balance DECIMAL(10,2) DEFAULT 0,
    lifetime_earnings DECIMAL(10,2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_referral_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW referral_statistics;
END;
$$ LANGUAGE plpgsql;