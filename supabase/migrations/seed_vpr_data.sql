-- Используем DO блок для получения ID и вставки зависимых данных
DO $$
DECLARE
    subj_rus_id INT;
    subj_math_id INT;
    subj_bio_id INT;
    subj_soc_id INT;
    subj_eng_id INT;
    q_id INT; -- Переменная для ID вопроса
BEGIN
    -- Получаем ID предметов (предполагаем, что они уже вставлены)
    SELECT id INTO subj_rus_id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 6;
    SELECT id INTO subj_math_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6;
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;
    SELECT id INTO subj_soc_id FROM public.subjects WHERE name = 'Обществознание' AND grade_level = 6;
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 6;

    -- === РУССКИЙ ЯЗЫК ===
    IF subj_rus_id IS NOT NULL THEN
        -- Вопрос 1
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (О или А): пол..гать (надеяться)', E'В корнях -лаг-/-лож- перед Г пишется А (полагать), перед Ж пишется О (предложить).', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'О', false),
        (q_id, 'А', true);

        -- Вопрос 2
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (О или А): предл..жить (что-то сделать)', E'В корнях -лаг-/-лож- перед Г пишется А (полагать), перед Ж пишется О (предложить).', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'О', true),
        (q_id, 'А', false);

        -- Вопрос 3
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (О или А): р..сток (молодое растение)', E'В корнях -раст-/-ращ-/-рос- перед СТ и Щ пишется А (растение, выращенный), перед С пишется О (выросший). *Исключения:* росток, отрасль и др. (росток - исключение).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'О', true),
        (q_id, 'А', false);

        -- Вопрос 4
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (О или А): выр..щенный (кем-то)', E'В корнях -раст-/-ращ-/-рос- перед СТ и Щ пишется А (растение, выращенный), перед С пишется О (выросший). Выращенный - перед Щ пишем А.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'О', false),
        (q_id, 'А', true);

        -- Вопрос 5
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (Е или И): бл..стать (ярко светить)', E'Корни с чередованием -бер-/-бир-, -мер-/-мир-, -стел-/-стил-, -блест-/-блист- и другие. Пишется И, если после корня есть суффикс -А-. блистать (есть -а-)', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Е', false),
        (q_id, 'И', true);

        -- Вопрос 6
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (Е или И): заб..рать (что-то)', E'Корни с чередованием -бер-/-бир-, -мер-/-мир-, -стел-/-стил-, -блест-/-блист- и другие. Пишется И, если после корня есть суффикс -А-. забирать (есть -а-)', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Е', false),
        (q_id, 'И', true);

        -- Вопрос 7
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (Е или И): зам..реть (остановиться)', E'Корни с чередованием. Пишется И, если после корня есть суффикс -А-. замереть (нет -а-)', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Е', true),
        (q_id, 'И', false);

        -- Вопрос 8
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (Е или И): ст..лить (покрывало)', E'Корни с чередованием. Пишется И, если после корня есть суффикс -А-. В инфинитиве "стелить" пишется Е (исключение БРИТЬ, СТЕЛИТЬ). Писать И будем, если есть суффикс -А-: расстилать.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Е', true),
        (q_id, 'И', false);

        -- Вопрос 9
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (З или С) в приставке: ра..писание', E'В приставках на -З/-С пишется З перед звонкими согласными и гласными, а С – перед глухими согласными (П - глухой).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'З', false),
        (q_id, 'С', true);

        -- Вопрос 10
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Вставь пропущенную букву (З или С) в приставке: во..глас', E'В приставках на -З/-С пишется З перед звонкими согласными (Г - звонкий) и гласными, а С – перед глухими.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'З', true),
        (q_id, 'С', false);

        -- ... И ТАК ДАЛЕЕ ДЛЯ ВСЕХ ВОПРОСОВ РУССКОГО ...
        -- Пример последнего вопроса Русского
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_rus_id, E'Найди в тексте "Лес стоял тихий..." словосочетание "прилагательное + существительное", обозначающее цвет листьев.', E'Ищем описание листьев. В тексте есть: "желтых и красных листьев". Подходят словосочетания желтых листьев и красных листьев.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'легкий ветерок', false),
        (q_id, 'желтых листьев', true), -- Можно сделать мультивыбор или принять любой правильный
        (q_id, 'белым покрывалом', false),
        (q_id, 'влажной землей', false);

    END IF;

    -- === МАТЕМАТИКА ===
    IF subj_math_id IS NOT NULL THEN
        -- Вопрос 1
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_math_id, E'Вычисли: -15 + 8', E'Сложение чисел с разными знаками: Из большего модуля (15) вычитаем меньший модуль (8) и ставим знак большего модуля (минус). 15 - 8 = 7. Ответ: -7.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '7', false),
        (q_id, '-7', true),
        (q_id, '23', false),
        (q_id, '-23', false);

        -- Вопрос 2
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_math_id, E'Вычисли: -6 * (-4)', E'Умножение чисел с одинаковыми знаками: "Минус" на "минус" дает "плюс". 6 * 4 = 24. Ответ: 24.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '24', true),
        (q_id, '-24', false),
        (q_id, '10', false),
        (q_id, '-10', false);

        -- Вопрос 3
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_math_id, E'Вычисли: 12 : (-3)', E'Деление чисел с разными знаками: "Плюс" на "минус" дает "минус". 12 : 3 = 4. Ответ: -4.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '4', false),
        (q_id, '-4', true),
        (q_id, '-9', false),
        (q_id, '9', false);

        -- Вопрос 4
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_math_id, E'Вычисли: 2,5 * 0,4', E'Умножаем 25 * 4 = 100. Считаем, сколько знаков было после запятой в обоих числах вместе (у 2,5 - один, у 0,4 - один, итого два знака). В ответе (100) отделяем справа два знака запятой. Получаем 1,00 или просто 1.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1', true),
        (q_id, '10', false),
        (q_id, '0.1', false),
        (q_id, '100', false);

        -- Вопрос 5
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_math_id, E'Вычисли: 3/4 + 1/6', E'Общий знаменатель для 4 и 6 - это 12. Приводим дроби:\n3/4 = (3*3)/(4*3) = 9/12\n1/6 = (1*2)/(6*2) = 2/12\nСкладываем: 9/12 + 2/12 = (9+2)/12 = 11/12.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '4/10', false),
        (q_id, '4/6', false),
        (q_id, '11/12', true),
        (q_id, '10/24', false);

        -- ... И ТАК ДАЛЕЕ ДЛЯ ВСЕХ ВОПРОСОВ МАТЕМАТИКИ ...
        -- Пример последнего вопроса Математики
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_math_id, E'На координатной плоскости отметь точку C(3; -4). Какой квадрант?', E'Координаты точки (x; y). x=3 (вправо), y=-4 (вниз). Это IV (четвертый) квадрант (правый нижний).', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'I', false),
        (q_id, 'II', false),
        (q_id, 'III', false),
        (q_id, 'IV', true);

    END IF;

    -- === БИОЛОГИЯ ===
    IF subj_bio_id IS NOT NULL THEN
        -- ... ВСТАВИТЬ ВОПРОСЫ И ОТВЕТЫ ДЛЯ БИОЛОГИИ ...
    END IF;

    -- === ОБЩЕСТВОЗНАНИЕ ===
    IF subj_soc_id IS NOT NULL THEN
        -- ... ВСТАВИТЬ ВОПРОСЫ И ОТВЕТЫ ДЛЯ ОБЩЕСТВОЗНАНИЯ ...
    END IF;

    -- === АНГЛИЙСКИЙ ЯЗЫК ===
    IF subj_eng_id IS NOT NULL THEN
        -- ... ВСТАВИТЬ ВОПРОСЫ И ОТВЕТЫ ДЛЯ АНГЛИЙСКОГО ...
        -- Пример:
        INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_eng_id, E'Выбери правильное слово: Your mother''s sister is your...', E'"Mother''s sister" переводится как "сестра мамы". Сестра мамы или папы по-английски называется aunt (тётя). Brother - брат, uncle - дядя.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'brother', false),
        (q_id, 'aunt', true),
        (q_id, 'uncle', false);

         INSERT INTO public.vpr_questions (subject_id, text, explanation, position)
        VALUES (subj_eng_id, E'Выбери правильную форму глагола: He ... football every Sunday.', E'"Every Sunday" (каждое воскресенье) указывает на регулярное действие (Present Simple). Для he/she/it добавляем -s. He plays.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'play', false),
        (q_id, 'plays', true),
        (q_id, 'is playing', false);

        -- ... остальные вопросы английского ...

    END IF;

END $$;
