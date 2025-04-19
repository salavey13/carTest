-- Ensure the history subject exists (This should already be done by previous script, but included for completeness)
INSERT INTO public.subjects (name, description, grade_level) VALUES
('История', E'## ВПР по Истории (6 класс) \n\nПроверочная работа охватывает **Историю России с древнейших времён до начала XVI века**, **Историю Средних веков (зарубежная история)** и включает **задание, связанное с памятью о Великой Отечественной войне**.\n\n**Основные темы:**\n\n*   🏰 Образование Древнерусского государства.\n*   ✝️ Крещение Руси и её культура.\n*   👑 Правление князей (Рюриковичи).\n*   ⚔️ Феодальная раздробленность и монгольское нашествие.\n*   🛡️ Борьба с иноземными захватчиками (Невская битва, Ледовое побоище, Куликовская битва).\n*   🇷🇺 Объединение русских земель вокруг Москвы.\n*   🌍 Средневековая Европа и Византия.\n*   🎖️ Великая Отечественная война (память о событии).', 6)
ON CONFLICT (name, grade_level) DO NOTHING;

-- Clear existing history questions for idempotency (Variant 5)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 5);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 5;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 5 ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 5... Sharpen your historical swords!';

        -- Question 1 (Var 5 - Ruler/Law Code)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 5, E'Какой правитель издал в 1497 году Судебник, установивший единые законы для всего Московского государства и ограничивший переход крестьян Юрьевым днём?', E'Иван III Великий! Он не только "стоял на Угре" и присоединял земли, но и навёл порядок в законах. Его Судебник - это как первая конституция Московской Руси. А Юрьев день? Это когда крестьянин мог уйти от одного помещика к другому (раз в год, заплатив долги). Иван III начал это дело ограничивать.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Иван IV Грозный', false),
        (q_id, 'Василий III', false),
        (q_id, 'Иван III', true),
        (q_id, 'Дмитрий Донской', false);

        -- Question 2 (Var 5 - Social Structure Term)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 5, E'Как называлась форма сбора дани князем и его дружиной в Древней Руси, когда они объезжали подвластные территории?', E'Полюдье! Князь с дружиной ездил "в люди" собирать налоги (мёд, меха, всякое добро). Представь, как к тебе домой приходит президент со своей охраной и говорит: "Плати налоги!". Примерно так, только на лошадях и без галстуков.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Урок', false), -- Это фиксированный размер дани, ввела Ольга
        (q_id, 'Погост', false), -- Место сбора дани, тоже Ольга
        (q_id, 'Полюдье', true),
        (q_id, 'Ярлык', false); -- Грамота от хана

        -- Question 3 (Var 5 - World History - Movement)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 5, E'Как называлось движение за освобождение Пиренейского полуострова (территории современных Испании и Португалии) от арабского владычества, длившееся несколько веков?', E'Реконкиста! Это как "отвоевание" по-испански. Христианские королевства Пиренейского полуострова медленно, но верно отвоёвывали земли у мавров (арабов). Шло это дело долго, почти 800 лет! Дольше, чем строится твоя школа, наверное.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Крестовые походы', false),
        (q_id, 'Реформация', false),
        (q_id, 'Реконкиста', true),
        (q_id, 'Гуситские войны', false); -- Это в Чехии

        -- Question 4 (Var 5 - Culture/Writing)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 5, E'Как назывались создатели славянской азбуки, византийские монахи-просветители?', E'Кирилл и Мефодий! Эти два брата-супергероя подарили славянам азбуку (глаголицу и кириллицу). Без них мы бы до сих пор, может, картинки рисовали вместо букв. Скажем им спасибо за возможность писать смс-ки!', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Нестор Летописец и Андрей Рублев', false),
        (q_id, 'Кирилл и Мефодий', true),
        (q_id, 'Аскольд и Дир', false),
        (q_id, 'Сергий Радонежский и Митрополит Алексий', false);

        -- Question 5 (Var 5 - Event/Date)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 5, E'В каком году произошла битва на реке Калке, где объединённое русско-половецкое войско потерпело сокрушительное поражение от монголов?', E'1223 год. Это была первая встреча русских с монголами. Закончилась она... ну, не очень. Монголы оказались неожиданно сильными и организованными. Типа как когда ты думаешь, что легко пройдешь босса в игре, а он выносит тебя с одного удара. **(Easter Egg: Game Boss Reference)**', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '1240 г.', false), -- Взятие Киева монголами
        (q_id, '1380 г.', false), -- Куликовская битва
        (q_id, '1223 г.', true),
        (q_id, '1242 г.', false); -- Ледовое побоище

        -- Question 6 (Var 5 - Ruler/Action)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 5, E'Какой московский князь возглавил русское войско в Куликовской битве 1380 года?', E'Дмитрий Донской! Он собрал огромную армию и дал бой Мамаю на Куликовом поле. Битва была страшная, но русские победили! За эту победу на Дону (точнее, рядом с ним) Дмитрия и прозвали Донским. Легенда!', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Иван Калита', false),
        (q_id, 'Александр Невский', false),
        (q_id, 'Дмитрий Донской', true),
        (q_id, 'Иван III', false);

        -- Question 7 (Var 5 - World History - Social)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 5, E'Как в средневековой Европе назывались союзы ремесленников одной специальности в городах?', E'Цехи! Кузнецы объединялись в цех кузнецов, сапожники - в цех сапожников. У них были свои правила, свои мастера, подмастерья и ученики. Это как гильдии в РПГ, только в реальной жизни. Они следили за качеством товара и не пускали чужаков.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Ордена', false), -- Это у рыцарей или монахов
        (q_id, 'Гильдии', false), -- Это чаще у купцов
        (q_id, 'Цехи', true),
        (q_id, 'Коммуны', false); -- Это городское самоуправление

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 5.';
    END IF;

