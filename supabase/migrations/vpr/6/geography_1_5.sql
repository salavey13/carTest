-- Ensure the geography subject exists
INSERT INTO public.subjects (name, description, grade_level) VALUES
('География', E'## ВПР по Географии (6 класс) \n\nПроверочная работа охватывает **основные темы**, изученные в 6 классе по географии.\n\n**Что будет проверяться:**\n\n*   🗺️ Работа с **картой мира**: материки, океаны, координаты, направления.\n*   🧭 Работа с **топографической картой**: масштаб, условные знаки, рельеф, азимут.\n*   🌳 **Природные зоны**: их особенности, расположение, флора и фауна.\n*   ☀️ **Погода и климат**: условные обозначения, причины явлений.\n*   🌍 **Географическая оболочка**: её части и взаимодействие.\n*   📊 Работа с **таблицами и данными** о населении и странах.\n*   🚢 Знание **великих путешественников** и их открытий.', 6)
ON CONFLICT (name, grade_level) DO NOTHING;

-- Clear existing geography questions for idempotency (Variants 1-5)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'География' AND grade_level = 6) AND variant_number BETWEEN 1 AND 5);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'География' AND grade_level = 6) AND variant_number BETWEEN 1 AND 5;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 1 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 1... Let''s navigate!';

        -- Q1.1 (World Map - Continents)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'На карте мира (см. образец ВПР) буквой А обозначена Австралия. Какой материк обозначен буквой Б?', E'Смотрим на карту из образца ВПР. Буква Б находится в Северном полушарии, западнее Евразии. Это Северная Америка. Не путай с Южной!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Южная Америка', false),
        (q_id, 'Африка', false),
        (q_id, 'Северная Америка', true),
        (q_id, 'Евразия', false);

        -- Q1.2 (World Map - Explorers)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'С каким материком, обозначенным на карте мира буквами А или Б, связаны открытия Абеля Тасмана (портрет слева)?', E'Абель Тасман - голландский мореплаватель, исследовавший Австралию (материк А), Новую Зеландию и Тасманию (остров назван в его честь). Миклухо-Маклай тоже связан с этим регионом (Новая Гвинея), но Тасман - ключевая фигура для открытия Австралии европейцами.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А', true),
        (q_id, 'Б', false);

        -- Q2.1 (World Map - Coordinates/Direction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'Найдите на карте мира точку 1 (19° ю.ш. 45° в.д.) и точку 2 (43° с.ш. 45° в.д.). В каком направлении от точки 1 находится точка 2?', E'Точка 1 (о. Мадагаскар) находится в Южном полушарии, точка 2 (Кавказ) - в Северном. Обе на одной долготе (45° в.д.). Значит, точка 2 находится строго к северу от точки 1.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'В северном', true),
        (q_id, 'В южном', false),
        (q_id, 'В западном', false),
        (q_id, 'В восточном', false);

        -- Q2.2 (World Map - Object Description)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'Какой географический объект описан? "Это четвёртый по величине остров мира... к востоку от Африки... уникален по составу растительного и животного мира... лемуры и хамелеоны."', E'Описание точно соответствует острову Мадагаскар. Он четвертый по величине (после Гренландии, Новой Гвинеи, Калимантана), у берегов Африки, и известен своими эндемиками - лемурами.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Мадагаскар', true),
        (q_id, 'Гренландия', false),
        (q_id, 'Новая Зеландия', false),
        (q_id, 'Шри-Ланка', false);

        -- Q3.1 (Topo Map - Direction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'По топографической карте (см. образец ВПР). В каком направлении от церкви находится родник?', E'Находим церковь (+), находим родник (кружок с точкой). Мысленно ставим компас на церковь. Родник находится левее (западнее). Точнее - в западном направлении.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На севере', false),
        (q_id, 'На западе', true),
        (q_id, 'На востоке', false),
        (q_id, 'На юге', false);

        -- Q3.2 (Topo Map - Distance)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'По топографической карте (масштаб 1:10000, в 1 см 100 м). Определите расстояние на местности по прямой от точки А до точки В. (Используйте линейку, измерьте по образцу ~2.5 см).', E'Измеряем линейкой расстояние от центра точки А до центра точки В на карте образца. Получается примерно 2.5 см. Масштаб: в 1 см - 100 м. Значит, 2.5 см * 100 м/см = 250 м. (Допускается погрешность).', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '250', true); -- Free response, allow range like 240-260

        -- Q4.3 (Causes of Time Difference)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'Чем обусловлена разница во времени в разных частях Земли?', E'Земля вращается вокруг своей оси (как волчок!). Из-за этого Солнце освещает разные части планеты в разное время - где-то день, где-то ночь. Это и есть причина разницы во времени.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Климатическими условиями', false),
        (q_id, 'Движением Земли вокруг Солнца', false),
        (q_id, 'Осевым вращением Земли', true),
        (q_id, 'Сменой времён года', false);

        -- Q6.1 (Weather - Wind Rose)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'По розе ветров (см. образец ВПР). Какой ветер чаще всего дул в январе?', E'Ищем самый длинный луч на розе ветров. Он соответствует направлению Ю-В (юго-восток). Значит, юго-восточный ветер был самым частым.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Западный', false),
        (q_id, 'Юго-восточный', true),
        (q_id, 'Северо-западный', false),
        (q_id, 'Южный', false);

        -- Q9.1 (Population Table - Rank)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 1, E'Используя таблицу (см. образец ВПР), расположите страны в порядке УМЕНЬШЕНИЯ численности населения: 1-Австралия(25), 2-Греция(11), 3-Египет(95), 4-Франция(65).', E'Смотрим столбец "Численность населения, млн человек". Самая большая у Египта (95 млн) - №3. Потом Франция (65 млн) - №4. Потом Австралия (25 млн) - №1. Самая маленькая у Греции (11 млн) - №2. Порядок убывания: 3, 4, 1, 2.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1234', false),
        (q_id, '3412', true),
        (q_id, '2143', false),
        (q_id, '4312', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 1.';
    END IF;
END $$;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 2 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 2... Ready to explore!';

        -- Q1.1 (World Map - Oceans) - Assuming A is Australia from V1
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'На карте мира (см. образец ВПР) буквой А обозначена Австралия. Какие ДВА океана омывают этот материк с запада и востока?', E'Смотрим на карту. Западнее Австралии находится Индийский океан. Восточнее - Тихий океан. Атлантический далеко, Северный Ледовитый - на севере.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Атлантический и Тихий', false),
        (q_id, 'Индийский и Тихий', true),
        (q_id, 'Северный Ледовитый и Индийский', false),
        (q_id, 'Тихий и Атлантический', false);

        -- Q2.1 (World Map - Direction Complex)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'Найдите на карте мира точку А (Австралия, ~25° ю.ш. 135° в.д.) и точку Б (Сев. Америка, ~50° с.ш. 100° з.д.). В каком направлении от точки Б находится точка А?', E'Точка А (Австралия) находится в Южном полушарии и Восточном. Точка Б (Сев. Америка) - в Северном и Западном. Чтобы попасть из Сев. Америки в Австралию, нужно двигаться на юго-запад (пересекая Тихий океан).', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На северо-востоке', false),
        (q_id, 'На юго-востоке', false),
        (q_id, 'На северо-западе', false),
        (q_id, 'На юго-западе', true);

        -- Q3.1 (Topo Map - River Banks)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'По топографической карте (см. образец ВПР). На каком берегу реки Михалёвки находится церковь?', E'Смотрим на реку Михалёвку, стрелка показывает направление течения (сверху вниз). Встаем лицом ПО течению реки. Церковь (+) будет справа. Значит, она на правом берегу.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На правом', true),
        (q_id, 'На левом', false);

        -- Q3.3 (Topo Map - Feature Identification)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'По топографической карте (см. образец ВПР). Какой из объектов (А-футбольное поле, Б-санный спуск, В-пляж) можно построить на участке маршрута А-В? Какая особенность участка это определяет?', E'Маршрут А-В идет по склону (горизонтали пересекают). Для санного спуска нужен уклон. Футбольное поле требует ровной поверхности. Пляж - близости к воде (река далеко). Значит, подходит санный спуск (Б) из-за достаточного уклона (3).', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А, ровная поверхность', false),
        (q_id, 'Б, достаточный уклон', true),
        (q_id, 'В, близость к реке', false),
        (q_id, 'Б, ровная поверхность', false);

        -- Q4.1 (Time Zones Calculation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'Разница во времени между Санкт-Петербургом и Якутском +6 часов. Когда в Санкт-Петербурге 5 часов вечера (17:00), сколько времени в Якутске?', E'В Якутске на 6 часов БОЛЬШЕ. Значит, к 17:00 прибавляем 6 часов. 17 + 6 = 23. В Якутске будет 23:00 (11 часов вечера).', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '11:00', false),
        (q_id, '23:00', true),
        (q_id, '17:00', false),
        (q_id, '05:00', false);

        -- Q5.1 (Natural Zones Match)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'Установите соответствие: А-саванны, Б-тайга. 1)Снег зимой; 2)Травы; 3)Равнины Африки; 4)Хвойные деревья; 5)Умеренный пояс Сев. полушария; 6)Зебры, жирафы.', E'А (Саванны): Травы (2), равнины Африки (3), зебры/жирафы (6). Подходит: 236. Б (Тайга): Снег зимой (1), хвойные деревья (4), умеренный пояс Сев. полушария (5). Подходит: 145.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А-145, Б-236', false),
        (q_id, 'А-236, Б-145', true),
        (q_id, 'А-123, Б-456', false),
        (q_id, 'А-456, Б-123', false);

        -- Q7 (Lithosphere/Biosphere Interaction) - Based on VPR example text
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'Прочитайте текст про литосферные плиты. В каких предложениях говорится о ВЗАИМОДЕЙСТВИИ литосферы и биосферы?', E'В тексте про литосферные плиты нет прямого упоминания биосферы (живых организмов). Все предложения описывают процессы в литосфере или её взаимодействие с гидросферой/атмосферой (рельеф). Значит, таких предложений в данном тексте нет.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1, 2', false),
        (q_id, '3, 4', false),
        (q_id, '5, 6', false),
        (q_id, 'Таких предложений нет', true); -- Based on typical lithosphere text

        -- Q8 (Dangerous Phenomena)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'На фотографии (см. образец ВПР) изображен смерч (торнадо). В какой географической оболочке зарождается это явление?', E'Смерч (торнадо) - это мощный атмосферный вихрь, образующийся в грозовом облаке и спускающийся к земле. Он зарождается в АТМОСФЕРЕ.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Литосфере', false),
        (q_id, 'Гидросфере', false),
        (q_id, 'Биосфере', false),
        (q_id, 'Атмосфере', true);

        -- Q9.2 (Population Table - Analysis)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 2, E'Используя таблицу (см. образец ВПР). В какой стране БОЛЕЕ ПОЛОВИНЫ населения проживает в СЕЛЬСКОЙ местности?', E'Смотрим столбец "сельское население, %". Больше половины - это больше 50%. У Египта 57%. У остальных меньше (12, 20, 20). Ответ: Египет.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия', false),
        (q_id, 'Греция', false),
        (q_id, 'Египет', true),
        (q_id, 'Франция', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 2.';
    END IF;
END $$;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 3 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 3... Map masters incoming!';

        -- Q1.1 (World Map - Identify Continent by Position)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'Какой материк расположен ПОЛНОСТЬЮ в Южном и Восточном полушариях?', E'Восточное полушарие - к востоку от Гринвича (0° д.). Южное - к югу от экватора (0° ш.). Полностью в этих двух полушариях находится только Австралия. Африка и Евразия частично в Северном, Америка - в Западном.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Африка', false),
        (q_id, 'Южная Америка', false),
        (q_id, 'Австралия', true),
        (q_id, 'Евразия', false);

        -- Q2.1 (World Map - Coordinates Find Object)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'Найдите на карте мира точку с координатами 60° с.ш. 30° в.д. Какой крупный город России находится вблизи этой точки?', E'60 градусов северной широты и 30 градусов восточной долготы - это координаты Санкт-Петербурга, крупного города на северо-западе России.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Москва', false),
        (q_id, 'Новосибирск', false),
        (q_id, 'Санкт-Петербург', true),
        (q_id, 'Якутск', false);

        -- Q3.1 (Topo Map - Relative Height)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'По топографической карте (см. образец ВПР). Определите, какой склон холма, на котором стоит точка А, более крутой - северный или южный?', E'Смотрим на горизонтали вокруг точки А. К северу от точки А горизонтали расположены ближе друг к другу, чем к югу. Чем ближе горизонтали, тем круче склон. Значит, северный склон круче.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Северный', true),
        (q_id, 'Южный', false),
        (q_id, 'Они одинаковые', false),
        (q_id, 'Невозможно определить', false);

        -- Q3.2 (Topo Map - Profile Sketch - conceptual)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'Представьте, что вы строите профиль рельефа по линии С-А на топокарте образца. Как будет выглядеть профиль?', E'Точка С на высоте ~108 м (немного выше горизонтали 107.5). Дальше идет спуск к реке (самая низкая точка). Потом подъем на холм к точке А (выше горизонтали 110). То есть: высокий старт -> спуск -> низшая точка -> подъем -> высшая точка А.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Плавный подъем от С к А', false),
        (q_id, 'Спуск от С к реке, затем подъем к А', true),
        (q_id, 'Ровная линия', false),
        (q_id, 'Подъем от С к реке, затем спуск к А', false);

        -- Q4.2 (Schedule Interpretation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'Используя режим дня школьника (см. образец ВПР). В какое время Настя обедает?', E'Находим в таблице строчку "Обед". Время, указанное напротив - 13:45 - 14:15.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '7:30 - 8:00', false),
        (q_id, '13:45 - 14:15', true),
        (q_id, '16:30 - 16:45', false),
        (q_id, '19:30 - 20:00', false);

        -- Q5.2 (Natural Zone Photo ID)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'На какой из фотографий (см. образец ВПР) изображена природная зона ТАЙГА?', E'Тайга - это хвойный лес. Ищем фото с хвойными деревьями (ели, сосны). Фото с медведем и хвойным лесом подходит. Фото с жирафом - саванна, фото с белкой и лиственными деревьями - смешанный/широколиственный лес.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Фото с жирафом', false),
        (q_id, 'Фото с медведем в хвойном лесу', true),
        (q_id, 'Фото с белкой на дереве', false); -- Assuming the 3 photos from sample

        -- Q6.2 (Weather Symbols Interpretation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'Какой буквой (А, Б, В - см. образец ВПР) обозначен рисунок погоды с температурой НИЖЕ -10°C?', E'Смотрим на температуру рядом с каждым рисунком. А: -16°C. Б: -10°C. В: +2°C. Ниже -10°C только на рисунке А (-16°C).', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А', true),
        (q_id, 'Б', false),
        (q_id, 'В', false);

        -- Q7 (Human Impact) - Based on VPR example text
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'Прочитайте текст про влияние человека. В каких предложениях говорится о НЕГАТИВНОМ влиянии на БИОСФЕРУ (живые организмы)?', E'Ищем предложения, где действия человека вредят живой природе. Предложение 2 (нарушение флоры/фауны), 3 (загрязнение океана), 5 (выбросы в атмосферу вредят), 6 (вырубка лесов, охота). Подходят: 2, 3, 6 (5 - атмосфера, но влияет на биосферу косвенно, 2,3,6 - прямее). В образце ВПР ответ: 236.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1, 4', false),
        (q_id, '2, 3, 6', true),
        (q_id, '4, 5', false),
        (q_id, '1, 5, 6', false);

        -- Q9.3 (Table/Photo/Object ID)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 3, E'В какой стране из таблицы (Австралия, Греция, Египет, Франция) сделана фотография (см. обр. ВПР - знак "Кенгуру")? Какой уникальный объект, созданный живыми организмами, расположен у её восточного побережья?', E'Знак с кенгуру - символ Австралии. У восточного побережья Австралии находится Большой Барьерный риф - крупнейшее в мире скопление кораллов (живые организмы).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия, Большой Барьерный риф', true),
        (q_id, 'Египет, Драконовы горы', false),
        (q_id, 'Франция, Марианская впадина', false),
        (q_id, 'Австралия, остров Пасхи', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 3.';
    END IF;
END $$;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 4 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 4... Charting the course!';

        -- Q1.1 (World Map - Identify Ocean)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'Какой океан расположен между Евразией, Африкой, Северной и Южной Америкой?', E'Между этими четырьмя материками находится Атлантический океан. Тихий - восточнее Евразии/Австралии и западнее Америк. Индийский - южнее Азии, между Африкой и Австралией.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Тихий', false),
        (q_id, 'Индийский', false),
        (q_id, 'Атлантический', true),
        (q_id, 'Северный Ледовитый', false);

        -- Q1.2 (World Map - Explorer/Continent Match)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'Открытия какого путешественника, изображённого на портрете (предположим, Христофор Колумб), связаны с материком Б (Северная Америка)?', E'Христофор Колумб в поисках пути в Индию достиг островов Карибского моря, положив начало открытию Америки (материки Северная и Южная - условно Б). Хотя он думал, что приплыл в Азию, его плавания связали Старый и Новый свет.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Абеля Тасмана', false),
        (q_id, 'Н.Н. Миклухо-Маклая', false),
        (q_id, 'Христофора Колумба', true),
        (q_id, 'Фернана Магеллана', false);

        -- Q2.2 (Object Description - River)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'Определите реку по описанию: "Самая длинная река в мире, протекает в Южной Америке, имеет самый большой бассейн и полноводность."', E'Самая длинная (спорно с Нилом, но часто считают её) и самая полноводная река мира - Амазонка. Протекает в Южной Америке, впадает в Атлантический океан.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Нил', false),
        (q_id, 'Миссисипи', false),
        (q_id, 'Амазонка', true),
        (q_id, 'Волга', false);

        -- Q3.3 (Topo Map - Feature Choice Reason)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'Какая особенность участка маршрута А-В (см. топокарту образца) определила выбор места для санного спуска (если был выбран этот объект)?', E'Для санного спуска нужен наклонный рельеф. На карте маршрут А-В пересекает горизонтали, что указывает на наличие склона (уклона). Ровная поверхность не подходит, близость к реке или удаленность не являются главными для спуска.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Близость к реке', false),
        (q_id, 'Ровная поверхность', false),
        (q_id, 'Достаточный уклон', true),
        (q_id, 'Отдалённость от населённого пункта', false);

        -- Q4.1 (Time Zones - Reverse Calculation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'Разница во времени между Санкт-Петербургом и Якутском +6 часов. Когда в Якутске 11 часов вечера (23:00), сколько времени в Санкт-Петербурге?', E'В Санкт-Петербурге на 6 часов МЕНЬШЕ, чем в Якутске. Значит, из 23:00 вычитаем 6 часов. 23 - 6 = 17. В Санкт-Петербурге будет 17:00 (5 часов вечера).', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '17:00', true),
        (q_id, '05:00', false),
        (q_id, '23:00', false),
        (q_id, '11:00', false);

        -- Q5.2 (Natural Zone Photo ID - Savanna)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'На какой из фотографий (см. образец ВПР) изображена природная зона САВАННА?', E'Саванна - это травянистые равнины с редкими деревьями и кустарниками, характерные для жаркого климата с сухим и влажным сезонами. Типичные животные - зебры, жирафы, антилопы. Фото с жирафом подходит.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Фото с жирафом', true),
        (q_id, 'Фото с медведем в хвойном лесу', false),
        (q_id, 'Фото с белкой на дереве', false);

        -- Q6.3 (Weather Diary Interpretation)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'Андрей записал: "Ясно, к вечеру роса. Слабый ЮЗ ветер. Днём +22°C, влажность 50%". Выберите соответствующие условные знаки погоды из таблицы (см. образец ВПР).', E'Ясно - пустое колечко. Роса - точка внизу (осадки). Слабый ЮЗ ветер - стрелка ИЗ ЮЗ угла, короткая (1-2 черточки на конце). Температура и влажность знаками не показываются.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Облачно, дождь, СВ ветер', false),
        (q_id, 'Ясно, роса, слабый ЮЗ ветер', true),
        (q_id, 'Пасмурно, без осадков, сильный З ветер', false),
        (q_id, 'Ясно, без осадков, Ю ветер', false);

        -- Q7 (Geographic Shells Interaction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'В каком предложении из текста про литосферные плиты (см. обр. ВПР) описывается результат взаимодействия ЛИТОСФЕРЫ и ГИДРОСФЕРЫ?', E'Гидросфера - водная оболочка (океаны). Предложение 6 говорит о формировании срединно-океанических хребтов на дне океанов при расхождении плит. Это взаимодействие литосферы (плиты) и гидросферы (океан).', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Предложение 1', false),
        (q_id, 'Предложение 3', false),
        (q_id, 'Предложение 5', false),
        (q_id, 'Предложение 6', true);

        -- Q9.2 (Population Table - Comparison)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 4, E'Используя таблицу (см. образец ВПР). В каких ДВУХ странах доля ГОРОДСКОГО населения одинакова?', E'Смотрим столбец "городское население, %". У Греции - 80%. У Франции - 80%. У Австралии - 88%, у Египта - 43%. Одинаковая доля у Греции и Франции.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия и Греция', false),
        (q_id, 'Греция и Франция', true),
        (q_id, 'Египет и Франция', false),
        (q_id, 'Австралия и Египет', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 4.';
    END IF;
END $$;

-- =============================================
-- === INSERT GEOGRAPHY 6th Grade, VARIANT 5 ===
-- =============================================
DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 5... The final expedition!';

        -- Q1.2 (World Map - Explorer/Continent Match - Miklouho-Maclay)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'С каким материком или его крупными островами связаны исследования Н.Н. Миклухо-Маклая (портрет справа)?', E'Николай Николаевич Миклухо-Маклай - русский учёный, знаменитый своими исследованиями коренного населения Юго-Восточной Азии, Австралии (А) и Океании, особенно острова Новая Гвинея (рядом с Австралией).', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А (Австралия и Океания)', true),
        (q_id, 'Б (Северная Америка)', false),
        (q_id, 'Африка', false),
        (q_id, 'Южная Америка', false);

        -- Q2.1 (World Map - Coordinates Find Location Type)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'Найдите на карте мира точку с координатами 0° ш. 90° з.д. Где расположена эта точка?', E'0° широты - это экватор. 90° западной долготы проходит через Тихий океан, к западу от Южной Америки. Точка находится в Тихом океане.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'В Тихом океане', true),
        (q_id, 'В Южной Америке', false),
        (q_id, 'В Атлантическом океане', false),
        (q_id, 'В Африке', false);

        -- Q3.1 (Topo Map - Feature Location)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'По топографической карте (см. образец ВПР). Какой объект находится в квадрате В?', E'Квадрат B находится в центре карты. В нем расположен участок реки Михалёвка, луг (условный знак) и часть смешанного леса (условный знак). Из предложенных явно виден луг.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Родник', false),
        (q_id, 'Церковь', false),
        (q_id, 'Луг', true),
        (q_id, 'Башня', false);

        -- Q4.3 (Cause of Seasons)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'Чем обусловлена смена времён года на Земле?', E'Смена времён года происходит из-за движения Земли вокруг Солнца и НАКЛОНА земной оси. Из-за наклона разные полушария в разное время года получают больше солнечного тепла.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Только осевым вращением Земли', false),
        (q_id, 'Движением Земли вокруг Солнца и наклоном земной оси', true),
        (q_id, 'Изменением активности Солнца', false),
        (q_id, 'Движением Луны вокруг Земли', false);

        -- Q5.1 (Natural Zones Match - Tundra/Desert)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'Установите соответствие: А-Тундра, Б-Пустыня. 1)Очень жарко и сухо; 2)Мхи, лишайники, карликовые деревья; 3)Верблюды; 4)Северные олени; 5)Вечная мерзлота; 6)Песчаные дюны (барханы).', E'А (Тундра): Мхи/лишайники/карлики (2), северные олени (4), вечная мерзлота (5). Подходит: 245. Б (Пустыня): Жарко/сухо (1), верблюды (3), барханы (6). Подходит: 136.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А-136, Б-245', false),
        (q_id, 'А-245, Б-136', true),
        (q_id, 'А-123, Б-456', false),
        (q_id, 'А-456, Б-123', false);

        -- Q6.1 (Weather - Wind Rose - Direction)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'По розе ветров (см. образец ВПР). В каком направлении дует ветер, обозначенный самым длинным лучом?', E'Самый длинный луч идет ИЗ юго-востока (Ю-В) к центру. Ветер всегда называется по направлению, ОТКУДА он дует. Значит, ветер юго-восточный, а дует он на северо-запад.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На юго-восток', false),
        (q_id, 'На северо-запад', true),
        (q_id, 'На юг', false),
        (q_id, 'На север', false);

        -- Q6.3 (Weather Diary - Draw Symbols) - Conceptual Check
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'Как с помощью условных знаков погоды (см. образец ВПР) отобразить: "Пасмурно, сильный снег, ветер северный"?', E'Пасмурно - полностью закрашенный круг. Снег - снежинка (*). Ветер северный - стрелка ИЗ севера (С) к центру, длинная с несколькими черточками (сильный).', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Пустой круг, точка, стрелка из Ю', false),
        (q_id, 'Закрашенный круг, снежинка, стрелка из С', true),
        (q_id, 'Круг с чертой, без осадков, стрелка из В', false),
        (q_id, 'Половина круга закрашена, капля, штиль', false);

        -- Q8 (Phenomena/Shell Association)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'Какое явление относится к ЛИТОСФЕРЕ?', E'Литосфера - твердая оболочка Земли. Землетрясения и извержения вулканов - это процессы, происходящие в литосфере. Дождь - атмосфера/гидросфера, Ураган - атмосфера, Рост дерева - биосфера.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Дождь', false),
        (q_id, 'Ураган', false),
        (q_id, 'Извержение вулкана', true),
        (q_id, 'Рост дерева', false);

        -- Q9.3 (Table/Photo/Object ID - France/Eiffel) - Hypothetical if photo changed
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 5, E'Представьте, что на фото изображена Эйфелева башня. В какой стране из таблицы (Австралия, Греция, Египет, Франция) сделана эта фотография? Какой известный музей находится рядом?', E'Эйфелева башня - символ Парижа, столицы Франции. Рядом с ней находится Лувр - один из крупнейших и самых известных художественных музеев мира.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Греция, Акрополь', false),
        (q_id, 'Египет, Пирамиды', false),
        (q_id, 'Франция, Лувр', true),
        (q_id, 'Австралия, Сиднейская опера', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 5.';
    END IF;
END $$;
