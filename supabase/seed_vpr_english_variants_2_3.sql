-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 2 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
    variant_num INT := 2; -- Set variant number
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 6;

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 2 (Grade 6)...';

        -- Clean up existing data for this specific variant first
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_eng_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_eng_id AND variant_number = variant_num;

        -- Task 1 (Var 2) - Listening (Matching Speakers/Dialogues to Statements/Places)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 1. Вы услышите 5 высказываний. Установите соответствие между высказываниями каждого говорящего A–E и утверждениями, данными в списке 1–6. Используйте каждую цифру только один раз. В задании есть одно лишнее утверждение. Вы услышите запись дважды.\n\n[Аудио: Задание 1 Вар 2]', E'Прослушайте аудиозапись и сопоставьте говорящих с утверждениями. Запишите последовательность цифр.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность цифр 1-6 для A-E]', true); -- Placeholder e.g., '41526'

        -- Task 2 (Var 2) - Reading Aloud
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 2. Прочитайте вслух текст. У вас есть 1,5 минуты на подготовку и 1,5 минуты, чтобы прочитать текст вслух.\n\n[Текст для чтения: Задание 2 Вар 2]', E'Прочитайте предложенный текст вслух с соблюдением норм произношения.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Оценка произношения]', true); -- Placeholder answer type

        -- Task 3 (Var 2) - Reading Comprehension (Multiple Choice)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 3. Прочитайте текст и выберите единственно верный вариант ответа (A, B или С) на предложенные 5 вопросов.\n\n[Текст для чтения: Задание 3 Вар 2]\n\n1. Question 1?\n   A) Option A\n   B) Option B\n   C) Option C\n2. Question 2?\n   ...\n5. Question 5?\n   ...', E'Прочитайте текст и ответьте на вопросы, выбрав один из вариантов A, B или C.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность букв A/B/C]', true); -- Placeholder e.g., 'BACBC'

        -- Task 4 (Var 2) - Grammar/Vocabulary (Fill-in-the-blanks)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 4. Прочитайте текст. Преобразуйте слова, напечатанные заглавными буквами в конце строк, обозначенных номерами 1–5, так, чтобы они грамматически соответствовали содержанию текста. Заполните пропуски полученными словами.\n\nText with gap 1. WORD1\nText with gap 2. WORD2\n...\nText with gap 5. WORD5', E'Преобразуйте слова в скобках так, чтобы они грамматически соответствовали тексту.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Правильные формы слов]', true); -- Placeholder e.g., 'went, seen, bigger, children, quickly'

        -- Task 5 (Var 2) - Writing (Email)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 5. Вы получили электронное письмо от вашего друга по переписке Бена.\n\n[Текст письма-стимула от Бена Вар 2]\n\nНапишите ответ Бену. В вашем ответе должно быть 60–80 слов.', E'Напишите ответное электронное письмо другу, ответив на его вопросы.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Образец письма]', true); -- Placeholder answer type

        -- Task 6 (Var 2) - Speaking (Monologue - Picture Description)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 6. Выберите одну из трёх фотографий и опишите человека на ней. У вас есть 1,5 минуты на подготовку и не более 2 минут для ответа. У вас должен получиться связный рассказ (6–7 предложений). План ответа поможет вам:\n\n[Изображения: Фото 1, Фото 2, Фото 3 Вар 2]\n\nПлан ответа:\n*   the place\n*   the action\n*   the person’s appearance\n*   whether you like the picture or not\n*   why', E'Опишите одну из предложенных фотографий по плану.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Образец монолога]', true); -- Placeholder answer type

    ELSE
        RAISE NOTICE 'Subject "Английский язык" (Grade 6) not found. Skipping Variant 2.';
    END IF;
END $$;


