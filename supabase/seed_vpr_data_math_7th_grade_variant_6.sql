-- =============================================
-- === INSERT MATH 7th Grade, VARIANT 6 (Kit 3, Var 2 - HYPOTHETICAL) ===
-- === Based on structure of Kit 3, Var 1 ===
-- =============================================
DO $$
DECLARE
    subj_math_7_id INT;
    q_id INT;
    variant_num INT := 6; -- Set variant number
BEGIN
    SELECT id INTO subj_math_7_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 7;

    IF subj_math_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math 7th Grade Variant 6 (Kit 3, Var 2)...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num;

        -- Question 1 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (2/3 + 3/4) : 17/6.',
                E'1. Сложение в скобках: 2/3 + 3/4. Общий знаменатель 12.\n   2/3 = 8/12; 3/4 = 9/12.\n   8/12 + 9/12 = 17/12.\n2. Деление: (17/12) : (17/6). Переворачиваем вторую дробь и умножаем:\n   (17/12) * (6/17). Сокращаем 17 и 6 с 12.\n   (1/12) * (6/1) = (1/2) * (1/1) = 1/2.\n3. Ответ: 1/2 или 0,5.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0.5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0,5', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1/2', true); -- Allow fraction
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '17/72', false);

        -- Question 2 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (−2,5 + 4,1) ⋅ (−1,5).',
                E'1. Сложение в скобках: -2,5 + 4,1 = 4,1 - 2,5 = 1,6.\n2. Умножение: 1,6 * (-1,5).\n   Результат будет отрицательным.\n   1,6 * 1,5 = 16 * 15 / 100 = 240 / 100 = 2,4.\n3. Ответ: -2,4.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2.4', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2,4', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.4', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-9.9', false); -- (-2.5 + 4.1 * (-1.5))?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6.15', false); -- -2.5 + (4.1 * -1.5)?

        -- Question 3 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В анкете сотрудника указана дата рождения: 15 мая 1982 года. Сколько полных лет было этому сотруднику на 1 октября 2019 года?',
                E'1. Найдём разницу в годах: 2019 - 1982 = 37 лет.\n2. Проверим, наступил ли день рождения в 2019 году к 1 октября.\n   День рождения 15 мая. 1 октября наступает после 15 мая.\n3. Значит, сотруднику уже исполнилось 37 лет.\nОтвет: 37.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '37', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '36', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1982', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2019', false);

        -- Question 4 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Велосипедист проезжает 12,5 метров за каждую секунду. Выразите скорость велосипедиста в километрах в час.',
                E'Переводим скорость из м/с в км/ч умножением на 3,6.\nСкорость = 12,5 м/с.\nСкорость в км/ч = 12,5 * 3,6.\n12,5 * 3,6 = (25/2) * (36/10) = (25/2) * (18/5) = (25/5) * (18/2) = 5 * 9 = 45 км/ч.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '45', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '12.5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3.47', false); -- 12.5 / 3.6
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '750', false); -- 12.5 * 60

        -- Question 5 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Стоимость проезда в автобусе выросла с 5500 рублей до 5830 рублей в месяц. На сколько процентов выросла стоимость проезда?',
                E'1. Найдём абсолютное подорожание (разницу в цене):\n   5830 - 5500 = 330 рублей.\n2. Найдём, сколько процентов эта разница составляет от первоначальной цены (5500 рублей).\n   Процент подорожания = (Разница / Старая цена) * 100%\n   Процент = (330 / 5500) * 100%\n   Процент = (330 / 55) % \n   Делим 330 на 55: 330 / 55 = 6.\n   Процент подорожания = 6%.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6%', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '330', false); -- Absolute difference
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5.66', false); -- Approx (330/5830)*100
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '106', false);

        -- Question 6 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В классе 25 учеников. Из них 15 увлекаются математикой, а 10 — физикой.\nВыберите верные утверждения и запишите в ответе их номера.\n1) Найдётся 2 ученика, которые увлекаются и математикой, и физикой.\n2) Максимум 10 учеников могут увлекаться и математикой, и физикой.\n3) Найдётся 10 учеников, которые не увлекаются математикой.\n4) Найдётся 15 учеников, которые не увлекаются физикой.',
                E'Данные: Всего=25, Математика(М)=15, Физика(Ф)=10.\nПроверка:\n1) Найдётся 2 (М И Ф)? Мин кол-во (М И Ф) = М + Ф - Всего = 15 + 10 - 25 = 0. Не гарантировано, что найдётся хотя бы один, а тем более 2. Неверно.\n2) Максимум 10 (М И Ф)? Макс кол-во (М И Ф) = min(М, Ф) = min(15, 10) = 10. Верно.\n3) Найдётся 10 (Не М)? Кол-во (Не М) = Всего - М = 25 - 15 = 10. Да, их ровно 10. Верно.\n4) Найдётся 15 (Не Ф)? Кол-во (Не Ф) = Всего - Ф = 25 - 10 = 15. Да, их ровно 15. Верно.\nВерные утверждения: 2, 3 и 4.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '234', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '243', true); -- Allow permutations
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '324', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '342', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '423', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '432', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '23', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '34', false);

        -- Question 7 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На диаграмме представлена информация о продажах книг по жанрам в магазине за месяц. Всего было продано 50 000 книг. Определите по диаграмме, сколько примерно книг относится к жанру «Детективы».\n\n[Круговая диаграмма продаж книг]',
                E'Найдите на диаграмме сектор "Детективы". Оцените его долю. Визуально он может составлять примерно 8-12% от всего круга.\nВозьмём оценку 10%. Количество = 0,10 * 50 000 = 5000.\nВозможный допустимый диапазон ответа: 4000-6000.', 7)
        RETURNING id INTO q_id;
        -- Hypothetical answer range
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4000-6000', true); -- Representing the allowed range

        -- Question 8 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'График функции y = -2x + b проходит через точку (3, -1). Найдите коэффициент b.',
                E'Подставим координаты точки (x=3, y=-1) в уравнение функции y = -2x + b:\n-1 = -2 * (3) + b\n-1 = -6 + b\nПеренесем -6 влево:\n-1 + 6 = b\n5 = b\nОтвет: b = 5.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-7', false); -- -1 - 6
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false);

        -- Question 9 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Решите уравнение 2(y+3) = 15 - (y-1).',
                E'1. Раскроем скобки: 2y + 6 = 15 - y + 1.\n2. Упростим правую часть: 2y + 6 = 16 - y.\n3. Переносим y влево, числа вправо:\n   2y + y = 16 - 6.\n4. Упрощаем: 3y = 10.\n5. Находим y: y = 10/3.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10/3', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3.33', false); -- Approx decimal
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false); -- 6 = 16 - 2y => 2y=10 => y=5? Mistake path

        -- Question 10 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Для покраски стен комнаты требуется 5 литров краски на каждые 10 кв.м. Площадь стен комнаты составляет 54 кв.м. Хватит ли 5 банок краски по 5 литров каждая для покраски всех стен? Запишите решение и ответ.',
                E'1. Расход краски: 5 л / 10 кв.м = 0,5 л/кв.м.\n2. Сколько краски нужно на 54 кв.м:\n   Нужно = 54 кв.м * 0,5 л/кв.м = 27 литров.\n3. Сколько краски есть:\n   Есть = 5 банок * 5 л/банка = 25 литров.\n4. Сравнение: Нужно 27 л, есть 25 л. 25 < 27.\nОтвет: Нет, не хватит.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Нет', true);

        -- Question 11 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (a-3)² - (a+3)² при a = − 1/6.',
                E'Упростим выражение, используя формулу разности квадратов x² - y² = (x-y)(x+y).\nЗдесь x = (a-3), y = (a+3).\n1. (x - y) = (a-3) - (a+3) = a - 3 - a - 3 = -6.\n2. (x + y) = (a-3) + (a+3) = a - 3 + a + 3 = 2a.\n3. Выражение = (x - y)(x + y) = (-6) * (2a) = -12a.\n4. Подставляем a = -1/6:\n   -12 * (-1/6) = 12 / 6 = 2.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '18', false); -- -6a+9 - (6a+9)?

        -- Question 12 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Отметьте и подпишите на координатной прямой точки A(2,7), B(-5/3), C(9/4).\n\n[Координатная прямая]',
                E'Нужно расположить точки на прямой.\n*   A(2,7) - между 2 и 3, ближе к 3.\n*   B(-5/3) = -1 2/3 ≈ -1.67. Находится между -1 и -2, ближе к -2.\n*   C(9/4) = 2 1/4 = 2.25. Находится между 2 и 3, ближе к 2.\nСравнение A и C: 2.7 > 2.25. Значит, C левее A.\nПорядок слева направо: B, C, A.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true); -- Placeholder for drawing task

        -- Question 13 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите периметр треугольника с вершинами в точках (0,0), (4,0) и (0,3).\n\n[Рисунок или координаты]',
                E'1. Найдём длины сторон треугольника.\n   Сторона 1 (между (0,0) и (4,0)): Длина = |4 - 0| = 4.\n   Сторона 2 (между (0,0) и (0,3)): Длина = |3 - 0| = 3.\n   Сторона 3 (между (4,0) и (0,3)): Это гипотенуза прямоугольного треугольника с катетами 4 и 3. Длина = sqrt(4² + 3²) = sqrt(16 + 9) = sqrt(25) = 5.\n2. Периметр - сумма длин всех сторон.\n   P = 4 + 3 + 5 = 12.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '12', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7', false); -- Sum of legs
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5', false); -- Hypotenuse
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6', false); -- Area

        -- Question 14 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Угол AOB равен 90°. Луч OC является биссектрисой угла AOB. Луч OD является биссектрисой угла AOC. Найдите величину угла BOD. Ответ дайте в градусах.',
                E'1. ∠AOB = 90°.\n2. OC - биссектриса ∠AOB, значит ∠AOC = ∠BOC = ∠AOB / 2 = 90° / 2 = 45°.\n3. OD - биссектриса ∠AOC, значит ∠AOD = ∠COD = ∠AOC / 2 = 45° / 2 = 22,5°.\n4. Угол BOD состоит из углов BOC и COD.\n   ∠BOD = ∠BOC + ∠COD = 45° + 22,5° = 67,5°.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '67.5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '67,5', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '45', false); -- BOC
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '22.5', false); -- COD
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '90', false);

        -- Question 15 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочитайте текст. Автомобиль начал движение из пункта А в 10:00. Первые два часа он ехал со скоростью 60 км/ч. Затем он сделал остановку на 1 час. После остановки он продолжил движение со скоростью 80 км/ч в течение полутора часов. Постройте график зависимости расстояния автомобиля от пункта А от времени с 10:00 до 14:30.\n\n[Система координат Время - Расстояние]',
                E'Отметим точки на графике (Время, Расстояние от А):\n*   10:00: (10:00, 0) - Начало.\n*   12:00 (10:00 + 2ч): Расстояние = 2 ч * 60 км/ч = 120 км. Точка (12:00, 120).\n*   13:00 (12:00 + 1ч остановки): Расстояние не изменилось. Точка (13:00, 120).\n*   14:30 (13:00 + 1.5ч): Автомобиль проехал еще 1.5 ч * 80 км/ч = 120 км. Общее расстояние = 120 км (до остановки) + 120 км (после) = 240 км. Точка (14:30, 240).\nСоедините точки (10:00, 0), (12:00, 120), (13:00, 120), (14:30, 240) отрезками.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[График]', true); -- Placeholder for graph task

        -- Question 16 (Var 6)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Расстояние между пунктами А и В равно 300 км. Из пункта А в пункт В выехал автомобиль со скоростью 60 км/ч. Через час навстречу ему из пункта В выехал второй автомобиль со скоростью 90 км/ч. На каком расстоянии от пункта А они встретятся? Запишите решение и ответ.',
                E'1. Через 1 час (когда выехал второй автомобиль) первый автомобиль проехал: S1 = 60 км/ч * 1 ч = 60 км.\n2. Расстояние между ними в этот момент: S_ост = 300 км - 60 км = 240 км.\n3. Скорость сближения: V_сбл = V1 + V2 = 60 км/ч + 90 км/ч = 150 км/ч.\n4. Время до встречи (с момента выезда второго): t_встр = S_ост / V_сбл = 240 км / 150 км/ч = 24/15 ч = 8/5 ч = 1,6 часа.\n5. За это время первый автомобиль проехал еще: S1_доп = V1 * t_встр = 60 км/ч * 1,6 ч = 96 км.\n6. Общее расстояние от пункта А до места встречи (путь первого автомобиля): S_А_встр = S1 + S1_доп = 60 км + 96 км = 156 км.\nРешение: За 1 час первый проехал 60 км. Осталось 240 км. Скорость сближения 60+90=150 км/ч. Время до встречи t=240/150=1,6 ч. Место встречи от А: 60 км (проехал до выезда второго) + 60 км/ч * 1,6 ч = 60 + 96 = 156 км.\nОтвет: 156.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '156', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '144', false); -- Distance from B (90*1.6)
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.6', false); -- Time
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '240', false); -- Remaining distance

    ELSE
        RAISE NOTICE 'Subject "Математика" for grade 7 not found. Skipping Variant 6.';
    END IF;

