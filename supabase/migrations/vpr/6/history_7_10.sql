-- Ensure the history subject exists (This should already be done by previous script, but included for completeness)
INSERT INTO public.subjects (name, description, grade_level) VALUES
('История', E'## ВПР по Истории (6 класс) \n\nПроверочная работа охватывает **Историю России с древнейших времён до начала XVI века**, **Историю Средних веков (зарубежная история)** и включает **задание, связанное с памятью о Великой Отечественной войне**.\n\n**Основные темы:**\n\n*   🏰 Образование Древнерусского государства.\n*   ✝️ Крещение Руси и её культура.\n*   👑 Правление князей (Рюриковичи).\n*   ⚔️ Феодальная раздробленность и монгольское нашествие.\n*   🛡️ Борьба с иноземными захватчиками (Невская битва, Ледовое побоище, Куликовская битва).\n*   🇷🇺 Объединение русских земель вокруг Москвы.\n*   🌍 Средневековая Европа и Византия.\n*   🎖️ Великая Отечественная война (память о событии).', 6)
ON CONFLICT (name, grade_level) DO NOTHING;

-- Clear existing history questions for idempotency (Variant 7)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 7);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 7;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 7 ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 7... Unleash the knowledge!';

        -- Question 1 (Var 7 - Ruler/Peak)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 7, E'При каком князе Киевская Русь достигла своего наивысшего расцвета (строительство Софийского собора в Киеве, составление "Русской Правды", династические браки с Европой)?', E'Ярослав Мудрый! Он был реально мудрым: и законы написал ("Русская Правда" - типа, правила жизни для всех), и собор красивейший построил (София Киевская - до сих пор стоит!), и дочерей за европейских королей выдал замуж. Прям международный уровень!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Владимир Святой', false),
        (q_id, 'Владимир Мономах', false),
        (q_id, 'Ярослав Мудрый', true),
        (q_id, 'Святослав Игоревич', false);

        -- Question 2 (Var 7 - Law/Term)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 7, E'Как в "Русской Правде" назывался штраф за убийство свободного человека?', E'Вира! Если убил кого-то (нехорошо!), надо было платить виру князю. Размер зависел от того, кого убили. За княжеского дружинника - больше, за простого смерда - меньше. Справедливость по-древнерусски!', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Урок', false),
        (q_id, 'Вира', true),
        (q_id, 'Продажа', false), -- Штраф за менее тяжкие преступления
        (q_id, 'Поток и разграбление', false); -- Высшая мера наказания

        -- Question 3 (Var 7 - Social/Economic Term)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 7, E'Как называлась наследственная земельная собственность бояр и князей в Древней Руси и Московском государстве?', E'Вотчина! Это земля, которая передавалась от отца к сыну (отчина!). Её можно было продать, подарить, завещать. Полная собственность. Не путать с поместьем, которое давали за службу и нельзя было просто так передать по наследству.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Поместье', false),
        (q_id, 'Удел', false), -- Часть княжества, выделенная члену княжеской семьи
        (q_id, 'Волость', false), -- Административная единица
        (q_id, 'Вотчина', true);

        -- Question 4 (Var 7 - World History - Conflict)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 7, E'Как назывался длительный конфликт между папами римскими и императорами Священной Римской империи за право назначать епископов?', E'Борьба за инвеституру! Кто главный - Папа или Император? Кто будет назначать епископов (инвеститура)? Спорили долго, ругались, даже воевали. Представь, как два самых крутых босса в Европе не могут поделить власть. В итоге пришли к компромиссу, но нервы друг другу потрепали.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Столетняя война', false),
        (q_id, 'Борьба за инвеституру', true),
        (q_id, 'Альбигойские войны', false),
        (q_id, 'Великая схизма', false);

        -- Question 5 (Var 7 - GPW Memory - Monuments)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 7, E'Какой знаменитый мемориальный комплекс, посвящённый Сталинградской битве, расположен в Волгограде?', E'Мамаев курган! Там стоит гигантская статуя "Родина-мать зовёт!". Это место страшных боёв во время Сталинградской битвы. Теперь там мемориал, напоминающий о подвиге защитников города. Очень мощное место.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Поклонная гора', false), -- В Москве
        (q_id, 'Мамаев курган', true),
        (q_id, 'Брестская крепость-герой', false), -- В Беларуси
        (q_id, 'Пискарёвское мемориальное кладбище', false); -- В Санкт-Петербурге (память о блокаде)

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 7.';
    END IF;

