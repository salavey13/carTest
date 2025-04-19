-- Ensure the history subject exists (This should already be done by previous script, but included for completeness)
INSERT INTO public.subjects (name, description, grade_level) VALUES
('История', E'## ВПР по Истории (6 класс) \n\nПроверочная работа охватывает **Историю России с древнейших времён до начала XVI века**, **Историю Средних веков (зарубежная история)** и включает **задание, связанное с памятью о Великой Отечественной войне**.\n\n**Основные темы:**\n\n*   🏰 Образование Древнерусского государства.\n*   ✝️ Крещение Руси и её культура.\n*   👑 Правление князей (Рюриковичи).\n*   ⚔️ Феодальная раздробленность и монгольское нашествие.\n*   🛡️ Борьба с иноземными захватчиками (Невская битва, Ледовое побоище, Куликовская битва).\n*   🇷🇺 Объединение русских земель вокруг Москвы.\n*   🌍 Средневековая Европа и Византия.\n*   🎖️ Великая Отечественная война (память о событии).', 6)
ON CONFLICT (name, grade_level) DO NOTHING;

-- Clear existing history questions for idempotency (Variant 3)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 3);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 3;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 3 ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 3... Hold onto your papakhas!';

        -- Question 1 (Var 3 - Key Event)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 3, E'Какое событие 1480 года традиционно считается концом зависимости Руси от Золотой Орды?', E'Это "Стояние на Угре". Представь: две армии стоят, смотрят друг на друга через реку, мёрзнут... и расходятся. Ордынцы поняли, что каши с Иваном III не сварят, и ушли. Конец ига! Прям как в меме с двумя пауками, только тут армии.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Куликовская битва', false),
        (q_id, 'Взятие Казани', false),
        (q_id, 'Ледовое побоище', false),
        (q_id, 'Стояние на реке Угре', true);

        -- Question 2 (Var 3 - Ruler/Action)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 3, E'Какой князь объединил под своей властью Киев и Новгород в 882 году, создав Древнерусское государство со столицей в Киеве?', E'Это был Вещий Олег! Он пришел из Новгорода, хитростью убил киевских правителей Аскольда и Дира (сказав что-то вроде "Вы не князья и не рода княжеского, а я рода княжеского!") и заявил: "Да будет Киев матерью городам русским!". Ну, почти так и было.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Рюрик', false),
        (q_id, 'Князь Игорь', false),
        (q_id, 'Вещий Олег', true),
        (q_id, 'Владимир Святой', false);

        -- Question 3 (Var 3 - Culture/Term)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 3, E'Как назывался налог в пользу церкви, составлявший десятую часть доходов?', E'Десятина! Представь, что у тебя 10 конфет, и одну надо отдать церкви. Священники тоже любят сладкое! Ну, или использовали эти средства на храмы, школы и помощь бедным. Но про конфеты запомнить легче.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Оброк', false),
        (q_id, 'Барщина', false),
        (q_id, 'Десятина', true),
        (q_id, 'Полюдье', false);

        -- Question 4 (Var 3 - World History - Person)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 3, E'Кто был королём франков, провозглашённым императором Запада в 800 году?', E'Карл Великий! Такой был крутой, что его империя занимала пол-Европы. Папа Римский лично короновал его императором. Наверное, у Карла была самая большая корона и самый длинный плащ во всей округе.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Хлодвиг I', false),
        (q_id, 'Карл Великий', true),
        (q_id, 'Вильгельм Завоеватель', false),
        (q_id, 'Ричард Львиное Сердце', false);

        -- Question 5 (Var 3 - Mongol Yoke Feature)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 3, E'Как назывался специальный документ (грамота) от хана Золотой Орды, дававший русским князьям право на правление в своих землях?', E'Ярлык! Без этой бумажки от хана князь был не совсем легитимным. Типа как пропуск в крутой клуб, только вместо фейсконтроля - ханские чиновники, а вместо клуба - целое княжество.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Уложение', false),
        (q_id, 'Ярлык', true),
        (q_id, 'Басма', false), -- Это была табличка представителя хана
        (q_id, 'Судебник', false);

        -- Question 6 (Var 3 - Social Structure)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 3, E'Как называлась личная вооруженная свита князя в Древней Руси, участвовавшая в походах, управлении и сборе дани?', E'Дружина! Это были лучшие друзья князя, его телохранители, советники и спецназ в одном флаконе. Вместе и пировали, и воевали. "За Русь и за князя!" - кричали они, наверное.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Ополчение', false),
        (q_id, 'Дружина', true),
        (q_id, 'Боярская Дума', false),
        (q_id, 'Вече', false);

        -- Question 7 (Var 3 - Event/Significance)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 3, E'Принятие христианства на Руси при князе Владимире привело к...', E'Много к чему! Но главное – укрепилась власть князя (он же теперь помазанник Божий!), развилась культура (письменность, иконы, храмы - вау!), и Русь стала ближе к Византии и Европе. Типа, вступила в престижный клуб христианских стран.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Полному подчинению Византии', false),
        (q_id, 'Укреплению княжеской власти и развитию культуры', true),
        (q_id, 'Началу феодальной раздробленности', false),
        (q_id, 'Прекращению контактов с Европой', false);

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 3.';
    END IF;

