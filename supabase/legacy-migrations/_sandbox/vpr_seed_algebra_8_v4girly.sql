DO $$
DECLARE
    subj_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_id FROM public.subjects WHERE name = 'Алгебра' AND grade_level = 8;

    -- =============================================
    -- === ВАРИАНТ 4: AESTHETIC VIBE (Эстетика и Манифестация) ===
    -- =============================================
    RAISE NOTICE 'Seeding Algebra 8 Variant 4 (Aesthetic)...';

    -- Q1: ОДЗ и фильтры
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 4, E'Твой новый фильтр для фото описывается дробью: (Красота + 10) / (Твоё_Настроение – 5). При каком уровне настроения фильтр выдаст критическую ошибку (Division by Zero)?', E'Малышка, запомни: в жизни и в алгебре нельзя делить на ноль. \n1. Приравниваем знаменатель к нулю: Настроение - 5 = 0. \n2. Итог: Настроение = 5. Если оно на пятерке — фильтр не сработает, срочно иди за латте!', 1)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '5', true),
    (q_id, '-10', false),
    (q_id, '0', false),
    (q_id, 'Настроение всегда 10/10', false);

    -- Q2: Степени и охваты
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 4, E'Ты запостила рилс, и твоя популярность растет по закону: (10²)³. Запиши число твоих будущих лайков в виде степени десятки.', E'Это закон возведения степени в степень! \n1. Перемножаем показатели: 2 * 3 = 6. \n2. Получаем 10⁶. Это ровно миллион лайков! Мы это наманифестировали.', 2)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '10⁶', true),
    (q_id, '10⁵', false),
    (q_id, '10⁸', false),
    (q_id, 'Бесконечность ✨', false);

    -- Q3: Корни и реальность
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 4, E'Площадь твоей новой гардеробной — 400 м². Найди длину стены, если комната квадратная.', E'Извлекаем корень из эстетичного пространства! \n1. √400 = 20. \n2. Длина стены — 20 метров. Достаточно места для всех туфель!', 3)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '20 м', true),
    (q_id, '40 м', false),
    (q_id, '10 м', false),
    (q_id, 'Мало, нужно больше', false);

    -- Q4: Квадратные уравнения и выбор платья
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 4, E'Количество твоих идеальных луков вычисляется уравнением: x² – 49 = 0. Сколько вариантов у тебя есть (x > 0)?', E'Решаем неполное уравнение: x² = 49. \nЗначит, x = 7. По одному идеальному образу на каждый день недели!', 4)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '7', true),
    (q_id, '49', false),
    (q_id, '14', false),
    (q_id, '0 (нечего надеть)', false);

    -- Q5: Дискриминант и драма
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 4, E'Ты анализируешь сообщение от бывшего. Уровень драмы — это дискриминант уравнения x² – 2x + 10 = 0. Каковы шансы на нормальный разговор?', E'Считаем D: b² - 4ac = (-2)² - 4*1*10 = 4 - 40 = -36. \nДискриминант отрицательный! Корней нет, смысла нет, удаляй его из контактов. Girl logic + Алгебра = Идеальный выбор.', 5)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Шансов нет (D < 0)', true),
    (q_id, 'Один шанс (D = 0)', false),
    (q_id, 'Два шанса (D > 0)', false),
    (q_id, 'Ретроградный Меркурий виноват', false);

    -- =============================================
    -- === ВАРИАНТ 5: SHOPPING LOGIC (Математика инвестиций в себя) ===
    -- =============================================
    RAISE NOTICE 'Seeding Algebra 8 Variant 5 (Shopping)...';

    -- Q1: Стандартный вид сумочки
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 5, E'Лимитированная сумочка стоит 250 000 рублей. Запиши эту цену в стандартном виде, чтобы она выглядела более компактно в твоем списке желаний.', E'1. Ставим запятую: 2,5. \n2. Считаем нули: 5 знаков. \n3. Итог: 2,5 * 10⁵. Это не трата, это инвестиция!', 1)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '2.5 * 10⁵', true),
    (q_id, '25 * 10⁴', false),
    (q_id, '2.5 * 10⁶', false),
    (q_id, 'Бесценно', false);

    -- Q2: Корни и уход за собой
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 5, E'Твой бьюти-гаджет работает на частоте √1.44 Гц. Какова чистота сигнала?', E'Извлекаем корень из десятичной дроби: \n√144 = 12, значит √1.44 = 1.2. Кожа будет сиять!', 2)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '1.2 Гц', true),
    (q_id, '0.12 Гц', false),
    (q_id, '12 Гц', false),
    (q_id, '7.2 Гц', false);

    -- Q3: Неравенства и комендантский час
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 5, E'Папа сказал: "Если ты опоздаешь больше чем на x часов, где -3x > -30, ты под домашним арестом". Реши неравенство.', E'Внимание, girl logic здесь совпадает с математикой: \n1. Делим на -3. \n2. Знак ПЕРЕВОРАЧИВАЕТСЯ! \n3. x < 10. У тебя есть целых 10 часов, гуляй смело!', 3)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'x < 10', true),
    (q_id, 'x > 10', false),
    (q_id, 'x < 30', false),
    (q_id, 'Я уже дома', false);

    -- Q4: Теорема Виета и подружки
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 5, E'Возраст тебя и твоей лучшей подруги — это корни уравнения x² – 30x + 221 = 0. Сумма ваших возрастов?', E'По Теореме Виета сумма корней равна второму коэффициенту с противоположным знаком. \n-(-30) = 30. Вам на двоих 30 лет! Вечно молодые.', 4)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '30', true),
    (q_id, '221', false),
    (q_id, '15', false),
    (q_id, 'Нам всегда 18', false);

    -- Q5: Степени и кофе
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 5, E'Твоя энергия после айс-латте вычисляется как: a⁻² * a⁵. Упрости это выражение.', E'При умножении показатели складываются: \n-2 + 5 = 3. Твоя энергия в кубе! Хватит на весь шоппинг.', 5)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'a³', true),
    (q_id, 'a⁷', false),
    (q_id, 'a⁻¹⁰', false),
    (q_id, 'Energy Overflow ☕', false);

END $$;