END $$;

-- Clear existing history questions for idempotency (Variant 8)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 8);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 8;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 8 ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 8... Time travel engaged!';

        -- Question 1 (Var 8 - Ruler/Action)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 8, E'Какой князь организовал успешные походы против половцев, временно приостановил распад Древнерусского государства и был инициатором Любечского съезда?', E'Владимир Мономах! Он был как супергерой своего времени: и половцев гонял, и князей мирил (хоть и ненадолго), и "Поучение детям" написал. Настоящий лидер, пытался удержать Русь от распада. Его шапка (шапка Мономаха) стала символом царской власти!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Ярослав Мудрый', false),
        (q_id, 'Владимир Мономах', true),
        (q_id, 'Святополк Окаянный', false),
        (q_id, 'Олег Вещий', false);

        -- Question 2 (Var 8 - Geography/Trade)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 8, E'Какой крупный город на реке Днепр был важным центром на торговом пути "из варяг в греки"?', E'Киев! Этот город стоял прямо посредине пути из Скандинавии (от варягов) в Византию (к грекам). Все торговцы останавливались там, платили пошлины, отдыхали. Неудивительно, что он стал столицей - место-то козырное!', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Новгород', false), -- Начало пути
        (q_id, 'Константинополь', false), -- Конец пути ("у греков")
        (q_id, 'Киев', true),
        (q_id, 'Смоленск', false); -- Тоже на пути, но Киев важнее

        -- Question 3 (Var 8 - World History - Culture/Education)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 8, E'Как назывались высшие учебные заведения, появившиеся в средневековой Европе (Болонья, Париж, Оксфорд), где преподавали богословие, право, медицину?', E'Университеты! Там собирались умнейшие люди (студенты и профессора), изучали науки, спорили. Это были центры знаний. Представь себе Хогвартс, только без магии, но с латынью и философией. **(Easter Egg: Hogwarts Reference)**', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Монастыри', false), -- Там тоже учили, но университеты - другое
        (q_id, 'Академии', false), -- Появились позже
        (q_id, 'Университеты', true),
        (q_id, 'Скриптории', false); -- Мастерские по переписке книг

        -- Question 4 (Var 8 - Mongol Rule Feature)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 8, E'Как назывались ханские чиновники, которые в XIII веке проводили перепись населения на Руси и контролировали сбор дани?', E'Баскаки! Эти ребята приезжали из Орды и следили, чтобы все платили "выход" вовремя и полностью. Их не очень-то любили на Руси, мягко говоря. Если баскак стучится в дверь - жди неприятностей.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Ярлычники', false), -- Такого термина не было
        (q_id, 'Баскаки', true),
        (q_id, 'Темники', false), -- Монгольские военачальники
        (q_id, 'Таможенники', false); -- Собирали торговые пошлины

        -- Question 5 (Var 8 - GPW Memory - Awards)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 8, E'Какой орден, учреждённый во время Великой Отечественной войны, стал высшей военной наградой СССР?', E'Орден "Победа"! Самый главный, самый редкий и самый дорогой орден. Его вручали только высшим полководцам за успешное проведение стратегических операций, изменивших ход войны. Блестит так, что глаза слепит!', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Орден Красной Звезды', false),
        (q_id, 'Орден Славы', false), -- Солдатский орден
        (q_id, 'Орден "Победа"', true),
        (q_id, 'Орден Ленина', false); -- Высшая награда СССР, но не чисто военная

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 8.';
    END IF;

