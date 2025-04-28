-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 4   ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 4; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 4...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 4...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 4...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 4. Seeding new questions/answers...';

        -- Question 1 (Var 4) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В4): Листья растений — это не просто 'зеленые ладошки'. Какую СУПЕР-ВАЖНУЮ работу они выполняют, используя солнечный свет?', E'Объяснение к вопросу 1 (Био В4): Именно в листьях происходит волшебство фотосинтеза! Здесь из углекислого газа и воды, с помощью энергии солнца, создается пища для всего растения (глюкоза) и выделяется кислород, которым мы дышим.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Фотосинтез', true);

        -- Question 2 (Var 4) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В4): В растительной клетке есть огромный 'склад', заполненный жидкостью. Как он называется и зачем нужен?', E'Объяснение к вопросу 2 (Био В4): Этот 'склад' - большая центральная вакуоль. Она запасает воду, питательные вещества, а иногда и ненужные клетке продукты. Вакуоль помогает поддерживать форму клетки, как надутый шарик!', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Вакуоль (с клеточным соком)', true);

        -- Question 3 (Var 4) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В4): Представь себе пищевую цепочку: Трава -> Кузнечик -> Лягушка -> Уж. Кто здесь является консументом ВТОРОГО порядка?', E'Объяснение к вопросу 3 (Био В4): Консумент I порядка ест продуцента (кузнечик ест траву). Консумент II порядка ест консумента I порядка. Значит, лягушка, съевшая кузнечика, - консумент II порядка.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Трава', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кузнечик', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лягушка', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Уж', false);

        -- Question 4 (Var 4) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В4): Эти крошечные организмы могут быть и полезными (например, в йогурте), и вредными (вызывать болезни). У них нет ядра. Кто это?', E'Объяснение к вопросу 4 (Био В4): Речь идет о бактериях! Это одноклеточные прокариоты (безъядерные). Кисломолочные бактерии помогают делать йогурт, а болезнетворные могут вызвать ангину.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бактерии', true);

        -- Question 5 (Var 4) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В4): Что из перечисленного НЕ является обязательным условием для фотосинтеза?', E'Объяснение к вопросу 5 (Био В4): Для фотосинтеза нужны: свет (энергия), вода (из почвы), углекислый газ (из воздуха) и хлорофилл (в клетках). Кислород же является ПРОДУКТОМ фотосинтеза, а не условием.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Свет', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Вода', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Углекислый газ', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кислород', true); -- Correct answer is D

        -- Question 6 (Var 4) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В4): Как называется наука, которая изучает взаимоотношения живых организмов между собой и с окружающей средой?', E'Объяснение к вопросу 6 (Био В4): Экология - это наука о 'доме' для всех живых существ, о том, как они уживаются вместе и как на них влияет неживая природа (свет, вода, температура).', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Экология', true);

        -- Question 7 (Var 4) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В4): Плод яблони - яблоко. А как называется сам процесс образования плодов и семян после опыления?', E'Объяснение к вопросу 7 (Био В4): После того как пыльца попала на пестик (опыление), происходит слияние половых клеток - это и есть оплодотворение. Именно оно запускает развитие плода и семян внутри него.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Оплодотворение', true);

        -- Question 8 (Var 4) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В4): Грибы - удивительные организмы! Чем их питание принципиально отличается от питания растений?', E'Объяснение к вопросу 8 (Био В4): Растения - автотрофы, они сами создают себе пищу (фотосинтез). А грибы - гетеротрофы, они, как и животные, поглощают готовые органические вещества из окружающей среды (например, из почвы или мертвых деревьев).', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Они дышат кислородом', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Они поглощают готовые органические вещества', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Они имеют клеточное строение', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Они размножаются спорами', false);

        -- Question 9 (Var 4) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В4): Какой орган нашего тела работает как насос, перекачивая кровь по всему организму?', E'Объяснение к вопросу 9 (Био В4): Сердце - это неутомимый мышечный насос, который заставляет кровь двигаться по сосудам, доставляя кислород и питательные вещества ко всем клеткам.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Сердце', true);

        -- Question 10 (Var 4) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В4): Какая часть клетки является 'командным центром', управляющим всеми процессами и хранящим наследственную информацию?', E'Объяснение к вопросу 10 (Био В4): Ядро - это 'мозг' клетки (у эукариот). Оно содержит ДНК с 'инструкциями' для жизни и управляет всеми клеточными процессами.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ядро', true); -- Correct answer is A
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Хлоропласт', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Клеточная мембрана', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Вакуоль', false);

        -- Question 11 (Var 4) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В4): Из чего в основном состоит твердая клеточная стенка растений, придающая им прочность?', E'Объяснение к вопросу 11 (Био В4): Клеточная стенка растений построена в основном из целлюлозы (клетчатки). Это прочное вещество, которое служит опорой для растительных клеток.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Целлюлоза (клетчатка)', true);

        -- Question 12 (Var 4) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В4): Паук сплел паутину. К какому классу животных он относится?', E'Объяснение к вопросу 12 (Био В4): Пауки - это не насекомые! У них восемь ног (а не шесть, как у насекомых), и они относятся к классу Паукообразные.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Насекомые', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Млекопитающие', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Паукообразные', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Птицы', false);

        -- Question 13 (Var 4) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В4): Как одним словом назвать все факторы неживой природы, влияющие на организмы (свет, температура, влажность)?', E'Объяснение к вопросу 13 (Био В4): Факторы неживой природы называют абиотическими. Они очень важны для жизни организмов, определяя, где они могут жить.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Абиотические факторы', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 4.';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 4.';
    END IF;
