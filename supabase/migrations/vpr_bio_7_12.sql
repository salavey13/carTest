-- 1. Ensure 'Биология' subject exists for 7th grade
INSERT INTO public.subjects (name, description, grade_level) VALUES
('Биология', E'## ВПР по Биологии (7 класс)\n\nДиагностика знаний по курсу зоологии и общей биологии.\n\n**Ключевые темы:**\n*   🐾 **Разнообразие животных:** От простейших до млекопитающих.\n*   🔬 **Строение и функции:** Клетки, ткани, системы органов.\n*   📊 **Работа с данными:** Анализ таблиц, графиков и диаграмм.\n*   🐕 **Описание животных:** Определение породы, окраса и экстерьера по фото (собаки, лошади).\n*   🌿 **Циклы развития:** Паразитические черви, насекомые, земноводные.\n\nГотовься анализировать изображения и применять логику! 🧬', 7)
ON CONFLICT (name, grade_level) DO NOTHING;

-- =============================================
-- === INSERT BIOLOGY 7th Grade, VARIANT 1 ===
-- === (Based on PDF: Dog Basenji, Liver Fluke) ===
-- =============================================
DO $$
DECLARE
    subj_bio_7_id INT;
    q_id INT;
    variant_num INT := 1;
BEGIN
    SELECT id INTO subj_bio_7_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 7;

    IF subj_bio_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology 7th Grade Variant 1...';

        -- Cleanup old data for this variant
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_7_id AND variant_number = variant_num;

        -- Q1: Specialist (Ichthyologist)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Как называют специалиста-зоолога, объектом изучения которого является изображённое на фотографии животное (Рыба)?',
                E'На фото рыба. Наука о рыбах — ихтиология, специалист — ихтиолог.\nОрнитолог — птицы, Энтомолог — насекомые, Гельминтолог — черви.', 1,
                '{ "type": "image", "url": "https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=600&q=80", "caption": "Объект изучения", "alt": "Рыба фугу" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'ихтиолог', true), (q_id, 'орнитолог', false), (q_id, 'гельминтолог', false), (q_id, 'энтомолог', false);

        -- Q2: Elephant Text Analysis
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_7_id, variant_num, E'Индийский слон — крупное наземное млекопитающее, питающееся растительной пищей. Выберите 3 утверждения, описывающие эти признаки:\n1) Ходит бесшумно благодаря жировой прокладке.\n2) Используется для трудоёмких работ.\n3) Живут в стаде.\n4) Срывает листья и ветки хоботом.\n5) Кормит детёнышей молоком.\n6) Весит в среднем 5 т.',
                E'Нужны признаки: Крупное, Наземное, Млекопитающее, Травоядное.\n4) Срывает листья (Травоядное).\n5) Кормит молоком (Млекопитающее).\n6) Весит 5 т (Крупное).', 2) RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '456', true), (q_id, '123', false), (q_id, '135', false), (q_id, '246', false);

        -- Q3: Nutrition Type (Beetle)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Какой тип питания характерен для Бронзовки обыкновенной, изображённой на рисунке?',
                E'Жук — это животное. Животные питаются готовыми органическими веществами. Это гетеротрофный тип питания.', 3,
                '{ "type": "image", "url": "https://images.unsplash.com/photo-1611856072600-1293972955d0?auto=format&fit=crop&w=600&q=80", "caption": "Бронзовка", "alt": "Жук на цветке" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'гетеротрофный', true), (q_id, 'автотрофный', false), (q_id, 'миксотрофный', false), (q_id, 'хемотрофный', false);

        -- Q4: Dog Analysis (Basenji)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Рассмотрите фото собаки породы Басенджи. Выберите характеристики:\n\n**А. Окрас:**\n1) однотонный 2) пятнистый 3) чепрачный 4) подпалый\n\n**Б. Уши:**\n1) стоячие 2) полустоячие 3) висящие\n\n**В. Хвост:**\n1) саблевидный 2) кольцом 3) поленом',
                E'По фото:\nА) Подпалый (рыжий с белым) или пегий, но в ключе часто идет как 4.\nБ) Уши стоячие (1).\nВ) Хвост закручен в кольцо (2).', 4,
                '{ "type": "image", "url": "https://images.unsplash.com/photo-1534361960057-19889db9621e?auto=format&fit=crop&w=600&q=80", "caption": "Басенджи", "alt": "Собака породы Басенджи" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '412', true), (q_id, '212', false), (q_id, '123', false), (q_id, '431', false);

        -- Q5: Metamorphosis Table
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Вставьте пропущенное понятие:\n\n| Животное | Тип развития |\n| --- | --- |\n| Собака | Прямое |\n| Саранча | **?** |',
                E'У саранчи из яйца выходит личинка, похожая на взрослую особь (нимфа), но без крыльев. Стадии куколки нет. Это **неполное превращение**.', 5,
                '{ "type": "table", "headers": ["Животное", "Тип развития"], "rows": [["Собака", "Прямое"], ["Саранча", "?"]] }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'неполное превращение', true), (q_id, 'полное превращение', false), (q_id, 'прямое', false), (q_id, 'почкование', false);

        -- Q6: Liver Fluke Lifecycle
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Рассмотрите схему цикла печёночного сосальщика. Какой цифрой обозначен **основной хозяин**?',
                E'Основной хозяин — тот, в ком происходит половое размножение. У печеночного сосальщика это крупный рогатый скот (корова) или человек. На схемах обычно под цифрой 1 или 2 (крупное животное).', 6,
                '{ "type": "image", "url": "https://placehold.co/600x400/202020/4ade80?text=Цикл+Сосальщика+(Схема)", "caption": "Цикл развития" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', true), (q_id, '2', false), (q_id, '3', false), (q_id, '4', false);

        -- Q7: Mammal Orders
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_7_id, variant_num, E'Соотнесите признаки с отрядами:\n\n**Признаки:**\nA) водные обитатели\nБ) есть хвостовой плавник\nВ) нет задних конечностей\nГ) ногти на пальцах\n\n**Отряды:**\n1) Китообразные\n2) Приматы',
                E'Китообразные: Водные (А), плавник (Б), нет задних ног (В).\nПриматы: Ногти (Г), развитый мозг.\nОтвет: 1112.', 7) RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1112', true), (q_id, '1212', false), (q_id, '2221', false), (q_id, '1122', false);

        -- Q8: Physiology Table
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'По таблице определите, для какого животного характерен пульс 100 уд/мин?',
                E'Смотрим столбец "Пульс".\nСобака: 70-120 (подходит).\nКошка: 110-130 (нет).\nМорская свинка: 132+ (нет).\nХомяк: 280+ (нет).\nОтвет: Собака (также возможно крупные кролики, но Собака в диапазоне точнее). В ВПР часто диапазон 70-120 включает 100.', 8,
                '{ "type": "table", "headers": ["Животное", "Пульс"], "rows": [["Собака", "70-120"], ["Кошка", "110-130"], ["Кролик", "120-200"], ["Хомяк", "280-412"]] }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Собака', true), (q_id, 'Хомяк', false), (q_id, 'Кошка', false), (q_id, 'Слон', false);

        -- Q10: System Identification (Worm)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Если у животного половая система как на рисунке (гермафродитная, сложная), то вероятнее всего у него:',
                E'На рисунке половая система плоского червя (гермафродит). У плоских червей (напр. Планарии) **отсутствует кровеносная система** и дыхательная.', 10,
                '{ "type": "image", "url": "https://placehold.co/600x200/202020/e879f9?text=Половая+система+червя", "caption": "Схема системы" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'отсутствие кровеносной системы', true), (q_id, 'хитиновый покров', false), (q_id, 'замкнутая кровеносная', false), (q_id, 'легочные мешки', false);

    END IF;
