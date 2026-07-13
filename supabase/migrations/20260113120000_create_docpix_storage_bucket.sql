-- Migration: Create docpix storage bucket for temporary document photos
-- Purpose: Store passport/license photos temporarily during OCR processing
-- Access: Service role only (server-side), auto-deleted after OCR completion
-- Compliance: 152-ФЗ (Russian data privacy law)

-- Create non-public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('docpix', 'docpix', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: only service role can access (server-side operations only)
CREATE POLICY "Service role only access to docpix"
ON storage.objects FOR ALL
USING (auth.role() = 'service_role');

-- Note: Photos are automatically deleted after OCR processing in /api/docphotoocr
-- This ensures 152-ФЗ compliance (no permanent storage of personal documents)