END $$;

-- Clear existing history questions for idempotency (Variant 9)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 9);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 9;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 9 ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 9... The past awaits!';

        -- Question 1 (Var 9 - Consolidation of Russia)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 9, E'Какая из указанных земель была окончательно присоединена к Московскому государству при Иване III после длительной борьбы?', E'Новгородская республика! Новгородцы хотели независимости, даже с Литвой пытались договориться. Но Иван III сказал: "Нет! Вся Русь должна быть под Москвой!". И после нескольких походов и битвы на реке Шелони Новгород вошёл в состав Московского государства. Прощай, вечевой колокол!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Тверское княжество', false), -- Тоже присоединил, но Новгород - знаковое событие
        (q_id, 'Новгородская республика', true),
        (q_id, 'Рязанское княжество', false), -- Присоединено позже, при Василии III
        (q_id, 'Псковская республика', false); -- Тоже при Василии III

        -- Question 2 (Var 9 - Dependent People)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 9, E'Как в Древней Руси называли людей, попавших в зависимость из-за долгов, взятых у феодала ("купа")?', E'Закупы! Взял в долг ("купу") - работай, пока не отдашь. Был не совсем рабом (холопом), имел какое-то хозяйство, но и не совсем свободным. Если убегал - становился полным холопом. Так что лучше было долги отдавать!', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Смерды', false),
        (q_id, 'Рядовичи', false), -- Заключившие договор ("ряд")
        (q_id, 'Закупы', true),
        (q_id, 'Холопы', false); -- Полные рабы

        -- Question 3 (Var 9 - World History - Hundred Years War Figure)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 9, E'Какая французская девушка-крестьянка возглавила французские войска во время Столетней войны, сняла осаду Орлеана и способствовала коронации Карла VII, но позже была сожжена на костре?', E'Жанна д`Арк! Орлеанская дева! Услышала голоса святых, надела доспехи и пошла спасать Францию. Вдохновила армию, победила англичан под Орлеаном. Настоящая героиня! Правда, потом попала в плен к врагам и... грустный конец. Но французы её помнят и чтят.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Мария Антуанетта', false), -- Королева, жила намного позже
        (q_id, 'Екатерина Медичи', false), -- Тоже королева, но позже
        (q_id, 'Жанна д`Арк', true),
        (q_id, 'Элеонора Аквитанская', false); -- Королева Англии и Франции, но раньше

        -- Question 4 (Var 9 - Culture - Architecture)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 9, E'Как называется знаменитый белокаменный храм Покрова на Нерли, построенный при Андрее Боголюбском недалеко от Владимира, известный своей изящностью и гармонией с природой?', E'Церковь Покрова на Нерли! Маленькая, изящная, стоит посреди луга у реки... Многие считают её самым красивым древнерусским храмом. Как будто лебедь присел отдохнуть. Построил её Андрей Боголюбский в память о сыне.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Успенский собор во Владимире', false), -- Большой, главный собор
        (q_id, 'Дмитриевский собор во Владимире', false), -- Знаменит резьбой по камню
        (q_id, 'Церковь Покрова на Нерли', true),
        (q_id, 'Софийский собор в Новгороде', false); -- В Новгороде, другой стиль

        -- Question 5 (Var 9 - GPW Memory - Battles)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 9, E'Битва под каким городом зимой 1941-1942 гг. стала первым крупным поражением фашистской Германии во Второй мировой войне и развеяла миф о непобедимости немецкой армии?', E'Битва под Москвой! Немцы подошли совсем близко к столице, но советские войска их остановили, а потом перешли в контрнаступление и отбросили врага. Это была первая большая победа, которая дала надежду всей стране!', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Сталинградская битва', false), -- Перелом в войне, но позже
        (q_id, 'Курская битва', false), -- Крупнейшее танковое сражение, позже
        (q_id, 'Битва под Москвой', true),
        (q_id, 'Битва за Берлин', false); -- Конец войны

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 9.';
    END IF;

