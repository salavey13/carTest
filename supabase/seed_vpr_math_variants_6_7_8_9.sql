-- =============================================
-- === INSERT MATH 6th Grade, VARIANT 6 (K8 V1) ===
-- =============================================
DO $$
DECLARE
    subj_math_id INT;
    q_id INT;
    variant_num INT := 6; -- Set variant number
BEGIN
    SELECT id INTO subj_math_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6;

    IF subj_math_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math Variant 6 (Komplekt 8, Variant 1)...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_id AND variant_number = variant_num;

        -- Question 1 (Var 6) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Вычислите: (–15 + 4) · (–6).', E'1. Скобки: –15 + 4 = –11.\n2. Умножение: –11 · (–6) = 66.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '66', true);

        -- Question 2 (Var 6) - Free Response (Fraction/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Вычислите: (5/12 + 1/3) : 5/6.', E'1. Скобки (приводим к общему знаменателю 12): 5/12 + 1/3 = 5/12 + 4/12 = 9/12.\n2. Сокращаем дробь в скобках: 9/12 = 3/4.\n3. Деление: (3/4) : (5/6) = (3/4) * (6/5) = (3 * 6) / (4 * 5) = 18/20.\n4. Сокращаем результат: 18/20 = 9/10.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9/10', true); -- или 0.9

        -- Question 3 (Var 6) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Некоторое число увеличили в полтора раза, и получилось 90. Найдите исходное число.', E'Пусть исходное число X.\nУвеличили в полтора раза: X * 1.5 = 90.\nНаходим X: X = 90 / 1.5 = 90 / (3/2) = 90 * (2/3) = (90/3) * 2 = 30 * 2 = 60.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '60', true);

        -- Question 4 (Var 6) - Free Response (Number/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Вычислите: 20 – 2,4 : 0,3.', E'1. Деление: 2,4 : 0,3 = 24 : 3 = 8.\n2. Вычитание: 20 - 8 = 12.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '12', true);

        -- Question 5 (Var 6 - Image based) - Free Response (Number range, meters)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'На рисунке изображены дом и стоящий рядом фонарный столб. Высота дома 10 м. Какова примерная высота фонарного столба? Ответ дайте в метрах.\n\n[Изображение: Дом и столб К8В1]', E'Высота дома 10 м. Визуально столб ниже дома, примерно 2/3 высоты дома.\nПримерная высота: 10 м * (2/3) ≈ 6.7 м.\nДопустимый диапазон от 6 до 8 метров.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[от 6 до 8]', true); -- Placeholder representing the range check needed

        -- Question 6 (Var 6 - Chart based) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'На диаграмме показана посещаемость математического кружка по дням недели. Сколько всего учеников посетило кружок во вторник и среду?\n\n[Диаграмма: Посещаемость кружка К8В1]', E'Смотрим на диаграмму:\nВторник (Вт): 8 учеников\nСреда (Ср): 10 учеников\nВсего за Вт и Ср: 8 + 10 = 18 учеников.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '18', true);

        -- Question 7 (Var 6) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Найдите значение выражения |x – 5| – 2y при x = 2, y = –3.', E'1. Подстановка: |2 – 5| – 2 * (–3)\n2. Внутри модуля: 2 – 5 = –3.\n3. Модуль: |–3| = 3.\n4. Умножение: 2 * (–3) = –6.\n5. Выражение: 3 – (–6) = 3 + 6 = 9.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9', true);

        -- Question 8 (Var 6 - Matching) - Free Response (Number - 3 digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'На координатной прямой отмечены точки A, B и C. Установите соответствие между точками и их координатами.\n\n[Изображение: Коорд. прямая К8В1: ... A ... -1 ... B ... 1 ... C ...]\n\nТОЧКИ:\nA\nB\nC\n\nКООРДИНАТЫ:\n1) 1/3\n2) 2,8\n3) -1,6\n4) 0,55\n5) -0,9\n\nВ таблице для каждой точки укажите номер соответствующей координаты. Ответ: цифры для А,Б,В.', E'Положение точек на прямой:\nA < -1\n-1 < B < 1\nC > 1\n\nПримерные значения координат:\n1) 1/3 ≈ 0.33\n2) 2,8\n3) -1,6\n4) 0,55\n5) -0,9\n\nСоответствие:\nA (< -1) -> -1,6 (3)\nB (между -1 и 1, ближе к 1) -> 0,55 (4)\nC (> 1) -> 2,8 (2)\nОтвет: 342.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '342', true);

        -- Question 9 (Var 6 - Calculation with Solution) - Free Response (Fraction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Вычислите: (3 1/4 – 1 1/6) * 12/13. Запишите решение и ответ.', E'1) Вычитание смешанных чисел в скобках. Переводим в неправильные дроби:\n   3 1/4 = 13/4\n   1 1/6 = 7/6\n2) Приводим дроби к общему знаменателю 12:\n   13/4 = (13 * 3) / (4 * 3) = 39/12\n   7/6 = (7 * 2) / (6 * 2) = 14/12\n3) Выполняем вычитание в скобках:\n   39/12 - 14/12 = (39 - 14) / 12 = 25/12\n4) Выполняем умножение:\n   (25/12) * (12/13) = (25 * 12) / (12 * 13)\n5) Сокращаем 12:\n   25 / 13\nОтвет: 25/13.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '25/13', true); -- Может быть записано как 1 12/13

        -- Question 10 (Var 6 - Multiple Statements) - Free Response (Number - digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'В классе учатся 27 человек, из них 12 мальчиков и 15 девочек. Выберите верные утверждения и запишите в ответе их номера.\n1) Девочек в классе больше, чем мальчиков.\n2) Мальчики составляют менее 45% всех учащихся.\n3) В классе меньше 25 учащихся.\n4) Мальчиков в классе вдвое меньше, чем девочек.', E'Проверяем утверждения:\n1) Девочек 15, мальчиков 12. 15 > 12. Верно.\n2) Всего 27 учеников. Доля мальчиков: 12/27 = 4/9. 4/9 ≈ 0.444... = 44.4...%. 44.4...% < 45%. Верно.\n3) В классе 27 учеников. 27 не меньше 25. Неверно.\n4) 12 * 2 = 24. Девочек 15. 12 не равно 15/2. Неверно.\nВерные утверждения: 1, 2.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '12', true),
        (q_id, '21', true);

        -- Question 11 (Var 6 - Word Problem % with Solution) - Free Response (Number/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Автомобиль ехал со скоростью 60 км/ч. Водитель увеличил скорость на 10%, а затем снизил получившуюся скорость на 10%. Какой стала скорость автомобиля? Запишите решение и ответ.', E'1. Начальная скорость: 60 км/ч.\n2. Увеличение на 10%: 10% от 60 = 0.10 * 60 = 6 км/ч. Новая скорость: 60 + 6 = 66 км/ч.\n   Или: 60 * (1 + 0.10) = 60 * 1.1 = 66 км/ч.\n3. Снижение новой скорости (66 км/ч) на 10%: 10% от 66 = 0.10 * 66 = 6.6 км/ч. Итоговая скорость: 66 - 6.6 = 59.4 км/ч.\n   Или: 66 * (1 - 0.10) = 66 * 0.9 = 59.4 км/ч.\nОтвет: 59,4 км/ч.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '59.4', true); -- 59,4

        -- Question 12 (Var 6 - Geometry/Spatial) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Игральный кубик составлен из 27 маленьких кубиков (3х3х3). Сколько маленьких кубиков осталось после того, как убрали один угловой кубик?', E'Изначально было 27 маленьких кубиков.\nУбрали один угловой кубик.\nОсталось: 27 - 1 = 26 кубиков.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '26', true);

        -- Question 13 (Var 6 - Word Problem Logic with Solution) - Free Response (Yes/No + Explanation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 6, E'Вася рвёт бумажный лист на 4 части. Затем берёт любую из получившихся частей и снова рвёт её на 4 части, и так далее. Может ли у него в какой-то момент получиться ровно 30 частей? Объясните ответ.', E'Нет, не может.\nОбъяснение:\nИзначально есть 1 лист (1 часть).\nКаждый раз, когда Вася рвёт одну часть на 4, общее количество частей увеличивается на 3 (была 1 часть, стало 4; +3).\nНачав с 1 части, после k разрывов у него будет 1 + 3*k частей.\nНужно проверить, может ли 1 + 3*k равняться 30.\n1 + 3k = 30\n3k = 30 - 1\n3k = 29\nЧисло 29 не делится нацело на 3 (2+9=11, не кратно 3). Значит, не существует целого числа k (количества разрывов), при котором получится 30 частей.\nОтвет: Нет.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Нет', true); -- Проверка объяснения нужна отдельно

    ELSE
        RAISE NOTICE 'Subject "Математика" not found. Skipping Variant 6.';
    END IF;