-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 3 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
    variant_num INT := 3; -- Set variant number
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 6;

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 3 (Grade 6)...';

        -- Clean up existing data for this specific variant first
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_eng_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_eng_id AND variant_number = variant_num;

        -- Task 1 (Var 3) - Listening (Matching Speakers/Dialogues to Statements/Places)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 1. Вы услышите 5 высказываний. Установите соответствие между высказываниями каждого говорящего A–E и утверждениями, данными в списке 1–6. Используйте каждую цифру только один раз. В задании есть одно лишнее утверждение. Вы услышите запись дважды.\n\n[Аудио: Задание 1 Вар 3]', E'Прослушайте аудиозапись и сопоставьте говорящих с утверждениями. Запишите последовательность цифр.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность цифр 1-6 для A-E]', true); -- Placeholder

        -- Task 2 (Var 3) - Reading Aloud
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 2. Прочитайте вслух текст. У вас есть 1,5 минуты на подготовку и 1,5 минуты, чтобы прочитать текст вслух.\n\n[Текст для чтения: Задание 2 Вар 3]', E'Прочитайте предложенный текст вслух с соблюдением норм произношения.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Оценка произношения]', true); -- Placeholder

        -- Task 3 (Var 3) - Reading Comprehension (Multiple Choice)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 3. Прочитайте текст и выберите единственно верный вариант ответа (A, B или С) на предложенные 5 вопросов.\n\n[Текст для чтения: Задание 3 Вар 3]\n\n1. Question 1?\n   ...\n5. Question 5?\n   ...', E'Прочитайте текст и ответьте на вопросы, выбрав один из вариантов A, B или C.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность букв A/B/C]', true); -- Placeholder

        -- Task 4 (Var 3) - Grammar/Vocabulary (Fill-in-the-blanks)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 4. Прочитайте текст. Преобразуйте слова, напечатанные заглавными буквами в конце строк, обозначенных номерами 1–5, так, чтобы они грамматически соответствовали содержанию текста. Заполните пропуски полученными словами.\n\nText with gap 1. WORD1\n...\nText with gap 5. WORD5', E'Преобразуйте слова в скобках так, чтобы они грамматически соответствовали тексту.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Правильные формы слов]', true); -- Placeholder

        -- Task 5 (Var 3) - Writing (Email)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 5. Вы получили электронное письмо от вашего друга по переписке Кейт.\n\n[Текст письма-стимула от Кейт Вар 3]\n\nНапишите ответ Кейт. В вашем ответе должно быть 60–80 слов.', E'Напишите ответное электронное письмо другу, ответив на его вопросы.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Образец письма]', true); -- Placeholder

        -- Task 6 (Var 3) - Speaking (Monologue - Picture Description)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 6. Выберите одну из трёх фотографий и опишите человека на ней. У вас есть 1,5 минуты на подготовку и не более 2 минут для ответа. У вас должен получиться связный рассказ (6–7 предложений). План ответа поможет вам:\n\n[Изображения: Фото 1, Фото 2, Фото 3 Вар 3]\n\nПлан ответа:\n*   the place\n*   the action\n*   the person’s appearance\n*   whether you like the picture or not\n*   why', E'Опишите одну из предложенных фотографий по плану.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Образец монолога]', true); -- Placeholder

    ELSE
        RAISE NOTICE 'Subject "Английский язык" (Grade 6) not found. Skipping Variant 3.';
    END IF;
END $$;

-- /supabase/seed_vpr_english_variants_4_5.sql
-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 4 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
    variant_num INT := 4; -- Set variant number
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 6;

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 4 (Grade 6)...';

        -- Clean up existing data for this specific variant first
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_eng_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_eng_id AND variant_number = variant_num;

        -- Task 1 (Var 4) - Listening (Matching Speakers/Dialogues to Statements/Places)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 1. Вы услышите 5 высказываний. Установите соответствие между высказываниями каждого говорящего A–E и утверждениями, данными в списке 1–6. Используйте каждую цифру только один раз. В задании есть одно лишнее утверждение. Вы услышите запись дважды.\n\n[Аудио: Задание 1 Вар 4]', E'Прослушайте аудиозапись и сопоставьте говорящих с утверждениями. Запишите последовательность цифр.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность цифр 1-6 для A-E]', true); -- Placeholder

        -- Task 2 (Var 4) - Reading Aloud
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 2. Прочитайте вслух текст. У вас есть 1,5 минуты на подготовку и 1,5 минуты, чтобы прочитать текст вслух.\n\n[Текст для чтения: Задание 2 Вар 4]', E'Прочитайте предложенный текст вслух с соблюдением норм произношения.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Оценка произношения]', true); -- Placeholder

        -- Task 3 (Var 4) - Reading Comprehension (Multiple Choice)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 3. Прочитайте текст и выберите единственно верный вариант ответа (A, B или С) на предложенные 5 вопросов.\n\n[Текст для чтения: Задание 3 Вар 4]\n\n1. Question 1?\n   ...\n5. Question 5?\n   ...', E'Прочитайте текст и ответьте на вопросы, выбрав один из вариантов A, B или C.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность букв A/B/C]', true); -- Placeholder

        -- Task 4 (Var 4) - Grammar/Vocabulary (Fill-in-the-blanks)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 4. Прочитайте текст. Преобразуйте слова, напечатанные заглавными буквами в конце строк, обозначенных номерами 1–5, так, чтобы они грамматически соответствовали содержанию текста. Заполните пропуски полученными словами.\n\nText with gap 1. WORD1\n...\nText with gap 5. WORD5', E'Преобразуйте слова в скобках так, чтобы они грамматически соответствовали тексту.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Правильные формы слов]', true); -- Placeholder

        -- Task 5 (Var 4) - Writing (Email)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 5. Вы получили электронное письмо от вашего друга по переписке Тома.\n\n[Текст письма-стимула от Тома Вар 4]\n\nНапишите ответ Тому. В вашем ответе должно быть 60–80 слов.', E'Напишите ответное электронное письмо другу, ответив на его вопросы.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Образец письма]', true); -- Placeholder

        -- Task 6 (Var 4) - Speaking (Monologue - Picture Description)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 6. Выберите одну из трёх фотографий и опишите человека на ней. У вас есть 1,5 минуты на подготовку и не более 2 минут для ответа. У вас должен получиться связный рассказ (6–7 предложений). План ответа поможет вам:\n\n[Изображения: Фото 1, Фото 2, Фото 3 Вар 4]\n\nПлан ответа:\n*   the place\n*   the action\n*   the person’s appearance\n*   whether you like the picture or not\n*   why', E'Опишите одну из предложенных фотографий по плану.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Образец монолога]', true); -- Placeholder

    ELSE
        RAISE NOTICE 'Subject "Английский язык" (Grade 6) not found. Skipping Variant 4.';
    END IF;
