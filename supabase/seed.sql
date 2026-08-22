-- Ensure the subjects table exists and has the "Математика" entry
INSERT INTO public.subjects (name, description) VALUES
('Математика', E'## ВПР по Математике (6 класс) \n\nЭта проверочная работа покажет, насколько хорошо ты освоил **основные темы** по математике за 6 класс. \n\n**Что будет проверяться:**\n\n*   🔢 Действия с **обыкновенными** и **десятичными** дробями.\n*   ➕➖ Действия с **положительными** и **отрицательными** числами.\n*   📊 Решение **задач** (на движение, части, проценты).\n*   ⚖️ **Пропорции**.\n*   ✏️ Решение простых **уравнений**.\n*   📏 Работа с **координатами**.\n\nНе бойся, это просто проверка! Удачи! ✨')
ON CONFLICT (name) DO NOTHING;

-- Clear existing math questions for idempotency before seeding (optional, but good practice)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6));
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6);


-- =============================================
-- === INSERT MATH 6th Grade, VARIANT 1 (FINAL) ===
-- =============================================
DO $$
DECLARE
    subj_math_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_math_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6;

    IF subj_math_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math Variant 1...';

        -- Question 1 (Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Вычислите: −47 – 18 · (−4).', E'1. Умножение имеет приоритет: 18 * (-4) = -72\n2. Вычитание: -47 - (-72) = -47 + 72 = 25', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '25', true),
        (q_id, '-119', false),
        (q_id, '-29', false),
        (q_id, '119', false);

        -- Question 2 (Var 1) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Вычислите: (18/35) : 12 + 1/10', E'1. Деление: (18/35) * (1/12) = 18/420 = 3/70.\n2. Сложение: 3/70 + 1/10 = 3/70 + 7/70 = 10/70.\n3. Сокращение: 1/7.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1/7', true),
        (q_id, '19/175', false),
        (q_id, '13/70', false),
        (q_id, '10/70', false); -- Without final simplification

        -- Question 3 (Var 1) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Задумали число. Из 145 вычли треть задуманного числа и получили половину задуманного числа. Найдите задуманное число.', E'Пусть x - число. 145 - x/3 = x/2 => 145 = x/2 + x/3 => 145 = (3x+2x)/6 => 145 = 5x/6 => x = 145 * 6 / 5 = 29 * 6 = 174.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '174', true);

        -- Question 4 (Var 1) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Вычислите: (4,6 – 9,1) · 0,4.', E'1. Скобки: 4.6 - 9.1 = -4.5\n2. Умножение: -4.5 * 0.4 = -1.8', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-1.8', true);

        -- Question 5 (Var 1 - Image based) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'На рисунке изображены щука и окунь. Длина окуня 20 см. Какова примерная длина щуки? Ответ дайте в сантиметрах.\n\n[Изображение: Щука и Окунь]', E'Визуально щука примерно в 4-5 раз длиннее окуня. 20 см * 4.5 ≈ 90 см. Допустим диапазон 80-100 см.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '90', true); -- Expect single number, range check needed externally if strict

        -- Question 6 (Var 1 - Chart based) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'На диаграмме [...] объёмы производства пшеницы [...] Китай - 2 место. Какое место занимала Аргентина?\n\n[Диаграмма: Объемы производства пшеницы Вар.1]', E'Смотрим диаграмму Вар.1: ЕС(1), Китай(2), Индия(3), Россия(4), США(5), Канада(6), Украина(7), Австралия(8), Аргентина(9), Казахстан(10). Ответ: 9.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9', true);

        -- Question 7 (Var 1) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Найдите значение выражения x – 3(x – 11) при x = 6.', E'1. Подстановка: 6 - 3 * (6 - 11)\n2. Скобки: 6 - 11 = -5\n3. Умножение: 3 * (-5) = -15\n4. Вычитание: 6 - (-15) = 6 + 15 = 21.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '21', true);

        -- Question 8 (Var 1 - Matching) - Free Response (Number Input - 3 digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'На коорд. прямой точки К, M, N, P, Q. Числа: -30/13, 20/7, -59/18. Установите соответствие.\n\n[Изображение: Коорд. прямая Вар.1]\n\nA) -30/13 Б) 20/7 B) -59/18 \n\nТочки: 1)K 2)M 3)N 4)P 5)Q \nОтвет: цифры для А,Б,В.', E'Расчет: A≈-2.3; Б≈2.86; B≈-3.28.\nЛист ответов ВПР дает: 341.\nПредполагаемое соответствие для 341:\nA (-2.3) -> N(3)\nБ (2.86) -> P(4)\nВ (-3.28) -> K(1)\nХотя по рисунку из OCR должно быть 251 (A->M, Б->Q, В->K). Используем официальный ответ.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '341', true);

        -- Question 9 (Var 1 - Calculation) - Free Response (Fraction/Decimal Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Вычислите: (1 1/15) / (2/5 - 3) + 2 * (1/3 + 1/4). *Задание восстановлено*.', E'1. (2/5 - 15/5) = -13/5.\n2. (4/12 + 3/12) = 7/12.\n3. (16/15) / (-13/5) = (16/15) * (-5/13) = -16/39.\n4. 2 * (7/12) = 7/6.\n5. -16/39 + 7/6 = (-32 + 91)/78 = 59/78.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '59/78', true);

        -- Question 10 (Var 1 - Multiple Statements) - Free Response (Number Input - digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Рост игроков > 190 см и < 210 см. Выберите верные утверждения:\n1) Нет игроков ростом 189 см.\n2) Обязательно есть игрок ростом 220 см.\n3) Рост любого < 210 см.\n4) Разница в росте > 20 см.', E'1) Верно (189 <= 190).\n2) Неверно (220 >= 210).\n3) Верно (< 210).\n4) Неверно (могут быть 191, 192).\nВерные: 1, 3.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '13', true),
        (q_id, '31', true); -- Accept either order

        -- Question 11 (Var 1 - Word Problem %) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Обед: плов 55%, борщ 30%, компот 30 руб. Сколько стоил весь обед?', E'1. Плов+Борщ = 85%.\n2. Компот = 100% - 85% = 15%.\n3. 15% = 30 руб => 1% = 2 руб.\n4. 100% = 200 руб.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '200', true);

        -- Question 12 (Var 1 - Drawing) - Placeholder Answer (Non-clickable)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Света сложила листок по линии. Нарисуйте отпечаток второй фигуры.\n\n[Изображение 2: Фигура и линия сгиба Вар.1]', E'Требуется нарисовать фигуру, симметричную данной относительно линии сгиба.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true);

        -- Question 13 (Var 1 - Word Problem Logic) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 1, E'Игра в снежки. 1-й кинул Петя -> Даша. Ответ на попадание - 2 снежка. Всего 5 попаданий. Сколько снежков мимо?', E'Каждое из 5 попаданий инициировало 2 ответных броска = 10 бросков.\n+1 первый бросок Пети.\nВсего брошено = 1 + 10 = 11.\nПопало = 5.\nМимо = 11 - 5 = 6.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6', true);

    ELSE
        RAISE NOTICE 'Subject "Математика" not found. Skipping Variant 1.';
    END IF;

