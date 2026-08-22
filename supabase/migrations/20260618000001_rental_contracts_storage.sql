-- /supabase/migrations/20260618000001_rental_contracts_storage.sql

-- Create storage bucket for rental contracts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('rental-contracts', 'rental-contracts', false, 10485760, ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Note: RLS is already enabled on storage.objects by Supabase

-- Policy: Crew members can view own rental contracts
CREATE POLICY "Crew members can view own rental contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'rental-contracts'
  AND (
    -- Crew owner can read all contracts for their crew
    EXISTS (
      SELECT 1 FROM public.crew_members cm
      JOIN public.users u ON u.user_id = cm.user_id
      WHERE cm.crew_id = (metadata->>'crew_id')::uuid
      AND u.user_id = (auth.jwt() ->> 'chat_id')
      AND cm.role = 'owner'
    )
    OR
    -- Renter can read their own contracts
    EXISTS (
      SELECT 1 FROM private.rental_contract_artifacts rca
      JOIN public.users u ON u.user_id = rca.telegram_chat_id
      WHERE rca.contract_key = regexp_replace(name, '^.*/|.docx$', '', 'g')
      AND u.user_id = (auth.jwt() ->> 'chat_id')
    )
  )
);

-- Policy: Crew owners can upload rental contracts
CREATE POLICY "Crew owners can upload rental contracts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rental-contracts'
  AND EXISTS (
    SELECT 1 FROM public.crew_members cm
    JOIN public.users u ON u.user_id = cm.user_id
    WHERE cm.crew_id = (metadata->>'crew_id')::uuid
    AND u.user_id = (auth.jwt() ->> 'chat_id')
    AND cm.role = 'owner'
  )
);

-- Policy: Crew owners can delete rental contracts
CREATE POLICY "Crew owners can delete rental contracts"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rental-contracts'
  AND EXISTS (
    SELECT 1 FROM public.crew_members cm
    JOIN public.users u ON u.user_id = cm.user_id
    WHERE cm.crew_id = (metadata->>'crew_id')::uuid
    AND u.user_id = (auth.jwt() ->> 'chat_id')
    AND cm.role = 'owner'
  )
);