--Ensure the correct subject_id is used. Assuming 'Математика 6 класс' corresponds to subject_id = 35
-- If you used a different ID when inserting the subjects, update the WHERE clauses accordingly.

-- Variant 1, Position 5 (ID: 611)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 4.5, "size2": 1, "label1": "Щука (прим.)", "label2": "Окунь", "referenceLabel": "Длина окуня 20 см"
}'::jsonb WHERE id = 611 AND subject_id = 35;

-- Variant 1, Position 6 (ID: 612)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [100, 95, 90, 85, 80, 75, 70, 65, 60, 55], "labels": ["ЕС", "Китай", "Индия", "Россия", "США", "Канада", "Украина", "Австралия", "Аргентина", "Казахстан"], "title": "Объемы производства пшеницы (Вар.1, отн.)"
}'::jsonb WHERE id = 612 AND subject_id = 35;

-- Variant 1, Position 8 (ID: 614) - Using VPR answer key values
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -3.28, "label": "K"}, {"value": -2.3, "label": "N"}, {"value": 2.86, "label": "P"}], "minVal": -4, "maxVal": 4
}'::jsonb WHERE id = 614 AND subject_id = 35;

-- Variant 1, Position 12 (ID: 618) - Drawing/Symmetry - No suitable JSON type defined, leaving visual_data NULL
-- No UPDATE statement needed for id = 618 unless a new 'drawing' type or image link is added later.

-- Variant 2, Position 5 (ID: 624)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 3, "size2": 1, "label1": "Хозяин (прим.)", "label2": "Собака", "referenceLabel": "Рост собаки 55 см"
}'::jsonb WHERE id = 624 AND subject_id = 35;

-- Variant 2, Position 6 (ID: 625) - Placeholder data based on context
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [-15, -13, -5, 5, 12, 18, 20, 17, 10, 2, -8, -14], "labels": ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"], "title": "Средняя темп. в Перми (Вар.2, пример)"
}'::jsonb WHERE id = 625 AND subject_id = 35;

-- Variant 2, Position 8 (ID: 627) - Using VPR answer key values
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -2.16, "label": "M"}, {"value": -1.82, "label": "N"}, {"value": 4.33, "label": "Q"}], "minVal": -3, "maxVal": 5
}'::jsonb WHERE id = 627 AND subject_id = 35;

-- Variant 2, Position 12 (ID: 631) - Drawing/Geometry (Cube Net) - No suitable JSON type defined, leaving visual_data NULL
-- No UPDATE statement needed for id = 631

-- Variant 3, Position 5 (ID: 637) - Renamed from Position 5 in CSV, seems like a typo, should be Pos 6 based on content? Assuming Pos 6 based on similar questions. Re-check original source. If it IS Pos 5:
-- UPDATE public.vpr_questions SET visual_data = '{
--    "type": "chart", "data": [100, 95, 90, 85, 80, 75, 70, 65, 60, 55], "labels": ["Китай", "ЕС", "США", "Индия", "Россия", "Канада", "Аргентина", "Украина", "Австралия", "Казахстан"], "title": "Объемы производства зерна (Вар.3, отн.)"
-- }'::jsonb WHERE id = 637 AND subject_id = 35;
-- Correction: Based on the content type (Diagram -> Chart like other Pos 6 questions), let's assume it was meant for Pos 6, or the Pos 5 in CSV is correct. Let's proceed assuming CSV is correct for ID 637, Pos 5.
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [100, 95, 90, 85, 80, 75, 70, 65, 60, 55], "labels": ["Китай", "ЕС", "США", "Индия", "Россия", "Канада", "Аргентина", "Украина", "Австралия", "Казахстан"], "title": "Объемы производства зерна (Вар.3, отн.)"
}'::jsonb WHERE id = 637 AND subject_id = 35;


-- Variant 3, Position 8 (ID: 640)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -4.11, "label": "K"}, {"value": -1.82, "label": "N"}, {"value": 3.07, "label": "Q"}], "minVal": -5, "maxVal": 4
}'::jsonb WHERE id = 640 AND subject_id = 35;

-- Variant 4, Position 5 (ID: 915)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 2.2, "size2": 1, "label1": "Автобус (прим.)", "label2": "Автомобиль", "referenceLabel": "Длина автомобиля 4,2 м"
}'::jsonb WHERE id = 915 AND subject_id = 35;

-- Variant 4, Position 6 (ID: 916)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [3, 6, 8, 5], "labels": ["Оц. 2", "Оц. 3", "Оц. 4", "Оц. 5"], "title": "Результаты контрольной 6 «В»"
}'::jsonb WHERE id = 916 AND subject_id = 35;

-- Variant 4, Position 8 (ID: 918) - Using VPR answer key values (ignoring visual contradiction)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": 1.5, "label": "A"}, {"value": 2.105, "label": "B"}, {"value": 3.5, "label": "C"}], "minVal": 0, "maxVal": 4
}'::jsonb WHERE id = 918 AND subject_id = 35;

-- Variant 4, Position 12 (ID: 922) - Drawing/Symmetry - No suitable JSON type defined, leaving visual_data NULL
-- No UPDATE statement needed for id = 922

-- Variant 5, Position 5 (ID: 928)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 4.1, "size2": 2.4, "label1": "Дерево", "label2": "Куст (прим.)", "referenceLabel": "Высота дерева 4,1 м"
}'::jsonb WHERE id = 928 AND subject_id = 35;

-- Variant 5, Position 6 (ID: 929) - Placeholder data consistent with explanation
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [40, 35, 50, 65, 78, 60, 68, 72, 55, 71, 45, 40], "labels": ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"], "title": "Осадки в Томске (мм, Вар. 5)"
}'::jsonb WHERE id = 929 AND subject_id = 35;

