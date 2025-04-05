-- UPDATE statements for Math Grade 6 (subject_id = 7)
-- Replace question_id with the actual ID from the SELECT query output.

-- Variant 4, Position 5 (Image -> Compare)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 2.2, "size2": 1, "label1": "Автобус (прим.)", "label2": "Автомобиль", "referenceLabel": "Длина автомобиля 4,2 м (420 см)"
}'::jsonb WHERE id = /*_ID_FOR_VAR4_POS5_*/ AND subject_id = 2;

-- Variant 4, Position 6 (Diagram -> Chart)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [3, 6, 8, 5], "labels": ["Оц. \\"2\\"", "Оц. \\"3\\"", "Оц. \\"4\\"", "Оц. \\"5\\""], "title": "Результаты контрольной 6 «В»"
}'::jsonb WHERE id = /*_ID_FOR_VAR4_POS6_*/ AND subject_id = 2;

-- Variant 4, Position 8 (Coord. Line -> Axis) - Using VPR answers despite visual contradiction
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": 1.5, "label": "A"}, {"value": 2.105, "label": "B"}, {"value": 3.5, "label": "C"}], "minVal": 0, "maxVal": 4
}'::jsonb WHERE id = /*_ID_FOR_VAR4_POS8_*/ AND subject_id = 2;

-- Variant 5, Position 5 (Image -> Compare)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 4.1, "size2": 2.7, "label1": "Дерево", "label2": "Куст (прим.)", "referenceLabel": "Высота дерева 4,1 м"
}'::jsonb WHERE id = /*_ID_FOR_VAR5_POS5_*/ AND subject_id = 2;

-- Variant 5, Position 6 (Diagram -> Chart) - Using placeholder data
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [40, 35, 50, 65, 78, 60, 68, 72, 55, 71, 45, 40], "labels": ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"], "title": "Осадки в Томске (мм, пример)"
}'::jsonb WHERE id = /*_ID_FOR_VAR5_POS6_*/ AND subject_id = 2;

-- Variant 5, Position 8 (Coord. Line -> Axis) - Using VPR answers
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -24/7, "label": "P"}, {"value": -20/9, "label": "Q"}, {"value": 16/7, "label": "R"}], "minVal": -4, "maxVal": 4
}'::jsonb WHERE id = /*_ID_FOR_VAR5_POS8_*/ AND subject_id = 2; -- Note: Used fractional values for precision

-- Variant 6, Position 5 (Image -> Compare)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 10, "size2": 7, "label1": "Дом", "label2": "Столб (прим.)", "referenceLabel": "Высота дома 10 м"
}'::jsonb WHERE id = /*_ID_FOR_VAR6_POS5_*/ AND subject_id = 2;

-- Variant 6, Position 6 (Diagram -> Chart) - Using placeholder data
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [5, 8, 10, 6, 7], "labels": ["Пн", "Вт", "Ср", "Чт", "Пт"], "title": "Посещаемость кружка"
}'::jsonb WHERE id = /*_ID_FOR_VAR6_POS6_*/ AND subject_id = 2;

-- Variant 6, Position 8 (Coord. Line -> Axis)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -1.6, "label": "A"}, {"value": 0.55, "label": "B"}, {"value": 2.8, "label": "C"}], "minVal": -2, "maxVal": 3
}'::jsonb WHERE id = /*_ID_FOR_VAR6_POS8_*/ AND subject_id = 2;

-- Variant 7, Position 5 (Image -> Compare)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 8, "size2": 4.5, "label1": "Грузовик", "label2": "Легковой (прим.)", "referenceLabel": "Длина грузовика 8 м"
}'::jsonb WHERE id = /*_ID_FOR_VAR7_POS5_*/ AND subject_id = 2;

-- Variant 7, Position 6 (Diagram -> Plot) - Using placeholder data
UPDATE public.vpr_questions SET visual_data = '{
    "type": "plot", "points": [{"x":0, "y":8}, {"x":3, "y":9}, {"x":6, "y":10}, {"x":9, "y":13}, {"x":12, "y":15}, {"x":15, "y":14}, {"x":18, "y":12}, {"x":21, "y":10}, {"x":24, "y":8}], "xLabel": "Время (часы)", "yLabel": "Температура (°C)", "title": "Температура воздуха (пример)"
}'::jsonb WHERE id = /*_ID_FOR_VAR7_POS6_*/ AND subject_id = 2;

-- Variant 7, Position 8 (Coord. Line -> Axis)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -1/3, "label": "P"}, {"value": 1.15, "label": "Q"}, {"value": 3.05, "label": "R"}], "minVal": -1, "maxVal": 4
}'::jsonb WHERE id = /*_ID_FOR_VAR7_POS8_*/ AND subject_id = 2;

-- ... continue for Variants 8 and 9 ...

-- Variant 8, Position 5 (Image -> Compare)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 7, "size2": 1, "label1": "Стол (прим.)", "label2": "Карандаш", "referenceLabel": "Длина карандаша 15 см"
}'::jsonb WHERE id = /*_ID_FOR_VAR8_POS5_*/ AND subject_id = 2;

-- Variant 8, Position 6 (Diagram -> Chart) - Using placeholder data
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [40, 60, 50, 70, 55, 80], "labels": ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"], "title": "Продажи книг (шт.)"
}'::jsonb WHERE id = /*_ID_FOR_VAR8_POS6_*/ AND subject_id = 2;

-- Variant 8, Position 8 (Coord. Line -> Axis)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -2.1, "label": "X"}, {"value": 0.05, "label": "Y"}, {"value": 1.9, "label": "Z"}], "minVal": -3, "maxVal": 3
}'::jsonb WHERE id = /*_ID_FOR_VAR8_POS8_*/ AND subject_id = 2;

-- Variant 9, Position 5 (Image -> Compare)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 1.2, "size2": 1, "label1": "Дверь (прим.)", "label2": "Человек", "referenceLabel": "Рост человека 1,8 м"
}'::jsonb WHERE id = /*_ID_FOR_VAR9_POS5_*/ AND subject_id = 2;

-- Variant 9, Position 6 (Diagram -> Chart) - Using placeholder data
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [25, 30, 15, 20, 10], "labels": ["Детектив", "Фантастика", "Классика", "Приключения", "Поэзия"], "title": "Жанры книг в библиотеке (шт.)"
}'::jsonb WHERE id = /*_ID_FOR_VAR9_POS6_*/ AND subject_id = 2;

-- Variant 9, Position 8 (Coord. Line -> Axis)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -1.1, "label": "M"}, {"value": 0.8, "label": "N"}, {"value": 2.05, "label": "K"}], "minVal": -2, "maxVal": 3
}'::jsonb WHERE id = /*_ID_FOR_VAR9_POS8_*/ AND subject_id = 2;

-- IMPORTANT: Replace /*_ID_FOR_..._*/ with the actual IDs from your database after running the SELECT query!