END $$;


-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 5   ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 5; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 5...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 5...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 5...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 5. Seeding new questions/answers...';

        -- Question 1 (Var 5) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В5): Представь, что клетка - это город. Какая структура работает как 'городская стена с воротами', контролируя, что входит и выходит?', E'Объяснение к вопросу 1 (Био В5): Это клеточная (плазматическая) мембрана! Она окружает клетку и избирательно пропускает нужные вещества внутрь, а ненужные выпускает наружу. Настоящий 'фейс-контроль' клетки!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Клеточная мембрана (плазматическая мембрана)', true);

        -- Question 2 (Var 5) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В5): Как называется процесс, когда растения 'пьют' воду корнями и 'выдыхают' ее через мельчайшие отверстия в листьях?', E'Объяснение к вопросу 2 (Био В5): Этот процесс называется транспирация. Испаряя воду, растение охлаждается (как мы потеем) и создает тягу, которая помогает воде подниматься от корней к листьям.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Транспирация', true);

        -- Question 3 (Var 5) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В5): Какое из этих животных является травоядным (консументом I порядка)?', E'Объяснение к вопросу 3 (Био В5): Травоядные животные питаются растениями (продуцентами). Волк и лиса - хищники (консументы II или III порядка). Дождевой червь питается перегноем (ближе к редуцентам/детритофагам). Корова ест траву - она травоядная.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Волк', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Корова', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лиса', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Дождевой червь', false);

        -- Question 4 (Var 5) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В5): Какой тип размножения НЕ требует участия двух родительских особей и приводит к появлению точных копий?', E'Объяснение к вопросу 4 (Био В5): Бесполое размножение (например, деление бактерий, почкование дрожжей, размножение растений черенками) происходит с участием одной особи и потомство генетически идентично родителю.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бесполое размножение', true);

        -- Question 5 (Var 5) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В5): Что является ГЛАВНЫМ продуктом фотосинтеза, который растение использует как пищу?', E'Объяснение к вопросу 5 (Био В5): Хотя кислород - важный побочный продукт фотосинтеза, главная цель этого процесса для растения - создать органическое вещество, сахар (глюкозу), который служит ему пищей и строительным материалом.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кислород', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Вода', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Глюкоза (сахар)', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Углекислый газ', false);

        -- Question 6 (Var 5) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В5): Эта наука изучает грибы - ни растения, ни животные. Как она называется?', E'Объяснение к вопросу 6 (Био В5): Микология - это раздел биологии, посвященный изучению грибов во всем их разнообразии: от плесени и дрожжей до огромных лесных грибов.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Микология', true);

        -- Question 7 (Var 5) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В5): Как называются организмы, которые разлагают мертвые остатки растений и животных, возвращая вещества в почву?', E'Объяснение к вопросу 7 (Био В5): Это 'санитары' природы - редуценты (или разрушители), в основном бактерии и грибы. Они разлагают сложную органику до простых неорганических веществ, которые снова могут использовать растения.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Редуценты (разрушители)', true);
        -- You could also accept 'Сапротрофы' here
        -- INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Сапротрофы', true);

        -- Question 8 (Var 5) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В5): Какая часть цветка защищает бутон до его раскрытия?', E'Объяснение к вопросу 8 (Био В5): Чашелистики - это обычно зеленые листочки у основания цветка, образующие чашечку. Их главная задача - защищать нежные части цветка, пока он еще в бутоне.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лепестки', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Тычинки', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Пестик', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Чашелистики', true); -- Correct answer is D

        -- Question 9 (Var 5) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В5): Какой орган чувств позволяет нам ощущать запахи?', E'Объяснение к вопросу 9 (Био В5): Орган обоняния, расположенный в носовой полости, улавливает молекулы пахучих веществ в воздухе и передает сигналы в мозг, позволяя нам различать запахи.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Орган обоняния (нос)', true);

        -- Question 10 (Var 5) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В5): Все живые организмы состоят из...? ', E'Объяснение к вопросу 10 (Био В5): Клетка - это фундаментальная единица всего живого! Будь то бактерия, гриб, растение или животное - все они состоят из одной или многих клеток.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Тканей', false); // Не все организмы имеют ткани
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Органов', false); // Не все организмы имеют органы
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Клеток', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Молекул', false); // Все состоит из молекул, но не только живое

        -- Question 11 (Var 5) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В5): Корень, стебель, лист - это органы растения, отвечающие за его питание и рост. Как их называют одним общим термином?', E'Объяснение к вопросу 11 (Био В5): Эти органы обеспечивают основные жизненные функции растения (кроме размножения), поэтому их называют вегетативными.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Вегетативные органы', true);

        -- Question 12 (Var 5) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В5): Какое царство живых организмов НЕ содержит хлорофилла и питается готовыми органическими веществами?', E'Объяснение к вопросу 12 (Био В5): И грибы, и животные питаются готовой органикой (гетеротрофы) и не имеют хлорофилла. Но вопрос спрашивает про ЦАРСТВО, к которому это относится в целом. Растения имеют хлорофилл, бактерии - разнообразны. Грибы - целое царство гетеротрофов без хлорофилла.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Растения', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Грибы', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бактерии', false); // Некоторые бактерии фотосинтезируют
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Животные', false); // Тоже подходит, но Грибы - более четкий ответ как царство с этим признаком

        -- Question 13 (Var 5) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В5): Как называется структура семени, из которой при прорастании развивается новое растение?', E'Объяснение к вопросу 13 (Био В5): Зародыш - это 'мини-растение' внутри семени, содержащее зачатки корня, стебля и листьев. Именно из него и развивается взрослый организм.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Зародыш', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 5.';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 5.';
    END IF;
