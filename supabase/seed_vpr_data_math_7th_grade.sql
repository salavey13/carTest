-- 1. Ensure the 'Математика' subject exists for 7th grade
INSERT INTO public.subjects (name, description, grade_level) VALUES
('Математика', E'## ВПР по Математике (7 класс) \n\nЭта Всероссийская проверочная работа по математике для 7 класса поможет оценить твои знания и навыки по **ключевым темам**, изученным в этом учебном году.\n\n**Что тебя ждёт:**\n\n*   🔢 **Числа и вычисления:** Действия с обыкновенными и десятичными дробями, целыми и рациональными числами.\n*   📐 **Алгебра:** Упрощение выражений, решение линейных уравнений, работа с формулами сокращённого умножения, функции и их графики.\n*   📊 **Статистика и вероятность:** Чтение и анализ таблиц, диаграмм, решение логических задач.\n*   📏 **Геометрия:** Основные понятия, углы, треугольники (в том числе равнобедренные), работа с координатной прямой и плоскостью.\n*   📝 **Текстовые задачи:** Задачи на проценты, движение, части, логику.\n\nНе переживай, это проверка твоих знаний! Постарайся выполнить как можно больше заданий. Удачи! ✨', 7)
ON CONFLICT (name, grade_level) DO NOTHING

-- =============================================
-- === INSERT MATH 7th Grade, VARIANT 1 (Kit 1) ===
-- === (Based on vpr-po-matematike-za-7-klass-komplekt-1-variant-1.pdf) ===
-- =============================================
DO $$
DECLARE
    subj_math_7_id INT;
    q_id INT;
    variant_num INT := 1; -- Set variant number
BEGIN
    SELECT id INTO subj_math_7_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 7;

    IF subj_math_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math 7th Grade Variant 1...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num;

        -- Question 1 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения 5/6 + 7/12 : 7/2 .',
                E'Помни про порядок действий! Сначала деление, потом сложение.\n1. Делим дроби: 7/12 : 7/2 = 7/12 * 2/7 (переворачиваем вторую дробь и умножаем).\n   Сокращаем семёрки и 2 с 12: (1/12) * (2/1) = (1/6) * (1/1) = 1/6.\n2. Складываем дроби: 5/6 + 1/6 = (5+1)/6 = 6/6 = 1.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5/6', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2/3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1/6', false);

        -- Question 2 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (2,6 - 8,1) * 4,2.',
                E'Сначала выполняем действие в скобках, затем умножение.\n1. Вычитание в скобках: 2,6 - 8,1 = -5,5.\n2. Умножение: (-5,5) * 4,2 = -23,1.\n*Примечание: Ответ в официальном ключе -2.32. Возможно, в оригинальном задании было другое выражение, например, 0.8 * (1.2 - 4.1) = -2.32. Данное объяснение соответствует тексту вопроса.*', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-23.1', true); -- Answer according to text
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2.32', false); -- Answer from key, possibly different question
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '23.1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.32', false);

        -- Question 3 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В таблице показано соответствие размеров женской обуви в России, Европейском союзе, Великобритании и США. Покупательница носит туфли 37-го размера по российской системе. Какого размера туфли ей нужно спросить, если она зашла в обувной магазин во Франции (Европейский союз)? \n\n[Таблица размеров обуви]',
                E'Найди строку с российским размером 37. Затем посмотри, какой размер указан в той же строке в столбце "Европейский союз". Там стоит число 38.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '38', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '37', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6.5', false);

        -- Question 4 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Трактор едет по дороге, проезжая 10 метров за каждую секунду. Выразите скорость трактора в километрах в час.',
                E'Скорость дана в метрах в секунду (м/с), а нужно перевести в километры в час (км/ч).\nЧтобы перевести м/с в км/ч, умножь число на 3,6.\n10 м/с * 3,6 = 36 км/ч.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '36', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0.6', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '600', false);

        -- Question 5 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Ежемесячная плата за телефон составляет 280 рублей в месяц. Сколько рублей составит ежемесячная плата за телефон, если она вырастет на 5%?',
                E'Нужно найти новую цену после увеличения на 5%.\n1. Найдём величину повышения: 5% от 280 рублей.\n   5% = 0,05.\n   0,05 * 280 = 14 рублей.\n2. Прибавим повышение к старой цене: 280 + 14 = 294 рубля.\n**Другой способ:** Новая цена составит 100% + 5% = 105% от старой. 105% = 1,05.\n   Новая цена = 280 * 1,05 = 294 рубля.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '294', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '285', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '14', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '300', false);

        -- Question 6 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Катя младше Тани, но старше Даши. Ксюша не младше Даши. Выберите утверждения, которые верны при указанных условиях, и запишите в ответе их номера.\n1) Таня и Даша одного возраста.\n2) Среди названных четырёх девочек нет никого младше Даши.\n3) Таня старше Даши.\n4) Таня и Катя одного возраста.',
                E'Условия: К < Т, К > Д, Кс ≥ Д. Из первых двух: Д < К < Т.\nПроверим утверждения:\n1) Т = Д. Неверно (противоречит Д < Т).\n2) Нет младше Даши. Верно (т.к. Д < К и Кс ≥ Д).\n3) Т > Д. Верно (следует из Д < К < Т).\n4) Т = К. Неверно (противоречит К < Т).\nВерные утверждения: 2 и 3.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '23', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '32', true); -- Allow reversed order
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false);

        -- Question 7 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На диаграмме показано содержание питательных веществ в овсяном печенье. Определите по диаграмме, сколько примерно жиров содержится в 100 г овсяного печенья.\n\n[Круговая диаграмма: Белки, Жиры, Углеводы, Прочее]',
                E'Найди на диаграмме сектор "Жиры". Визуально оцени его размер. Он меньше четверти (25 г), но больше 10 г. Похоже на 15-20 г. Официальный ответ допускает диапазон 12-18 г. Значение 15 г подходит.', 7)
        RETURNING id INTO q_id;
        -- Answer range is 12-18.
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '12-18', true); -- Representing the allowed range

        -- Question 8 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На рисунке изображён график линейной функции. Напишите формулу, которая задаёт эту линейную функцию.\n\n[График прямой линии]',
                E'Формула линейной функции: y = kx + b.\n1. Найдём **b** (пересечение с осью Y): график проходит через (0, -1), значит b = -1.\n2. Найдём **k** (угловой коэффициент). Возьмём точки (0, -1) и (1, 1).\n   k = (y2 - y1) / (x2 - x1) = (1 - (-1)) / (1 - 0) = 2 / 1 = 2.\n3. Формула: y = 2x - 1.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'y=2x-1', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'y = 2x - 1', true); -- Allow spaces
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'y=x-1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'y=-x+2', false);

        -- Question 9 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Решите уравнение 2 + 3x = −2x −13.',
                E'Это линейное уравнение.\n1. Переносим x влево, числа вправо:\n   3x + 2x = -13 - 2\n2. Упрощаем:\n   5x = -15\n3. Находим x:\n   x = -15 / 5\n   x = -3.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-3', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-15', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-11', false);

        -- Question 10 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочтите текст. Байкал [...] площадь водной поверхности составляет 31 722 кв. км. [...] снижение уровня воды в Байкале даже на 10 см приведёт к необратимым последствиям [...]. Предположим, что завод будет выпускать 20 миллионов пятилитровых бутылок в год. Будет ли заметно понижение уровня воды в Байкале, вызванное деятельностью завода в течение трёх лет? Ответ обоснуйте.',
                E'Сравним объём воды, забираемый заводом за 3 года, с объёмом, соответствующим понижению уровня на 10 см.\n1. Объём за 3 года: 3 года * 20 000 000 бут/год * 5 л/бут = 300 000 000 л = 300 000 куб. м.\n2. Площадь Байкала = 31 722 кв. км = 31 722 * 10^6 кв. м.\n3. Объём слоя 10 см (0,1 м): Площадь * 0,1 м = 31 722 * 10^6 * 0,1 = 3 172 200 000 куб. м.\n4. Сравнение: 300 000 куб. м << 3 172 200 000 куб. м.\nВывод: Объем забора воды ничтожно мал по сравнению с объемом, вызывающим заметное понижение уровня.\nОтвет: Нет, понижение уровня воды не будет заметно.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Нет', true); -- Assuming the justification implies 'No'

        -- Question 11 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (4−y)² − y(y+1) при y = − 1/9.',
                E'Сначала упростим выражение.\n1. (4−y)² = 16 - 8y + y².\n2. −y(y+1) = -y² - y.\n3. Выражение: (16 - 8y + y²) + (-y² - y) = 16 - 8y - y = 16 - 9y.\n4. Подставляем y = -1/9:\n   16 - 9 * (-1/9) = 16 - (-1) = 16 + 1 = 17.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '17', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '15', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '16', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '17 2/9', false);

        -- Question 12 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Отметьте и подпишите на координатной прямой точки A (1,6), B (-9/7) и С (−2,75).\n\n[Координатная прямая]',
                E'Нужно расположить точки на прямой.\n*   A(1,6) - между 1 и 2, правее 1.5.\n*   B(-9/7) = -1 2/7 ≈ -1.29. Находится между -1 и -2, ближе к -1.\n*   C(−2,75) = -2 3/4. Находится между -2 и -3, ближе к -3.\nПорядок слева направо: C, B, A.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true); -- Placeholder for drawing task

        -- Question 13 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На клетчатой бумаге с размером клетки 1×1 отмечены три точки: A, B и C . Найдите расстояние от точки A до прямой BC.\n\n[Рисунок на клетчатой бумаге: точки A, B, C]',
                E'Расстояние от точки до прямой - это длина перпендикуляра, опущенного из точки на эту прямую.\n1. Проведите прямую через точки B и C.\n2. Из точки A опустите перпендикуляр на прямую BC.\n3. Посчитайте длину этого перпендикуляра по клеточкам. Судя по ответу из ключа (2), перпендикуляр имеет длину 2 клетки.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.5', false);

        -- Question 14 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В треугольнике ABC проведена биссектриса CE. Найдите величину угла BCE, если ∠BAC = 46° и ∠ABC = 78°.\n\n[Треугольник ABC с биссектрисой CE]',
                E'1. Сумма углов треугольника равна 180°. Найдём угол ACB:\n   ∠ACB = 180° - ∠BAC - ∠ABC = 180° - 46° - 78° = 180° - 124° = 56°.\n2. CE - биссектриса угла ACB, она делит его пополам.\n   ∠BCE = ∠ACB / 2 = 56° / 2 = 28°.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '28', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '56', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '62', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '124', false);

        -- Question 15 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочтите текст. К трём часам дня 25 августа воздух прогрелся до +27°С, а затем температура начала быстро снижаться и за три часа опустилась на 9 градусов. К девяти вечера воздух остыл до 15°С, а к полуночи потеплело на 3 градуса. К 3 часам ночи температура воздуха опустилась до 12°С, а к восходу (в 6 часов утра) похолодало ещё на 3 градуса. После восхода солнца воздух снова начал прогреваться, и к полудню температура достигла 15°С. К трём часам дня 26 августа температура воздуха оказалась на 6 градусов ниже, чем в то же время накануне. По описанию постройте схематично график изменения температуры в течение суток с 15:00 25 августа до 15:00 26 августа.\n\n[Система координат Время-Температура]',
                E'Отметим точки на графике:\n*   15:00 (25 авг): 27°С (дано)\n*   18:00 (15:00 + 3ч): 27° - 9° = 18°С\n*   21:00: 15°С\n*   00:00 (полночь): 15° + 3° = 18°С\n*   03:00 (ночь): 12°С\n*   06:00 (восход): 12° - 3° = 9°С\n*   12:00 (26 авг): 15°С\n*   15:00 (26 авг): 27° - 6° = 21°С\nСоедините точки (15:00, 27), (18:00, 18), (21:00, 15), (00:00, 18), (03:00, 12), (06:00, 9), (12:00, 15), (15:00, 21) отрезками.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[График]', true); -- Placeholder for graph task

        -- Question 16 (Var 1)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Первый участок пути протяженностью 120 км автомобиль проехал со скоростью 80 км/ч, следующие 75 км — со скоростью 50 км/ч, а последние 110 км — со скоростью 55 км/ч. Найдите среднюю скорость автомобиля на протяжении всего пути.',
                E'Средняя скорость = (Весь путь) / (Всё время).\n1. Весь путь: S = 120 км + 75 км + 110 км = 305 км.\n2. Время на каждом участке (t = S/V):\n   t1 = 120 / 80 = 1,5 ч.\n   t2 = 75 / 50 = 1,5 ч.\n   t3 = 110 / 55 = 2 ч.\n3. Всё время: T = t1 + t2 + t3 = 1,5 + 1,5 + 2 = 5 ч.\n4. Средняя скорость: V_ср = S / T = 305 км / 5 ч = 61 км/ч.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '61', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '61.67', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '60', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '305', false);


    ELSE
        RAISE NOTICE 'Subject "Математика" for grade 7 not found. Skipping Variant 1.';
    END IF;