END $$;


-- ============================================
-- === INSERT MATH 6th Grade, VARIANT 2 (FINAL) ===
-- ============================================
DO $$
DECLARE
    subj_math_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_math_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6;

    IF subj_math_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math Variant 2...';

        -- Question 1 (Var 2) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Вычислите: -98 : 7 + 22.', E'1. Деление: -98 / 7 = -14.\n2. Сложение: -14 + 22 = 8.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '8', true),
        (q_id, '36', false),
        (q_id, '-8', false),
        (q_id, '-36', false);

        -- Question 2 (Var 2) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Вычислите: 11/8 - 15/16 : 25/28', E'1. Деление: (15/16) * (28/25) = (3*5 * 4*7) / (4*4 * 5*5) = 21/20.\n2. Вычитание: 11/8 - 21/20 = (55 - 42) / 40 = 13/40.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '13/40', true),
        (q_id, '1', false),
        (q_id, '-7/40', false),
        (q_id, '97/40', false);

        -- Question 3 (Var 2) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Собрали 15 кг вишни. В первый ящик пошло 2/5 от всего. Сколько кг во втором?', E'1. В первом: (2/5) * 15 = 6 кг.\n2. Во втором: 15 - 6 = 9 кг.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9', true);

        -- Question 4 (Var 2) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Вычислите: (−2 + 0,625) · 8.', E'1. Скобки: -2 + 0.625 = -1.375\n2. Умножение: -1.375 * 8 = -11.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-11', true);

        -- Question 5 (Var 2 - Image based) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Хозяин и собака. Рост собаки до макушки 55 см. Примерный рост хозяина? (см)\n\n[Изображение: Хозяин и собака Вар.2]', E'Хозяин примерно в 3 раза выше собаки. 55 см * 3 = 165 см. Допустим диапазон 160-180 см.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '165', true);

        -- Question 6 (Var 2 - Chart based) - Multiple Choice (Month Name)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'На диаграмме средняя темп. в Перми. В каком месяце 2-го полугодия темп. была самой низкой?\n\n[Диаграмма: Температура по месяцам Вар.2]', E'2-е полугодие: Июль-Декабрь. Самая низкая температура (самый низкий столбик) в Декабре (~-10).', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Декабрь', true),
        (q_id, 'Ноябрь', false),
        (q_id, 'Январь', false),
        (q_id, 'Октябрь', false);

        -- Question 7 (Var 2) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Найдите значение выражения х – 2(x – 14) при х = 5.', E'1. Подстановка: 5 - 2 * (5 - 14)\n2. Скобки: 5 - 14 = -9\n3. Умножение: 2 * (-9) = -18\n4. Вычитание: 5 - (-18) = 5 + 18 = 23.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '23', true);

        -- Question 8 (Var 2 - Matching) - Free Response (Number Input - 3 digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'На коорд. прямой точки К, M, N, P, Q. Числа: -41/19, 39/9, -20/11. Установите соответствие.\n\n[Изображение: Коорд. прямая Вар.2]\n\nA) -41/19 Б) 39/9 B) -20/11 \n\nТочки: 1)K 2)M 3)N 4)P 5)Q \nОтвет: цифры для А,Б,В.', E'Расчет: A≈-2.16; Б≈4.33; B≈-1.82.\nЛист ответов ВПР для Вар.2 дает 253.\nПредполагаемое соответствие для 253:\nA (-2.16) -> M(2)\nБ (4.33) -> Q(5)\nВ (-1.82) -> N(3)\nИспользуем официальный ответ.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '253', true);

        -- Question 9 (Var 2 - Calculation) - Free Response (Fraction/Decimal Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Вычислите: 2*(4/13) - (3/8 - 4/15) : (11 : 5 1/2). *Задание восстановлено*.', E'1. (11 : 11/2) = 11 * 2/11 = 2.\n2. (3/8 - 4/15) = (45-32)/120 = 13/120.\n3. (13/120) : 2 = 13/240.\n4. 2 * (4/13) = 8/13.\n5. 8/13 - 13/240 = (1920 - 169) / 3120 = 1751/3120.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1751/3120', true); -- Ответ для восстановленного примера

        -- Question 10 (Var 2 - Multiple Statements) - Free Response (Number Input - digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Оценки Васи: 2 пятерки, 5 четверок, 4 тройки, 3 двойки. Выберите верные утверждения:\n1) Четвёрок > (троек + двоек).\n2) Троек < (остальных вместе).\n3) Всего отметок < 13.\n4) Четвёрок = (пятёрок + двоек).', E'1) 5 > (4+3=7) - Неверно.\n2) 4 < (2+5+3=10) - Верно.\n3) Всего 14. 14 < 13 - Неверно.\n4) 5 = (2+3=5) - Верно.\nВерные: 2, 4.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '24', true),
        (q_id, '42', true);

        -- Question 11 (Var 2 - Word Problem %) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'У Вани 40% оценок - пятёрки. Троек - 4. Четвёрок столько же, сколько пятёрок. Других нет. Сколько всего оценок?', E'Пусть X - всего. П=0.4X, Ч=0.4X, Т=4.\nX = П+Ч+Т = 0.4X + 0.4X + 4\nX = 0.8X + 4 => 0.2X = 4 => X = 4 / 0.2 = 20.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '20', true);

        -- Question 12 (Var 2 - Geometry/Drawing) - Placeholder Answer (Non-clickable)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Куб: точка А на нижней грани, В - на верхней.\n\n[Изображение: Куб с точками A и B Вар.2]\n\nНа развёртке отмечена точка А. Отметьте точку В.\n\n[Изображение: Развертка куба с точкой A Вар.2]', E'Нужно найти верхнюю грань относительно грани А на развертке и отметить В.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true);

        -- Question 13 (Var 2 - Word Problem Logic) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 2, E'Задумали двузначное число. Число * (произведение цифр) = 3400. Какое число?', E'Пусть N = 10a+b. N * a * b = 3400 = 2^3 * 5^2 * 17.\nN и a*b - делители 3400.\nПеребор двузначных делителей N: 10, 17, 20, 25, 34, 40, 50, 68, 85...\nN=50: a=5,b=0. a*b=0. 50*0=0. Не подходит.\nN=85: a=8,b=5. a*b=40. 85 * 40 = 3400. Подходит!', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '85', true);

    ELSE
        RAISE NOTICE 'Subject "Математика" not found. Skipping Variant 2.';
    END IF;