END $$;


-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 6   ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 6; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 6...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 6...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 6...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 6. Seeding new questions/answers...';

        -- Question 1 (Var 6) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В6): В клетках есть 'энергетические станции', которые вырабатывают энергию для жизни. Как они называются?', E'Объяснение к вопросу 1 (Био В6): Митохондрии - это настоящие 'электростанции' клетки! В них происходит клеточное дыхание: сжигание питательных веществ с помощью кислорода для получения энергии в виде АТФ.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Митохондрии', true);

        -- Question 2 (Var 6) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В6): Какой орган растения служит ему опорой и 'лифтом', доставляющим воду вверх, а питательные вещества вниз?', E'Объяснение к вопросу 2 (Био В6): Стебель! Он не только держит листья и цветы, но и содержит специальные 'трубочки' (проводящие ткани), по которым, как по лифту, движутся вода и растворенные в ней вещества.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Стебель', true);

        -- Question 3 (Var 6) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В6): К какой группе организмов относится плесень, вырастающая на хлебе?', E'Объяснение к вопросу 3 (Био В6): Плесень (например, мукор или пеницилл) - это микроскопические грибы. Они питаются готовой органикой, разлагая ее.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бактерии', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Растения', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Грибы', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Животные', false);

        -- Question 4 (Var 6) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В6): Как называется союз гриба и корней дерева, выгодный обоим?', E'Объяснение к вопросу 4 (Био В6): Это микориза ('грибокорень'). Гриб помогает дереву всасывать воду и минералы, а дерево делится с грибом органическими веществами, созданными при фотосинтезе. Дружба!', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Микориза', true);

        -- Question 5 (Var 6) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В6): Растения дышат. Какой газ они при этом поглощают?', E'Объяснение к вопросу 5 (Био В6): Не путай с фотосинтезом! При дыхании, как и мы, растения поглощают кислород (O₂) для получения энергии, а выделяют углекислый газ (CO₂). Дыхание идет постоянно!', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Углекислый газ', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кислород', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Азот', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Водяной пар', false);

        -- Question 6 (Var 6) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В6): Как называется основная часть гриба, состоящая из тонких нитей и обычно скрытая в почве или древесине?', E'Объяснение к вопросу 6 (Био В6): Это грибница, или мицелий. То, что мы собираем в лесу (шляпка и ножка) - это лишь плодовое тело для размножения, а 'настоящий' гриб - это его грибница.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Грибница (мицелий)', true);

        -- Question 7 (Var 6) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В6): Как называется способность живых организмов воспроизводить себе подобных?', E'Объяснение к вопросу 7 (Био В6): Размножение - одно из ключевых свойств живого, обеспечивающее продолжение жизни вида во времени.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Размножение', true);

        -- Question 8 (Var 6) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В6): Чем клетка животного ОТЛИЧАЕТСЯ от клетки бактерии?', E'Объяснение к вопросу 8 (Био В6): Главное отличие: у животной клетки (как и у растений, грибов) есть оформленное ядро, где хранится ДНК. У бактерий ядра нет, ДНК лежит прямо в цитоплазме (они прокариоты). Мембрана и цитоплазма есть у всех клеток.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Наличием клеточной мембраны', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Наличием цитоплазмы', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Наличием оформленного ядра', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Отсутствием клеточной стенки', false); // У бактерий стенка есть, но другая

        -- Question 9 (Var 6) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В6): Как называют животных, которые охотятся на других животных?', E'Объяснение к вопросу 9 (Био В6): Хищники - это консументы второго, третьего и т.д. порядков, которые получают энергию, поедая других животных (свою добычу).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Хищники', true);

        -- Question 10 (Var 6) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В6): Какой из этих организмов одноклеточный?', E'Объяснение к вопросу 10 (Био В6): Ромашка и мухомор - многоклеточные. Дождевой червь - многоклеточное животное. Амеба - классический пример одноклеточного животного (простейшего).', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ромашка', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Мухомор', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Дождевой червь', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Амеба', true); -- Correct answer is D

        -- Question 11 (Var 6) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В6): Как называется наука, изучающая животных?', E'Объяснение к вопросу 11 (Био В6): Зоология ('зоо' - животное, 'логос' - наука) - раздел биологии, который исследует мир животных, их строение, жизнь и разнообразие.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Зоология', true);

        -- Question 12 (Var 6) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В6): Что из перечисленного является примером ПОЛОЖИТЕЛЬНОГО влияния человека на природу?', E'Объяснение к вопросу 12 (Био В6): Вырубка лесов, свалки и загрязнение рек - это негативное влияние. А создание заповедников помогает сохранить природу и редкие виды - это положительное действие.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Вырубка лесов', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Создание заповедников', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Образование свалок', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Загрязнение рек', false);

        -- Question 13 (Var 6) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В6): Как называется жидкое содержимое клетки, в котором 'плавают' все органоиды?', E'Объяснение к вопросу 13 (Био В6): Цитоплазма - это внутренняя полужидкая среда клетки, заполняющая пространство между ядром и мембраной. В ней происходят многие химические реакции и находятся все клеточные структуры.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Цитоплазма', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 6.';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 6.';
    END IF;
