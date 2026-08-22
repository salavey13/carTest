-- UPDATE statements for Math Grade 7 (subject_id = 2) based on CSV data

-- Variant 1, Position 8 (Graph -> Plot)
-- Question ID: 790
UPDATE public.vpr_questions SET visual_data = '{
    "type": "plot",
    "points": [{"x": 0, "y": -1}, {"x": 1, "y": 1}],
    "xLabel": "X", "yLabel": "Y",
    "title": "График линейной функции"
}'::jsonb WHERE id = 790 AND subject_id = 2;

-- Variant 1, Position 12 (Coord. Line -> Axis)
-- Question ID: 794
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis",
    "points": [
        { "value": 1.6, "label": "A" },
        { "value": -1.286, "label": "B" },
        { "value": -2.75, "label": "C" }
    ],
    "minVal": -3, "maxVal": 2
}'::jsonb WHERE id = 794 AND subject_id = 2;

-- Variant 2, Position 12 (Coord. Line -> Axis)
-- Question ID: 810
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis",
    "points": [
        { "value": 4.69, "label": "A" },
        { "value": -3.667, "label": "B" }, 
        { "value": -4.34, "label": "C" }
    ],
    "minVal": -5, "maxVal": 5
}'::jsonb WHERE id = 810 AND subject_id = 2;

-- Variant 3, Position 12 (Coord. Line -> Axis)
-- Question ID: 826
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis",
    "points": [
        { "value": -2.3, "label": "A" },
        { "value": 3.333, "label": "B" },
        { "value": -1.4, "label": "C" }  
    ],
    "minVal": -3, "maxVal": 4
}'::jsonb WHERE id = 826 AND subject_id = 2;

-- Variant 4, Position 12 (Coord. Line -> Axis)
-- Question ID: 842
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis",
    "points": [
        { "value": 2.333, "label": "A" }, 
        { "value": 4.79, "label": "B" },
        { "value": -1.75, "label": "C" }
    ],
    "minVal": -2, "maxVal": 5
}'::jsonb WHERE id = 842 AND subject_id = 2;

-- Variant 5, Position 12 (Coord. Line -> Axis)
-- Question ID: 858
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis",
    "points": [
        { "value": -3.25, "label": "A" }, 
        { "value": 2.833, "label": "B" },
        { "value": -2.429, "label": "C" } 
    ],
    "minVal": -4, "maxVal": 3
}'::jsonb WHERE id = 858 AND subject_id = 2;

-- Variant 6, Position 12 (Coord. Line -> Axis)
-- Question ID: 874
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis",
    "points": [
        { "value": 2.7, "label": "A" },
        { "value": -1.667, "label": "B" }, 
        { "value": 2.25, "label": "C" }  
    ],
    "minVal": -2, "maxVal": 3
}'::jsonb WHERE id = 874 AND subject_id = 2;

-- Variant 7, Position 12 (Coord. Line -> Axis)
-- Question ID: 890
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis",
    "points": [
        { "value": -1.9, "label": "A" },
        { "value": 2.5, "label": "B" }, 
        { "value": -1.6, "label": "C" }  
    ],
    "minVal": -2, "maxVal": 3
}'::jsonb WHERE id = 890 AND subject_id = 2;

-- Variant 8, Position 7 (Graph -> Plot)
-- Question ID: 901
UPDATE public.vpr_questions SET visual_data = '{
    "type": "plot",
    "points": [{"x": 9, "y": 15, "label": "9:00"}, {"x": 12, "y": 21, "label": "12:00"}],
    "xLabel": "Время (часы)",
    "yLabel": "Температура (°C)",
    "title": "Изменение температуры воздуха"
}'::jsonb WHERE id = 901 AND subject_id = 2;

-- Variant 8, Position 12 (Coord. Line -> Axis)
-- Question ID: 906
UPDATE public.vpr_questions SET visual_data = '{
    "type": "axis",
    "points": [
        { "value": 0.8, "label": "A" },
        { "value": -2.2, "label": "B" }, 
        { "value": 1.3, "label": "C" }  
    ],
    "minVal": -3, "maxVal": 2
}'::jsonb WHERE id = 906 AND subject_id = 2;

-- End of updates for Math Grade 7 Visuals