END $$;

-- Clear existing history questions for idempotency (Variant 10)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 10);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 10;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 10 ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 10... The final countdown!';

        -- Question 1 (Var 10 - Early Moscow)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 10, E'Кто считается основателем московской династии князей, младший сын Александра Невского, получивший Москву в удел?', E'Даниил Александрович! Он был тихим и скромным князем, но именно при нём Москва начала потихоньку расти и укрепляться. Присоединил Коломну, Переславль-Залесский. Заложил основу будущего величия Москвы. Папа у него был крутой (Невский!), и сын не подкачал.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Иван Калита', false), -- Значительно расширил и укрепил
        (q_id, 'Юрий Долгорукий', false), -- Считается основателем города Москвы, но не династии
        (q_id, 'Даниил Александрович', true),
        (q_id, 'Дмитрий Донской', false);

        -- Question 2 (Var 10 - Culture/Religion Role)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 10, E'Какую роль играли монастыри в культурной жизни Древней Руси?', E'Огромную! Это были не только места молитвы, но и центры просвещения и культуры. Там переписывали книги (скриптории!), вели летописи, создавали иконы, открывали первые школы. Монахи были самыми образованными людьми того времени. Троице-Сергиев монастырь, основанный Сергием Радонежским, - яркий пример.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Только проводили богослужения', false),
        (q_id, 'Были центрами культуры, образования и книжности', true),
        (q_id, 'Служили только крепостями', false),
        (q_id, 'Занимались исключительно сбором налогов', false);

        -- Question 3 (Var 10 - World History - Political Structure)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 10, E'Как назывался орган сословного представительства в средневековой Англии, возникший в XIII веке, который ограничивал власть короля, особенно в вопросах налогов?', E'Парламент! Сначала там были только бароны и епископы, потом стали приглашать рыцарей и горожан. Король не мог вводить новые налоги без согласия парламента. Это как Дума, только в Англии и очень давно. Состоит из Палаты Лордов и Палаты Общин.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Генеральные штаты', false), -- Во Франции
        (q_id, 'Кортесы', false), -- В Испании
        (q_id, 'Парламент', true),
        (q_id, 'Рейхстаг', false); -- В Германии

        -- Question 4 (Var 10 - Feudalism Concept)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 10, E'Как называлась система отношений в средневековой Европе, основанная на личной зависимости одних феодалов (вассалов) от других (сеньоров) и иерархии земельных владений?', E'Феодализм! Или феодальная лестница. Наверху король (типа, самый главный сеньор), ниже - герцоги и графы (его вассалы, но сеньоры для баронов), еще ниже - бароны (вассалы герцогов, сеньоры для рыцарей), и в самом низу - рыцари. Каждый служит тому, кто выше, и командует теми, кто ниже. Запутанно, но так жили.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Абсолютизм', false), -- Это когда король имеет неограниченную власть, позже
        (q_id, 'Феодализм', true),
        (q_id, 'Капитализм', false), -- Еще позже
        (q_id, 'Коммунизм', false); -- Совсем другая история

        -- Question 5 (Var 10 - GPW Memory - Symbols/Songs)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 10, E'Какая песня, написанная в первые дни Великой Отечественной войны, стала одним из её главных музыкальных символов, призывом к защите Родины?', E'"Священная война"! "Вставай, страна огромная, вставай на смертный бой...". Мурашки по коже! Её слова и музыка поднимали боевой дух солдат и всего народа. Настоящий гимн защиты Отечества.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '"Катюша"', false), -- Тоже популярная, но другая по настроению
        (q_id, '"День Победы"', false), -- Написана после войны
        (q_id, '"Священная война"', true),
        (q_id, '"Тёмная ночь"', false); -- Лирическая песня военных лет

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 10.';
    END IF;

END $$;