END $$;

-- Clear existing history questions for idempotency (Variant 4)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 4);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 4;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 4 ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 4... Prepare for historical awesomeness!';

        -- Question 1 (Var 4 - Ruler/Nickname)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 4, E'Какой древнерусский князь является автором "Поучения детям", где он рассказывал о своей жизни и давал советы наследникам?', E'Владимир Мономах! Он был не только крутым воином и правителем, но и писателем. Представь, твой дедушка пишет тебе не смс, а целое "Поучение" о том, как жить правильно, не лениться и уважать старших. Очень полезно, хоть и длинно!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Ярослав Мудрый', false),
        (q_id, 'Владимир Мономах', true),
        (q_id, 'Андрей Боголюбский', false),
        (q_id, 'Всеволод Большое Гнездо', false); -- У него было много детей, но "Поучение" написал Мономах!

        -- Question 2 (Var 4 - Theory/Concept)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 4, E'Как называется теория, согласно которой Древнерусское государство было создано пришельцами из Скандинавии (варягами)?', E'Норманнская теория! Её сторонники говорят: "Славяне сами не справились, позвали Рюрика с братьями - они и создали государство". А противники отвечают: "Нет, у славян уже всё было, варяги просто помогли!". Спор идёт до сих пор, как о том, что круче - Minecraft или Roblox. **(Easter Egg: Game Reference)**', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Антинорманнская теория', false),
        (q_id, 'Славянская теория', false),
        (q_id, 'Теория "Москва - Третий Рим"', false),
        (q_id, 'Норманнская теория', true);

        -- Question 3 (Var 4 - Battle/Significance)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 4, E'Какое сражение 1240 года, где князь Александр Ярославич разбил шведов, принесло ему прозвище "Невский"?', E'Невская битва! Шведы приплыли на кораблях к реке Неве, думали, легко захватят земли. А тут Александр с дружиной! Дал им такого леща (фигурально выражаясь), что шведы еле унесли ноги. За эту победу на Неве князь и стал Невским. Красавчик!', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Ледовое побоище', false),
        (q_id, 'Невская битва', true),
        (q_id, 'Битва на реке Калке', false),
        (q_id, 'Куликовская битва', false);

        -- Question 4 (Var 4 - Culture/Art)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 4, E'Как называется живопись на досках религиозного содержания, распространённая в Древней Руси после принятия христианства?', E'Иконопись! Это когда святых рисуют на досках специальными красками. Иконы были как бы окнами в духовный мир. Самый известный иконописец - Андрей Рублёв. Его "Троица" - это просто космос!', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Фреска', false), -- Это по сырой штукатурке
        (q_id, 'Мозаика', false), -- Это из камушков
        (q_id, 'Иконопись', true),
        (q_id, 'Летопись', false); -- Это тексты

        -- Question 5 (Var 4 - World History - Document)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 4, E'Как назывался важный документ, подписанный английским королём Иоанном Безземельным в 1215 году под давлением баронов, который ограничивал власть короля и гарантировал права свободным людям?', E'Великая хартия вольностей (Magna Carta)! Бароны сказали королю: "Хватит творить что хочешь! Подписывай!". И он подписал. Это был первый шажок к тому, чтобы король не был абсолютным властелином. Типа, первое правило клуба "Ограничим короля".', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Золотая булла', false), -- Это в Священной Римской империи
        (q_id, 'Салическая правда', false), -- Это у франков
        (q_id, 'Великая хартия вольностей', true),
        (q_id, 'Кодекс Юстиниана', false); -- Это в Византии

        -- Question 6 (Var 4 - Ruler/Action)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 4, E'Какая княгиня первой из правителей Руси приняла христианство в Константинополе (ок. 957 г.)?', E'Княгиня Ольга! Жена князя Игоря и бабушка Владимира Святого. Была очень мудрой и хитрой. Съездила в Византию, впечатлилась и крестилась. Сам византийский император был её крёстным отцом! Представляешь, какой уровень?', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Княгиня Ольга', true),
        (q_id, 'Анна Ярославна', false), -- Королева Франции, тоже крутая, но позже
        (q_id, 'Марфа Посадница', false), -- Правительница Новгорода
        (q_id, 'Евдокия Московская', false); -- Жена Дмитрия Донского

        -- Question 7 (Var 4 - World History - Event)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 4, E'Как называется длительный военный конфликт между Англией и Францией (1337-1453 гг.) за французский престол и территории?', E'Столетняя война! Хотя шла она даже чуть дольше - 116 лет, с перерывами. Там были и крутые рыцари, и лучники, и Жанна д`Арк... В общем, целая эпоха сражений, интриг и героизма. Как очень-очень долгий сериал.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Война Алой и Белой Розы', false), -- Это в Англии, между Ланкастерами и Йорками
        (q_id, 'Крестовые походы', false),
        (q_id, 'Реконкиста', false), -- Это в Испании
        (q_id, 'Столетняя война', true);

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 4.';
    END IF;