END $$;


-- =============================================
-- === INSERT MATH 6th Grade, VARIANT 7 (K8 V2) ===
-- =============================================
DO $$
DECLARE
    subj_math_id INT;
    q_id INT;
    variant_num INT := 7; -- Set variant number
BEGIN
    SELECT id INTO subj_math_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6;

    IF subj_math_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math Variant 7 (Komplekt 8, Variant 2)...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_id AND variant_number = variant_num;

        -- Question 1 (Var 7) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Вычислите: (–91 : 7 + 5) · 3.', E'1. Деление в скобках: –91 : 7 = –13.\n2. Сложение в скобках: –13 + 5 = –8.\n3. Умножение: –8 · 3 = –24.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-24', true);

        -- Question 2 (Var 7) - Free Response (Fraction/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Вычислите: (4/5 – 1/2) : 3/10.', E'1. Вычитание в скобках (общий знаменатель 10): 4/5 - 1/2 = 8/10 - 5/10 = 3/10.\n2. Деление: (3/10) : (3/10) = 1.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', true);

        -- Question 3 (Var 7) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Ученик прочитал 140 страниц, что составляет 70% всей книги. Сколько страниц в книге?', E'Пусть X - общее количество страниц в книге.\n70% от X равно 140.\n0.70 * X = 140.\nX = 140 / 0.70 = 1400 / 7 = 200.\nВ книге 200 страниц.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '200', true);

        -- Question 4 (Var 7) - Free Response (Number/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Вычислите: 1,2 · (3,5 – 4).', E'1. Вычитание в скобках: 3.5 - 4 = -0.5.\n2. Умножение: 1.2 * (-0.5) = -0.6.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-0.6', true); -- -0,6

        -- Question 5 (Var 7 - Image based) - Free Response (Number range, meters)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'На рисунке изображены грузовик и стоящий рядом легковой автомобиль. Длина грузовика 8 м. Какова примерная длина легкового автомобиля? Ответ дайте в метрах.\n\n[Изображение: Грузовик и легковой автомобиль К8В2]', E'Длина грузовика 8 м. Визуально легковой автомобиль примерно в 1.5-2 раза короче грузовика.\nПримерная длина: 8 м / 1.8 ≈ 4.4 м.\nДопустимый диапазон от 4 до 5 метров.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[от 4 до 5]', true); -- Placeholder representing the range check needed

        -- Question 6 (Var 7 - Chart based) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'На диаграмме показана температура воздуха в течение суток. Найдите разницу между максимальной и минимальной температурой за эти сутки.\n\n[Диаграмма: Температура К8В2]', E'Смотрим на диаграмму:\nМаксимальная температура: 15 °C.\nМинимальная температура: 8 °C.\nРазница: 15 - 8 = 7 °C.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7', true);

        -- Question 7 (Var 7) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Найдите значение выражения 3(a + b) – a при a = –1, b = 5.', E'1. Подстановка: 3 * (–1 + 5) – (–1)\n2. Сложение в скобках: –1 + 5 = 4.\n3. Умножение: 3 * 4 = 12.\n4. Выражение: 12 – (–1) = 12 + 1 = 13.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13', true);

        -- Question 8 (Var 7 - Matching) - Free Response (Number - 3 digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'На координатной прямой отмечены точки P, Q и R. Установите соответствие между точками и их координатами.\n\n[Изображение: Коорд. прямая К8В2: ... P ... 0 ... Q ... R ...]\n\nТОЧКИ:\nP\nQ\nR\n\nКООРДИНАТЫ:\n1) 1,15\n2) 3,05\n3) -0,8\n4) -1/3\n5) 7/2\n\nВ таблице для каждой точки укажите номер соответствующей координаты. Ответ: цифры для P,Q,R.', E'Положение точек на прямой:\nP < 0\n0 < Q < R\n\nПримерные значения координат:\n1) 1,15\n2) 3,05\n3) -0,8\n4) -1/3 ≈ -0.33\n5) 7/2 = 3.5\n\nСоответствие:\nP (< 0) -> -1/3 (4)\nQ (между 0 и R, ближе к 1) -> 1,15 (1)\nR (правее Q) -> 3,05 (2)\nОтвет: 412.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '412', true);

        -- Question 9 (Var 7 - Calculation with Solution) - Free Response (Fraction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Вычислите: 1 5/8 + (2 1/4 – 1/2) : 4/7. Запишите решение и ответ.', E'1) Вычитание в скобках. Переводим 2 1/4 в неправильную дробь 9/4. Приводим к общему знаменателю 4:\n   9/4 - 1/2 = 9/4 - 2/4 = 7/4.\n2) Деление: (7/4) : (4/7) = (7/4) * (7/4) = (7 * 7) / (4 * 4) = 49/16.\n3) Сложение. Переводим 1 5/8 в неправильную дробь 13/8. Приводим к общему знаменателю 16:\n   13/8 = (13 * 2) / (8 * 2) = 26/16.\n4) Выполняем сложение:\n   26/16 + 49/16 = (26 + 49) / 16 = 75/16.\nОтвет: 75/16.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '75/16', true); -- Может быть записано как 4 11/16

        -- Question 10 (Var 7 - Multiple Statements) - Free Response (Number - digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'В вазе лежат фрукты: 10 яблок, 8 груш и 7 апельсинов. Выберите верные утверждения и запишите в ответе их номера.\n1) Яблок в вазе больше всего.\n2) Апельсины составляют менее трети всех фруктов.\n3) Груш и апельсинов в вазе поровну.\n4) Всего в вазе больше 20 фруктов.', E'Всего фруктов: 10 + 8 + 7 = 25.\nПроверяем утверждения:\n1) Яблок 10. Груш 8, Апельсинов 7. 10 - наибольшее число. Верно.\n2) Апельсинов 7. Всего 25. Треть от 25 = 25/3 ≈ 8.33. 7 < 8.33. Верно.\n3) Груш 8, Апельсинов 7. 8 ≠ 7. Неверно.\n4) Всего 25 фруктов. 25 > 20. Верно.\nВерные утверждения: 1, 2, 4.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '124', true); -- Порядок не важен, но принято по возрастанию

        -- Question 11 (Var 7 - Word Problem %/Rate with Solution) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Клиент положил в банк 10000 рублей под 5% годовых (простые проценты). Какая сумма будет на его счету через 2 года? Запишите решение и ответ.', E'Простые проценты начисляются на первоначальную сумму.\n1. Проценты за один год: 5% от 10000 руб = 0.05 * 10000 = 500 руб.\n2. Проценты за два года: 500 руб/год * 2 года = 1000 руб.\n3. Итоговая сумма на счету через 2 года: Первоначальный вклад + Начисленные проценты = 10000 + 1000 = 11000 руб.\nОтвет: 11000 рублей.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '11000', true);

        -- Question 12 (Var 7 - Drawing) - Placeholder Answer (Non-clickable)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Нарисуйте фигуру, симметричную данной относительно оси OY (вертикальной оси).\n\n[Изображение: Фигура и ось OY К8В2]', E'Нужно отразить каждую точку данной фигуры относительно вертикальной оси. Координата Y остаётся той же, координата X меняет знак.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true);

        -- Question 13 (Var 7 - Word Problem Logic with Solution) - Free Response (Yes/No + Explanation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 7, E'Среди чисел от 1 до 10 (включительно) нужно выбрать три различных числа так, чтобы их сумма равнялась 15, а произведение — 40. Можно ли это сделать? Если да, напишите эти числа.', E'Да, можно.\nИщем три различных числа от 1 до 10.\nУсловие 1: a + b + c = 15\nУсловие 2: a * b * c = 40\nРазложим 40 на множители (учитывая диапазон 1-10):\n40 = 1 * 4 * 10\n40 = 1 * 5 * 8\n40 = 2 * 2 * 10 (числа не различные, не подходит)\n40 = 2 * 4 * 5\nПроверим суммы для найденных троек различных чисел:\nТройка (1, 4, 10): Сумма = 1 + 4 + 10 = 15. Подходит!\nТройка (1, 5, 8): Сумма = 1 + 5 + 8 = 14. Не подходит.\nТройка (2, 4, 5): Сумма = 2 + 4 + 5 = 11. Не подходит.\nПодходящая тройка чисел: 1, 4, 10.\nОтвет: Да, числа 1, 4, 10.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Да, 1, 4, 10', true); -- Или просто 'Да'

    ELSE
        RAISE NOTICE 'Subject "Математика" not found. Skipping Variant 7.';
    END IF;