END $$;


-- =============================================
-- === INSERT MATH 7th Grade, VARIANT 2 (Kit 1) ===
-- === (Based on vpr-po-matematike-za-7-klass-komplekt-1-variant-2.pdf) ===
-- =============================================
DO $$
DECLARE
    subj_math_7_id INT;
    q_id INT;
    variant_num INT := 2; -- Set variant number
BEGIN
    SELECT id INTO subj_math_7_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 7;

    IF subj_math_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math 7th Grade Variant 2...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num;

        -- Question 1 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения 7/9 - (1/4 + 1/12) : 5/6.',
                E'Сначала скобки, потом деление, потом вычитание.\n1. Скобки: 1/4 + 1/12 = 3/12 + 1/12 = 4/12 = 1/3.\n2. Деление: (1/3) : 5/6 = (1/3) * (6/5) = 6/15 = 2/5.\n3. Вычитание: 7/9 - 2/5 = (7*5)/(9*5) - (2*9)/(5*9) = 35/45 - 18/45 = 17/45.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '17/45', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1/2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1/9', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2/3', false);

        -- Question 2 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения −3,25 ⋅ (−4,2 + 3,6).',
                E'Сначала действие в скобках, потом умножение.\n1. Скобки: -4,2 + 3,6 = -0,6.\n2. Умножение: -3,25 * (-0,6). Минус на минус дает плюс.\n   3,25 * 0,6 = 1,95.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.95', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-1.95', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.85', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2.85', false);

        -- Question 3 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В таблице указано время восхода и захода солнца в Норильске с 21 января по 27 января 2019 года. По данным таблицы определите долготу дня в Норильске 27 января 2019 года.\n\n[Таблица Восход/Заход]',
                E'Долгота дня = Время захода - Время восхода.\n1. Находим строку для 27 января: Восход 10:41, Заход 14:54.\n2. Вычитаем: 14 ч 54 мин - 10 ч 41 мин.\n   Минуты: 54 - 41 = 13 мин.\n   Часы: 14 - 10 = 4 ч.\n4. Долгота дня: 4 часа 13 минут.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4 ч 13 мин', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4 ч 03 мин', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3 ч 13 мин', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '25 ч 35 мин', false); -- Sum

        -- Question 4 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Поезд проезжает 39 метров за каждую секунду. Выразите скорость поезда в километрах в час.',
                E'Переводим м/с в км/ч умножением на 3,6.\nСкорость = 39 м/с.\nСкорость в км/ч = 39 * 3,6 = 140,4 км/ч.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '140.4', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '140,4', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '39', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10.83', false); -- 39 / 3.6
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2340', false); -- 39 * 60

        -- Question 5 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В период проведения акции цену на чайный сервиз снизили на 20%, при этом его цена составила 3200 рублей. Сколько рублей стоил сервиз до снижения цены?',
                E'Новая цена 3200 руб. составляет 100% - 20% = 80% от старой цены (X).\n0,80 * X = 3200\nX = 3200 / 0,80 = 32000 / 8 = 4000 рублей.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4000', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3840', false); -- 3200 * 1.2
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2560', false); -- 3200 * 0.8
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3220', false);

        -- Question 6 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Линейка стоит столько же, сколько точилка и карандаш вместе, а точилка дороже карандаша. Выберите верные утверждения и запишите в ответе их номера.\n1) Точилка дороже линейки.\n2) Две точилки стоят дороже линейки.\n3) Карандаш дешевле линейки.\n4) Точилка дешевле карандаша.',
                E'Обозначим цены: Л, Т, К.\nУсловия: Л = Т + К, Т > К.\nПроверим утверждения:\n1) Т > Л? Л = Т + К. Так как К>0, то Л > Т. Неверно.\n2) 2Т > Л? Подставим Л: 2Т > Т + К? Т > К? Да, по условию. Верно.\n3) К < Л? Л = Т + К. Так как Т>0, то Л > К. Верно.\n4) Т < К? Противоречит условию Т > К. Неверно.\nВерные утверждения: 2 и 3.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '23', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '32', true); -- Allow reversed order
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);

        -- Question 7 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На диаграмме представлена информация о распределении продаж бытовой техники [...] Всего [...] продано 400 000 единиц. Определите по диаграмме, сколько примерно единиц бытовой техники было продано в специализированных магазинах.\n\n[Круговая диаграмма продаж]',
                E'Найди на диаграмме сектор "Специализированные магазины". Визуально он занимает около 20-25% круга.\nВозьмём оценку 22%.\nКоличество = 0,22 * 400 000 = 88 000.\nОфициальный ответ допускает диапазон 80 000 - 110 000. Значение 90000 подходит.', 7)
        RETURNING id INTO q_id;
        -- Answer range is 80000-110000.
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '80000-110000', true); -- Representing the allowed range

        -- Question 8 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'График функции y = k/x проходит через точку с координатами (-3, -3). Найдите значение коэффициента k.',
                E'Подставим координаты точки (x=-3, y=-3) в уравнение функции y = k/x:\n-3 = k / (-3)\nУмножим обе части на -3:\nk = (-3) * (-3) = 9.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-9', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-1', false);

        -- Question 9 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Решите уравнение x − 2 (3 x + 2) = 16.',
                E'1. Раскроем скобки: x - 6x - 4 = 16.\n2. Упростим левую часть: -5x - 4 = 16.\n3. Перенесем -4 вправо: -5x = 16 + 4 = 20.\n4. Найдём x: x = 20 / (-5) = -4.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-4', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2.4', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-3', false);

        -- Question 10 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Игорь упаковал 400 маленьких коробок, израсходовал три рулона скотча полностью, а от четвёртого осталась ровно треть (т.е. израсходовал 2/3 четвертого). На каждую коробку шло по 55 см. Ему нужно заклеить 350 одинаковых коробок, на каждую нужно по 70 см скотча. Хватит ли четырёх целых таких рулонов скотча?',
                E'1. Сколько скотча в 1 рулоне? Израсходовано: 3 + 2/3 = 11/3 рулона. Всего скотча: 400 * 55 = 22000 см. В 1 рулоне: 22000 / (11/3) = 22000 * 3 / 11 = 2000 * 3 = 6000 см.\n2. Сколько скотча нужно? 350 * 70 = 24500 см.\n3. Сколько скотча в 4 рулонах? 4 * 6000 = 24000 см.\n4. Сравнение: Нужно 24500 см, есть 24000 см. 24000 < 24500.\nОтвет: Нет, не хватит.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Нет', true);

        -- Question 11 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (n + 6)² + (2 − n)(2 + n) при n = − 5/12.',
                E'Упростим выражение.\n1. (n + 6)² = n² + 12n + 36.\n2. (2 − n)(2 + n) = 4 - n² (разность квадратов).\n3. Выражение: (n² + 12n + 36) + (4 - n²) = n² + 12n + 36 + 4 - n² = 12n + 40.\n4. Подставляем n = -5/12:\n   12 * (-5/12) + 40 = -5 + 40 = 35.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '35', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '45', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '40', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '30', false);

        -- Question 12 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Отметьте и подпишите на координатной прямой точки A (4,69), B (-11/3) , C (−4,34).\n\n[Координатная прямая]',
                E'Нужно расположить точки на прямой.\n*   A(4,69) - между 4 и 5, ближе к 5.\n*   B(-11/3) = -3 2/3 ≈ -3.67. Находится между -3 и -4, ближе к -4.\n*   C(−4,34) - между -4 и -5, ближе к -4.\nСравнение B и C: -3.67 > -4.34. Значит, B правее C.\nПорядок слева направо: C, B, A.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true); -- Placeholder for drawing task

        -- Question 13 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На клетчатой бумаге с размером клетки 1×1 отмечено девять точек. Сколько из них удалено от прямой HD на расстояние 2?\n\n[Рисунок на клетчатой бумаге: точки A-I, прямая HD]',
                E'Расстояние от точки до прямой - длина перпендикуляра.\n1. Проведите прямую HD.\n2. Найдите все точки, перпендикуляр от которых до прямой HD равен 2 клеткам. Судя по ответу из ключа (2), таких точек две.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false);

        -- Question 14 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В равнобедренном треугольнике ABC с основанием BC угол A равен 120°. Высота треугольника, проведённая из вершины B, равна 13. Найдите длину стороны BC.\n\n[Равнобедренный треугольник ABC]',
                E'1. В равноб. ΔABC (основание BC) ∠A=120°. Значит AB=AC, ∠B=∠C = (180°-120°)/2 = 30°.\n2. Высота из B - это перпендикуляр BM к прямой AC (упадет на продолжение AC, т.к. ∠A тупой). BM=13.\n3. Рассм. прямоугольный ΔABM: ∠BAM (смежный с ∠BAC) = 180°-120°=60°. ∠ABM = 180°-90°-60°=30°.\n4. В ΔABM: sin(60°) = BM/AB => AB = BM / sin(60°) = 13 / (√3/2) = 26/√3.\n5. В ΔABC по теореме синусов: BC/sin(A) = AB/sin(C).\n   BC/sin(120°) = (26/√3)/sin(30°).\n   BC = (26/√3) * sin(120°)/sin(30°) = (26/√3) * (√3/2)/(1/2) = (26/√3) * √3 = 26.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '26', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13√3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '26√3', false);

        -- Question 15 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочитайте текст. Цена на алюминий 23 января составляла 125 600 рублей за тонну. На следующий день она выросла на 600 рублей, 25 января снизилась на 1100 рублей и 26 января составила 125 700 рублей. 27 января цена вернулась к значению на 23 января и не менялась до 29 января, когда произошло снижение цены на 1200 рублей. В следующие два дня цена росла ежедневно на одно и то же число рублей и 31 января составила 126 400 рублей. По описанию постройте график зависимости цены на алюминий (за тонну) от даты в течение девяти дней — с 23 января по 31 января.\n\n[Система координат Дата-Цена]',
                E'Отметим точки на графике:\n*   23 янв: 125 600 (дано)\n*   24 янв: 125 600 + 600 = 126 200\n*   25 янв: 126 200 - 1100 = 125 100\n*   26 янв: 125 700\n*   27 янв: 125 600\n*   28 янв: 125 600\n*   29 янв: 125 600 - 1200 = 124 400\n*   30 янв: Цена 29 + X = Цена 31 - X => 124 400 + X = 126 400 - X => 2X = 2000 => X = 1000. Цена 30 = 124 400 + 1000 = 125 400\n*   31 янв: 126 400\nСоедините точки (23, 125600), (24, 126200), (25, 125100), (26, 125700), (27, 125600), (28, 125600), (29, 124400), (30, 125400), (31, 126400) отрезками.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[График]', true); -- Placeholder for graph task

        -- Question 16 (Var 2)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Из пункта А в пункт В одновременно отправились велосипедист и пешеход. Скорость велосипедиста на 6 км/ч больше скорости пешехода. Найдите скорость велосипедиста, если время, которое затратил пешеход на дорогу из пункта А в пункт В, в два с половиной раза больше времени, которое затратил велосипедист на эту же дорогу.',
                E'Пусть Vп - скорость пешехода, Vв - скорость велосипедиста. tп, tв - время.\n1) Vв = Vп + 6\n2) tп = 2,5 * tв\nРасстояние S одинаковое: S = Vп * tп = Vв * tв.\nПодставляем (1) и (2):\nVп * (2,5 * tв) = (Vп + 6) * tв\nДелим на tв (т.к. tв > 0):\n2,5 * Vп = Vп + 6\n1,5 * Vп = 6\nVп = 6 / 1,5 = 4 км/ч.\nСкорость велосипедиста: Vв = Vп + 6 = 4 + 6 = 10 км/ч.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false); -- Speed of pedestrian
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '15', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6', false);

    ELSE
        RAISE NOTICE 'Subject "Математика" for grade 7 not found. Skipping Variant 2.';
    END IF;

