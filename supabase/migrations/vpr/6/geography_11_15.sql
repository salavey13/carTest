INSERT INTO public.subjects (name, description, grade_level) VALUES
('География', E'## ВПР по Географии (6 класс) \n\nПроверочная работа охватывает **основные темы**, изученные в 6 классе по географии.\n\n**Что будет проверяться:**\n\n*   🗺️ Работа с **картой мира**: материки, океаны, координаты, направления.\n*   🧭 Работа с **топографической картой**: масштаб, условные знаки, рельеф, азимут.\n*   🌳 **Природные зоны**: их особенности, расположение, флора и фауна.\n*   ☀️ **Погода и климат**: условные обозначения, причины явлений.\n*   🌍 **Географическая оболочка**: её части и взаимодействие.\n*   📊 Работа с **таблицами и данными** о населении и странах.\n*   🚢 Знание **великих путешественников** и их открытий.', 6)
ON CONFLICT (name, grade_level) DO NOTHING;

DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'География' AND grade_level = 6) AND variant_number BETWEEN 11 AND 16);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'География' AND grade_level = 6) AND variant_number BETWEEN 11 AND 16;

DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 11... Eurasia calling!';

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'Какой материк является самым большим по площади и омывается всеми четырьмя океанами?', E'Евразия - самый большой материк. Он омывается Северным Ледовитым океаном на севере, Тихим - на востоке, Индийским - на юге и Атлантическим - на западе.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Африка', false),
        (q_id, 'Северная Америка', false),
        (q_id, 'Евразия', true),
        (q_id, 'Южная Америка', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'Какой венецианский купец (портрет предположительно Марко Поло) совершил знаменитое путешествие в Китай и другие страны Азии в XIII веке?', E'Марко Поло известен своим длительным путешествием по Азии, включая Китай, и книгой, описавшей его странствия, которая значительно расширила знания европейцев о Востоке.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Христофор Колумб', false),
        (q_id, 'Марко Поло', true),
        (q_id, 'Васко да Гама', false),
        (q_id, 'Фернан Магеллан', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'Найдите на карте мира точку с координатами 0° ш. 0° д. Где расположена эта точка?', E'Точка пересечения экватора (0° широты) и начального (Гринвичского) меридиана (0° долготы) находится в Атлантическом океане, в Гвинейском заливе, к югу от побережья Западной Африки.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'В Африке', false),
        (q_id, 'В Южной Америке', false),
        (q_id, 'В Тихом океане', false),
        (q_id, 'В Атлантическом океане (Гвинейский залив)', true);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'Определите горы по описанию: "Протянулись с севера на юг через западную часть России, служат условной границей между Европой и Азией."', E'Это описание характерно для Уральских гор, которые разделяют Восточно-Европейскую и Западно-Сибирскую равнины и считаются границей между европейской и азиатской частями Евразии.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Кавказские горы', false),
        (q_id, 'Альпы', false),
        (q_id, 'Уральские горы', true),
        (q_id, 'Гималаи', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'По топографической карте (см. образец ВПР). В каком направлении от точки А (на холме) находится точка B (на ровном месте)?', E'Находим точку А (на холме), находим точку B (восточнее). Мысленно ставим компас на точку А. Точка B находится правее (восточнее) и ниже (южнее). Общее направление - юго-восточное.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На северо-западе', false),
        (q_id, 'На юго-востоке', true),
        (q_id, 'На северо-востоке', false),
        (q_id, 'На юго-западе', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'По топографической карте (см. образец ВПР). Что расположено выше над уровнем моря - точка B или точка C?', E'Точка B находится между горизонталями 107.5 и 110 м. Точка C находится возле горизонтали 107.5 м, возможно, немного ниже. Значит, точка B расположена выше точки C.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Точка C', false),
        (q_id, 'Точка B', true),
        (q_id, 'Они на одной высоте', false),
        (q_id, 'Невозможно определить', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'Самолет вылетел из Москвы (UTC+3) в 10:00 и летел 4 часа до Новосибирска (UTC+7). Во сколько он приземлился по новосибирскому времени?', E'Время в Новосибирске опережает московское на 7 - 3 = 4 часа. Вылет по моск. времени: 10:00. Полёт: 4 часа. Прилет по моск. времени: 10:00 + 4 часа = 14:00. Прилет по новосибирскому времени: 14:00 + 4 часа (разница) = 18:00.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '14:00', false),
        (q_id, '16:00', false),
        (q_id, '18:00', true),
        (q_id, '20:00', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'Как с помощью условных знаков погоды (см. образец ВПР) отобразить: "Туман, штиль"?', E'Туман обозначается горизонтальной чертой (или двумя-тремя). Штиль (безветрие) - кружок без стрелки.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Закрашенный круг, стрелка из С', false),
        (q_id, 'Горизонтальная черта, кружок без стрелки', true),
        (q_id, 'Запятая (дождь), длинная стрелка', false),
        (q_id, 'Снежинка, короткая стрелка', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 11, E'Используя таблицу (предположим, в ней есть столбец "Площадь, тыс. кв. км": 1-Австралия(7692), 2-Греция(132), 3-Египет(1001), 4-Франция(547)). Расположите страны в порядке УБЫВАНИЯ площади.', E'Сравниваем площади: Австралия (7692) - самая большая (№1). Затем Египет (1001) - №3. Затем Франция (547) - №4. Самая маленькая Греция (132) - №2. Порядок убывания: 1, 3, 4, 2.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '2431', false),
        (q_id, '1342', true),
        (q_id, '4312', false),
        (q_id, '1234', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 11.';
    END IF;
END $$;

DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 12... Arctic and Andes!';

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'Какой океан является самым маленьким по площади и расположен вокруг Северного полюса?', E'Северный Ледовитый океан - самый маленький, расположен в основном за Полярным кругом, вокруг Северного полюса.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Атлантический', false),
        (q_id, 'Индийский', false),
        (q_id, 'Тихий', false),
        (q_id, 'Северный Ледовитый', true);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'Найдите на карте мира точку с координатами 30° ю.ш. 70° в.д. Где примерно расположена эта точка?', E'30 градусов южной широты и 70 градусов восточной долготы - это координаты, попадающие в открытую часть Индийского океана, к юго-западу от Австралии.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'В Австралии', false),
        (q_id, 'В Индийском океане', true),
        (q_id, 'В Антарктиде', false),
        (q_id, 'В Африке', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'Найдите на карте мира Москву (~56° с.ш. 38° в.д.) и Нью-Йорк (~41° с.ш. 74° з.д.). В каком направлении от Нью-Йорка находится Москва?', E'Москва находится севернее Нью-Йорка (56° с.ш. против 41° с.ш.) и в Восточном полушарии (Нью-Йорк - в Западном). Путь из Нью-Йорка в Москву лежит на северо-восток (через Атлантику и Европу).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На юго-западе', false),
        (q_id, 'На юго-востоке', false),
        (q_id, 'На северо-западе', false),
        (q_id, 'На северо-востоке', true);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'Определите озеро по описанию: "Самое высокогорное судоходное озеро в мире, расположено в Андах на границе Перу и Боливии."', E'Озеро Титикака в Южной Америке известно как самое высокогорное судоходное озеро.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Озеро Байкал', false),
        (q_id, 'Великие озёра', false),
        (q_id, 'Озеро Титикака', true),
        (q_id, 'Каспийское море', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'По топографической карте (см. образец ВПР). В каком направлении от точки B находится церковь?', E'Находим точку B (на ровном месте), находим церковь (+). Мысленно ставим компас на точку B. Церковь находится левее (западнее) и немного выше (севернее). Общее направление - северо-западное.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На юго-востоке', false),
        (q_id, 'На северо-востоке', false),
        (q_id, 'На северо-западе', true),
        (q_id, 'На юго-западе', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'С точки А (вершина холма) на топокарте открывается хороший обзор. Какой из объектов НЕ виден напрямую из-за рельефа?', E'С вершины холма (А) видна церковь (+), точка В, река внизу. Родник находится на западном склоне холма, но ниже и может быть скрыт перегибом склона от прямой видимости с самой вершины. Проверяем по профилю или логике: вид на западный склон с вершины часто ограничен.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Церковь', false),
        (q_id, 'Точка В', false),
        (q_id, 'Родник', true),
        (q_id, 'Река (ближайший участок)', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'Установите соответствие: А-Широколиственный лес, Б-Жестколистные леса и кустарники (Средиземноморский тип). 1)Дуб, клён, липа; 2)Жаркое сухое лето, тёплая влажная зима; 3)Оливковое дерево, лавр; 4)Умеренный климат с тёплым летом; 5)Олени, кабаны, белки; 6)Побережье Средиземного моря.', E'А (Широк. лес): Дуб/клён (1), умеренный климат (4), олени/кабаны (5). Подходит: 145. Б (Средизем.): Жаркое/сухое лето (2), олива/лавр (3), побережье Средизем. моря (6). Подходит: 236.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А-236, Б-145', false),
        (q_id, 'А-145, Б-236', true),
        (q_id, 'А-123, Б-456', false),
        (q_id, 'А-456, Б-123', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'Землетрясение - это подземные толчки и колебания земной поверхности. В какой географической оболочке возникают землетрясения?', E'Землетрясения возникают в результате движений в земной коре, которая является частью твердой оболочки Земли - ЛИТОСФЕРЫ.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Атмосфере', false),
        (q_id, 'Гидросфере', false),
        (q_id, 'Литосфере', true),
        (q_id, 'Биосфере', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 12, E'Используя данные о населении и площади стран (см. вопр. 11.9), определите, в какой из этих стран (Австралия, Греция, Египет, Франция) самая ВЫСОКАЯ плотность населения (чел/кв.км)?', E'Плотность = Население / Площадь. Греция: 11млн/132тыс = ~83 чел/км2. Франция: 65млн/547тыс = ~119 чел/км2. Египет: 95млн/1001тыс = ~95 чел/км2. Австралия: 25млн/7692тыс = ~3 чел/км2. Самая высокая плотность у Франции.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия', false),
        (q_id, 'Греция', false),
        (q_id, 'Египет', false),
        (q_id, 'Франция', true);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 12.';
    END IF;
END $$;

DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 13... Poles apart!';

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'Какой материк ПОЛНОСТЬЮ расположен в Западном полушарии?', E'Северная и Южная Америка полностью лежат к западу от Гринвичского меридиана (0° д.), то есть в Западном полушарии. Евразия и Африка пересекаются нулевым меридианом. Австралия - в Восточном.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Евразия', false),
        (q_id, 'Африка', false),
        (q_id, 'Австралия', false),
        (q_id, 'Южная Америка', true);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'Какой норвежский полярный исследователь (портрет предположительно Амундсена) первым достиг Южного полюса?', E'Руаль Амундсен возглавил норвежскую экспедицию, которая первой достигла Южного полюса в декабре 1911 года, опередив британскую экспедицию Роберта Скотта.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Роберт Пири', false),
        (q_id, 'Руаль Амундсен', true),
        (q_id, 'Роберт Скотт', false),
        (q_id, 'Фритьоф Нансен', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'Найдите на карте мира восточную оконечность Южной Америки (~5° ю.ш. 35° з.д.) и западную оконечность Африки (~15° с.ш. 17° з.д.). В каком направлении от Южной Америки находится Африка?', E'Западная Африка находится севернее (15° с.ш. против 5° ю.ш.) и восточнее (17° з.д. против 35° з.д.) восточной точки Южной Америки. Чтобы попасть из Юж. Америки в Африку (через Атлантику), нужно двигаться на северо-восток.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На юго-западе', false),
        (q_id, 'На северо-востоке', true),
        (q_id, 'На юго-востоке', false),
        (q_id, 'На северо-западе', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'Определите горы по описанию: "Протянулись вдоль всего восточного побережья Австралии, являются главным водоразделом материка."', E'Это описание характерно для Большого Водораздельного хребта в Австралии.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Анды', false),
        (q_id, 'Аппалачи', false),
        (q_id, 'Большой Водораздельный хребет', true),
        (q_id, 'Драконовы горы', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'По топографической карте (см. образец ВПР). В каком направлении от реки Михалёвки (в районе квадрата В) находится точка С?', E'Находим реку в квадрате В, находим точку С (юго-западнее). Мысленно ставим компас на реку. Точка C находится к западу/юго-западу от реки.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На северо-востоке', false),
        (q_id, 'На востоке', false),
        (q_id, 'На юго-западе', true),
        (q_id, 'На севере', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'По топографической карте (см. образец ВПР). Какой склон холма, на котором стоит точка А, более пологий - восточный или западный?', E'Смотрим на горизонтали вокруг точки А. К востоку от точки А (в сторону точки В) горизонтали расположены дальше друг от друга, чем к западу (в сторону родника). Чем дальше горизонтали, тем склон положе. Значит, восточный склон положе западного.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Западный', false),
        (q_id, 'Восточный', true),
        (q_id, 'Они одинаковые', false),
        (q_id, 'Невозможно определить', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'Почему в Южном полушарии (например, в Австралии) лето наступает в декабре-феврале?', E'Из-за наклона земной оси во время движения Земли вокруг Солнца, в декабре-феврале Южное полушарие наклонено к Солнцу и получает больше прямых солнечных лучей и тепла, что вызывает наступление лета.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Из-за вращения Земли вокруг оси', false),
        (q_id, 'Потому что Земля ближе всего к Солнцу в это время', false),
        (q_id, 'Из-за наклона земной оси Южное полушарие обращено к Солнцу', true),
        (q_id, 'Из-за влияния Луны', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'По розе ветров (см. образец ВПР). Ветры каких двух направлений суммарно дули чаще всего в январе?', E'Смотрим на длину лучей. Самый длинный - Ю-В. Следующий по длине - З (западный). Суммарно ветры юго-восточного и западного направлений преобладали.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Северный и Северо-Восточный', false),
        (q_id, 'Юго-Восточный и Западный', true),
        (q_id, 'Южный и Юго-Западный', false),
        (q_id, 'Восточный и Северо-Восточный', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 13, E'Какой из примеров иллюстрирует негативное влияние человека на ГИДРОСФЕРУ?', E'Гидросфера - водная оболочка. Сброс неочищенных стоков в реки и моря напрямую загрязняет гидросферу. Вырубка лесов влияет на гидрологический режим, но не так прямо. Выбросы в атмосферу загрязняют воздух. Создание заповедников - позитивное влияние.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Выбросы заводов в атмосферу', false),
        (q_id, 'Вырубка лесов', false),
        (q_id, 'Сброс сточных вод в реку', true),
        (q_id, 'Создание национального парка', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 13.';
    END IF;
END $$;

DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 14... Crossing Mississippi!';

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'Какой океан (иногда выделяемый как пятый) окружает Антарктиду?', E'Воды Тихого, Атлантического и Индийского океанов, примыкающие к Антарктиде, иногда объединяют в Южный океан.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Тихий', false),
        (q_id, 'Атлантический', false),
        (q_id, 'Индийский', false),
        (q_id, 'Южный', true);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'Найдите на карте мира объект, расположенный примерно по координатам 20° ю.ш. 47° в.д.', E'Эти координаты соответствуют центральной части острова Мадагаскар, расположенного к востоку от Африки в Индийском океане.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Остров Шри-Ланка', false),
        (q_id, 'Остров Мадагаскар', true),
        (q_id, 'Полуостров Индостан', false),
        (q_id, 'Новая Зеландия', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'Найдите на карте мира Токио (~36° с.ш. 140° в.д.) и Лондон (~51° с.ш. 0° д.). В каком направлении от Токио находится Лондон?', E'Лондон находится севернее Токио (51° с.ш. против 36° с.ш.) и значительно западнее (0° д. против 140° в.д.). Путь из Токио в Лондон лежит на северо-запад (через Евразию или Арктику).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На юго-востоке', false),
        (q_id, 'На юго-западе', false),
        (q_id, 'На северо-востоке', false),
        (q_id, 'На северо-западе', true);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'Определите реку по описанию: "Одна из величайших рек мира, главная река крупнейшей речной системы в Северной Америке, впадает в Мексиканский залив."', E'Это описание соответствует реке Миссисипи в США.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Амазонка', false),
        (q_id, 'Нил', false),
        (q_id, 'Миссисипи', true),
        (q_id, 'Янцзы', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'По топографической карте (см. образец ВПР). В каком направлении от точки C находится точка А (на холме)?', E'Находим точку С (у леса), находим точку А (на холме). Мысленно ставим компас на точку С. Точка А находится выше (севернее) и правее (восточнее). Общее направление - северо-восточное.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На юго-западе', false),
        (q_id, 'На северо-востоке', true),
        (q_id, 'На юго-востоке', false),
        (q_id, 'На северо-западе', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'По топографической карте (см. образец ВПР). На каком берегу реки Михалёвки расположен смешанный лес (в районе квадрата А)?', E'Смотрим на реку Михалёвку, стрелка показывает направление течения (сверху вниз). Встаем лицом ПО течению реки. Лес в квадрате А находится слева. Значит, он на левом берегу.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На правом', false),
        (q_id, 'На левом', true),
        (q_id, 'На обоих берегах', false),
        (q_id, 'Вдали от реки', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'На какой из фотографий (предположим, есть фото пустыни, тайги, тундры) изображена ТУНДРА?', E'Тундра - безлесная зона с низкорослой растительностью (мхи, лишайники, карликовые деревья, кустарнички) и вечной мерзлотой. Ищем фото с таким пейзажем, возможно, с северными оленями.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Фото с песчаными дюнами', false),
        (q_id, 'Фото с высокими хвойными деревьями', false),
        (q_id, 'Фото с мхами, лишайниками и карликовыми березами', true);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'Извержение вулкана - это процесс в литосфере. С какой другой оболочкой происходит активное взаимодействие во время извержения (выброс газов, пепла)?', E'При извержении вулкана в атмосферу выбрасывается большое количество газов, пепла и пара. Это яркий пример взаимодействия ЛИТОСФЕРЫ и АТМОСФЕРЫ.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Гидросферой', false),
        (q_id, 'Биосферой', false),
        (q_id, 'Атмосферой', true),
        (q_id, 'Внутренним ядром Земли', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 14, E'Используя таблицу (см. образец ВПР). На сколько миллионов человек население Египта (95 млн) больше населения Франции (65 млн)?', E'Нужно найти разницу: 95 млн - 65 млн = 30 млн человек.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На 20 млн', false),
        (q_id, 'На 30 млн', true),
        (q_id, 'На 40 млн', false),
        (q_id, 'На 160 млн', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 14.';
    END IF;
END $$;

DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 15... Alps and explorers!';

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'Какой материк пересекается и экватором (0° ш.), и начальным (Гринвичским) меридианом (0° д.)?', E'Африка - единственный материк, который пересекается и экватором, и нулевым меридианом.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Южная Америка', false),
        (q_id, 'Австралия', false),
        (q_id, 'Африка', true),
        (q_id, 'Евразия', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'Какой мореплаватель (портрет предположительно Колумба) в 1492 году достиг островов Карибского моря, ошибочно полагая, что открыл путь в Индию?', E'Христофор Колумб, ища западный путь в Индию, приплыл к островам Вест-Индии (Карибского бассейна), положив начало эпохе Великих географических открытий и европейской колонизации Америки.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Васко да Гама', false),
        (q_id, 'Фернан Магеллан', false),
        (q_id, 'Христофор Колумб', true),
        (q_id, 'Джеймс Кук', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'Найдите на карте мира точку с координатами 30° с.ш. 160° з.д. Где примерно расположена эта точка?', E'30 градусов северной широты и 160 градусов западной долготы - это координаты, попадающие в северную часть Тихого океана, к северо-востоку от Гавайских островов.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'В Тихом океане', true),
        (q_id, 'В Северной Америке', false),
        (q_id, 'В Азии', false),
        (q_id, 'В Атлантическом океане', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'Определите горы по описанию: "Высокая горная система в Европе, расположенная к северу от Апеннинского полуострова, популярный район туризма и альпинизма."', E'Это описание характерно для Альп - самой высокой горной системы Западной Европы.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Карпаты', false),
        (q_id, 'Пиренеи', false),
        (q_id, 'Альпы', true),
        (q_id, 'Скандинавские горы', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'По топографической карте (см. образец ВПР). В каком направлении от точки B находится родник?', E'Находим точку B, находим родник (кружок с точкой). Мысленно ставим компас на точку B. Родник находится левее (западнее). Общее направление - западное.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На востоке', false),
        (q_id, 'На севере', false),
        (q_id, 'На западе', true),
        (q_id, 'На юге', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'По топографической карте (см. образец ВПР). Что расположено ниже над уровнем моря - точка С или церковь?', E'Точка С находится около горизонтали 107.5 м (может быть чуть ниже). Церковь (+) находится выше горизонтали 107.5 м. Следовательно, точка С расположена ниже церкви.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Церковь', false),
        (q_id, 'Точка С', true),
        (q_id, 'Они на одной высоте', false),
        (q_id, 'Невозможно определить', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'Самолет прилетел в Москву (UTC+3) в 18:00. Полёт из Новосибирска (UTC+7) длился 4 часа. Во сколько самолет вылетел из Новосибирска по местному (новосибирскому) времени?', E'Прилет по моск. времени: 18:00. Полёт: 4 часа. Вылет по моск. времени: 18:00 - 4 часа = 14:00. Время в Новосибирске опережает московское на 7 - 3 = 4 часа. Вылет по новосибирскому времени: 14:00 + 4 часа (разница) = 18:00.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '14:00', false),
        (q_id, '10:00', false),
        (q_id, '18:00', true),
        (q_id, '22:00', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'Как с помощью условных знаков погоды (см. образец ВПР) отобразить: "Сильный снег, ветер северный, очень сильный"?', E'Снег - снежинка (*). Сильный снег может обозначаться двумя или тремя снежинками. Ветер северный - стрелка ИЗ севера (С). Очень сильный ветер - длинная стрелка с несколькими (3-4) черточками на конце.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Запятая (дождь), стрелка из Ю, короткая', false),
        (q_id, 'Снежинка(и), стрелка из С, длинная с >2 черточками', true),
        (q_id, 'Закрашенный круг, штиль', false),
        (q_id, 'Пустой круг, стрелка из В, короткая', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 15, E'Используя таблицу (см. образец ВПР). В какой стране доля городского населения БЛИЖЕ ВСЕГО к 50%?', E'Смотрим столбец "городское население, %": Австралия(88%), Греция(80%), Египет(43%), Франция(80%). Ближе всего к 50% значение Египта (43%).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия', false),
        (q_id, 'Греция', false),
        (q_id, 'Египет', true),
        (q_id, 'Франция', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 15.';
    END IF;
END $$;

DO $$
DECLARE
    subj_geo_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_geo_id FROM public.subjects WHERE name = 'География' AND grade_level = 6;

    IF subj_geo_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Geography Variant 16... Great Lakes and Antarctica discovery!';

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'Какой материк является самым маленьким по площади?', E'Австралия - самый маленький по площади материк Земли.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Южная Америка', false),
        (q_id, 'Австралия', true),
        (q_id, 'Антарктида', false),
        (q_id, 'Африка', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'Какая русская экспедиция (портреты предположительно Беллинсгаузена и Лазарева) в 1820 году открыла Антарктиду?', E'Русская антарктическая экспедиция под руководством Фаддея Беллинсгаузена и Михаила Лазарева на шлюпах "Восток" и "Мирный" первой подошла к шельфовым ледникам Антарктиды, совершив её открытие.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Экспедиция Джеймса Кука', false),
        (q_id, 'Экспедиция Руаля Амундсена', false),
        (q_id, 'Экспедиция Беллинсгаузена и Лазарева', true),
        (q_id, 'Экспедиция Роберта Скотта', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'Найдите на карте мира Кейптаун (~34° ю.ш. 18° в.д.) и Перт (~32° ю.ш. 116° в.д.). В каком направлении от Кейптауна находится Перт?', E'Перт находится примерно на той же широте, что и Кейптаун, но значительно восточнее (116° в.д. против 18° в.д.). Путь из Кейптауна в Перт лежит на восток (через Индийский океан).', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На запад', false),
        (q_id, 'На север', false),
        (q_id, 'На восток', true),
        (q_id, 'На юг', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'Определите озеро по описанию: "Самое большое по площади пресноводное озеро в мире, входит в систему Великих озёр Северной Америки."', E'Озеро Верхнее (Lake Superior) - самое крупное и самое глубокое из системы Великих озёр, а также самое большое по площади пресное озеро мира.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Озеро Байкал', false),
        (q_id, 'Озеро Виктория', false),
        (q_id, 'Озеро Верхнее', true),
        (q_id, 'Каспийское море', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'По топографической карте (см. образец ВПР). В каком направлении от церкви находится точка B?', E'Находим церковь (+), находим точку B. Мысленно ставим компас на церковь. Точка B находится правее (восточнее) и немного ниже (южнее). Общее направление - юго-восточное.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'На северо-западе', false),
        (q_id, 'На юго-востоке', true),
        (q_id, 'На северо-востоке', false),
        (q_id, 'На юго-западе', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'Представьте, что вы строите профиль рельефа по линии от точки С на восток, пересекая реку. Как будет выглядеть профиль?', E'Точка С находится на склоне (~107.5 м). Двигаясь на восток, мы спускаемся к реке (самая низкая точка), пересекаем ее, а затем поднимаемся на противоположный, более пологий склон (пересекая горизонталь 107.5 м). Профиль: старт на склоне -> спуск -> река -> подъем.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Непрерывный подъем', false),
        (q_id, 'Спуск к реке, затем подъем', true),
        (q_id, 'Ровная линия с небольшим углублением для реки', false),
        (q_id, 'Подъем к реке, затем спуск', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'Установите соответствие: А-Пустыня (жаркая), Б-Влажный экваториальный лес. 1)Очень жарко и сухо, редкая растительность; 2)Жарко и очень влажно круглый год; 3)Многоярусный лес, лианы, орхидеи; 4)Песчаные дюны, верблюды; 5)Обезьяны, попугаи, змеи; 6)Сахара, Аравия.', E'А (Пустыня): Жарко/сухо (1), дюны/верблюды (4), Сахара/Аравия (6). Подходит: 146. Б (Экв. лес): Жарко/влажно (2), многоярусный лес/лианы (3), обезьяны/попугаи (5). Подходит: 235.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А-235, Б-146', false),
        (q_id, 'А-146, Б-235', true),
        (q_id, 'А-123, Б-456', false),
        (q_id, 'А-456, Б-123', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'Ураган (тропический циклон) - это мощный атмосферный вихрь с сильными ветрами и ливнями. В какой географической оболочке зарождается и развивается ураган?', E'Ураганы формируются над теплыми водами океанов и представляют собой явления в АТМОСФЕРЕ.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Литосфере', false),
        (q_id, 'Гидросфере', false),
        (q_id, 'Атмосфере', true),
        (q_id, 'Биосфере', false);

        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_geo_id, 16, E'Используя таблицу (см. образец ВПР). В каких ДВУХ странах доля СЕЛЬСКОГО населения одинакова?', E'Смотрим столбец "сельское население, %". У Австралии(12%), у Греции(20%), у Египта(57%), у Франции(20%). Одинаковая доля (20%) у Греции и Франции.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Австралия и Египет', false),
        (q_id, 'Греция и Франция', true),
        (q_id, 'Египет и Греция', false),
        (q_id, 'Австралия и Франция', false);

    ELSE
        RAISE NOTICE 'Subject "География" (Grade 6) not found. Skipping Variant 16.';
    END IF;
END $$;