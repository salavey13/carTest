-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 9   ===
-- === (The Hilarious Edition!)              ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 9; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 9 (The Hilarious Edition!)...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 9...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 9...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 9. Seeding new questions/answers...';

        -- Question 1 (Var 9) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В9): Представь, что растение решило ''попить''. Какой его орган зароется в землю и начнет всасывать воду, как через трубочку?', E'Объяснение к вопросу 1 (Био В9): Это корень! Он не только держит растение, чтобы оно не улетело при сильном ветре, но и работает как супер-насос, добывая воду и минеральные ''вкусняшки'' из почвы. Без корня растение ждет грустная и сухая участь!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Корень', true);

        -- Question 2 (Var 9) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В9): В клетках растений есть зеленые штуковины, которые ловят солнечные лучи и готовят еду. Прямо шеф-повара! Как их зовут?', E'Объяснение к вопросу 2 (Био В9): Хлоропласты! Эти ребята содержат хлорофилл (зеленый краситель) и устраивают фотосинтез-вечеринку, превращая свет, воду и углекислый газ в сахарную энергию. Спасибо им за кислород!', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Хлоропласты', true);

        -- Question 3 (Var 9) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В9): Кто из этих ребят относится к Царству Грибов? Подсказка: один из них помогает делать хлеб пышным, как облачко!', E'Объяснение к вопросу 3 (Био В9): Дрожжи! Эти одноклеточные грибы - мастера брожения. Они кушают сахар и ''пукают'' углекислым газом, отчего тесто поднимается. Кишечная палочка - бактерия, амеба - простейшее (животное), ромашка - растение.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кишечная палочка', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Амеба обыкновенная', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ромашка аптечная', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Дрожжи пекарские', true); -- Correct answer is D

        -- Question 4 (Var 9) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В9): Как называется процесс, когда пыльца с одного цветка перелетает на другой? Типа, цветочки ''переписываются''?', E'Объяснение к вопросу 4 (Био В9): Опыление! Это когда пыльца (мужские клетки) путешествует (с помощью ветра, пчел или других курьеров) к пестику (женская часть) другого цветка. Так начинается создание семян.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Опыление', true);

        -- Question 5 (Var 9) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В9): Растения для фотосинтеза жадно ''вдыхают'' один газ из воздуха. Какой? (Не тот, которым мы дышим!)', E'Объяснение к вопросу 5 (Био В9): Углекислый газ (CO₂)! Растения используют его как строительный материал для создания сахаров. Кислород они, наоборот, ''выдыхают'' как приятный бонус для нас.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кислород (O₂)', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Азот (N₂)', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Углекислый газ (CO₂)', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Газ для смеха (N₂O)', false);

        -- Question 6 (Var 9) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В9): Как размножаются бактерии? Быстро, просто и без заморочек!', E'Объяснение к вопросу 6 (Био В9): Делением надвое! Одна бактерия просто делится пополам, и вуаля - их уже две! Поэтому они могут размножаться с невероятной скоростью, если условия хорошие.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Делением надвое (пополам)', true);

        -- Question 7 (Var 9) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В9): Когда растение ''потеет'', испаряя воду через листья, как это называется по-научному?', E'Объяснение к вопросу 7 (Био В9): Транспирация! Звучит сложно, но это просто испарение воды растением. Помогает охладиться и тянуть воду от корней вверх. Типа, природный кондиционер и водопровод в одном флаконе.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Транспирация', true);

        -- Question 8 (Var 9) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В9): Что ОБЯЗАТЕЛЬНО есть у любого взрослого насекомого, чтобы бегать или ползать?', E'Объяснение к вопросу 8 (Био В9): Шесть ног! Это их фирменный знак. Три пары ножек. У пауков восемь, у многоножек - много, а у насекомых - ровно шесть. Запомни!', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Жало, чтобы больно кусаться', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Шесть (3 пары) ног', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Восемь глаз, чтобы все видеть', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Крылья, чтобы летать (не у всех!)', false);

        -- Question 9 (Var 9) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В9): Как зовут тех, кто сам себе готовит еду из неорганики (типа растений)? Самостоятельные ребята!', E'Объяснение к вопросу 9 (Био В9): Автотрофы! ''Авто'' - значит сам, ''трофос'' - питание. Они сами себе шеф-повара, готовят органику из воздуха, воды и света. Основа жизни!', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Автотрофы', true);
        -- INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Продуценты', true); -- Тоже верно

        -- Question 10 (Var 9) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В9): Где в клетке находится 'главный офис' с ДНК-инструкциями по сборке всего организма?', E'Объяснение к вопросу 10 (Био В9): В ядре! Это как сейф с самыми важными чертежами (ДНК). Ядро командует парадом в клетке (у эукариот, конечно. Бактерии держат ДНК без сейфа).', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'В митохондрии (''электростанции'')', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'В хлоропласте (''кухне'')', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'В ядре (''командном центре'')', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'В буфете (вакуоли)', false);

        -- Question 11 (Var 9) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В9): Какой орган помогает нам дышать, надуваясь и сдуваясь, как воздушный шарик?', E'Объяснение к вопросу 11 (Био В9): Легкие! Эта парочка воздушных мешков в нашей груди отвечает за то, чтобы мы получали живительный кислород и избавлялись от ненужного углекислого газа.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Легкие', true);

        -- Question 12 (Var 9) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В9): У кого из этих организмов НЕТ ядра в клетке? (Настоящие ''панки'' клеточного мира!)', E'Объяснение к вопросу 12 (Био В9): Бактерии! Они прокариоты, что значит ''доядерные''. У них нет мембранного ядра, ДНК просто плавает в цитоплазме. У грибов, растений и животных ядро есть (они эукариоты).', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'У гриба-шампиньона', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'У березы плакучей', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'У кота Матроскина', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'У бактерии кишечной палочки', true); -- Correct answer is D

        -- Question 13 (Var 9) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В9): Как называется удивительный ''бутерброд'' из гриба и водоросли, живущих вместе душа в душу?', E'Объяснение к вопросу 13 (Био В9): Лишайник! Это классический пример симбиоза. Гриб дает водоросли дом и воду, а водоросль кормит гриб сахарами, которые делает на свету. Настоящая команда!', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лишайник', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 9 (The Hilarious Edition!).';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 9.';
    END IF;
END $$;