END $$;


-- =============================================
-- === INSERT MATH 6th Grade, VARIANT 8 (K9 V1) ===
-- =============================================
DO $$
DECLARE
    subj_math_id INT;
    q_id INT;
    variant_num INT := 8; -- Set variant number
BEGIN
    SELECT id INTO subj_math_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6;

    IF subj_math_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math Variant 8 (Komplekt 9, Variant 1)...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_id AND variant_number = variant_num;

        -- Question 1 (Var 8) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Вычислите: 48 : (–6) – 30 : (–5).', E'1. Первое деление: 48 : (–6) = –8.\n2. Второе деление: 30 : (–5) = –6.\n3. Вычитание: –8 – (–6) = –8 + 6 = –2.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2', true);

        -- Question 2 (Var 8) - Free Response (Fraction/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Вычислите: 3/7 · (1/4 + 5/12).', E'1. Сложение в скобках (общий знаменатель 12): 1/4 + 5/12 = 3/12 + 5/12 = 8/12.\n2. Сокращаем дробь в скобках: 8/12 = 2/3.\n3. Умножение: (3/7) * (2/3) = (3 * 2) / (7 * 3).\n4. Сокращаем 3: 2/7.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2/7', true);

        -- Question 3 (Var 8) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Маша прочитала 60 страниц, что составило четверть всей книги. Сколько страниц ей осталось прочитать?', E'1. Если 60 страниц - это 1/4 книги, то всего страниц в книге: 60 * 4 = 240 страниц.\n2. Маша прочитала 60 страниц.\n3. Осталось прочитать: Всего страниц - Прочитано страниц = 240 - 60 = 180 страниц.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '180', true);

        -- Question 4 (Var 8) - Free Response (Number/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Вычислите: 5,6 + 0,4 · (–11).', E'1. Умножение: 0,4 * (–11) = –4,4.\n2. Сложение: 5,6 + (–4,4) = 5,6 - 4,4 = 1,2.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.2', true); -- 1,2

        -- Question 5 (Var 8 - Image based) - Free Response (Number range, cm)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'На рисунке изображены карандаш и стол. Длина карандаша 15 см. Какова примерная длина стола? Ответ дайте в сантиметрах.\n\n[Изображение: Карандаш и стол К9В1]', E'Длина карандаша 15 см. Визуально на длину стола укладывается примерно 6-8 карандашей.\nПримерная длина стола: 15 см * 7 = 105 см.\nДопустимый диапазон от 90 до 120 сантиметров.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[от 90 до 120]', true); -- Placeholder representing the range check needed

        -- Question 6 (Var 8 - Chart based) - Free Response (Number - month index)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'На диаграмме показано количество книг, проданных магазином за первые шесть месяцев года. В каком месяце было продано ровно 50 книг?\n\n[Диаграмма: Продажи книг К9В1]', E'Смотрим на диаграмму и ищем столбец, высота которого соответствует отметке 50.\nЯнв: ~40\nФев: ~60\nМар: 50\nАпр: ~70\nМай: ~55\nИюн: ~80\nРовно 50 книг было продано в Марте (3-й месяц).', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', true); -- Ответ - номер месяца

        -- Question 7 (Var 8) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Найдите значение выражения x² – y при x = –4, y = 10.', E'1. Подстановка: (–4)² – 10\n2. Возведение в квадрат: (–4)² = (–4) * (–4) = 16.\n3. Вычитание: 16 – 10 = 6.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6', true);

        -- Question 8 (Var 8 - Matching) - Free Response (Number - 3 digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'На координатной прямой отмечены точки X, Y и Z. Установите соответствие между точками и их координатами.\n\n[Изображение: Коорд. прямая К9В1: ... X ... -1 ... Y ... 1 ... Z ...]\n\nТОЧКИ:\nX\nY\nZ\n\nКООРДИНАТЫ:\n1) 1,9\n2) -2,1\n3) -1/5\n4) 0,05\n5) -1,8\n\nВ таблице для каждой точки укажите номер соответствующей координаты. Ответ: цифры для X,Y,Z.', E'Положение точек на прямой:\nX < -1\n-1 < Y < 1 (ближе к 0)\nZ > 1\n\nПримерные значения координат:\n1) 1,9\n2) -2,1\n3) -1/5 = -0.2\n4) 0,05\n5) -1,8\n\nСоответствие:\nX (< -1) -> -2,1 (2)\nY (между -1 и 1, близко к 0) -> 0,05 (4)\nZ (> 1) -> 1,9 (1)\nОтвет: 241.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '241', true);

        -- Question 9 (Var 8 - Calculation with Solution) - Free Response (Fraction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Вычислите: 4 – 3 1/5 : (2 1/10 + 1/4). Запишите решение и ответ.', E'1) Сложение в скобках. Переводим 2 1/10 в 21/10. Общий знаменатель 20:\n   21/10 + 1/4 = 42/20 + 5/20 = 47/20.\n2) Деление. Переводим 3 1/5 в 16/5:\n   (16/5) : (47/20) = (16/5) * (20/47) = (16 * 20) / (5 * 47)\n   Сокращаем 20 и 5: (16 * 4) / (1 * 47) = 64/47.\n3) Вычитание. Представляем 4 как 4/1. Общий знаменатель 47:\n   4/1 - 64/47 = (4 * 47) / 47 - 64/47 = 188/47 - 64/47 = (188 - 64) / 47 = 124/47.\nОтвет: 124/47.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '124/47', true); -- Может быть записано как 2 30/47

        -- Question 10 (Var 8 - Multiple Statements) - Free Response (Number - digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'В календаре на Апрель (30 дней) было 10 солнечных дней, 8 облачных и 12 пасмурных. Выберите верные утверждения и запишите в ответе их номера.\n1) Солнечных дней было меньше, чем пасмурных.\n2) Облачных дней была ровно неделя.\n3) Больше половины дней месяца были без солнца (облачные или пасмурные).\n4) Солнечные дни составили ровно треть месяца.', E'Всего дней в Апреле = 30. Солнечных = 10, Облачных = 8, Пасмурных = 12. (10+8+12=30).\nПроверяем утверждения:\n1) Солнечных 10, Пасмурных 12. 10 < 12. Верно.\n2) Облачных 8. Неделя = 7 дней. 8 ≠ 7. Неверно.\n3) Дней без солнца = Облачные + Пасмурные = 8 + 12 = 20. Половина месяца = 30 / 2 = 15. 20 > 15. Верно.\n4) Солнечных 10. Треть месяца = 30 / 3 = 10. 10 = 10. Верно.\nВерные утверждения: 1, 3, 4.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '134', true); -- Порядок не важен

        -- Question 11 (Var 8 - Word Problem % with Solution) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Цена товара составляла 500 рублей. Магазин объявил скидку 15%. Сколько рублей стал стоить товар со скидкой? Запишите решение и ответ.', E'1. Начальная цена: 500 руб.\n2. Размер скидки: 15%.\n3. Сумма скидки: 15% от 500 руб = 0.15 * 500 = 75 руб.\n4. Цена со скидкой: Начальная цена - Сумма скидки = 500 - 75 = 425 руб.\n   Или: Цена * (1 - доля скидки) = 500 * (1 - 0.15) = 500 * 0.85 = 425 руб.\nОтвет: 425 рублей.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '425', true);

        -- Question 12 (Var 8 - Geometry/Spatial) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Сколько осей симметрии имеет равносторонний треугольник?', E'Равносторонний треугольник имеет 3 оси симметрии. Каждая ось проходит через вершину и середину противоположной стороны.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', true);

        -- Question 13 (Var 8 - Word Problem Logic with Solution) - Free Response (Text)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 8, E'Сумма двух натуральных чисел равна 20, а их разность равна 4. Найдите эти числа.', E'Пусть числа x и y.\nУсловие 1: x + y = 20\nУсловие 2: x - y = 4 (пусть x > y)\nСложим эти два уравнения:\n(x + y) + (x - y) = 20 + 4\n2x = 24\nx = 24 / 2 = 12\nПодставим x = 12 в первое уравнение:\n12 + y = 20\ny = 20 - 12 = 8\nПроверка: Разность 12 - 8 = 4. Верно.\nОтвет: Эти числа 12 и 8.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '12 и 8', true); -- Или '8 и 12'

    ELSE
        RAISE NOTICE 'Subject "Математика" not found. Skipping Variant 8.';
    END IF;
