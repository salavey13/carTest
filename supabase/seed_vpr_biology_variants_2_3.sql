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

        -- Question 1 (Var 2) - Diagram Labeling (Plant Cell)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Рассмотрите изображение растительной клетки. Подпишите структуры, обозначенные цифрами 1 (центр), 2 (зеленые овалы) и 3 (крупный пузырь).\n\n[Изображение: Растительная клетка Вар 2 с цифрами 1,2,3]', E'Назовите указанные органоиды или части клетки. Вспомните основные компоненты растительной клетки: ядро (управляет клеткой), хлоропласты (фотосинтез), вакуоль (запас воды).', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Ядро, Хлоропласт, Вакуоль', true),
        (q_id, 'Ядро, Митохондрия, Вакуоль', false),
        (q_id, 'Клеточная стенка, Цитоплазма, Ядро', false);

        -- Question 2 (Var 2) - Multiple Choice (Photosynthesis)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Какой газ необходим растениям для фотосинтеза?\n1) Кислород\n2) Азот\n3) Углекислый газ\n4) Водород', E'Выберите один правильный ответ. Вспомните, что растения поглощают из воздуха для создания органических веществ на свету.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '3', true),
        (q_id, '1', false),
        (q_id, '2', false);

        -- Question 3 (Var 2) - Matching (Animal Kingdom Classification)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Установите соответствие между животным и классом, к которому оно относится.\n\nЖИВОТНОЕ:\nА) Лягушка\nБ) Воробей\nВ) Акула\n\nКЛАСС:\n1) Птицы\n2) Земноводные\n3) Рыбы\n4) Млекопитающие', E'Сопоставьте каждое животное с его классом. Лягушки живут и в воде, и на суше (амфибии). Воробьи имеют перья. Акулы дышат жабрами. Запишите последовательность цифр.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '213', true), -- А-2, Б-1, В-3
        (q_id, '123', false),
        (q_id, '231', false),
        (q_id, '413', false);

        -- Question 4 (Var 2) - Short Answer (Function of Roots)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Какую основную функцию выполняют корни растения?', E'Напишите краткий ответ. Подумайте, что растение получает из почвы и как оно там держится.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Всасывание воды и минеральных солей', true),
        (q_id, 'Фотосинтез', false),
        (q_id, 'Опора и удержание в почве', false), -- Это тоже функция, но всасывание - основная
        (q_id, 'Размножение', false);

        -- Question 5 (Var 2) - True/False Statements (Human Anatomy)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Выберите верные утверждения о кровеносной системе человека:\n1) Сердце человека состоит из трех камер.\n2) Артерии несут кровь от сердца к органам.\n3) Венозная кровь всегда течет по венам.\n4) Кровь состоит из плазмы и форменных элементов.', E'Выберите номера верных утверждений. Вспомните строение сердца (4 камеры), направление тока крови (артерии - от сердца), что венозная кровь может быть и в артериях (малый круг), и состав крови.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '24', true), -- или 2, 4
        (q_id, '2', false),
        (q_id, '4', false),
        (q_id, '13', false);

        -- Question 6 (Var 2) - Diagram Analysis (Food Web)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Рассмотрите схему пищевой цепи: Трава -> Кузнечик -> Лягушка -> Змея. Назовите консумента второго порядка.\n\n[Изображение: Пищевая цепь Вар 2]', E'Определите организм, занимающий указанный трофический уровень. Трава - продуцент. Кузнечик - консумент I порядка (ест траву). Кто ест кузнечика?', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Лягушка', true),
        (q_id, 'Кузнечик', false),
        (q_id, 'Змея', false),
        (q_id, 'Трава', false);

        -- Question 7 (Var 2) - Fill-in-the-Blanks (Plant Reproduction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Процесс слияния мужской и женской половых клеток у растений называется _______.', E'Вставьте пропущенное слово. Это ключевой этап полового размножения, приводящий к образованию зиготы.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'оплодотворение', true),
        (q_id, 'опыление', false),
        (q_id, 'размножение', false),
        (q_id, 'фотосинтез', false);

        -- Question 8 (Var 2) - Comparison (Bacteria vs Virus)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Назовите одно основное отличие бактерий от вирусов по строению.', E'Укажите ключевое различие в организации. Являются ли вирусы клетками?', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Бактерии имеют клеточное строение, вирусы - нет', true),
        (q_id, 'Вирусы меньше бактерий', false), -- Это правда, но не отличие по строению
        (q_id, 'У бактерий есть ядро, у вирусов нет', false), -- У бактерий нет оформленного ядра
        (q_id, 'Бактерии вызывают болезни, вирусы - нет', false); -- Оба могут вызывать болезни

        -- Question 9 (Var 2) - Short Explanation (Adaptation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Почему белый медведь имеет белую окраску шерсти? Объясните.', E'Дайте краткое объяснение адаптивного значения признака. Подумайте, как цвет помогает ему в заснеженной среде обитания.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Для маскировки во время охоты и от врагов', true),
        (q_id, 'Для сохранения тепла', false),
        (q_id, 'Для красоты', false),
        (q_id, 'Это признак вида', false); -- Не объясняет причину

        -- Question 10 (Var 2) - Problem Solving/Application (Health)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Назовите два правила гигиены, которые необходимо соблюдать для профилактики кишечных инфекций.', E'Перечислите 2 правила. Подумайте, как микробы попадают в кишечник (с едой, водой, через грязные руки).', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Мыть руки перед едой; Мыть овощи и фрукты', true),
        (q_id, 'Чистить зубы; Принимать душ', false),
        (q_id, 'Пить только кипяченую воду; Есть горячую пищу', false), -- Второе не всегда обязательно
        (q_id, 'Мыть руки после туалета; Проветривать комнату', false); -- Второе не связано с кишечными инфекциями

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

        -- Question 1 (Var 3) - Diagram Labeling (Animal Cell)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Рассмотрите изображение животной клетки. Подпишите структуры, обозначенные цифрами 1 (центр), 2 (оболочка) и 3 (содержимое).\n\n[Изображение: Животная клетка Вар 3 с цифрами 1,2,3]', E'Назовите указанные части клетки. Вспомните основные компоненты животной клетки: ядро, клеточная мембрана, цитоплазма.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Ядро, Клеточная мембрана, Цитоплазма', true),
        (q_id, 'Ядро, Клеточная стенка, Цитоплазма', false), -- У животных нет клеточной стенки
        (q_id, 'Митохондрия, Мембрана, Вакуоль', false),
        (q_id, 'Ядро, Цитоплазма, Мембрана', false); -- Порядок важен, если цифры указаны

        -- Question 2 (Var 3) - Multiple Choice (Respiration)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Какой процесс обеспечивает живые организмы энергией за счет расщепления органических веществ с участием кислорода?\n1) Фотосинтез\n2) Дыхание\n3) Питание\n4) Размножение', E'Выберите один правильный ответ. Этот процесс происходит постоянно во всех живых клетках для получения энергии.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '2', true),
        (q_id, '1', false),
        (q_id, '3', false);

        -- Question 3 (Var 3) - Matching (Plant Organs and Functions)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Установите соответствие между органом растения и его основной функцией.\n\nОРГАН РАСТЕНИЯ:\nА) Лист\nБ) Стебель\nВ) Цветок\n\nФУНКЦИЯ:\n1) Опора, транспорт веществ\n2) Половое размножение\n3) Фотосинтез, транспирация\n4) Всасывание воды', E'Сопоставьте каждый орган с его функцией. Лист - "фабрика" пищи, стебель - "дорога", цветок - для семян. Запишите последовательность цифр.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '312', true), -- А-3, Б-1, В-2
        (q_id, '123', false),
        (q_id, '321', false),
        (q_id, '412', false);

        -- Question 4 (Var 3) - Short Answer (Definition)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Что такое экосистема?', E'Дайте краткое определение. Укажите основные компоненты: живые организмы (биоценоз) и факторы неживой природы (биотоп), связанные между собой.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Совокупность живых организмов и среды их обитания', true),
        (q_id, 'Место, где живут животные', false),
        (q_id, 'Все растения на одной территории', false),
        (q_id, 'Пищевая цепь', false);

        -- Question 5 (Var 3) - True/False Statements (Classification - Fungi)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Выберите верные утверждения о грибах:\n1) Грибы являются автотрофами.\n2) Клеточная стенка грибов содержит хитин.\n3) Грибы размножаются только спорами.\n4) Дрожжи - это многоклеточные грибы.', E'Выберите номера верных утверждений. Вспомните, как питаются грибы (гетеротрофы), из чего их клеточная стенка, способы размножения и примеры грибов (дрожжи - одноклеточные).', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '2', true),
        (q_id, '12', false),
        (q_id, '23', false),
        (q_id, '4', false);

        -- Question 6 (Var 3) - Diagram Analysis (Heart Structure)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Рассмотрите схему строения сердца человека. Какой цифрой обозначен отдел, из которого кровь поступает в аорту?\n\n[Изображение: Строение сердца Вар 3 с цифрами 1-4]', E'Определите камеру сердца, выбрасывающую кровь в большой круг кровообращения (аорта). Это самая мощная камера сердца.', 6)
        RETURNING id INTO q_id;
        -- Assuming 4 is Left Ventricle
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '4', true), -- Левый желудочек
        (q_id, '3', false), -- Левое предсердие
        (q_id, '2', false), -- Правый желудочек
        (q_id, '1', false); -- Правое предсердие

        -- Question 7 (Var 3) - Fill-in-the-Blanks (Evolution)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Процесс выживания и размножения наиболее приспособленных к данным условиям среды особей называется естественным _______.', E'Вставьте пропущенное слово. Это основной механизм эволюции по Дарвину.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'отбором', true),
        (q_id, 'отбором', true), -- Duplicate to allow different case/ending if needed
        (q_id, 'размножением', false),
        (q_id, 'приспособлением', false),
        (q_id, 'отклонением', false);

        -- Question 8 (Var 3) - Comparison (Plant vs Animal Cell)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Назовите две структуры, которые есть в типичной растительной клетке, но отсутствуют в животной.', E'Укажите два отличительных признака растительной клетки, связанных с питанием и опорой.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Клеточная стенка и хлоропласты', true),
        (q_id, 'Ядро и митохондрии', false), -- Есть в обеих
        (q_id, 'Клеточная стенка и ядро', false),
        (q_id, 'Хлоропласты и мембрана', false);

        -- Question 9 (Var 3) - Short Explanation (Symbiosis Example)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Приведите пример симбиоза и кратко объясните, в чем польза для каждого из организмов.', E'Опишите пример взаимовыгодного сожительства организмов. Например, лишайник (гриб + водоросль) или микориза (гриб + корень дерева).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Лишайник: гриб дает воду, водоросль - органику', true),
        (q_id, 'Волк и заяц: хищник и жертва', false), -- Это хищничество
        (q_id, 'Блоха и собака: паразит и хозяин', false), -- Это паразитизм
        (q_id, 'Дерево и трава под ним', false); -- Это конкуренция или нейтрализм

        -- Question 10 (Var 3) - Problem Solving/Application (Ecology)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Почему нельзя сжигать сухую траву весной вблизи леса или поля? Назовите два опасных последствия.', E'Подумайте о вреде для живых организмов и опасности распространения огня.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Гибель мелких животных и насекомых; Опасность лесного пожара', true),
        (q_id, 'Удобрение почвы золой; Улучшение видимости', false), -- Первое спорно, второе не главное
        (q_id, 'Уничтожение сорняков; Загрязнение воздуха дымом', false), -- Загрязнение - да, но гибель важнее
        (q_id, 'Нарушение закона; Создание шума', false);

    ELSE
        RAISE NOTICE 'Subject "Биология" (Grade 7) not found. Skipping Variant 3.';
    END IF;
END $$;