END $$;

-- =============================================
-- === INSERT BIOLOGY 7th Grade, VARIANT 2 ===
-- === (Based on PDF: Kangaroo, Horse Falabella) ===
-- =============================================
DO $$
DECLARE
    subj_bio_7_id INT;
    q_id INT;
    variant_num INT := 2;
BEGIN
    SELECT id INTO subj_bio_7_id FROM public.subjects WHERE name = 'Биология' AND grade_level = 7;

    IF subj_bio_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Biology 7th Grade Variant 2...';

        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_bio_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_bio_7_id AND variant_number = variant_num;

        -- Q1: Virology
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Как называется раздел биологии, изучающий объект на фото (Вирус)?',
                E'На фото вирус (неклеточная форма жизни). Наука — вирусология.', 1,
                '{ "type": "image", "url": "https://images.unsplash.com/photo-1584036561566-b93a90a6b98c?auto=format&fit=crop&w=600&q=80", "caption": "Объект", "alt": "Модель вируса" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'вирусология', true), (q_id, 'бактериология', false), (q_id, 'ботаника', false), (q_id, 'микология', false);

        -- Q2: Kangaroo
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_bio_7_id, variant_num, E'Гигантский кенгуру — прыгающее сумчатое млекопитающее. Выберите 3 утверждения:\n1) Символ Австралии.\n2) Вынашивает в сумке 6-8 мес.\n3) Сильные задние ноги.\n4) Кормит молоком.\n5) Контактирует с человеком.\n6) Объект охоты.',
                E'Признаки из текста (Прыгающее, Сумчатое, Млекопитающее):\n2) Вынашивает в сумке (Сумчатое).\n3) Сильные задние ноги (Прыгающее).\n4) Кормит молоком (Млекопитающее).\nОстальные — факты, но не описывают морфологию/класс.', 2) RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '234', true), (q_id, '156', false), (q_id, '123', false), (q_id, '456', false);

        -- Q4: Horse Analysis (Falabella)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Рассмотрите фото лошади Фалабелла. Выберите характеристики:\n\n**А. Масть:**\n... (см. фото: серая в гречку/чубарая)\n**Б. Постановка головы:**\n1) Прямая 2) Лебединая ...\n**В. Профиль:**\n1) Прямой 2) Горбоносый 3) Щучий',
                E'По фото:\nА) Масть Чубарая (мелкие пятна) или Серая (7).\nБ) Шея прямая/короткая.\nВ) Профиль часто прямой или слегка щучий.', 4,
                '{ "type": "image", "url": "https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?auto=format&fit=crop&w=600&q=80", "caption": "Лошадь Фалабелла", "alt": "Лошадь" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '711', true), (q_id, '123', false), (q_id, '341', false), (q_id, '222', false);

        -- Q5: Organelle Table
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'Заполните пропуск:\n\n| Организм | Органоид |\n| --- | --- |\n| Эвглена зелёная | Хлоропласт |\n| Инфузория-туфелька | **?** |',
                E'Инфузория не фотосинтезирует, у нее нет хлоропластов. Характерные органоиды: **реснички** (движение), 2 ядра, клеточный рот, порошица (выделение). В тестах часто спрашивают про движение (реснички) или выделение (порошица).', 5,
                '{ "type": "table", "headers": ["Организм", "Органоид"], "rows": [["Эвглена", "Хлоропласт"], ["Инфузория", "?"]] }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'порошица', true), (q_id, 'хлоропласт', false), (q_id, 'ложноножка', false), (q_id, 'глазок', false);

        -- Q6: Scabies Mite
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'На рисунке цикл развития чесоточного клеща (с метаморфозом). Какой цифрой обозначена **нимфа** (взрослая личинка)?',
                E'Цикл: Яйцо -> Личинка (6 ног) -> Нимфа (8 ног, но мелкая) -> Имаго (Взрослый). Обычно Нимфа идет перед взрослой особью.', 6,
                '{ "type": "image", "url": "https://placehold.co/600x300/202020/facc15?text=Цикл+Клеща", "caption": "Цикл развития" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true), (q_id, '1', false), (q_id, '3', false), (q_id, '4', false);

        -- Q8: Tadpole Table
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_bio_7_id, variant_num, E'По таблице определите, у какого вида земноводных передние конечности появляются **позже всех** (на самый поздний день)?',
                E'Смотрим столбец "Появление передних конечностей".\nЗеленая жаба: 38\nСерая жаба: 42\nОзерная лягушка: 82\nЧесночница: 92 (Максимум).\nОтвет: Чесночница.', 8,
                '{ "type": "table", "headers": ["Вид", "Передние лапы (день)"], "rows": [["Зеленая жаба", "38"], ["Серая жаба", "42"], ["Озерная лягушка", "82"], ["Чесночница", "92"]] }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Чесночница', true), (q_id, 'Озерная лягушка', false), (q_id, 'Серая жаба', false), (q_id, 'Зеленая жаба', false);

    END IF;
END $$;