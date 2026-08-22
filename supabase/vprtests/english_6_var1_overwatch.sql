-- ========================================================
-- === SEEDING ENGLISH 6th Grade, VARIANT 1 (Overwatch 2) ===
-- ========================================================

-- Ensure the English Grade 6 subject exists
INSERT INTO public.subjects (name, grade_level, description)
VALUES ('Английский язык', 6, 'Проверка знаний английского языка для 6 класса. Тема: Overwatch 2.')
ON CONFLICT (name, grade_level) DO NOTHING;

DO $$
DECLARE
    subj_en6_id INT;
    q_id INT;
    v_variant_number INT := 1; -- Using Variant 1 for this test
BEGIN
    SELECT id INTO subj_en6_id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 6;

    IF subj_en6_id IS NOT NULL THEN
        RAISE NOTICE 'Preparing to seed English Grade 6, Variant % (Overwatch 2 Theme)...', v_variant_number;

        -- **STEP 1: Remove existing questions and answers for this variant**
        RAISE NOTICE 'Deleting existing data for English Grade 6, Variant %...', v_variant_number;
        DELETE FROM public.vpr_answers a
        USING public.vpr_questions q
        WHERE a.question_id = q.id
          AND q.subject_id = subj_en6_id
          AND q.variant_number = v_variant_number;

        DELETE FROM public.vpr_questions
        WHERE subject_id = subj_en6_id
          AND variant_number = v_variant_number;
        RAISE NOTICE 'Deletion complete for English Grade 6, Variant %.', v_variant_number;

        -- **STEP 2: Insert new questions and answers**
        RAISE NOTICE 'Seeding English Grade 6, Variant %...', v_variant_number;

        -- Question 1 (Var 1, Grade 6) - Vocabulary Matching (Heroes/Descriptions)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_en6_id, v_variant_number, E'Match the hero with the description:\n\n[Image: Overwatch Heroes Grid]\n\nA) Tracer   B) Reinhardt   C) Mercy   D) Winston\n\n1. A scientist gorilla from the moon.\n2. A fast hero who can rewind time.\n3. An angel who can heal teammates.\n4. A large knight with a big shield.\n\nWrite the numbers for A, B, C, D.', E'A) Tracer matches description 2.\nB) Reinhardt matches description 4.\nC) Mercy matches description 3.\nD) Winston matches description 1.\nCorrect sequence: 2431.', 1,
        '{"type": "image", "url": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/english/6/eng6_var1_q1_heroes_grid.png", "alt": "Overwatch Heroes Grid", "caption": "AI Prompt: Grid of 4 simple, friendly cartoon portraits in Overwatch 2 style: 1. Tracer (smiling, goggles on head, orange/brown hair). 2. Reinhardt (big smile, grey beard, inside helmet). 3. Mercy (smiling, blonde hair, halo). 4. Winston (gorilla wearing glasses, thoughtful smile)."}'::jsonb)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '2431', true),
        (q_id, '1234', false), -- Incorrect matching
        (q_id, '2413', false), -- Swapped Mercy and Winston
        (q_id, '4231', false); -- Swapped Tracer and Reinhardt

        -- Question 2 (Var 1, Grade 6) - Grammar (Present Simple 3rd Person)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'Choose the correct word:\n\nMercy always ______ her teammates.', E'We use the -s form of the verb for the third person singular (He, She, It) in the Present Simple tense. Mercy is "She", so we need "helps".', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'helps', true),
        (q_id, 'help', false),  -- Base form, incorrect for 3rd person singular
        (q_id, 'is helping', false), -- Present Continuous, 'always' suggests Present Simple
        (q_id, 'helped', false); -- Past Simple

        -- Question 3 (Var 1, Grade 6) - Reading Comprehension (Map Purpose)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'Read the text about the map:\n"Watchpoint: Gibraltar is a map where one team must push a payload (a vehicle) along a track. The other team tries to stop them before the payload reaches the final destination. There are checkpoints along the way."\n\nWhat is the main goal for the attacking team on this map?', E'The text explicitly states the attacking team must "push a payload". This type of map is called an Escort map.', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Push the payload', true),
        (q_id, 'Capture a point', false), -- This describes Control or Assault maps
        (q_id, 'Stop the payload', false), -- This is the goal of the defending team
        (q_id, 'Find the checkpoints', false); -- Checkpoints are part of the map, not the main goal

        -- Question 4 (Var 1, Grade 6) - Vocabulary (Prepositions of Movement/Place)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'Choose the correct preposition:\n\nTracer blinked quickly ______ the enemy line.', E'To blink 'behind' means to quickly appear at the back of something. This fits the context of Tracer's ability to bypass enemies.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'behind', true),
        (q_id, 'at', false),    -- 'Blink at' doesn't make sense here
        (q_id, 'on', false),    -- 'Blink on' implies landing on top, less likely intent
        (q_id, 'in', false);    -- 'Blink in' doesn't fit the context

        -- Question 5 (Var 1, Grade 6) - Image Interpretation (Action)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_en6_id, v_variant_number, E'Look at the picture. What is the main action happening near the cart?\n\n[Image: Payload near Checkpoint]', E'The image shows a payload cart very close to a checkpoint marker on the ground, with a friendly hero nearby. This indicates the action of pushing the payload towards the objective.', 5,
        '{"type": "image", "url": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/english/6/eng6_var1_q5_payload_checkpoint.png", "alt": "Payload near Checkpoint", "caption": "AI Prompt: Simple cartoon scene from Overwatch 2 game. A bright blue glowing vehicle (payload) is inches away from a clearly marked white line (checkpoint) on a path. A large friendly character like Reinhardt stands protectively next to the payload. A shadowy enemy figure like Reaper is visible further down the path, looking towards them."}'::jsonb)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Pushing the payload to the checkpoint', true),
        (q_id, 'Capturing a control point', false), -- Control points look different
        (q_id, 'Defending the payload', false), -- The friendly hero is pushing, not stopping it
        (q_id, 'Repairing the cart', false); -- No indication of repairs

        -- Question 6 (Var 1, Grade 6) - Grammar (Comparative Adjectives)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'Choose the correct form:\n\nReinhardt''s shield is ______ than Wrecking Ball''s health.', E'For short adjectives like "big", we form the comparative by adding "-er" (bigger). "More big" is incorrect.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'bigger', true),
        (q_id, 'more big', false), -- Incorrect formation of comparative
        (q_id, 'biggest', false), -- Superlative, used for comparing three or more
        (q_id, 'big', false);   -- Base form, not comparative

        -- Question 7 (Var 1, Grade 6) - Vocabulary (Game Terms)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'In Overwatch 2, what does "Ultimate Ability" mean?', E'An "Ultimate Ability" or "Ult" is a heros most powerful, special ability that needs time or actions to charge up.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'A hero''s special, powerful skill', true),
        (q_id, 'The main weapon attack', false), -- This is the primary fire
        (q_id, 'A way to change heroes', false), -- This happens in the spawn room
        (q_id, 'The score of the game', false); -- This is unrelated

        -- Question 8 (Var 1, Grade 6) - Reading Comprehension (Dialogue)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'Read the dialogue:\nLúcio: "Hey D.Va! Ready to drop the beat and push the payload?"\nD.Va: "You know it, Lúcio! Lets show them our moves. My mech is ready!"\nLúcio: "Alright! Let''s bring the noise!"\n\nWhat are Lúcio and D.Va getting ready for?', E'The dialogue mentions "push the payload", "show them our moves", and "mech is ready", indicating they are preparing for a game or match in Overwatch.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Playing a game match', true),
        (q_id, 'Going to a concert', false), -- Music is mentioned, but context is gameplay
        (q_id, 'Repairing a mech', false), -- The mech is ready, not being repaired
        (q_id, 'Listening to music', false); -- They plan to 'bring the noise', likely in-game action/sound

        -- Question 9 (Var 1, Grade 6) - Grammar (Past Simple Irregular)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'Choose the correct verb form:\n\nYesterday, our Overwatch team ______ the final match.', E'The past tense of the irregular verb "win" is "won". "Yesterday" indicates we need the Past Simple tense.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'won', true),
        (q_id, 'win', false),  -- Base form
        (q_id, 'wins', false), -- Present Simple 3rd person singular
        (q_id, 'winning', false); -- Present Participle/Gerund

        -- Question 10 (Var 1, Grade 6) - True/False Statements (Roles)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'Read the statements about Overwatch roles. Choose the numbers of the TRUE statements:\n\n1. Tanks protect their team and have lots of health.\n2. Support heroes only damage the enemies.\n3. Damage heroes focus on healing the team.\n4. Support heroes often heal their teammates.', E'1. True - This is the main job of a Tank.\n2. False - Supports primarily heal or provide utility; some do damage, but it''s not their only role.\n3. False - Damage heroes focus on dealing damage; Supports heal.\n4. True - Healing is a primary function of most Support heroes.\nCorrect statements: 1 and 4.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '14', true),
        (q_id, '41', true), -- Order doesn't matter
        (q_id, '12', false), -- Includes incorrect statement 2
        (q_id, '34', false), -- Includes incorrect statement 3
        (q_id, '13', false); -- Includes incorrect statement 3

        -- Question 11 (Var 1, Grade 6) - Vocabulary (Antonyms)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'What is the opposite of "attack"?', E'To "attack" means to try to harm or defeat someone. The opposite action is to "defend", meaning to protect from harm.', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'defend', true),
        (q_id, 'heal', false),  -- Healing is a different action, often done while defending or attacking
        (q_id, 'support', false), -- Supporting can involve attacking or defending
        (q_id, 'move', false);  -- Moving is a neutral action

        -- Question 12 (Var 1, Grade 6) - Image - Sentence Matching
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_en6_id, v_variant_number, E'Look at the picture and match the actions to the letters:\n\n[Image: Overwatch Actions]\n\nA) Soldier: 76   B) Pharah   C) Ana\n\n1. She is flying high in the sky.\n2. He is running on the ground.\n3. She is aiming her rifle carefully.\n\nWrite the numbers for A, B, C.', E'A) Soldier: 76 matches action 2 (running).\nB) Pharah matches action 1 (flying).\nC) Ana matches action 3 (aiming rifle).\nCorrect sequence: 213.', 12,
        '{"type": "image", "url": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/english/6/eng6_var1_q12_hero_actions.png", "alt": "Overwatch Actions", "caption": "AI Prompt: Simple, clear cartoon scene in Overwatch 2 style. Left: Soldier: 76 character running forward on ground level. Middle: Pharah character flying high up in a blue sky with clouds. Right: Ana character crouching slightly, aiming a long sniper rifle. Minimal background."}'::jsonb)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '213', true),
        (q_id, '123', false), -- Incorrect matching
        (q_id, '231', false), -- Swapped Pharah and Ana
        (q_id, '312', false); -- Incorrect matching

        -- Question 13 (Var 1, Grade 6) - Grammar (Wh- Questions)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en6_id, v_variant_number, E'Choose the best question for the answer:\n\nAnswer: Because she wants to protect her team from the enemy ultimate.\n\nQuestion: ______', E'The answer starts with "Because", indicating it explains a reason. A "Why" question asks for a reason.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Why is Zarya using her shield?', true),
        (q_id, 'When did Zarya use her shield?', false), -- Asks about time
        (q_id, 'Who used the shield?', false), -- Asks about the person (already known from context)
        (q_id, 'What shield did Zarya use?', false); -- Asks about the type of shield (less likely given the 'because')

        RAISE NOTICE 'Finished seeding English Grade 6, Variant %.', v_variant_number;
    ELSE
        RAISE NOTICE 'Subject "Английский язык" Grade 6 not found. Skipping Variant %.', v_variant_number;
    END IF;
END $$;
