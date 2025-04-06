-- ======================================================================
-- SQL Script for English VPR Variant 2 (Grade 6)
-- Subject ID: 38
-- Questions: 1015-1020
-- Updates vpr_questions with detailed text, explanations, visual_data.
-- Updates original correct vpr_answers rows.
-- Deletes old consolidated answer for Task 3 and inserts individual options.
-- ======================================================================

BEGIN; -- Start transaction

-- --- Task 1 (Listening Matching - ID 1015) ---

UPDATE public.vpr_questions
SET
    subject_id = 38,
    text = $$**Задание 1.**

Вы услышите 5 коротких высказываний людей (A, B, C, D, E) о своих хобби. Установите соответствие между высказываниями каждого говорящего и утверждениями из списка (1-6). Используйте каждое утверждение **только один раз**. В списке есть **одно лишнее** утверждение. Вы услышите запись дважды. Занесите свои ответы в таблицу.

**[AUDIO_FLAG: /audio/eng_vpr_g6_v2_task1.mp3]**

**Утверждения:**

1.  The speaker enjoys collecting things.
2.  The speaker likes being active outdoors.
3.  The speaker is fond of reading books.
4.  The speaker loves playing musical instruments.
5.  The speaker spends time drawing and painting.
6.  The speaker likes cooking simple dishes.

**Таблица для ответов:**

| Говорящий | A | B | C | D | E |
| :-------- | :-: | :-: | :-: | :-: | :-: |
| Утверждение |   |   |   |   |   |$$,
    explanation = $$**Транскрипт Аудио:**

**(Начало записи)**

**Narrator:** Now we are ready to start.

**Speaker A:** I have many colourful stamps from different countries. My uncle travels a lot and always brings me new ones. I keep them in a special album. It's fascinating to see pictures of places far away.

**Speaker B:** My favourite thing to do is go to the park with my friends. We often ride our bikes or play football. When the weather is good, we can spend the whole afternoon outside. It's much better than sitting at home.

**Speaker C:** After school, I love to sit in my comfortable chair with a good story. Adventures, fantasy, detectives – I like them all! Books take me to different worlds and times. I visit the library every week.

**Speaker D:** My parents gave me a guitar for my birthday last year. I take lessons twice a week. It was difficult at first, but now I can play a few songs. My favourite is 'Twinkle, Twinkle, Little Star'!

**Speaker E:** I find colours and shapes really interesting. I have pencils, crayons, and paints. I often draw animals or flowers. My art teacher says I am getting better and better. Maybe one day I'll be an artist.

**Narrator:** You have 15 seconds to complete the task. (Pause 15 seconds) Now you will hear the texts again. (Repeat texts) This is the end of the task. You now have 15 seconds to check your answers. (Pause 15 seconds)

**(Конец записи)**

---
**Ключ к заданию:**
Правильная последовательность утверждений для говорящих A-E: 1, 2, 3, 4, 5.
Лишнее утверждение: 6.
**Ключ: A-1, B-2, C-3, D-4, E-5**$$,
    visual_data = '{"audio_path": "/audio/eng_vpr_g6_v2_task1.mp3"}'::jsonb,
    variant_number = 2, -- Ensure variant number is set if not already
    position = 1       -- Ensure position is set if not already
WHERE id = 1015;

UPDATE public.vpr_answers
SET
    text = 'Ключ к заданию (см. объяснение вопроса)',
    is_correct = true -- Represents the correct outcome, not a selectable answer
WHERE id = 2904 AND question_id = 1015;


-- --- Task 2 (Reading Aloud - ID 1016) ---

UPDATE public.vpr_questions
SET
    subject_id = 38,
    text = $$**Задание 2.**

Прочитайте вслух текст о Лондоне. У вас есть 1,5 минуты на подготовку и 1,5 минуты, чтобы прочитать текст вслух.

---

**London Attractions**

London is the capital of Great Britain. It is a very big and exciting city with many interesting places to visit. One famous place is Buckingham Palace. This is where the Queen lives when she is in London. You can watch the Changing of the Guard ceremony there.

