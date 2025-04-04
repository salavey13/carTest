-- =============================================
-- ===      SUBJECT: РУССКИЙ ЯЗЫК (7 КЛАСС) ===
-- =============================================

-- Ensure the subjects table exists and add the "Русский язык" entry for 7th grade
INSERT INTO public.subjects (name, description, grade_level) VALUES
('Русский язык', E'## ВПР по Русскому языку (7 класс)\n\nПроверяем знание **служебных частей речи**, **причастий**, **деепричастий** и **наречий**. Важно уметь правильно их писать и использовать в речи, а также расставлять знаки препинания.\n\n**Основные темы:**\n\n*    morphology_7 **Причастие**: образование, правописание суффиксов, причастный оборот.\n*   morphology_7 **Деепричастие**: образование, деепричастный оборот, НЕ с деепричастиями.\n*   morphology_7 **Наречие**: разряды, степени сравнения, правописание НЕ и Н/НН, О/Е после шипящих, дефис.\n*   morphology_7 **Служебные части речи**: Предлог, Союз, Частица (различение, правописание).\n*   syntax_7 **Пунктуация**: запятые при причастных и деепричастных оборотах, при однородных членах.\n\nВспоминай правила и вперед! ✍️', 7)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    grade_level = EXCLUDED.grade_level
WHERE public.subjects.grade_level != 7; -- Update only if it's not already the 7th grade entry

-- Clear existing Russian Language questions for 7th grade, variant 1 (for idempotency)
DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT q.id FROM public.vpr_questions q
    JOIN public.subjects s ON q.subject_id = s.id
    WHERE s.name = 'Русский язык' AND s.grade_level = 7 AND q.variant_number = 1
);
DELETE FROM public.vpr_questions WHERE subject_id = (
    SELECT id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 7
) AND variant_number = 1;

