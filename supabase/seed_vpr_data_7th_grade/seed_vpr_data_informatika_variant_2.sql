DO $$
DECLARE
  subj_info_7_id INT;
  q_id INT;
  variant_num INT := 2;
BEGIN
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('Информатика', 7, 'ВПР 7 класс: алгоритмы, сети, кодирование, логика')
  ON CONFLICT (name, grade_level) DO NOTHING;

  SELECT id INTO subj_info_7_id FROM public.subjects WHERE name = 'Информатика' AND grade_level = 7;

  IF subj_info_7_id IS NULL THEN
    RAISE NOTICE 'Subject not found';
    RETURN;
  END IF;

  DELETE FROM public.vpr_answers WHERE question_id IN (
    SELECT id FROM public.vpr_questions WHERE subject_id = subj_info_7_id AND variant_number = variant_num
  );
  DELETE FROM public.vpr_questions WHERE subject_id = subj_info_7_id AND variant_number = variant_num;

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_info_7_id, variant_num, E'Какой порядок действий в алгоритме "войти в почту" правильный?', E'Шаги должны идти так: 1) открыть сайт, 2) ввести логин, 3) ввести пароль, 4) нажать "Войти". Если перепутать шаги, вход не выполнится.', 1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, 'Открыть сайт → логин → пароль → Войти', true),
  (q_id, 'Пароль → логин → открыть сайт → Войти', false),
  (q_id, 'Войти → логин → пароль', false),
  (q_id, 'Открыть сайт → Войти', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_info_7_id, variant_num, E'Сколько бит в 2 байтах?', E'1 байт = 8 бит. Значит, 2 байта = 16 бит. Частая ошибка — путать бит и байт.', 2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, '16', true),(q_id, '2', false),(q_id, '8', false),(q_id, '24', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
  VALUES (subj_info_7_id, variant_num, E'Посмотри на диаграмму времени работы за ПК и ответь: в какой день времени больше всего?', E'На столбчатой диаграмме самый высокий столбец у "Чт" (4 часа). Значит, в четверг время максимальное.', 3,
    '{"type":"chart","chartType":"bar","title":"Время за ПК (часы)","labels":["Пн","Вт","Ср","Чт","Пт"],"data":[2,3,1,4,2],"colors":["#0ea5e9","#22c55e","#f59e0b","#ef4444","#a855f7"]}'::jsonb)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, 'Четверг', true),(q_id, 'Вторник', false),(q_id, 'Понедельник', false),(q_id, 'Пятница', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_info_7_id, variant_num, E'Какой адрес — это IP-адрес?', E'IP-адрес в IPv4 состоит из 4 чисел 0..255, разделённых точками. 192.168.1.10 подходит.', 4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, '192.168.1.10', true),(q_id, 'school.ru', false),(q_id, 'home_wifi', false),(q_id, 'A1:B2:C3', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_info_7_id, variant_num, E'Какой оператор сравнения означает "не равно" в большинстве языков?', E'Обычно "не равно" записывают как !=. Ошибка: путать с = (присваивание/равно).', 5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, '!=', true),(q_id, '==', false),(q_id, '=', false),(q_id, '=>', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
  VALUES (subj_info_7_id, variant_num, E'По таблице выбери самую безопасную комбинацию пароля.', E'Надёжный пароль длинный, с цифрами и спецсимволами. В таблице самый сильный — строка с длиной 12 и символами.', 6,
    '{"type":"table","title":"Оценка паролей","headers":["Пароль","Длина","Оценка"],"rows":[["qwerty","6","Слабый"],["Masha2026","9","Средний"],["K0t!Vpr#7Aa","12","Сильный"]]}'::jsonb)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, 'K0t!Vpr#7Aa', true),(q_id, 'qwerty', false),(q_id, 'Masha2026', false),(q_id, 'все одинаково', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_info_7_id, variant_num, E'Что делает цикл в программе?', E'Цикл повторяет действия несколько раз. Это нужно, когда шаги одинаковые.', 7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, 'Повторяет блок команд', true),(q_id, 'Удаляет файлы', false),(q_id, 'Меняет язык клавиатуры', false),(q_id, 'Выключает интернет', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_info_7_id, variant_num, E'Какой формат чаще всего используют для сжатых изображений с фото?', E'JPEG хорошо подходит для фотографий. PNG чаще для схем и картинок с прозрачностью.', 8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, 'JPEG', true),(q_id, 'TXT', false),(q_id, 'DOCX', false),(q_id, 'MP3', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_info_7_id, variant_num, E'Какой пункт — пример фишинга?', E'Фишинг — это поддельное сообщение, где выманивают пароль или код.', 9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, 'Письмо "Срочно введите пароль, иначе аккаунт удалится"', true),
  (q_id, 'Сообщение учителя в школьном чате', false),
  (q_id, 'Официальный вход через приложение', false),
  (q_id, 'Домашнее задание в дневнике', false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
  VALUES (subj_info_7_id, variant_num, E'Какой результат даст выражение: 3 * (2 + 4)?', E'Сначала скобки: 2 + 4 = 6. Потом умножение: 3 * 6 = 18. Ошибка — считать слева направо без скобок.', 10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id, '18', true),(q_id, '10', false),(q_id, '14', false),(q_id, '24', false);
END $$;