Another great place is the Tower of London. It is a very old castle by the River Thames. It has a long history and used to be a prison. Now, you can see the Crown Jewels there.

Don't forget to ride on the London Eye! It's a giant Ferris wheel that gives you amazing views of the city. You can see Big Ben and the Houses of Parliament from the top. London has something interesting for everyone.$$,
    explanation = $$**Оценка произношения проводится по следующим критериям:**
1.  **Фонетика:** Правильность произнесения звуков английского языка, отсутствие грубых фонетических ошибок, искажающих смысл.
2.  **Интонация:** Соблюдение интонационных контуров, характерных для английских повествовательных предложений. Правильная расстановка пауз и логических ударений.
3.  **Темп речи:** Чтение в естественном темпе, без необоснованных пауз и запинок.
4.  **Беглость:** Плавность речи.
(Максимальный балл обычно 2, снижается за ошибки)$$,
    visual_data = NULL,
    variant_number = 2,
    position = 2
WHERE id = 1016;

UPDATE public.vpr_answers
SET
    text = 'Оценивается произношение по критериям (см. объяснение вопроса)',
    is_correct = true -- Represents task completion/evaluation, not a choice
WHERE id = 2905 AND question_id = 1016;


-- --- Task 3 (Reading Comprehension MCQ - ID 1017) ---

UPDATE public.vpr_questions
SET
    subject_id = 38,
    text = $$**Задание 3.**

Прочитайте текст о животном по имени Лео. Определите, какие из приведённых утверждений (1–5) соответствуют содержанию текста (**A – True**), какие не соответствуют (**B – False**), и о чём в тексте не сказано, то есть на основании текста нельзя дать ни положительного, ни отрицательного ответа (**C – Not stated**). Выберите единственно верный вариант ответа (A, B или С) для каждого утверждения.

---

**Leo the Lion**

Leo is a young lion who lives on the big plains of Africa, called the savannah. He lives with his family: his mother, his father, his two sisters, and his brother. This family group is called a pride. Leo's father is the leader of the pride. He is very big and strong, with a large mane around his head.

Leo loves to play with his brother and sisters. They run, jump, and practice hunting small animals like mice, although they are not very good at it yet. Their mother teaches them important skills. She is a very good hunter and brings food for the cubs. Sometimes, Leo's father hunts too, especially for bigger animals like zebras.

During the hot part of the day, Leo and his family rest in the shade of a big acacia tree. They sleep a lot to save energy. When the sun goes down, it becomes cooler, and the lions become more active. Leo likes watching the colourful sunsets on the savannah. He hopes one day he will be as strong and brave as his father.

---

**Утверждения:**

1.  Leo lives in a jungle in Africa.
    A) True
    B) False
    C) Not stated

2.  Leo has three siblings in his pride.
    A) True
    B) False
    C) Not stated

3.  Leo's mother is the main hunter for the young cubs.
    A) True
    B) False
    C) Not stated

4.  Leo and his siblings are already experts at hunting zebras.
    A) True
    B) False
    C) Not stated

5.  Lions in Leo's pride sleep during the hottest time of the day.
    A) True
    B) False
    C) Not stated$$,
    explanation = $$**Ключ:**
1. B (False - He lives on the savannah, not a jungle: "lives on the big plains of Africa, called the savannah")
2. A (True - two sisters + one brother = three siblings: "his two sisters, and his brother")
3. A (True - "She is a very good hunter and brings food for the cubs")
4. B (False - They practice on small animals and are "not very good at it yet")
5. A (True - "During the hot part of the day, Leo and his family rest...")

**Примечание:** Ответы A/B/C для вопросов 1-5 хранятся как отдельные строки в таблице `vpr_answers`, связанные с ID вопроса 1017.$$,
    visual_data = NULL,
    variant_number = 2,
    position = 3
WHERE id = 1017;

-- Delete the old consolidated answer row for question 1017
DELETE FROM public.vpr_answers WHERE id = 2906 AND question_id = 1017;

-- Insert NEW answer options for EACH sub-question (15 rows total)
-- Let the database generate IDs automatically now.