-- ==================================================
-- === INSERT RUSSIAN LANG 7th Grade, VARIANT 1 ===
-- ==================================================
DO $$
DECLARE
    subj_rus_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_rus_id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 7;

    IF subj_rus_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Russian Language (7th Grade) Variant 1...';

        -- Question 1 (Rus Var 1) - Multiple Choice (Participle Suffix)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, 1, E'В каком слове на месте пропуска пишется буква Е?\n1) завис..вший\n2) постро..вший\n3) услыш..вший\n4) обид..вший', E'В действительных причастиях прошедшего времени перед суффиксом -вш- пишется та же гласная, что и перед -ть в инфинитиве глагола, от которого образовано причастие.\nзависЕть -> зависЕвший\nпостроИть -> построИвший\nуслышАть -> услышАвший\nобидЕть -> обидЕвший\nПравильный ответ - 4.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '4', true),
        (q_id, '1', false),
        (q_id, '2', false),
        (q_id, '3', false);

        -- Question 2 (Rus Var 1) - Multiple Choice (Gerund Formation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, 1, E'От какого глагола **нельзя** образовать деепричастие несовершенного вида?', E'Деепричастия несовершенного вида образуются от основы настоящего времени глаголов несовершенного вида с помощью суффикса -а (-я). Они обычно не образуются от глаголов на -чь (беречь), -нуть (мокнуть), и некоторых других (петь, ждать, писать - искл.).\nчитать -> читая\nгулять -> гуляя\nберечь -> (не образуется)\nсмотреть -> смотря\nПравильный ответ - 3.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'беречь', true),
        (q_id, 'читать', false),
        (q_id, 'гулять', false),
        (q_id, 'смотреть', false);

        -- Question 3 (Rus Var 1) - Multiple Choice (Adverb Spelling - Н/НН)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, 1, E'В каком наречии пишется НН?', E'В наречиях на -о/-е пишется столько же Н, сколько в прилагательном или причастии, от которого оно образовано.\nпутаНый -> путаНо\nмедлеННый -> медлеННо\nветреНый -> ветреНо (искл.)\nсеребряНый -> серебряНо (отымённое прил.)\nПравильный ответ - 2.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'медлен..о', true),
        (q_id, 'пута..о', false),
        (q_id, 'ветре..о', false),
        (q_id, 'серебря..о', false);

        -- Question 4 (Rus Var 1) - Multiple Choice (Preposition/Conjunction Distinction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, 1, E'В каком предложении выделенное слово является **предлогом**?', E'Предлоги служат для связи слов в словосочетании и предложении, часто употребляются с падежными формами существительных или местоимений. Союзы связывают однородные члены или части сложного предложения.\n1) **Чтобы** (союз цели) хорошо учиться, надо стараться.\n2) Я опоздал, **зато** (союз противительный = но) принес торт.\n3) Он говорил **насчет** (предлог = о) поездки.\n4) **Тоже** (союз присоединительный = и) хочу поехать.\nПравильный ответ - 3.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Он говорил **насчет** поездки.', true),
        (q_id, '**Чтобы** хорошо учиться, надо стараться.', false),
        (q_id, 'Я опоздал, **зато** принес торт.', false),
        (q_id, 'Я **тоже** хочу поехать.', false);

        -- Question 5 (Rus Var 1) - Free Response (Participle Identification)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, 1, E'Выпишите из предложения **причастие**: "Книга, прочитанная мной вчера, оказалась очень интересной."', E'Причастие - это особая форма глагола, которая обозначает признак предмета по действию и отвечает на вопросы какой? какая? какое? какие? В данном предложении слово "прочитанная" отвечает на вопрос "какая?", образовано от глагола "прочитать" и обозначает признак предмета (книга) по действию.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'прочитанная', true);

    ELSE
        RAISE NOTICE 'Subject "Русский язык" (7th Grade) not found. Skipping Variant 1.';
    END IF;

END $$;

-- =============================================
-- ===        SUBJECT: БИОЛОГИЯ (7 КЛАСС)     ===
-- =============================================

-- Ensure the subjects table exists and add the "Биология" entry for 7th grade
INSERT INTO public.subjects (name, description, grade_level) VALUES
('Биология', E'## ВПР по Биологии (7 класс)\n\nПогружаемся в удивительный **мир животных**! Изучаем их многообразие, строение, образ жизни и значение.\n\n**Основные разделы:**\n\n*   🐾 **Простейшие**, **Кишечнополостные**, **Черви** (плоские, круглые, кольчатые).\n*   🐚 **Моллюски**, **Членистоногие** (ракообразные, паукообразные, насекомые).\n*   🐟 **Хордовые**: Ланцетник. **Рыбы**.\n*   🐸 **Земноводные** (Амфибии).\n*   🐍 **Пресмыкающиеся** (Рептилии).\n*   🐦 **Птицы**.\n*    स्तनधारी **Млекопитающие**.\n\nУзнай больше о братьях наших меньших! 🐒', 7)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    grade_level = EXCLUDED.grade_level
WHERE public.subjects.grade_level != 7; -- Update only if it's not already the 7th grade entry

-- Clear existing Biology questions for 7th grade, variant 1 (for idempotency)
DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT q.id FROM public.vpr_questions q
    JOIN public.subjects s ON q.subject_id = s.id
    WHERE s.name = 'Биология' AND s.grade_level = 7 AND q.variant_number = 1
);
DELETE FROM public.vpr_questions WHERE subject_id = (
    SELECT id FROM public.subjects WHERE name = 'Биология' AND grade_level = 7
) AND variant_number = 1;

