-- ====================================================
-- === SEEDING ENGLISH 7th Grade, VARIANT 1 (Dota 2) ===
-- ====================================================

-- Ensure the English Grade 7 subject exists
INSERT INTO public.subjects (name, grade_level, description)
VALUES ('Английский язык', 7, 'Проверка знаний английского языка для 7 класса. Тема: Dota 2.')
ON CONFLICT (name, grade_level) DO NOTHING;

DO $$
DECLARE
    subj_en7_id INT;
    q_id INT;
    v_variant_number INT := 1; -- Using Variant 1 for this test
BEGIN
    SELECT id INTO subj_en7_id FROM public.subjects WHERE name = 'Английский язык' AND grade_level = 7;

    IF subj_en7_id IS NOT NULL THEN
        RAISE NOTICE 'Preparing to seed English Grade 7, Variant % (Dota 2 Theme)...', v_variant_number;

        -- **STEP 1: Remove existing questions and answers for this variant**
        RAISE NOTICE 'Deleting existing data for English Grade 7, Variant %...', v_variant_number;
        DELETE FROM public.vpr_answers a
        USING public.vpr_questions q
        WHERE a.question_id = q.id
          AND q.subject_id = subj_en7_id
          AND q.variant_number = v_variant_number;

        DELETE FROM public.vpr_questions
        WHERE subject_id = subj_en7_id
          AND variant_number = v_variant_number;
        RAISE NOTICE 'Deletion complete for English Grade 7, Variant %.', v_variant_number;

        -- **STEP 2: Insert new questions and answers**
        RAISE NOTICE 'Seeding English Grade 7, Variant %...', v_variant_number;

        -- Question 1 (Var 1, Grade 7) - Vocabulary Matching (Heroes/Roles)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_en7_id, v_variant_number, E'Match the hero with their typical role:\n\n[Image: Dota 2 Heroes Grid]\n\nA) Phantom Assassin   B) Crystal Maiden   C) Axe   D) Pudge\n\n1. Offlaner (initiator, durable)\n2. Midlaner (ganker, high impact)\n3. Hard Carry (needs farm, deals high damage late game)\n4. Hard Support (helps the team, uses spells)\n\nWrite the numbers for A, B, C, D.', E'A) Phantom Assassin is a Hard Carry (3).\nB) Crystal Maiden is a Hard Support (4).\nC) Axe is an Offlaner (1).\nD) Pudge is often played as a Midlaner or Roaming Support/Ganker (2 is the closest fit here).\nCorrect sequence: 3412.', 1,
        '{"type": "image", "url": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/english/7/eng7_var1_q1_heroes_grid.png", "alt": "Dota 2 Heroes Grid", "caption": "AI Prompt: Grid of 4 simple, clear cartoon portraits in Dota 2 style: 1. Phantom Assassin (female, masked, ethereal blue glow). 2. Crystal Maiden (female mage, blue icy theme, blonde hair, staff). 3. Axe (large red muscular male warrior, no shirt, big axe). 4. Pudge (large, fat, stitched-together creature, holding a hook)."}'::jsonb)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '3412', true),
        (q_id, '1234', false), -- Incorrect matching
        (q_id, '3421', false), -- Swapped Axe and Pudge
        (q_id, '4312', false); -- Swapped PA and CM

        -- Question 2 (Var 1, Grade 7) - Grammar (Present Perfect)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Choose the correct verb forms:\n\nI ______ never ______ that hero before.', E'The Present Perfect tense is formed with 'have/has + past participle'. For the subject 'I', we use 'have'. The past participle of 'play' is 'played'. 'Never' is an adverb often used with this tense. So, 'have never played'.', 2)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'have / played', true),
        (q_id, 'has / played', false), -- 'has' is for he/she/it
        (q_id, 'did / play', false), -- Past Simple structure, but 'before' suggests Present Perfect
        (q_id, 'am / playing', false); -- Present Continuous

        -- Question 3 (Var 1, Grade 7) - Reading Comprehension (Roshan)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Read the text about Roshan:\n"Roshan is the most powerful neutral creep in Dota 2. He resides in a pit on the map. Teams often fight to defeat him because he drops a very important item upon death called the Aegis of the Immortal. This item allows the hero carrying it to resurrect instantly after dying."\n\nWhat key item does Roshan drop?', E'The text clearly states that Roshan drops the "Aegis of the Immortal".', 3)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Aegis of the Immortal', true),
        (q_id, 'Cheese', false), -- Drops on third death onwards, Aegis is primary
        (q_id, 'Refresher Shard', false), -- Drops on third death onwards
        (q_id, 'Divine Rapier', false); -- A powerful item bought in the shop, not dropped by Roshan initially

        -- Question 4 (Var 1, Grade 7) - Vocabulary (Phrasal Verbs)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Choose the correct phrasal verb:\n\nIn the early game, the support needs to ______ the carry player.', E''Look after' means to take care of or protect someone, which is the role of a support towards their carry in Dota 2.', 4)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'look after', true),
        (q_id, 'look up', false), -- Means to search for information
        (q_id, 'look for', false), -- Means to search or seek
        (q_id, 'look into', false); -- Means to investigate

        -- Question 5 (Var 1, Grade 7) - Image Interpretation (Action)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_en7_id, v_variant_number, E'Look at the picture. What are the heroes most likely doing?\n\n[Image: Dota 2 Team Fight]', E'The image depicts two teams of heroes clustered together near a tower, with visual effects suggesting combat. This scenario represents a "team fight".', 5,
        '{"type": "image", "url": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/english/7/eng7_var1_q5_team_fight.png", "alt": "Dota 2 Team Fight", "caption": "AI Prompt: Colorful cartoon top-down view of a Dota 2 battle. Five heroes with blue outlines are fighting five heroes with red outlines near a large stone tower. Bright spell effects (explosions, lasers, glowing areas) are visible between them. Minimalist background."}'::jsonb)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'Having a team fight', true),
        (q_id, 'Farming neutral creeps', false), -- Neutral creeps are usually in the jungle, not under towers in groups
        (q_id, 'Destroying the Ancient', false), -- Ancients are specific large structures in the base
        (q_id, 'Killing Roshan', false); -- Roshan is in a specific pit, not usually near lane towers

        -- Question 6 (Var 1, Grade 7) - Grammar (Superlative Adjectives)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Choose the correct form:\n\nAnti-Mage farms ______ of all carries in the late game if not pressured.', E'For short adjectives like 'fast', the superlative is formed by adding '-est' (fastest). We also typically use 'the' before superlatives: 'the fastest'.', 6)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'the fastest', true),
        (q_id, 'faster', false), -- Comparative, used for comparing two things
        (q_id, 'fast', false),  -- Base adjective
        (q_id, 'the most fast', false); -- Incorrect superlative formation for 'fast'

        -- Question 7 (Var 1, Grade 7) - Vocabulary (Game Concepts)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'In Dota 2, what does the term "Gank" usually mean?', E'A "gank" (short for gang kill) is when one or more heroes move to a different lane or area to try and surprise and kill an enemy hero.', 7)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'To surprise attack an enemy hero', true),
        (q_id, 'To farm neutral creeps in the jungle', false), -- This is jungling/farming
        (q_id, 'To push a tower with creeps', false), -- This is pushing
        (q_id, 'To teleport back to the base', false); -- This is using a TP scroll

        -- Question 8 (Var 1, Grade 7) - Reading Comprehension (Item Description)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Read the item description:\n"Black King Bar (BKB): Grants the wearer magic immunity for a duration when activated. This prevents most enemy spells from affecting the hero, allowing them to act freely in fights."\n\nWhat is the primary benefit of using BKB?', E'The description clearly states the item "Grants the wearer magic immunity", preventing spells from affecting them.', 8)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'It makes the hero immune to magic spells', true),
        (q_id, 'It greatly increases the hero''s damage', false), -- BKB provides some stats but its main purpose is immunity
        (q_id, 'It allows the hero to teleport anywhere', false), -- This describes Boots of Travel or TP Scroll
        (q_id, 'It makes the hero invisible', false); -- This describes items like Shadow Blade or Glimmer Cape

        -- Question 9 (Var 1, Grade 7) - Grammar (Past Continuous)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Choose the correct verb forms:\n\nWhile Axe ______ (call) his Culling Blade, Invoker ______ (cast) Sunstrike.', E'The Past Continuous (was/were + -ing) is used for an ongoing action in the past that is interrupted or happens at the same time as another shorter action (often Past Simple) or another ongoing action. Here, two actions happen concurrently. 'While' often introduces a Past Continuous clause. Both actions were likely ongoing: Axe was in the process of calling, and Invoker was in the process of casting. So, 'was calling' and 'was casting'.', 9)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'was calling / was casting', true), -- Both actions likely ongoing simultaneously
        (q_id, 'called / cast', false), -- Past Simple for both suggests sequential or completed actions
        (q_id, 'was calling / cast', false), -- Mix suggests casting was a short interruption
        (q_id, 'called / was casting', false); -- Mix suggests calling was a short action during casting

        -- Question 10 (Var 1, Grade 7) - True/False Statements (Map Objectives)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Read the statements about Dota 2 map objectives. Choose the numbers of the TRUE statements:\n\n1. Destroying enemy Barracks makes your creeps stronger in that lane.\n2. The main goal is to destroy the enemy''s Fountain.\n3. Towers attack enemy units that come near them.\n4. Roshan is considered a map objective for the Aegis.', E'1. True - Destroying melee/ranged barracks spawns mega creeps.\n2. False - The main goal is to destroy the enemy Ancient structure inside the base.\n3. True - Towers are defensive structures that attack enemies.\n4. True - While not a structure, securing Roshan for the Aegis is a major team objective.\nCorrect statements: 1, 3, 4.', 10)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '134', true),
        (q_id, '341', true), -- Order doesn't matter
        (q_id, '123', false), -- Includes incorrect statement 2
        (q_id, '234', false), -- Includes incorrect statement 2
        (q_id, '13', false); -- Missing statement 4

        -- Question 11 (Var 1, Grade 7) - Vocabulary (Synonyms)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Which word is a synonym for "powerful"?', E'A synonym is a word with a similar meaning. "Strong" has a meaning very similar to "powerful".', 11)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'strong', true),
        (q_id, 'weak', false), -- Antonym (opposite)
        (q_id, 'fast', false), -- Relates to speed, not power
        (q_id, 'fragile', false); -- Means easily broken, opposite of strong/powerful

        -- Question 12 (Var 1, Grade 7) - Image - Word Matching (Items)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position, visual_data)
        VALUES (subj_en7_id, v_variant_number, E'Look at the picture and match the items to the letters:\n\n[Image: Dota 2 Items Grid]\n\nA) Black King Bar   B) Blink Dagger   C) Tango   D) Town Portal Scroll\n\n1. A consumable that lets you eat trees for health.\n2. An activatable item providing magic immunity.\n3. A consumable scroll used for teleporting to base or towers.\n4. An activatable item allowing instant short-distance teleportation.\n\nWrite the numbers for A, B, C, D.', E'A) Black King Bar matches description 2 (magic immunity).\nB) Blink Dagger matches description 4 (short teleport).\nC) Tango matches description 1 (eat trees).\nD) Town Portal Scroll matches description 3 (teleport scroll).\nCorrect sequence: 2413.', 12,
        '{"type": "image", "url": "https://inmctohsodgdohamhzag.supabase.co/storage/v1/object/public/vprtests/english/7/eng7_var1_q12_items_grid.png", "alt": "Dota 2 Items Grid", "caption": "AI Prompt: Grid of 4 simple, distinct cartoon items from Dota 2 on a neutral background: 1. Black King Bar (a golden sword glowing yellow). 2. Blink Dagger (a sharp blue dagger). 3. Tango (a single green leaf-like item). 4. Town Portal Scroll (a rolled-up paper scroll, slightly glowing red or blue)."}'::jsonb)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, '2413', true),
        (q_id, '1234', false), -- Incorrect matching
        (q_id, '2431', false), -- Swapped Tango and TP Scroll
        (q_id, '4213', false); -- Swapped BKB and Blink

        -- Question 13 (Var 1, Grade 7) - Grammar (First Conditional)
        INSERT INTO public.vpr_questions (subject_id, variant_number, text, explanation, position)
        VALUES (subj_en7_id, v_variant_number, E'Choose the correct verb forms for this conditional sentence:\n\nIf you ______ Observer Wards, you ______ the enemy movements better.', E'This is a First Conditional sentence, describing a likely future result of a possible action. The structure is: If + Present Simple, will + base verb. So, 'If you buy, you will see'.', 13)
        RETURNING id INTO q_id;
        INSERT INTO public.vpr_answers (question_id, text, is_correct) VALUES
        (q_id, 'buy / will see', true),
        (q_id, 'will buy / see', false), -- Incorrect: 'will' should not be in the 'if' clause
        (q_id, 'bought / would see', false), -- This is Second Conditional structure (unreal present/future)
        (q_id, 'buy / see', false); -- This is Zero Conditional (general truths), less fitting here

        RAISE NOTICE 'Finished seeding English Grade 7, Variant %.', v_variant_number;
    ELSE
        RAISE NOTICE 'Subject "Английский язык" Grade 7 not found. Skipping Variant %.', v_variant_number;
    END IF;
END $$;
