-- /app/supabase/migrations/backup_users.sql
CREATE OR REPLACE FUNCTION public.backup_users_to_csv()
RETURNS void AS $$
DECLARE
    file_path text;
BEGIN
    file_path := 'carpix/users_backup_' || to_char(now(), 'YYYYMMDD_HH24MISS') || '.csv';
    
    -- Export the users table to CSV
    EXECUTE format('COPY (SELECT * FROM public.users) TO ''%s'' WITH (FORMAT CSV, HEADER)', file_path);
    
    -- Move the file to the storage bucket
    PERFORM dblink_exec('dbname=postgres', format('SELECT storage.move_file(''%s'', ''gs://carpix/%s'')', file_path, file_path));
END;
$$ LANGUAGE plpgsql;

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule('0 0 * * *', 'SELECT public.backup_users_to_csv();');
