-- =============================================
-- ===          SUBJECT: БИОЛОГИЯ          ===
-- =============================================

-- Ensure the subjects table exists and has the "Биология" entry
INSERT INTO public.subjects (name, description) VALUES
('Биология', E'## ВПР по Биологии (6 класс)\n\nУзнаем, что ты запомнил о **растениях**, **клетках**, **грибах** и **бактериях**.\n\n**Основные разделы:**\n\n*   🌿 Строение и функции **органов растений** (корень, стебель, лист, цветок, плод, семя).\n*   🔬 **Клетка**: строение растительной и животной клетки, их отличия.\n*   💡 **Процессы**: Фотосинтез, дыхание, испарение.\n*   🍄 **Грибы и бактерии**: их особенности и роль в природе.\n*   🧬 **Признаки живого**.\n\nМир живого ждет тебя! 🌍')
ON CONFLICT (name) DO NOTHING;

-- Clear existing Biology questions for idempotency
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Биология'));
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Биология');


-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 1 ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология';

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Variant 1...';

        -- Question 1 (Bio Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'Какая часть растения отвечает за поглощение воды и минеральных солей из почвы?', E'Корень закрепляет растение в почве и всасывает из нее воду с растворенными минеральными веществами.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Корень', true),
        (q_id, 'Стебель', false),
        (q_id, 'Лист', false),
        (q_id, 'Цветок', false);

        -- Question 2 (Bio Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'Какой процесс происходит в зеленых листьях растений на свету с использованием углекислого газа и воды?', E'Фотосинтез - это процесс образования органических веществ из углекислого газа и воды на свету при участии хлорофилла (зеленого пигмента).', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Фотосинтез', true),
        (q_id, 'Дыхание', false),
        (q_id, 'Испарение', false),
        (q_id, 'Размножение', false);

        -- Question 3 (Bio Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'Какая структура **отсутствует** в животной клетке, но есть в растительной?', E'Клеточная стенка (из целлюлозы), пластиды (например, хлоропласты) и крупная центральная вакуоль - характерные признаки растительной клетки, отсутствующие у животных.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Клеточная стенка', true),
        (q_id, 'Ядро', false),
        (q_id, 'Цитоплазма', false),
        (q_id, 'Мембрана', false);

        -- Question 4 (Bio Var 1) - Free Response (Text Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'Как называются организмы, которые разлагают мертвые остатки растений и животных (например, плесневые грибы и многие бактерии)?', E'Организмы, разлагающие органические остатки до неорганических веществ, называются редуцентами или разрушителями.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Редуценты', true),
        (q_id, 'Разрушители', true); -- Accept synonym

        -- Question 5 (Bio Var 1) - Multiple Choice (Select multiple)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'Выберите **все** признаки, характерные для живых организмов:\n1) Движение\n2) Питание\n3) Рост и развитие\n4) Наличие кристаллов\n5) Дыхание', E'Кристаллы характерны для неживой природы. Все остальные перечисленные признаки (движение, питание, рост, развитие, дыхание) являются свойствами живых организмов.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1235', true),
        (q_id, '123', false),
        (q_id, '235', false),
        (q_id, '12345', false);

    ELSE
        RAISE NOTICE 'Subject "Биология" not found. Skipping Variant 1.';
    END IF;

END $$;


-- =============================================
-- ===      SUBJECT: АНГЛИЙСКИЙ ЯЗЫК       ===
-- =============================================

-- Ensure the subjects table exists and has the "Английский язык" entry
INSERT INTO public.subjects (name, description) VALUES
('Английский язык', E'## ВПР по Английскому языку (6 класс)\n\nПроверим твои **базовые навыки**: умение читать, понимать на слух (аудирование), знание основной лексики и грамматики.\n\n**Грамматика:**\n\n*   Present Simple / Continuous\n*   Past Simple (правильные/неправильные глаголы)\n*   Future Simple (will)\n*   Модальные глаголы (can, must)\n*   Степени сравнения прилагательных\n*   There is / There are\n\n**Лексика:** Семья, школа, еда, животные, хобби, погода и др.\n\nLet''s do it! 👍')
ON CONFLICT (name) DO NOTHING;