-- =============================================
-- === INSERT BIOLOGY 7th Grade, VARIANT 1 ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 7;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology (7th Grade) Variant 1...';

        -- Question 1 (Bio Var 1) - Multiple Choice (Classification - Insect)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'К какому классу относится майский жук?', E'Майский жук относится к классу Насекомые типа Членистоногие. Основные признаки насекомых: тело разделено на голову, грудь и брюшко, три пары ног на груди, обычно есть крылья.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Насекомые', true),
        (q_id, 'Паукообразные', false),
        (q_id, 'Ракообразные', false),
        (q_id, 'Млекопитающие', false);

        -- Question 2 (Bio Var 1) - Multiple Choice (Characteristic - Birds)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'Какой признак **характерен только** для птиц?', E'Перьевой покров - уникальный признак класса Птицы. Теплокровность есть и у млекопитающих, позвоночник - у всех хордовых, а яйца откладывают также рептилии, амфибии и некоторые другие.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Перьевой покров', true),
        (q_id, 'Теплокровность', false),
        (q_id, 'Наличие позвоночника', false),
        (q_id, 'Откладывание яиц', false);

        -- Question 3 (Bio Var 1) - Multiple Choice (Animal Group Feature)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'Для какого типа животных характерно наличие **раковины** (у большинства представителей)?', E'Раковина является характерным признаком большинства представителей типа Моллюски (например, у улиток, двустворчатых). У некоторых она редуцирована (слизни) или внутренняя (кальмары).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Моллюски', true),
        (q_id, 'Кишечнополостные', false),
        (q_id, 'Членистоногие', false),
        (q_id, 'Хордовые', false);

        -- Question 4 (Bio Var 1) - Multiple Choice (Amphibian Respiration)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'С помощью каких органов дышат **взрослые** лягушки?', E'Взрослые амфибии (лягушки) дышат с помощью легких и кожи. Личинки (головастики) дышат жабрами.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Легкие и кожа', true),
        (q_id, 'Только легкие', false),
        (q_id, 'Только жабры', false),
        (q_id, 'Только кожа', false);

        -- Question 5 (Bio Var 1) - Free Response (Mammal Feature)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, 1, E'Как называется главная отличительная особенность млекопитающих, связанная с выкармливанием детенышей?', E'Млекопитающие получили свое название из-за наличия у самок млечных желез, которыми они выкармливают своих детенышей молоком.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Выкармливание молоком', true),
        (q_id, 'Млечные железы', true),
        (q_id, 'Вскармливание молоком', true);

    ELSE
        RAISE NOTICE 'Subject "Биология" (7th Grade) not found. Skipping Variant 1.';
    END IF;

END $$;

-- =============================================
-- ===   SUBJECT: АНГЛИЙСКИЙ ЯЗЫК (7 КЛАСС)  ===
-- =============================================

-- Ensure the subjects table exists and add the "Английский язык" entry for 7th grade
INSERT INTO public.subjects (name, description, grade_level) VALUES
('Английский язык', E'## ВПР по Английскому языку (7 класс)\n\nУглубляем знания грамматики и расширяем словарный запас. Фокус на более сложных временах, пассивном залоге и косвенной речи.\n\n**Грамматика:**\n\n*   tense **Времена**: Past Simple / Continuous / Perfect, Present Perfect / Continuous, Future Simple.\n*   construction **Пассивный залог** (Present/Past Simple Passive).\n*   speech **Косвенная речь** (Statements).\n*   grammar **Условные предложения** (Type 1, Type 2 - introduction).\n*   grammar **Модальные глаголы** (should, might, could).\n*   grammar **Степени сравнения** (включая исключения).\n\n**Лексика:** Путешествия, окружающая среда, здоровье, технологии, известные люди.\n\nKeep practicing! 🚀', 7)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    grade_level = EXCLUDED.grade_level
WHERE public.subjects.grade_level != 7; -- Update only if it's not already the 7th grade entry

-- Clear existing English questions for 7th grade, variant 1 (for idempotency)
DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT q.id FROM public.vpr_questions q
    JOIN public.subjects s ON q.subject_id = s.id
    WHERE s.name = 'Английский язык' AND s.grade_level = 7 AND q.variant_number = 1
);
DELETE FROM public.vpr_questions WHERE subject_id = (
    SELECT id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 7
) AND variant_number = 1;