-- Answers for Sub-Question 1 (Correct: B)
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '1. A) True', false);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '1. B) False', true);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '1. C) Not stated', false);

-- Answers for Sub-Question 2 (Correct: A)
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '2. A) True', true);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '2. B) False', false);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '2. C) Not stated', false);

-- Answers for Sub-Question 3 (Correct: A)
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '3. A) True', true);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '3. B) False', false);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '3. C) Not stated', false);

-- Answers for Sub-Question 4 (Correct: B)
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '4. A) True', false);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '4. B) False', true);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '4. C) Not stated', false);

-- Answers for Sub-Question 5 (Correct: A)
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '5. A) True', true);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '5. B) False', false);
INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES (1017, '5. C) Not stated', false);


-- --- Task 4 (Grammar Transformation - ID 1018) ---

UPDATE public.vpr_questions
SET
    subject_id = 38,
    text = $$**Задание 4.**

Прочитайте текст ниже. Преобразуйте слова, напечатанные заглавными буквами в конце строк, обозначенных номерами 1–5, так, чтобы они грамматически соответствовали содержанию текста. Заполните пропуски полученными словами.

---

**A Trip to the Zoo**

Last Saturday, my family and I decided to visit the city zoo. The weather was sunny and warm. We **(1)** ______ very excited.

First, we went to see the monkeys. They were **(2)** ______ than I expected, jumping and climbing everywhere! One little monkey made funny faces at us.

Then, we saw the elephants. They are the **(3)** ______ land animals in the world. An elephant drank water with its long trunk. It was amazing to watch.

My little sister **(4)** ______ photos of all the animals with her new camera. She said the penguins were her favourite.

We spent the whole day there. It was one of the **(5)** ______ days of our summer holidays. We really enjoyed our trip.

---
**(1)** BE
**(2)** ACTIVE
**(3)** LARGE
**(4)** TAKE
**(5)** GOOD$$,
    explanation = $$**Правильные формы слов:**
1. were (Past Simple of BE, plural subject 'We')
2. more active (Comparative adjective, two syllables ending in -ive)
3. largest (Superlative adjective, one syllable)
4. took (Past Simple of TAKE, action happened 'Last Saturday')
5. best (Superlative adjective, irregular 'good')$$,
    visual_data = NULL,
    variant_number = 2,
    position = 4
WHERE id = 1018;

UPDATE public.vpr_answers
SET
    text = 'Ключ к заданию (см. объяснение вопроса)',
    is_correct = true -- Represents the correct outcome
WHERE id = 2907 AND question_id = 1018;


-- --- Task 5 (Email Writing - ID 1019) ---

UPDATE public.vpr_questions
SET
    subject_id = 38,
    text = $$**Задание 5.**

Вы получили электронное письмо от вашего друга по переписке из Англии, Бена.

---
*From: Ben@email.uk*
*To: Russian_Friend@email.ru*
*Subject: My new pet!*

*Hi,*

*Guess what? I got a new pet yesterday! It’s a small hamster named Speedy. He’s very funny and likes running in his wheel.*

*What pets are popular in Russia? Do you have any pets? What pet would you like to have?*

*Write back soon!*

*Best wishes,*
*Ben*
---

Напишите Бену ответное письмо. В вашем ответе должно быть **60–80 слов**. Ответьте на **3 вопроса** Бена. Соблюдайте правила написания электронного письма.$$,
    explanation = $$**Образец ответа (Примерный - 73 слова):**

Subject: Re: My new pet!

Hi Ben,

Thanks for your email! Your hamster Speedy sounds really cute and funny!

Well, in Russia, cats and dogs are probably the most popular pets. Some people also keep parrots or fish in aquariums.

Yes, I have a pet! I have a lovely red cat named Ryzhik. He is very playful and sleeps a lot. If I could choose another pet, I think I would like to have a small, clever dog like a Jack Russell terrier.

Hope to hear from you soon!

Best wishes,
Alex