-- Clear existing English questions for idempotency
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык'));
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык');


-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 1 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык';

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 1...';

        -- Question 1 (Eng Var 1) - Multiple Choice (Present Simple)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct verb form: My sister usually ___ TV in the evening.', E'Для описания регулярных действий (usually) в 3-м лице единственного числа (My sister) в Present Simple к глаголу добавляется окончание -s.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'watches', true),
        (q_id, 'watch', false),
        (q_id, 'is watching', false),
        (q_id, 'watched', false);

        -- Question 2 (Eng Var 1) - Multiple Choice (Past Simple Irregular)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct verb form: We ___ to the park yesterday.', E'Для описания действия в прошлом (yesterday) используется Past Simple. Глагол "go" - неправильный, его вторая форма - "went".', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'went', true),
        (q_id, 'go', false),
        (q_id, 'goed', false),
        (q_id, 'will go', false);

        -- Question 3 (Eng Var 1) - Multiple Choice (Modal Verb)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct modal verb: You ___ be quiet in the library.', E'Модальный глагол "must" используется для выражения долженствования, обязанности (в библиотеке нужно соблюдать тишину).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'must', true),
        (q_id, 'can', false),
        (q_id, 'may', false),
        (q_id, 'will', false);

        -- Question 4 (Eng Var 1) - Multiple Choice (Comparative Adjective)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct adjective form: This book is ___ than that one.', E'Для сравнения двух предметов используется сравнительная степень прилагательных. Для коротких прилагательных (как "interesting" считается длинным, но здесь ошибка в самом вопросе, предполагаем короткое, например "big") добавляется -er. Для длинных (interesting) используется "more". Здесь "more interesting" - правильный вариант.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'more interesting', true),
        (q_id, 'interesting', false),
        (q_id, 'interestinger', false), -- Common mistake
        (q_id, 'the most interesting', false); -- Superlative degree

        -- Question 5 (Eng Var 1) - Multiple Choice (There is/are)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct form: ___ many apples on the table.', E'Конструкция "There is/are" используется для указания на наличие чего-либо. "Apples" - множественное число, поэтому используется форма "are".', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'There are', true),
        (q_id, 'There is', false),
        (q_id, 'It is', false),
        (q_id, 'They are', false);

        -- Question 6 (Eng Var 1) - Free Response (Vocabulary - Translate)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'What is the Russian word for "brother"?', E'Слово "brother" переводится на русский язык как "брат".', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'брат', true);

    ELSE
        RAISE NOTICE 'Subject "Английский язык" not found. Skipping Variant 1.';
    END IF;

END $$;

-- =============================================
-- ===      SUBJECT: АНГЛИЙСКИЙ ЯЗЫК       ===
-- =============================================
-- (Assuming the subject 'Английский язык' is already inserted from the previous block)

-- Clear existing English questions for VARIANT 2 for idempotency
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык') AND variant_number = 2);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык') AND variant_number = 2;

