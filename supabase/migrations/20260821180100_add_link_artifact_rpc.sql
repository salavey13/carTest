-- /home/z/my-project/supabase/migrations/20260821180100_add_link_artifact_rpc.sql
-- Add a public RPC to link a rental_contract_artifact to a rental_id by doc_sha256.
-- Used by recovery scripts when /doc-manual failed to create the rental row but
-- the artifact was already inserted.
--
-- The function is SECURITY DEFINER + service_role-only so it can write to the
-- private schema. Returns the updated rental_id (or NULL if no row matched).

CREATE OR REPLACE FUNCTION public.link_artifact_rental_id_by_sha256(
  p_doc_sha256 TEXT,
  p_rental_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_updated INT;
  v_existing_rental_id TEXT;
BEGIN
  -- Guard: refuse to overwrite an existing non-null rental_id
  SELECT rental_id::text INTO v_existing_rental_id
  FROM private.rental_contract_artifacts
  WHERE original_sha256 = p_doc_sha256
  LIMIT 1;

  IF v_existing_rental_id IS NOT NULL AND v_existing_rental_id != p_rental_id::text THEN
    RAISE EXCEPTION 'Artifact already linked to rental_id % (cannot overwrite with %)',
      v_existing_rental_id, p_rental_id;
  END IF;

  UPDATE private.rental_contract_artifacts
  SET rental_id = p_rental_id
  WHERE original_sha256 = p_doc_sha256
    AND (rental_id IS NULL OR rental_id::text = p_rental_id::text);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    RETURN NULL;
  END IF;

  RETURN p_rental_id::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_artifact_rental_id_by_sha256 TO service_role;
