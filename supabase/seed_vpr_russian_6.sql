-- Ensure the "Русский язык" subject exists
INSERT INTO public.subjects (name, description) VALUES
('Русский язык', E'## ВПР по Русскому языку (6 класс)\n\nПроверка знаний по орфографии, пунктуации, морфологии, синтаксису, лексике и работе с текстом.')
ON CONFLICT (name, grade_level) DO NOTHING;

-- Clear existing Russian language questions before seeding (optional, for idempotency)
-- DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 6));
-- DELETE FROM public.vpr_questions WHERE subject_id = (SELECT id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 6);


-- Clear existing Social Studies questions for idempotency (Variants 1, 2, 3, 4)
DO $$
DECLARE
    subj_soc_id INT;
BEGIN
    SELECT id INTO subj_soc_id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 6;

    IF subj_soc_id IS NOT NULL THEN
        RAISE NOTICE 'Deleting existing data for Обществознание Variants 1, 2...';
        DELETE FROM public.vpr_answers a
        USING public.vpr_questions q
        WHERE a.question_id = q.id
          AND q.subject_id = subj_soc_id
          AND q.variant_number IN (1, 2);

        DELETE FROM public.vpr_questions
        WHERE subject_id = subj_soc_id
          AND variant_number IN (1, 2);
        RAISE NOTICE 'Deletion complete for Обществознание Variants 1, 2.';
    ELSE
        RAISE NOTICE 'Subject "Обществознание" not found. Skipping deletion.';
    END IF;
END $$;
-- ======================================================
-- === INSERT RUSSIAN LANGUAGE 6th Grade, VARIANT 1 ===
-- === (Комплект 1, Вариант 1)                      ===
-- ======================================================
DO $$
DECLARE
    subj_rus_id INT;
    q_id INT;
    v_num INT := 1; -- Variant Number