-- =============================================
-- === INSERT ENGLISH 7th Grade, VARIANT 1 ===
-- =============================================
DO $$
DECLARE
    subj_eng_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_eng_id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 7;

    IF subj_eng_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding English (7th Grade) Variant 1...';

        -- Question 1 (Eng Var 1) - Multiple Choice (Present Perfect)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct verb form: She ___ already ___ her homework.', E'Действие завершилось к настоящему моменту, важен результат (домашка сделана). Используем Present Perfect: have/has + V3 (третья форма глагола). Для "She" используется "has". "Do" - неправильный глагол, V3 - "done". Слово "already" часто используется с Present Perfect.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'has ... done', true),
        (q_id, 'have ... done', false),
        (q_id, 'did', false),
        (q_id, 'is ... doing', false);

        -- Question 2 (Eng Var 1) - Multiple Choice (Past Continuous)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct verb form: What ___ you ___ at 5 pm yesterday?', E'Вопрос о действии, которое происходило в конкретный момент в прошлом (at 5 pm yesterday). Используем Past Continuous: was/were + V-ing. Для "you" используется "were".', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'were ... doing', true),
        (q_id, 'did ... do', false),
        (q_id, 'was ... doing', false),
        (q_id, 'have ... done', false);

        -- Question 3 (Eng Var 1) - Multiple Choice (Passive Voice - Past Simple)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct verb form: This book ___ by a famous writer last year.', E'Подлежащее "This book" само не выполняло действие (его написали). Используем пассивный залог. Действие произошло в прошлом ("last year"), значит Past Simple Passive: was/were + V3. "Book" - единственное число, поэтому "was written". "Write" - неправильный глагол, V3 - "written".', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'was written', true),
        (q_id, 'wrote', false),
        (q_id, 'is written', false),
        (q_id, 'has written', false);

        -- Question 4 (Eng Var 1) - Multiple Choice (Modal Verb 'should')
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'Choose the correct modal verb: You look tired. You ___ go to bed earlier.', E'Модальный глагол "should" используется для выражения совета или рекомендации (тебе следует лечь спать раньше). "Must" - долженствование, "can" - возможность/умение, "might" - вероятность.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'should', true),
        (q_id, 'must', false),
        (q_id, 'can', false),
        (q_id, 'might', false);

        -- Question 5 (Eng Var 1) - Free Response (Vocabulary - Environment)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_eng_id, 1, E'What is the English word for "окружающая среда"?', E'Русское словосочетание "окружающая среда" переводится на английский язык как "environment".', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'environment', true);

    ELSE
        RAISE NOTICE 'Subject "Английский язык" (7th Grade) not found. Skipping Variant 1.';
    END IF;

END $$;

-- =============================================
-- ===    SUBJECT: ОБЩЕСТВОЗНАНИЕ (7 КЛАСС)   ===
-- =============================================

-- Ensure the subjects table exists and add the "Обществознание" entry for 7th grade
INSERT INTO public.subjects (name, description, grade_level) VALUES
('Обществознание', E'## ВПР по Обществознанию (7 класс)\n\nРазбираемся в **правилах**, по которым живет общество, и знакомимся с **основами экономики**.\n\n**Ключевые темы:**\n\n*   ⚖️ **Право**: правила поведения (нормы), виды норм (моральные, правовые). **Права ребенка**. Правонарушения (проступки, преступления) и **юридическая ответственность** несовершеннолетних.\n*   🧑‍🤝‍🧑 **Обмен, торговля, реклама**: как люди удовлетворяют потребности.\n*   💰 **Деньги**: функции денег. **Экономика семьи**: доходы, расходы, бюджет.\n*   🏭 **Производство**: что такое производство, затраты производителя.\n*   🌱 **Человек и природа**: влияние хозяйственной деятельности на природу.\n\nУзнаем, как устроен мир права и экономики! 🧭', 7)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    grade_level = EXCLUDED.grade_level
WHERE public.subjects.grade_level != 7; -- Update only if it's not already the 7th grade entry