END $$;


-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 5 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
    variant_num INT := 5; -- Set variant number
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 6;

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 5 (Grade 6)...';

        -- Clean up existing data for this specific variant first
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_eng_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_eng_id AND variant_number = variant_num;

        -- Task 1 (Var 5) - Listening (Matching Speakers/Dialogues to Statements/Places)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 1. Вы услышите 5 высказываний. Установите соответствие между высказываниями каждого говорящего A–E и утверждениями, данными в списке 1–6. Используйте каждую цифру только один раз. В задании есть одно лишнее утверждение. Вы услышите запись дважды.\n\n[Аудио: Задание 1 Вар 5]', E'Прослушайте аудиозапись и сопоставьте говорящих с утверждениями. Запишите последовательность цифр.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность цифр 1-6 для A-E]', true); -- Placeholder

        -- Task 2 (Var 5) - Reading Aloud
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 2. Прочитайте вслух текст. У вас есть 1,5 минуты на подготовку и 1,5 минуты, чтобы прочитать текст вслух.\n\n[Текст для чтения: Задание 2 Вар 5]', E'Прочитайте предложенный текст вслух с соблюдением норм произношения.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Оценка произношения]', true); -- Placeholder

        -- Task 3 (Var 5) - Reading Comprehension (Multiple Choice)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 3. Прочитайте текст и выберите единственно верный вариант ответа (A, B или С) на предложенные 5 вопросов.\n\n[Текст для чтения: Задание 3 Вар 5]\n\n1. Question 1?\n   ...\n5. Question 5?\n   ...', E'Прочитайте текст и ответьте на вопросы, выбрав один из вариантов A, B или C.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Последовательность букв A/B/C]', true); -- Placeholder

        -- Task 4 (Var 5) - Grammar/Vocabulary (Fill-in-the-blanks)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 4. Прочитайте текст. Преобразуйте слова, напечатанные заглавными буквами в конце строк, обозначенных номерами 1–5, так, чтобы они грамматически соответствовали содержанию текста. Заполните пропуски полученными словами.\n\nText with gap 1. WORD1\n...\nText with gap 5. WORD5', E'Преобразуйте слова в скобках так, чтобы они грамматически соответствовали тексту.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Правильные формы слов]', true); -- Placeholder

        -- Task 5 (Var 5) - Writing (Email)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 5. Вы получили электронное письмо от вашего друга по переписке Анны.\n\n[Текст письма-стимула от Анны Вар 5]\n\nНапишите ответ Анне. В вашем ответе должно быть 60–80 слов.', E'Напишите ответное электронное письмо другу, ответив на его вопросы.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Образец письма]', true); -- Placeholder

        -- Task 6 (Var 5) - Speaking (Monologue - Picture Description)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, variant_num, E'Задание 6. Выберите одну из трёх фотографий и опишите человека на ней. У вас есть 1,5 минуты на подготовку и не более 2 минут для ответа. У вас должен получиться связный рассказ (6–7 предложений). План ответа поможет вам:\n\n[Изображения: Фото 1, Фото 2, Фото 3 Вар 5]\n\nПлан ответа:\n*   the place\n*   the action\n*   the person’s appearance\n*   whether you like the picture or not\n*   why', E'Опишите одну из предложенных фотографий по плану.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Образец монолога]', true); -- Placeholder

    ELSE
        RAISE NOTICE 'Subject "Английский язык" (Grade 6) not found. Skipping Variant 5.';
    END IF;
END $$;