END $$;


-- ============================================
-- === INSERT MATH 6th Grade, VARIANT 3 (FINAL - from testreal1.txt) ===
-- ============================================
DO $$
DECLARE
    subj_math_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_math_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6;

    IF subj_math_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math Variant 3 (from testreal1.txt)...';

        -- Question 1 (Var 3) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Вычислите: (31/14 - 3/7) * 16.25 / 40', E'1. Скобки: 31/14 - 6/14 = 25/14.\n2. Умножение: (25/14) * (16 1/4) = (25/14) * (65/4) = 1625/56.\n3. Деление: (1625/56) / 40 = (1625/56) * (1/40) = 1625 / 2240.\n4. Сокращение на 5: 325 / 448.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '325/448', true),
        (q_id, '1.25', false),
        (q_id, '25/14', false),
        (q_id, '65/56', false); -- 1625/56 / 25?

        -- Question 2 (Var 3) - Multiple Choice (Assuming 15/45 from OCR)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Вычислите: 15/45', E'Сокращаем на 15: (15/15) / (45/15) = 1/3.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1/3', true),
        (q_id, '3', false),
        (q_id, '15', false),
        (q_id, '0.3', false);

        -- Question 3 (Var 3) - Multiple Choice
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Вычислите: 9.3 - 11.4 : 1.5', E'1. Деление: 11.4 / 1.5 = 114 / 15 = 7.6\n2. Вычитание: 9.3 - 7.6 = 1.7', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1.7', true),
        (q_id, '-1.4', false),
        (q_id, '7.8', false),
        (q_id, '7.6', false); -- Результат деления

        -- Question 4 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Задумали число. Из 140 вычли половину, осталась пятая часть. Число?', E'Пусть x - число. 140 - x/2 = x/5 => 140 = x/5 + x/2 => 140 = (2x+5x)/10 => 140 = 7x/10 => x = 140 * 10 / 7 = 20 * 10 = 200.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '200', true);

        -- Question 5 (Var 3 - Chart based) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'На диаграмме [...] объёмы производства зерна [...] Китай - 1 место. Какое место занимала Украина?\n\n[Диаграмма: Объемы производства зерна Вар.3]', E'Смотрим диаграмму Вар.3: Китай(1), ЕС(2), США(3), Индия(4), Россия(5), Канада(6), Аргентина(7), Украина(8), Австралия(9), Казахстан(10). Ответ: 8.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '8', true);

        -- Question 6 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Тренировка: приседания 25%, бег 40% от остатка. Бег = 120 мин. Сколько вся тренировка (мин)?', E'1. Остаток после приседаний = 100% - 25% = 75%.\n2. Бег = 40% от 75% = 0.4 * 0.75 = 0.3 = 30% от всей тренировки.\n3. 30% = 120 мин => 1% = 4 мин.\n4. 100% = 400 мин.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '400', true);

        -- Question 7 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Найдите значение |6 - x| - |5 - x| при x = -3.24', E'1. |6 - (-3.24)| - |5 - (-3.24)| = |6 + 3.24| - |5 + 3.24|\n2. |9.24| - |8.24| = 9.24 - 8.24 = 1.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', true);

        -- Question 8 (Var 3 - Matching) - Free Response (Number Input - 3 digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'На коорд. прямой точки К, M, N, P, Q. Числа: 43/14, -78/19, -31/17. Установите соответствие.\n\n[Изображение: Коорд. прямая Вар.3]\n\nA) 43/14 Б) -78/19 В) -31/17 \n\nТочки: 1)K 2)M 3)N 4)P 5)Q \nОтвет: цифры для А,Б,В.', E'Расчет: A≈3.07; Б≈-4.11; В≈-1.82.\nСопоставление с рис: K самая левая -> Б(-4.11); N ближе к 0 слева -> В(-1.82); Q самая правая -> A(3.07).\nСоответствие: A->Q(5), Б->K(1), В->N(3). Ответ: 513.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '513', true);

        -- Question 9 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Решите уравнение: 2x - 3(3x + 1) = 11', E'1. 2x - 9x - 3 = 11\n2. -7x - 3 = 11\n3. -7x = 14\n4. x = 14 / (-7) = -2.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2', true);

        -- Question 10 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Найдите среднее арифметическое чисел 13, 27, 42, 54, 60.', E'1. Сумма = 13+27+42+54+60 = 196.\n2. Количество = 5.\n3. Среднее = 196 / 5 = 39.2', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '39.2', true);

        -- Question 11 (Var 3 - Multiple Statements) - Free Response (Number Input - digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Ящик: 6 синих, 8 чёрных ручек. Выберите верные утверждения:\n1) Можно достать 4 ручки одного цвета.\n2) Среди любых 6 ручек есть хотя бы одна чёрная.\n3) Среди любых 7 ручек есть 2 синих.\n4) Среди любых 9 ручек есть 2 чёрных.', E'1) Верно (можно 4 синих или 4 черных).\n2) Неверно (можно 6 синих).\n3) Неверно (можно 6 черных + 1 синюю).\n4) Верно (если взяли 9, макс. синих 6, значит минимум 9-6=3 черных).\nВерные: 1, 4.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '14', true),
        (q_id, '41', true);

        -- Question 12 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Сколько заглавных букв русской азбуки обладают одной осью симметрии?\nАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', E'Вертикальная: А, М, П, Т, Ш (5).\nГоризонтальная: В, Е, Ё, З, К, С, Э, Ю (8).\nИтого: 5 + 8 = 13.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13', true);

        -- Question 13 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'5 кг мёда. Большие банки по 400 г, маленькие по 200 г. Заполнили 4 большие. Сколько маленьких?', E'1. Всего = 5000 г.\n2. В больших = 4 * 400 = 1600 г.\n3. Осталось = 5000 - 1600 = 3400 г.\n4. Маленьких банок = 3400 / 200 = 17.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '17', true);

        -- Question 14 (Var 3 - Calculation) - Free Response (Fraction/Decimal Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Вычислите: (29/4) / (5 4/5) - (3/4) * (3 - 1 19/30)', E'1. Деление: (29/4) / (29/5) = 5/4.\n2. Вычитание в скобках: 3 - 49/30 = (90-49)/30 = 41/30.\n3. Умножение: (3/4) * (41/30) = 41/40.\n4. Вычитание: 5/4 - 41/40 = 50/40 - 41/40 = 9/40.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9/40', true);

        -- Question 15 (Var 3 - Area) - Placeholder Answer (Non-clickable)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Найдите площадь фигуры.\n\n[Изображение: Фигура 5-7.png]', E'Нужно разбить фигуру на прямоугольники и сложить их площади. Ответ в OCR был 48.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Площадь]', true); -- Ответ '48' если нужна проверка

        -- Question 16 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Полный бидон = 24 кг. Заполненный на 3/4 = 18.5 кг. Вес пустого бидона?', E'Пусть Б-бидон, М-мед.\n(Б+М) - (Б+3М/4) = 24 - 18.5\nМ/4 = 5.5 => М = 22 кг.\nБ = 24 - М = 24 - 22 = 2 кг.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true);

        -- Question 17 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Расчистка дороги: ДО = (5/7)ПО. ПО = ДО + 14 км. Сколько всего км за день?', E'ПО = (5/7)ПО + 14 => (2/7)ПО = 14 => ПО = 49 км.\nДО = (5/7)*49 = 35 км.\nВсего = ДО + ПО = 35 + 49 = 84 км.', 17)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '84', true);

        -- Question 18 (Var 3) - Free Response (Number Input)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 3, E'Задумано двузначное N (делится на 5). Число NNNN делится на 11. Какое N?', E'1. N делится на 5.\n2. NNNN = 101 * N.\n3. 101*N делится на 11.\n4. 101 не делится на 11 => N делится на 11.\n5. Ищем двузначное число, делящееся на 5 и 11. Это 55.', 18)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '55', true);

    ELSE
        RAISE NOTICE 'Subject "Математика" not found. Skipping Variant 3.';
    END IF;

END $$;