END $$;

-- /supabase/seed_vpr_data_math_7th_grade_variant_7.sql

-- =============================================
-- === INSERT MATH 7th Grade, VARIANT 7 (Kit 4, Var 1 - HYPOTHETICAL) ===
-- =============================================
DO $$
DECLARE
    subj_math_7_id INT;
    q_id INT;
    variant_num INT := 7; -- Set variant number
BEGIN
    SELECT id INTO subj_math_7_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 7;

    IF subj_math_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math 7th Grade Variant 7 (Kit 4, Var 1)...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num;

        -- Question 1 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (3/4 - 1/6) : 5/12.',
                E'1. Вычитание в скобках: 3/4 - 1/6. Общий знаменатель 12.\n   3/4 = 9/12; 1/6 = 2/12.\n   9/12 - 2/12 = 7/12.\n2. Деление: (7/12) : (5/12). Переворачиваем вторую дробь и умножаем:\n   (7/12) * (12/5). Сокращаем 12.\n   7/5.\n3. Ответ: 7/5 или 1,4.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.4', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1,4', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7/5', true); -- Allow fraction
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5/7', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '35/144', false);

        -- Question 2 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения −0,5 ⋅ (3,2 − 5,8).',
                E'1. Вычитание в скобках: 3,2 - 5,8 = -(5,8 - 3,2) = -2,6.\n2. Умножение: -0,5 * (-2,6).\n   Результат будет положительным.\n   0,5 * 2,6 = (1/2) * 2,6 = 2,6 / 2 = 1,3.\n3. Ответ: 1,3.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.3', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1,3', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-1.3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4.5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-4.5', false);

        -- Question 3 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Плотность населения некоторого региона составляет 50 человек на км². Площадь региона равна 1200 км². Определите численность населения этого региона.',
                E'Численность населения = Плотность населения * Площадь.\nЧисленность = 50 чел/км² * 1200 км².\nЧисленность = 50 * 1200 = 60 000 человек.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '60000', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '60 000', true); -- Allow space
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '24', false); -- 1200 / 50
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1250', false); -- 1200 + 50
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '50', false);

        -- Question 4 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Скорость автомобиля равна 90 км/ч. Выразите его скорость в метрах в секунду.',
                E'Переводим скорость из км/ч в м/с делением на 3,6.\nСкорость = 90 км/ч.\nСкорость в м/с = 90 / 3,6.\n90 / 3,6 = 900 / 36 = 100 / 4 = 25 м/с.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '25', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '90', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '324', false); -- 90 * 3.6
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1500', false); -- 90 * 1000 / 60

        -- Question 5 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'После снижения цены на 15% товар стал стоить 1700 рублей. Какова была первоначальная цена товара?',
                E'Новая цена 1700 рублей составляет 100% - 15% = 85% от первоначальной цены (X).\n0,85 * X = 1700\nX = 1700 / 0,85 = 170000 / 85.\nДелим 1700 на 85: 1700 / 85 = 20.\nЗначит, X = 20 * 100 = 2000 рублей.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2000', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1955', false); -- 1700 * 1.15
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1445', false); -- 1700 * 0.85
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '255', false); -- 15% of 1700?

        -- Question 6 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Известно, что коробка A тяжелее коробки B, коробка C легче коробки D, а коробка A легче коробки C.\nВыберите верные утверждения и запишите в ответе их номера.\n1) Коробка B самая тяжёлая из четырёх.\n2) Коробка D самая тяжёлая из четырёх.\n3) Коробка A легче коробки D.\n4) Коробка B и коробка C весят одинаково.',
                E'Запишем условия: A > B, C < D, A < C.\nОбъединим неравенства: B < A < C < D.\nПроверим утверждения:\n1) B самая тяжёлая? Неверно, B самая лёгкая.\n2) D самая тяжёлая? Верно.\n3) A легче D (A < D)? Верно (следует из B < A < C < D).\n4) B = C? Неверно (т.к. B < A < C).\nВерные утверждения: 2 и 3.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '23', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '32', true); -- Allow reversed order
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);

        -- Question 7 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На диаграмме показаны продажи магазина за три дня. На сколько единиц товара продажи во вторник превысили продажи в среду?\n\n[Столбчатая диаграмма: Пн=50, Вт=60, Ср=40]',
                E'1. Найдите по диаграмме продажи во вторник (Вт). Они равны 60.\n2. Найдите по диаграмме продажи в среду (Ср). Они равны 40.\n3. Вычислите разницу: Продажи Вт - Продажи Ср = 60 - 40 = 20.\nОтвет: на 20 единиц.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '20', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '60', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '40', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '100', false); -- Sum

        -- Question 8 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение функции y = x² - 3x + 1 при x = -2.',
                E'Подставим x = -2 в выражение для y:\ny = (-2)² - 3*(-2) + 1\ny = 4 - (-6) + 1\ny = 4 + 6 + 1\ny = 11.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '11', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-1', false); -- 4 - 6 + 1?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-9', false); -- -4 + 6 + 1?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9', false);

        -- Question 9 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Решите уравнение x/3 - 1 = (x+2)/5.',
                E'1. Умножим обе части уравнения на общий знаменатель дробей (3 и 5), то есть на 15, чтобы избавиться от дробей:\n   15 * (x/3) - 15 * 1 = 15 * (x+2)/5\n   5x - 15 = 3 * (x+2)\n2. Раскроем скобки в правой части:\n   5x - 15 = 3x + 6.\n3. Переносим x влево, числа вправо:\n   5x - 3x = 6 + 15.\n4. Упрощаем: 2x = 21.\n5. Находим x: x = 21 / 2 = 10,5.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10.5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10,5', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '21/2', true); -- Allow fraction
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-4.5', false); -- 5x-15=3x-6 => 2x=9?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '8.5', false);

        -- Question 10 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Рецепт требует 300 г муки для выпечки 12 печений. Сколько печений можно испечь из 1 кг муки?',
                E'1. Переведём 1 кг муки в граммы: 1 кг = 1000 г.\n2. Найдём, сколько муки нужно на 1 печенье:\n   Расход = 300 г / 12 печ = 25 г/печ.\n3. Найдём, сколько печений можно сделать из 1000 г муки:\n   Количество = Всего муки / Расход на 1 печ\n   Количество = 1000 г / (25 г/печ) = 40 печений.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '40', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '36', false); -- 12 * (1000/300)? not integer
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false); -- 12 / 3?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '30', false);

        -- Question 11 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (2x-y)(2x+y) - 4x² при y = -3.',
                E'Упростим выражение.\n1. Первое слагаемое - разность квадратов: (2x-y)(2x+y) = (2x)² - y² = 4x² - y².\n2. Выражение: (4x² - y²) - 4x².\n3. Упрощаем: 4x² - y² - 4x² = -y².\n4. Подставляем y = -3:\n   -(-3)² = -(9) = -9.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-9', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9', false); -- (-y)^2 ?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);

        -- Question 12 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Отметьте и подпишите на координатной прямой точки A(-1,9), B(5/2), C(-8/5).\n\n[Координатная прямая]',
                E'Нужно расположить точки на прямой.\n*   A(-1,9) - между -1 и -2, очень близко к -2.\n*   B(5/2) = 2,5. Находится посередине между 2 и 3.\n*   C(-8/5) = -1 3/5 = -1,6. Находится между -1 и -2, ближе к -2, но правее A (-1.6 > -1.9).\nПорядок слева направо: A, C, B.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true); -- Placeholder for drawing task

        -- Question 13 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите площадь параллелограмма, изображённого на клетчатой бумаге с размером клетки 1x1. Вершины имеют координаты (0,0), (5,0), (7,3), (2,3).\n\n[Рисунок параллелограмма на сетке]',
                E'1. Можно использовать формулу площади параллелограмма: Площадь = основание * высота.\n   Основание можно взять вдоль оси X, между точками (0,0) и (5,0). Длина основания = 5.\n   Высота - это перпендикулярное расстояние между основанием и противоположной стороной. Противоположная сторона лежит на прямой y=3. Основание лежит на y=0. Высота = 3.\n   Площадь = 5 * 3 = 15.\n2. Можно использовать формулу Пика (если вершины в узлах сетки): S = В + Г/2 - 1, где В - внутр. точки, Г - точки на границе. Нарисовав, можно посчитать. В = 12, Г = 8. S = 12 + 8/2 - 1 = 12 + 4 - 1 = 15.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '15', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '16', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '14', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '15.5', false);

        -- Question 14 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В равнобедренном треугольнике ABC боковые стороны AB и BC равны. Угол при вершине B равен 80°. Найдите угол при основании A. Ответ дайте в градусах.',
                E'1. Треугольник ABC равнобедренный с боковыми сторонами AB и BC. Значит, основание - AC.\n2. Углы при основании равны: ∠A = ∠C.\n3. Угол при вершине (противоположной основанию) равен ∠B = 80°.\n4. Сумма углов треугольника равна 180°:\n   ∠A + ∠B + ∠C = 180°\n   ∠A + 80° + ∠A = 180° (т.к. ∠A = ∠C)\n   2 * ∠A = 180° - 80°\n   2 * ∠A = 100°\n   ∠A = 100° / 2 = 50°.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '50', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '80', false); -- Angle B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '100', false); -- 180 - 80
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '60', false);

        -- Question 15 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочитайте текст. Посещаемость сайта началась со 100 уникальных посетителей в понедельник. Во вторник она выросла на 20%. В среду — упала на 10 посетителей по сравнению со вторником. В четверг посещаемость была такой же, как во вторник. В пятницу она увеличилась на 38 посетителей по сравнению с четвергом и достигла недельного максимума. В субботу посещаемость снизилась на 30% по сравнению с пятницей. В воскресенье пришло на 10 посетителей больше, чем в субботу. Постройте график зависимости числа посетителей от дня недели.\n\n[Система координат День недели - Посетители]',
                E'Рассчитаем посетителей по дням:\n*   Пн: 100 (дано)\n*   Вт: 100 + 20% от 100 = 100 + 20 = 120\n*   Ср: 120 - 10 = 110\n*   Чт: 120 (как во Вт)\n*   Пт: 120 + 38 = 158 (максимум)\n*   Сб: 158 - 30% от 158 = 158 - (0,3 * 158) = 158 - 47,4 = 110,6. Округлим до 111 (или 110? Обычно в таких задачах целые числа. Перепроверим: возможно, имелось ввиду 30 посетителей? Или % от другого дня?). Если % от четверга (120)? 120*0.3=36. 120-36=84? Если % от Среды(110)? 110*0.3=33. 110-33=77? Возьмем по тексту: % от пятницы. 110.6 -> 111.\n*   Вс: 111 + 10 = 121\nОтметьте точки (Пн, 100), (Вт, 120), (Ср, 110), (Чт, 120), (Пт, 158), (Сб, 111), (Вс, 121) и соедините их отрезками.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[График]', true); -- Placeholder for graph task

        -- Question 16 (Var 7)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Два велосипедиста выезжают одновременно навстречу друг другу из двух пунктов, расстояние между которыми 100 км. Скорость первого велосипедиста 15 км/ч, скорость второго — 25 км/ч. Через сколько часов они встретятся? Запишите решение и ответ.',
                E'1. Велосипедисты движутся навстречу друг другу, значит, их скорости складываются для нахождения скорости сближения.\n   Скорость сближения V_сбл = V1 + V2 = 15 км/ч + 25 км/ч = 40 км/ч.\n2. Расстояние между ними S = 100 км.\n3. Время до встречи t_встр находится по формуле: Время = Расстояние / Скорость.\n   t_встр = S / V_сбл = 100 км / 40 км/ч.\n   t_встр = 10 / 4 = 5 / 2 = 2,5 часа.\nРешение: Скорость сближения велосипедистов равна 15 + 25 = 40 км/ч. Чтобы преодолеть расстояние 100 км с этой скоростью, потребуется время t = 100 км / 40 км/ч = 2,5 часа.\nОтвет: 2.5.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2,5', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '150', false); -- In minutes
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false); -- 100 / 25?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6.67', false); -- 100 / 15?

    ELSE
        RAISE NOTICE 'Subject "Математика" for grade 7 not found. Skipping Variant 7.';
    END IF;