BEGIN
    SELECT id INTO subj_rus_id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 6;

    IF subj_rus_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Russian Language Variant %...', v_num;

        -- Q1: Text Rewriting (Placeholder)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Перепишите текст 1, раскрывая скобки, вставляя пропущенные буквы и знаки препинания.\n\n**Текст 1**\nДом ждёт, когда к..мпозитор сяд..т за рояль. Слышно, как проп..ёт п..ловица вспомн..т дн..вную музыку выхват..т какую(нибудь) ноту. Так музыканты настра..вают инструменты скрипку контрабас арфу. Ноч..ю (Ч,ч)айковский пр..слушива..т..ся к (не)громк..м но скр..пуч..м звукам и спраш..вает себя (К,к)ак передать (не)земной в..сторг от зрелища радуги\nПолусо(н,нн)ый к..мпозитор вспомн..л, как укрылся от прол..вного дождя у (Т,т)ихона. В избу вб..жала и ост..новилась (светло)в..лосая девоч..ка.(4) Это Феня доч.. Тихона. С её в..лос ст..кали д..ждинки, а две капельки повисли(3) на кон..ч..ках ушей. Из-за (тёмно)серых туч.. ударило со..нце оз..рило забл..стевшие, как серьги, капельки. Феня стряхнула их и волше(б/п)ство и(з/с)чезло.\n(Ч,ч)айковский грус..но подумал, что (н..)какой музыкой (не)передать прелесть этих в..дя(н,нн)ых(2) капель.', E'Требуется переписать текст с правильной орфографией и пунктуацией. См. текст в ответе К1.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Переписанный текст]', true);

        -- Q2: Linguistic Analysis (Placeholders)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Выполните обозначенные цифрами в тексте 1 языковые разборы:\n(2) — морфемный и словообразовательный разборы слова (водяных);\n(3) — морфологический разбор слова (повисли);\n(4) – синтаксический разбор предложения (Это Феня доч.. Тихона).', E'См. ответы К1-К4 в ключе.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '[Разбор слова водяных (2)]', true),
        (q_id, '[Разбор слова повисли (3)]', true),
        (q_id, '[Разбор предложения (4)]', true);

        -- Q3: Letter/Sound Mismatch (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'В выделенном предложении "Это Феня доч.. Тихона." найдите слово, в котором не совпадает количество букв и звуков, выпишите это слово. Объясните причину.', E'Слово: дочь.\nПричина: 4 буквы, 3 звука. Буква Ь не обозначает звука.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'дочь, ь не обозначает звука', true);

        -- Q4: Accent Placement (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Поставьте знак ударения в словах: Взяла, торты, звоним, аэропорты.', E'Правильные ударения: ВзялА, тОрты, звонИм, аэропОрты.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'ВзялА, тОрты, звонИм, аэропОрты', true);

        -- Q5: Parts of Speech (Placeholder)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Над каждым словом напишите, какой частью речи оно является:\nС восемнадцатого века Россия производит хлопчатобумажные ткани и продаёт их другим странам.', E'С(предл) восемнадцатого(числ) века(сущ) Россия(сущ) производит(глаг) хлопчатобумажные(прил) ткани(сущ) и(союз) продаёт(глаг) их(мест) другим(мест) странам(сущ).', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Части речи надписаны]', true);

        -- Q6: Error Correction (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Найдите и исправьте ошибку (ошибки) в образовании формы слова. Запишите правильный вариант:\n1. река более глубже\n2. семьюстами анкетами\n3. яркое кашпо\n4. по обоим сторонам дороги', E'Ошибки: 1, 4.\nПравильно: 1. река глубже (или более глубокая), 4. по обеим сторонам дороги.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'глубже (более глубокая), по обеим сторонам', true);

        -- Q7: Punctuation (Dash) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Выпишите предложение, в котором нужно поставить тире. Напишите, на каком основании.\n1. Над болотными кочками стоят редкие сосны.\n2. Письмо одежда устной речи.\n3. Наша малышка забавна и неуклюжа.\n4. Мой товарищ сильный духом и целеустремлённый.', E'Предложение: Письмо - одежда устной речи.\nОснование: Тире между подлежащим (Письмо) и сказуемым (одежда), выраженными именами существительными в именительном падеже.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Письмо - одежда устной речи. Тире между подлежащим и сказуемым (сущ. в И.п.)', true);

        -- Q8: Punctuation (Commas) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Выпишите предложение, в котором нужно поставить две запятые. На каком основании.\n1. Ненастье затянулось и даже яркая листва на деревьях стала темнее.\n2. Можно часами сидеть на этом высоком холме и любоваться бескрайними степными просторами.\n3. Ты куда море катишь свои белёсые гривы пенных волн?\n4. В траве на опушке прячутся крепкие боровики а мокрые сыроежки выглядывают из-под листочков и хвои.', E'Предложение: Ты куда, море, катишь свои белёсые гривы пенных волн?\nОснование: Запятые выделяют обращение "море".', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Ты куда, море, катишь свои белёсые гривы пенных волн? Выделение обращения.', true);

        -- Q9: Reading Comprehension (Main Idea) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Прочитайте текст 2 (про аистов). Определите и запишите основную мысль текста.', E'Основная мысль: Люди с давних пор относятся к аистам с особой любовью и покровительством, считая их символом счастья и приписывая им ценные качества, что породило множество поверий и легенд.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Основная мысль сформулирована]', true);

        -- Q10: Reading Comprehension (Plan) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Составьте и запишите план текста 2 из трёх пунктов.', E'Примерный план:\n1. Поверья и особое отношение людей к аистам.\n2. Качества аистов, вызывающие симпатию у людей.\n3. Происхождение легенды о том, что аисты приносят детей.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[План составлен]', true);

        -- Q11: Reading Comprehension (Specific Info) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Какие качества аистов, по мнению автора текста 2, привлекают людей?', E'Автор упоминает, что аисты красивые и гордые, создают постоянные супружеские пары (верность), селятся возле чистых и аккуратных домов.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Красота, гордость, супружеская верность, любовь к чистоте/порядку.', true);

        -- Q12: Vocabulary (Lexical Meaning + Sentence) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Определите лексическое значение слова «пара» («пары») из предложения 9 ("Супружеские пары у них постоянные..."). Подберите предложение, где это слово употреблялось бы в другом значении.', E'Значение в тексте: двое (самец и самка), рассматриваемые как одно целое.\nДругое значение: два однородных предмета, употребляемые вместе (пара ботинок); или короткий промежуток времени (пара минут).\nПример предложения: Мне нужна новая пара перчаток.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Значение определено, предложение составлено]', true);

        -- Q13: Vocabulary (Stylistic Coloring + Synonym) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Определите стилистическую окраску слова «должном» из предложения 19 ("...содержать в должном порядке такой дом..."). Подберите синоним.', E'Стилистическая окраска: книжное.\nСиноним: надлежащем, соответствующем, правильном.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Книжное, надлежащем (или другой синоним)', true);

        -- Q14: Phraseology (Meaning + Situation) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Объясните значение фразеологизма СПРЯТАТЬ КОНЦЫ В ВОДУ. Опишите ситуацию (2 предл.), где уместно его употребление. Включите фразеологизм в одно из предложений.', E'Значение: скрыть следы преступления, проступка, чего-либо неблаговидного.\nСитуация: Мальчик разбил вазу и быстро собрал осколки. Он решил спрятать концы в воду, выбросив их в мусоропровод, чтобы мама ничего не узнала.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Значение объяснено, ситуация описана, фразеологизм включен]', true);

    ELSE
        RAISE NOTICE 'Subject "Русский язык" not found. Skipping Variant %.', v_num;
    END IF;