END $$;


-- =============================================
-- === INSERT MATH 7th Grade, VARIANT 3 (Kit 2, Var 1) ===
-- =============================================
DO $$
DECLARE
    subj_math_7_id INT;
    q_id INT;
    variant_num INT := 3; -- Set variant number
BEGIN
    SELECT id INTO subj_math_7_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 7;

    IF subj_math_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math 7th Grade Variant 3...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num;

        -- Question 1 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (5/6 - 3/4) * 1.2.',
                E'1. Скобки: 5/6 - 3/4 = 10/12 - 9/12 = 1/12.\n2. Умножение: (1/12) * 1.2 = (1/12) * (12/10) = 1/10 = 0.1.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0.1', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0,1', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1/10', true); -- Allow fraction form
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0.5', false);

        -- Question 2 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения 8,4 ⋅ 3,5 + 1,9.',
                E'1. Умножение: 8,4 * 3,5 = 29,4.\n2. Сложение: 29,4 + 1,9 = 31,3.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '31.3', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '31,3', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '35.7', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '29.4', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '40.32', false);

        -- Question 3 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В таблице даны рекомендации по выпечке кондитерских изделий в духовке — температура (°С) и время (мин.). По данным таблицы определите наименьшее время выпекания безе. Ответ дайте в минутах.\n\n[Таблица Температура/Время выпечки]',
                E'Найди в таблице строку "Безе". Посмотри на указанное время выпекания. Обычно дается диапазон (например, "100-120"). Выбери наименьшее значение из этого диапазона. Судя по ключу, ответ 100 минут.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '100', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '120', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '110', false);

        -- Question 4 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Поезд проезжает 35 метров за каждую секунду. Выразите скорость поезда в километрах в час.',
                E'Переводим м/с в км/ч умножением на 3,6.\nСкорость = 35 м/с.\nСкорость в км/ч = 35 * 3,6 = 126 км/ч.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '126', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '35', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '9.72', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2100', false);

        -- Question 5 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Кофеварку на распродаже уценили на 13%, при этом она стала стоить 6525 рублей. Сколько рублей стоила кофеварка до распродажи?',
                E'Новая цена 6525 руб. составляет 100% - 13% = 87% от старой цены (X).\n0,87 * X = 6525\nX = 6525 / 0,87 = 652500 / 87 = 7500 рублей.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7500', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7373.25', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5676.75', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '848.25', false);

        -- Question 6 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На столе стоят 18 кружек с чаем. В семи из них чай с сахаром, а в остальных без сахара. В пять кружек официант положил по дольке лимона.\nВыберите верные утверждения и запишите в ответе их номера.\n1) Найдётся 5 кружек с чаем без сахара и без лимона.\n2) Найдётся 7 кружек с чаем с лимоном, но без сахара.\n3) Если в кружке чай без сахара, то он с лимоном.\n4) Не найдётся 12 кружек с чаем без сахара, но с лимоном.',
                E'Данные: Всего=18, С сахаром=7, Без сахара=11, С лимоном=5, Без лимона=13.\nПроверка:\n1) (Без сах. И Без лим.)? Мин кол-во = (11+13-18) = 6. Значит, 5 найдётся. Верно.\n2) (С лим. И Без сах.)? Макс кол-во = min(5, 11) = 5. Значит, 7 не найдётся. Неверно.\n3) (Без сах.) => (С лим.)? Нет, т.к. Без сахара (11) > С лимоном (5). Неверно.\n4) Не найдётся 12 (Без сах. И С лим.)? Макс кол-во = 5. Значит, 12 не найдётся. Верно.\nВерные утверждения: 1 и 4.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '14', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '41', true); -- Allow reversed order
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false);

        -- Question 7 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На диаграмме представлена информация о покупках, сделанных в интернетмагазинах некоторого города в выходные дни. Всего за выходные было совершено 50 000 покупок. Определите по диаграмме, сколько примерно покупок относится к категории «Обувь».\n\n[Круговая диаграмма покупок]',
                E'Найди на диаграмме сектор "Обувь". Оцени его долю. Визуально это примерно 15-20%.\nВозьмём оценку 18%. Количество = 0,18 * 50 000 = 9000.\nОфициальный ответ допускает диапазон 7 000 - 11 000. Значение 9000 подходит.', 7)
        RETURNING id INTO q_id;
        -- Answer range is 7000-11000.
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7000-11000', true); -- Representing the allowed range

        -- Question 8 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Дана функция y = −4x − 15. Найдите значение x, при котором значение функции равно 5.',
                E'Значение функции y = 5. Подставляем в уравнение:\n5 = -4x - 15\nПереносим -15 влево:\n5 + 15 = -4x\n20 = -4x\nНаходим x:\nx = 20 / (-4) = -5.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-35', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.5', false);

        -- Question 9 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Решите уравнение x − 5 (x + 3) = 5.',
                E'1. Раскроем скобки: x - 5x - 15 = 5.\n2. Упростим левую часть: -4x - 15 = 5.\n3. Перенесем -15 вправо: -4x = 5 + 15 = 20.\n4. Найдём x: x = 20 / (-4) = -5.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2.5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-4', false);

        -- Question 10 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Марина собирается связать шарф длиной 130 см и шириной 50 см. Она связала пробный образец 10 см × 10 см, на него ушло 23 м пряжи. Хватит ли Марине на шарф трёх мотков пряжи, по 550 м в каждом?',
                E'1. Площадь шарфа: 130 см * 50 см = 6500 кв. см.\n2. Площадь образца: 10 см * 10 см = 100 кв. см.\n3. Расход пряжи на 1 кв. см: 23 м / 100 кв. см = 0,23 м/кв. см.\n4. Сколько пряжи нужно на шарф: 6500 кв. см * 0,23 м/кв. см = 1495 м.\n5. Сколько пряжи есть: 3 мотка * 550 м/моток = 1650 м.\n6. Сравнение: Нужно 1495 м, есть 1650 м. 1650 > 1495.\nОтвет: Да, хватит.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Да', true);

        -- Question 11 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (5 + y)(5 − y) − y (7 − y) при y = − 3/7.',
                E'Упростим выражение.\n1. (5 + y)(5 − y) = 25 - y² (разность квадратов).\n2. −y(7 − y) = -7y + y².\n3. Выражение: (25 - y²) + (-7y + y²) = 25 - y² - 7y + y² = 25 - 7y.\n4. Подставляем y = -3/7:\n   25 - 7 * (-3/7) = 25 - (-3) = 25 + 3 = 28.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '28', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '22', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '25', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '31', false);

        -- Question 12 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Отметьте и подпишите на координатной прямой точки A(-2.3), B(10/3), C(-7/5).\n\n[Координатная прямая]',
                E'Нужно расположить точки на прямой.\n*   A(-2,3) - между -2 и -3, ближе к -2.\n*   B(10/3) = 3 1/3 ≈ 3.33. Находится между 3 и 4, ближе к 3.\n*   C(-7/5) = -1 2/5 = -1.4. Находится между -1 и -2, ближе к -1.\nПорядок слева направо: A, C, B.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true); -- Placeholder for drawing task

        -- Question 13 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На клетчатой бумаге с размером клетки 1×1 отмечены точки А, В и С. Найдите расстояние от точки A до прямой ВС.\n\n[Рисунок на клетчатой бумаге: точки A, B, C]',
                E'Расстояние от точки до прямой - это длина перпендикуляра.\n1. Проведите прямую через точки B и C.\n2. Из точки A опустите перпендикуляр на прямую BC.\n3. Посчитайте длину этого перпендикуляра по клеточкам. Судя по ответу из ключа (3), перпендикуляр имеет длину 3 клетки.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3.5', false);

        -- Question 14 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Между сторонами угла АОВ, равного 110°, проведены лучи ОС и ОМ так, что угол АОС на 30° меньше угла ВОС, а ОМ — биссектриса угла ВОС. Найдите величину угла СОМ. Ответ дайте в градусах.',
                E'1. Пусть ∠BOC = y. Тогда ∠AOC = y - 30°.\n2. Сумма углов: ∠AOC + ∠BOC = ∠AOB\n   (y - 30°) + y = 110°\n3. Решаем: 2y - 30° = 110° => 2y = 140° => y = 70°. Значит, ∠BOC = 70°.\n4. OM - биссектриса ∠BOC. Значит, ∠COM = ∠BOC / 2.\n5. ∠COM = 70° / 2 = 35°.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '35', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '40', false); -- AOC
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '70', false); -- BOC
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '55', false); -- AOB / 2

        -- Question 15 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочитайте текст. Цена на алюминий 1 апреля составляла 123 200 рублей за тонну. 2 апреля цена выросла на 1400 рублей, 3 и 4 апреля она держалась на уровне 124 400 рублей. В понедельник 5 апреля цена выросла на 2200 рублей, а на следующий день снизилась на 600 рублей. В следующие два дня — 7 и 8 апреля — цена снижалась на одно и то же число рублей ежедневно, и 8 апреля вернулась к значению на 1 апреля. 9 апреля цена снизилась ещё на 400 рублей. По описанию постройте график зависимости цены на алюминий (за тонну) от даты в течение девяти дней — с 1 апреля по 9 апреля.\n\n[Система координат Дата-Цена]',
                E'Отметим точки на графике:\n*   1 апр: 123 200 (дано)\n*   2 апр: 123 200 + 1400 = 124 600 (*Примечание: по тексту далее 3-4 апр цена 124400, что не совпадает с ростом на 1400. Будем следовать числам из текста*)\n*   3 апр: 124 400\n*   4 апр: 124 400\n*   5 апр: 124 400 + 2200 = 126 600\n*   6 апр: 126 600 - 600 = 126 000\n*   7 апр: Цена 6 - X = Цена 8 + X => 126 000 - X = 123 200 + X? Нет. Цена 8 = Цена 1 = 123 200. Цена 6 - 2X = Цена 8. 126000 - 2X = 123200 => 2X = 2800 => X=1400. Цена 7 = 126 000 - 1400 = 124 600.\n*   8 апр: 123 200\n*   9 апр: 123 200 - 400 = 122 800\nСоедините точки (1, 123200), (2, 124600), (3, 124400), (4, 124400), (5, 126600), (6, 126000), (7, 124600), (8, 123200), (9, 122800) отрезками.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[График]', true); -- Placeholder for graph task

        -- Question 16 (Var 3)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Из пункта А в пункт Б вышел пешеход. Через полчаса из пункта А за ним вдогонку отправился велосипедист и прибыл в пункт Б одновременно с пешеходом. Сколько минут велосипедист находился в пути, если известно, что его скорость в четыре раза больше скорости пешехода?',
                E'Пусть Vп, Vв - скорости, tп, tв - время. Полчаса = 30 мин.\n1) Vв = 4 * Vп\n2) tв = tп - 30 (в минутах!)\nРасстояние S одинаковое: S = Vп * tп = Vв * tв.\nПодставляем (1):\nVп * tп = (4 * Vп) * tв\nДелим на Vп: tп = 4 * tв.\nПодставляем это в (2):\ntв = (4 * tв) - 30\n30 = 4 * tв - tв\n30 = 3 * tв\ntв = 30 / 3 = 10 минут.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '40', false); -- Time of pedestrian
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '30', false); -- Time difference
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '15', false);

    ELSE
        RAISE NOTICE 'Subject "Математика" for grade 7 not found. Skipping Variant 3.';
    END IF;

