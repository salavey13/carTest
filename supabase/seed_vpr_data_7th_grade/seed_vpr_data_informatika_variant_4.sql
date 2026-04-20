DO $$
DECLARE
  subj_info_7_id INT;
  q_id INT;
  variant_num INT := 4;
BEGIN
  INSERT INTO public.subjects (name, grade_level, description)
  VALUES ('Информатика', 7, 'ВПР 7 класс: алгоритмы, сети, кодирование, логика')
  ON CONFLICT (name, grade_level) DO NOTHING;
  SELECT id INTO subj_info_7_id FROM public.subjects WHERE name='Информатика' AND grade_level=7;
  IF subj_info_7_id IS NULL THEN RETURN; END IF;

  DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id=subj_info_7_id AND variant_number=variant_num);
  DELETE FROM public.vpr_questions WHERE subject_id=subj_info_7_id AND variant_number=variant_num;

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Что такое блок-схема?', E'Блок-схема — графическое представление алгоритма с шагами и стрелками.', 1)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES
  (q_id,'Графический план алгоритма',true),(q_id,'Таблица умножения',false),(q_id,'Тип файла',false),(q_id,'Антивирус',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Сколько бит нужно минимум, чтобы закодировать 8 разных символов?', E'Нужно найти 2^n >= 8. 2^3 = 8, значит достаточно 3 бит.', 2)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'3',true),(q_id,'8',false),(q_id,'2',false),(q_id,'4',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data) VALUES
  (subj_info_7_id, variant_num, E'По диаграмме выбери месяц, где ошибок в коде было меньше всего.', E'Минимальный столбец у "Март" (2 ошибки).', 3,
  '{"type":"chart","chartType":"bar","title":"Ошибки в коде","labels":["Янв","Фев","Март","Апр"],"data":[8,5,2,4]}'::jsonb)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'Март',true),(q_id,'Янв',false),(q_id,'Фев',false),(q_id,'Апр',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Что означает HTTP?', E'HTTP — протокол передачи гипертекста, основа обмена данными в вебе.', 4)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES
  (q_id,'Протокол передачи веб-страниц',true),(q_id,'Имя браузера',false),(q_id,'Формат картинки',false),(q_id,'Тип пароля',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Какой вариант — хорошее правило кибербезопасности?', E'Нельзя сообщать пароль и код подтверждения даже "службе поддержки" в чате.', 5)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES
  (q_id,'Не передавать пароль никому',true),(q_id,'Один пароль для всех сайтов',false),(q_id,'Скачивать всё подряд',false),(q_id,'Выключить обновления',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data) VALUES
  (subj_info_7_id, variant_num, E'По таблице выбери устройство ввода.', E'Клавиатура и мышь — устройства ввода. Правильный ответ: клавиатура.', 6,
  '{"type":"table","title":"Устройства ПК","headers":["Устройство","Категория"],"rows":[["Клавиатура","Ввод"],["Монитор","Вывод"],["Принтер","Вывод"]]}'::jsonb)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES
  (q_id,'Клавиатура',true),(q_id,'Монитор',false),(q_id,'Принтер',false),(q_id,'Колонки',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Что такое "облако" в ИТ?', E'Облако — это удалённые серверы, где можно хранить данные и работать с ними через интернет.', 7)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'Удалённое хранение и сервисы',true),(q_id,'Вид вируса',false),(q_id,'Сломанный жесткий диск',false),(q_id,'Кнопка в браузере',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Какой тип данных хранит только "да/нет"?', E'Логический (boolean) тип имеет два значения: true/false (да/нет).', 8)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'Логический',true),(q_id,'Текстовый',false),(q_id,'Числовой',false),(q_id,'Табличный',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Какой оператор в Python отвечает за цикл с диапазоном?', E'Обычно используют for ... in range(...).', 9)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'for',true),(q_id,'if',false),(q_id,'print',false),(q_id,'def',false);

  INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position) VALUES
  (subj_info_7_id, variant_num, E'Что произойдёт: if 4 > 7: print("ok") else: print("no")?', E'Условие 4 > 7 ложно, поэтому выполнится ветка else и выведется "no".', 10)
  RETURNING id INTO q_id;
  INSERT INTO public.vpr_answers (question_id,text,is_correct) VALUES (q_id,'no',true),(q_id,'ok',false),(q_id,'4>7',false),(q_id,'ошибка',false);
END $$;