END $$;


-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 7   ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 7; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 7...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 7...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 7...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 7. Seeding new questions/answers...';

        -- Question 1 (Var 7) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В7): У растений есть 'солнечные батареи' - зеленые органоиды, где происходит фотосинтез. Как они называются?', E'Объяснение к вопросу 1 (Био В7): Это хлоропласты! Именно они содержат зеленый пигмент хлорофилл, который улавливает энергию солнечного света, необходимую для создания пищи.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Хлоропласты', true);

        -- Question 2 (Var 7) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В7): Какой орган растения отвечает за его закрепление в почве и поглощение воды?', E'Объяснение к вопросу 2 (Био В7): Корень работает как якорь, удерживая растение на месте, и как насос, всасывая воду и растворенные в ней минеральные соли из почвы.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Корень', true);

        -- Question 3 (Var 7) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В7): Инфузория-туфелька активно плавает в воде с помощью ресничек. К какому царству живых организмов она относится?', E'Объяснение к вопросу 3 (Био В7): Инфузория-туфелька - это одноклеточное, но подвижное существо, питающееся готовой органикой. Она относится к царству Животные (подцарство Простейшие).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Животные', true); -- Correct answer is A
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Растения', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Грибы', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бактерии', false);

        -- Question 4 (Var 7) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В7): Как называется сообщество живых организмов и среды их обитания, связанных круговоротом веществ?', E'Объяснение к вопросу 4 (Био В7): Экосистема (или биогеоценоз) - это 'команда' из растений, животных, грибов, бактерий и неживой природы (свет, вода, почва), живущих вместе и влияющих друг на друга.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Экосистема (биогеоценоз)', true);

        -- Question 5 (Var 7) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В7): Какое вещество придает зеленый цвет листьям растений и участвует в улавливании света?', E'Объяснение к вопросу 5 (Био В7): Хлорофилл - это тот самый зеленый пигмент в хлоропластах, который 'ловит' солнечные лучи, давая старт процессу фотосинтеза.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Крахмал', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Целлюлоза', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Хлорофилл', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Гемоглобин', false); // У животных, в крови

        -- Question 6 (Var 7) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В7): Как называют организмы, которые сами создают органические вещества из неорганических, используя свет или химическую энергию?', E'Объяснение к вопросу 6 (Био В7): Автотрофы ('самопитающиеся') - это 'производители' в экосистемах. В основном это растения (фотосинтез), но бывают и бактерии (хемосинтез). Они - основа всех пищевых цепей.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Автотрофы', true);
        -- You could also accept 'Продуценты' here
        -- INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Продуценты', true);

        -- Question 7 (Var 7) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В7): Какой процесс обеспечивает распространение семян растений с помощью ветра, воды или животных?', E'Объяснение к вопросу 7 (Био В7): Расселение (или распространение) семян очень важно для растений, чтобы 'завоевывать' новые территории. Для этого у семян и плодов есть разные приспособления: 'крылышки' (клен), 'парашютики' (одуванчик), крючки (репейник), сочная мякоть (яблоко).', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Распространение (расселение) семян', true);

        -- Question 8 (Var 7) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В7): Какой из этих органов НЕ относится к пищеварительной системе человека?', E'Объяснение к вопросу 8 (Био В7): Желудок, кишечник и печень участвуют в переваривании пищи. Легкие же относятся к дыхательной системе, они отвечают за газообмен.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Желудок', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кишечник', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Легкие', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Печень', false); // Участвует в пищеварении (выработка желчи)

        -- Question 9 (Var 7) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В7): Как называется орган цветкового растения, из которого после оплодотворения развивается плод?', E'Объяснение к вопросу 9 (Био В7): Плод развивается из завязи пестика. Стенки завязи разрастаются и превращаются в околоплодник, а внутри находятся семена.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Завязь (пестика)', true);

        -- Question 10 (Var 7) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В7): Какая группа организмов размножается простым делением клетки надвое?', E'Объяснение к вопросу 10 (Био В7): Простое деление надвое - характерный и очень быстрый способ размножения для бактерий.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Грибы', false); // Могут спорами, почкованием
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Растения', false); // Семенами, вегетативно
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Животные', false); // Обычно половое
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бактерии', true); -- Correct answer is D

        -- Question 11 (Var 7) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В7): Как называется самый верхний, плодородный слой почвы, богатый перегноем?', E'Объяснение к вопросу 11 (Био В7): Гумусовый слой (или горизонт А) - это 'кладовая' почвы, темный слой, богатый органическими веществами (гумусом или перегноем), которые образуются при разложении остатков растений и животных. Он самый плодородный.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Гумусовый слой (гумус, перегной)', true);

        -- Question 12 (Var 7) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В7): У какого организма НЕТ клеточной стенки?', E'Объяснение к вопросу 12 (Био В7): У растений клеточная стенка из целлюлозы, у грибов - из хитина, у бактерий - из муреина. А вот у животных клеток жесткой клеточной стенки нет, только гибкая мембрана.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Дуб (растение)', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Мухомор (гриб)', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Заяц (животное)', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кишечная палочка (бактерия)', false);

        -- Question 13 (Var 7) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В7): Как называется ответная реакция организма на раздражение, осуществляемая с участием нервной системы?', E'Объяснение к вопросу 13 (Био В7): Рефлекс - это наша автоматическая реакция на что-либо (например, отдернуть руку от горячего). Он происходит быстро, благодаря работе нервной системы.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Рефлекс', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 7.';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 7.';
    END IF;
