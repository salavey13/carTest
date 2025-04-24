-- Ensure the geography subject exists (already done in the previous script, but good practice to include)
INSERT INTO public.subjects (name, description, grade_level) VALUES
('География', E'## ВПР по Географии (6 класс) \n\nПроверочная работа охватывает **основные темы**, изученные в 6 классе по географии.\n\n**Что будет проверяться:**\n\n*   🗺️ Работа с **картой мира**: материки, океаны, координаты, направления.\n*   🧭 Работа с **топографической картой**: масштаб, условные знаки, рельеф, азимут.\n*   🌳 **Природные зоны**: их особенности, расположение, флора и фауна.\n*   ☀️ **Погода и климат**: условные обозначения, причины явлений.\n*   🌍 **Географическая оболочка**: её части и взаимодействие.\n*   📊 Работа с **таблицами и данными** о населении и странах.\n*   🚢 Знание **великих путешественников** и их открытий.', 6)
ON CONFLICT (name, grade_level) DO NOTHING;

-- Clear existing geography questions for idempotency (Variants 6-10)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'География' AND grade_level = 6) AND variant_number BETWEEN 6 AND 10);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'География' AND grade_level = 6) AND variant_number BETWEEN 6 AND 10;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 6 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 6... Africa and beyond!';

        -- Q6.1 (World Map - Identify Continent by Position)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'Какой материк омывается Атлантическим океаном с запада и Индийским океаном с востока?', E'Африка - единственный материк, западное побережье которого омывает Атлантический океан, а восточное - Индийский. Евразия тоже, но её западная часть омывается Атлантикой, а восточная - Тихим.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия', false),
        (q_id, 'Южная Америка', false),
        (q_id, 'Африка', true),
        (q_id, 'Северная Америка', false);

        -- Q6.2 (World Map - Explorer/Continent Match - Vasco da Gama)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'Какой путешественник (портрет предположительно Васко да Гама) открыл морской путь из Европы в Индию, обогнув Африку?', E'Васко да Гама - португальский мореплаватель, который первым проложил морской путь из Европы в Индию вокруг Африки, обогнув мыс Доброй Надежды.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Христофор Колумб', false),
        (q_id, 'Фернан Магеллан', false),
        (q_id, 'Васко да Гама', true),
        (q_id, 'Джеймс Кук', false);

        -- Q6.3 (World Map - Coordinates/Direction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'Найдите на карте мира Пекин (~40° с.ш. 116° в.д.) и Лондон (~51° с.ш. 0° д.). В каком направлении от Лондона находится Пекин?', E'Пекин находится восточнее Лондона (116° в.д. против 0° д.) и немного южнее (40° с.ш. против 51° с.ш.). Общее направление из Лондона в Пекин - юго-восточное.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На северо-западе', false),
        (q_id, 'На юго-востоке', true),
        (q_id, 'На юго-западе', false),
        (q_id, 'На северо-востоке', false);

        -- Q6.4 (World Map - Object Description - Sahara)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'Какой географический объект описан? "Крупнейшая жаркая пустыня мира, расположена в Северной Африке, занимает огромную территорию, характеризуется песчаными дюнами и каменистыми плато."', E'Описание точно соответствует пустыне Сахара в Северной Африке. Гоби - в Азии, Калахари - в Южной Африке, Атакама - в Южной Америке.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Пустыня Гоби', false),
        (q_id, 'Пустыня Калахари', false),
        (q_id, 'Пустыня Сахара', true),
        (q_id, 'Пустыня Атакама', false);

        -- Q6.5 (Topo Map - Direction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'По топографической карте (см. образец ВПР). В каком направлении от родника находится точка А (на холме)?', E'Находим родник (кружок с точкой), находим точку А (на вершине холма). Мысленно ставим компас на родник. Точка А находится правее (восточнее) и выше (севернее). Общее направление - северо-восточное.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На юго-западе', false),
        (q_id, 'На северо-востоке', true),
        (q_id, 'На юго-востоке', false),
        (q_id, 'На западе', false);

        -- Q6.6 (Topo Map - Distance Conceptual)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'По топографической карте (масштаб 1:10000, в 1 см 100 м). Оцените примерное расстояние на местности по прямой от родника до церкви. (Используйте линейку, измерьте по образцу ~3.5 см).', E'Измеряем линейкой расстояние от родника до церкви на карте образца. Получается примерно 3.5 см. Масштаб: в 1 см - 100 м. Значит, 3.5 см * 100 м/см = 350 м. (Допускается погрешность).', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '350', true); -- Free response, allow range like 340-360

        -- Q6.7 (Time Zones Calculation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'Разница во времени между Москвой и Владивостоком +7 часов. Когда во Владивостоке 16:00, сколько времени в Москве?', E'В Москве на 7 часов МЕНЬШЕ, чем во Владивостоке. Значит, из 16:00 вычитаем 7 часов. 16 - 7 = 9. В Москве будет 9:00 утра.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '23:00', false),
        (q_id, '09:00', true),
        (q_id, '16:00', false),
        (q_id, '07:00', false);

        -- Q6.8 (Weather - Wind Rose - Least Frequent)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'По розе ветров (см. образец ВПР). Какой ветер реже всего дул в январе?', E'Ищем самый короткий луч (или отсутствие луча) на розе ветров. В образце самый короткий луч соответствует направлению С (север). Значит, северный ветер был самым редким.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Юго-восточный', false),
        (q_id, 'Западный', false),
        (q_id, 'Северный', true),
        (q_id, 'Южный', false);

        -- Q6.9 (Population Table - Rank Urban Ascending)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 6, E'Используя таблицу (см. образец ВПР), расположите страны в порядке ВОЗРАСТАНИЯ доли городского населения: 1-Австралия(88%), 2-Греция(80%), 3-Египет(43%), 4-Франция(80%).', E'Смотрим столбец "городское население, %". Самая маленькая доля у Египта (43%) - №3. Затем идут Греция и Франция (по 80%) - №2 и №4 (их порядок не важен). Самая большая доля у Австралии (88%) - №1. Порядок возрастания: 3, 2, 4, 1 (или 3, 4, 2, 1).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1423', false),
        (q_id, '3241', true), -- or 3421 would also be correct technically
        (q_id, '2431', false),
        (q_id, '3124', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 6.';
    END IF;
END $$;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 7 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 7... Baikal and Himalayas!';

        -- Q7.1 (World Map - Identify Ocean)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'Какой океан расположен к югу от Азии, между Африкой и Австралией?', E'Эта позиция соответствует Индийскому океану. Он третий по величине.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Атлантический', false),
        (q_id, 'Тихий', false),
        (q_id, 'Северный Ледовитый', false),
        (q_id, 'Индийский', true);

        -- Q7.2 (World Map - Coordinates Find Object - Baikal)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'Найдите на карте мира точку с примерными координатами 53° с.ш. 108° в.д. Какой уникальный природный объект находится вблизи?', E'Эти координаты соответствуют расположению озера Байкал в России (Восточная Сибирь) - самого глубокого пресноводного озера в мире.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Река Амазонка', false),
        (q_id, 'Озеро Байкал', true),
        (q_id, 'Горы Гималаи', false),
        (q_id, 'Пустыня Сахара', false);

        -- Q7.3 (World Map - Object Description - Himalayas)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'Определите горную систему по описанию: "Высочайшие горы на Земле, расположены в Азии между Тибетским нагорьем и Индо-Гангской равниной, здесь находится гора Эверест."', E'Описание точно соответствует Гималаям, где расположена самая высокая вершина мира - Эверест (Джомолунгма). Анды - в Южной Америке, Альпы - в Европе, Кордильеры - в Северной Америке.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Анды', false),
        (q_id, 'Альпы', false),
        (q_id, 'Кордильеры', false),
        (q_id, 'Гималаи', true);

        -- Q7.4 (Topo Map - River Banks)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'По топографической карте (см. образец ВПР). На каком берегу реки Михалёвки находится родник?', E'Смотрим на реку Михалёвку, стрелка показывает направление течения (сверху вниз). Встаем лицом ПО течению реки. Родник (кружок с точкой) будет слева. Значит, он на левом берегу.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На правом', false),
        (q_id, 'На левом', true);

        -- Q7.5 (Topo Map - Feature Identification in Square)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'По топографической карте (см. образец ВПР). Какой тип леса преобладает в квадрате А (верхний левый)?', E'Смотрим на условные знаки в квадрате А. Там видны значки как лиственных, так и хвойных деревьев (кружки и звездочки). Это смешанный лес.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Хвойный лес (тайга)', false),
        (q_id, 'Лиственный лес', false),
        (q_id, 'Смешанный лес', true),
        (q_id, 'Кустарник', false);

        -- Q7.6 (Schedule Interpretation - Duration)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'Используя режим дня школьника (см. образец ВПР). Сколько времени Настя тратит на выполнение домашних заданий?', E'Находим в таблице строчку "Выполнение домашних заданий". Время: 16:45 - 18:45. Продолжительность: 18:45 - 16:45 = 2 часа.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1 час', false),
        (q_id, '1 час 30 минут', false),
        (q_id, '2 часа', true),
        (q_id, '2 часа 15 минут', false);

        -- Q7.7 (Natural Zones Match - Arctic/Steppe)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'Установите соответствие: А-Арктическая пустыня, Б-Степь. 1)Плодородные почвы (чернозёмы); 2)Очень холодно, ледники; 3)Травы (ковыль, типчак); 4)Белые медведи, моржи; 5)Грызуны (суслики), орлы; 6)Зона расположена южнее лесов.', E'А (Аркт. пустыня): Очень холодно/ледники (2), белые медведи/моржи (4). Подходит: 24. Б (Степь): Чернозёмы (1), травы (3), грызуны/орлы (5), южнее лесов (6). Подходит: 1356.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А-1356, Б-24', false),
        (q_id, 'А-24, Б-1356', true),
        (q_id, 'А-123, Б-456', false),
        (q_id, 'А-456, Б-123', false);

        -- Q7.8 (Dangerous Phenomena - Flood)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'Наводнение - это значительный подъём уровня воды в реке или озере. В какой географической оболочке в первую очередь происходит это явление?', E'Наводнение - это явление, связанное с водой (реки, озера). Водная оболочка Земли называется ГИДРОСФЕРА.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Литосфере', false),
        (q_id, 'Атмосфере', false),
        (q_id, 'Биосфере', false),
        (q_id, 'Гидросфере', true);

        -- Q7.9 (Population Table - Analysis - Max Population)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 7, E'Используя таблицу (см. образец ВПР). Какая из представленных стран имеет НАИБОЛЬШУЮ численность населения?', E'Смотрим столбец "Численность населения, млн человек". Сравниваем числа: Австралия(25), Греция(11), Египет(95), Франция(65). Самое большое число у Египта (95 млн).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия', false),
        (q_id, 'Греция', false),
        (q_id, 'Египет', true),
        (q_id, 'Франция', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 7.';
    END IF;
END $$;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 8 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 8... To South America!';

        -- Q8.1 (World Map - Identify Continent)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'Какой материк расположен к югу от Северной Америки и омывается Тихим и Атлантическим океанами?', E'К югу от Северной Америки, между Тихим и Атлантическим океанами, находится Южная Америка.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Африка', false),
        (q_id, 'Австралия', false),
        (q_id, 'Южная Америка', true),
        (q_id, 'Антарктида', false);

        -- Q8.2 (World Map - Explorer/Continent Match - Magellan)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'Чьё имя носит пролив между Южной Америкой и островом Огненная Земля, пройденный во время первого кругосветного плавания (портрет предположительно Магеллана)?', E'Фернан Магеллан возглавил первую кругосветную экспедицию. Пролив, который он открыл и прошёл у южной оконечности Южной Америки, назван в его честь - Магелланов пролив.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Христофора Колумба', false),
        (q_id, 'Васко да Гамы', false),
        (q_id, 'Фернана Магеллана', true),
        (q_id, 'Абеля Тасмана', false);

        -- Q8.3 (World Map - Coordinates/Direction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'Найдите на карте мира Рио-де-Жанейро (~23° ю.ш. 43° з.д.) и Каир (~30° с.ш. 31° в.д.). В каком направлении от Каира находится Рио-де-Жанейро?', E'Рио-де-Жанейро находится в Южном полушарии (Каир - в Северном) и в Западном полушарии (Каир - в Восточном). Значит, из Каира в Рио нужно двигаться на юго-запад.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На северо-восток', false),
        (q_id, 'На юго-восток', false),
        (q_id, 'На юго-запад', true),
        (q_id, 'На северо-запад', false);

        -- Q8.4 (World Map - Object Description - Andes)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'Определите горы по описанию: "Самая длинная горная цепь мира, протянувшаяся вдоль западного побережья Южной Америки."', E'Анды - самая длинная горная система на суше, тянется вдоль всего западного побережья Южной Америки. Кордильеры - в Сев. Америке, Гималаи - в Азии, Альпы - в Европе.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Кордильеры', false),
        (q_id, 'Гималаи', false),
        (q_id, 'Альпы', false),
        (q_id, 'Анды', true);

        -- Q8.5 (Topo Map - Relative Height)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'По топографической карте (см. образец ВПР). Что расположено выше над уровнем моря - родник или церковь?', E'Находим родник (около горизонтали 107.5 м, возможно, чуть ниже). Находим церковь (выше горизонтали 107.5 м). Следовательно, церковь расположена выше родника.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Родник', false),
        (q_id, 'Церковь', true),
        (q_id, 'Они на одной высоте', false),
        (q_id, 'Невозможно определить', false);

        -- Q8.6 (Topo Map - Profile Sketch - conceptual)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'Представьте, что вы строите профиль рельефа по линии от точки B к реке (на юг). Как будет выглядеть профиль?', E'Точка B находится на относительно ровном участке (между горизонталями 107.5 и 110). К югу рельеф понижается к реке (пересекаем горизонталь 107.5, затем, возможно, 105). Профиль будет показывать спуск от точки B к реке.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Резкий подъем от B к реке', false),
        (q_id, 'Плавный спуск от B к реке', true),
        (q_id, 'Сначала подъем, потом спуск', false),
        (q_id, 'Ровная линия', false);

        -- Q8.7 (Causes of Time Difference - Reiteration)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'Главная причина существования часовых поясов и разницы во времени на Земле - это...', E'Земля вращается вокруг своей оси, подставляя разные части под солнечные лучи. Это осевое вращение и является причиной смены дня и ночи и разницы во времени.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Движение Земли вокруг Солнца', false),
        (q_id, 'Наклон земной оси', false),
        (q_id, 'Осевое вращение Земли', true),
        (q_id, 'Разная скорость вращения на экваторе и полюсах', false);

        -- Q8.8 (Weather Symbols Interpretation - Temp > 0)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'Какой буквой (А, Б, В - см. образец ВПР) обозначен рисунок погоды с температурой ВЫШЕ 0°C?', E'Смотрим на температуру рядом с каждым рисунком. А: -16°C. Б: -10°C. В: +2°C. Выше 0°C только на рисунке В (+2°C).', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А', false),
        (q_id, 'Б', false),
        (q_id, 'В', true);

        -- Q8.9 (Table/Photo/Object ID - Egypt/Pyramids/Nile)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 8, E'На фотографии (предположим, пирамиды Гизы). В какой стране из таблицы (Австралия, Греция, Египет, Франция) сделана эта фотография? Какая великая река протекает через эту страну?', E'Пирамиды Гизы - знаменитый символ Египта. Через Египет протекает одна из величайших рек мира - Нил.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Греция, Дунай', false),
        (q_id, 'Египет, Нил', true),
        (q_id, 'Франция, Сена', false),
        (q_id, 'Австралия, Муррей', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 8.';
    END IF;
END $$;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 9 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 9... Pacific vastness!';

        -- Q9.1 (World Map - Identify Ocean)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'Какой океан является самым большим и глубоким на Земле?', E'Тихий океан - самый большой по площади и самый глубокий океан нашей планеты.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Атлантический', false),
        (q_id, 'Индийский', false),
        (q_id, 'Северный Ледовитый', false),
        (q_id, 'Тихий', true);

        -- Q9.2 (World Map - Coordinates Find Location Type - Atlantic/Iceland)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'Найдите на карте мира точку с координатами 65° с.ш. 20° з.д. Где примерно расположена эта точка?', E'65° северной широты и 20° западной долготы - это координаты, соответствующие острову Исландия или его окрестностям в северной части Атлантического океана.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'В Гренландии', false),
        (q_id, 'В Северном Ледовитом океане', false),
        (q_id, 'В Атлантическом океане (около Исландии)', true),
        (q_id, 'В Скандинавии', false);

        -- Q9.3 (World Map - Object Description - Great Plains)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'Определите географический объект: "Обширные равнины в Северной Америке, к востоку от Кордильер, простирающиеся от Канады до Мексики, исторически - область прерий."', E'Это описание соответствует Великим равнинам (Great Plains) в Северной Америке.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Амазонская низменность', false),
        (q_id, 'Великие равнины', true),
        (q_id, 'Восточно-Европейская равнина', false),
        (q_id, 'Западно-Сибирская равнина', false);

        -- Q9.4 (Topo Map - Direction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'По топографической карте (см. образец ВПР). В каком направлении от точки B (на ровном месте) находится точка С (возле леса)?', E'Находим точку B, находим точку C. Мысленно ставим компас на точку B. Точка C находится ниже (южнее) и левее (западнее). Общее направление - юго-западное.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На северо-востоке', false),
        (q_id, 'На юго-западе', true),
        (q_id, 'На юго-востоке', false),
        (q_id, 'На севере', false);

        -- Q9.5 (Topo Map - Feature Choice Reason - Picnic)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'Участок в квадрате В (см. топокарту образца) выбрали для пикника. Какая особенность местности наиболее важна для такого выбора?', E'Для пикника обычно выбирают ровное, открытое место, желательно недалеко от воды или леса. В квадрате В есть луг (ровное место) и река. Луг (открытое ровное место) - ключевая особенность для пикника.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Крутой склон', false),
        (q_id, 'Наличие леса', false), // Can be nearby, but the site itself is usually open
        (q_id, 'Ровная открытая местность (луг)', true),
        (q_id, 'Близость к церкви', false);

        -- Q9.6 (Time Zones - Calc Difference) - Simplified
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'Самолет вылетел из города А в 10:00 по местному времени и прилетел в город Б в 14:00 по местному времени города Б. Сам полёт длился 2 часа. Какова разница во времени между городами А и Б?', E'Полёт длился 2 часа. Если бы время было одинаковым, самолет прилетел бы в 10:00 + 2 часа = 12:00 по времени города А. Но по времени города Б было 14:00. Значит, время в городе Б опережает время в городе А на 14:00 - 12:00 = 2 часа. Разница +2 часа.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '+4 часа', false),
        (q_id, '-2 часа', false),
        (q_id, '+2 часа', true),
        (q_id, 'Нет разницы', false);

        -- Q9.7 (Natural Zone Photo ID - Desert)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'На какой из фотографий (предположим, есть фото пустыни, тайги, тундры) изображена ПУСТЫНЯ?', E'Пустыня характеризуется скудной растительностью (или её отсутствием), песками или каменистой поверхностью, часто жарким и сухим климатом. Ищем фото с песчаными дюнами или каменистой пустошью с редкими растениями.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Фото с хвойными деревьями', false),
        (q_id, 'Фото с мхами и карликовыми березами', false),
        (q_id, 'Фото с песчаными дюнами и верблюдом', true);

        -- Q9.8 (Human Impact - Positive Example - conceptual)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'Какое из перечисленных действий человека является примером ПОЛОЖИТЕЛЬНОГО влияния на природу?', E'Создание заповедников и национальных парков направлено на охрану природы, сохранение видов и экосистем. Вырубка лесов, загрязнение и осушение болот - негативные воздействия.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Вырубка лесов', false),
        (q_id, 'Создание заповедников', true),
        (q_id, 'Загрязнение рек отходами', false),
        (q_id, 'Осушение болот', false);

        -- Q9.9 (Population Table - Rank Total Ascending)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 9, E'Используя таблицу (см. образец ВПР), расположите страны в порядке ВОЗРАСТАНИЯ общей численности населения: 1-Австралия(25), 2-Греция(11), 3-Египет(95), 4-Франция(65).', E'Смотрим столбец "Численность населения, млн человек". Самая маленькая у Греции (11 млн) - №2. Потом Австралия (25 млн) - №1. Потом Франция (65 млн) - №4. Самая большая у Египта (95 млн) - №3. Порядок возрастания: 2, 1, 4, 3.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '3412', false),
        (q_id, '1234', false),
        (q_id, '2143', true),
        (q_id, '4312', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 9.';
    END IF;
END $$;

-- ==============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 10 ===
-- ==============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 10... To the South Pole and back!';

        -- Q10.1 (World Map - Identify Continent - Antarctica)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'Какой материк расположен вокруг Южного полюса и почти полностью покрыт льдом?', E'Материк, расположенный на самом юге планеты и покрытый мощным ледниковым щитом, - это Антарктида.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия', false),
        (q_id, 'Гренландия (остров)', false),
        (q_id, 'Антарктида', true),
        (q_id, 'Арктика (регион)', false);

        -- Q10.2 (World Map - Explorer/Continent Match - Cook)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'Какой британский мореплаватель (портрет предположительно Джеймса Кука) совершил три кругосветных плавания, исследовал восточное побережье Австралии и многие острова Тихого океана?', E'Джеймс Кук известен своими тремя экспедициями, в ходе которых он детально картировал побережья Австралии, Новой Зеландии, открыл Гавайские острова и множество других островов в Тихом океане.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Френсис Дрейк', false),
        (q_id, 'Джеймс Кук', true),
        (q_id, 'Христофор Колумб', false),
        (q_id, 'Абель Тасман', false);

        -- Q10.3 (World Map - Coordinates/Direction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'Найдите на карте мира Токио (~36° с.ш. 140° в.д.) и Сидней (~34° ю.ш. 151° в.д.). В каком направлении от Сиднея находится Токио?', E'Токио находится в Северном полушарии (Сидней - в Южном) и почти на той же долготе, но чуть западнее (140° в.д. против 151° в.д.). Значит, из Сиднея в Токио нужно двигаться в основном на север, с небольшим отклонением к западу. Основное направление - северное/северо-западное.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На юге', false),
        (q_id, 'На юго-востоке', false),
        (q_id, 'На северо-западе', true), // Primarily North, slightly West
        (q_id, 'На востоке', false);

        -- Q10.4 (World Map - Object Description - Great Barrier Reef)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'Определите уникальный природный объект: "Крупнейшая в мире система коралловых рифов, расположенная в Коралловом море у северо-восточного побережья Австралии."', E'Это описание точно соответствует Большому Барьерному рифу - уникальному природному образованию, созданному живыми организмами (кораллами).', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Марианская впадина', false),
        (q_id, 'Галапагосские острова', false),
        (q_id, 'Большой Барьерный риф', true),
        (q_id, 'Мадагаскар', false);

        -- Q10.5 (Topo Map - Feature Location near Point)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'По топографической карте (см. образец ВПР). Какой объект находится на вершине холма, обозначенной точкой А?', E'Точка А расположена на самой высокой отметке холма, отмеченной горизонталью 110 м. На самой вершине нет других условных знаков, кроме самой точки А, указывающей на вершину.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Церковь', false),
        (q_id, 'Родник', false),
        (q_id, 'Вершина холма', true),
        (q_id, 'Лес', false);

        -- Q10.6 (Topo Map - Distance Conceptual C-B)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'По топографической карте (масштаб 1:10000, в 1 см 100 м). Оцените примерное расстояние на местности по прямой от точки C до точки B. (Используйте линейку, измерьте по образцу ~2.8 см).', E'Измеряем линейкой расстояние от центра точки C до центра точки B на карте образца. Получается примерно 2.8 см. Масштаб: в 1 см - 100 м. Значит, 2.8 см * 100 м/см = 280 м. (Допускается погрешность).', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '280', true); -- Free response, allow range like 270-290

        -- Q10.7 (Cause of Seasons - Reiteration)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'Смена времен года на Земле (лето, осень, зима, весна) происходит потому, что...', E'Земля движется вокруг Солнца, и её ось вращения наклонена к плоскости орбиты. Из-за этого наклона полушария поочередно получают больше или меньше солнечного тепла в течение года.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Земля вращается вокруг своей оси', false),
        (q_id, 'Расстояние от Земли до Солнца меняется', false), // Minor effect compared to tilt
        (q_id, 'Земная ось наклонена при движении вокруг Солнца', true),
        (q_id, 'Луна влияет на климат', false);

        -- Q10.8 (Weather Diary - Draw Symbols - conceptual)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'Как с помощью условных знаков погоды (см. образец ВПР) отобразить: "Облачно с прояснениями, слабый дождь, ветер юго-восточный"?', E'Облачно с прояснениями - круг, закрашенный наполовину. Слабый дождь - запятая (,). Ветер юго-восточный - стрелка ИЗ юго-востока (Ю-В) к центру, короткая с одной-двумя черточками.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Закрашенный круг, снежинка, стрелка из С', false),
        (q_id, 'Пустой круг, точка, стрелка из ЮЗ', false),
        (q_id, 'Наполовину закрашенный круг, запятая, стрелка из ЮВ', true),
        (q_id, 'Круг с чертой, без осадков, штиль', false);

        -- Q10.9 (Population Table - Analysis - Min Rural)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 10, E'Используя таблицу (см. образец ВПР). В какой из представленных стран НАИМЕНЬШАЯ доля сельского населения?', E'Смотрим столбец "сельское население, %". Сравниваем числа: Австралия(12%), Греция(20%), Египет(57%), Франция(20%). Самое маленькое число у Австралии (12%).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия', true),
        (q_id, 'Греция', false),
        (q_id, 'Египет', false),
        (q_id, 'Франция', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 10.';
    END IF;
END $$;