END $$;

-- Clear existing history questions for idempotency (Variant 6)
DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 6);
DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'История' AND grade_level = 6) AND variant_number = 6;

-- =============================================
-- === INSERT HISTORY 6th Grade, VARIANT 6 ===
-- =============================================
DO $$
DECLARE
    subj_hist_id INT;
    q_id INT;
BEGIN
    SELECT id INTO subj_hist_id FROM public.subjects WHERE name = 'История' AND grade_level = 6;

    IF subj_hist_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding History Variant 6... Final challenge accepted!';

        -- Question 1 (Var 6 - Culture/Literature)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 6, E'Как называется древнейшая дошедшая до нас русская летопись, повествующая о начале Русского государства, его истории до начала XII века?', E'"Повесть временных лет"! Её написал монах Нестор Летописец (ну, или он собрал всё вместе). Это как исторический сериал про Древнюю Русь, только в виде текста. Откуда есть пошла Русская земля? Читай "Повесть"!', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Слово о полку Игореве', false),
        (q_id, 'Русская Правда', false),
        (q_id, 'Задонщина', false),
        (q_id, 'Повесть временных лет', true);

        -- Question 2 (Var 6 - Event/Consequence)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 6, E'К какому главному последствию привел Любечский съезд князей в 1097 году?', E'Князья договорились: "Каждый да держит отчину свою!". То есть, каждый правит в земле, доставшейся от отца, и не лезет к соседям. Звучит хорошо? Но на деле это закрепило феодальную раздробленность. Русь разделилась на много княжеств, как пицца на куски.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Полному объединению Руси', false),
        (q_id, 'Закреплению раздробленности русских земель', true),
        (q_id, 'Принятию христианства', false),
        (q_id, 'Изгнанию половцев', false);

        -- Question 3 (Var 6 - Ruler/Action)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 6, E'Какой князь перенёс столицу Северо-Восточной Руси из Суздаля во Владимир и построил там знаменитый Успенский собор и Золотые ворота?', E'Андрей Боголюбский! Сын Юрия Долгорукого. Он хотел сделать Владимир "новым Киевом", круче прежнего. Построил там кучу всего красивого. Правда, закончил плохо - его убили бояре-заговорщики. Но Владимир при нём расцвел!', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Юрий Долгорукий', false), -- Основал Москву, но столица была в Суздале
        (q_id, 'Всеволод Большое Гнездо', false), -- Брат Андрея, правил после него
        (q_id, 'Андрей Боголюбский', true),
        (q_id, 'Александр Невский', false);

        -- Question 4 (Var 6 - World History - Religion)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 6, E'Как назывался раскол христианской церкви в 1054 году, в результате которого она разделилась на Западную (Католическую) и Восточную (Православную)?', E'Великая схизма! Папа Римский и Патриарх Константинопольский так сильно поссорились (из-за власти, обрядов и всяких богословских тонкостей), что предали друг друга анафеме (церковному проклятию). И всё, церковь разделилась. Как будто лучшие друзья навсегда перестали общаться.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Реформация', false), -- Это в 16 веке, появление протестантизма
        (q_id, 'Авиньонское пленение пап', false), -- Когда папы жили во Франции
        (q_id, 'Великая схизма', true),
        (q_id, 'Крещение Руси', false);

        -- Question 5 (Var 6 - Social Structure Term)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 6, E'Как назывались крупные землевладельцы в Древней Руси и Московском государстве, занимавшие высшие должности и входившие в окружение князя (царя)?', E'Бояре! Это были самые знатные и богатые люди после князя. У них были огромные земли (вотчины), свои дружины, и они заседали в Боярской Думе - советовали князю, как править. Типа олигархи того времени, только с бородами и в шубах.', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Смерды', false),
        (q_id, 'Дворяне', false), -- Стали главной опорой царя позже
        (q_id, 'Бояре', true),
        (q_id, 'Холопы', false); -- Это рабы

        -- Question 6 (Var 6 - Mongol Rule Feature)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 6, E'Как называлась дань, которую русские княжества платили Золотой Орде?', E'"Выход"! Ордынцы требовали регулярную плату за "крышу". Не заплатишь - придут с карательным походом. Собирали его сурово, иногда с помощью специальных чиновников - баскаков. Неприятная штука, мягко говоря.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Оброк', false), -- Плата крестьян феодалу
        (q_id, 'Выход', true),
        (q_id, 'Подать', false), -- Общее название налога
        (q_id, 'Тягло', false); -- Система повинностей

        -- Question 7 (Var 6 - World History - Event)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_hist_id, 6, E'Какое событие 1453 года имело огромное значение для мировой истории, положив конец существованию Византийской империи?', E'Падение Константинополя! Турки-османы во главе с султаном Мехмедом II захватили столицу Византии после долгой осады. Это был конец тысячелетней империи, наследницы Рима. Очень грустное событие, но и начало новой эпохи - Османской империи.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Битва при Гастингсе', false), -- 1066 г., нормандское завоевание Англии
        (q_id, 'Открытие Америки Колумбом', false), -- 1492 г.
        (q_id, 'Падение Константинополя', true),
        (q_id, 'Начало Столетней войны', false); -- 1337 г.

    ELSE
        RAISE NOTICE 'Subject "История" (Grade 6) not found. Skipping Variant 6.';
    END IF;

END $$;