-- Variant 5, Position 8 (ID: 931) - Using VPR answer key values (decimals)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -3.286, "label": "P"}, {"value": -2.222, "label": "Q"}, {"value": 2.286, "label": "R"}], "minVal": -4, "maxVal": 3
}'::jsonb WHERE id = 931 AND subject_id = 35;
-- Alternative using fractional strings if number precision is tricky:
-- UPDATE public.vpr_questions SET visual_data = '{
--    "type": "axis", "points": [{"value": "-23/7", "label": "P"}, {"value": "-20/9", "label": "Q"}, {"value": "16/7", "label": "R"}], "minVal": -4, "maxVal": 3
-- }'::jsonb WHERE id = 931 AND subject_id = 35; -- Note: Storing as strings needs frontend parsing

-- Variant 5, Position 12 (ID: 935) - Drawing/Geometry (Cube Logic) - No suitable JSON type defined, leaving visual_data NULL
-- No UPDATE statement needed for id = 935

-- Variant 6, Position 5 (ID: 967)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 10, "size2": 6.7, "label1": "Дом", "label2": "Столб (прим.)", "referenceLabel": "Высота дома 10 м"
}'::jsonb WHERE id = 967 AND subject_id = 35;

-- Variant 6, Position 6 (ID: 968) - Placeholder data consistent with explanation
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [5, 8, 10, 6, 7], "labels": ["Пн", "Вт", "Ср", "Чт", "Пт"], "title": "Посещаемость кружка (Вар. 6)"
}'::jsonb WHERE id = 968 AND subject_id = 35;

-- Variant 6, Position 8 (ID: 970)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -1.6, "label": "A"}, {"value": 0.55, "label": "B"}, {"value": 2.8, "label": "C"}], "minVal": -2, "maxVal": 3
}'::jsonb WHERE id = 970 AND subject_id = 35;

-- Variant 7, Position 5 (ID: 980)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 8, "size2": 4.4, "label1": "Грузовик", "label2": "Легковой (прим.)", "referenceLabel": "Длина грузовика 8 м"
}'::jsonb WHERE id = 980 AND subject_id = 35;

-- Variant 7, Position 6 (ID: 981) - Placeholder data consistent with explanation
UPDATE public.vpr_questions SET visual_data = '{
    "type": "plot", "points": [{"x": 0, "y": 9}, {"x": 3, "y": 8}, {"x": 6, "y": 10}, {"x": 9, "y": 13}, {"x": 12, "y": 15}, {"x": 15, "y": 14}, {"x": 18, "y": 12}, {"x": 21, "y": 10}, {"x": 24, "y": 9}], "xLabel": "Время (часы)", "yLabel": "Температура (°C)", "title": "Температура воздуха (Вар. 7)"
}'::jsonb WHERE id = 981 AND subject_id = 35;

-- Variant 7, Position 8 (ID: 983)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -0.333, "label": "P"}, {"value": 1.15, "label": "Q"}, {"value": 3.05, "label": "R"}], "minVal": -1, "maxVal": 4
}'::jsonb WHERE id = 983 AND subject_id = 35;

-- Variant 7, Position 12 (ID: 987) - Drawing/Symmetry - No suitable JSON type defined, leaving visual_data NULL
-- No UPDATE statement needed for id = 987

-- Variant 8, Position 5 (ID: 993)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 105, "size2": 15, "label1": "Стол (прим.)", "label2": "Карандаш", "referenceLabel": "Длина карандаша 15 см"
}'::jsonb WHERE id = 993 AND subject_id = 35;
-- Alternative ratio-based:
-- UPDATE public.vpr_questions SET visual_data = '{
--    "type": "compare", "size1": 7, "size2": 1, "label1": "Стол (прим.)", "label2": "Карандаш", "referenceLabel": "Длина карандаша 15 см"
-- }'::jsonb WHERE id = 993 AND subject_id = 35;

-- Variant 8, Position 6 (ID: 994)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [40, 60, 50, 70, 55, 80], "labels": ["Янв", "Фев", "Мар", "Апр", "Май", "Июн"], "title": "Продажи книг (шт., Вар. 8)"
}'::jsonb WHERE id = 994 AND subject_id = 35;

-- Variant 8, Position 8 (ID: 996)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -2.1, "label": "X"}, {"value": 0.05, "label": "Y"}, {"value": 1.9, "label": "Z"}], "minVal": -3, "maxVal": 3
}'::jsonb WHERE id = 996 AND subject_id = 35;

-- Variant 9, Position 5 (ID: 1006)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "compare", "size1": 2.1, "size2": 1.8, "label1": "Дверь (прим.)", "label2": "Человек", "referenceLabel": "Рост человека 1,8 м"
}'::jsonb WHERE id = 1006 AND subject_id = 35;

-- Variant 9, Position 6 (ID: 1007) - Placeholder data consistent with explanation
UPDATE public.vpr_questions SET visual_data = '{
    "type": "chart", "data": [25, 30, 15, 20, 10], "labels": ["Детектив", "Фантастика", "Классика", "Приключения", "Поэзия"], "title": "Жанры книг (шт., Вар. 9)"
}'::jsonb WHERE id = 1007 AND subject_id = 35;

-- Variant 9, Position 8 (ID: 1009)
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis", "points": [{"value": -1.1, "label": "M"}, {"value": 0.8, "label": "N"}, {"value": 2.05, "label": "K"}], "minVal": -2, "maxVal": 3
}'::jsonb WHERE id = 1009 AND subject_id = 35;