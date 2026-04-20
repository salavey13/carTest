DO $$
DECLARE
  subj_info_7_id INT;
  q_id INT;
  variant_num INT := 3;
BEGIN
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('Информатика', 7, 'ВПР 7 класс: алгоритмы, сети, кодирование, логика')
  ON CONFLICT (name, grade_level) DO NOTHING;
  SELECT id INTO subj_info_7_id FROM public.subjects WHERE name = 'Информатика' AND grade_level = 7;
  IF subj_info_7_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id=subj_info_7_id AND variant_number=variant_num);
  DELETE FROM public.vpr_questions WHERE subject_id=subj_info_7_id AND variant_number=variant_num;

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Какой алгоритм можно назвать линейным?', E'Линейный алгоритм — когда шаги выполняются по порядку без ветвлений и циклов.', 1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
  (q_id,'Открыть файл → прочитать → закрыть',true),(q_id,'Если дождь — взять зонт',false),(q_id,'Повторять пока не найдёшь',false),(q_id,'Случайный выбор шага',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Переведи 1 Кбайт в байты (школьный стандарт).', E'В школьных задачах обычно 1 Кбайт = 1024 байта.', 2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'1024',true),(q_id,'1000',false),(q_id,'8',false),(q_id,'512',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data) VALUES
  (subj_info_7_id, variant_num, E'По диаграмме выбери приложение, которое использовали чаще всего.', E'Самый большой сектор у "Браузер" — значит его использовали чаще других.', 3,
  '{"type":"chart","chartType":"pie","title":"Использование программ","labels":["Браузер","Текст","Таблицы","Графика"],"data":[45,25,20,10]}'::jsonb)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'Браузер',true),(q_id,'Графика',false),(q_id,'Таблицы',false),(q_id,'Текст',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Что такое браузер?', E'Браузер — программа для просмотра веб-страниц в интернете.', 4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'Программа для сайтов',true),(q_id,'Антивирус',false),(q_id,'Операционная система',false),(q_id,'Архиватор',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Для чего нужна двухфакторная аутентификация?', E'2FA добавляет второй шаг входа (код/подтверждение), чтобы защитить аккаунт.', 5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'Для усиления защиты аккаунта',true),(q_id,'Для ускорения интернета',false),(q_id,'Для удаления рекламы',false),(q_id,'Для сжатия файлов',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data) VALUES
  (subj_info_7_id, variant_num, E'По таблице выбери устройство хранения данных.', E'SSD и HDD — устройства хранения. Здесь правильный вариант: SSD.', 6,
  '{"type":"table","title":"Устройства","headers":["Название","Тип"],"rows":[["SSD","Хранение"],["CPU","Обработка"],["RAM","Память"]]}'::jsonb)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'SSD',true),(q_id,'CPU',false),(q_id,'Кулер',false),(q_id,'Монитор',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Какой символ используют для комментария в Python?', E'В Python однострочный комментарий начинается с #.', 7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'#',true),(q_id,'//',false),(q_id,'/*',false),(q_id,'--',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Что такое переменная?', E'Переменная — это имя, под которым хранится значение (число, текст и т.д.).', 8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'Ячейка для хранения значения',true),(q_id,'Готовая картинка',false),(q_id,'Тип вируса',false),(q_id,'Кнопка на клавиатуре',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Какое расширение обычно у текстового файла без форматирования?', E'Обычный текст без стилей — это .txt.', 9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'.txt',true),(q_id,'.mp3',false),(q_id,'.png',false),(q_id,'.exe',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Что выведет программа: x=5; x=x+2; print(x)?', E'Сначала x=5. Потом x становится 7. print выводит 7.', 10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'7',true),(q_id,'5',false),(q_id,'2',false),(q_id,'52',false);
END $$;