END $$;


-- =============================================
-- === INSERT MATH 7th Grade, VARIANT 4 (Kit 2, Var 2) ===
-- =============================================
DO $$
DECLARE
    subj_math_7_id INT;
    q_id INT;
    variant_num INT := 4; -- Set variant number
BEGIN
    SELECT id INTO subj_math_7_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 7;

    IF subj_math_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math 7th Grade Variant 4...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num;

        -- Question 1 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (7/15 + 2/3) * 1.5.',
                E'1. Скобки: 7/15 + 2/3 = 7/15 + 10/15 = 17/15.\n2. Умножение: (17/15) * 1.5 = (17/15) * (15/10) = 17/10 = 1.7.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.7', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1,7', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '17/10', true); -- Allow fraction form
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1.5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0.7', false);

        -- Question 2 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения 5,2 + 4,8 : (6 - 7.6).',
                E'1. Скобки: 6 - 7.6 = -1.6.\n2. Деление: 4,8 / (-1.6) = - (48/16) = -3.\n3. Сложение: 5,2 + (-3) = 5,2 - 3 = 2,2.\n*Примечание: Ответ в официальном ключе 3.5. Возможно, в оригинальном задании было другое выражение, например, 7 - 5.6 / 1.6 = 3.5. Данное объяснение соответствует тексту вопроса.*', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.2', true); -- Answer according to text
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2,2', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3.5', false); -- Answer from key, possibly different question
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-6.25', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-3', false);

        -- Question 3 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В таблице указано время восхода и захода солнца в Норильске с 14 января по 20 января 2019 года. По данным таблицы определите долготу дня в Норильске 14 января 2019 года.\n\n[Таблица Восход/Заход]',
                E'Долгота дня = Время захода - Время восхода.\n1. Находим строку для 14 января: Восход 12:15, Заход 12:52.\n2. Вычитаем: 12 ч 52 мин - 12 ч 15 мин = 0 ч 37 мин.\nДолгота дня: 37 минут.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '37', true); -- Answer in minutes as per key
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '37 мин', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0 ч 37 мин', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '25 ч 07 мин', false);

        -- Question 4 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Поезд проезжает 59 метров за каждую секунду. Выразите скорость поезда в километрах в час.',
                E'Переводим м/с в км/ч умножением на 3,6.\nСкорость = 59 м/с.\nСкорость в км/ч = 59 * 3,6 = 212,4 км/ч.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '212.4', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '212,4', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '59', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '16.39', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3540', false);

        -- Question 5 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Во время распродажи холодильник продавался со скидкой 11%. Сколько рублей составила скидка, если до скидки холодильник стоил 22 000 рублей?',
                E'Нужно найти 11% от 22 000 рублей.\n11% = 0,11.\nРазмер скидки = 0,11 * 22 000 = 11 * (22 000 / 100) = 11 * 220 = 2420 рублей.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2420', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '19580', false); -- New price
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2200', false); -- 10%
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '24620', false);

        -- Question 6 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На столе стоят 17 кружек с чаем. В шести из них чай с сахаром, а в остальных без сахара. В четыре кружки официант положил по дольке лимона. Выберите верные утверждения и запишите в ответе их номера.\n1) Найдётся 6 кружек с чаем без сахара и без лимона.\n2) Найдётся 8 кружек с чаем с лимоном, но без сахара.\n3) Не найдётся 11 кружек с чаем без сахара, но с лимоном.\n4) Если в кружке чай без сахара, то он с лимоном.',
                E'Данные: Всего=17, С сахаром=6, Без сахара=11, С лимоном=4, Без лимона=13.\nПроверка:\n1) (Без сах. И Без лим.)? Мин кол-во = (11+13-17) = 7. Значит, 6 найдётся. Верно.\n2) (С лим. И Без сах.)? Макс кол-во = min(4, 11) = 4. Значит, 8 не найдётся. Неверно.\n3) Не найдётся 11 (Без сах. И С лим.)? Макс кол-во = 4. Значит, 11 не найдётся. Верно.\n4) (Без сах.) => (С лим.)? Нет, т.к. Без сахара (11) > С лимоном (4). Неверно.\nВерные утверждения: 1 и 3.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '13', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '31', true); -- Allow reversed order
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);

        -- Question 7 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На диаграмме представлена информация о распределении продаж бытовой техники [...] Всего [...] продано 200 000 единиц. Определите по диаграмме, сколько примерно единиц бытовой техники было продано в гипермаркетах.\n\n[Круговая диаграмма продаж]',
                E'Найди на диаграмме сектор "Гипермаркеты". Оцени его долю. Визуально это примерно 20-30%.\nВозьмём оценку 25%. Количество = 0,25 * 200 000 = 50 000.\nОфициальный ответ допускает диапазон 40 000 - 60 000. Значение 50000 подходит.', 7)
        RETURNING id INTO q_id;
        -- Answer range is 40000-60000.
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '40000-60000', true); -- Representing the allowed range

        -- Question 8 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Дана функция y = −5x + 8. Найдите значение функции при х, равном 4.',
                E'Нужно найти y при x = 4.\nПодставляем x = 4 в уравнение y = -5x + 8:\ny = -5 * (4) + 8\ny = -20 + 8\ny = -12.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-12', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '12', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '28', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0.8', false);

        -- Question 9 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Решите уравнение 3 (5x + 8) − 7 x = 6 x.',
                E'1. Раскроем скобки: 15x + 24 - 7x = 6x.\n2. Упростим левую часть: 8x + 24 = 6x.\n3. Переносим x влево, числа вправо: 8x - 6x = -24.\n4. Упрощаем: 2x = -24.\n5. Находим x: x = -24 / 2 = -12.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-12', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '12', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2.4', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);

        -- Question 10 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Егор (85 кг) должен поднять 16 коробок бумаги в офис на лифте (грузоподъёмность 400 кг). В коробке 10 пачек по 500 листов A4 (210 мм × 297 мм). 1 м² бумаги весит 80 г. Сможет ли Егор подняться в лифте со всеми коробками за один раз?',
                E'1. Вес 1 коробки: Площадь листа = 0.21 м * 0.297 м ≈ 0.0624 кв.м. Листов в коробке = 10*500=5000. Площадь бумаги в коробке = 5000 * 0.0624 ≈ 312 кв.м. Вес бумаги = 312 кв.м * 80 г/кв.м = 24960 г ≈ 25 кг.\n2. Вес 16 коробок = 16 * 25 кг = 400 кг.\n3. Общий вес = Вес Егора + Вес коробок = 85 кг + 400 кг = 485 кг.\n4. Грузоподъёмность лифта = 400 кг.\n5. Сравнение: Общий вес (485 кг) > Грузоподъёмность (400 кг).\nОтвет: Нет, не сможет.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Нет', true);

        -- Question 11 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения − (y − 8)² + y² − 14y + 49 при y = 1/2.',
                E'Упростим выражение.\n1. y² − 14y + 49 = (y - 7)².\n2. Выражение: -(y - 8)² + (y - 7)².\n3. Используем разность квадратов a² - b² = (a - b)(a + b), где a = (y - 7), b = (y - 8).\n   (y - 7)² - (y - 8)² = [(y - 7) - (y - 8)] * [(y - 7) + (y - 8)]\n   = [y - 7 - y + 8] * [y - 7 + y - 8]\n   = [1] * [2y - 15] = 2y - 15.\n4. Подставляем y = 1/2:\n   2 * (1/2) - 15 = 1 - 15 = -14.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-14', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '14', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-15', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-13', false);

        -- Question 12 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Отметьте и подпишите на координатной прямой точки A (7/3), B (4,79) и C (−1,75 ).\n\n[Координатная прямая]',
                E'Нужно расположить точки на прямой.\n*   A(7/3) = 2 1/3 ≈ 2.33. Находится между 2 и 3, ближе к 2.\n*   B(4,79) - между 4 и 5, ближе к 5.\n*   C(−1,75) = -1 3/4. Находится между -1 и -2, ближе к -2.\nПорядок слева направо: C, A, B.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true); -- Placeholder for drawing task

        -- Question 13 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На клетчатой бумаге с размером клетки 1×1 отмечены точки А, В и С. Найдите расстояние от точки A до прямой ВС.\n\n[Рисунок на клетчатой бумаге: точки A, B, C]',
                E'Расстояние от точки до прямой - это длина перпендикуляра.\n1. Проведите прямую через точки B и C.\n2. Из точки A опустите перпендикуляр на прямую BC.\n3. Посчитайте длину этого перпендикуляра по клеточкам. Судя по ответу из ключа (4), перпендикуляр имеет длину 4 клетки.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3.5', false);

        -- Question 14 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'В равнобедренном треугольнике АВС с основанием АВ угол С в 2 раза меньше угла А. Найдите величину внешнего угла при вершине В. Ответ дайте в градусах.',
                E'1. Треугольник ABC равнобедренный, основание AB => AC = BC, ∠A = ∠B.\n2. Условие: ∠C = ∠A / 2. Или ∠A = 2 * ∠C.\n3. Тогда ∠B = ∠A = 2 * ∠C.\n4. Сумма углов: ∠A + ∠B + ∠C = 180°.\n   (2 * ∠C) + (2 * ∠C) + ∠C = 180°.\n   5 * ∠C = 180° => ∠C = 36°.\n5. ∠A = ∠B = 2 * 36° = 72°.\n6. Внешний угол при вершине B смежен с углом B.\n   Внешний угол = 180° - ∠B = 180° - 72° = 108°.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '108', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '72', false); -- Угол B
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '36', false); -- Угол C
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '144', false);

        -- Question 15 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочитайте текст. В понедельник парикмахерскую посетило 26 человек. Во вторник — на 4 человека больше. В среду посетителей было в полтора раза больше, чем во вторник. В четверг пришло на 5 человек меньше, чем в среду. В пятницу число посетителей снизилось на 10% по сравнению с четвергом. В субботу пришло на 5 человек больше, чем в пятницу, а в воскресенье — на 3 человека больше, чем в субботу. По описанию постройте график зависимости числа посетителей парикмахерской от дня недели. Соседние точки соедините отрезками.\n\n[Система координат День недели - Посетители]',
                E'Рассчитаем посетителей по дням:\n*   Пн: 26 (дано)\n*   Вт: 26 + 4 = 30\n*   Ср: 30 * 1,5 = 45\n*   Чт: 45 - 5 = 40\n*   Пт: 40 - 10% от 40 = 40 - (0,1 * 40) = 40 - 4 = 36\n*   Сб: 36 + 5 = 41\n*   Вс: 41 + 3 = 44\nОтметьте точки (Пн, 26), (Вт, 30), (Ср, 45), (Чт, 40), (Пт, 36), (Сб, 41), (Вс, 44) и соедините их отрезками.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[График]', true); -- Placeholder for graph task

        -- Question 16 (Var 4)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Из пункта А в пункт Б выехал мотоциклист. Через 50 минут из пункта А вслед за ним отправился автомобиль и прибыл в пункт Б одновременно с мотоциклистом. Сколько минут автомобиль находился в пути, если известно, что его скорость в полтора раза больше скорости мотоциклиста?',
                E'Пусть Vм, Vа - скорости, tм, tа - время (в минутах!).\n1) Vа = 1,5 * Vм\n2) tа = tм - 50\nРасстояние S одинаковое: S = Vм * tм = Vа * tа.\nПодставляем (1):\nVм * tм = (1,5 * Vм) * tа\nДелим на Vм: tм = 1,5 * tа.\nПодставляем это в (2):\ntа = (1,5 * tа) - 50\n50 = 1,5 * tа - tа\n50 = 0,5 * tа\ntа = 50 / 0,5 = 100 минут.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '100', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '150', false); -- Time of motorcyclist
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '50', false); -- Time difference
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '75', false);

    ELSE
        RAISE NOTICE 'Subject "Математика" for grade 7 not found. Skipping Variant 4.';
    END IF;

