DO $$
DECLARE
    subj_id INT;
    q_id INT;
BEGIN
    -- Находим ID предмета (Алгебра 8)
    SELECT id INTO subj_id FROM public.subjects WHERE name = 'Алгебра' AND grade_level = 8;

    IF subj_id IS NULL THEN
        RAISE EXCEPTION 'Предмет Алгебра 8 не найден. Сначала запустите основной миграционный файл.';
    END IF;

    -- =============================================
    -- === ВАРИАНТ 2: ТАКТИЧЕСКИЙ СТАНДАРТ (Hard) ===
    -- =============================================
    RAISE NOTICE 'Seeding Algebra 8 Variant 2...';

    -- Q1: Сокращение с ФСУ
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 2, E'Упростите выражение: (x² – 9) / (x² + 3x)', E'Протокол деконструкции: \n1. Числитель (разность квадратов): (x - 3)(x + 3) \n2. Знаменатель (вынос за скобки): x(x + 3) \n3. Сокращаем общий пакет (x + 3). \n4. Результат: (x - 3) / x.', 1)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '(x - 3) / x', true),
    (q_id, 'x - 3', false),
    (q_id, '(x + 3) / x', false),
    (q_id, '-3', false);

    -- Q2: Внесение под корень
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 2, E'Представьте в виде корня: 5√3', E'Алгоритм сжатия данных: \n1. Возводим 5 в квадрат: 5² = 25. \n2. Заносим под знак: √(25 * 3). \n3. Итог: √75.', 2)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '√75', true),
    (q_id, '√15', false),
    (q_id, '√45', false),
    (q_id, '75', false);

    -- Q3: Неполное квадратное уравнение
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 2, E'Найдите корни уравнения: 3x² – 27 = 0', E'1. Переносим константу: 3x² = 27. \n2. Делим на 3: x² = 9. \n3. Извлекаем корни: x = 3 или x = -3.', 3)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '3; -3', true),
    (q_id, '9', false),
    (q_id, '3', false),
    (q_id, '±9', false);

    -- Q4: Отрицательная степень
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 2, E'Вычислите: 4⁻² + (1/2)⁻³', E'Инверсия степеней: \n1. 4⁻² = 1/4² = 1/16. \n2. (1/2)⁻³ = 2³ = 8. \n3. Итог: 8 + 1/16 = 8,0625.', 4)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '8.0625', true),
    (q_id, '0.25', false),
    (q_id, '10', false),
    (q_id, '7.9375', false);

    -- Q5: Неравенства (Умножение)
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 2, E'Если a < b, то какое из утверждений верно?', E'Правила трансформации: \n1. При умножении на отрицательное число знак меняется. \n2. -5a > -5b — это правильный переворот знака.', 5)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '-5a > -5b', true),
    (q_id, 'a - 5 > b - 5', false),
    (q_id, 'a/5 > b/5', false),
    (q_id, '-a < -b', false);

    -- =============================================
    -- === ВАРИАНТ 3: КИБЕР-ВAЙБ (Funny/Bonus) ===
    -- =============================================
    RAISE NOTICE 'Seeding Algebra 8 Variant 3 (Bonus)...';

    -- Q1: Логистика страйкбола
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 3, E'Скорость вылета шара из привода описывается корнем √22500 м/с. Какова реальная скорость?', E'Просто извлеки корень, боец! √225 = 15, значит √22500 = 150. Твой шар летит со скоростью 150 м/с. Не забудь очки!', 1)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '150 м/с', true),
    (q_id, '225 м/с', false),
    (q_id, '15 м/с', false),
    (q_id, '300 м/с', false);

    -- Q2: Экономика донатов
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 3, E'Цена легендарного скина в XTR вычисляется по формуле: x² - 100 = 0. Сколько звёзд нужно задонатить (x > 0)?', E'Решаем неполное уравнение: x² = 100. Значит x = 10 (так как цена не может быть отрицательной). 10 звёзд — и скин твой!', 2)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '10 XTR', true),
    (q_id, '100 XTR', false),
    (q_id, '50 XTR', false),
    (q_id, 'Бесплатно в CyberVibe Studio', false);

    -- Q3: Ошибка выжившего (ОДЗ)
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 3, E'Твой тиммейт написал код: `speed = distance / (ping - 20)`. При каком пинге сервер упадет в ошибку (Error: Zero Division)?', E'На ноль делить нельзя даже в киберпространстве! Если пинг = 20, то в скобках будет 0. Система рухнет.', 3)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '20 ms', true),
    (q_id, '0 ms', false),
    (q_id, '999 ms', false),
    (q_id, 'Когда админ уйдет спать', false);

    -- Q4: Стандартный вид мемов
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 3, E'В интернете 450 000 000 картинок с котами. Запиши это число в стандартном виде, чтобы не пугать сервер нулями.', E'1. Ставим запятую после первой цифры: 4,5. \n2. Считаем прыжки: 8 знаков вправо. \n3. Получаем 4,5 * 10⁸. Котики в безопасности.', 4)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '4.5 * 10⁸', true),
    (q_id, '45 * 10⁷', false),
    (q_id, '4.5 * 10⁹', false),
    (q_id, 'Котов слишком много', false);

    -- Q5: Дискриминант Босса
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 3, E'Ты сражаешься с финальным боссом. Его HP — это дискриминант уравнения x² - 6x + 9 = 0. Сколько ударов осталось нанести?', E'Считаем D: b² - 4ac = (-6)² - 4*1*9 = 36 - 36 = 0. HP босса на нуле! Один корень, один удар — и победа за тобой.', 5)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '0 (Босс повержен)', true),
    (q_id, '10', false),
    (q_id, '36', false),
    (q_id, 'Infinite', false);

END $$;