-- Clear existing Social Studies questions for 7th grade, variant 1 (for idempotency)
DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT q.id FROM public.vpr_questions q
    JOIN public.subjects s ON q.subject_id = s.id
    WHERE s.name = 'Обществознание' AND s.grade_level = 7 AND q.variant_number = 1
);
DELETE FROM public.vpr_questions WHERE subject_id = (
    SELECT id FROM public.subjects WHERE name = 'Обществознание' AND grade_level = 7
) AND variant_number = 1;

-- ====================================================
-- === INSERT SOCIAL STUDIES 7th Grade, VARIANT 1 ===
-- ====================================================
DO $$
DECLARE
    subj_soc_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_soc_id FROM public.subjects WHERE name = 'Обществознание' AND grade_level = 7;

    IF subj_soc_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Social Studies (7th Grade) Variant 1...';

        -- Question 1 (Soc Var 1) - Multiple Choice (Types of Norms)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Какие правила поведения устанавливаются и охраняются государством?', E'Правовые нормы (законы) - это общеобязательные правила поведения, установленные или санкционированные государством и охраняемые его силой. Моральные нормы основаны на представлениях о добре и зле, обычаи - на привычке, религиозные - на вере.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Правовые нормы', true),
        (q_id, 'Моральные нормы', false),
        (q_id, 'Обычаи', false),
        (q_id, 'Религиозные нормы', false);

        -- Question 2 (Soc Var 1) - Multiple Choice (Child Rights)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Какое право ребенка закреплено в Конвенции о правах ребенка?', E'Конвенция о правах ребенка закрепляет множество прав, включая право на жизнь, имя, образование, защиту от насилия, свободу мысли и слова, право на отдых и досуг. Обязанность служить в армии возникает у граждан по достижении определенного возраста.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Право на образование', true),
        (q_id, 'Право управлять автомобилем', false),
        (q_id, 'Обязанность платить налоги', false),
        (q_id, 'Обязанность служить в армии', false);

        -- Question 3 (Soc Var 1) - Multiple Choice (Types of Offenses)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Как называется виновное, общественно опасное деяние, запрещенное Уголовным кодексом под угрозой наказания?', E'Преступление - это наиболее опасный вид правонарушения, посягающий на самые важные общественные отношения и запрещенный Уголовным кодексом. Проступок - менее опасное правонарушение (административное, дисциплинарное, гражданское).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Преступление', true),
        (q_id, 'Проступок', false),
        (q_id, 'Административное правонарушение', false),
        (q_id, 'Дисциплинарный проступок', false);

        -- Question 4 (Soc Var 1) - Multiple Choice (Economics - Budget)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Финансовый план семьи, сопоставляющий будущие доходы и расходы, называется:', E'Бюджет (семейный, государственный, личный) - это роспись (план) доходов и расходов на определенный период времени.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Семейный бюджет', true),
        (q_id, 'Семейные сбережения', false),
        (q_id, 'Семейные доходы', false),
        (q_id, 'Семейные расходы', false);

        -- Question 5 (Soc Var 1) - Free Response (Functions of Money)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_soc_id, 1, E'Назовите одну из функций денег в экономике.', E'Деньги выполняют несколько функций: мера стоимости (измерение ценности товаров), средство обращения (посредник в обмене), средство платежа (оплата долгов, налогов), средство накопления (сбережения), мировые деньги.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Мера стоимости', true),
        (q_id, 'Средство обращения', true),
        (q_id, 'Средство платежа', true),
        (q_id, 'Средство накопления', true),
        (q_id, 'Мировые деньги', true);

    ELSE
        RAISE NOTICE 'Subject "Обществознание" (7th Grade) not found. Skipping Variant 1.';
    END IF;

END $$;