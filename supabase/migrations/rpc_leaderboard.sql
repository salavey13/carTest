-- task215b: лидерборд ВПР — антифарм-версия.
-- Было: SUM(score) по всем попыткам → пересдача одного варианта качала XP бесконечно.
-- Стало: сумма ЛУЧШЕЙ попытки по каждому (user, subject).
-- Основная реализация теперь в JS (app/vpr-tests/actions.ts); функция оставлена
-- в синхронном виде для прямых вызовов из SQL-клиентов.

CREATE OR REPLACE FUNCTION get_vpr_leaderboard(limit_count INT)
RETURNS TABLE (
    user_id TEXT,
    username TEXT,
    avatar_url TEXT,
    total_score BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH best_per_subject AS (
        SELECT
            vta.user_id,
            vta.subject_id,
            MAX(vta.score) AS best_score
        FROM public.vpr_test_attempts vta
        WHERE vta.completed_at IS NOT NULL AND vta.score IS NOT NULL
        GROUP BY vta.user_id, vta.subject_id
    )
    SELECT
        u.user_id,
        u.username,
        u.avatar_url,
        SUM(b.best_score)::BIGINT AS total_score
    FROM public.users u
    JOIN best_per_subject b ON u.user_id = b.user_id
    GROUP BY u.user_id, u.username, u.avatar_url
    HAVING SUM(b.best_score) > 0
    ORDER BY total_score DESC,
             MAX((SELECT MAX(vta2.completed_at) FROM public.vpr_test_attempts vta2
                  WHERE vta2.user_id = u.user_id AND vta2.completed_at IS NOT NULL)) DESC
    LIMIT LEAST(GREATEST(limit_count, 1), 50);
END;
$$;