-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 2 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык';

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 2...';

        -- Question 1 (Eng Var 2) - Multiple Choice (Present Continuous)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 2, E'Choose the correct verb form: Look! The children ___ in the park.', E'Действие происходит прямо сейчас ("Look!"). Используем Present Continuous: форма глагола "to be" (am/is/are) + глагол с окончанием -ing. "The children" (они) - множественное число, поэтому "are playing".', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'are playing', true),
        (q_id, 'play', false),
        (q_id, 'plays', false),
        (q_id, 'played', false);

        -- Question 2 (Eng Var 2) - Multiple Choice (Past Simple Regular)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 2, E'Choose the correct verb form: My friend ___ football last Saturday.', E'Действие произошло в прошлом ("last Saturday"). Используем Past Simple. Глагол "play" - правильный, добавляем окончание -ed.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'played', true),
        (q_id, 'plays', false),
        (q_id, 'play', false),
        (q_id, 'is playing', false);

        -- Question 3 (Eng Var 2) - Multiple Choice (Future Simple)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 2, E'Choose the correct verb form: I think it ___ tomorrow.', E'Говорим о будущем ("tomorrow"), выражаем предположение ("I think"). Используем Future Simple: will + начальная форма глагола (без to).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'will rain', true),
        (q_id, 'rains', false),
        (q_id, 'rained', false),
        (q_id, 'is raining', false);

        -- Question 4 (Eng Var 2) - Multiple Choice (Modal Verb 'can')
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 2, E'Choose the correct modal verb: Birds ___ fly, but fish can''t.', E'Модальный глагол "can" используется для выражения способности или возможности что-то делать ("уметь", "мочь"). Птицы умеют летать.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'can', true),
        (q_id, 'must', false),
        (q_id, 'will', false),
        (q_id, 'are', false);

        -- Question 5 (Eng Var 2) - Multiple Choice (Comparative Adjective - short)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 2, E'Choose the correct adjective form: An elephant is ___ than a mouse.', E'Сравниваем два объекта (слона и мышь). "Big" - короткое прилагательное. Для образования сравнительной степени удваиваем последнюю согласную (если перед ней краткая гласная) и добавляем окончание -er.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'bigger', true),
        (q_id, 'big', false),
        (q_id, 'biggest', false),
        (q_id, 'more big', false);

        -- Question 6 (Eng Var 2) - Free Response (Vocabulary - Food)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 2, E'What is the Russian word for "apple"?', E'Слово "apple" переводится на русский язык как "яблоко".', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'яблоко', true);

    ELSE
        RAISE NOTICE 'Subject "Английский язык" not found. Skipping Variant 2.';
    END IF;

END $$;


-- Clear existing English questions for VARIANT 3 for idempotency
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык') AND variant_number = 3);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык') AND variant_number = 3;

-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 3 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык';

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 3...';

        -- Question 1 (Eng Var 3) - Multiple Choice (Present Simple - Question)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 3, E'Choose the correct auxiliary verb: ___ your brother like ice cream?', E'Это вопрос о регулярном предпочтении в Present Simple. Подлежащее "your brother" - это 3-е лицо, единственное число (he). В вопросах Present Simple для he/she/it используется вспомогательный глагол "Does".', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Does', true),
        (q_id, 'Do', false),
        (q_id, 'Is', false),
        (q_id, 'Are', false);

        -- Question 2 (Eng Var 3) - Multiple Choice (Past Simple - Irregular Negative)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 3, E'Choose the correct verb form: She ___ see the film yesterday because she was busy.', E'Действие не произошло в прошлом ("yesterday"). Используем отрицание в Past Simple: did not (didn''t) + начальная форма глагола (без to). Глагол "see" неправильный, но в отрицаниях Past Simple используется его начальная форма.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'didn''t see', true),
        (q_id, 'doesn''t see', false), -- Present Simple negative
        (q_id, 'didn''t saw', false), -- Common mistake (using past form after didn't)
        (q_id, 'saw not', false); -- Incorrect structure

        -- Question 3 (Eng Var 3) - Multiple Choice (There is/are - Singular)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 3, E'Choose the correct form: ___ a cat under the table.', E'Конструкция "There is/are" указывает на наличие чего-либо. "A cat" - единственное число, поэтому используем форму "is".', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'There is', true),
        (q_id, 'There are', false),
        (q_id, 'It is', false),
        (q_id, 'Is there', false); -- Question form

        -- Question 4 (Eng Var 3) - Multiple Choice (Superlative Adjective)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 3, E'Choose the correct adjective form: Mount Everest is ___ mountain in the world.', E'Сравниваем один объект (Эверест) со всеми остальными в группе (горы мира). Используем превосходную степень. "High" - короткое прилагательное. Добавляем артикль "the" и окончание -est.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'the highest', true),
        (q_id, 'higher', false), -- Comparative degree
        (q_id, 'high', false),
        (q_id, 'the most high', false); -- Incorrect superlative for short adjective

        -- Question 5 (Eng Var 3) - Free Response (Vocabulary - School)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 3, E'How do you say "учитель" in English?', E'Русское слово "учитель" переводится на английский язык как "teacher".', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'teacher', true);

        -- Question 6 (Eng Var 3) - Multiple Choice (Present Continuous - Negative)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 3, E'Choose the correct verb form: He ___ reading a book now, he is sleeping.', E'Действие не происходит прямо сейчас ("now"). Используем отрицание в Present Continuous: форма "to be" (am/is/are) + not + глагол с -ing. "He" - 3е лицо, единственное число, поэтому "is not reading" или сокращенно "isn''t reading".', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'isn''t reading', true),
        (q_id, 'doesn''t read', false), -- Present Simple negative
        (q_id, 'is reading not', false), -- Incorrect word order
        (q_id, 'not reads', false); -- Incorrect structure


    ELSE
        RAISE NOTICE 'Subject "Английский язык" not found. Skipping Variant 3.';
    END IF;