END $$;

-- Ensure the history subject exists
INSERT INTO public.subjects (name, description, grade_level) VALUES
('История', E'## ВПР по Истории (6 класс) \n\nПроверочная работа охватывает **Историю России с древнейших времён до начала XVI века**, **Историю Средних веков (зарубежная история)** и включает **задание, связанное с памятью о Великой Отечественной войне**.\n\n**Основные темы:**\n\n*   🏰 Образование Древнерусского государства.\n*   ✝️ Крещение Руси и её культура.\n*   👑 Правление князей (Рюриковичи).\n*   ⚔️ Феодальная раздробленность и монгольское нашествие.\n*   🛡️ Борьба с иноземными захватчиками (Невская битва, Ледовое побоище, Куликовская битва).\n*   🇷🇺 Объединение русских земель вокруг Москвы.\n*   🌍 Средневековая Европа и Византия.\n*   🎖️ Великая Отечественная война (память о событии).', 6)
ON CONFLICT (name, grade_level) DO NOTHING; -- Use composite conflict target if name alone isn't unique across grades

-- Clear existing history questions for idempotency (Variant 1)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 1);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 1;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 1 (Based on PDF Sample) ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 1 (Based on PDF Sample)...';

        -- Question 1 (Var 1 - Match Events to Image Descriptions)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'Установите соответствие между событиями (А-Г) и описаниями иллюстраций (1-4):\n\n**События:**\nА) Столетняя война\nБ) Образование Древнерусского государства\nВ) Монгольское нашествие на Русь в XIII в.\nГ) Борьба Руси против монгольского владычества в XIV в.\n\n**Иллюстрации (описания):**\n1) Воины (похожие на викингов) сходят с ладей на берег.\n2) Конный бой русского витязя и монгольского всадника.\n3) Масштабное сражение средневековых европейских рыцарей и пехотинцев.\n4) Осада или разрушение древнерусского города с деревянными стенами.\n\nЗапишите в ответ цифры, расположив их в порядке, соответствующем буквам: АБВГ.', E'А) Столетняя война - типичная средневековая европейская битва (3).\nБ) Образование Древнерусского государства - связано с приходом варягов (викингов) (1).\nВ) Монгольское нашествие - разорение городов (4).\nГ) Борьба с монгольским владычеством - поединок Пересвета с Челубеем как символ Куликовской битвы (2).\nПравильная последовательность: 3142.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1234', false),
        (q_id, '3142', true),
        (q_id, '4321', false),
        (q_id, '3124', false);

        -- Question 2 (Var 1 - Map - Emperor)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'На карте показаны границы Византийской империи около 565 г. н.э., в период её максимального расширения в Раннем Средневековье. Назовите императора, правившего в это время.', E'Карта соответствует периоду правления императора Юстиниана I (Великого), известного своими завоеваниями (Италия, Северная Африка, часть Испании) и кодификацией законов.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Константин Великий', false),
        (q_id, 'Юстиниан I', true),
        (q_id, 'Василий II Болгаробойца', false),
        (q_id, 'Ираклий I', false);

        -- Question 3 (Var 1 - Map - Labeling Location (Adapted))
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'На карте Византийской империи времён Юстиниана I (ок. 565 г.) показана её столица. Как назывался этот город?', E'Столицей Византийской империи был Константинополь, расположенный на проливе Босфор.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Рим', false),
        (q_id, 'Александрия', false),
        (q_id, 'Константинополь', true),
        (q_id, 'Антиохия', false);

        -- Question 4 (Var 1 - Text - Identify Event)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'Прочтите отрывок: "И один из вельмож рязанских по имени Евпатий Коловрат... приехал в землю Рязанскую, и увидел её опустошённой: грады разорены, церкви сожжены, люди убиты... И собрал небольшую дружину – тысячу семьсот человек... И помчались вслед за царём [вражеским]... в Суздальской земле."\n\nК какому из перечисленных событий относится данный отрывок?\nА) Столетняя война\nБ) Образование Древнерусского государства\nВ) Монгольское нашествие на Русь в XIII в.\nГ) Борьба Руси против монгольского владычества в XIV в.', E'Описание разорения Рязани и подвиг Евпатия Коловрата являются эпизодами монгольского нашествия на Русь под предводительством Батыя в XIII веке.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Б', false),
        (q_id, 'Г', false),
        (q_id, 'В', true),
        (q_id, 'А', false);

        -- Question 5 (Var 1 - Text - Extract Details) - Simplified to numerical answer
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'Согласно отрывку о Евпатии Коловрате, какова была численность дружины, которую он сумел собрать после разорения Рязани? (Ответ дайте числом)', E'В тексте прямо указано: "...собрал небольшую дружину – тысячу семьсот человек...".', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1700', true);
        -- Add plausible incorrect numbers if needed for MC format, but PDF implies free response.

        -- Question 6 (Var 1 - Concept - Varangians - Adapted)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'Кто такие "варяги" в контексте истории Древней Руси?', E'Варягами в древнерусских источниках называли выходцев из Скандинавии (норманнов, викингов), которые выступали в качестве наёмных воинов, купцов, а также, согласно "Повести временных лет", были призваны править (Рюрик). Их деятельность связана с формированием Древнерусского государства.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Монгольские ханы, собиравшие дань', false),
        (q_id, 'Византийские священники, крестившие Русь', false),
        (q_id, 'Скандинавские воины и купцы, сыгравшие роль в становлении государства', true),
        (q_id, 'Польские феодалы, нападавшие на западные границы', false);

        -- Question 7 (Var 1 - Significance - Adapted)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'Какое из перечисленных последствий имело монгольское нашествие (XIII в.) для русских земель?\nА) Быстрое экономическое развитие благодаря торговле с Ордой\nБ) Принятие ислама в качестве государственной религии\nВ) Установление зависимости от Золотой Орды и выплата дани\nГ) Объединение всех русских земель под властью Киева', E'Главным последствием монгольского нашествия было установление вассальной зависимости русских княжеств от Золотой Орды, что включало выплату дани ("выхода") и получение князьями ярлыков на правление. Это привело к экономическому упадку и политической раздробленности.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'А', false),
        (q_id, 'Б', false),
        (q_id, 'Г', false),
        (q_id, 'В', true);

        -- Question 8 (Var 1 - Images - Monuments - Adapted)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'Какие ДВА из перечисленных памятников культуры относятся к истории России, а какие ДВА - к истории зарубежных стран?\n1. Икона "Троица" Андрея Рублёва\n2. Храм Святой Софии в Константинополе (Стамбуле)\n3. Собор Парижской Богоматери (Нотр-Дам де Пари)\n4. Софийский собор в Новгороде\n\nВведите номера памятников России.', E'1. "Троица" Рублёва - шедевр русской иконописи (Россия).\n2. Святая София в Константинополе - выдающийся памятник византийской архитектуры (Зарубежная история).\n3. Нотр-Дам де Пари - классический пример французской готики (Зарубежная история).\n4. Софийский собор в Новгороде - древнейший каменный храм России (Россия).\nПамятники России: 1 и 4.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES -- Assuming digits only, order doesn't matter
        (q_id, '23', false),
        (q_id, '14', true),
        (q_id, '12', false),
        (q_id, '34', false),
        (q_id, '41', true); -- Accept reversed order

        -- Question 9 (Var 1 - Modern Holiday - Adapted)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 1, E'На фотографии изображён парад на Красной площади в Москве, участники которого несут штандарты фронтов Великой Отечественной войны. Какой государственный праздник отмечается в этот день?', E'Парад со штандартами фронтов - характерный атрибут празднования Дня Победы в Великой Отечественной войне (1941-1945 гг.), который отмечается 9 мая.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'День России', false),
        (q_id, 'День народного единства', false),
        (q_id, 'День защитника Отечества', false),
        (q_id, 'День Победы', true);

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 1.';
    END IF;

