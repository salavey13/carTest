-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 2   ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 2; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 2...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 2...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 2...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 2. Seeding new questions/answers...';

        -- Question 1 (Var 2) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В2): Какая часть растения отвечает за поглощение воды и минеральных солей из почвы?', E'Объяснение к вопросу 1 (Био В2): Корень закрепляет растение и всасывает воду с растворенными в ней минеральными веществами.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Корень', true);

        -- Question 2 (Var 2) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В2): Как называется зеленый пигмент в клетках растений, участвующий в фотосинтезе?', E'Объяснение к вопросу 2 (Био В2): Хлорофилл придает растениям зеленый цвет и улавливает солнечный свет для фотосинтеза.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Хлорофилл', true);

        -- Question 3 (Var 2) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В2): К какому царству живых организмов относятся дрожжи?', E'Объяснение к вопросу 3 (Био В2): Дрожжи - это одноклеточные грибы.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Грибы', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бактерии', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Растения', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Животные', false);

        -- Question 4 (Var 2) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В2): Как называется процесс переноса пыльцы с тычинок на рыльце пестика?', E'Объяснение к вопросу 4 (Био В2): Опыление необходимо для последующего оплодотворения и образования семян.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Опыление', true);

        -- Question 5 (Var 2) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В2): Какой газ необходим растениям для процесса фотосинтеза?', E'Объяснение к вопросу 5 (Био В2): Растения поглощают углекислый газ из атмосферы для создания органических веществ на свету.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Углекислый газ', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кислород', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Азот', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Водород', false);

        -- Question 6 (Var 2) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В2): Как называется основной способ размножения бактерий?', E'Объяснение к вопросу 6 (Био В2): Бактерии размножаются очень быстро путем простого деления клетки надвое.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Деление надвое', true);

        -- Question 7 (Var 2) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В2): Как называется процесс испарения воды листьями растений?', E'Объяснение к вопросу 7 (Био В2): Транспирация - испарение воды растением, в основном через устьица на листьях.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Транспирация', true);

        -- Question 8 (Var 2) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В2): Какой признак характерен для всех насекомых?', E'Объяснение к вопросу 8 (Био В2): Все взрослые насекомые имеют три пары ног (шесть ног).', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Шесть ног', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Восемь ног', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Наличие позвоночника', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Покрытие перьями', false);

        -- Question 9 (Var 2) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В2): Как называют организмы, которые сами производят органические вещества из неорганических (например, растения)?', E'Объяснение к вопросу 9 (Био В2): Автотрофы (продуценты) - основа пищевых цепей, создающие органику.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Автотрофы', true);
        -- You could add 'Продуценты' as another correct answer if needed
        -- INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Продуценты', true);

        -- Question 10 (Var 2) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В2): Какая клеточная структура отвечает за хранение наследственной информации?', E'Объяснение к вопросу 10 (Био В2): Ядро содержит хромосомы с ДНК, где закодирована наследственная информация.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ядро', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Митохондрия', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Цитоплазма', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Клеточная мембрана', false);

        -- Question 11 (Var 2) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В2): Назовите основной орган дыхания человека.', E'Объяснение к вопросу 11 (Био В2): Газообмен у человека происходит в легких.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Легкие', true);

        -- Question 12 (Var 2) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В2): Какая группа организмов НЕ имеет оформленного ядра в своих клетках?', E'Объяснение к вопросу 12 (Био В2): Бактерии относятся к прокариотам, у них нет ядра, наследственный материал находится в цитоплазме.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бактерии', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Грибы', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Растения', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Животные', false);

        -- Question 13 (Var 2) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В2): Как называется симбиоз гриба и водоросли?', E'Объяснение к вопросу 13 (Био В2): Лишайник представляет собой комплексный организм, состоящий из гриба (микобионт) и водоросли или цианобактерии (фотобионт).', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лишайник', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 2.';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 2.';
    END IF;
END $$;


