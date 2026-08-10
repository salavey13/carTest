-- ═══════════════════════════════════════════════════════════════════════════
-- Extend user_states for step tracking + add delivery columns to sale_contract_artifacts
-- ═══════════════════════════════════════════════════════════════════════════

-- Step tracking columns (for step numbering + step correction)
ALTER TABLE public.user_states ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
ALTER TABLE public.user_states ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0;
ALTER TABLE public.user_states ADD COLUMN IF NOT EXISTS corrected_steps INTEGER[] DEFAULT '{}';

-- Delivery method columns for sale contracts
ALTER TABLE private.sale_contract_artifacts
ADD COLUMN IF NOT EXISTS delivery_method TEXT CHECK (delivery_method IN ('pickup', 'transport_company'));

ALTER TABLE private.sale_contract_artifacts
ADD COLUMN IF NOT EXISTS transport_company_name TEXT;

ALTER TABLE private.sale_contract_artifacts
ADD COLUMN IF NOT EXISTS transport_payment_type TEXT CHECK (transport_payment_type IN ('buyer_pays', 'seller_pays'));

CREATE INDEX IF NOT EXISTS idx_sale_contract_artifacts_delivery
  ON private.sale_contract_artifacts(delivery_method);
