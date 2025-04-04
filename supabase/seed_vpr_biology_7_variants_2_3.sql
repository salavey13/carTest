-- =============================================
-- === INSERT BIOLOGY 7th Grade, VARIANT 2 ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 2; -- Set variant number
BEGIN
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 7;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Variant 2 (Grade 7)...';

        -- Clean up existing data for this specific variant first
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;

        -- Question 1 (Var 2) - Diagram Labeling (e.g., Plant Cell)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Рассмотрите изображение растительной клетки. Подпишите структуры, обозначенные цифрами 1, 2 и 3.\n\n[Изображение: Растительная клетка Вар 2]', E'Назовите указанные органоиды или части клетки.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Названия структур 1, 2, 3]', true); -- Placeholder, e.g., 'Ядро, Вакуоль, Хлоропласт'

        -- Question 2 (Var 2) - Multiple Choice (e.g., Photosynthesis)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Какой газ необходим растениям для фотосинтеза?\n1) Кислород\n2) Азот\n3) Углекислый газ\n4) Водород', E'Выберите один правильный ответ из предложенных.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', true);

        -- Question 3 (Var 2) - Matching (e.g., Animal Kingdom Classification)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Установите соответствие между животным и классом, к которому оно относится.\n\nЖИВОТНОЕ:\nА) Лягушка\nБ) Воробей\nВ) Акула\n\nКЛАСС:\n1) Птицы\n2) Земноводные\n3) Рыбы\n4) Млекопитающие', E'Сопоставьте каждое животное с его классом. Запишите последовательность цифр.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность цифр для А, Б, В]', true); -- Placeholder, e.g., '213'

        -- Question 4 (Var 2) - Short Answer (e.g., Function of Roots)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Какую основную функцию выполняют корни растения?', E'Напишите краткий ответ (одно-два предложения).', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Краткое описание функции корней]', true); -- Placeholder, e.g., 'Всасывание воды и минеральных веществ, закрепление в почве'

        -- Question 5 (Var 2) - True/False Statements (e.g., Human Anatomy)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Выберите верные утверждения о кровеносной системе человека:\n1) Сердце состоит из трех камер.\n2) Артерии несут кровь от сердца.\n3) Венозная кровь богата кислородом.\n4) Кровь состоит только из эритроцитов.', E'Выберите номера верных утверждений.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true); -- Placeholder, actual answer depends on specific statements

        -- Question 6 (Var 2) - Diagram Analysis (e.g., Food Web)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Рассмотрите схему пищевой цепи. Назовите консумента второго порядка.\n\n[Изображение: Пищевая цепь Вар 2]', E'Определите организм, занимающий указанный трофический уровень.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Название консумента II порядка]', true); -- Placeholder

        -- Question 7 (Var 2) - Fill-in-the-Blanks (e.g., Plant Reproduction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Процесс слияния мужской и женской половых клеток у растений называется _______.', E'Вставьте пропущенное слово.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'оплодотворение', true); -- Placeholder

        -- Question 8 (Var 2) - Comparison (e.g., Bacteria vs Virus)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Назовите одно основное отличие бактерий от вирусов.', E'Укажите ключевое различие между двумя группами организмов/структур.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Описание отличия]', true); -- Placeholder, e.g., 'Бактерии имеют клеточное строение, вирусы - нет'

        -- Question 9 (Var 2) - Short Explanation (e.g., Adaptation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Почему белый медведь имеет белую окраску шерсти? Объясните.', E'Дайте краткое объяснение адаптивного значения признака.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Объяснение маскировки]', true); -- Placeholder

        -- Question 10 (Var 2) - Problem Solving/Application (e.g., Health)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Какие правила гигиены необходимо соблюдать для профилактики кишечных инфекций?', E'Перечислите 2-3 правила.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Перечисление правил гигиены]', true); -- Placeholder

    ELSE
        RAISE NOTICE 'Subject "Биология" (Grade 7) not found. Skipping Variant 2.';
    END IF;