END $$;


-- ======================================================
-- === INSERT RUSSIAN LANGUAGE 6th Grade, VARIANT 2 ===
-- === (Комплект 1, Вариант 2)                      ===
-- ======================================================
DO $$
DECLARE
    subj_rus_id INT;
    q_id INT;
    v_num INT := 2; -- Variant Number
BEGIN
    SELECT id INTO subj_rus_id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 6;

    IF subj_rus_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Russian Language Variant %...', v_num;

        -- Q1: Text Rewriting (Placeholder)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Перепишите текст 1, раскрывая скобки, вставляя пропущенные буквы и знаки препинания.\n\n**Текст 1**\nПр..зывный сигнал трубы пор..зил экипаж.. шхуны. Разг..воры пр..кращены все смотр..т на скалу, откуда донос..т..ся ре(з/с)кий звук.\nНеожиданно выплыва..т(3) дельфин, на сп..не которого, как на лошад.., с..дит в..рхом стра(н,нн)ое существо. У него тело ч..ловека но кожа отл..вает (нежно)голубым с..р..бром. Кисти и дли(н,нн)ые(2) пальц.. с перепонками напом..нают лапы л..гушк.. . Огромные, словно ст..ри(н,нн)ые ч..сы-луковиц.., гл..за ярко бл..стят. Стра(н,нн)ое существо держ..т в руке дли(н,нн)ую витую раковину. Оно смеёт..ся кр..чит что(то) на испанском языке и пр..шпор..вает бока дельфина н..гами. Тот, как скаковая лошадь, пр..бавля..т скорость.\nЛовц.. жемчуга (не)вольно в(з/с)крик..вают. Уд..вительный наез..ник с быстротой ящериц.. соскальз..ва..т под воду.(4)\nЭтот весьма (не)обычный выез(д/т) длился м..нуту но зрители ещё долго (не)могут опомнит..ся от изумления.', E'Требуется переписать текст с правильной орфографией и пунктуацией. См. текст в ответе К1 варианта 2.', 1)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Переписанный текст]', true);

        -- Q2: Linguistic Analysis (Placeholders)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Выполните обозначенные цифрами в тексте 1 языковые разборы:\n(2) — морфемный и словообразовательный разборы слова (длинные);\n(3) — морфологический разбор слова (выплывает);\n(4) – синтаксический разбор предложения (Удивительный наездник с быстротой ящерицы соскальзывает под воду).', E'См. ответы К1-К4 в ключе для варианта 2.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '[Разбор слова длинные (2)]', true),
        (q_id, '[Разбор слова выплывает (3)]', true),
        (q_id, '[Разбор предложения (4)]', true);

        -- Q3: Letter/Sound Mismatch (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'В выделенном предложении "Разговоры прекращены все смотрят на скалу..." найдите слово, в котором не совпадает количество букв и звуков, выпишите это слово. Объясните причину.', E'Слово: доносится.\nПричина: 9 букв, 8 звуков. Сочетание ТСЯ произносится как [ца].', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'доносится, тся произносится как [ца]', true);

        -- Q4: Accent Placement (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Поставьте знак ударения в словах: Газопровод, столяр, позвонит, километр.', E'Правильные ударения: ГазопровОд, столЯр, позвонИт, киломЕтр.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'ГазопровОд, столЯр, позвонИт, киломЕтр', true);

        -- Q5: Parts of Speech (Placeholder)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Над каждым словом напишите, какой частью речи оно является:\nРадость ощущается и в щебетанье воробьёв, и в блеске первых камешков на мостовой.', E'Радость(сущ) ощущается(глаг) и(союз) в(предл) щебетанье(сущ) воробьёв(сущ), и(союз) в(предл) блеске(сущ) первых(числ) камешков(сущ) на(предл) мостовой(сущ).', 5)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Части речи надписаны]', true);

        -- Q6: Error Correction (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Найдите и исправьте ошибку (ошибки) в образовании формы слова. Запишите правильный вариант:\n1. ихние секреты\n2. о пятистах страницах\n3. килограмм мандаринов\n4. самая высочайшая гора', E'Ошибки: 1, 4.\nПравильно: 1. их секреты, 4. высочайшая гора (или самая высокая).', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'их секреты, высочайшая (самая высокая) гора', true);

        -- Q7: Punctuation (Dash) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Выпишите предложение, в котором нужно поставить тире. Напишите, на каком основании.\n1. Старая берёза под окном стройна и красива.\n2. Колибри крохотные птички с ярким оперением.\n3. Капитан катера молодой и весёлый.\n4. Лёгкий ветерок гнёт к земле придорожный ковыль.', E'Предложение: Колибри - крохотные птички с ярким оперением.\nОснование: Тире между подлежащим (Колибри) и сказуемым (птички), выраженными именами существительными в именительном падеже.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Колибри - крохотные птички с ярким оперением. Тире между подлежащим и сказуемым (сущ. в И.п.)', true);

        -- Q8: Punctuation (Commas) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Выпишите предложение, в котором нужно поставить две запятые. На каком основании.\n1. Спорт даёт познание жизни и умение работать в команде учит дисциплине.\n2. Голоса птиц в осеннем лесу не нарушают а только подчёркивают тишину.\n3. Разрешите мне Николай Петрович участвовать в командном турнире.\n4. В половодье вода в Волге поднимается и в это время река особенно величественна.', E'Предложение: Разрешите мне, Николай Петрович, участвовать в командном турнире.\nОснование: Запятые выделяют обращение "Николай Петрович".', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Разрешите мне, Николай Петрович, участвовать в командном турнире. Выделение обращения.', true);

        -- Q9: Reading Comprehension (Main Idea) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Прочитайте текст 2 (про звуки). Определите и запишите основную мысль текста.', E'Основная мысль: Вынужденное бездействие (из-за перелома) и ограничение зрительного восприятия обострили слух рассказчика, позволив ему открыть для себя богатый и сложный мир звуков, в том числе звуков старого дома.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Основная мысль сформулирована]', true);

        -- Q10: Reading Comprehension (Plan) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Составьте и запишите план текста 2 из трёх пунктов.', E'Примерный план:\n1. Лежание в постели из-за перелома ноги.\n2. Обострение слуха и изучение языка шумов.\n3. Таинственные звуки старого дома.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[План составлен]', true);

        -- Q11: Reading Comprehension (Specific Info) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Почему, по мнению рассказчика (текст 2), он стал хорошо понимать язык звуков?', E'Потому что из-за перелома ноги он был прикован к постели и не мог воспринимать мир глазами, как раньше. Это поневоле обострило его слух.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Из-за перелома он лежал и не мог воспринимать мир глазами, поэтому слух обострился.', true);

        -- Q12: Vocabulary (Lexical Meaning + Sentence) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Определите лексическое значение слова «тяжёлый» («тяжёлым») из предложения 3 ("...не таким уж тяжёлым событием."). Подберите предложение, где это слово употреблялось бы в другом значении.', E'Значение в тексте: неприятный, серьёзный, опасный, трудный для перенесения.\nДругое значение: имеющий большой вес (тяжёлый чемодан); трудный для понимания (тяжёлый текст); суровый (тяжёлое наказание).\nПример предложения: Этот рюкзак был слишком тяжёлым для похода.', 12)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Значение определено, предложение составлено]', true);

        -- Q13: Vocabulary (Stylistic Coloring + Synonym) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Определите стилистическую окраску слова «дедок» из предложения 18 ("...дом кряхтит, как дедок."). Подберите синоним.', E'Стилистическая окраска: разговорное, (уменьшительно-)ласкательное или пренебрежительное.\nСиноним: старик, дедушка, дед.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Разговорное, старик (или другой синоним)', true);

        -- Q14: Phraseology (Meaning + Situation) (Free Response)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_rus_id, v_num, E'Объясните значение фразеологизма ВЫВОДИТЬ НА ЧИСТУЮ ВОДУ. Опишите ситуацию (2 предл.), где уместно его употребление. Включите фразеологизм в одно из предложений.', E'Значение: разоблачать чьи-либо тёмные дела, неблаговидные поступки, выявлять правду.\nСитуация: Директор долго не мог понять, кто портит школьное имущество. Но запись с камеры видеонаблюдения помогла вывести хулигана на чистую воду.', 14)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, '[Значение объяснено, ситуация описана, фразеологизм включен]', true);

    ELSE
        RAISE NOTICE 'Subject "Русский язык" not found. Skipping Variant %.', v_num;
    END IF;
END $$;