END $$;


-- Clear existing history questions for idempotency (Variant 2)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 2);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 2;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 2 (Generated) ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 2 (Generated)...';

        -- Question 1 (Var 2 - Chronology)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Расположите события в хронологической последовательности:\nА) Крещение Руси\nБ) Куликовская битва\nВ) Призвание варягов\nГ) Начало монгольского нашествия на Русь', E'В) Призвание варягов (традиционно 862 г.)\nА) Крещение Руси (988 г.)\nГ) Начало монгольского нашествия (1237 г.)\nБ) Куликовская битва (1380 г.)\nПравильный порядок: ВАГБ', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'АВГБ', false),
        (q_id, 'ВАГБ', true),
        (q_id, 'ВГАБ', false),
        (q_id, 'АГВБ', false);

        -- Question 2 (Var 2 - Person/Nickname)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Какой московский князь получил прозвище "Калита" (денежный мешок)?', E'Иван I Данилович Калита (правил в Москве 1325-1340) получил прозвище за свое богатство и умелую финансовую политику, позволившую усилить Московское княжество.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Дмитрий Донской', false),
        (q_id, 'Иван III Великий', false),
        (q_id, 'Иван I', true),
        (q_id, 'Александр Невский', false);

        -- Question 3 (Var 2 - Culture/Architecture)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Какой архитектурный стиль, характерный для средневековой Западной Европы (XII-XVI вв.), отличается использованием стрельчатых арок, нервюрных сводов и больших витражных окон?', E'Указанные черты (стрельчатые арки, нервюрные своды, витражи, часто аркбутаны и контрфорсы) являются характерными признаками готического стиля.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Романский', false),
        (q_id, 'Готический', true),
        (q_id, 'Византийский', false),
        (q_id, 'Ренессанс', false);

        -- Question 4 (Var 2 - Social Structure)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Как в Древней Руси называли категорию лично свободных крестьян-общинников, имевших свое хозяйство и плативших дань князю?', E'Смерды - это основная масса сельского населения Древней Руси, лично свободные земледельцы, жившие общинами и несшие повинности в пользу государства (князя).', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Холопы', false),
        (q_id, 'Бояре', false),
        (q_id, 'Дружинники', false),
        (q_id, 'Смерды', true);

        -- Question 5 (Var 2 - Event/Significance)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Каково было главное значение Ледового побоища (битвы на Чудском озере) 1242 года?', E'Победа русского войска под предводительством Александра Невского над рыцарями Ливонского ордена остановила их наступление на новгородские и псковские земли с запада.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Окончание зависимости от Золотой Орды', false),
        (q_id, 'Остановка агрессии немецких рыцарей на Русь', true),
        (q_id, 'Присоединение Пскова к Московскому княжеству', false),
        (q_id, 'Разгром шведских рыцарей', false); -- Это Невская битва

        -- Question 6 (Var 2 - Source/Law Code)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Как называется первый известный свод законов Древней Руси, составление которого связывают с именем князя Ярослава Мудрого?', E'"Русская Правда" (или "Правда Ярослава" как её древнейшая часть) является важнейшим письменным источником по праву и социальным отношениям в Киевской Руси.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Судебник Ивана III', false),
        (q_id, 'Соборное Уложение', false),
        (q_id, 'Русская Правда', true),
        (q_id, 'Повесть временных лет', false); -- Это летопись

        -- Question 7 (Var 2 - Foreign History - Crusades)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Какая главная цель была провозглашена организаторами Первого крестового похода (конец XI века)?', E'Папа Урбан II на Клермонском соборе в 1095 году призвал европейских рыцарей отправиться на Восток для освобождения Гроба Господня и Святой Земли (Иерусалима) от власти мусульман (турок-сельджуков).', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Завоевание Константинополя', false), -- Цель 4-го похода
        (q_id, 'Борьба с ересью альбигойцев', false), -- Альбигойские войны
        (q_id, 'Освобождение Иерусалима от власти мусульман', true),
        (q_id, 'Создание новых торговых путей в Индию', false);

        -- Question 8 (Var 2 - Terms - Feudalism)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'В системе феодальных отношений в средневековой Европе "вассал" - это...', E'Вассал – это феодал (рыцарь, барон и т.д.), который получал от более крупного феодала (сеньора) земельное владение (феод) и покровительство в обмен на несение военной службы и другие обязательства (верность, совет, выкуп).', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Крупный феодал, раздающий землю', false), -- Это сеньор
        (q_id, 'Зависимый крестьянин, работающий на земле феодала', false), -- Это серв или виллан
        (q_id, 'Феодал, обязанный военной службой своему сеньору за землю', true),
        (q_id, 'Городской ремесленник, входящий в цех', false);

        -- Question 9 (Var 2 - Comparison - Political System)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Какой орган власти играл решающую роль в управлении Новгородской республикой в XII-XV веках?', E'В Новгороде сложилась республиканская форма правления, где высшим органом власти было вече – общегородское собрание, которое решало важнейшие вопросы войны и мира, избирало высших должностных лиц (посадника, тысяцкого, архиепископа).', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Князь', false), -- Князь приглашался и его полномочия были ограничены
        (q_id, 'Вече', true),
        (q_id, 'Боярская Дума', false), -- Характерна для Московского гос-ва
        (q_id, 'Архиепископ', false); -- Был влиятельной фигурой, но не высшим органом

        -- Question 10 (Var 2 - Culture/Literature)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 2, E'Какое выдающееся произведение древнерусской литературы повествует о неудачном походе новгород-северского князя на половцев в 1185 году?', E'"Слово о полку Игореве" – поэма неизвестного автора, посвященная походу князя Игоря Святославича против половцев, является жемчужиной древнерусской литературы.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Повесть временных лет', false), -- Летопись
        (q_id, 'Задонщина', false), -- Повесть о Куликовской битве
        (q_id, 'Слово о полку Игореве', true),
        (q_id, 'Житие Александра Невского', false); -- Агиография

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 2.';
    END IF;

END $$;