END $$;


-- =============================================
-- === INSERT BIOLOGY 7th Grade, VARIANT 3 ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 3; -- Set variant number
BEGIN
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 7;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Variant 3 (Grade 7)...';

        -- Clean up existing data for this specific variant first
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;

        -- Question 1 (Var 3) - Diagram Labeling (e.g., Animal Cell)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Рассмотрите изображение животной клетки. Подпишите структуры, обозначенные цифрами 1, 2 и 3.\n\n[Изображение: Животная клетка Вар 3]', E'Назовите указанные органоиды или части клетки.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Названия структур 1, 2, 3]', true); -- Placeholder, e.g., 'Мембрана, Ядро, Цитоплазма'

        -- Question 2 (Var 3) - Multiple Choice (e.g., Respiration)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Какой процесс обеспечивает живые организмы энергией за счет расщепления органических веществ?\n1) Фотосинтез\n2) Дыхание\n3) Питание\n4) Размножение', E'Выберите один правильный ответ из предложенных.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true);

        -- Question 3 (Var 3) - Matching (e.g., Plant Organs and Functions)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Установите соответствие между органом растения и его основной функцией.\n\nОРГАН РАСТЕНИЯ:\nА) Лист\nБ) Стебель\nВ) Цветок\n\nФУНКЦИЯ:\n1) Опора, транспорт веществ\n2) Размножение\n3) Фотосинтез, испарение воды\n4) Всасывание воды', E'Сопоставьте каждый орган с его функцией. Запишите последовательность цифр.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность цифр для А, Б, В]', true); -- Placeholder, e.g., '312'

        -- Question 4 (Var 3) - Short Answer (e.g., Definition)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Что такое экосистема?', E'Дайте краткое определение.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Краткое определение экосистемы]', true); -- Placeholder

        -- Question 5 (Var 3) - True/False Statements (e.g., Classification)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Выберите верные утверждения о грибах:\n1) Грибы относятся к растениям.\n2) Клеточная стенка грибов содержит хитин.\n3) Грибы питаются путем фотосинтеза.\n4) Дрожжи - это одноклеточные грибы.', E'Выберите номера верных утверждений.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Номера верных утверждений]', true); -- Placeholder, e.g., '24'

        -- Question 6 (Var 3) - Diagram Analysis (e.g., Heart Structure)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Рассмотрите схему строения сердца человека. Какой цифрой обозначен левый желудочек?\n\n[Изображение: Строение сердца Вар 3]', E'Определите указанную часть органа по схеме.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Цифра, обозначающая левый желудочек]', true); -- Placeholder

        -- Question 7 (Var 3) - Fill-in-the-Blanks (e.g., Evolution)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Естественный _______ - это основной движущий фактор эволюции.', E'Вставьте пропущенное слово.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'отбор', true); -- Placeholder

        -- Question 8 (Var 3) - Comparison (e.g., Plant vs Animal Cell)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Назовите две структуры, которые есть в растительной клетке, но отсутствуют в животной.', E'Укажите два отличительных признака растительной клетки.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Названия двух структур]', true); -- Placeholder, e.g., 'Клеточная стенка, хлоропласты'

        -- Question 9 (Var 3) - Short Explanation (e.g., Symbiosis)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Приведите пример симбиоза и кратко объясните его суть.', E'Опишите пример взаимовыгодного сожительства организмов.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Пример и объяснение симбиоза]', true); -- Placeholder, e.g., 'Лишайник (гриб+водоросль)...'

        -- Question 10 (Var 3) - Problem Solving/Application (e.g., Ecology)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Почему нельзя сжигать сухую траву весной?', E'Назовите 2-3 негативных последствия.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Перечисление негативных последствий]', true); -- Placeholder

    ELSE
        RAISE NOTICE 'Subject "Биология" (Grade 7) not found. Skipping Variant 3.';
    END IF;
END $$;