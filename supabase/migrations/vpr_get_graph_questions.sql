SELECT
    q.id,
    q.variant_number,
    q.position,
    q.text AS question_text,
    q.explanation,
    string_agg(a.text, ' || ') AS correct_answers -- Aggregate correct answers for context
FROM
    public.vpr_questions q
LEFT JOIN
    public.vpr_answers a ON q.id = a.question_id AND a.is_correct = true
WHERE
    q.subject_id = 2 -- Assuming 2 is the ID for 'Математика' Grade 6
    AND (
        q.text ILIKE '%[Диаграмма%'
        OR q.text ILIKE '%[Изображение%'
        OR q.text ILIKE '%[Рисунок%'
        OR q.text ILIKE '%[График%'
        OR q.text ILIKE '%На коорд. прямой%'
        OR q.text ILIKE '%На координатной прямой%'
        -- Add other relevant keywords if needed
    )
GROUP BY
    q.id, q.variant_number, q.position, q.text, q.explanation
ORDER BY
    q.variant_number,
    q.position;