---
**Критерии оценки (Основные):**
*   **Содержание (Макс. 2-3 балла):** Дан полный ответ на все 3 вопроса Бена. Объем 60-80 слов соблюден.
*   **Организация (Макс. 2 балла):** Соблюден формат email (приветствие, ссылка на предыдущий контакт, ответы на вопросы, надежда на будущий контакт, прощание, подпись). Текст логичен, нет нарушений абзацного членения.
*   **Лексика и Грамматика (Макс. 2-3 балла):** Использована соответствующая лексика, грамматические ошибки не затрудняют понимание (допускается несколько негрубых ошибок).
*   **Орфография и Пунктуация (Макс. 2 балла):** Орфографические и пунктуационные ошибки минимальны или отсутствуют.$$,
    visual_data = NULL,
    variant_number = 2,
    position = 5
WHERE id = 1019;

UPDATE public.vpr_answers
SET
    text = 'Образец / Оценивается по критериям (см. объяснение вопроса)',
    is_correct = true -- Represents task completion/evaluation
WHERE id = 2908 AND question_id = 1019;


-- --- Task 6 (Picture Description Monologue - ID 1020) ---

UPDATE public.vpr_questions
SET
    subject_id = 38,
    text = $$**Задание 6.**

Выберите **одну** из трёх фотографий и опишите человека на ней. У вас есть 1,5 минуты на подготовку и не более 2 минут для ответа. У вас должен получиться связный рассказ (6–7 предложений).

**[IMAGE_FLAG: /img/eng_vpr_g6_v2_pic1.jpg]**
**[IMAGE_FLAG: /img/eng_vpr_g6_v2_pic2.jpg]**
**[IMAGE_FLAG: /img/eng_vpr_g6_v2_pic3.jpg]**

**План ответа:**

*   the place where the photo was taken
*   what the person is doing
*   what the person looks like
*   whether you like the picture or not
*   why you like/dislike the picture

Начинайте свой ответ фразой: **"I’d like to describe picture number ..."**$$,
    explanation = $$**Образец монолога (Picture 1 - Boy playing football):**

"I’d like to describe picture number 1.

(1) This photo was taken outside, maybe in a park or on a school sports ground because I can see green grass and goalposts in the background. (2) The main person in the picture is a boy, and he is playing football. He is running fast and is about to kick the ball. (3) The boy looks about 10 or 11 years old. He has short dark hair and is wearing a red football shirt, black shorts, and trainers. He seems very concentrated on the game. (4) I definitely like this picture. (5) I like it because it’s full of energy and action. It reminds me of playing football with my friends after school, which is always great fun." (6-7 sentences covered).

---
**Критерии оценки (Основные):**
*   **Содержание (Макс. 3 балла):** Раскрыты все 5 пунктов плана полно и точно. Объем 6-7 фраз достигнут.
*   **Организация (Макс. 2 балла):** Высказывание логично, использованы средства логической связи (e.g., 'because', 'and'). Есть вступительная фраза.
*   **Языковое оформление (Макс. 2 балла):** Использован соответствующий словарный запас, грамматические и фонетические ошибки не затрудняют понимание (допускается несколько негрубых ошибок).$$,
    visual_data = '{
        "image_paths": [
            "/img/eng_vpr_g6_v2_pic1.jpg",
            "/img/eng_vpr_g6_v2_pic2.jpg",
            "/img/eng_vpr_g6_v2_pic3.jpg"
        ]
    }'::jsonb,
    variant_number = 2,
    position = 6
WHERE id = 1020;

UPDATE public.vpr_answers
SET
    text = 'Образец / Оценивается по критериям (см. объяснение вопроса)',
    is_correct = true -- Represents task completion/evaluation
WHERE id = 2909 AND question_id = 1020;


COMMIT; -- End transaction
-- ======================================================================
-- End of SQL Script for English VPR Variant 2
-- ======================================================================

-- Optional: Reset sequence for vpr_answers if needed after inserts
-- SELECT setval('public.vpr_answers_id_seq', COALESCE((SELECT MAX(id) + 1 FROM public.vpr_answers), 1), false);