END $$;


-- =============================================
-- === INSERT MATH 6th Grade, VARIANT 9 (K9 V2) ===
-- =============================================
DO $$
DECLARE
    subj_math_id INT;
    q_id INT;
    variant_num INT := 9; -- Set variant number
BEGIN
    SELECT id INTO subj_math_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 6;

    IF subj_math_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math Variant 9 (Komplekt 9, Variant 2)...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_id AND variant_number = variant_num;

        -- Question 1 (Var 9) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'Вычислите: (7 – 19) · (–2) + 8.', E'1. Вычитание в скобках: 7 – 19 = –12.\n2. Умножение: –12 · (–2) = 24.\n3. Сложение: 24 + 8 = 32.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '32', true);

        -- Question 2 (Var 9) - Free Response (Fraction/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'Вычислите: 9/16 : (5/8 – 1/4).', E'1. Вычитание в скобках (общий знаменатель 8): 5/8 – 1/4 = 5/8 – 2/8 = 3/8.\n2. Деление: (9/16) : (3/8) = (9/16) * (8/3) = (9 * 8) / (16 * 3).\n3. Сокращаем: (3 * 1) / (2 * 1) = 3/2.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3/2', true); -- или 1.5 или 1 1/2

        -- Question 3 (Var 9) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'Петя потратил 40% своих денег, и у него осталось 120 рублей. Сколько денег было у Пети изначально?', E'1. Если Петя потратил 40%, то у него осталось 100% - 40% = 60% денег.\n2. Эти 60% составляют 120 рублей.\n3. Пусть X - начальная сумма денег. 0.60 * X = 120.\n4. X = 120 / 0.60 = 1200 / 6 = 200 рублей.\nИзначально было 200 рублей.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '200', true);

        -- Question 4 (Var 9) - Free Response (Number/Decimal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'Вычислите: 7,5 : 1,5 – 3 · 0,9.', E'1. Деление: 7,5 : 1,5 = 75 : 15 = 5.\n2. Умножение: 3 * 0,9 = 2,7.\n3. Вычитание: 5 – 2,7 = 2,3.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.3', true); -- 2,3

        -- Question 5 (Var 9 - Image based) - Free Response (Number range, meters)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'На рисунке изображены человек и дверь. Рост человека 1,8 м. Какова примерная высота двери? Ответ дайте в метрах.\n\n[Изображение: Человек и дверь К9В2]', E'Рост человека 1.8 м. Визуально дверь немного выше человека.\nПримерная высота двери: 2.0 - 2.2 метра.\nДопустимый диапазон от 2 до 2.2 метров.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[от 2 до 2.2]', true); -- Placeholder representing the range check needed

        -- Question 6 (Var 9 - Chart based) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'На диаграмме показано количество книг различных жанров в домашней библиотеке. Сколько всего книг жанров "Детектив" и "Фантастика"?\n\n[Диаграмма: Жанры книг К9В2]', E'Смотрим на диаграмму:\nДетектив: 25 книг\nФантастика: 30 книг\nВсего: 25 + 30 = 55 книг.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '55', true);

        -- Question 7 (Var 9) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'Найдите значение выражения 5 – |2x + y| при x = –3, y = 4.', E'1. Подстановка: 5 – |2 * (–3) + 4|\n2. Внутри модуля (умножение): 2 * (–3) = –6.\n3. Внутри модуля (сложение): –6 + 4 = –2.\n4. Модуль: |–2| = 2.\n5. Вычитание: 5 – 2 = 3.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', true);

        -- Question 8 (Var 9 - Matching) - Free Response (Number - 3 digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'На координатной прямой отмечены точки M, N и K. Установите соответствие между точками и их координатами.\n\n[Изображение: Коорд. прямая К9В2: ... M ... -1 ... N ... 1 ... K ...]\n\nТОЧКИ:\nM\nN\nK\n\nКООРДИНАТЫ:\n1) -0,9\n2) 4/5\n3) -1,1\n4) 2,05\n5) 1/2\n\nВ таблице для каждой точки укажите номер соответствующей координаты. Ответ: цифры для M,N,K.', E'Положение точек на прямой:\nM < -1\n-1 < N < 1\nK > 1\n\nПримерные значения координат:\n1) -0,9\n2) 4/5 = 0.8\n3) -1,1\n4) 2,05\n5) 1/2 = 0.5\n\nСоответствие:\nM (< -1) -> -1,1 (3)\nN (между -1 и 1, ближе к 1) -> 4/5 = 0.8 (2)\nK (> 1) -> 2,05 (4)\nОтвет: 324.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '324', true);

        -- Question 9 (Var 9 - Calculation with Solution) - Free Response (Fraction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'Вычислите: (1/3 + 7/9) · 3/5 – 1/2. Запишите решение и ответ.', E'1) Сложение в скобках (общий знаменатель 9):\n   1/3 + 7/9 = 3/9 + 7/9 = 10/9.\n2) Умножение:\n   (10/9) * (3/5) = (10 * 3) / (9 * 5)\n   Сокращаем: (2 * 1) / (3 * 1) = 2/3.\n3) Вычитание (общий знаменатель 6):\n   2/3 - 1/2 = 4/6 - 3/6 = 1/6.\nОтвет: 1/6.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1/6', true);

        -- Question 10 (Var 9 - Multiple Statements) - Free Response (Number - digits)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'В спортивной секции занимаются 8 бегунов, 10 пловцов и 7 лыжников. Выберите верные утверждения и запишите в ответе их номера.\n1) Лыжников в секции меньше всего.\n2) Бегуны составляют больше 30% всех спортсменов.\n3) Пловцов в секции не меньше 10.\n4) Всего в секции занимается меньше 25 спортсменов.', E'Всего спортсменов: 8 + 10 + 7 = 25.\nПроверяем утверждения:\n1) Лыжников 7. Бегунов 8, Пловцов 10. 7 - наименьшее число. Верно.\n2) Бегунов 8. Всего 25. Доля бегунов: 8/25 = 32/100 = 32%. 32% > 30%. Верно.\n3) Пловцов 10. 10 не меньше 10 (равно). Верно.\n4) Всего 25 спортсменов. 25 не меньше 25. Неверно.\nВерные утверждения: 1, 2, 3.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '123', true); -- Порядок не важен

        -- Question 11 (Var 9 - Word Problem Rate with Solution) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'Поезд проехал 150 км за 2,5 часа. С какой скоростью ехал поезд? Ответ дайте в км/ч. Запишите решение и ответ.', E'1. Расстояние (S) = 150 км.\n2. Время (t) = 2,5 часа.\n3. Скорость (v) = Расстояние / Время = S / t.\n4. v = 150 км / 2,5 ч.\n5. Чтобы разделить на 2,5, можно умножить числитель и знаменатель на 10: v = 1500 / 25 км/ч.\n6. 1500 / 25 = (150 * 10) / 25 = (6 * 25 * 10) / 25 = 6 * 10 = 60 км/ч.\nОтвет: 60 км/ч.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '60', true);

        -- Question 12 (Var 9 - Geometry/Spatial) - Free Response (Number)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'Из куска проволоки сначала согнули квадрат со стороной 6 см. Потом проволоку разогнули и согнули из неё равносторонний треугольник. Чему равна длина стороны треугольника?', E'1. Находим периметр квадрата (длину проволоки): P_квадрата = 4 * сторона = 4 * 6 см = 24 см.\n2. Длина проволоки равна 24 см.\n3. Из этой проволоки согнули равносторонний треугольник. Периметр треугольника равен длине проволоки: P_треугольника = 24 см.\n4. У равностороннего треугольника все 3 стороны равны. Длина стороны треугольника = P_треугольника / 3.\n5. Сторона треугольника = 24 см / 3 = 8 см.\nОтвет: 8 см.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '8', true);

        -- Question 13 (Var 9 - Word Problem Logic with Solution) - Free Response (Text)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_id, 9, E'В коробке лежат синие и красные ручки, всего 15 штук. Синих ручек на 3 больше, чем красных. Сколько синих и сколько красных ручек в коробке?', E'Пусть К - количество красных ручек.\nТогда синих ручек С = К + 3.\nВсего ручек С + К = 15.\nПодставляем выражение для С:\n(К + 3) + К = 15\n2К + 3 = 15\n2К = 15 - 3\n2К = 12\nК = 12 / 2 = 6 (красных ручек)\nНаходим количество синих ручек:\nС = К + 3 = 6 + 3 = 9 (синих ручек)\nПроверка: Всего = 6 + 9 = 15. Синих на 3 больше красных (9 - 6 = 3). Верно.\nОтвет: 9 синих и 6 красных ручек.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9 синих, 6 красных', true); -- Или '6 красных, 9 синих'

    ELSE
        RAISE NOTICE 'Subject "Математика" not found. Skipping Variant 9.';
    END IF;
END $$;