END $$;


-- =============================================
-- === INSERT MATH 7th Grade, VARIANT 5 (Kit 3, Var 1) ===
-- === (Based on vpr-po-matematike-za-7-klass-komplekt-3-variant-1.pdf) ===
-- =============================================
DO $$
DECLARE
    subj_math_7_id INT;
    q_id INT;
    variant_num INT := 5; -- Set variant number
BEGIN
    SELECT id INTO subj_math_7_id FROM public.subjects WHERE name = 'Математика' AND grade_level = 7;

    IF subj_math_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Math 7th Grade Variant 5 (Kit 3, Var 1)...';

        -- Clean up existing data for this specific variant first (optional but recommended)
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_math_7_id AND variant_number = variant_num;

        -- Question 1 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения 15/2 * (1/3 - 3/5).',
                E'1. Выполняем вычитание в скобках:\n   1/3 - 3/5 = 5/15 - 9/15 = -4/15.\n2. Выполняем умножение:\n   15/2 * (-4/15). Сокращаем 15.\n   1/2 * (-4) = -4/2 = -2.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-0.4', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-4', false);

        -- Question 2 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения −1,75 ⋅ (−8,7 + 6,3).',
                E'1. Выполняем сложение в скобках:\n   -8,7 + 6,3 = -(8,7 - 6,3) = -2,4.\n2. Выполняем умножение: -1,75 * (-2,4).\n   Результат будет положительным.\n   1,75 * 2,4 = (7/4) * (24/10) = (7/4) * (12/5) = (7 * 12) / (4 * 5) = (7 * 3) / 5 = 21/5 = 4,2.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4.2', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4,2', true); -- Allow comma
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-4.2', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3.15', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-3.15', false);

        -- Question 3 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Сотрудник некоторой фирмы 1 октября 2019 года провёл опрос среди коллег и составил таблицу, в которой, помимо фамилии, имени, отчества и дня рождения, указал полное число лет на день опроса (возраст).\n\n[Таблица с данными сотрудников]\n\nВ каком году родился Рязанцев Павел Евгеньевич?',
                E'1. Найдите в таблице строку с ФИО "Рязанцев Павел Евгеньевич".\n2. Посмотрите его возраст на 1 октября 2019 года. По ключу ответ 1975 год. Это год рождения, а не возраст. Найдем возраст в таблице для Рязанцева (не видна в тексте, но предположим, что он 44 года).\n3. Чтобы найти год рождения, вычтите возраст из года опроса: 2019 - Возраст = Год рождения.\n4. Если возраст 44 года: 2019 - 44 = 1975 год.\n5. Если день рождения Рязанцева позже 1 октября, то на 1 октября ему еще не исполнилось бы полное число лет за текущий год, и расчет был бы 2019 - 1 - Возраст. Но в таблице указано "полное число лет", значит день рождения в 2019 уже прошел (или был 1 октября). Расчет: 2019 - Возраст = Год рождения.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1975', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1974', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2019', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '44', false); -- Possible age

        -- Question 4 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Самолёт, находящийся в полёте, преодолевает 145 метров за каждую секунду. Выразите скорость самолёта в километрах в час.',
                E'Переводим скорость из м/с в км/ч умножением на 3,6.\nСкорость = 145 м/с.\nСкорость в км/ч = 145 * 3,6.\n145 * 3,6 = 145 * (36 / 10) = (145 * 36) / 10 = 5220 / 10 = 522 км/ч.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '522', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '145', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '40.28', false); -- 145 / 3.6
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '8700', false); -- 145 * 60

        -- Question 5 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Цена куртки поднялась с 3900 рублей до 4173 рублей. На сколько процентов подорожала куртка?',
                E'1. Найдём абсолютное подорожание (разницу в цене):\n   4173 - 3900 = 273 рубля.\n2. Найдём, сколько процентов эта разница составляет от первоначальной цены (3900 рублей).\n   Процент подорожания = (Разница / Старая цена) * 100%\n   Процент = (273 / 3900) * 100%\n   Процент = (273 / 39) % \n   Делим 273 на 39: 273 / 39 = 7.\n   Процент подорожания = 7%.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7%', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '273', false); -- Absolute difference
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '6.5', false); -- Approx (273/4173)*100
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '107', false); -- New price percentage

        -- Question 6 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Диагностика 29 машин в таксопарке показала, что в 12 машинах нужно заменить тормозные колодки, а в 7 машинах — заменить воздушный фильтр (замена тормозных колодок и замена фильтра — независимые виды работ).\nВыберите верные утверждения и запишите в ответе их номера.\n1) Найдётся 9 машин, в которых нужно заменить и тормозные колодки, и фильтр.\n2) Если в машине нужно заменить тормозные колодки, то и фильтр нужно заменить.\n3) Не найдётся 9 машин, в которых нужно заменить и тормозные колодки, и фильтр.\n4) Найдётся 9 машин, в которых не нужно менять ни тормозные колодки, ни фильтр.',
                E'Данные: Всего=29, Колодки(К)=12, Фильтр(Ф)=7.\nПроверка:\n1) Найдётся 9 машин (К И Ф)? Максимальное кол-во (К И Ф) = min(12, 7) = 7. Значит, 9 таких машин точно не найдётся. Неверно.\n2) Если К, то Ф? Это значит, что все 12 машин с К должны быть и с Ф. Но с Ф всего 7 машин. Неверно.\n3) Не найдётся 9 машин (К И Ф)? Да, так как максимум таких машин 7 (см. п.1). Верно.\n4) Найдётся 9 машин (Не К И Не Ф)? Кол-во машин хотя бы с одной проблемой (К ИЛИ Ф) = К + Ф - (К И Ф). Максимум проблемных = 12 + 7 - 0 = 19. Минимум проблемных = 12 + 7 - 7 = 12. Значит, машин без проблем (Не К И Не Ф) = Всего - (К ИЛИ Ф). Минимум без проблем = 29 - 19 = 10. Максимум без проблем = 29 - 12 = 17. Так как минимум 10 машин без проблем, то 9 таких точно найдётся. Верно.\nВерные утверждения: 3 и 4.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '34', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '43', true); -- Allow reversed order
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '3', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false);

        -- Question 7 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На диаграмме представлена информация о покупках, сделанных в интернетмагазинах некоторого города в выходные дни. Всего за выходные было совершено 50 000 покупок. Определите по диаграмме, сколько примерно покупок относится к категории «Косметика и парфюмерия».\n\n[Круговая диаграмма покупок]',
                E'Найди на диаграмме сектор "Косметика и парфюмерия". Оцени его долю. Визуально он может быть около 15-25%.\nВозьмём оценку 20%. Количество = 0,20 * 50 000 = 10 000.\nОфициальный ответ допускает диапазон 7 000 - 11 000. Значение 9000 (середина) подходит.', 7)
        RETURNING id INTO q_id;
        -- Answer range is 7000-11000.
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '7000-11000', true); -- Representing the allowed range

        -- Question 8 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'График функции y = kx + 5 проходит через точку (-6, 11). Найдите коэффициент k.',
                E'Подставим координаты точки (x=-6, y=11) в уравнение функции y = kx + 5:\n11 = k * (-6) + 5\n11 = -6k + 5\nПеренесем 5 влево:\n11 - 5 = -6k\n6 = -6k\nНаходим k:\nk = 6 / (-6) = -1.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-1', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-8/3', false); -- (11+5)/(-6)
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-61', false); -- -6*11+5

        -- Question 9 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Решите уравнение 6x − 8 = 5 x − 3 (x − 4).',
                E'1. Раскроем скобки в правой части: -3*(x-4) = -3x + 12.\n   Уравнение: 6x - 8 = 5x - 3x + 12.\n2. Упростим правую часть: 5x - 3x = 2x.\n   Уравнение: 6x - 8 = 2x + 12.\n3. Переносим x влево, числа вправо:\n   6x - 2x = 12 + 8.\n4. Упрощаем: 4x = 20.\n5. Находим x: x = 20 / 4 = 5.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '5', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2.5', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '10', false);

        -- Question 10 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Александр работает в службе доставки интернет-магазина. Для упаковки коробок используется скотч. Он упаковал 400 больших коробок и израсходовал два рулона скотча полностью, а от третьего осталось ровно две пятых, при этом на каждую коробку расходовалось по 65 см скотча. Ему нужно заклеить скотчем 560 одинаковых коробок, на каждую нужно по 55 см скотча. Хватит ли трёх целых таких рулонов скотча? Запишите решение и ответ.',
                E'1. Сколько скотча в 1 рулоне? Израсходовано: 2 + (1 - 2/5) = 2 + 3/5 = 13/5 рулона. Всего скотча: 400 * 65 = 26000 см. В 1 рулоне: 26000 / (13/5) = 26000 * 5 / 13 = 2000 * 5 = 10000 см.\n2. Сколько скотча нужно? 560 * 55 = 30800 см.\n3. Сколько скотча в 3 рулонах? 3 * 10000 = 30000 см.\n4. Сравнение: Нужно 30800 см, есть 30000 см. 30000 < 30800.\nОтвет: Нет, не хватит.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Нет', true);

        -- Question 11 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Найдите значение выражения (− x − 5)(x − 5) + x (x + 10 ) при x = − 13/5.',
                E'Упростим выражение.\n1. (− x − 5)(x − 5) = -(x + 5)(x - 5) = -(x² - 25) = -x² + 25.\n2. x(x + 10) = x² + 10x.\n3. Выражение: (-x² + 25) + (x² + 10x) = -x² + 25 + x² + 10x = 10x + 25.\n4. Подставляем x = -13/5:\n   10 * (-13/5) + 25 = (10/5) * (-13) + 25 = 2 * (-13) + 25 = -26 + 25 = -1.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-1', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-25', false); -- Common mistake or maybe key typo
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '1', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '24', false);

        -- Question 12 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Отметьте и подпишите на координатной прямой точки A (-3 1/4), B (2 5/6), C (-2 3/7).\n\n[Координатная прямая]',
                E'Нужно расположить точки на прямой.\n*   A(-3 1/4) = -3.25. Находится между -3 и -4, ближе к -3.\n*   B(2 5/6) ≈ 2.83. Находится между 2 и 3, ближе к 3.\n*   C(-2 3/7) ≈ -2.43. Находится между -2 и -3, ближе к -2.\nСравнение A и C: -3.25 < -2.43. Значит, A левее C.\nПорядок слева направо: A, C, B.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Рисунок]', true); -- Placeholder for drawing task

        -- Question 13 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'На клетчатой бумаге с размером клетки 1× 1 нарисованы два четырёхугольника: ABCD и ADEF. Найдите разность периметров четырёхугольников ABCD и ADEF.\n\n[Рисунок четырёхугольников ABCD и ADEF]',
                E'Периметр(ABCD) = AB + BC + CD + DA.\nПериметр(ADEF) = AD + DE + EF + FA.\nРазность = P(ABCD) - P(ADEF) = (AB + BC + CD + DA) - (AD + DE + EF + FA).\nЕсли сторона AD общая, то Разность = AB + BC + CD - DE - EF - FA.\nБез рисунка точный расчет невозможен. Ответ из ключа: 2 (или -2, в зависимости от порядка вычитания).', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '-2', true); -- Allow negative difference
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '0', false);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '4', false);

        -- Question 14 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Между сторонами угла АОВ, равного 156°, проведены лучи ОС и ОМ так, что угол АОС на 32° меньше угла ВОС, а ОМ — биссектриса угла ВОС. Найдите величину угла СОМ. Ответ дайте в градусах. Запишите решение и ответ.',
                E'1. Пусть ∠BOC = y. Тогда ∠AOC = y - 32°.\n2. Сумма углов: ∠AOC + ∠BOC = ∠AOB\n   (y - 32°) + y = 156°\n3. Решаем: 2y - 32° = 156° => 2y = 188° => y = 94°. Значит, ∠BOC = 94°.\n4. OM - биссектриса ∠BOC. Значит, ∠COM = ∠BOC / 2.\n5. ∠COM = 94° / 2 = 47°. \nРешение: Пусть ∠ВОС = y, тогда ∠АОС = y - 32°. Так как ∠АОВ = ∠АОС + ∠ВОС, то 156° = (y - 32°) + y. 156° = 2y - 32°. 2y = 188°. y = 94°. Значит, ∠ВОС = 94°. ОМ - биссектриса ∠ВОС, поэтому ∠СОМ = ∠ВОС / 2 = 94° / 2 = 47°.\nОтвет: 47.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '47', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '94', false); -- BOC
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '62', false); -- AOC
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '78', false); -- AOB / 2

        -- Question 15 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Прочитайте текст. В понедельник парикмахерскую посетило 34 человека. А во вторник — на одного человека больше. В среду в этой парикмахерской делают скидки пенсионерам, поэтому число посетителей было на 20% больше, чем во вторник. В четверг пришло на 9 человек меньше, чем в среду, и это была самая низкая посещаемость за неделю. В пятницу парикмахерскую посетило на 7 человек больше, чем в четверг. В выходные количество клиентов обычно увеличивается. В субботу посетителей было столько же, сколько в среду, а в воскресенье — на 10 человек больше, чем в субботу, и это была самая высокая посещаемость за неделю. По описанию постройте график зависимости числа посетителей парикмахерской от дня недели. Соседние точки соедините отрезками. Точка, показывающая число посетителей в понедельник, уже отмечена на рисунке.\n\n[Система координат День недели - Посетители]',
                E'Рассчитаем посетителей по дням:\n*   Пн: 34 (дано)\n*   Вт: 34 + 1 = 35\n*   Ср: 35 + 20% от 35 = 35 + (0,2 * 35) = 35 + 7 = 42\n*   Чт: 42 - 9 = 33 (самая низкая)\n*   Пт: 33 + 7 = 40\n*   Сб: 42 (столько же, сколько в Ср)\n*   Вс: 42 + 10 = 52 (самая высокая)\nОтметьте точки (Пн, 34), (Вт, 35), (Ср, 42), (Чт, 33), (Пт, 40), (Сб, 42), (Вс, 52) и соедините их отрезками.', 15)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[График]', true); -- Placeholder for graph task

        -- Question 16 (Var 5)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_math_7_id, variant_num, E'Расстояние между пунктами А и В равно 460 км. В 8 часов утра из пункта А в пункт В выехал автобус со скоростью 70 км/ч. В 10 часов утра навстречу ему из пункта В выехал легковой автомобиль со скоростью 90 км/ч, через некоторое время они встретились. Найдите расстояние от пункта В до места встречи. Запишите решение и ответ.',
                E'1. В 10:00 (момент выезда автомобиля) автобус был в пути 2 часа.\n2. Расстояние, пройденное автобусом к 10:00: S_авт_10 = 70 км/ч * 2 ч = 140 км.\n3. Расстояние между автобусом и автомобилем в 10:00: S_10 = 460 км - 140 км = 320 км.\n4. Скорость сближения: V_сбл = V_авт + V_автм = 70 км/ч + 90 км/ч = 160 км/ч.\n5. Время до встречи (с момента 10:00): t_встр = S_10 / V_сбл = 320 км / 160 км/ч = 2 часа.\n6. Автомобиль выехал в 10:00 и ехал до встречи 2 часа.\n7. Расстояние от пункта В до места встречи - это путь, пройденный автомобилем.\n   S_В_встр = V_автм * t_встр = 90 км/ч * 2 ч = 180 км.\nРешение: К 10:00 автобус проехал 70*2=140 км. Оставшееся расстояние 460-140=320 км. Скорость сближения 70+90=160 км/ч. Время до встречи t=320/160=2 ч. За это время автомобиль проехал от В расстояние S=90*2=180 км.\nОтвет: 180.', 16)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '180', true);
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '280', false); -- Distance from A (140+70*2)
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '320', false); -- Distance at 10:00
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '2', false); -- Time to meet

    ELSE
        RAISE NOTICE 'Subject "Математика" for grade 7 not found. Skipping Variant 5.';
    END IF;

END $$;