END $$;

-- =============================================
-- ===      SUBJECT: АНГЛИЙСКИЙ ЯЗЫК       ===
-- =============================================
-- (Assuming the subject 'Английский язык' is already inserted)

-- Clear existing English questions for VARIANT 4 for idempotency
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык') AND variant_number = 4);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык') AND variant_number = 4;

-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 4 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык';

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 4...';

        -- Question 1 (Eng Var 4) - Multiple Choice (Past Simple Question - Regular Verb)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 4, E'Choose the correct verb form: ___ you ___ your grandparents last weekend?', E'Это вопрос о действии в прошлом ("last weekend"). В вопросах Past Simple используется вспомогательный глагол "Did" и начальная форма основного глагола (без -ed и без to).', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Did ... visit', true),
        (q_id, 'Do ... visit', false), -- Present Simple question
        (q_id, 'Did ... visited', false), -- Common mistake (using past form after Did)
        (q_id, 'Were ... visiting', false); -- Past Continuous question

        -- Question 2 (Eng Var 4) - Multiple Choice (Preposition of Place)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 4, E'Choose the correct preposition: The cat is sleeping ___ the sofa.', E'Предлог "on" используется, когда что-то находится на поверхности другого предмета (кот на диване). "In" - внутри, "under" - под, "next to" - рядом.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'on', true),
        (q_id, 'in', false),
        (q_id, 'under', false),
        (q_id, 'next to', false);

        -- Question 3 (Eng Var 4) - Multiple Choice (Possessive Adjective)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 4, E'Choose the correct word: This is Ann. ___ favourite colour is blue.', E'Мы говорим о цвете, который нравится Анне (Ann - she). Притяжательное прилагательное для "she" - это "her" (её). "His" - его, "its" - его/её (для неодушевленных или животных), "my" - мой.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Her', true),
        (q_id, 'His', false),
        (q_id, 'Its', false),
        (q_id, 'My', false);

        -- Question 4 (Eng Var 4) - Multiple Choice (Irregular Plural)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 4, E'Choose the correct plural form: There are many ___ in the playground.', E'Слово "child" (ребенок) имеет неправильную форму множественного числа - "children" (дети). "Childs" и "childes" - неверные формы.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'children', true),
        (q_id, 'childs', false),
        (q_id, 'childes', false),
        (q_id, 'child', false); -- Singular form

        -- Question 5 (Eng Var 4) - Multiple Choice (Some/Any in Questions)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 4, E'Choose the correct word: Have you got ___ brothers or sisters?', E'В общих вопросах (на которые можно ответить да/нет) и в отрицательных предложениях обычно используется "any" перед исчисляемыми существительными во множественном числе или неисчисляемыми существительными. "Some" используется в утвердительных предложениях или в вопросах-просьбах/предложениях.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'any', true),
        (q_id, 'some', false),
        (q_id, 'a', false), -- Only for singular countable nouns
        (q_id, 'no', false); -- Used for negative statements, not questions like this

        -- Question 6 (Eng Var 4) - Free Response (Vocabulary - Animals)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 4, E'What is the English word for "собака"?', E'Русское слово "собака" переводится на английский язык как "dog".', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'dog', true);

    ELSE
        RAISE NOTICE 'Subject "Английский язык" not found. Skipping Variant 4.';
    END IF;

