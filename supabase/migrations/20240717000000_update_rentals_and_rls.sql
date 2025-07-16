-- Step 1: Drop existing dependent objects if they exist
ALTER TABLE public.cars DROP CONSTRAINT IF EXISTS cars_crew_id_fkey;
DROP INDEX IF EXISTS public.idx_cars_crew_id;

-- Step 2: Update the 'rentals' table
-- Drop existing table to recreate with new structure and constraints
DROP TABLE IF EXISTS public.rentals;

CREATE TABLE public.rentals (
    rental_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending_confirmation',
    payment_status TEXT NOT NULL DEFAULT 'interest_paid',
    interest_amount NUMERIC,
    total_cost NUMERIC,
    requested_start_date TIMESTAMPTZ,
    requested_end_date TIMESTAMPTZ,
    agreed_start_date TIMESTAMPTZ,
    agreed_end_date TIMESTAMPTZ,
    delivery_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB,
    CONSTRAINT check_rental_status CHECK (status IN ('pending_confirmation', 'confirmed', 'active', 'completed', 'cancelled', 'disputed')),
    CONSTRAINT check_rental_payment_status CHECK (payment_status IN ('interest_paid', 'fully_paid', 'refunded', 'failed'))
);

COMMENT ON TABLE public.rentals IS 'Tracks the entire lifecycle of a vehicle rental agreement.';
COMMENT ON COLUMN public.rentals.status IS 'The current stage of the rental agreement.';
COMMENT ON COLUMN public.rentals.payment_status IS 'Tracks the payment status, from initial interest to full payment.';
COMMENT ON COLUMN public.rentals.interest_amount IS 'The non-refundable amount paid to initiate the rental.';
COMMENT ON COLUMN public.rentals.owner_id IS 'The ID of the vehicle owner for easier lookups and RLS.';

-- Re-create indexes
CREATE INDEX idx_rentals_user_id ON public.rentals(user_id);
CREATE INDEX idx_rentals_vehicle_id ON public.rentals(vehicle_id);
CREATE INDEX idx_rentals_owner_id ON public.rentals(owner_id);

-- Step 3: Re-add the 'crew_id' column and its index to 'cars'
ALTER TABLE public.cars
ADD COLUMN IF NOT EXISTS crew_id UUID REFERENCES public.crews(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_cars_crew_id ON public.cars(crew_id);


-- Step 4: Update RLS policies for the new 'rentals' table
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rentals" 
ON public.rentals FOR SELECT
USING (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Owners can view rentals of their vehicles" 
ON public.rentals FOR SELECT
USING (auth.jwt() ->> 'sub' = owner_id);

CREATE POLICY "Users can create their own rental interests"
ON public.rentals FOR INSERT
WITH CHECK (auth.jwt() ->> 'sub' = user_id);

CREATE POLICY "Owners and Renters can update their rental agreement"
ON public.rentals FOR UPDATE
USING (auth.jwt() ->> 'sub' = user_id OR auth.jwt() ->> 'sub' = owner_id);