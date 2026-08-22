-- RPC to get all unique service IDs across all providers
CREATE OR REPLACE FUNCTION get_all_provider_activities()
RETURNS TABLE (activity_id text, activity_name text) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT 
        jsonb_array_elements(metadata->'services')->>'id' as activity_id,
        jsonb_array_elements(metadata->'services')->>'name' as activity_name
    FROM crews
    WHERE metadata->>'is_provider' = 'true';
END;
$$ LANGUAGE plpgsql;