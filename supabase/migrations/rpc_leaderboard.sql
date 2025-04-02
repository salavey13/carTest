CREATE OR REPLACE FUNCTION get_vpr_leaderboard(limit_count INT)
RETURNS TABLE (
    user_id TEXT,
    username TEXT,
    avatar_url TEXT,
    total_score BIGINT -- Используем BIGINT на случай больших сумм
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.user_id,
        u.username,
        u.avatar_url,
        SUM(vta.score)::BIGINT as total_score
    FROM
        public.users u
    JOIN
        public.vpr_test_attempts vta ON u.user_id = vta.user_id
    WHERE
        vta.completed_at IS NOT NULL AND vta.score IS NOT NULL -- Учитываем только завершенные и оцененные
        -- AND u.role = 'vpr_tester' -- Можно добавить фильтр по роли, если нужно
    GROUP BY
        u.user_id, u.username, u.avatar_url
    ORDER BY
        total_score DESC, MAX(vta.completed_at) DESC -- При равном счете выше тот, кто завершил позже (или раньше - по желанию)
    LIMIT limit_count;
END;
$$;