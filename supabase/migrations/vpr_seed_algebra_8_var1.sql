-- =============================================
-- === ИНИЦИАЛИЗАЦИЯ ПРЕДМЕТА: АЛГЕБРА 8 ===
-- =============================================
INSERT INTO public.subjects (name, grade_level, description) VALUES
('Алгебра', 8, E'## Алгебра 8.0: Протокол Доминирования \n\nЭтот модуль проверит твою способность управлять переменными и взламывать сложные уравнения. \n\n**Темы текущей прошивки:**\n\n*   🧬 **Рациональные дроби:** Укрощение знаменателей и поиск ОДЗ.\n*   ⚡ **Степени:** Работа с отрицательными показателями.\n*   🔍 **Квадратные корни:** Извлечение смысла из радикалов.\n*   📐 **Квадратные уравнения:** Дискриминант и магия Теоремы Виета.\n*   ⚖️ **Неравенства:** Сохранение знака при переходе границ.\n\nМатематика — это код реальности. Приготовься к дешифровке! 🚀')
ON CONFLICT (name, grade_level) DO UPDATE 
SET description = EXCLUDED.description;

-- Очистка старых данных для идемпотентности
DO $$
DECLARE
    subj_id INT;
BEGIN
    SELECT id INTO subj_id FROM public.subjects WHERE name = 'Алгебра' AND grade_level = 8;
    DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_id);
    DELETE FROM public.vpr_questions WHERE subject_id = subj_id;
END $$;

-- =============================================
-- === ВСТАВКА ВОПРОСОВ: ВАРИАНТ 1 ===
-- =============================================
DO $$
DECLARE
    subj_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_id FROM public.subjects WHERE name = 'Алгебра' AND grade_level = 8;

    -- Вопрос 1: ОДЗ дроби
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'При каком значении переменной выражение (x + 5) / (x – 7) не имеет смысла?', E'Выражение не имеет смысла, когда знаменатель равен нулю. \n1. Приравниваем низ к нулю: x - 7 = 0 \n2. Находим x: x = 7.', 1)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '7', true),
    (q_id, '-5', false),
    (q_id, '0', false),
    (q_id, '-7', false);

    -- Вопрос 2: Свойства степеней
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Вычислите значение выражения: (2⁻³ * 2⁻²) / 2⁻⁶', E'Используем свойства степеней: \n1. В числителе складываем показатели: -3 + (-2) = -5. Получаем 2⁻⁵. \n2. При делении вычитаем показатели: -5 - (-6) = -5 + 6 = 1. \n3. Итог: 2¹ = 2.', 2)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '2', true),
    (q_id, '0.5', false),
    (q_id, '4', false),
    (q_id, '32', false);

    -- Вопрос 3: Корни (вычисление)
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Найдите значение выражения: √18 * √2', E'Протокол слияния корней: \n1. √18 * √2 = √(18 * 2) \n2. √(18 * 2) = √36 \n3. √36 = 6.', 3)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '6', true),
    (q_id, '36', false),
    (q_id, '4', false),
    (q_id, '9', false);

    -- Вопрос 4: Сокращение дробей (логика)
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Сократите дробь: (5a - 5b) / (a² - b²)', E'Деконструкция по формулам: \n1. В числителе выносим 5: 5(a - b) \n2. В знаменателе разность квадратов: (a - b)(a + b) \n3. Сокращаем (a - b). Остается 5 / (a + b).', 4)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '5 / (a + b)', true),
    (q_id, '5', false),
    (q_id, '5 / (a - b)', false),
    (q_id, '1 / (a + b)', false);

    -- Вопрос 5: Сравнение корней
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Какое из чисел больше: 3√5 или 2√11?', E'Вносим множители под корень для сравнения: \n1. 3√5 = √(3² * 5) = √45 \n2. 2√11 = √(2² * 11) = √44 \n3. √45 > √44, значит 3√5 больше.', 5)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '3√5', true),
    (q_id, '2√11', false),
    (q_id, 'Они равны', false);

    -- Вопрос 6: Дискриминант
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Найдите дискриминант уравнения: x² - 5x + 6 = 0', E'Применяем D-фильтр: \n1. a = 1, b = -5, c = 6 \n2. D = b² - 4ac = (-5)² - 4 * 1 * 6 \n3. D = 25 - 24 = 1.', 6)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '1', true),
    (q_id, '25', false),
    (q_id, '49', false),
    (q_id, '0', false);

    -- Вопрос 7: Корни уравнения
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Решите уравнение: x² + 2x - 8 = 0. В ответе укажите больший корень.', E'1. D = 2² - 4*1*(-8) = 4 + 32 = 36. \n2. √D = 6. \n3. x₁ = (-2 + 6)/2 = 2. \n4. x₂ = (-2 - 6)/2 = -4. \nБольший корень: 2.', 7)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '2', true),
    (q_id, '-4', false),
    (q_id, '4', false),
    (q_id, '-2', false);

    -- Вопрос 8: Теорема Виета
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Не решая уравнение x² - 7x + 10 = 0, найдите сумму его корней.', E'Чит-код Теоремы Виета: \nДля приведённого уравнения x² + px + q = 0 сумма корней равна -p. \nЗдесь p = -7, значит сумма равна -(-7) = 7.', 8)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '7', true),
    (q_id, '-7', false),
    (q_id, '10', false),
    (q_id, '-10', false);

    -- Вопрос 9: Стандартный вид числа
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Запишите число 0,000034 в стандартном виде.', E'Переносим запятую до первой значащей цифры: \n1. Прыгаем вправо на 5 знаков: 3,4. \n2. Так как число маленькое, степень отрицательная: 10⁻⁵. \n3. Итог: 3,4 * 10⁻⁵.', 9)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '3.4 * 10⁻⁵', true),
    (q_id, '3.4 * 10⁻⁴', false),
    (q_id, '34 * 10⁻⁶', false),
    (q_id, '0.34 * 10⁻⁴', false);

    -- Вопрос 10: Неравенства
    INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
    VALUES (subj_id, 1, E'Решите неравенство: 10 - 2x > 14', E'Соблюдаем осторожность со знаками: \n1. Переносим 10: -2x > 14 - 10 => -2x > 4. \n2. Делим на -2. Внимание! Знак переворачивается: x < 4 / (-2). \n3. Итог: x < -2.', 10)
    RETURNING id INTO q_id;
    INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'x < -2', true),
    (q_id, 'x > -2', false),
    (q_id, 'x < 2', false),
    (q_id, 'x > 12', false);

END $$;