END $$;

-- /supabase/seed_vpr_data_math_7th_grade_variant_8.sql

-- =============================================
-- === INSERT MATH 7th Grade, VARIANT 8 (Kit 4, Var 2 - HYPOTHETICAL) ===
-- =============================================
DO $$
DECLARE
    subj_math_7_id INT;
    q_id INT;
    variant_num INT := 8; -- Set variant number
BEGIN
    SELECT id INTO subj_math_7_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 7;

    IF subj_math_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math 7th Grade Variant 8 (Kit 4, Var 2)...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num;

        -- Question 1 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения 5/8 - 1/4 ⋅ 3/2.',
                E'1. Сначала выполняем умножение: 1/4 * 3/2 = (1*3) / (4*2) = 3/8.\n2. Затем выполняем вычитание: 5/8 - 3/8 = (5-3)/8 = 2/8.\n3. Сокращаем дробь: 2/8 = 1/4.\n4. Ответ: 1/4 или 0,25.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0.25', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0,25', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1/4', true); -- Allow fraction
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false); -- (5/8-1/4)*3/2 = (3/8)*3/2=9/16?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0.5', false);

        -- Question 2 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (9,1 − 10,5) / 0,7.',
                E'1. Вычитание в скобках: 9,1 - 10,5 = -(10,5 - 9,1) = -1,4.\n2. Деление: (-1,4) / 0,7.\n   Результат будет отрицательным.\n   1,4 / 0,7 = 14 / 7 = 2.\n3. Ответ: -2.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-0.2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.8', false); -- 9.1 - (10.5/0.7) = 9.1 - 15 = -5.9?

        -- Question 3 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Поезд отправляется из пункта А в 10:15 и прибывает в пункт Б в 14:45 того же дня. Сколько времени поезд находится в пути?',
                E'Нужно вычесть время отправления из времени прибытия.\nВремя в пути = 14 ч 45 мин - 10 ч 15 мин.\n1. Вычитаем минуты: 45 мин - 15 мин = 30 мин.\n2. Вычитаем часы: 14 ч - 10 ч = 4 ч.\nВремя в пути: 4 часа 30 минут.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4 ч 30 мин', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4.5 ч', true); -- Allow decimal hours
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '270 мин', true); -- Allow minutes
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4 ч 15 мин', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5 ч 00 мин', false);

        -- Question 4 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Скорость пешехода равна 500 м/мин. Выразите его скорость в километрах в час.',
                E'1. Переведём метры в километры: 500 м = 0,5 км.\n2. Переведём минуты в часы: 1 мин = 1/60 часа.\n3. Скорость = 500 м / 1 мин = 0,5 км / (1/60 ч).\n4. Чтобы разделить на дробь, умножаем на перевёрнутую: 0,5 * (60/1) = 0,5 * 60 = 30 км/ч.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '30', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '500', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '8.33', false); -- 500/60?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '30000', false); -- 500*60?

        -- Question 5 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В тесте было 40 вопросов. Ученик ответил правильно на 32 вопроса. Какой процент вопросов ученик ответил правильно?',
                E'Нужно найти, какую долю составляют правильные ответы от общего числа вопросов, и выразить в процентах.\nДоля = (Правильные ответы) / (Всего вопросов) = 32 / 40.\nСокращаем дробь: 32/40 = (8 * 4) / (8 * 5) = 4/5.\nПереводим долю в проценты, умножая на 100%:\n(4/5) * 100% = (4 * 100) / 5 % = 4 * 20 % = 80%.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '80', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '80%', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '32', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '20', false); -- Percentage incorrect (40-32=8; 8/40*100=20)
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '125', false); -- 40/32*100?

        -- Question 6 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Анна бегает быстрее Бориса. Карл бегает медленнее Дениса. Борис бегает быстрее Карла.\nВыберите верные утверждения и запишите в ответе их номера.\n1) Анна бегает быстрее Дениса.\n2) Денис бегает быстрее Бориса.\n3) Анна бегает быстрее Карла.\n4) Борис бегает медленнее Дениса.',
                E'Запишем условия скоростями: A > B, C < D, B > C.\nОбъединим известные: A > B > C. Также C < D.\nСравнить D с A и B напрямую нельзя.\nПроверим утверждения:\n1) A > D? Неизвестно. Может быть A>D или D>A, или D=A (маловероятно).\n2) D > B? Неизвестно. Мы знаем D>C и B>C, но сравнить D и B нельзя.\n3) A > C? Да, т.к. A > B и B > C, то A > C. Верно.\n4) B < D? Неизвестно. (см. п.2).\nЕдинственное верное утверждение: 3.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '23', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '34', false);

        -- Question 7 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На графике показано изменение температуры воздуха в течение дня. В 9:00 температура была 15°C, а в 12:00 она достигла 21°C. На сколько градусов повысилась температура за это время?\n\n[График изменения температуры]',
                E'1. Температура в 12:00 = 21°C.\n2. Температура в 9:00 = 15°C.\n3. Повышение температуры = Температура(12:00) - Температура(9:00).\n   Повышение = 21°C - 15°C = 6°C.\nОтвет: на 6 градусов.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '21', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '15', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '36', false); -- Sum

        -- Question 8 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение функции y = 10 - x³ при x = -1.',
                E'Подставим x = -1 в выражение для y:\ny = 10 - (-1)³\nСначала вычисляем куб: (-1)³ = (-1)*(-1)*(-1) = 1*(-1) = -1.\ny = 10 - (-1)\ny = 10 + 1\ny = 11.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '11', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9', false); -- 10 - 1?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13', false); -- 10 - (-3)?

        -- Question 9 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Решите уравнение (4x - 1)/3 = (x + 5)/2.',
                E'1. Используем свойство пропорции (перекрёстное умножение) или умножим обе части на общий знаменатель 6:\n   2 * (4x - 1) = 3 * (x + 5)\n2. Раскроем скобки:\n   8x - 2 = 3x + 15.\n3. Переносим x влево, числа вправо:\n   8x - 3x = 15 + 2.\n4. Упрощаем: 5x = 17.\n5. Находим x: x = 17 / 5 = 3,4.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3.4', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3,4', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '17/5', true); -- Allow fraction
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-1.27', false); -- 11x = 13? Error path
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.45', false);

        -- Question 10 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Для приготовления одного стакана апельсинового сока нужно 2 апельсина. Сколько стаканов сока можно приготовить из 15 апельсинов?',
                E'Чтобы найти количество стаканов, нужно общее количество апельсинов разделить на количество апельсинов, необходимых для одного стакана.\nКоличество стаканов = (Всего апельсинов) / (Апельсинов на стакан)\nКоличество стаканов = 15 / 2 = 7,5.\nТак как нельзя приготовить половину стакана сока по этому рецепту (предполагается, что нужны целые стаканы), берём целую часть от деления.\nОтвет: 7 стаканов.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '8', false); -- Rounded up?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7.5', false); -- Exact division
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '30', false); -- 15 * 2?

        -- Question 11 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения a(a+3) - (a-2)² при a = 2.',
                E'Упростим выражение.\n1. a(a+3) = a² + 3a.\n2. (a-2)² = a² - 2*a*2 + 2² = a² - 4a + 4.\n3. Выражение: (a² + 3a) - (a² - 4a + 4).\n4. Раскроем скобки и приведём подобные: a² + 3a - a² + 4a - 4 = (a²-a²) + (3a+4a) - 4 = 7a - 4.\n5. Подставляем a = 2:\n   7 * (2) - 4 = 14 - 4 = 10.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6', false); -- 2(2+3)-(2-2)^2 = 10-0=10. Alt: a^2+3a - a^2+4a-4 = 7a-4.
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '14', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false);

        -- Question 12 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Отметьте и подпишите на координатной прямой точки A(0,8), B(-11/5), C(13/10).\n\n[Координатная прямая]',
                E'Нужно расположить точки на прямой.\n*   A(0,8) - между 0 и 1, ближе к 1.\n*   B(-11/5) = -2 1/5 = -2,2. Находится между -2 и -3, ближе к -2.\n*   C(13/10) = 1 3/10 = 1,3. Находится между 1 и 2, ближе к 1.\nСравнение A и C: 0.8 < 1.3. Значит, A левее C.\nПорядок слева направо: B, A, C.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true); -- Placeholder for drawing task

        -- Question 13 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите площадь трапеции, изображённой на клетчатой бумаге с размером клетки 1x1. Вершины имеют координаты (1,1), (7,1), (5,4), (2,4).\n\n[Рисунок трапеции на сетке]',
                E'1. Трапеция имеет основания, параллельные оси X.\n   Нижнее основание (y=1) между x=1 и x=7. Длина b1 = 7 - 1 = 6.\n   Верхнее основание (y=4) между x=2 и x=5. Длина b2 = 5 - 2 = 3.\n2. Высота трапеции - это расстояние между основаниями по оси Y.\n   Высота h = 4 - 1 = 3.\n3. Площадь трапеции = (Сумма оснований) * Высота / 2.\n   Площадь = (b1 + b2) * h / 2 = (6 + 3) * 3 / 2 = 9 * 3 / 2 = 27 / 2 = 13,5.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13.5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13,5', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '27', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '15', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9', false);

        -- Question 14 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В прямоугольном треугольнике гипотенуза равна 10, а один из катетов равен 6. Найдите длину второго катета.',
                E'Пусть катеты прямоугольного треугольника равны a и b, а гипотенуза равна c.\nПо теореме Пифагора: a² + b² = c².\nНам дано: c = 10, один катет (пусть a) = 6. Нужно найти b.\na² + b² = c²\n6² + b² = 10²\n36 + b² = 100\nb² = 100 - 36\nb² = 64\nb = √64 = 8 (длина не может быть отрицательной).\nВторой катет равен 8.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '8', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false); -- 10 - 6?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '11.66', false); -- sqrt(10^2+6^2)?
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '64', false); -- b^2

        -- Question 15 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочитайте текст. Грузовик выехал из города в 8:00. Первые 100 км он проехал за 2 часа. Затем сделал остановку на 30 минут. После остановки он проехал ещё 120 км со скоростью 60 км/ч. Постройте график зависимости расстояния грузовика от города от времени с 8:00 до момента окончания поездки.\n\n[Система координат Время - Расстояние]',
                E'Определим ключевые точки (Время, Расстояние от города):\n*   8:00: (8:00, 0) - Начало.\n*   10:00 (8:00 + 2ч): Проехал 100 км. Точка (10:00, 100).\n*   10:30 (10:00 + 30мин остановки): Расстояние не изменилось. Точка (10:30, 100).\n*   Время на второй участок пути: t = Расстояние / Скорость = 120 км / 60 км/ч = 2 часа.\n*   Время окончания поездки: 10:30 + 2 ч = 12:30.\n*   Конечное расстояние: 100 км (до остановки) + 120 км (после) = 220 км. Точка (12:30, 220).\nСоедините точки (8:00, 0), (10:00, 100), (10:30, 100), (12:30, 220) отрезками.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[График]', true); -- Placeholder for graph task

        -- Question 16 (Var 8)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Скорость лодки в стоячей воде равна 15 км/ч. Скорость течения реки — 3 км/ч. Сколько часов потребуется лодке, чтобы проплыть 36 км по течению реки? Запишите решение и ответ.',
                E'1. При движении по течению скорость лодки складывается со скоростью течения.\n   Скорость по течению = Скорость лодки + Скорость течения.\n   V_по_теч = 15 км/ч + 3 км/ч = 18 км/ч.\n2. Расстояние, которое нужно проплыть, S = 36 км.\n3. Время движения находится по формуле: Время = Расстояние / Скорость.\n   t = S / V_по_теч = 36 км / 18 км/ч.\n   t = 2 часа.\nРешение: Скорость лодки по течению равна 15 + 3 = 18 км/ч. Чтобы проплыть 36 км с этой скоростью, потребуется время t = 36 км / 18 км/ч = 2 часа.\nОтвет: 2.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2 ч', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '120', false); -- In minutes
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false); -- Time against current (36/(15-3))
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.4', false); -- Time in still water (36/15)

    ELSE
        RAISE NOTICE 'Subject "Математика" for grade 7 not found. Skipping Variant 8.';
    END IF;

END $$;