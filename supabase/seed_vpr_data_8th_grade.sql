-- seed_vpr_data_8th_grade.sql — task212 (2026-11-26)
-- Пере-включение VPR-тестов для 8 класса: по дневнику 8 «Е» (edu.gounn.ru)
-- слабые зоны — Геометрия 2.0, Литература 2.0, Вероятность и статистика 2.0,
-- История 2.67, Русский 3.5 (Алгебра 2.25 уже была в БД, subject id=71).
-- Формат 1:1 с seed_vpr_data_informatika_variant_*.sql: subjects
-- ON CONFLICT DO NOTHING → вопрос → 4 ответа (is_correct ровно один).
-- Идемпотентно: перед вставкой вариант сносится (answers → questions).

DO $$
DECLARE
  subj_id INT;
  q_id INT;
BEGIN
  -- ═══════════════════ ГЕОМЕТРИЯ 8 ═══════════════════
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('Геометрия', 8, 'ВПР 8 класс: четырёхугольники, площади, теорема Пифагора, подобие')
  ON CONFLICT (name, grade_level) DO NOTHING;
  SELECT id INTO subj_id FROM public.subjects WHERE name = 'Геометрия' AND grade_level = 8;

  DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT id FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1);
  DELETE FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1;

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Сумма углов выпуклого четырёхугольника равна:', E'Проведи диагональ — она разобьёт четырёхугольник на 2 треугольника. Сумма углов каждого 180°, значит всего 180 + 180 = 360°.', 1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '360°', true), (q_id, '180°', false), (q_id, '540°', false), (q_id, '270°', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Катеты прямоугольного треугольника равны 6 и 8. Чему равна гипотенуза?', E'Теорема Пифагора: c² = a² + b² = 36 + 64 = 100, значит c = √100 = 10. Классическая тройка 6-8-10 (удвоенная 3-4-5).', 2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '10', true), (q_id, '14', false), (q_id, '100', false), (q_id, '48', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Диагонали ромба пересекаются под углом:', E'Диагонали ромба перпендикулярны (и делятся точкой пересечения пополам, и делят углы ромба пополам). Равны диагонали у прямоугольника, а не у ромба.', 3)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '90°', true), (q_id, '60°', false), (q_id, '45°', false), (q_id, '120°', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Площадь трапеции с основаниями 4 и 10 и высотой 5 равна:', E'S = ((a + b) / 2) · h = ((4 + 10) / 2) · 5 = 7 · 5 = 35. Полусумма оснований умножить на высоту.', 4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '35', true), (q_id, '70', false), (q_id, '50', false), (q_id, '20', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Средняя линия треугольника, параллельная стороне 12 см, равна:', E'Теорема о средней линии: она параллельна третьей стороне и равна её половине. 12 / 2 = 6 см.', 5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '6 см', true), (q_id, '12 см', false), (q_id, '24 см', false), (q_id, '4 см', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Площадь параллелограмма с основанием 9 и высотой 4 к этому основанию равна:', E'S = a · h = 9 · 4 = 36. Высота проводится именно к тому основанию, на которое умножаем.', 6)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '36', true), (q_id, '18', false), (q_id, '72', false), (q_id, '13', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Треугольники подобны с коэффициентом 2. Во сколько раз отличаются их площади?', E'Отношение площадей подобных фигур равно КВАДРАТУ коэффициента подобия: k² = 4. Классическая ловушка ВПР — отвечают 2.', 7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'В 4 раза', true), (q_id, 'В 2 раза', false), (q_id, 'В 8 раз', false), (q_id, 'Площади равны', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Гипотенуза прямоугольного треугольника равна 13, один катет 5. Второй катет равен:', E'Из теоремы Пифагора: b² = c² − a² = 169 − 25 = 144, значит b = 12. Пифагорова тройка 5-12-13.', 8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '12', true), (q_id, '8', false), (q_id, '18', false), (q_id, '144', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Какое свойство диагоналей есть ТОЛЬКО у прямоугольника (среди параллелограммов)?', E'У всех параллелограммов диагонали делятся пополам. У ромба — перпендикулярны. А вот РАВНЫ диагонали именно у прямоугольника.', 9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Диагонали равны', true), (q_id, 'Диагонали перпендикулярны', false), (q_id, 'Диагонали делят углы пополам', false), (q_id, 'Диагонали являются биссектрисами', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'В равнобедренной трапеции углы при каждом основании:', E'При каждом основании равнобедренной (равнобокой) трапеции углы равны. У произвольной трапеции это не так — ловушка варианта «всегда».', 10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Равны', true), (q_id, 'Прямые', false), (q_id, 'Составляют 270° в сумме', false), (q_id, 'Не равны', false);

  -- ═══════════════════ РУССКИЙ ЯЗЫК 8 ═══════════════════
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('Русский язык', 8, 'ВПР 8 класс: Н/НН, НЕ с частями речи, словосочетания, обособленные члены')
  ON CONFLICT (name, grade_level) DO NOTHING;
  SELECT id INTO subj_id FROM public.subjects WHERE name = 'Русский язык' AND grade_level = 8;

  DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT id FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1);
  DELETE FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1;

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'В каком слове пишется одна Н? (кован..ый / связа..ый / покраше..ый / стекля..ый)', E'КОВАНЫЙ — исключение (глагол несов. вида «ковать», без приставки и зависимых слов). Связанный (сов. вид), покрашенный (приставка), стеклянный (исключение -ЯНН) — везде НН.', 1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'кованый', true), (q_id, 'связанный', false), (q_id, 'покрашенный', false), (q_id, 'стеклянный', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Как пишется НЕ в предложении «Это была не правда, а ложь»?', E'Противопоставление с союзом А — НЕ всегда пишется раздельно с существительными: «не правда, а ложь».', 2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Раздельно', true), (q_id, 'Слитно', false), (q_id, 'Через дефис', false), (q_id, 'Зависит от ударения', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Вид связи в словосочетании «интересная книга»:', E'Прилагательное + существительное: зависимое слово согласуется в роде, числе, падеже — это согласование. «Читать книгу» — управление, «внимательно читать» — примыкание.', 3)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Согласование', true), (q_id, 'Управление', false), (q_id, 'Примыкание', false), (q_id, 'Сочинительная связь', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Нужно ли обособлять «убежавший из дома» в предложении «Мальчик убежавший из дома вернулся через час»?', E'Причастный оборот после определяемого слова обособляется: «Мальчик, убежавший из дома, вернулся…». Запятые с двух сторон.', 4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Да, с двух сторон', true), (q_id, 'Нет, не обособляется', false), (q_id, 'Только перед ним', false), (q_id, 'Только после него', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Деепричастный оборот в предложении:', E'Деепричастные обороты обособляются ВСЕГДА, где бы ни стояли: «Улыбаясь, он протянул руку» / «Он, улыбаясь, протянул руку» / «Он протянул руку, улыбаясь».', 5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Обособляется всегда', true), (q_id, 'Обособляется только в начале', false), (q_id, 'Обособляется только в конце', false), (q_id, 'Не обособляется никогда', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Как пишется НЕ с кратким причастием «окно (не) вымыто»?', E'Краткие причастия с НЕ пишутся ТОЛЬКО раздельно: «окно не вымыто». Сравни с кратким прилагательным «окно неотразимо красиво» — там слитно (можно заменить синонимом).', 6)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Раздельно', true), (q_id, 'Слитно', false), (q_id, 'Через дефис', false), (q_id, 'Зависит от ударения', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Сколько Н в слове «ране..ый в бою солдат»?', E'С зависимым словом «в бою» причастие от «ранить» пишется с НН: раненный в бою. Без зависимых слов — исключение «раненый» с одной Н.', 7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'НН', true), (q_id, 'Н', false), (q_id, 'Зависит от рода', false), (q_id, 'Пишется через дефис', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Вид связи в словосочетании «говорить правду»:', E'От глагола ставится вопрос «что?» — винительный падеж: управление. Главное слово требует определённой формы зависимого.', 8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Управление', true), (q_id, 'Согласование', false), (q_id, 'Примыкание', false), (q_id, 'Связи нет', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Какое сочетание слов не является словосочетанием?', E'Словосочетание = два и более самостоятельных слова, связанных ПОДЧИНИТЕЛЬНОЙ связью. Подлежащее + сказуемое («день настал») — это грамматическая основа, а не словосочетание.', 9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'День настал', true), (q_id, 'Наступил тихий день', false), (q_id, 'Тихо наступил', false), (q_id, 'День окончания каникул', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Найдите предложение с пунктуационной ошибкой:', E'Обращение выделяется запятыми ВСЕГДА: правильно «Слушай, брат, пойдём домой». Обособленное определение после определяемого слова тоже требует запятых.', 10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Слушай брат пойдём домой', true), (q_id, 'Слушай, брат, пойдём домой', false), (q_id, 'Слушай, брат, — пойдём домой', false), (q_id, 'Брат, слушай: пойдём домой', false);

  -- ═══════════════════ ИСТОРИЯ 8 ═══════════════════
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('История', 8, 'ВПР 8 класс: Россия в XIX веке — войны, декабристы, великие реформы')
  ON CONFLICT (name, grade_level) DO NOTHING;
  SELECT id INTO subj_id FROM public.subjects WHERE name = 'История' AND grade_level = 8;

  DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT id FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1);
  DELETE FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1;

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Бородинское сражение состоялось:', E'26 августа (7 сентября) 1812 года — главная битва Отечественной войны. Наполеон занял Москву, но разгромить русскую армию не смог.', 1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'В 1812 году', true), (q_id, 'В 1805 году', false), (q_id, 'В 1814 году', false), (q_id, 'В 1825 году', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Восстание декабристов произошло:', E'14 декабря 1825 года на Сенатской площади в Петербурге. Повод — междуцарствие после смерти Александра I, цель — отменить самодержавие и крепостное право.', 2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '14 декабря 1825 года', true), (q_id, '19 февраля 1861 года', false), (q_id, '1 марта 1881 года', false), (q_id, '14 декабря 1824 года', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Автор «Русской правды» — радикальной программы Южного общества:', E'П. И. Пестель предлагал республику и единую неделимую державу. Н. Муравьёв (Северное общество, «Конституция») — конституционную монархию и федерацию.', 3)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'П. И. Пестель', true), (q_id, 'Н. М. Муравьёв', false), (q_id, 'К. Ф. Рылеев', false), (q_id, 'С. П. Трубецкой', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Крепостное право в России отменил(а):', E'Манифест 19 февраля 1861 года, Александр II — «Царь-Освободитель». Крестьяне стали лично свободны, но землю выкупали 49 лет.', 4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Александр II в 1861 году', true), (q_id, 'Александр I в 1803 году', false), (q_id, 'Николай I в 1837 году', false), (q_id, 'Александр III в 1881 году', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Земская реформа и судебная реформа проведены в:', E'Обе в 1864 году. Земства — выборное местное самоуправление; суд — гласный, состязательный, с присяжными заседателями.', 5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '1864 году', true), (q_id, '1861 году', false), (q_id, '1874 году', false), (q_id, '1870 году', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Военную реформу (всеобщая воинская повинность вместо рекрутчины) провёл(а):', E'Реформа 1874 года при Александре II (проект Д. А. Милютина): служить стали все мужчины с 21 года, срок по жребию — 6 лет сухопутных войск.', 6)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Военная реформа 1874 года', true), (q_id, 'Табель о рангах 1722 года', false), (q_id, 'Реформа С. Ю. Витте 1897 года', false), (q_id, 'Контрреформа Александра III', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'1 марта 1881 года в России:', E'Народовольцы убили Александра II взрывом на набережной Екатерининского канала. Началась эпоха контрреформ Александра III.', 7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Убит Александр II', true), (q_id, 'Отменено крепостное право', false), (q_id, 'Создан Государственный совет', false), (q_id, 'Началась Крымская война', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'«Временнообязанные крестьяне» после 1861 года — это:', E'До заключения выкупной сделки крестьяне обязаны были нести прежние повинности (оброк/барщину) — отсюда «временнообязанные». Полностью выкупная операция закрыта лишь в 1906-07.', 8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Крестьяне, обязанные нести повинности до полного выкупа земли', true),
    (q_id, 'Крестьяне, получившие землю бесплатно', false),
    (q_id, 'Городские рабочие на заводах', false),
    (q_id, 'Разряд государственных крестьян Сибири', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'С. Ю. Витте вошёл в историю как:', E'Министр финансов конца XIX века: индустриализация, винная монополия, золотое обеспечение рубля (1897), Транссиб. Не путать с реформаторами 1860-х.', 9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Министр финансов, введший золотой рубль', true),
    (q_id, 'Организатор суда присяжных', false),
    (q_id, 'Руководитель Северного общества', false),
    (q_id, 'Герой Бородинского сражения', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Эпоха «великих реформ» связана с царствованием:', E'Александр II (1855–1881): отмена крепостного права, земская, судебная, военная, городская реформы. Его называли «Царь-Освободитель».', 10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Александра II', true), (q_id, 'Александра I', false), (q_id, 'Николая I', false), (q_id, 'Александра III', false);

  -- ═══════════════════ ЛИТЕРАТУРА 8 ═══════════════════
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('Литература', 8, 'ВПР 8 класс: средства выразительности, анализ текста, произведения XIX века')
  ON CONFLICT (name, grade_level) DO NOTHING;
  SELECT id INTO subj_id FROM public.subjects WHERE name = 'Литература' AND grade_level = 8;

  DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT id FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1);
  DELETE FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1;

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'«Ветер по морю гуляет и кораблик подгоняет» — какой приём использован?', E'Олицетворение: ветер наделён действиями живого существа (гуляет, подгоняет). Пушкин, «Сказка о царе Салтане».', 1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Олицетворение', true), (q_id, 'Сравнение', false), (q_id, 'Гипербола', false), (q_id, 'Анафора', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Эпиграфом «Капитанской дочки» Пушкин взял пословицу:', E'«Береги честь смолоду» — вся проблематика романа (честь против страха смерти: Гринёв перед Пугачёвым) задана этой пословицей.', 2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '«Береги честь смолоду»', true), (q_id, '«Без труда не вытащишь и рыбку из пруда»', false), (q_id, '«Слово не воробей»', false), (q_id, '«Один в поле не воин»', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'«Слово — полководец человечьей силы» (Маяковский) — это:', E'Метафора: скрытое сравнение без «как» — слово названо полководцем. Если бы было «слово, КАК полководец» — сравнение.', 3)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Метафора', true), (q_id, 'Сравнение', false), (q_id, 'Олицетворение', false), (q_id, 'Литота', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'«Горькая радость» — этот приём называется:', E'Оксюморон: соединение несоединимых по смыслу слов (горькая + радость). Ещё примеры: «живой труп», «звонкая тишина».', 4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Оксюморон', true), (q_id, 'Антитеза', false), (q_id, 'Эпитет', false), (q_id, 'Ирония', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Повтор одинаковых слов в начале строк («Не ветер бушует над бором, не с гор побежали ручьи…») — это:', E'Анафора (единоначатие): повтор «не… не…» в начале смежных строк. Если бы повтор был в КОНЦЕ строк — эпифора.', 5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Анафора', true), (q_id, 'Эпифора', false), (q_id, 'Рефрен', false), (q_id, 'Инверсия', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Кто произносит финальную реплику «Чему смеётесь? Над собою смеётесь!» в «Ревизоре»?', E'Городничий — в немой сцене, обращаясь к залу. Гоголь адресовал её зрителям: смех над своими пороками.', 6)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Городничий', true), (q_id, 'Хлестаков', false), (q_id, 'Осип', false), (q_id, 'Земляника', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Жанр «Мцыри» Лермонтова:', E'Романтическая поэма: исповедь героя, три дня побега как вся жизнь, кавказский колорит. Не путать с романом в стихах «Евгений Онегин».', 7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Поэма', true), (q_id, 'Роман', false), (q_id, 'Поэма-баллада', false), (q_id, 'Элегия', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Что такое композиция произведения?', E'Композиция — строение, последовательность частей: экспозиция → завязка → развитие → кульминация → развязка. Сюжет — сами события, композиция — их порядок.', 8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Построение произведения, порядок его частей', true),
    (q_id, 'Главная мысль произведения', false),
    (q_id, 'Краткое содержание', false),
    (q_id, 'Совокупность действующих лиц', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'«Обломовщина» в романе Гончарова — это:', E'Апатия, лень, страх перед переменами и деятельностью — диагноз, поставленный Штольцем. Слово стало нарицательным ещё при жизни автора.', 9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Апатия и бездеятельность как образ жизни', true),
    (q_id, 'Дворянская щедрость', false),
    (q_id, 'Верность дружбе', false),
    (q_id, 'Сельское хозяйство Обломовки', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Пушкин о пугачёвском бунте в «Капитанской дочке»:', E'Эпиграф к главе «Бунт»: «Не приведи Бог видеть русский бунт, бессмысленный и беспощадный». Пугачёв показан двойственно: жесток и одновременно великодушен.', 10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '«Бессмысленный и беспощадный»', true),
    (q_id, '«Славная страница истории»', false),
    (q_id, '«Справедливый суд народа»', false),
    (q_id, '«Бунт против иноземных захватчиков»', false);

  -- ═══════════════════ ВЕРОЯТНОСТЬ И СТАТИСТИКА 8 ═══════════════════
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('Вероятность и статистика', 8, 'ВПР 8 класс: вероятность, средние значения, медиана, чтение диаграмм')
  ON CONFLICT (name, grade_level) DO NOTHING;
  SELECT id INTO subj_id FROM public.subjects WHERE name = 'Вероятность и статистика' AND grade_level = 8;

  DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT id FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1);
  DELETE FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1;

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'В коробке 4 красных и 6 синих шаров. Вероятность вытащить красный:', E'P = благоприятные / все = 4 / 10 = 0,4. Формула классической вероятности: m/n.', 1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '0,4', true), (q_id, '0,6', false), (q_id, '4', false), (q_id, '0,5', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Вероятность события, которое наверняка наступит, равна:', E'Достоверное событие: P = 1. Невозможное: P = 0. Все прочие вероятности лежат строго между 0 и 1.', 2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '1', true), (q_id, '0', false), (q_id, '0,5', false), (q_id, '100', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Монета 5 раз подряд выпала орлом. Вероятность решки в 6-м броске:', E'Ошибка игрока: у монеты нет памяти, броски независимы. Вероятность по-прежнему 1/2, сколько бы орлов ни было до этого.', 3)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '1/2', true), (q_id, 'Больше 1/2', false), (q_id, 'Меньше 1/2', false), (q_id, '6/5', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Вероятность сдать экзамен 0,7. Вероятность НЕ сдать:', E'Противоположные события: P(не сдать) = 1 − 0,7 = 0,3. Сумма вероятностей противоположных событий всегда равна 1.', 4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '0,3', true), (q_id, '0,7', false), (q_id, '0,5', false), (q_id, '1,7', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Ряд: 2, 4, 4, 7, 13. Чему равна медиана?', E'Ряд уже упорядочен, нечётное число элементов — медиана равна центральному: 4. Среднее арифметическое здесь 6 — оно больше из-за выброса 13.', 5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '4', true), (q_id, '6', false), (q_id, '7', false), (q_id, '5', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Ряд: 1, 3, 5, 9. Чему равна медиана?', E'Чётное число элементов: медиана = среднее двух центральных = (3 + 5) / 2 = 4. Ловушка — назвать 3 или 5.', 6)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '4', true), (q_id, '3', false), (q_id, '5', false), (q_id, '4,5', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'В отделе 5 человек получают по 40 тыс., директор — 400 тыс. Какая характеристика лучше описывает «типичную» зарплату?', E'Среднее = 100 тыс. (сдвинуто выбросом), медиана = 40 тыс. Медиана устойчива к выбросам — поэтому она здесь честнее.', 7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Медиана', true), (q_id, 'Среднее арифметическое', false), (q_id, 'Размах', false), (q_id, 'Наибольшее значение', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Что такое мода ряда чисел?', E'Мода — наиболее часто встречающееся значение. В ряду 2, 4, 4, 7, 13 мода = 4. Моды может не быть (все значения по одному разу) или быть несколько.', 8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Самое частое значение', true), (q_id, 'Центральное значение', false), (q_id, 'Среднее всех значений', false), (q_id, 'Разница max и min', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Игральный кубик бросают один раз. Вероятность выпадения числа больше 4:', E'Благоприятные исходы: 5 и 6 (два из шести). P = 2/6 = 1/3.', 9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '1/3', true), (q_id, '1/6', false), (q_id, '1/2', false), (q_id, '2/3', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1, E'Размах ряда 12, 5, 8, 17, 3 равен:', E'Размах = max − min = 17 − 3 = 14. Показывает «разброс» данных.', 10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '14', true), (q_id, '20', false), (q_id, '9', false), (q_id, '17', false);
END $$;