END $$;


-- =============================================
-- === INSERT BIOLOGY 6th Grade, VARIANT 8   ===
-- =============================================
DO $$
DECLARE
    subj_bio_id INT;
    q_id INT;
    variant_num INT := 8; -- Set variant number for this block
BEGIN
    -- Find the subject ID for Biology, 6th Grade
    SELECT id INTO subj_bio_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 6;

    IF subj_bio_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology Grade 6, Variant 8...';

        -- Clean up existing data for this specific variant first
        RAISE NOTICE 'Deleting existing answers for Biology Grade 6, Variant 8...';
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num);
        RAISE NOTICE 'Deleting existing questions for Biology Grade 6, Variant 8...';
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_id AND variant_number = variant_num;
        RAISE NOTICE 'Deletion complete for Variant 8. Seeding new questions/answers...';

        -- Question 1 (Var 8) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 1 (Био В8): Внутри ядра клетки находится 'молекула жизни', хранящая всю наследственную информацию. Как она называется?', E'Объяснение к вопросу 1 (Био В8): Это знаменитая ДНК (дезоксирибонуклеиновая кислота)! В ней, как в книге, записана вся информация о строении и функциях организма, которая передается от родителей к детям.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'ДНК (дезоксирибонуклеиновая кислота)', true);

        -- Question 2 (Var 8) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 2 (Био В8): Как называется орган растения, отвечающий за половое размножение и образование плодов и семян?', E'Объяснение к вопросу 2 (Био В8): Цветок - это не только для красоты! Его главная задача - обеспечить размножение растения. Именно в цветке происходит опыление и оплодотворение, после чего образуются плоды с семенами.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Цветок', true);

        -- Question 3 (Var 8) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 3 (Био В8): Какой тип питания характерен для большинства животных?', E'Объяснение к вопросу 3 (Био В8): Животные не могут сами создавать органические вещества, как растения. Они получают их, поедая другие организмы (растения или других животных). Такой тип питания называется гетеротрофным.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Автотрофный', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Гетеротрофный', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Фотосинтез', false); // Это процесс, а не тип питания
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Хемосинтез', false); // У некоторых бактерий

        -- Question 4 (Var 8) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 4 (Био В8): Как называются мельчайшие отверстия на поверхности листа, через которые происходит газообмен и испарение воды?', E'Объяснение к вопросу 4 (Био В8): Устьица - это крошечные 'дверцы' на листе, которые могут открываться и закрываться. Через них внутрь листа поступает углекислый газ для фотосинтеза, а наружу выходят кислород и водяной пар (при транспирации).', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Устьица', true);

        -- Question 5 (Var 8) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 5 (Био В8): Что из перечисленного является примером БЕСПОЛОГО размножения?', E'Объяснение к вопросу 5 (Био В8): Образование семян и спор - это результат полового или бесполого (у грибов/растений) размножения, но сам процесс часто сложный. Оплодотворение - ключевой этап полового размножения. А вот деление клетки надвое (как у бактерий) - классический пример бесполого размножения, когда из одной клетки получаются две копии.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Образование семян у яблони', false); // Половое
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Деление клетки бактерии', true); -- Correct answer is B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Оплодотворение у лягушки', false); // Половое
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Образование спор у папоротника', false); // Споры - результат сложного цикла

        -- Question 6 (Var 8) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 6 (Био В8): Эта группа организмов включает мхи, папоротники, хвойные и цветковые. Как называется это царство?', E'Объяснение к вопросу 6 (Био В8): Все перечисленные группы - мхи, папоротники, хвойные (голосеменные) и цветковые (покрытосеменные) - относятся к царству Растения. Они многоклеточные и почти все способны к фотосинтезу.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Растения', true);

        -- Question 7 (Var 8) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 7 (Био В8): Как называется орган дыхания у рыб, позволяющий им 'дышать' под водой?', E'Объяснение к вопросу 7 (Био В8): Рыбы дышат кислородом, растворенным в воде, с помощью жабр. Вода омывает жаберные лепестки, богатые кровеносными сосудами, где и происходит газообмен.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Жабры', true);

        -- Question 8 (Var 8) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 8 (Био В8): Какая структура клетки ОТСУТСТВУЕТ у бактерий?', E'Объяснение к вопросу 8 (Био В8): У бактерий есть клеточная стенка, мембрана и цитоплазма. А вот оформленного ядра, окруженного оболочкой, у них нет - они прокариоты.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Клеточная стенка', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Цитоплазма', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Клеточная мембрана', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ядро', true); -- Correct answer is D

        -- Question 9 (Var 8) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 9 (Био В8): В пищевой цепи: планктон -> рыбка -> чайка. Кто здесь продуцент?', E'Объяснение к вопросу 9 (Био В8): Продуценты - это те, кто создает органику из неорганики, обычно путем фотосинтеза. В воде эту роль часто выполняет фитопланктон (микроскопические водоросли). Рыбка и чайка - консументы.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Планктон (фитопланктон)', true);

        -- Question 10 (Var 8) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 10 (Био В8): Какой из этих грибов съедобен?', E'Объяснение к вопросу 10 (Био В8): Мухомор и бледная поганка - смертельно ядовиты! Пеницилл - это плесень (хотя из него делают лекарство). А вот белый гриб (боровик) - ценный съедобный гриб.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Мухомор красный', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Бледная поганка', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Белый гриб (боровик)', true); -- Correct answer is C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Пеницилл', false);

        -- Question 11 (Var 8) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 11 (Био В8): Как называется наука о строении и функциях клеток?', E'Объяснение к вопросу 11 (Био В8): Цитология ('цитос' - клетка, 'логос' - наука) изучает клетки - 'кирпичики', из которых построено все живое.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Цитология', true);

        -- Question 12 (Var 8) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 12 (Био В8): Что из перечисленного является тканью?', E'Объяснение к вопросу 12 (Био В8): Клетка - это основа. Орган (лист, сердце) состоит из тканей. Организм - целое существо. А вот эпителиальная ткань (кожа, выстилка органов) - это группа клеток схожего строения и функций.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Нервная клетка', false); // Клетка
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Лист клена', false); // Орган
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Эпителиальная', true); -- Correct answer is C (имеется в виду эпителиальная ткань)
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Человек', false); // Организм

        -- Question 13 (Var 8) - Free Response
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_id, variant_num, E'Вопрос 13 (Био В8): Как называется тип взаимоотношений, когда один организм (паразит) живет за счет другого (хозяина), причиняя ему вред?', E'Объяснение к вопросу 13 (Био В8): Паразитизм - это когда один 'нахлебник' живет на или внутри другого организма, питается его соками или тканями и вредит ему. Примеры: блохи на собаке, гриб-трутовик на дереве.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Паразитизм', true);

        RAISE NOTICE 'Finished seeding Biology Grade 6, Variant 8.';
    ELSE
        RAISE NOTICE 'Subject "Биология" Grade 6 not found. Skipping Variant 8.';
    END IF;
END $$;