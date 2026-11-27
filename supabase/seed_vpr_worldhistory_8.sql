-- seed_vpr_worldhistory_8.sql — task219 (2026-11-27)
-- Всеобщая история (Новое время, XVIII век) — 1-е полугодие 8 класса.
-- Основа: официальный формат ВПР-8 (часть 1 — Новое время: «запишите термин
-- по определению», соответствия) + перечень устных билетов всеобщей истории
-- 8 кл (XVIII в., classic-licey-samara.ru). ПО ЗАПРОСУ БОССА: меньше дат,
-- больше определений — 9 из 10 вопросов на понятия, одна дата (штурм
-- Бастилии) как обязательный маркер революции.
-- АНТИ-ХАК task219: правильные ответы на РАЗНЫХ позициях вставки (1..4) —
-- на фронте всё равно шафлится (splitmix32), но и в сыром БД-порядке
-- паттерна «первый всегда верный» больше нет.

DO $$
DECLARE
  subj_id INT;
  q_id INT;
BEGIN
  -- ═══════════════════ ВСЕОБЩАЯ ИСТОРИЯ 8 ═══════════════════
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('Всеобщая история', 8, 'ВПР 8 класс (1-е полугодие): Новое время XVIII в. — Просвещение, промышленный переворот, США, Франция, Восток')
  ON CONFLICT (name, grade_level) DO NOTHING;
  SELECT id INTO subj_id FROM public.subjects WHERE name = 'Всеобщая история' AND grade_level = 8;

  DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT id FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1);
  DELETE FROM public.vpr_questions WHERE subject_id = subj_id AND variant_number = 1;

  -- Q1 «термин по определению»: мануфактура (правильный на позиции 2)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Запишите термин, о котором идёт речь: «Предприятие, основанное на ручном труде работников, на котором существует разделение труда на отдельные производственные операции».',
    E'Маркеры определения: РУЧНОЙ труд + РАЗДЕЛЕНИЕ операций — это мануфактура. Когда труд заменяется машинами, предприятие становится фабрикой.',
    1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'фабрика', false), (q_id, 'мануфактура', true), (q_id, 'гильдия', false), (q_id, 'цех', false);

  -- Q2 «термин по определению»: метрополия (позиция 3)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Запишите термин: «Государство, владеющее колониями и управляющее ими в своих интересах».',
    E'Колония — управляемая территория, метрополия — управляющий «центр». Для британских колоний в Северной Америке метрополией была Великобритания.',
    2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'колония', false), (q_id, 'протекторат', false), (q_id, 'метрополия', true), (q_id, 'доминион', false);

  -- Q3 «термин»: промышленный переворот (позиция 1)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Запишите термин: «Переход от ручного труда к машинному, от мануфактуры к фабрике».',
    E'Промышленный переворот начался в Англии во второй половине XVIII века: прялка «Дженни», паровая машина Уатта. Итог — фабрики, урбанизация, новые классы (буржуазия и пролетариат).',
    3)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'промышленный переворот', true), (q_id, 'аграрная революция', false), (q_id, 'разделение труда', false), (q_id, 'урбанизация', false);

  -- Q4 «термин»: луддиты (позиция 4)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Запишите термин: «Английские рабочие, разрушавшие машины на фабриках, считая их причиной безработицы».',
    E'Движение луддитов (1811–1813): против «механических ткачей». Даты помнить не нужно — достаточно, что это рабочие-разрушители машин в Англии времён переворота.',
    4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'чартисты', false), (q_id, 'якобинцы', false), (q_id, 'сипаи', false), (q_id, 'луддиты', true);

  -- Q5 «термин»: просвещённый абсолютизм (позиция 2)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Запишите термин: «Политика монархов XVIII века: реформы сверху в духе идей Просвещения при сохранении абсолютной власти».',
    E'Просвещённый абсолютизм = реформы СВЕРХУ + самодержавие. Фридрих II, Иосиф II, Екатерина II. Хак: если в определении «реформы» и «неограниченная власть» вместе — это он.',
    5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'абсолютизм', false), (q_id, 'просвещённый абсолютизм', true), (q_id, 'меркантилизм', false), (q_id, 'протекционизм', false);

  -- Q6 соответствие: мыслитель → идея (позиция 3)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Кто из философов-просветителей разработал идею разделения властей на законодательную, исполнительную и судебную?',
    E'Шарль Монтескьё, трактат «О духе законов»: власти должны сдерживать друг друга, иначе — тирания. Руссо — общественный договор и суверенитет народа, Вольтер — свобода слова, Дидро — «Энциклопедия».',
    6)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'Жан-Жак Руссо', false), (q_id, 'Вольтер', false), (q_id, 'Шарль Монтескьё', true), (q_id, 'Дени Дидро', false);

  -- Q7 понятие: буржуазия (позиция 1)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Кого называли буржуазией?',
    E'Буржуазия — класс владельцев капитала: фабрикантов, банкиров, торговцев. Во Франции входила в третье сословие (платила налоги, прав не имела) — отсюда её революционность. Противоположность — пролетариат, класс наёмных рабочих.',
    7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'владельцев капитала, предприятий, банков — фабрикантов и торговцев', true),
    (q_id, 'наёмных рабочих, продающих свой труд', false),
    (q_id, 'крестьян, обрабатывающих землю феодала', false),
    (q_id, 'духовенство и дворянство с привилегиями', false);

  -- Q8 формулировка-причина: лозунг США (позиция 4)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Лозунг «Никаких налогов без представительства!» родился в борьбе:',
    E'Британские колонии в Северной Америке платили налоги метрополии (гербовый сбор, чай), но не имели представителей в парламенте. Итог — Бостонское чаепитие, война за независимость и Декларация 1776 года.',
    8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'французского третьего сословия с королём', false),
    (q_id, 'луддитов с фабрикантами', false),
    (q_id, 'Пруссии с Австрией', false),
    (q_id, 'британских колоний в Северной Америке с метрополией', true);

  -- Q9 единственная дата (маркер революции): Бастилия (позиция 2)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Штурм Бастилии — начало Великой французской революции — произошёл:',
    E'14 июля 1789 года; национальный праздник Франции. Королевская тюрьма-крепость — символ абсолютизма. Далее: Декларация прав человека и гражданина, конец абсолютизма, казнь Людовика XVI.',
    9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, '4 июля 1776 года', false), (q_id, '14 июля 1789 года', true), (q_id, '14 декабря 1825 года', false), (q_id, '1 мая 1848 года', false);

  -- Q10 Восток: сипаи (позиция 3)
  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_id, 1,
    E'Запишите термин: «Наёмные индийские солдаты на службе британской Ост-Индской компании».',
    E'Сипаи — индийские наёмники британской колониальной армии. Аналогии Востока: янычары (Османская империя), самураи (Япония). Колонизация Индии шла через такие войска.',
    10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
    (q_id, 'самураи', false), (q_id, 'янычары', false), (q_id, 'сипаи', true), (q_id, 'богдыхан', false);

END $$;
