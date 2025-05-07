-- ===================================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 10        ===
-- === (The Hilarious Edition - Even Funnier!)     ===
-- ===================================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 10; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 10 (The Hilarious Edition 2.0!)...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 10...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 10...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 10. Seeding new questions/answers...';

        -- Question 1 (Var 10) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В10): Почему нам (и клеткам) вообще нужно есть? Какие клеточные ''батарейки'' сжигают еду, чтобы дать нам энергию бегать и думать?', E'Объяснение к вопросу 1 (Био В10): Митохондрии! Это клеточные ''печки'', которые сжигают глюкозу (из еды) с кислородом, выделяя кучу энергии (АТФ). Без них мы бы были как телефон с севшей батарейкой - полная остановка!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Митохондрии', true);

        -- Question 2 (Var 10) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В10): У листа есть ''кожа'', которая защищает его от высыхания и повреждений. Как называется эта наружная ткань?', E'Объяснение к вопросу 2 (Био В10): Эпидермис (или кожица)! Это как прозрачная броня для листа. Она пропускает свет для фотосинтеза, но защищает нежные внутренние клетки от всяких неприятностей и потери воды.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Эпидермис (кожица)', true);

        -- Question 3 (Var 10) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В10): Кто из этих зверей имеет ''встроенный обогреватель'' и поддерживает постоянную температуру тела, даже когда холодно?', E'Объяснение к вопросу 3 (Био В10): Медведь! Он млекопитающее, а они теплокровные. У них есть внутренний ''термостат'', поддерживающий тепло. Ящерицы, лягушки и змеи - хладнокровные, им нужно греться на солнышке, как ленивым туристам.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ящерица прыткая', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Медведь бурый', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лягушка озерная', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Змея гадюка', false);

        -- Question 4 (Var 10) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В10): Некоторые растения - фокусники! Они могут вырасти из кусочка стебля или листа. Как называется такое ''клонирование'' без семян?', E'Объяснение к вопросу 4 (Био В10): Вегетативное размножение! Это когда новое растение вырастает из части старого (черенка, уса, клубня). Никаких цветов и семян не нужно - просто магия копирования!', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Вегетативное размножение', true);

        -- Question 5 (Var 10) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В10): Кто из этих животных - настоящий гурман, который ест и растительную пищу, и других животных? (Не привередливый!)', E'Объяснение к вопросу 5 (Био В10): Свинья! Она всеядна, то есть лопает и корешки с желудями, и червячков, и мелких грызунов. Корова - травоядная, волк - хищник, заяц - тоже травку любит. Свинья - чемпион по разнообразию меню!', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Корова', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Волк', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Свинья', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Заяц', false);

        -- Question 6 (Var 10) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В10): Из какого прочного материала, похожего на ''броню'' насекомых, сделаны клеточные стенки у грибов?', E'Объяснение к вопросу 6 (Био В10): Хитин! Да-да, тот же самый материал, из которого сделан панцирь у жуков и крабов. Грибы решили, что это отличная штука для прочности их клеток. У растений - целлюлоза, а у грибов - хитин.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Хитин', true);

        -- Question 7 (Var 10) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В10): Растения ''вдыхают'' углекислый газ для фотосинтеза. А какой газ они постоянно ''выдыхают'' при дыхании (как и мы)?', E'Объяснение к вопросу 7 (Био В10): Углекислый газ! Растения тоже дышат круглосуточно, чтобы получать энергию. При дыхании они поглощают кислород, а выделяют углекислый газ. Фотосинтез (с поглощением CO₂ и выделением O₂) идет только на свету!', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Углекислый газ (CO₂)', true);

        -- Question 8 (Var 10) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В10): Какая система органов работает как ''вешалка'' и ''каркас'' для нашего тела, а еще защищает важные органы?', E'Объяснение к вопросу 8 (Био В10): Скелет! Это наша опора и защита. Без костей мы были бы похожи на бесформенные мешки. А еще он защищает мозг (череп) и сердце с легкими (грудная клетка).', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Пищеварительная система', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Дыхательная система', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Нервная система', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Скелет (опорно-двигательная система)', true); -- Correct answer is D

        -- Question 9 (Var 10) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В10): Как называется такой тип ''дружбы'', когда один организм (паразит) живет на другом (хозяине) и пьет его кровь или соки, нагло вредя?', E'Объяснение к вопросу 9 (Био В10): Паразитизм! Это когда один живет за счет другого и даже не говорит ''спасибо''. Клещ на собаке, гриб-трутовик на дереве, аскарида в кишечнике - все это примеры наглых паразитов.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Паразитизм', true);

        -- Question 10 (Var 10) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В10): Кто из этих ребят НЕ входит в ''клуб позвоночных'', то есть не имеет костного позвоночника?', E'Объяснение к вопросу 10 (Био В10): Дождевой червь! Рыбы, птицы и млекопитающие (как кошка) - это позвоночные, у них есть позвоночник. А черви, насекомые, моллюски - беспозвоночные, у них нет такой крутой костяной опоры.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Карась (рыба)', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Воробей (птица)', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Дождевой червь', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Домашняя кошка (млекопитающее)', false);

        -- Question 11 (Var 10) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В10): Как называется вся полужидкая ''начинка'' клетки, в которой плавают ядро и другие органоиды, как фрикадельки в супе?', E'Объяснение к вопросу 11 (Био В10): Цитоплазма! Это как ''бульон'' клетки, где происходят все важные химические реакции и где живут и работают все клеточные органоиды.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Цитоплазма', true);

        -- Question 12 (Var 10) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В10): Почему важно, чтобы на Земле было много РАЗНЫХ видов растений и животных (биоразнообразие)?', E'Объяснение к вопросу 12 (Био В10): Чем больше разных видов, тем устойчивее природа! Это как строить дом из разных кирпичиков - если один тип подведет, другие помогут. Разнообразие делает экосистемы сильными, помогает им приспосабливаться и дает нам кучу полезных штук (еду, лекарства, чистый воздух). Скучно жить в мире, где все одинаковые!', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Чтобы было не так скучно смотреть', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Чтобы природа была устойчивее и полезнее для нас', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Чтобы было сложнее их всех посчитать', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Животным нравится соревноваться друг с другом', false);

        -- Question 13 (Var 10) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В10): Как называются специальные ткани в стебле растения, работающие как 'трубопровод' для воды и питательных веществ?', E'Объяснение к вопросу 13 (Био В10): Проводящие ткани! Это как водопровод (ксилема - вода вверх) и канализация (флоэма - сахара вниз) для растения. Они обеспечивают транспорт всего необходимого по стеблю.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Проводящие ткани (ксилема и флоэма)', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 10 (The Hilarious Edition 2.0!).';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 10.';
    END IF;
END $$;