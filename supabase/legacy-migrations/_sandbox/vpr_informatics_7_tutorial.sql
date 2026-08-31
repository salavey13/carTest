-- 1. Убедимся, что предмет 'Информатика' существует
INSERT INTO public.subjects (name, description, grade_level) VALUES
('Информатика', E'## ВПР по Информатике (7 класс)\n\nЦифровая грамотность, алгоритмы и... **Управление Реальностью**.\n\nЭтот раздел содержит секретные протоколы взаимодействия с системой **CyberVibe Studio**.\nПройди этот тест, чтобы получить доступ к инструментам Разработчика и научиться менять этот сайт силой мысли (и нейросетей).', 7)
ON CONFLICT (name, grade_level) DO NOTHING;

-- =============================================
-- === ВПР Информатика 7 класс, ВАРИАНТ 77 ===
-- === (Секретный туториал: Как менять контент) ===
-- =============================================
DO $$
DECLARE
    subj_info_7_id INT;
    q_id INT;
    variant_num INT := 77; -- Специальный номер варианта
BEGIN
    SELECT id INTO subj_info_7_id FROM public.subjects WHERE name = 'Информатика' AND grade_level = 7;

    IF subj_info_7_id IS NOT NULL THEN
        RAISE NOTICE 'Seeding Informatics 7th Grade Variant 77 (Cyber Studio Tutorial)...';

        -- Очистка предыдущих версий этого варианта
        DELETE FROM public.vpr_answers WHERE question_id IN (SELECT id FROM public.vpr_questions WHERE subject_id = subj_info_7_id AND variant_number = variant_num);
        DELETE FROM public.vpr_questions WHERE subject_id = subj_info_7_id AND variant_number = variant_num;

        -- ВОПРОС 1: Точка Входа
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_info_7_id, variant_num, E'Алгоритм изменения реальности начинается с инициализации интерфейса. \n\nКакой элемент интерфейса на этой странице (внизу слева) служит для вызова **Агента Изменений**?',
                E'**Ответ:** Кнопка с иконкой робота/искры.\n\n**Инструкция:**\n1. В левом нижнем углу экрана всегда висит круглая кнопка **Automation Buddy**.\n2. Нажми на неё, чтобы открыть панель задач.\n3. Это твой прямой канал связи с ядром системы.', 1,
                '{ "type": "image", "url": "https://placehold.co/400x200/101010/00ff00?text=Кнопка+Buddy", "caption": "Интерфейс Агента", "alt": "Иконка робота в углу экрана" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Кнопка с роботом (Buddy)', true), (q_id, 'Меню "Пуск"', false), (q_id, 'Адресная строка браузера', false), (q_id, 'Кнопка выключения', false);

        -- ВОПРОС 2: Формулировка Задачи
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_info_7_id, variant_num, E'Вы открыли панель Агента. Вам нужно добавить новую секцию в шпаргалку. \nКакое действие в алгоритме является следующим шагом?',
                E'**Инструкция:**\n1. В поле ввода напиши свою идею. Например: *"Добавь секцию про язык Python с примерами кода"*.\n2. Система поймет, на какой странице ты находишься.\n3. Появится кнопка **"В Студию!"** (To Studio). Нажми её.', 2) RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Вписать идею и нажать "В Студию!"', true), (q_id, 'Написать код вручную', false), (q_id, 'Позвонить учителю', false), (q_id, 'Перезагрузить компьютер', false);

        -- ВОПРОС 3: Процесс Передачи Данных (Экстракция)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_info_7_id, variant_num, E'После нажатия кнопки "В Студию!" система автоматически перенаправляет вас в `/repo-xml`. \n\nЧто происходит с исходным кодом текущей страницы в этот момент?',
                E'**Магия автоматизации:**\nСистема автоматически находит файл этой страницы (например, `page.tsx`) в репозитории GitHub, скачивает его код и добавляет его в контекст. Тебе не нужно искать файлы вручную — **Экстрактор** делает это за тебя.', 3,
                '{ "type": "image", "url": "https://placehold.co/600x300/0a0a0a/3b82f6?text=Скачивание+файла...", "caption": "Процесс Fetching", "alt": "Загрузка кода из GitHub" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Автоматически скачивается и добавляется в контекст', true), (q_id, 'Удаляется с сервера', false), (q_id, 'Превращается в двоичный код', false), (q_id, 'Отправляется по почте', false);

        -- ВОПРОС 4: Нейро-Лингвистическое Программирование (LLM)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_info_7_id, variant_num, E'Вы находитесь в Студии. Контекст собран. Сгенерирован **Промпт** (запрос). \nКаков протокол взаимодействия с Внешним Интеллектом (AI)?',
                E'**Протокол моста:**\n1. Нажми кнопку **"Копировать"** в Студии (чтобы взять промпт).\n2. Открой своего AI-бота (ссылка есть внизу страницы Студии в разделе "Инструменты").\n3. Вставь промпт боту.\n4. Бот напишет код. **Скопируй ответ бота целиком** (Markdown).\n5. Вернись в Студию и вставь ответ в поле "Ответ AI".', 4) RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Копировать Промпт -> Бот -> Вставить Ответ', true), (q_id, 'Придумать код самому', false), (q_id, 'Нажать "Выполнить" без бота', false), (q_id, 'Ждать, пока бот сам придет', false);

        -- ВОПРОС 5: Компиляция и Деплой
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_info_7_id, variant_num, E'Ответ AI вставлен в Студию. Система готова к интеграции изменений. \nКакая последовательность действий завершает цикл обновления?',
                E'**Финал:**\n1. Нажми **"Разобрать ответ"** (стрелка ➡️). Система проверит код на ошибки.\n2. Если всё ок, нажми большую зеленую кнопку **"Создать PR / Обновить"**.\n3. **Жди 5 минут.** Сервер (Vercel) пересоберет сайт, и твоя новая шпаргалка появится в интернете для всех!', 5,
                '{ "type": "image", "url": "https://placehold.co/600x200/052e16/22c55e?text=Кнопка+PR+READY", "caption": "Финальный шаг", "alt": "Зеленая кнопка Merge" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Разобрать -> Создать PR -> Ждать 5 мин', true), (q_id, 'Выключить компьютер', false), (q_id, 'Нажать Ctrl+S', false), (q_id, 'Переустановить Windows', false);

        -- ВОПРОС 6: Продвинутый уровень (Добавление страниц)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_info_7_id, variant_num, E'**Задача со звездочкой (*):**\nВы хотите не просто изменить текст, а добавить **совершенно новую шпаргалку** (новую страницу).\n\nКак сообщить Студии, что нужно добавить ссылку на эту новую страницу в главное меню?',
                E'**Хакерский уровень:**\n1. Когда ты нажимаешь "В Студию!" с главной страницы, загружается только эта страница.\n2. Чтобы добавить ссылку в меню, нужно в Студии в поле "Путь к файлу" (сверху) добавить файл списка тестов: `app/vpr-tests/page.tsx`.\n3. Нажми **"+"** (Добавить). Теперь AI видит и новую страницу, и меню, и сможет связать их ссылкой.', 6,
                '{ "type": "image", "url": "https://placehold.co/600x300/1e1b4b/a78bfa?text=app/vpr-tests/page.tsx", "caption": "Файл меню", "alt": "Структура файлов" }') RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (q_id, 'Добавить файл меню в контекст Студии', true), (q_id, 'Создать новую папку на рабочем столе', false), (q_id, 'Написать администратору', false), (q_id, 'Это невозможно', false);

    END IF;
END $$;