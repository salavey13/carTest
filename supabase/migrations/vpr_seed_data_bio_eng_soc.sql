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