-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 3   ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 3; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 3...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 3...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 3...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 3. Seeding new questions/answers...';

        -- Question 1 (Var 3) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В3): Какая часть цветка обычно ярко окрашена для привлечения опылителей?', E'Объяснение к вопросу 1 (Био В3): Лепестки венчика часто имеют яркую окраску и аромат для привлечения насекомых или других опылителей.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лепестки (венчик)', true);

        -- Question 2 (Var 3) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В3): Назовите органоиды клетки, отвечающие за клеточное дыхание и выработку энергии.', E'Объяснение к вопросу 2 (Био В3): Митохондрии - "энергетические станции" клетки, где происходит окисление органических веществ и синтез АТФ.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Митохондрии', true);

        -- Question 3 (Var 3) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В3): Как называется наука, изучающая растения?', E'Объяснение к вопросу 3 (Био В3): Ботаника - раздел биологии, посвященный изучению растений.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ботаника', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Зоология', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Микология', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Экология', false);

        -- Question 4 (Var 3) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В3): Как называется тип питания организмов, использующих готовые органические вещества?', E'Объяснение к вопросу 4 (Био В3): Гетеротрофы (животные, грибы, большинство бактерий) питаются готовыми органическими веществами.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Гетеротрофный', true);

        -- Question 5 (Var 3) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В3): Какой орган растения обеспечивает транспорт воды и питательных веществ между корнями и листьями?', E'Объяснение к вопросу 5 (Био В3): Стебель содержит проводящие ткани (ксилему и флоэму) для транспорта веществ и обеспечивает опору.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Стебель', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лист', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Корень', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Цветок', false);

        -- Question 6 (Var 3) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В3): Из каких двух основных частей состоит плодовое тело шляпочного гриба?', E'Объяснение к вопросу 6 (Био В3): Видимая часть шляпочного гриба (плодовое тело) состоит из ножки и шляпки.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ножка и шляпка', true);

        -- Question 7 (Var 3) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В3): Как называется процесс слияния мужской и женской половых клеток?', E'Объяснение к вопросу 7 (Био В3): Оплодотворение - процесс слияния гамет с образованием зиготы.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Оплодотворение', true);

        -- Question 8 (Var 3) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В3): Какая структура НЕ характерна для животной клетки, но есть у растительной?', E'Объяснение к вопросу 8 (Био В3): Клеточная стенка из целлюлозы - характерный признак растительных клеток, отсутствует у животных.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Клеточная стенка', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ядро', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Митохондрия', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Цитоплазматическая мембрана', false);

        -- Question 9 (Var 3) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В3): Как называют организмы, питающиеся мертвыми органическими остатками?', E'Объяснение к вопросу 9 (Био В3): Сапротрофы (редуценты), такие как многие грибы и бактерии, разлагают мертвую органику.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Сапротрофы', true);
        -- You could add 'Редуценты' as another correct answer if needed
        -- INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Редуценты', true);

        -- Question 10 (Var 3) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В3): Какой из этих организмов используется в хлебопечении?', E'Объяснение к вопросу 10 (Био В3): Пекарские дрожжи (грибы) вызывают брожение с выделением углекислого газа, что поднимает тесто.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Дрожжи', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Пеницилл', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Мукор', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кишечная палочка', false);

        -- Question 11 (Var 3) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В3): Назовите процесс развития организма из зиготы.', E'Объяснение к вопросу 11 (Био В3): Индивидуальное развитие организма от оплодотворения до смерти называется онтогенезом.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Онтогенез', true);

        -- Question 12 (Var 3) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В3): Какой орган чувств у человека отвечает за восприятие звука?', E'Объяснение к вопросу 12 (Био В3): Орган слуха (ухо) воспринимает звуковые колебания.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Орган слуха (ухо)', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Орган зрения (глаз)', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Орган обоняния (нос)', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Орган вкуса (язык)', false);

        -- Question 13 (Var 3) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В3): Как называется защитная оболочка бактериальной клетки, расположенная снаружи клеточной мембраны?', E'Объяснение к вопросу 13 (Био В3): Большинство бактерий имеют прочную клеточную стенку (обычно из муреина), которая придает форму и защищает клетку.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Клеточная стенка', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 3.';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 3.';
    END IF;
END $$;