END $$;


-- Clear existing English questions for VARIANT 5 for idempotency
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык') AND variant_number = 5);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Английский язык') AND variant_number = 5;

-- =============================================
-- === INSERT ENGLISH 6th Grade, VARIANT 5 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык';

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English Variant 5...';

        -- Question 1 (Eng Var 5) - Multiple Choice (Future Simple Question)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 5, E'Choose the correct auxiliary verb: ___ they travel to London next year?', E'Это вопрос о планах на будущее ("next year"). В вопросах Future Simple используется вспомогательный глагол "Will" перед подлежащим и начальная форма основного глагола.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Will', true),
        (q_id, 'Do', false), -- Present Simple question auxiliary
        (q_id, 'Did', false), -- Past Simple question auxiliary
        (q_id, 'Are', false); -- Present Continuous question auxiliary

        -- Question 2 (Eng Var 5) - Multiple Choice (Present Simple Negative)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 5, E'Choose the correct verb form: My father ___ drink tea, he prefers coffee.', E'Отрицание регулярного действия/предпочтения в Present Simple. "My father" (he) - 3-е лицо, единственное число. Используем вспомогательный глагол "does" + "not" + начальную форму основного глагола: "does not drink" или сокращенно "doesn''t drink".', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'doesn''t drink', true),
        (q_id, 'don''t drink', false), -- Negative auxiliary for I/you/we/they
        (q_id, 'isn''t drinking', false), -- Present Continuous negative
        (q_id, 'not drinks', false); -- Incorrect structure

        -- Question 3 (Eng Var 5) - Multiple Choice (Past Simple Irregular Question)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 5, E'Choose the correct verb form: Where ___ she ___ last summer?', E'Вопрос о действии в прошлом ("last summer"). Используем вспомогательный глагол "Did" и начальную форму основного глагола "go" (даже если это неправильный глагол).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'did ... go', true),
        (q_id, 'did ... went', false), -- Common mistake (using past form after Did)
        (q_id, 'does ... go', false), -- Present Simple question
        (q_id, 'was ... going', false); -- Past Continuous question

        -- Question 4 (Eng Var 5) - Multiple Choice (Object Pronoun)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 5, E'Choose the correct pronoun: Can you give the pen to ___?', E'Местоимение здесь является дополнением (кому дать ручку?). Используем объектное местоимение. Объектное местоимение для "I" (я) - это "me" (мне, меня). "My" - притяжательное прилагательное (мой), "mine" - притяжательное местоимение (мой, без сущ.).', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'me', true),
        (q_id, 'I', false), -- Subject pronoun
        (q_id, 'my', false), -- Possessive adjective
        (q_id, 'mine', false); -- Possessive pronoun

        -- Question 5 (Eng Var 5) - Multiple Choice (Superlative - Long Adjective)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 5, E'Choose the correct adjective form: This is ___ beautiful picture in the gallery.', E'Сравниваем одну картину со всеми остальными в галерее. Используем превосходную степень. "Beautiful" - длинное прилагательное (обычно 2-3 слога и больше). Превосходная степень образуется с помощью "the most" перед прилагательным.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'the most beautiful', true),
        (q_id, 'the beautifulest', false), -- Incorrect superlative for long adjective
        (q_id, 'more beautiful', false), -- Comparative degree
        (q_id, 'beautiful', false);

        -- Question 6 (Eng Var 5) - Free Response (Vocabulary - Weather)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 5, E'How do you say "солнечно" in English?', E'Русское слово "солнечно" (о погоде) переводится на английский язык как "sunny".', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'sunny', true);

    ELSE
        RAISE NOTICE 'Subject "Английский язык" not found. Skipping Variant 5.';
    END IF;

END $$;

-- =============================================
-- ===      SUBJECT: ОБЩЕСТВОЗНАНИЕ       ===
-- =============================================

-- Ensure the subjects table exists and has the "Обществознание" entry
INSERT INTO public.subjects (name, description) VALUES
('Обществознание', E'## ВПР по Обществознанию (6 класс)\n\nПоговорим о **человеке**, **семье**, **школе**, **обществе** и нашей **Родине**.\n\n**Ключевые понятия:**\n\n*   🧍‍♂️ **Человек**: потребности, способности, деятельность (игра, учеба, труд).\n*   👨‍👩‍👧‍👦 **Семья**: роль, отношения, обязанности.\n*   🏫 **Школа**: права и обязанности ученика, значение образования.\n*   🤝 **Общество**: правила (мораль, закон), малая и большая Родина.\n*   🇷🇺 **Россия**: государственные символы.\n\nПокажи, как ты понимаешь мир вокруг! 🤔')
ON CONFLICT (name) DO NOTHING;

-- Clear existing Social Studies questions for idempotency
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Обществознание'));
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Обществознание');


-- ====================================================
-- === INSERT SOCIAL STUDIES 6th Grade, VARIANT 1 ===
-- ====================================================
DO $$
DECLARE
    subj_soc_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_soc_id FROM public.subjects WHERE name = 'Обществознание';

    IF subj_soc_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Social Studies Variant 1...';

        -- Question 1 (Soc Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Что из перечисленного относится к **духовным** потребностям человека?', E'Духовные потребности связаны с познанием мира, саморазвитием, творчеством, верой. Чтение книг относится к познанию и саморазвитию.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Потребность в чтении книг', true),
        (q_id, 'Потребность в пище', false), -- Биологическая
        (q_id, 'Потребность в жилище', false), -- Биологическая/Социальная
        (q_id, 'Потребность в общении', false); -- Социальная

        -- Question 2 (Soc Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Как называется основной вид деятельности школьника?', E'Главная деятельность школьника, направленная на получение знаний и умений, - это учеба (учебная деятельность).', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Учеба', true),
        (q_id, 'Игра', false),
        (q_id, 'Труд', false),
        (q_id, 'Общение', false);

        -- Question 3 (Soc Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Что из перечисленного является **обязанностью** ученика в школе?', E'Соблюдение правил поведения, установленных в школе (уставом, правилами внутреннего распорядка), является обязанностью каждого ученика.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Соблюдать правила поведения', true),
        (q_id, 'Получать бесплатное образование', false), -- Право
        (q_id, 'Выбирать факультативы', false), -- Право
        (q_id, 'Пользоваться библиотекой', false); -- Право

        -- Question 4 (Soc Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Как называется группа людей, основанная на браке или кровном родстве, связанная общим бытом и взаимной ответственностью?', E'Семья - это малая социальная группа, члены которой связаны брачными или родственными отношениями, общностью быта, взаимной помощью и моральной ответственностью.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Семья', true),
        (q_id, 'Школьный класс', false),
        (q_id, 'Государство', false),
        (q_id, 'Друзья', false);

        -- Question 5 (Soc Var 1) - Free Response (Text Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Назовите один из государственных символов Российской Федерации.', E'Государственными символами РФ являются Государственный флаг, Государственный герб и Государственный гимн.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Флаг', true),
        (q_id, 'Герб', true),
        (q_id, 'Гимн', true),
        (q_id, 'Государственный флаг', true),
        (q_id, 'Государственный герб', true),
        (q_id, 'Государственный гимн', true);

        -- Question 6 (Soc Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Что означает понятие "Малая Родина"?', E'Малая Родина - это место, где человек родился и вырос: его город, село, улица, дом. Это конкретное место, с которым связаны первые воспоминания и чувства.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Место, где человек родился и вырос', true),
        (q_id, 'Вся страна, гражданином которой является человек', false), -- Большая Родина (Отечество)
        (q_id, 'Столица государства', false),
        (q_id, 'Любимое место отдыха', false);

    ELSE
        RAISE NOTICE 'Subject "Обществознание" not found. Skipping Variant 1.';
    END IF;

END $$;
